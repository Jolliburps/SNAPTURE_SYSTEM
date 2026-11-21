import React from 'react';
import { StyleSheet, View } from 'react-native';
import Text from './PublicText';
import type { Idea } from './projectData';
import TutorialPhoto, {PhotoCredits} from './TutorialPhoto';

export function ideaStatus(idea:Idea) {
  if(idea.status==='educational')return 'Educational idea · not expert-approved';
  return idea.status==='awaiting_review'?'Awaiting review':idea.status==='source_checked'?'General reference · not expert-approved':'Expert-reviewed project';
}

export default function IdeaDetails({idea,showHeading=true}:{idea:Idea;showHeading?:boolean}) {
  const pending=idea.status==='awaiting_review';
  return <View>
    {showHeading?<Text style={s.title}>{idea.title}</Text>:null}
    <Text style={s.badge}>{ideaStatus(idea)}</Text>
    <Text style={s.body}>{idea.summary}</Text>
    {!pending?<TutorialPhoto photo={idea.photos?.finished} label={`${idea.title}: finished-product reference`}/>:null}
    {idea.status?<Text style={s.notice}>This is not a recommendation assessed for your scanned item or CESD approval. {pending?'Do not begin this concept; instructions are not yet published.':'Check the material, its condition and previous contents before considering reuse.'}</Text>:null}
    {idea.safety_note?<Text style={s.notice}>{idea.safety_note}</Text>:null}
    {idea.conditions?.length?<><Text style={s.heading}>Conditions to check</Text>{idea.conditions.map((line,index)=><Text key={index} style={s.body}>• {line}</Text>)}</>:null}
    {!pending && idea.materials.length?<><Text style={s.heading}>Materials</Text>{idea.materials.map((line,index)=><Text key={index} style={s.body}>• {line}</Text>)}</>:null}
    {!pending && idea.steps.length?<><Text style={s.heading}>{idea.status?'Reference steps':'Steps'}</Text>{idea.steps.map((line,index)=><View key={index}><Text style={s.body}>{index+1}. {line}</Text>{idea.photos?.steps.filter(photo=>photo.step_index===index).map((photo,i)=><TutorialPhoto key={i} photo={photo} label={`${idea.title}: step ${index+1} reference`}/>)}</View>)}</>:null}
    {idea.source?<><Text style={s.heading}>Source</Text><Text selectable style={s.source}>{idea.source}</Text></>:null}
    {idea.review_note?<Text style={s.source}>{idea.review_note}</Text>:null}
    {!pending?<PhotoCredits photos={idea.photos}/>:null}
    <Text style={s.source}>{idea.status?'Read-only idea. Saving or starting a tracked project requires a separately published expert-reviewed recommendation matching the item.':'Select a recommendation after scanning to save it. Start it from My projects on Home when you are ready to track steps.'}</Text>
  </View>;
}
const s=StyleSheet.create({title:{fontSize:23,lineHeight:31,color:'#143f30',fontWeight:'800',marginBottom:12},badge:{fontSize:14,lineHeight:22,fontWeight:'700',color:'#176b45',marginBottom:12},body:{fontSize:16,lineHeight:25,color:'#35483e',marginBottom:10},notice:{fontSize:15,lineHeight:23,color:'#71511b',backgroundColor:'#fff3dc',padding:12,borderRadius:12,marginBottom:12},heading:{fontSize:18,fontWeight:'700',color:'#143f30',marginTop:14,marginBottom:10},source:{fontSize:14,lineHeight:22,color:'#57645d',marginVertical:10}});
