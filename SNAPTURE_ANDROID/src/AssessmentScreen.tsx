import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from './PublicText';
import { contributeIdentification, createManualPrediction, getAssessmentQuestions, imageUrl, updatePrediction, type Assessment, type AssessmentQuestion, type Prediction } from './api';
import { useSuccessAlert } from './SuccessAlertDialog';
import AssessmentAdvice from './AssessmentAdvice';
import {materialConditions} from './materialConditions';
import {materialPreparation} from './materialPreparation';

import { MATERIAL_NAMES } from './detectionPresentation';
export { MATERIAL_NAMES } from './detectionPresentation';

const CONDITION_PRESETS = [
  {label:'Clean, dry and no residue',values:{condition:'Clean and dry',contamination:'None known',moisture:'Dry'}},
  {label:'Wet, but no stains or residue',values:{condition:'Needs cleaning',contamination:'None known',moisture:'Wet'}},
  {label:'Food residue needs cleaning',values:{condition:'Needs cleaning',contamination:'Food residue that can be removed',moisture:'Not sure'}},
  {label:'Damaged, stained or not sure',values:{condition:'Not sure',contamination:'Not sure',moisture:'Not sure'}},
];
const CATEGORY_NAMES:Record<string,string>={A:'Biodegradable',B1:'Recyclable / reusable',B2:'Residual',C:'Special / hazardous',UNIDENTIFIED:'Not sure / unidentified'};
type Catalog={questions:AssessmentQuestion[];quick_check?:Assessment['quick_check']};
function fromPrediction(value:Prediction|null):Catalog { return {questions:value?.assessment?.questions || [],quick_check:value?.assessment?.quick_check}; }
function canShowAdvice(value:Prediction|null) {
  const status=value?.assessment?.material.status;
  if(value?.image_quality?.automatic_routing && status!=='user_selected' && status!=='model_high_confidence')return false;
  if(status==='model_high_confidence')return Boolean(value?.assessment?.quick_check?.user_reviewed);
  return Boolean(value && (value.assessment?.quick_check?.user_reviewed || value.assessment?.segregation?.status==='available' || value.waste_identifier?.category==='C' || value.recommendation_choices?.length || value.condition || value.previous_contents || value.answers?.other_material || value.answers?.contamination));
}
function Button({title,onPress,disabled=false,secondary=false}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}) {
  if(title==='Back')return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={[s.back,disabled && s.disabled]}><ChevronLeft size={22} color="#176b45"/><Text style={s.backText}>Back</Text></Pressable>;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={[secondary ? s.secondary : s.button,disabled && s.disabled]}><Text style={secondary ? s.link : s.buttonText}>{title}</Text></Pressable>;
}

export default function AssessmentScreen({prediction,onChange,onBack,onSaved:_onSaved,onRetry,onManualReset,startInCheck=false,onProceed}:{
  prediction:Prediction|null;onChange:(value:Prediction)=>void;onBack:()=>void;onSaved:()=>void;onRetry:()=>void;onManualReset?:()=>void;startInCheck?:boolean;onProceed?:(prediction:Prediction)=>void;
}) {
  const {showSuccess,successDialog}=useSuccessAlert();
  const [current,setCurrent]=useState(prediction);
  const [view,setView]=useState<'check'|'advice'>(()=>!startInCheck && canShowAdvice(prediction)?'advice':'check');
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [catalog,setCatalog]=useState<Catalog>(()=>fromPrediction(prediction));
  const [loading,setLoading]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [reload,setReload]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState(false);
  const [skipped,setSkipped]=useState(false);
  const [changeMaterial,setChangeMaterial]=useState(false);
  const [more,setMore]=useState(false);
  const [contribution,setContribution]=useState<string|null>(prediction?.review_contribution || null);
  const mounted=useRef(true), busyRef=useRef(false);
  const activeId=useRef(prediction?.id); activeId.current=prediction?.id;
  useEffect(()=>{ mounted.current=true; return ()=>{mounted.current=false;}; },[]);
  useEffect(()=>{ setCurrent(prediction); },[prediction]);
  useEffect(()=>{
    setAnswers({});setCatalog(fromPrediction(prediction));
    setView(!startInCheck && canShowAdvice(prediction)?'advice':'check');setSaved(false);setSkipped(false);setMore(false);setChangeMaterial(false);setError('');
    setContribution(prediction?.review_contribution || null);
    // Only a different item starts a fresh check; saving this item must not reset its result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[prediction?.id]);
  const baseLabel=current?.assessment?.material.label || current?.label || 'unknown_unsupported';
  const chosen=answers.material_confirmation;
  const effectiveLabel=chosen && chosen!=='Not sure' ? chosen : chosen==='Not sure' ? 'unknown_unsupported' : baseLabel;
  useEffect(()=>{
    if (!current || effectiveLabel===baseLabel) {setCatalog(fromPrediction(current));setLoading(false);setLoadError('');return;}
    let active=true;setLoading(true);setLoadError('');
    getAssessmentQuestions(effectiveLabel).then(value=>{if(active)setCatalog(value);}).catch(reason=>{if(active)setLoadError(reason instanceof Error?reason.message:'Unable to load this material’s checks.');}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[current,effectiveLabel,baseLabel,reload]);
  const run=async(operation:()=>Promise<void>)=>{
    if(busyRef.current)return;
    busyRef.current=true;setBusy(true);setError('');
    try{await operation();}catch(reason){if(mounted.current)setError(reason instanceof Error?reason.message:'Unable to complete the request.');}
    finally{busyRef.current=false;if(mounted.current)setBusy(false);}
  };
  const save=()=>run(async()=>{
    if(!current)return;
    if(current.recognition && (!confirmed || !value('condition'))){
      setError('Confirm the category and choose the item condition before continuing.');return;
    }
    if(current.recognition?.status==='needs_review' && !answers.material_confirmation &&
       current.assessment?.material.status!=='user_selected'){
      setError('Confirm the suggested category, change the material, or choose Not sure before continuing.');
      return;
    }
    const id=current.id;
    const {condition,previous_contents,...context}=answers;
    const fields:Record<string,unknown>={answers:context};
    if(condition!==undefined)fields.condition=condition;
    if(previous_contents!==undefined)fields.previous_contents=previous_contents;
    const result=await updatePrediction(id,fields);
    if(!mounted.current || activeId.current!==id)return;
    setCurrent(result.prediction);onChange(result.prediction);setAnswers({});setCatalog(fromPrediction(result.prediction));setSaved(true);setSkipped(false);setView('advice');
    // The advice itself is the confirmation: no extra OK tap or unchanged form.
  });
  const completePreparation=()=>run(async()=>{
    if(!current)return;
    const plan=materialPreparation(current);
    if(!plan || plan.blocked)return;
    const id=current.id;
    const result=await updatePrediction(id,{condition:'Clean and dry',answers:{contamination:'None known',moisture:'Dry'}});
    if(!mounted.current || activeId.current!==id)return;
    setCurrent(result.prediction);onChange(result.prediction);setAnswers({});
    setCatalog(fromPrediction(result.prediction));setSaved(true);setSkipped(false);setView('advice');
  });
  const contribute=()=>{
    if(!current)return;
    Alert.alert(contribution?'Withdraw research contribution?':'Share this image for research review?',contribution?'This removes the review-queue entry. Your private scan stays in history.':'Optional: allow authorized reviewers to inspect this image and your saved item answers for possible future training. Do not share faces or private details. There is no automatic training. Delete the scan or withdraw here to remove this contribution.',[
      {text:'Cancel',style:'cancel'},
      {text:contribution?'Withdraw':'I agree',onPress:()=>run(async()=>{
        const result=await contributeIdentification(current.id,Boolean(contribution));
        if(!mounted.current || activeId.current!==current.id)return;
        setContribution(result.withdrawn?null:result.status || 'pending');showSuccess(result.withdrawn?'Your research contribution has been withdrawn.':'Submitted for human review. This does not verify the item or change the model.');
      })},
    ]);
  };
  const context=current?.assessment?.context || {};
  const value=(key:string)=>answers[key] ?? String(context[key] ?? '');
  const plastic=effectiveLabel==='pete_bottles' || effectiveLabel==='hdpe_containers';
  const supported=Object.prototype.hasOwnProperty.call(MATERIAL_NAMES,effectiveLabel);
  const useCombinedCondition=supported;
  const ids=catalog.quick_check?.sorting_question_ids;
  const questions=catalog.questions.filter(q=>q.id!=='material_confirmation' &&
    
    (q.id!=='reported_category' || more) && (more || !ids || ids.includes(q.id)));
  const presetsVisible=Boolean(current?.recognition && supported) || questions.some(q=>['condition','contamination','moisture'].includes(q.id)) ||
    (useCombinedCondition && Boolean(ids?.includes('previous_contents')));
  const otherQuestions=questions.filter(q=>!['condition','contamination','moisture'].includes(q.id));
  const conditionProfile=materialConditions(effectiveLabel);
  const conditionPresets=conditionProfile?.choices || CONDITION_PRESETS;
  const highConfidence=current?.assessment?.material.status==='model_high_confidence' && !chosen;
  const confirmed=Boolean(highConfidence || current?.assessment?.material.status==='user_selected' && !chosen || chosen && chosen!=='Not sure');
  const materialName=MATERIAL_NAMES[effectiveLabel];
  const suggestedLabel=current?.recognition?.status==='needs_review' ? current.recognition.suggested_label : null;
  const suggestedName=suggestedLabel ? MATERIAL_NAMES[suggestedLabel] : undefined;
  const readyForSorting=!current?.recognition || (confirmed && Boolean(value('condition')));
  return <ScrollView key={`${current?.id || 'manual'}-${view}`} contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <Button title="Back" onPress={onBack} secondary />
    <Text accessibilityRole="header" style={s.title}>{view==='advice'?'What to do next':'Check this item'}</Text>
    {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
    {!current?<>
      <Text style={s.body}>Choose a material you know. Manual selection does not count as an AI prediction.</Text>
      {Object.entries(MATERIAL_NAMES).map(([label,name])=><Button key={label} title={name} disabled={busy} onPress={()=>run(async()=>{const result=await createManualPrediction(label);if(mounted.current)onChange(result.prediction);})} />)}
    </>:view==='advice'?<>
      <AssessmentAdvice prediction={current} saved={saved} busy={busy} onDone={onBack} onRetry={onRetry} onEdit={()=>{setView('check');}} onPreparationComplete={completePreparation} onProceed={skipped?undefined:onProceed} />
      {current.image_url?<Pressable accessibilityRole="button" disabled={busy} onPress={contribute}><Text style={s.source}>{contribution?`Research review: ${contribution} · Withdraw contribution`:'Optional: contribute this image for human research review'}</Text></Pressable>:null}
    </>:<>
      <Text style={s.body}>Check the material, condition and known exposure. It is okay to choose Not sure.</Text>
      {current.image_url?<Image source={{uri:imageUrl(current.image_url)}} resizeMode="contain" style={s.itemImage} accessibilityLabel="Item being assessed"/>:null}
      <View style={s.card}>
        <Text style={s.heading}>{materialName || suggestedName || 'What is this material?'}</Text>
        <Text style={s.small}>{highConfidence?'High confidence camera match. Change the material if it looks wrong.':confirmed?'Your selected material, not AI verification.':'Suggested category — review needed. Confirm it or choose Not sure.'}</Text>
        {!confirmed && materialName && !plastic && !changeMaterial?<Button title={`Yes, this is ${materialName}`} disabled={busy} onPress={()=>setAnswers(old=>({...old,material_confirmation:effectiveLabel}))}/>:null}
        {!materialName && suggestedLabel && suggestedName && !changeMaterial?<Button title={`Yes, this is ${suggestedName}`} disabled={busy} onPress={()=>{setAnswers({material_confirmation:suggestedLabel});setMore(false);}}/>:null}
        <Button title={changeMaterial?'Keep this selection':'Change material / not sure'} secondary disabled={busy} onPress={()=>setChangeMaterial(old=>!old)}/>
        {changeMaterial || (!materialName && !suggestedName)?<View>{[...Object.keys(MATERIAL_NAMES),'Not sure'].map(option=><Pressable key={option} accessibilityRole="radio" accessibilityLabel={MATERIAL_NAMES[option] || option} accessibilityState={{checked:chosen===option}} disabled={busy} onPress={()=>{
          setAnswers({material_confirmation:option});setChangeMaterial(false);setMore(false);
        }} style={[s.choice,chosen===option && s.selected]}><Text style={s.body}>{MATERIAL_NAMES[option] || option}</Text></Pressable>)}</View>:null}
      </View>
      {loading?<Text accessibilityLiveRegion="polite" style={s.small}>Loading the checks for this material…</Text>:loadError?<><Text accessibilityRole="alert" style={s.error}>{loadError}</Text><Button title="Retry material checks" secondary onPress={()=>setReload(old=>old+1)}/></>:<>
        {presetsVisible?<View style={s.card}><Text style={s.heading}>{conditionProfile?.title || 'What condition is it in?'}</Text><Text style={s.small}>{useCombinedCondition?'Choose the best match. Report known chemical contact even if the item looks clean.':'One choice covers visible residue and wet/dry condition.'}</Text>{conditionPresets.map(preset=><Pressable key={preset.label} accessibilityRole="radio" accessibilityLabel={preset.label} accessibilityState={{checked:Object.entries(preset.values).every(([key,answer])=>value(key)===answer)}} disabled={busy} onPress={()=>setAnswers(old=>({...old,...preset.values}))} style={[s.choice,Object.entries(preset.values).every(([key,answer])=>value(key)===answer) && s.selected]}><Text style={s.body}>{preset.label}</Text></Pressable>)}</View>:null}
        {otherQuestions.map(question=><View key={question.id} style={s.card}><Text style={s.heading}>{question.label}{question.required?'':' (optional)'}</Text>{question.options.map(option=><Pressable key={option} accessibilityRole="radio" accessibilityLabel={`${question.id}: ${option}`} accessibilityState={{checked:value(question.id)===option}} disabled={busy} onPress={()=>setAnswers(old=>({...old,[question.id]:option}))} style={[s.choice,value(question.id)===option && s.selected]}><Text style={s.body}>{question.id==='reported_category'?CATEGORY_NAMES[option] || option:MATERIAL_NAMES[option] || option}</Text></Pressable>)}</View>)}

        {confirmed && !catalog.quick_check?.has_sorting_rule && catalog.quick_check?<Text style={s.small}>There is no checked local rule for this material yet. You can view the next action without filling in extra details.</Text>:null}
      </>}
      {readyForSorting?<Button title={busy?'Checking…':'Confirm'} disabled={busy || loading || Boolean(loadError)} onPress={save}/>:null}
      <Button title="Skip check for now" secondary disabled={busy} onPress={()=>{setSkipped(true);setView('advice');}}/>
      {current.input_method==='manual' && onManualReset?<Button title="Choose another material" secondary disabled={busy} onPress={onManualReset}/>:null}
    </>}
    {successDialog}
  </ScrollView>;
}
const s=StyleSheet.create({
  back:{alignSelf:'flex-start',minHeight:48,flexDirection:'row',alignItems:'center',gap:4,paddingRight:16,marginBottom:8},backText:{fontSize:16,fontWeight:'600',color:'#176b45'},
  page:{padding:20,paddingBottom:50,backgroundColor:'#f7f9f5',flexGrow:1},title:{fontSize:26,color:'#143f30',fontWeight:'800'},
  itemImage:{width:'100%',height:140,backgroundColor:'#edf3ef',borderRadius:12,marginTop:12},
  heading:{color:'#143f30',fontSize:17,fontWeight:'700',marginVertical:6},body:{color:'#35483e',fontSize:14,lineHeight:21},small:{color:'#57645d',fontSize:12,lineHeight:18,marginTop:6},
  card:{padding:16,borderWidth:1,borderColor:'#dce9df',borderRadius:16,backgroundColor:'#fff',marginTop:16},
  button:{padding:15,backgroundColor:'#176b45',borderRadius:12,marginTop:12},buttonText:{color:'#fff',fontWeight:'700',textAlign:'center'},secondary:{minHeight:48,justifyContent:'center',borderWidth:2,borderColor:'#176b45',borderRadius:12,paddingHorizontal:16,paddingVertical:12,marginTop:12,backgroundColor:'#fff'},link:{color:'#176b45',fontWeight:'700',textAlign:'center'},
  choice:{borderWidth:1,borderColor:'#dce9df',padding:13,borderRadius:10,marginTop:8},selected:{backgroundColor:'#e8f5ec',borderColor:'#176b45'},
  input:{borderWidth:1,borderColor:'#a5b9ac',color:'#143f30',padding:12,borderRadius:10,marginTop:8},error:{color:'#a12020',paddingVertical:10},source:{color:'#57645d',fontSize:12,marginTop:18,lineHeight:18},disabled:{opacity:.6},
});
