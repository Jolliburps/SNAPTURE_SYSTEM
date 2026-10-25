import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SceneItem } from './api';
import UpcyclingIdeaChoices from './UpcyclingIdeaChoices';

const GROUPS:Record<string,string>={biodegradable:'Biodegradable',recyclable:'Recycling / reuse candidate',diversion:'Possible diversion — confirm acceptance',special:'Separate / special handling',residual:'Residual collection',unconfirmed:'Bin not confirmed'};
/** Short next action first; details and source text stay one tap away. */
export default function ItemActionAdvice({item,onReview,onOpenGuide}:{item:SceneItem;onReview?:()=>void;onOpenGuide?:(id:string)=>void}) {
  const [sources,setSources]=useState(false);
  const advice=item.action_advice;
  if(!advice?.chosen_action)return null;
  const needsConfirmation=item.automatic_route?.enabled && item.automatic_route.confirmation_required;
  const projects=needsConfirmation?[]:advice.projects;
  return <View style={s.panel}>
    <Text accessibilityRole="header" style={s.title}>{advice.title}</Text>
    {advice.chosen_action!=='keep'?<Text style={s.group}>{GROUPS[advice.waste_group] || 'Check this item'}</Text>:null}
    {advice.steps.map((line,index)=><Text key={index} style={s.body}>{index+1}. {line}</Text>)}
    {advice.caution?<Text style={s.caution}>{advice.caution}</Text>:null}
    {advice.chosen_action==='recover' && !projects.length?<Text style={s.note}>{needsConfirmation?'Confirm the material and suitable condition to see matching ideas.':'No matching guide is ready for this condition. Check item details before reuse.'}</Text>:null}
    {projects.length?<><UpcyclingIdeaChoices material={item.prediction.assessment?.material.title || item.prediction.title} ideas={projects} onChoose={onOpenGuide}/><Text style={s.note}>General guidance; not CESD approval or a safety certification.</Text></>:null}
    {(advice.status==='needs_information' || needsConfirmation) && onReview?<Pressable accessibilityRole="button" accessibilityLabel={`Check details for item ${item.id}`} onPress={onReview} style={s.button}><Text style={s.link}>{item.name_confirmation_required && item.detection_status==='review'?'Confirm object name':item.automatic_route?.action==='recover'?'Confirm item details':'Check item details'}</Text></Pressable>:null}
    <Pressable accessibilityRole="button" accessibilityLabel={`Action sources item ${item.id}`} accessibilityState={{expanded:sources}} onPress={()=>setSources(value=>!value)} style={s.button}><Text style={s.link}>{sources?'Hide sources':'Why this advice?'}</Text></Pressable>
    {sources?advice.sources.map((source,index)=><Text selectable key={index} style={s.note}>{source.title}{source.url?`\n${source.url}`:''}{source.status?`\n${source.status}`:''}</Text>):null}
    {sources && advice.composition_note?<Text style={s.note}>{advice.composition_note}</Text>:null}
  </View>;
}
const s=StyleSheet.create({panel:{paddingHorizontal:16,paddingBottom:16},title:{fontSize:19,lineHeight:27,fontWeight:'700',color:'#143f30',marginBottom:8},group:{fontSize:16,lineHeight:24,fontWeight:'600',color:'#176b45',marginBottom:8},body:{fontSize:16,lineHeight:25,color:'#35483e',marginBottom:8},caution:{fontSize:14,lineHeight:22,color:'#855c17',marginTop:6},note:{fontSize:13,lineHeight:20,color:'#57645d',marginTop:8},button:{minHeight:44,justifyContent:'center',marginTop:5},link:{fontSize:15,color:'#176b45',fontWeight:'700'}});
