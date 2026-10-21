import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import type { IdeaReference } from './api';
import IdeaDetails, { ideaStatus } from './IdeaDetails';

export default function MaterialIdeaReferences({ideas,material,label}:{ideas:IdeaReference[];material:string;label:string}) {
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  return <View>{ideas.map(reference=>{
    const idea={...reference,material,guideLabel:label};
    return <View key={idea.id} style={s.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Read idea: ${idea.title}`} accessibilityState={{expanded:Boolean(expanded[idea.id])}} onPress={()=>setExpanded(previous=>({...previous,[idea.id]:!previous[idea.id]}))} style={s.header}>
        <View style={s.copy}><Text style={s.title}>{idea.title}</Text><Text style={s.badge}>{ideaStatus(idea)}</Text></View>{expanded[idea.id]?<ChevronUp size={22} color="#176b45"/>:<ChevronDown size={22} color="#176b45"/>}
      </Pressable>
      {expanded[idea.id]?<IdeaDetails idea={idea} showHeading={false}/>:null}
    </View>;
  })}</View>;
}
const s=StyleSheet.create({card:{padding:16,borderRadius:16,borderWidth:1,borderColor:'#dce9df',backgroundColor:'#fff',marginBottom:12},header:{minHeight:56,flexDirection:'row',alignItems:'center',gap:10},copy:{flex:1,minWidth:0},title:{fontSize:17,lineHeight:25,fontWeight:'700',color:'#143f30'},badge:{fontSize:14,lineHeight:22,color:'#71511b',marginTop:5,marginBottom:10}});
