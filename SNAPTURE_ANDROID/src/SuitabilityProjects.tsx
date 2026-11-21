import React,{useContext,useEffect,useRef,useState} from 'react';
import {Alert,Image,Modal,Pressable,ScrollView,StyleSheet,View} from 'react-native';
import Text from './PublicText';
import Camera from 'lucide-react-native/icons/camera';
import Target from 'lucide-react-native/icons/target';
import Layers from 'lucide-react-native/icons/layers';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import ProjectFlowPage from './ProjectFlowPage';
import Check from 'lucide-react-native/icons/check';
import {launchCamera} from 'react-native-image-picker';
import {imageUrl,updatePrediction,type Prediction} from './api';
import {ProjectFlowContext} from './ProjectFlowContext';
import {getSuggestions,getVisual,saveFacts,startSuitable,upcyclingRequest,type Suggestions,type SuggestedProject,type VisualAssessment} from './upcyclingApi';
import {Action,Field,PrivatePhoto,Chip,Badge,u} from './UpcyclingUI';
import TutorialPhoto,{PhotoCredits} from './TutorialPhoto';
import AssessmentControls from './AssessmentControls';
import type {ResultSnapshot} from './ScanResult';

const MATERIALS:Record<string,string>={pete_bottles:'PET/PETE bottles',hdpe_containers:'HDPE containers',paper:'Paper',cardboard:'Cardboard',fabric_scraps:'Fabric scraps',dry_untreated_wood_scraps:'Dry untreated wood scraps',coconut_shells:'Coconut shells'};
function sizeLimits(name:string,{minimum,maximum}:{minimum?:number;maximum?:number}){
  const unit=name==='capacity'?'mL':'mm';
  if(minimum!==undefined && maximum!==undefined)return `${minimum}–${maximum} ${unit}`;
  return minimum!==undefined?`at least ${minimum} ${unit}`:`up to ${maximum} ${unit}`;
}
function ProjectOption({title,label,selected,disabled,onPress,icon:Icon,toggle=false}:{title:string;label?:string;selected:boolean;disabled:boolean;onPress:()=>void;icon:typeof Camera;toggle?:boolean}){
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{selected,disabled,...(!toggle?{expanded:selected}:{})}} disabled={disabled} onPress={onPress} style={({pressed})=>[s.option,disabled && {opacity:.45},pressed && !disabled && {opacity:.75}]}>
    <View style={s.optionIcon}><Icon size={18} color="#176b45"/></View><Text style={s.optionText}>{label || title}</Text>
    {toggle?<View style={[s.check,selected && s.checkSelected]}>{selected?<Check size={13} color="#fff"/>:null}</View>:<ChevronRight size={18} color="#63756a"/>}
  </Pressable>;
}
export default function SuitabilityProjects({prediction,onChange,historical=false,saved,includeCollection=false,primaryView}:{prediction:Prediction;onChange?:(p:Prediction)=>void;historical?:boolean;saved?:ResultSnapshot;includeCollection?:boolean;primaryView?:string}){
  const openProject=useContext(ProjectFlowContext);
  const [current,setCurrent]=useState(prediction),[result,setResult]=useState<Suggestions|null>(null),[visual,setVisual]=useState<VisualAssessment|null>(null);
  const [goal,setGoal]=useState(''),[inventory,setInventory]=useState(includeCollection),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [selected,setSelected]=useState<SuggestedProject|null>(null),[values,setValues]=useState<Record<string,string>>({}),[showMaterial,setShowMaterial]=useState(false),[view,setView]=useState('side'),[editing,setEditing]=useState(false);
  const [draftGoal,setDraftGoal]=useState('');
  const [showDetails,setShowDetails]=useState(false),[showGoals,setShowGoals]=useState(false);
  const lock=useRef(false),alive=useRef(true);
  const load=async(p=current,g=goal,stock=inventory)=>{const [ideas,evidence]=await Promise.all([getSuggestions(p.id,g,stock),getVisual(p.id)]);if(alive.current){setResult(ideas);setVisual(evidence.assessment);if(evidence.prediction){setCurrent(evidence.prediction);onChange?.(evidence.prediction);}setSelected(old=>old?ideas.items.find(i=>i.id===old.id) || null:null);}return ideas;};
  const run=async(fn:()=>Promise<unknown>)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await fn();}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Request failed.');}finally{lock.current=false;if(alive.current)setBusy(false);}};
  useEffect(()=>{alive.current=true;setCurrent(prediction);if(historical){setResult(saved?.suggestions || null);setVisual(saved?.visual || null);}else run(()=>load(prediction));return()=>{alive.current=false;};},[prediction.id,historical,saved]); // eslint-disable-line react-hooks/exhaustive-deps
  const addView=(purpose='material_view')=>{
    const [title,description]=purpose==='reassessment'
      ? ['Reassess the prepared item','Show the whole prepared item or a representative view of the prepared batch. Report any remaining concerns.']
      : purpose==='closeup'
        ? ['Photograph the concern','Show the affected area clearly, with some of the item in view.']
        : ['Another material view','Show the same item from another angle. Keep the whole item visible.'];
    Alert.alert(title,description,[{text:'Cancel',style:'cancel'},{text:'Same item — take photo',onPress:()=>run(async()=>{
      const photo=await launchCamera({mediaType:'photo',quality:.8,maxWidth:1600,maxHeight:1600});
      if(photo.didCancel)return;
      if(!photo.assets?.[0]?.uri)throw new Error(photo.errorMessage || 'Camera unavailable.');
      await upcyclingRequest(`predictions/${current.id}/assessment/`,'POST',undefined,{uri:photo.assets[0].uri,fields:{view,purpose,...(purpose==='reassessment'?{full_item_confirmed:'true'}:{}),same_item_confirmed:'true',request_id:`view_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}});
      await load();
    })}]);
  };
  const save=()=>run(async()=>{
    const facts:Record<string,unknown>={},dimensions:Record<string,number>={};
    for(const [key,value] of Object.entries(values)){
      if(!value.trim())continue;
      if(key.startsWith('dimension:'))dimensions[key.slice(10)]=Number(value);
      else facts[key]=key==='quantity'?Number(value):value;
    }
    if(Object.keys(dimensions).length)facts.dimensions={...(result?.facts?.dimensions || {}),...dimensions};
    await saveFacts(current.id,facts);setValues({});setEditing(false);
    const updated=await load();
    if(!alive.current)return;
    const project=selected?updated.items.find(idea=>idea.id===selected.id):undefined;
    const status=project?.can_start?'The selected project now meets its listed checks.':project?.missing_information.includes('published project-specific suitability requirements')?"This project's suitability requirements are still under review. Your answers cannot unlock it yet.":project?.status==='more_materials'?`This project needs ${project.additional_quantity} more compatible item(s).`:project?.status==='not_suitable'?'This item does not meet the selected project requirements.':updated.outcome==='no_suitable_project'?'No current project is cleared for this item.':'Some project checks still need confirmation.';
    const messages=(updated.assessment_feedback || []).map(note=>`${note.title}: ${note.message}`);
    if(project?.status==='not_suitable')messages.push(...project.reasons);
    if(project?.missing_information.length)messages.push('Still needed: '+project.missing_information.map(field=>field.replace(/_/g,' ')).join(', ')+'.');
    Alert.alert('Item assessment updated',[...messages,status].join('\n\n'));

  });
  const correct=(label:string)=>run(async()=>{const response=await updatePrediction(current.id,{answers:{material_confirmation:label}});setCurrent(response.prediction);onChange?.(response.prediction);setShowMaterial(false);await load(response.prediction);});
  const choose=(key:string,value:string)=>setValues(old=>({...old,[key]:value}));
  const pick=(label:string,options:string[])=> <View style={s.choiceGroup}><Text style={s.detailLabel}>{({condition:'What condition is it in?',previous_contents:'Previous contents',resin_mark:'Recycling code',wood_treatment:'Wood history',object_type:'Item type',shape:'Shape'} as Record<string,string>)[label] || label.replace(/_/g,' ')}</Text><View style={u.row}>{options.map(option=><Chip key={option} style={s.detailChoice} title={option} selected={(values[label] ?? result?.facts?.[label])===option} disabled={busy} onPress={()=>choose(label,option)}/>)}</View></View>;
  const primaryPhotoView=primaryView || visual?.primary_view;
  const viewTitle=(name:string)=>`${name.charAt(0).toUpperCase()+name.slice(1)} view`;
  const warningsFor=(v:VisualAssessment['views'][number])=>v.warnings || (visual?.conflicts || []).filter(line=>line.toLowerCase().startsWith(`${v.view.toLowerCase()} view `));
  const pairedWarnings=new Set((visual?.views || []).flatMap(warningsFor));
  const generalWarnings=(visual?.conflicts || []).filter(line=>!pairedWarnings.has(line));
  const needed=(idea:SuggestedProject,field:string)=>editing || !!idea.missing_information?.some(m=>m.includes(field) || (field==='condition' && ['clean and dry usable material','project-specific damage acceptance'].includes(m)));
  const verdict=result?.verdict || visual?.verdict;
  const guided=!!visual?.scan_details?.inspection_report;
  const reuseScanSize=visual?.scan_details?.condition_policy==='inspection-first-v1';
  const hideProjects=!historical && !!visual?.scan_details && (guided
    ? verdict?.code!=='suitable' && verdict?.required_input!=='project_requirements'
    : !visual.workflow?.inspection_confirmed || verdict?.code==='for_disposal' || verdict?.code==='unsupported' || verdict?.code==='requires_preparation');
  const assessmentPanel=!historical && visual?.verdict?<AssessmentControls material={current.decision}
    assessment={{...visual,verdict:result?.verdict || visual.verdict}} busy={busy}
    onSave={async facts=>{await run(async()=>{await saveFacts(current.id,facts);await load();});}} onPhoto={purpose=>addView(purpose)}/>:null;

  if(!historical && reuseScanSize)return <View>
    {assessmentPanel}
    {error?<Text accessibilityRole="alert" style={u.error}>{error}</Text>:null}
    {!result && busy?<Text accessibilityLiveRegion="polite" style={u.small}>Checking project fit…</Text>:null}
    {!result && error?<Action title="Retry matching" onPress={()=>run(()=>load())}/>:null}
    {!hideProjects && result?.items.length?<Text style={s.title}>Matching upcycling ideas</Text>:null}
    {!hideProjects && result?.items.map(idea=>{
      const show=selected?.id===idea.id;
      const checks=[
        {key:'resin_mark',required:'resin',options:['PET/PETE code 1','HDPE code 2','Another code','Not sure']},
        {key:'wood_treatment',required:'wood',options:['Known untreated and free of paint, mold and hardware','Paint, treatment, nails, or mold','Not sure']},
        {key:'shape',required:'shape',options:idea.requirements?.shapes || []},
        {key:'object_type',required:'object_type',options:idea.requirements?.object_types || []},
      ].filter(check=>check.options.length && needed(idea,check.required));
      const pendingChecks=['tools','additional_materials','safety'].filter(key=>idea.missing_information?.includes(key.replaceAll('_',' ')+' confirmation'));
      return <View key={idea.id} style={u.card}>
        <Text style={s.ideaTitle}>{idea.title}</Text>
        <Text style={s.ideaSummary}>{idea.summary}</Text>
        <Action title={`View requirements: ${idea.title}`} label="Project details" expanded={show} disabled={busy}
          onPress={()=>{setSelected(show?null:idea);setValues({});setEditing(false);}}/>
        {show?<View style={s.projectDetails}>
          <TutorialPhoto photo={idea.photos?.finished} label={`${idea.title}: finished example`}/>
          {idea.photos?.finished?.url?<PhotoCredits photos={idea.photos}/>:null}
          {idea.materials?.length?<Text style={u.body}>Materials & tools: {idea.materials.join(', ')}</Text>:null}
          {idea.requires_project_review?<Text style={u.small}>Project setup pending. Its requirements still need to be published.</Text>:<>
            {checks.map(check=><View key={check.key}>{pick(check.key,check.options)}</View>)}
            {checks.length?<Action title="Save project checks" disabled={busy || !Object.keys(values).length} onPress={()=>run(async()=>{
              await saveFacts(current.id,values);setValues({});await load();
            })}/>:null}
            {pendingChecks.length?<>
              {pendingChecks.map(key=><Text key={key} style={u.body}>{idea.requirements[key]?.join('. ')}</Text>)}
              <Action title="Confirm tools, materials and safety" disabled={busy} onPress={()=>run(async()=>{
                await saveFacts(current.id,{project_checks:{[idea.id]:Object.fromEntries(pendingChecks.map(key=>[key,true]))}});await load();
              })}/>
            </>:null}
            {!idea.can_start && !checks.length && !pendingChecks.length?<Text style={u.small}>This project needs additional condition evidence before it can start.</Text>:null}
          </>}
        </View>:null}
        {idea.can_start?<Action title={`Start ${idea.title}`} label="Let's make it" variant="primary" disabled={busy || !openProject}
          onPress={()=>run(async()=>{const response=await startSuitable(current.id,idea.id,inventory);openProject?.(response.project);})}/>:null}
      </View>;
    })}
  </View>;

  return <View>
    {assessmentPanel}
    {hideProjects?(error?<Text accessibilityRole="alert" style={u.error}>{error}</Text>:null):<>
    <Text style={s.title}>Projects for this item</Text><Text style={s.subtitle}>{historical?'Project suggestions saved with this scan.':'Explore an idea and check what you need.'}</Text>
    {historical?<>
      {visual?.observations.map((o,i)=><Text key={i} style={u.small}>{o.field.replace(/_/g,' ')}: {o.value} · {o.certainty}</Text>)}
      {Object.entries(saved?.suggestions.facts || {}).filter(([k])=>['condition','quantity','dimensions','shape'].includes(k)).map(([key,value])=><Text key={key} style={u.body}>{key.replace(/_/g,' ')}: {typeof value==='object'?JSON.stringify(value):String(value)}</Text>)}
      {result?.items.map(idea=><View key={idea.id} style={u.card}><Badge text={`Saved · ${idea.status.replace(/_/g,' ')}`} positive={idea.can_start}/><Text style={s.ideaTitle}>{idea.title}</Text><Text style={s.ideaSummary}>{idea.summary}</Text>{idea.missing_information.map(m=><Text key={m} style={u.small}>Needed: {m}</Text>)}<Action title={`Saved project details: ${idea.title}`} label="View saved instructions" expanded={selected?.id===idea.id} onPress={()=>setSelected(selected?.id===idea.id?null:idea)}/>{selected?.id===idea.id?<>{idea.materials.map((m,i)=><Text key={i} style={u.body}>• {m}</Text>)}{idea.steps.map((step,i)=><Text key={i} style={u.body}>{i+1}. {step}</Text>)}</>:null}</View>)}
      {!result?.items.length?<Text style={u.small}>{result?.message || 'No project suggestions were saved with this older scan.'}</Text>:null}
    </>:<>
    <View style={s.status}><Text accessibilityLiveRegion="polite" style={s.statusText}>{busy?'Updating…':' '}</Text></View>
    {error?<Text accessibilityRole="alert" style={u.error}>{error}</Text>:null}
    {!result?<Action title="Load project suggestions" onPress={()=>run(()=>load())} disabled={busy}/>:null}
    {result?<>{!result.items.length && result.assessment_feedback?.length?<View style={s.requirementsNote}>{result.assessment_feedback.map(note=><View key={note.code}><Text style={s.detailLabel}>{note.title}</Text><Text style={s.detailCopy}>{note.message}</Text></View>)}</View>:null}{!result.items.length?<View style={u.empty}><Text style={u.heading}>Let's find another way</Text><Text style={u.body}>{result.message}</Text></View>:null}
      <View style={s.controls}>
      <View style={s.materialRow}><View style={s.materialCopy}><Text style={s.materialLabel}>Material used</Text><Text style={s.materialName}>{MATERIALS[current.decision] || 'Material needs confirmation'}</Text></View>{!visual?.scan_details?<Pressable accessibilityRole="button" accessibilityLabel="Correct material" accessibilityState={{disabled:busy,expanded:showMaterial}} disabled={busy} onPress={()=>setShowMaterial(v=>!v)} style={({pressed})=>[s.change,busy && {opacity:.45},pressed && {opacity:.7}]}><Text style={s.changeText}>Change</Text></Pressable>:null}</View>
      {showMaterial?<View style={u.row}>{Object.entries(MATERIALS).map(([label,name])=><Chip key={label} title={name} selected={current.decision===label} disabled={busy} onPress={()=>correct(label)}/>)}</View>:null}
      <ProjectOption title="Photos & item details" icon={Camera} selected={showDetails} disabled={busy} onPress={()=>setShowDetails(true)}/>
      <ProjectOption title="Choose a goal" label={goal?`Goal: ${goal}`:undefined} icon={Target} selected={showGoals} disabled={busy} onPress={()=>{setDraftGoal(goal);setShowGoals(true);}}/>
      <ProjectOption title="Include my collected materials" label="Include collection" icon={Layers} selected={inventory} disabled={busy} toggle onPress={()=>{setInventory(v=>!v);run(()=>load(current,goal,!inventory));}}/>
      </View>
      {showDetails?<Modal visible animationType="slide" onRequestClose={()=>{if(!busy)setShowDetails(false);}}><SafeAreaProvider><SafeAreaView style={u.safeArea}><ProjectFlowPage showClose={false} title="Photos & item details" backLabel="Back to project suggestions" disabled={busy} onBack={()=>setShowDetails(false)} onClose={()=>setShowDetails(false)} scroll>
      <Text style={u.heading}>{MATERIALS[current.decision] || current.title}</Text>
      <Text style={u.small}>Photos and observations for this scanned item.</Text>
      <Text style={u.body}>Material: {MATERIALS[current.decision] || 'Not confidently identified'}</Text>
      {(visual?.scan_details?visual.capability?.condition_assessment==='unavailable':visual?.primary.status==='unavailable')?<Text style={[u.small,{marginBottom:16}]}>Automatic condition checking is not available yet. Your photos are saved, but the condition of your item has not been verified by AI.</Text>:null}
      {error?<Text accessibilityRole="alert" style={u.error}>{error}</Text>:null}
      {!result.items.length?<View style={s.detailSection}><Text style={s.detailHeading}>Review your answers</Text><Text style={s.detailCopy}>Update only information you have confirmed. Changing an answer alone is not AI verification.</Text>
      <Field label="Usable quantity" numeric value={values.quantity ?? String(result.facts.quantity || '')} onChange={v=>choose('quantity',v)}/>
      {!guided?pick('condition',['Clean and dry','Needs cleaning','Damaged or cracked','Moldy or contaminated','Not sure']):null}
      {pick('previous_contents',['No chemical contact known','Water or beverage','Food or oil','Chemical or cleaning product','Other / unknown'])}
      {['pete_bottles','hdpe_containers'].includes(current.decision)?pick('resin_mark',['PET/PETE code 1','HDPE code 2','Another code','Not sure']):null}
      {current.decision==='dry_untreated_wood_scraps'?pick('wood_treatment',['Known untreated and free of paint, mold and hardware','Paint, treatment, nails, or mold','Not sure']):null}
      <Action title="Save relevant details" label="Update project fit" variant="secondary" disabled={busy} onPress={save}/></View>:null}
      {current.original_image_url || current.image_url?<View testID="primary-photo-group" style={{marginBottom:16}}><Text style={u.fieldLabel}>{primaryPhotoView?viewTitle(primaryPhotoView):'Primary photo (view not recorded)'}</Text><Image accessibilityLabel="Primary item photo" source={{uri:imageUrl(current.original_image_url || current.image_url || '')}} resizeMode="contain" style={u.photo}/></View>:null}
      {Object.entries(result.fact_sources || {}).filter(([key])=>['shape','dimensions'].includes(key)).map(([key,source])=><Text key={key} style={u.small}>{key.replace(/_/g,' ')}: {typeof result.facts[key]==='object'?JSON.stringify(result.facts[key]):String(result.facts[key])} · {source.replace(/_/g,' ')}</Text>)}
      {visual?.observations.map((o,i)=><Text key={i} style={u.body}>AI observation ({o.certainty}): {o.field.replace(/_/g,' ')} — {o.value}</Text>)}

      {visual?.views.map(v=><View key={v.id} testID={`view-photo-group-${v.id}`} style={{marginBottom:16}}><Text style={u.fieldLabel}>{viewTitle(v.view)} - same item confirmed by you</Text>{v.image_url?<PrivatePhoto path={v.image_url} label={`${v.view} view`}/>:<Text style={u.small}>Photo unavailable</Text>}{warningsFor(v).map(line=><Text key={line} accessibilityRole="alert" style={u.error}>{line}</Text>)}</View>)}
      {generalWarnings.length?<View><Text style={u.fieldLabel}>Across-view observations</Text>{generalWarnings.map(line=><Text key={line} style={u.error}>{line}</Text>)}</View>:null}
      <Text style={u.fieldLabel}>Need a clearer angle?</Text><View style={u.row}>{['front','back','side','top','bottom'].map(v=><Chip key={v} title={v} selected={view===v} disabled={busy} onPress={()=>setView(v)}/>)}</View>
      <Action title="Add another view" disabled={busy} onPress={()=>addView()}/>
      </ProjectFlowPage></SafeAreaView></SafeAreaProvider></Modal>:null}
      {showGoals?<Modal visible transparent animationType="slide" onRequestClose={()=>{if(!busy)setShowGoals(false);}}><View style={s.goalScrim}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss goal picker" disabled={busy} onPress={()=>setShowGoals(false)} style={s.goalBackdrop}/>
        <View style={s.goalSheet}><SafeAreaProvider><SafeAreaView edges={['bottom','left','right']} style={s.goalSurface}>
          <View style={s.goalHandle}/><View style={s.goalHeader}><Text accessibilityRole="header" style={s.title}>Choose a goal</Text><Pressable accessibilityRole="button" accessibilityLabel="Cancel goal selection" disabled={busy} onPress={()=>setShowGoals(false)} style={s.change}><Text style={s.changeText}>Cancel</Text></Pressable></View>
          <Text style={s.subtitle}>What would you like to make with this item?</Text>
          <ScrollView style={s.goalOptions} keyboardShouldPersistTaps="handled">{['','Organize household items','Grow plants','Decorate my home','Create useful accessories'].map(g=><Pressable key={g} accessibilityRole="radio" accessibilityLabel={g || 'All goals'} accessibilityState={{checked:draftGoal===g,disabled:busy}} disabled={busy} onPress={()=>setDraftGoal(g)} style={s.option}><Text style={s.optionText}>{g || 'All goals'}</Text><View style={[s.check,draftGoal===g && s.checkSelected]}>{draftGoal===g?<Check size={13} color="#fff"/>:null}</View></Pressable>)}</ScrollView>
          {error?<Text accessibilityRole="alert" style={u.error}>{error}</Text>:null}
          <Action title="Apply goal" variant="primary" disabled={busy} onPress={()=>run(async()=>{await load(current,draftGoal);if(alive.current){setGoal(draftGoal);setShowGoals(false);}})}/>
        </SafeAreaView></SafeAreaProvider></View>
      </View></Modal>:null}
      {result.items.length?<Text style={s.listHeading}>{result.items.length} ideas to explore</Text>:null}
      {result.items.map(idea=><View key={idea.id} style={[u.card,s.ideaCard]}>
        {idea.photos?.finished?.url?<><TutorialPhoto photo={idea.photos.finished} label={`${idea.title}: project inspiration`}/><PhotoCredits photos={idea.photos}/></>:null}
        <Badge text={({suitable:'Ready to make',needs_information:'A few details to check',more_materials:'Collect a little more',not_suitable:'Not a match for this item'} as Record<string,string>)[idea.status] || 'Project idea'} positive={idea.can_start}/>
        <Text style={s.ideaTitle}>{idea.title}</Text><Text style={s.ideaSummary}>{idea.summary}</Text>
        {idea.requirements?.minimum_quantity?<Text style={u.body}>Minimum {idea.requirements.minimum_quantity} usable {idea.requirements.minimum_quantity===1?'piece':'pieces'} per build</Text>:null}
        {Object.entries(idea.requirements?.dimensions || {}).map(([name,limits])=><Text key={name} style={u.small}>
          {`Per piece · ${name} ${sizeLimits(name,limits as {minimum?:number;maximum?:number})}`}
        </Text>)}
        {idea.requirements?.shapes?.map((shape:string)=><Text key={shape} style={u.small}>{shape}</Text>)}
        {idea.additional_quantity ? <Text style={u.body}>Collect {idea.additional_quantity} more compatible item(s).</Text>:null}
        <Action title={`View requirements: ${idea.title}`} label="Project details" variant="secondary" expanded={selected?.id===idea.id} disabled={busy} onPress={()=>{setSelected(selected?.id===idea.id?null:idea);setValues({});setEditing(false);}}/>
        {selected?.id===idea.id?<View style={s.projectDetails}>
          <Text accessibilityRole="header" style={s.detailHeading}>Project fit</Text>
          {result.assessment_feedback?.map(note=><View key={note.code} style={{marginBottom:8}}><Text style={s.detailLabel}>{note.title}</Text><Text style={s.detailCopy}>{note.message}</Text></View>)}
          {idea.reasons.map(line=><Text key={line} style={s.detailCopy}>{line}</Text>)}
          {idea.missing_information.length?<View style={s.requirementsNote}><Text style={s.detailLabel}>Still needed</Text>{idea.missing_information.map(m=><Text key={m} style={s.detailCopy}>{m==='published project-specific suitability requirements'?'This project’s fit requirements are still under review.':`To check: ${m.replace(/_/g,' ')}`}</Text>)}</View>:null}
          {idea.materials?.length?<View style={s.detailSection}><Text accessibilityRole="header" style={s.detailHeading}>Materials needed</Text>{idea.materials.map((m,i)=><View key={i} style={s.materialItem}><View style={s.materialDot}/><Text style={s.materialItemText}>{m}</Text></View>)}</View>:null}
          <View style={s.detailSection}><View style={s.detailSectionHead}><Text accessibilityRole="header" style={s.detailHeading}>Your item</Text><Pressable accessibilityRole="button" accessibilityLabel="Edit confirmed item details" accessibilityState={{expanded:editing,disabled:busy}} disabled={busy} onPress={()=>setEditing(v=>!v)} style={s.editDetails}><Text style={s.changeText}>{editing?'Done editing':'Edit details'}</Text></Pressable></View><Text style={s.detailCopy}>Check the usable quantity and any details this project still needs.</Text>
          {Object.keys(idea.requirements.dimensions || {}).map(key=><Field key={key} label={`${key} in ${key==='capacity'?'mL':'mm'}`} numeric
            value={values[`dimension:${key}`] ?? String(result.facts.dimensions?.[key] ?? '')} onChange={v=>choose(`dimension:${key}`,v)}/>)}
          {guided?<Text style={u.body}>Confirmed usable quantity: {result.facts.quantity ?? 'Unknown'}</Text>:<Field label="Usable quantity" numeric value={values.quantity ?? String(result.facts.quantity || '')} onChange={v=>choose('quantity',v)}/>}
          {!guided && needed(idea,'condition')?pick('condition',['Clean and dry','Needs cleaning','Damaged or cracked','Moldy or contaminated','Not sure',...(idea.requirements.conditions || [])].filter((v,i,a)=>a.indexOf(v)===i)):null}
          {needed(idea,'previous contents')?pick('previous_contents',['No chemical contact known','Water or beverage','Food or oil','Chemical or cleaning product','Other / unknown']):null}
          {['pete_bottles','hdpe_containers'].includes(current.decision) && needed(idea,'resin')?pick('resin_mark',['PET/PETE code 1','HDPE code 2','Another code','Not sure']):null}
          {current.decision==='dry_untreated_wood_scraps' && needed(idea,'wood')?pick('wood_treatment',['Known untreated and free of paint, mold and hardware','Paint, treatment, nails, or mold','Not sure']):null}
          {idea.requirements.object_types?.length && needed(idea,'object_type')?pick('object_type',idea.requirements.object_types):null}
          {idea.requirements.shapes?.length && needed(idea,'shape')?pick('shape',idea.requirements.shapes):null}
          {Object.entries(idea.requirements.visible_characteristics || {}).filter(([field])=>needed(idea,field)).map(([field,options])=><View key={field}>{pick(field,[...(options as string[]),'Not sure'])}</View>)}
          <Action title="Save relevant details" label="Update project fit" variant="secondary" disabled={busy} onPress={save}/>
          </View>
          {['tools','additional_materials','safety'].filter(k=>idea.requirements[k]?.length).map(key=><View key={key} style={s.detailSection}><Text accessibilityRole="header" style={s.detailHeading}>{({tools:'Tools',additional_materials:'Additional materials',safety:'Safety checks'} as Record<string,string>)[key]}</Text><Text style={s.detailCopy}>{idea.requirements[key].join('; ')}</Text><Action title={`Confirm ${key.replace(/_/g,' ')} for ${idea.title}`} disabled={busy} onPress={()=>run(async()=>{await saveFacts(current.id,{project_checks:{[idea.id]:{[key]:true}}});await load();})}/></View>)}
          {editing && idea.requirements_source?<Text style={u.small}>Source: {idea.requirements_source}</Text>:null}
          <View style={s.detailSection}><Text style={s.detailCopy}>{idea.can_start?'Your item meets the listed project checks.':'Starting unlocks when all required project checks are met.'}</Text>
          {!idea.can_start?<View accessibilityLiveRegion="polite"><Text style={u.fieldLabel}>Why starting is locked</Text><Text style={u.body}>{result.verdict?.reason || 'Required project checks are incomplete.'}</Text>{result.verdict?.next_action?<Text style={u.small}>{result.verdict.next_action}</Text>:null}{idea.missing_information.map(item=><Text key={item} style={u.small}>Still needed: {item.replace(/_/g,' ')}</Text>)}</View>:null}
          <Action title={`Start ${idea.title}`} label="Let's make it" variant="primary" disabled={busy || !idea.can_start || !openProject} onPress={()=>run(async()=>{const response=await startSuitable(current.id,idea.id,inventory);openProject?.(response.project);})}/>

          </View>
        </View>:null}
      </View>)}
      <Action title="Add this item to my collection" disabled={busy} onPress={()=>run(async()=>{const qty=Number(values.quantity || result.facts.quantity);if(!Number.isInteger(qty) || qty<1)throw new Error('Enter and save the usable quantity first.');await upcyclingRequest('inventory/','POST',{prediction_id:current.id,quantity:qty});Alert.alert('Collection updated','This scan was added once. Manage quantities in My collection.');})}/>
    </>:null}
    </>}
    </>}
  </View>;
}

const s=StyleSheet.create({
  projectDetails:{borderTopWidth:1,borderTopColor:'#e4ece4',marginTop:10,paddingTop:16},detailHeading:{fontSize:16,lineHeight:23,fontWeight:'700',color:'#143f30',marginBottom:8},detailCopy:{fontSize:13,lineHeight:21,color:'#63756a',marginBottom:8},detailLabel:{fontSize:13,lineHeight:20,fontWeight:'600',color:'#42584b',marginBottom:8},
  detailSection:{borderTopWidth:1,borderTopColor:'#e4ece4',marginTop:16,paddingTop:16},detailSectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},editDetails:{minHeight:44,paddingLeft:8,justifyContent:'center'},requirementsNote:{backgroundColor:'#faf5e9',borderRadius:12,padding:12,marginTop:8},materialItem:{flexDirection:'row',gap:10,alignItems:'flex-start',marginBottom:8},materialDot:{width:5,height:5,borderRadius:3,backgroundColor:'#477052',marginTop:8},materialItemText:{flex:1,minWidth:0,fontSize:14,lineHeight:22,color:'#42584b'},choiceGroup:{marginTop:14,marginBottom:8},detailChoice:{minHeight:40,paddingHorizontal:10,paddingVertical:9},

  goalScrim:{flex:1,justifyContent:'flex-end',backgroundColor:'#09191280'},goalBackdrop:{flex:1},goalSheet:{height:'64%',maxHeight:'85%',backgroundColor:'#f7f9f5',borderTopLeftRadius:24,borderTopRightRadius:24,overflow:'hidden'},goalSurface:{flex:1,paddingHorizontal:20,paddingTop:10},goalHandle:{width:40,height:4,borderRadius:4,backgroundColor:'#c7d5ca',alignSelf:'center',marginBottom:8},goalHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12},goalOptions:{flex:1,marginTop:14,marginBottom:8},
  title:{fontSize:20,lineHeight:27,fontWeight:'700',color:'#143f30',marginBottom:6},subtitle:{fontSize:13,lineHeight:21,color:'#63756a',marginBottom:0},
  status:{minHeight:22,justifyContent:'center',marginBottom:4},statusText:{fontSize:12,lineHeight:18,color:'#63756a'},
  controls:{backgroundColor:'#fff',borderWidth:1,borderColor:'#dce9df',borderRadius:18,paddingHorizontal:14,paddingTop:4,paddingBottom:4,marginBottom:16},
  materialRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:10},materialCopy:{flex:1,minWidth:0},materialLabel:{fontSize:11,lineHeight:17,color:'#708178',marginBottom:2},materialName:{fontSize:14,lineHeight:21,fontWeight:'700',color:'#143f30'},
  change:{minHeight:44,justifyContent:'center',paddingLeft:10,paddingRight:2},changeText:{fontSize:13,lineHeight:20,fontWeight:'700',color:'#176b45'},
  option:{flexDirection:'row',alignItems:'center',gap:10,minHeight:48,paddingVertical:10,borderTopWidth:1,borderTopColor:'#edf2ed'},optionIcon:{width:24,alignItems:'center'},optionText:{flex:1,minWidth:0,fontSize:13,lineHeight:20,color:'#42584b',fontWeight:'600'},
  check:{width:20,height:20,borderRadius:6,borderWidth:1,borderColor:'#b6cbbb',alignItems:'center',justifyContent:'center'},checkSelected:{backgroundColor:'#176b45',borderColor:'#176b45'},
  listHeading:{fontSize:16,lineHeight:23,fontWeight:'700',color:'#143f30',marginTop:2,marginBottom:4},ideaCard:{marginTop:8,marginBottom:10,padding:18},ideaTitle:{fontSize:19,lineHeight:27,fontWeight:'700',color:'#143f30',marginTop:8,marginBottom:8},ideaSummary:{fontSize:14,lineHeight:23,color:'#4d6655',marginBottom:10},
});
