import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { type SceneItem } from './api';

/** Selection expresses disposal intent only; editing never overwrites the model. */
export default function DisposalObjectRow({item,number,color,checked,name,onToggle,onName,onDetails}:{
  item:SceneItem;number:number;color:string;checked:boolean;name:string;
  onToggle:()=>void;onName:(value:string)=>void;onDetails:()=>void;
}) {
  const identity=item.identification;
  const [editing,setEditing]=useState(false);
  const wholePhoto=identity?.object_prediction.source==='whole_image_classifier';
  const score=wholePhoto?null:identity?.object_prediction.confidence ?? (item.prediction.input_method==='manual'?null:item.score);
  return <View style={[s.card,checked && s.chosen]}>
    <Pressable accessibilityRole="checkbox" accessibilityLabel={`Discard item ${number}: ${name || item.name}`} accessibilityState={{checked}} onPress={onToggle} style={s.row}>
      <View style={[s.badge,{backgroundColor:color}]}><Text style={s.white}>{number}</Text></View>
      <View style={s.copy}><Text style={s.name}>{name || item.name}</Text><Text style={s.body}>{checked?'Selected for disposal':'Not selected'}</Text></View>
      <Text style={s.tick}>{checked?'✓':'○'}</Text>
    </Pressable>
    <Text style={s.body}>{identity?.material_prediction.title || 'Material unconfirmed'} · {identity?.material_prediction.status || 'uncertain'}</Text>
    <Text style={s.note}>{wholePhoto?'Whole-photo classification — object locations were not detected':score===null?'User-marked region — no AI detection score':`Detection score ${Math.round(score*100)}%${score<.28?' · low confidence':''} — not measured accuracy`}</Text>
    <Text style={s.note}>Material confidence: {identity?.material_prediction.confidence==null?'not available':`${Math.round(identity.material_prediction.confidence*100)}%`}. A selected item is not an AI-verified waste classification.</Text>
    {name?<Text style={s.note}>Your name correction; original suggestion: {item.name}</Text>:null}
    <Pressable accessibilityRole="button" accessibilityLabel={`Correct name item ${number}`} accessibilityState={{expanded:editing}} onPress={()=>setEditing(value=>!value)} style={s.locate}><Text style={s.link}>{editing?'Hide name correction':'Correct name'}</Text></Pressable>
    {editing?<TextInput accessibilityLabel={`Correct object name ${number}`} value={name} onChangeText={onName} maxLength={120} placeholder={`Optional correction: ${item.name}`} placeholderTextColor="#66756b" style={s.input}/>:null}
    <Pressable accessibilityRole="button" accessibilityLabel={`Locate item ${number}`} onPress={onDetails} style={s.locate}><Text style={s.link}>Locate in photo</Text></Pressable>
  </View>;
}
const s=StyleSheet.create({
  card:{borderWidth:1,borderColor:'#dce9df',borderRadius:18,padding:16,backgroundColor:'#fff',marginTop:14},chosen:{borderWidth:2,borderColor:'#176b45'},
  row:{flexDirection:'row',alignItems:'center',gap:12,minHeight:52},copy:{flex:1,minWidth:0},badge:{width:32,height:32,borderRadius:16,justifyContent:'center',alignItems:'center'},white:{color:'#fff',fontWeight:'800'},
  name:{fontSize:18,lineHeight:26,fontWeight:'700',color:'#143f30'},body:{fontSize:16,lineHeight:24,color:'#35483e',marginTop:6},note:{fontSize:13,lineHeight:20,color:'#57645d',marginTop:6},tick:{fontSize:26,color:'#176b45'},
  input:{borderWidth:1,borderColor:'#dce9df',borderRadius:10,padding:12,fontSize:16,color:'#143f30',marginTop:10,minHeight:48},locate:{minHeight:48,justifyContent:'center'},link:{color:'#176b45',fontWeight:'700',fontSize:15},
});
