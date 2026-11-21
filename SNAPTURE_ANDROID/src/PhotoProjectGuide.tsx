import React,{useEffect,useRef,useState} from 'react';
import {Alert,Modal,ScrollView,View} from 'react-native';
import Text from './PublicText';
import {launchCamera} from 'react-native-image-picker';
import Camera from 'lucide-react-native/icons/camera';
import LiveStepScanner from './LiveStepScanner';
import FinalProductPanel from './FinalProductPanel';
import TutorialPhoto,{PhotoCredits} from './TutorialPhoto';
import type {UserProject} from './api';
import {getPhotoProject,listInventory,upcyclingRequest,type Lot,type PhotoProject} from './upcyclingApi';
import {Action,Field,PrivatePhoto,Hero,Badge,u} from './UpcyclingUI';

export default function PhotoProjectGuide({initial,onDone,onBusyChange,onChange}:{initial:UserProject;onDone:()=>void;onBusyChange?:(v:boolean)=>void;onChange?:(p:UserProject)=>void}){
  const [project,setProject]=useState<PhotoProject>(initial),[index,setIndex]=useState(()=>Math.max(0,initial.steps.findIndex((_,i)=>!initial.completed_steps.includes(i))));
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[name,setName]=useState(initial.title),[description,setDescription]=useState(''),[feedback,setFeedback]=useState('');
  const [materials,setMaterials]=useState([{name:initial.material,quantity:'1'}]),[lots,setLots]=useState<Lot[]>([]),[usage,setUsage]=useState<Record<number,string>>({});
  const [showNotes,setShowNotes]=useState(false),[showStock,setShowStock]=useState(false);
  const [notice,setNotice]=useState(''),[scanning,setScanning]=useState(false);
  const locked=useRef(false),alive=useRef(true),scanBusy=useRef(false);
  const accept=(p:PhotoProject)=>{if(alive.current){setProject(p);setIndex(current=>{const next=p.steps.findIndex((_,i)=>!p.completed_steps.includes(i));return next>=0 && (current>next || p.completed_steps.includes(current))?next:Math.min(current,Math.max(0,p.steps.length-1));});onChange?.(p);}};
  const run=async(fn:()=>Promise<void>)=>{if(locked.current)return;locked.current=true;setBusy(true);onBusyChange?.(true);setError('');try{await fn();}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Unable to save.');}finally{locked.current=false;onBusyChange?.(false);if(alive.current)setBusy(false);}};
  useEffect(()=>{alive.current=true;run(async()=>{const [p,stock]=await Promise.all([getPhotoProject(initial.id),listInventory()]);accept(p.project);if(alive.current)setLots(stock.lots);});return()=>{alive.current=false;};},[initial.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const acceptStep=(updated:PhotoProject)=>{accept(updated);if(alive.current && updated.completed_steps.includes(index)){setNotice(index===project.steps.length-1?'All step photos saved. Give your creation a name below.':'Photo saved. You’re ready for the next step.');const next=updated.steps.findIndex((_,i)=>!updated.completed_steps.includes(i));setIndex(next<0?updated.steps.length-1:next);}};
  const capture=()=>run(async()=>{
    const photo=await launchCamera({mediaType:'photo',quality:.8,maxWidth:1600,maxHeight:1600,saveToPhotos:false});
    if(photo.didCancel)return;
    if(!photo.assets?.[0]?.uri)throw new Error(photo.errorMessage || 'Camera unavailable. Allow camera access and retry.');
    const response=await upcyclingRequest<{project:PhotoProject}>(`projects/${project.id}/steps/${index}/`,'POST',undefined,{uri:photo.assets[0].uri,...(project.verification_capabilities?.human_assisted?{fields:{step_confirmed:'true'}}:{})});acceptStep(response.project);
  });
  const assistedCapture=()=>Alert.alert('Confirm your step','Inspect the work against this instruction. The next step will be based on your confirmation and a saved photo, not AI verification.',[{text:'Cancel',style:'cancel'},{text:'I completed it - take photo',onPress:capture}]);
  const useManualConfirmation=()=>Alert.alert('Continue with photo confirmation','Check each step yourself and save a photo of your work. SNAPTURE will record your confirmation.',[
    {text:'Cancel',style:'cancel'},
    {text:'Continue',onPress:()=>run(async()=>{
      const response=await upcyclingRequest<{project:PhotoProject}>(`projects/${project.id}/manual-confirmation/`,'POST',{acknowledged:true});
      accept(response.project);
      setScanning(false);
      setNotice('');
    })},
  ]);
  const scanFrame=async(uri:string)=>{
    const response=await upcyclingRequest<{project:PhotoProject}>(`projects/${project.id}/steps/${index}/`,'POST',undefined,{uri});
    const latest=response.project.step_photos?.find(p=>p.step_index===index);
    const passed=response.project.completed_steps.includes(index);
    // Keep this step displayed until the user closes the verified scanner.
    if(alive.current){setProject(response.project);onChange?.(response.project);}
    return {verified:passed,message:latest?.assessment.feedback || latest?.assessment.message || 'Show the required detail more clearly.',unavailable:latest?.assessment.status==='unavailable'};
  };
  const finish=()=>Alert.alert('Save finished project?',project.verification_capabilities?.human_assisted?'Your whole-product photo and user-confirmed completion will be saved in My Projects. Confirm the materials and quantities actually used.':project.verification_capabilities?'The assessed whole-product photo and verdict will be saved in My Projects. Confirm the materials and quantities actually used.':'The final-step photo will be saved in My Projects. Confirm the materials and quantities actually used.',[{text:'Cancel',style:'cancel'},{text:'Save project',onPress:()=>run(async()=>{
    const response=await upcyclingRequest<{project:PhotoProject}>('completions/','POST',{project_id:project.id,name,description,feedback,materials:materials.map(m=>({name:m.name.trim(),quantity:Number(m.quantity)})),usage:Object.entries(usage).filter(([,qty])=>qty.trim()).map(([id,qty])=>({lot_id:Number(id),quantity:Number(qty)}))});accept(response.project);
  })}]);
  const allDone=project.steps.length>0 && project.steps.every((_,i)=>project.completed_steps.includes(i));
  if(!project.steps.length)return <Text style={u.error}>No project instructions are available.</Text>;
  const reference=project.reference?.photos;
  const stepPhotos=reference?.steps.filter(photo=>photo.step_index===index && !!photo.url) || [];
  return <ScrollView contentContainerStyle={u.page} keyboardShouldPersistTaps="handled">
    {scanning?<Modal visible animationType="slide" onRequestClose={()=>{if(!scanBusy.current)setScanning(false);}}><LiveStepScanner onCheckingChange={v=>{scanBusy.current=v;if(alive.current)setBusy(v);onBusyChange?.(v);}} instruction={`Step ${index+1}: ${project.steps[index]}`} referencePhotos={stepPhotos} available={!!project.verification_capabilities?.step_available} reason={project.verification_capabilities?.reason} onFrame={scanFrame} onClose={()=>{setScanning(false);const next=project.steps.findIndex((_,i)=>!project.completed_steps.includes(i));if(next>=0)setIndex(next);}}/></Modal>:null}
    {project.verification_capabilities?.human_assisted?<View style={u.card}><Text style={u.heading}>Human-assisted activity</Text><Text style={u.body}>Progress and final completion are based on your confirmations and saved evidence. No AI verification or safety certification is claimed.</Text></View>:null}
    {project.verification_capabilities?.manual_confirmation_available && !project.completion_record?
      <View style={u.card}><Text style={u.body}>Automatic {project.verification_capabilities.step_available?'finished-product':'step'} checking is unavailable.</Text><Action title="Continue with photo confirmation" variant="primary" disabled={busy} onPress={useManualConfirmation}/></View>:null}
    <Hero eyebrow={project.completion_record?'Made by you':'Your next small transformation'} title={project.title} subtitle={project.completion_record?'A new purpose, beautifully documented.':project.verification_capabilities?.human_assisted?'Follow each step, inspect your work and document your confirmation.':'Follow each step and verify the visible result.'}/>
    <View style={u.card}><View style={u.sectionHead}><Text style={u.fieldLabel}>Your progress</Text><Text style={u.heading}>{project.progress_percent}%</Text></View>
    <View accessibilityRole="progressbar" accessibilityValue={{min:0,max:project.total_steps,now:project.completed_count}} style={u.progressTrack}><View style={[u.progressFill,{width:`${project.progress_percent}%`}]}/></View>
    <Text style={u.small}>{project.completed_count} of {project.total_steps} {project.verification_capabilities?.human_assisted?'steps complete':'steps verified'}</Text>
    <Text accessibilityLiveRegion="polite" style={[u.small,{minHeight:40,marginTop:6}]}>{notice || (project.verification_capabilities?.human_assisted?'Inspect, confirm and photograph each step before proceeding.':'Scan the visible result of each step before proceeding.')}</Text>
    <View style={u.row}>{project.steps.map((_,i)=><View key={i} style={[u.stepCircle,(project.completed_steps.includes(i) || index===i) && u.stepCircleActive]}><Text style={[u.stepNumber,(project.completed_steps.includes(i) || index===i) && {color:'#fff'}]}>{project.completed_steps.includes(i)?'✓':i+1}</Text></View>)}</View>
    <Action title="About photo checks" variant="ghost" expanded={showNotes} disabled={busy} onPress={()=>setShowNotes(v=>!v)}/>
    {showNotes?<Text style={u.small}>{project.verification_capabilities?.human_assisted?'Progress counts your explicit confirmations with saved photos. These photos document your work; they have not passed AI verification.':'Progress counts verified steps. A photo marked “AI checked” has also passed automatic checking. Other photos are records of your work.'}</Text>:null}</View>
    {project.completion_record?<View style={u.card}><Text style={u.heading}>Saved in My Projects</Text><PrivatePhoto path={project.completion_record.image_url} label="Finished project"/><Text style={u.body}>{project.completion_record.name}</Text><Text style={u.small}>{project.completion_record.verification_status.replace(/_/g,' ')} · {new Date(project.completion_record.completed_at).toLocaleDateString()}</Text><Text style={u.body}>{project.completion_record.description}</Text></View>:<>
      <View style={u.card}><Badge text={index===project.steps.length-1?'The finishing touch':`Step ${index+1} of ${project.steps.length}`}/><Text style={[u.heading,{fontSize:21,lineHeight:30}]}>{project.steps[index]}</Text>
      <Text style={u.small}>{project.verification_capabilities?.human_assisted?'Finish the action safely, inspect the result against this instruction, then confirm and photograph it. A separate whole-product photo follows the last step.':project.verification_capabilities?'Finish the action safely, then scan its visible result. A separate whole-product submission follows the last step.':index===project.steps.length-1?'Show the result of this step.':'When you finish, take a clear photo of what you made in this step.'}</Text>
      {project.reference?.suitability_requirements?.checkpoint_criteria?.[index]?<Text style={u.body}>Show: {project.reference.suitability_requirements.checkpoint_criteria[index]}</Text>:null}
      {stepPhotos.length?<View style={u.section}>
        <Text accessibilityRole="header" style={u.fieldLabel}>Step reference</Text>
        {stepPhotos.map(photo=><TutorialPhoto key={photo.url} photo={photo} label={`Step ${index+1} reference photo`}/>)}
        <PhotoCredits photos={reference}/>
      </View>:<Text style={u.small}>Reference photo unavailable for this step.</Text>}
      {(project.step_photos || []).filter(p=>p.step_index===index).map(p=><View key={p.id}><PrivatePhoto path={p.image_url} label={`Step ${index+1} evidence`}/><Badge text={({submitted:p.assessment.verdict==='user_confirmed'?'User confirmed':'Photo saved',ai_matches:'AI checked',needs_correction:'A little more work',retake:'Try another photo',reviewer_accepted:'Reviewed'} as Record<string,string>)[p.status] || 'Photo saved'} positive={['ai_matches','reviewer_accepted'].includes(p.status)}/><Text style={u.small}>{p.assessment.feedback || (p.assessment.message?'Automatic checking is unavailable. This photo does not unlock the next step; recheck it when checking is available.':'Photo recorded.')}</Text></View>)}
      {!(project.step_photos || []).some(p=>p.step_index===index)?<View style={[u.empty,{borderWidth:1,borderStyle:'dashed',borderColor:'#a9c2a7'}]}><Camera size={30} color="#477052"/><Text style={u.body}>Your progress photo goes here</Text><Text style={u.small}>Keep this step's result clearly in view.</Text></View>:null}
      {!project.verification_capabilities?.human_assisted && !project.completed_steps.includes(index) && (project.step_photos || []).some(p=>p.step_index===index && ['submitted','retake'].includes(p.status) && p.assessment.status!=='available')?<Action title="Recheck step photo" variant="ghost" disabled={busy || project.steps.some((_,i)=>i<index && !project.completed_steps.includes(i))} onPress={()=>run(async()=>{const photo=(project.step_photos || []).find(p=>p.step_index===index && ['submitted','retake'].includes(p.status) && p.assessment.status!=='available');if(!photo)return;const response=await upcyclingRequest<{project:PhotoProject}>(`projects/${project.id}/steps/${index}/`,'POST',{recheck_photo_id:photo.id});acceptStep(response.project);})}/>:null}
      {project.verification_capabilities?.human_assisted && !project.completed_steps.includes(index) && (project.step_photos || []).some(p=>p.step_index===index && p.assessment.verdict==='awaiting_user_confirmation')?<Action title="Confirm saved step photo" variant="ghost" disabled={busy || project.steps.some((_,i)=>i<index && !project.completed_steps.includes(i))} onPress={()=>Alert.alert('Confirm the photographed step','Inspect your saved photo and work against this instruction. This records your confirmation, not AI verification.',[{text:'Cancel',style:'cancel'},{text:'I confirm this step',onPress:()=>run(async()=>{const photo=(project.step_photos || []).find(p=>p.step_index===index && p.assessment.verdict==='awaiting_user_confirmation');if(!photo)return;const response=await upcyclingRequest<{project:PhotoProject}>(`projects/${project.id}/steps/${index}/`,'POST',{confirm_photo_id:photo.id});acceptStep(response.project);})}])}/>:null}
      {!project.completed_steps.includes(index) && project.verification_capabilities?.step_available?<Action title="Scan current step" label="Scan this step" variant="primary" disabled={busy || project.steps.some((_,i)=>i<index && !project.completed_steps.includes(i))} onPress={()=>setScanning(true)}/>:null}
      {!project.completed_steps.includes(index) && project.verification_capabilities?.human_assisted?<Action title="Confirm and photograph this step" variant="primary" disabled={busy || project.steps.some((_,i)=>i<index && !project.completed_steps.includes(i))} onPress={assistedCapture}/>:null}
      {!project.completed_steps.includes(index) && !project.verification_capabilities?<Action title="Take step photo" label={busy?'Saving your photo…':'Take a progress photo'} variant="primary" disabled={busy || project.steps.some((_,i)=>i<index && !project.completed_steps.includes(i))} onPress={capture}/>:null}
      </View>
      <View style={u.buttonRow}><View style={u.buttonSlot}><Action title="Previous step" label="Previous" variant="ghost" disabled={busy || index===0} onPress={()=>setIndex(index-1)}/></View><View style={u.buttonSlot}><Action title="Next step" disabled={busy || !project.completed_steps.includes(index) || index>=project.steps.length-1} onPress={()=>setIndex(index+1)}/></View></View>
      {allDone && project.verification_capabilities?<FinalProductPanel project={project} busy={busy} onRequest={fn=>{run(fn);}} onChange={accept}/>:null}
      {allDone?<View style={u.card}>
        <Text style={u.heading}>You made it. Make it yours.</Text><Text style={u.small}>Give your creation a name and record what you used.</Text>
        <Field label="Project name" value={name} onChange={setName}/>
        {materials.map((m,i)=><View key={i}><Field label={`Material ${i+1}`} placeholder="For example, paper" value={m.name} onChange={v=>setMaterials(old=>old.map((row,j)=>i===j?{...row,name:v}:row))}/><Field label={`Quantity for material ${i+1}`} numeric value={m.quantity} onChange={v=>setMaterials(old=>old.map((row,j)=>i===j?{...row,quantity:v}:row))}/>{materials.length>1?<Action title={`Remove material ${i+1}`} variant="ghost" disabled={busy} onPress={()=>setMaterials(old=>old.filter((_,j)=>i!==j))}/>:null}</View>)}
        <Action title="Add another material" disabled={busy} onPress={()=>setMaterials(old=>[...old,{name:'',quantity:''}])}/>
        <Field label="Project description" placeholder="What will you use it for?" value={description} onChange={setDescription}/><Field label="Optional feedback" placeholder="How did it go?" value={feedback} onChange={setFeedback}/>
        {lots.some(l=>l.available>0)?<Action title="Use materials from my collection" variant="ghost" expanded={showStock} disabled={busy} onPress={()=>setShowStock(v=>!v)}/>:null}
        {showStock?<><Text style={u.small}>Enter what you used. Leave other items blank.</Text>{lots.filter(l=>l.available>0).map(l=><Field key={l.id} label={`${l.material.replace(/_/g,' ')} · ${l.available} available`} numeric value={usage[l.id] || ''} onChange={v=>setUsage(old=>({...old,[l.id]:v}))}/>)}</>:null}
        <Action title="Save finished project to My Projects" label="Save my creation" variant="primary" disabled={busy || (!!project.verification_capabilities && !(project.final_assessments?.[0]?.verdict==='meets_requirements' || (project.verification_capabilities.human_assisted && project.final_assessments?.[0]?.verdict==='user_confirmed'))) || !name.trim() || materials.some(m=>!m.name.trim() || !Number.isInteger(Number(m.quantity)) || Number(m.quantity)<1)} onPress={finish}/>
      </View>:null}
    </>}
    {error?<Text accessibilityRole="alert" style={u.error}>{error}</Text>:null}
    <Action title="Refresh project" variant="ghost" disabled={busy} onPress={()=>run(async()=>{accept((await getPhotoProject(project.id)).project);})}/>
    <Action title="Back to My Projects" variant="ghost" disabled={busy} onPress={onDone}/>
  </ScrollView>;
}
