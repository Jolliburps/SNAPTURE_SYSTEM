import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type Prediction } from './api';
import WasteRecommendations from './WasteRecommendations';

export function adviceSummary(prediction: Prediction) {
  const a = prediction.assessment;
  const hazardous = prediction.waste_identifier?.category === 'C' || prediction.previous_contents === 'Chemical or cleaning product';
  if (hazardous) return {title:'Keep this item separate',body:'It may need special handling. Do not open, mix, burn or reuse it. Ask your barangay or CESD about collection.',kind:'caution'};
  if (a?.segregation.status === 'available') return {title:a.segregation.category || 'Sorting advice ready',body:'Keep this material separate. Check that your collector accepts this exact item before handing it over.',kind:'ready'};
  if (prediction.condition === 'Needs cleaning' || prediction.answers?.moisture === 'Wet') return {title:'Set it aside for preparation',body:'Do not mix it with clean recyclables yet. Only clean or dry it if its contents are known and the item-specific instructions say it is safe.',kind:'caution'};
  if (prediction.condition === 'Moldy or contaminated' || ['Oil or grease','Mold or biological waste','Chemical contamination'].includes(String(prediction.answers?.contamination))) return {title:'Keep contaminated material separate',body:'Do not reuse it or mix it with clean recyclables. Ask your barangay or CESD for the right collection route.',kind:'caution'};
  if (a?.material.status === 'needs_confirmation' || !a?.material.label || a.material.label === 'unknown_unsupported') return {title:'We could not confirm this item',body:'You do not need to guess. Keep it out of the recycling pile until you know what it is. Try a closer photo, or ask your barangay or CESD.',kind:'review'};
  if (a.quick_check?.has_sorting_rule) return {title:'We cannot choose a bin yet',body:'Some item details are still unknown. Keep it separate for now. You can change your answers if you know more; there is no need to guess.',kind:'review'};
  return {title:'No checked local rule yet',body:'SNAPTURE does not have a checked local sorting rule for this item yet. Keep it separate for now and ask your barangay or CESD. You do not need to answer more questions.',kind:'review'};
}

export default function AssessmentAdvice({prediction, saved, onEdit, onDone, onRetry, onReuse, onSaveProject, busy}: {
  prediction:Prediction; saved:boolean; onEdit:()=>void; onDone:()=>void; onRetry:()=>void; onReuse:()=>void;
  onSaveProject:(id:string,title:string)=>void; busy:boolean;
}) {
  const [details,setDetails] = useState(false);
  const summary = adviceSummary(prediction);
  const a = prediction.assessment;
  const canExplore = Boolean(a?.quick_check?.has_reviewed_projects && summary.kind !== 'caution');
  return <>
    <Text style={s.small}>Item: {a?.material.title || prediction.title}</Text>
    {saved ? <Text accessibilityLiveRegion="polite" style={s.saved}>Your answers are saved. Here is what to do next.</Text> : null}
    <View style={[s.card,summary.kind === 'ready' ? s.ready : s.caution]}>
      <Text accessibilityRole="header" style={s.title}>{summary.title}</Text>
      <Text style={s.body}>{summary.body}</Text>
      {a?.segregation.status === 'available' ? a.segregation.instructions.map(line=><Text key={line} style={s.body}>{line}</Text>) : null}
      <Text style={s.small}>Based on the photo and your answers, not a safety certification.</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Done with this item" disabled={busy} onPress={onDone} style={s.button}><Text style={s.buttonText}>Done</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Change my answers" disabled={busy} onPress={onEdit}><Text style={s.link}>Change my answers</Text></Pressable>
    <WasteRecommendations key={prediction.id} prediction={prediction}/>
    {(prediction.recommendation_choices || []).map(project=><View key={project.id} style={s.card}>
      <Text style={s.title}>{project.title}</Text><Text style={s.body}>{project.summary}</Text>
      <Text style={s.small}>{project.safety_note}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Save this project" disabled={busy} onPress={()=>onSaveProject(project.id,project.title)} style={s.button}><Text style={s.buttonText}>Save this project</Text></Pressable>
    </View>)}
    {!prediction.recommendation_choices?.length ? <View style={s.card}><Text style={s.title}>Want to reuse it?</Text>
      <Text style={s.body}>{canExplore ? 'Optional: check a few extra details to see whether a reviewed project fits. Sorting advice does not require a project.' : 'No reviewed project is ready for this item. You can finish this check without answering more questions.'}</Text>
      {canExplore ? <Pressable accessibilityRole="button" accessibilityLabel="Check reuse options" disabled={busy} onPress={onReuse}><Text style={s.link}>Check reuse options</Text></Pressable> : null}
    </View> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Scan another item" disabled={busy} onPress={onRetry}><Text style={s.link}>Scan another item</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityState={{expanded:details}} onPress={()=>setDetails(value=>!value)}><Text style={s.link}>{details ? 'Hide sources and details' : 'Sources and details'}</Text></Pressable>
    {details ? <View style={s.card}>
      <Text style={s.small}>{prediction.input_method === 'manual' ? 'Material selected manually; not an AI prediction.' : `Model score: ${Math.round(prediction.confidence*100)}%. This is not measured accuracy.`}</Text>
      <Text style={s.body}>{a?.segregation.explanation}</Text>
      {a?.segregation.sources?.map(source=><Text key={source.key} style={s.small}>{source.source}{'\n'}{source.review_note}</Text>)}
      {prediction.waste_identifier?.general_guidance ? <><Text style={s.small}>{prediction.waste_identifier.general_guidance.source.name}{'\n'}{prediction.waste_identifier.general_guidance.source.url}</Text>{prediction.waste_identifier.general_guidance.instructions.map(line=><Text key={line} style={s.body}>{line}</Text>)}</> : null}
      {a?.safety?.instructions.map(line=><Text key={line} style={s.body}>{line}</Text>)}
    </View> : null}
  </>;
}
const s=StyleSheet.create({
  card:{padding:16,borderRadius:16,borderWidth:1,borderColor:'#dce9df',backgroundColor:'#fff',marginTop:16},ready:{backgroundColor:'#e8f5ec'},caution:{backgroundColor:'#fff6e4'},
  title:{fontSize:20,fontWeight:'700',color:'#143f30',marginBottom:8},body:{fontSize:15,lineHeight:22,color:'#35483e',marginBottom:8},small:{fontSize:12,lineHeight:18,color:'#57645d',marginTop:6},
  saved:{fontSize:14,lineHeight:20,color:'#176b45',marginTop:10},button:{backgroundColor:'#176b45',padding:15,borderRadius:12,marginTop:16},buttonText:{fontWeight:'700',color:'#fff',textAlign:'center'},link:{color:'#176b45',fontWeight:'700',paddingVertical:14},
});
