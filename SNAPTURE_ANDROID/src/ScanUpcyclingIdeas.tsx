import React, { useContext, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { startProject, type Prediction } from './api';
import { ProjectFlowContext } from './ProjectFlowContext';

function Action({label,onPress,disabled}:{label:string;onPress:()=>void;disabled:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[s.action,disabled && {opacity:.5}]}><Text style={s.actionText}>{label}</Text></Pressable>;
}

export default function ScanUpcyclingIdeas({prediction}:{prediction:Prediction}) {
  const openProject=useContext(ProjectFlowContext);
  const [starting,setStarting]=useState('');
  const [error,setError]=useState('');
  const busy=useRef(false);
  const ideas=(prediction.upcycling_ideas || []).filter(idea=>idea.steps?.length);
  const choose=async(id:string)=>{
    if(busy.current)return;
    if(!openProject){setError('Reopen this scan from the app to start a project.');return;}
    busy.current=true;setStarting(id);setError('');
    try{
      const result=await startProject(prediction.id,id);
      openProject(result.project);
    }catch(reason){setError(reason instanceof Error?reason.message:'Unable to start this task. Try again.');}
    finally{busy.current=false;setStarting('');}
  };
  if(!ideas.length)return null;
  return <View style={s.section}>
    <Text accessibilityRole="header" style={s.heading}>Upcycling ideas for {prediction.assessment?.material.title || prediction.title}</Text>
    <Text style={s.note}>Ideas for clean, suitable material. Check its condition and previous contents before starting.</Text>
    {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
    {ideas.map(option=><View key={option.id} style={s.card}>
      <Text style={s.title}>{option.title}</Text><Text style={s.body}>{option.summary}</Text>
      <Action label={starting===option.id?'Starting task...':`Choose task: ${option.title}`} disabled={Boolean(starting)} onPress={()=>{choose(option.id);}}/>
    </View>)}
  </View>;
}

const s=StyleSheet.create({
  section:{marginTop:18},heading:{fontSize:21,lineHeight:29,fontWeight:'700',color:'#143f30',marginBottom:8},
  card:{padding:16,borderWidth:1,borderColor:'#cce2cf',backgroundColor:'#f1f8ef',borderRadius:16,marginTop:12},
  title:{fontSize:19,lineHeight:27,fontWeight:'700',color:'#143f30',marginVertical:8},body:{fontSize:16,lineHeight:25,color:'#35483e',marginBottom:8},
  note:{fontSize:14,lineHeight:22,color:'#57645d',marginBottom:8},label:{fontSize:16,fontWeight:'700',color:'#143f30',marginTop:8,marginBottom:8},
  error:{color:'#a12020',fontSize:15,lineHeight:23,marginVertical:10},
  action:{minHeight:48,justifyContent:'center',backgroundColor:'#176b45',borderRadius:12,padding:12,marginTop:10},actionText:{fontSize:16,lineHeight:23,color:'#fff',fontWeight:'700',textAlign:'center'},
});
