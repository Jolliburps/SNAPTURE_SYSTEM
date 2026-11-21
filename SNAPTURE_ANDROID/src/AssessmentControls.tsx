import React,{useEffect,useState} from 'react';
import {Modal,ScrollView,View} from 'react-native';
import Text from './PublicText';
import {Action,Chip,Field,u} from './UpcyclingUI';
import type {VisualAssessment} from './upcyclingApi';

export default function AssessmentControls({assessment,material,busy,onSave,onPhoto}:{assessment:VisualAssessment;material?:string;busy:boolean;onSave:(facts:Record<string,unknown>)=>Promise<void>;onPhoto:(purpose:string)=>void}){
  const [safety,setSafety]=useState(false),[quantity,setQuantity]=useState(''),[inspected,setInspected]=useState(false);
  const details=assessment.scan_details,workflow=assessment.workflow;
  useEffect(()=>{setQuantity(String(workflow?.usable_quantity ?? details?.quantity ?? 1));setInspected(!!workflow?.inspection_confirmed);},[workflow?.usable_quantity,workflow?.inspection_confirmed,details?.quantity]);
  if(!details || !assessment.verdict)return null;
  const pick=(field:string,title:string,options:string[],current?:string)=><View style={{marginVertical:12}}><Text style={u.fieldLabel}>{title}</Text><View style={u.row}>{options.map(v=><Chip key={v} title={v} disabled={busy} selected={current===v} onPress={()=>{onSave({[field]:v});}}/>)}</View></View>;
  const verdict=assessment.verdict;
  const guided=!!details.inspection_report;
  const reuseScanSize=details.condition_policy==='inspection-first-v1';
  const required=verdict.required_input;
  const showExposure=!guided || required==='exposure' || required==='exposure_and_closeup';
  const showCloseUp=!guided || required==='closeup' || required==='exposure_and_closeup' || required==='moisture_and_closeup';
  const showInspection=!guided || required==='usable_quantity';
  const showPreparation=guided?verdict.code==='requires_preparation':workflow?.preparation_required || workflow?.reassessment_required;
  const scopeReport=assessment.facts?.material_scope_report?.value;
  const paper=material==='paper' || material==='cardboard';
  const valid=/^\d+$/.test(quantity.trim()) && Number(quantity)<=details.quantity;
  const canCheck=!busy && valid && inspected && !!workflow?.safety_acknowledged && verdict.code!=='for_disposal' && verdict.code!=='unsupported';
  const takeEvidence=(purpose:string)=>{
    setInspected(false);
    onPhoto(purpose);
  };
  return <View style={u.card}>
    <Text accessibilityRole="header" style={u.heading}>{verdict.title}</Text>
    <Text style={u.body}>{verdict.reason}</Text>
    {!reuseScanSize || verdict.code!=='suitable'?<Text style={u.small}>{verdict.next_action}</Text>:null}
    {reuseScanSize?<Text style={u.small}>{details.approximate_size} · {workflow?.usable_quantity ?? details.quantity} {workflow?.usable_quantity==null?'reported':'usable'} {(workflow?.usable_quantity ?? details.quantity)===1?'piece':'pieces'}</Text>:
      <Text style={u.small}>Initial quantity: {details.quantity}. Approximate size: {details.approximate_size}. {details.mode==='batch'?'Representative photos do not verify every piece.':''}</Text>}
    {guided?(reuseScanSize?null:<Text style={u.body}>{details.inspection_report==='none_seen'?'You reported no visible signs of contamination.':'You submitted a close-up of a concern.'}</Text>):<>
    <Text accessibilityRole="header" style={u.heading}>Inspect your material</Text>
    <Text style={u.body}>{details.mode==='batch'?'Check every side and edge of each piece, even if you photographed only a few examples.':'Check every side and edge of the item, including the visible interior where applicable.'} Look for dirt, damp spots, damage, mold, unusual stains, or residue.</Text>
    <Text style={u.body}>If you spot something questionable, set that piece aside and take a clear close-up before continuing. If you find no concerns, record your inspection and usable quantity so SNAPTURE can check which projects fit.</Text>
    <Text style={u.fieldLabel}>Is the scanned material outside SNAPTURE’s scope?</Text>
    <View style={u.row}>
      <Chip title="Report glass" selected={scopeReport==='glass'} disabled={busy} onPress={()=>{setInspected(false);onSave({material_scope_report:'glass'});}}/>
      <Chip title="Report metal" selected={scopeReport==='metal'} disabled={busy} onPress={()=>{setInspected(false);onSave({material_scope_report:'metal'});}}/>
      <Chip title="Report another out-of-scope item" selected={scopeReport==='out_of_scope'} disabled={busy} onPress={()=>{setInspected(false);onSave({material_scope_report:'out_of_scope'});}}/>
    </View>
    </>}
    {!guided && details.assessment_mode!=='human_assisted' && assessment.capability?.condition_assessment==='unavailable'?<Text style={u.body}>Automatic condition assessment is unavailable. Your answers and photos are recorded, but cannot unlock a project that requires this check.</Text>:null}
    {showExposure?pick('previous_contents','Known contents or exposure',['No chemical contact known','Water or beverage','Food or oil','Chemical or cleaning product','Other / unknown'],String(assessment.facts?.previous_contents?.value || '')):null}
    {!guided?pick('condition','Your observed condition',['Clean and dry','Needs cleaning','Damaged or cracked','Torn or crumpled, clean and dry','Moldy or contaminated','Not sure'],String(assessment.facts?.condition?.value || '')):null}
    {(required==='moisture_and_closeup' || (!guided && paper))?<>{pick('moisture_cause','What caused the damp area?',['Water','Oil','Chemical','Unknown'],workflow?.moisture_cause)}<Text style={u.small}>A close-up can document moisture or stains. Enter the cause only if you know it.</Text></>:null}
    {details.assessment_mode==='human_assisted'?<View><Text style={u.body}>Human-assisted inspection: your answers are not AI verification. Inspect both sides and every piece, separate questionable items, and do not proceed with unresolved exposure.</Text><Chip title="I inspected the material and confirm my condition report" selected={!!workflow?.human_condition_confirmed} disabled={busy} onPress={()=>{onSave({human_condition_confirmed:!workflow?.human_condition_confirmed});}}/></View>:null}
    {showCloseUp?<Action title="Photograph a suspicious area" disabled={busy} onPress={()=>takeEvidence('closeup')}/>:null}
    {showPreparation?<View>
      <Text style={u.heading}>Preparation and reassessment</Text><Text style={u.body}>Follow the preparation instructions for the material, then record the preparation and take a new photo.</Text>
      <Action title="Record preparation completed" disabled={busy} onPress={()=>{onSave({preparation_completed:true});}}/>
      <Action title="Submit updated evidence for reassessment" disabled={busy} onPress={()=>takeEvidence('reassessment')}/>
    </View>:null}
    {showInspection?<>
    <Action title="Review material inspection guidance" disabled={busy} onPress={()=>setSafety(true)}/>
    <Text style={u.fieldLabel}>Inspect every piece before use</Text>
    <Field label="Usable pieces after inspection" numeric value={quantity} onChange={v=>{setQuantity(v);setInspected(false);}}/>
    <Chip title="I checked all sides and found no signs of contamination on the pieces I marked usable" selected={inspected} disabled={busy} onPress={()=>setInspected(v=>!v)}/>
    <Text style={u.small}>Report any known exposure above. If no pieces are usable, enter 0. If you change the count, confirm your inspection again.</Text>
    <Action title="Check project eligibility" variant="primary" disabled={!canCheck} onPress={()=>{
      if(canCheck)onSave({inspection_confirmed:true,usable_quantity:Number(quantity)});
    }}/>
    </>:null}
    <Modal visible={safety} transparent animationType="fade" onRequestClose={()=>{if(!busy)setSafety(false);}}>
      <View style={{flex:1,justifyContent:'center',backgroundColor:'#091912aa',padding:20}}><ScrollView style={{maxHeight:'85%',backgroundColor:'#f7f9f5',borderRadius:20}} contentContainerStyle={{padding:22}}>
        <Text style={u.heading}>Inspect all materials first</Text><Text style={u.body}>Check both surfaces and edges of every piece. Separate suspected mold, unknown oily stains, chemical exposure and other concerning contamination. Do not use questionable pieces.</Text>
        <Text style={u.fieldLabel}>Illustrative examples — not diagnostic photos</Text>
        <View style={u.row}>{[{name:'Possible mold',color:'#64865a',marks:'●  •  ●'},{name:'Oily stain',color:'#896329',marks:'◯ ◯'},{name:'Wet area',color:'#527f9e',marks:'≈ ≈'}].map(e=><View key={e.name} style={{padding:10,backgroundColor:'#eee8d9',borderRadius:8}}><Text style={{fontSize:25,color:e.color}}>{e.marks}</Text><Text style={u.small}>{e.name}</Text></View>)}</View>
        <Text style={u.body}>Tears and creases do not automatically exclude a piece. Check its remaining usable size and condition against the project requirements.</Text>
        <Text style={u.body}>Not sure about an area? Photograph it for additional assessment. The system can make mistakes and cannot certify safety. Ask CESD or a knowledgeable person and use reliable sources if concerns remain. Do not proceed while the concern is unresolved.</Text>
        <Action title="Photograph the questionable area" disabled={busy} onPress={()=>{setSafety(false);takeEvidence('closeup');}}/>
        <Action title="OK, I understand" variant="primary" disabled={busy} onPress={()=>{onSave({safety_acknowledged:true}).then(()=>setSafety(false));}}/>
        <Text style={u.small}>OK acknowledges this guidance only. Inspection and usable quantity are confirmed separately.</Text>
      </ScrollView></View>
    </Modal>
  </View>;
}
