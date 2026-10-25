import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { contributeIdentification, createManualPrediction, getAssessmentQuestions, imageUrl, selectRecommendation, updatePrediction, type Assessment, type AssessmentQuestion, type Prediction } from './api';
import { useSuccessAlert } from './SuccessAlertDialog';
import AssessmentAdvice from './AssessmentAdvice';

export const MATERIAL_NAMES: Record<string,string> = {
  pete_bottles:'PETE bottles', hdpe_containers:'HDPE containers', cardboard:'Cardboard', paper:'Paper',
  fabric_scraps:'Fabric scraps', dry_untreated_wood_scraps:'Dry untreated wood scraps',
  coconut_shells:'Coconut shells',
};
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
  if(value?.image_quality?.automatic_routing && value.assessment?.material.status!=='user_selected')return false;
  return Boolean(value && (value.assessment?.quick_check?.user_reviewed || value.assessment?.segregation?.status==='available' || value.waste_identifier?.category==='C' || value.recommendation_choices?.length || value.condition || value.previous_contents || value.answers?.other_material || value.answers?.contamination));
}
function Button({title,onPress,disabled=false,secondary=false}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={[secondary ? s.secondary : s.button,disabled && s.disabled]}><Text style={secondary ? s.link : s.buttonText}>{title}</Text></Pressable>;
}

export default function AssessmentScreen({prediction,onChange,onBack,onSaved,onRetry,onManualReset}:{
  prediction:Prediction|null;onChange:(value:Prediction)=>void;onBack:()=>void;onSaved:()=>void;onRetry:()=>void;onManualReset?:()=>void;
}) {
  const {showSuccess,successDialog}=useSuccessAlert();
  const [current,setCurrent]=useState(prediction);
  const [view,setView]=useState<'check'|'advice'>(()=>canShowAdvice(prediction)?'advice':'check');
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [quantity,setQuantity]=useState(prediction?.quantity ? String(prediction.quantity) : '');
  const [catalog,setCatalog]=useState<Catalog>(()=>fromPrediction(prediction));
  const [loading,setLoading]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [reload,setReload]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState(false);
  const [reuse,setReuse]=useState(false);
  const [changeMaterial,setChangeMaterial]=useState(false);
  const [more,setMore]=useState(false);
  const [contribution,setContribution]=useState<string|null>(prediction?.review_contribution || null);
  const mounted=useRef(true), busyRef=useRef(false);
  const activeId=useRef(prediction?.id); activeId.current=prediction?.id;
  useEffect(()=>{ mounted.current=true; return ()=>{mounted.current=false;}; },[]);
  useEffect(()=>{ setCurrent(prediction); },[prediction]);
  useEffect(()=>{
    setAnswers({});setQuantity(prediction?.quantity ? String(prediction.quantity):'');setCatalog(fromPrediction(prediction));
    setView(canShowAdvice(prediction)?'advice':'check');setSaved(false);setReuse(false);setMore(false);setChangeMaterial(false);setError('');
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
    const id=current.id;
    const {condition,previous_contents,...context}=answers;
    const fields:Record<string,unknown>={answers:context};
    if(reuse && quantity.trim())fields.quantity=quantity.trim();
    if(condition!==undefined)fields.condition=condition;
    if(previous_contents!==undefined)fields.previous_contents=previous_contents;
    const result=await updatePrediction(id,fields);
    if(!mounted.current || activeId.current!==id)return;
    setCurrent(result.prediction);onChange(result.prediction);setAnswers({});setCatalog(fromPrediction(result.prediction));setSaved(true);setView('advice');
    // The advice itself is the confirmation: no extra OK tap or unchanged form.
  });
  const saveProject=(id:string,title:string)=>run(async()=>{
    if(!current)return;
    const result=await selectRecommendation(current.id,id);
    if(!mounted.current || activeId.current!==current.id)return;
    setCurrent(result.prediction);onChange(result.prediction);showSuccess(`“${title}” has been saved to your ideas.`,onSaved);
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
  const ids=reuse ? catalog.quick_check?.project_question_ids : catalog.quick_check?.sorting_question_ids;
  const questions=catalog.questions.filter(q=>q.id!=='material_confirmation' && (q.id!=='reported_category' || more) && (more || !ids || ids.includes(q.id)));
  const presetsVisible=questions.some(q=>['condition','contamination','moisture'].includes(q.id));
  const otherQuestions=questions.filter(q=>more || !['condition','contamination','moisture'].includes(q.id));
  const confirmed=Boolean(current?.assessment?.material.status==='user_selected' && !chosen || chosen && chosen!=='Not sure');
  const materialName=MATERIAL_NAMES[effectiveLabel];
  const plastic=effectiveLabel==='pete_bottles' || effectiveLabel==='hdpe_containers';
  const projectOnly=reuse && catalog.quick_check?.has_reviewed_projects;
  const quantityValid=/^[1-9]\d{0,5}$/.test(quantity.trim());
  return <ScrollView key={`${current?.id || 'manual'}-${view}`} contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <Button title="Back" onPress={onBack} secondary />
    <Text accessibilityRole="header" style={s.title}>{view==='advice'?'What to do next':reuse?'Optional reuse check':'Check this item'}</Text>
    {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
    {!current?<>
      <Text style={s.body}>Choose a material you know. Manual selection does not count as an AI prediction.</Text>
      {Object.entries(MATERIAL_NAMES).map(([label,name])=><Button key={label} title={name} disabled={busy} onPress={()=>run(async()=>{const result=await createManualPrediction(label);if(mounted.current)onChange(result.prediction);})} />)}
    </>:view==='advice'?<>
      <AssessmentAdvice prediction={current} saved={saved} busy={busy} onDone={onBack} onRetry={onRetry} onEdit={()=>{setView('check');setReuse(false);}} onReuse={()=>{setReuse(true);setView('check');}} onSaveProject={saveProject} />
      {current.image_url?<Pressable accessibilityRole="button" disabled={busy} onPress={contribute}><Text style={s.source}>{contribution?`Research review: ${contribution} · Withdraw contribution`:'Optional: contribute this image for human research review'}</Text></Pressable>:null}
    </>:<>
      <Text style={s.body}>{reuse?'Only the extra details needed for a reviewed project are shown. You can skip this and keep your sorting advice.':'Check what matters for sorting. It is okay to choose Not sure; we will show a safe next action.'}</Text>
      {current.image_url?<Image source={{uri:imageUrl(current.image_url)}} resizeMode="contain" style={s.itemImage} accessibilityLabel="Item being assessed"/>:null}
      <View style={s.card}>
        <Text style={s.heading}>{materialName || 'What is this material?'}</Text>
        <Text style={s.small}>{confirmed?'Your selected material, not AI verification.':'A camera suggestion can be wrong.'}</Text>
        {!confirmed && materialName && !plastic && !changeMaterial?<Button title={`Yes, this is ${materialName}`} disabled={busy} onPress={()=>setAnswers(old=>({...old,material_confirmation:effectiveLabel}))}/>:null}
        <Button title={changeMaterial?'Keep this selection':'Change material / not sure'} secondary disabled={busy} onPress={()=>setChangeMaterial(old=>!old)}/>
        {changeMaterial || !materialName?<View>{[...Object.keys(MATERIAL_NAMES),'Not sure'].map(option=><Pressable key={option} accessibilityRole="radio" accessibilityLabel={MATERIAL_NAMES[option] || option} accessibilityState={{checked:chosen===option}} disabled={busy} onPress={()=>{
          setAnswers({material_confirmation:option});setQuantity('');setChangeMaterial(false);setMore(false);
        }} style={[s.choice,chosen===option && s.selected]}><Text style={s.body}>{MATERIAL_NAMES[option] || option}</Text></Pressable>)}</View>:null}
      </View>
      {loading?<Text accessibilityLiveRegion="polite" style={s.small}>Loading the checks for this material…</Text>:loadError?<><Text accessibilityRole="alert" style={s.error}>{loadError}</Text><Button title="Retry material checks" secondary onPress={()=>setReload(old=>old+1)}/></>:<>
        {presetsVisible?<View style={s.card}><Text style={s.heading}>What condition is it in?</Text><Text style={s.small}>One choice covers visible residue and wet/dry condition. Nothing is selected for you.</Text>{CONDITION_PRESETS.map(preset=><Pressable key={preset.label} accessibilityRole="radio" accessibilityLabel={preset.label} accessibilityState={{checked:Object.entries(preset.values).every(([key,answer])=>value(key)===answer)}} disabled={busy} onPress={()=>setAnswers(old=>({...old,...preset.values}))} style={[s.choice,Object.entries(preset.values).every(([key,answer])=>value(key)===answer) && s.selected]}><Text style={s.body}>{preset.label}</Text></Pressable>)}</View>:null}
        {otherQuestions.map(question=><View key={question.id} style={s.card}><Text style={s.heading}>{question.label}{question.required?'':' (optional)'}</Text>{question.options.map(option=><Pressable key={option} accessibilityRole="radio" accessibilityLabel={`${question.id}: ${option}`} accessibilityState={{checked:value(question.id)===option}} disabled={busy} onPress={()=>setAnswers(old=>({...old,[question.id]:option}))} style={[s.choice,value(question.id)===option && s.selected]}><Text style={s.body}>{question.id==='reported_category'?CATEGORY_NAMES[option] || option:MATERIAL_NAMES[option] || option}</Text></Pressable>)}</View>)}
        {projectOnly?<><Text style={s.heading}>How many items will you use?</Text><TextInput accessibilityLabel="Item quantity" keyboardType="number-pad" value={quantity} onChangeText={setQuantity} placeholder="Enter the actual quantity" style={s.input}/><Text style={s.small}>Enter a whole number of 1 or more for this optional project check.</Text></>:null}
        {!catalog.quick_check?.has_sorting_rule && catalog.quick_check?<Text style={s.small}>There is no checked local rule for this material yet. You can view the next action without filling in extra details.</Text>:null}
      </>}
      <Button title={busy?'Checking…':reuse?'Show suitable ideas':'Show sorting advice'} disabled={busy || loading || Boolean(loadError) || Boolean(projectOnly && !quantityValid)} onPress={save}/>
      <Button title={more?'Hide extra details':'More details (optional)'} secondary disabled={busy} onPress={()=>setMore(old=>!old)}/>
      <Button title="Skip check for now" secondary disabled={busy} onPress={()=>setView('advice')}/>
      {current.input_method==='manual' && onManualReset?<Button title="Choose another material" secondary disabled={busy} onPress={onManualReset}/>:null}
    </>}
    {successDialog}
  </ScrollView>;
}
const s=StyleSheet.create({
  page:{padding:20,paddingBottom:50,backgroundColor:'#f7f9f5',flexGrow:1},title:{fontSize:26,color:'#143f30',fontWeight:'800'},
  itemImage:{width:'100%',height:140,backgroundColor:'#edf3ef',borderRadius:12,marginTop:12},
  heading:{color:'#143f30',fontSize:17,fontWeight:'700',marginVertical:6},body:{color:'#35483e',fontSize:14,lineHeight:21},small:{color:'#57645d',fontSize:12,lineHeight:18,marginTop:6},
  card:{padding:16,borderWidth:1,borderColor:'#dce9df',borderRadius:16,backgroundColor:'#fff',marginTop:16},
  button:{padding:15,backgroundColor:'#176b45',borderRadius:12,marginTop:12},buttonText:{color:'#fff',fontWeight:'700',textAlign:'center'},secondary:{paddingVertical:12},link:{color:'#176b45',fontWeight:'700'},
  choice:{borderWidth:1,borderColor:'#dce9df',padding:13,borderRadius:10,marginTop:8},selected:{backgroundColor:'#e8f5ec',borderColor:'#176b45'},
  input:{borderWidth:1,borderColor:'#a5b9ac',color:'#143f30',padding:12,borderRadius:10,marginTop:8},error:{color:'#a12020',paddingVertical:10},source:{color:'#57645d',fontSize:12,marginTop:18,lineHeight:18},disabled:{opacity:.6},
});
