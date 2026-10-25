import React from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import type {Recommendation} from './api';

export type IdeaChoice=Recommendation & {existing_project_id?:number;existing_project_status?:'active'|'completed'};
/** The original material-specific chooser, shared by first selection and change. */
export default function UpcyclingIdeaChoices({material,ideas,onChoose,selectedId,busyId='',error='',changing=false}:{
  material:string;ideas:IdeaChoice[];onChoose?:((id:string)=>void);selectedId?:string;busyId?:string;error?:string;changing?:boolean;
}) {
  return <View style={s.section}>
    <Text accessibilityRole="header" style={s.heading}>Upcycling ideas for {material}</Text>
    <Text style={s.note}>Ideas for clean, suitable material. Check its condition and previous contents before starting.</Text>
    {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
    {ideas.map(idea=>{
      const selected=idea.id===selectedId;
      const label=selected?'Current idea':busyId===idea.id?'Saving...':changing && idea.existing_project_id?(idea.existing_project_status==='completed'?'View completed project':'Continue saved project'):`Choose task: ${idea.title}`;
      return <View key={idea.id} style={s.card}>
        <Text style={s.title}>{idea.title}</Text><Text style={s.body}>{idea.summary}</Text>
        {changing && idea.existing_project_id && !selected?<Text style={s.note}>Already saved for this item. Its progress will be kept.</Text>:null}
        {onChoose?<Pressable accessibilityRole="button" accessibilityLabel={selected?`Current idea: ${idea.title}`:`Choose task: ${idea.title}`} accessibilityState={{selected}} disabled={selected || Boolean(busyId)} onPress={()=>onChoose(idea.id)} style={[s.action,(selected || Boolean(busyId)) && s.disabled]}><Text style={s.actionText}>{label}</Text></Pressable>:null}
      </View>;
    })}
  </View>;
}
const s=StyleSheet.create({section:{marginTop:18},heading:{fontSize:21,lineHeight:29,fontWeight:'700',color:'#143f30',marginBottom:8},card:{padding:16,borderWidth:1,borderColor:'#cce2cf',backgroundColor:'#f1f8ef',borderRadius:16,marginTop:12},title:{fontSize:19,lineHeight:27,fontWeight:'700',color:'#143f30',marginVertical:8},body:{fontSize:16,lineHeight:25,color:'#35483e',marginBottom:8},note:{fontSize:14,lineHeight:22,color:'#57645d',marginBottom:8},error:{color:'#a12020',fontSize:15,lineHeight:23,marginVertical:10},action:{minHeight:48,justifyContent:'center',backgroundColor:'#176b45',borderRadius:12,padding:12,marginTop:10},actionText:{fontSize:16,lineHeight:23,color:'#fff',fontWeight:'700',textAlign:'center'},disabled:{opacity:.5}});
