import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Idea } from './projectData';

export function ideaStatus(idea:Idea) {
  return idea.status==='awaiting_review'?'Awaiting review':idea.status==='source_checked'?'General reference · not expert-approved':'Expert-reviewed project';
}

export default function IdeaDetails({idea,showHeading=true}:{idea:Idea;showHeading?:boolean}) {
  const pending=idea.status==='awaiting_review';
  return <View>
    {showHeading?<Text style={s.title}>{idea.title}</Text>:null}
    <Text style={s.badge}>{ideaStatus(idea)}</Text>
    <Text style={s.body}>{idea.summary}</Text>
    {idea.status?<Text style={s.notice}>This is not a recommendation assessed for your scanned item or CESD approval. {pending?'Do not begin this concept; instructions are not yet published.':'Check the material, its condition and previous contents before considering reuse.'}</Text>:null}
    {idea.safety_note?<Text style={s.notice}>{idea.safety_note}</Text>:null}
    {idea.conditions?.length?<><Text style={s.heading}>Conditions to check</Text>{idea.conditions.map((line,index)=><Text key={index} style={s.body}>• {line}</Text>)}</>:null}
    {!pending && idea.materials.length?<><Text style={s.heading}>Materials</Text>{idea.materials.map((line,index)=><Text key={index} style={s.body}>• {line}</Text>)}</>:null}
    {!pending && idea.steps.length?<><Text style={s.heading}>{idea.status?'Reference steps':'Steps'}</Text>{idea.steps.map((line,index)=><Text key={index} style={s.body}>{index+1}. {line}</Text>)}</>:null}
    {idea.source?<><Text style={s.heading}>Source</Text><Text selectable style={s.source}>{idea.source}</Text></>:null}
    {idea.review_note?<Text style={s.source}>{idea.review_note}</Text>:null}
    <Text style={s.source}>{idea.status?'Read-only idea. Saving or starting a tracked project requires a separately published expert-reviewed recommendation matching the item.':'Select a recommendation after scanning to save it. Start it from Profile when you are ready to track steps.'}</Text>
  </View>;
}
const s=StyleSheet.create({title:{fontSize:23,lineHeight:31,color:'#143f30',fontWeight:'800',marginBottom:12},badge:{fontSize:14,lineHeight:22,fontWeight:'700',color:'#176b45',marginBottom:12},body:{fontSize:16,lineHeight:25,color:'#35483e',marginBottom:10},notice:{fontSize:15,lineHeight:23,color:'#71511b',backgroundColor:'#fff3dc',padding:12,borderRadius:12,marginBottom:12},heading:{fontSize:18,fontWeight:'700',color:'#143f30',marginTop:14,marginBottom:10},source:{fontSize:14,lineHeight:22,color:'#57645d',marginVertical:10}});
