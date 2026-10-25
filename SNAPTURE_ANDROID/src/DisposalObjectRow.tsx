import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { type SceneItem } from './api';
import { sceneItemTitle } from './detectionPresentation';

/** Confirm the target item; its handling route is selected by the server. */
export default function DisposalObjectRow({item,number,color,checked,name,onToggle,onName,onDetails,condition,onCondition,requestNameConfirmation=false}:{
  item:SceneItem;number:number;color:string;checked:boolean;name:string;
  onToggle:()=>void;onName:(value:string)=>void;onDetails:()=>void;
  condition?:string;onCondition?:(condition:string)=>void;requestNameConfirmation?:boolean;
}) {
  const identity=item.identification;
  const itemTitle=sceneItemTitle(item,name);
  const [editing,setEditing]=useState(requestNameConfirmation);
  const wholePhoto=identity?.object_prediction.source==='whole_image_classifier';
  const score=wholePhoto?null:identity?.object_prediction.confidence ?? (item.prediction.input_method==='manual'?null:item.score);
  return <View style={[s.card,checked && s.chosen]}>
    <Pressable accessibilityRole="checkbox" accessibilityLabel={`Select item ${number}: ${itemTitle}`} accessibilityState={{checked}} onPress={onToggle} style={s.row}>
      <View style={[s.badge,{backgroundColor:color}]}><Text style={s.white}>{number}</Text></View>
      <View style={s.copy}><Text style={s.name}>{itemTitle}</Text><Text style={s.body}>{checked?'Selected for guidance':'Tap to include this item'}</Text></View>
      <Text style={s.tick}>{checked?'✓':'○'}</Text>
    </Pressable>
    <Text style={s.body}>{identity?.material_prediction.title || 'Material unconfirmed'} · {identity?.material_prediction.status || 'uncertain'}</Text>
    {item.name_confirmation_required && !name?<Text style={s.note}>Exact object needs confirmation. Fabric does not tell us whether this is a towel, pillow, blanket or bag.</Text>:null}
    <Text style={s.note}>{item.automatic_route?.label || 'Check material for automatic guidance'}</Text>
    {wholePhoto || item.detection_status==='review' || score!==null && score<.28?<Text style={s.note}>{wholePhoto?'Whole-photo result; object locations unknown':item.review_reason || 'Uncertain object — check its name or retake.'}</Text>:null}
    {checked && onCondition?<View><Text style={s.body}>Condition</Text><View style={s.options}>{([['Clean and dry','Clean & dry'],['Needs cleaning','Needs cleaning'],['Damaged or cracked','Damaged'],['Moldy or contaminated','Contaminated'],['Not sure','Not sure']] as const).map(([value,title])=><Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${title} condition item ${number}`} accessibilityState={{checked:condition===value}} onPress={()=>onCondition(value)} style={[s.option,condition===value && s.active]}><Text style={s.link}>{title}</Text></Pressable>)}</View></View>:null}
    {name?<Text style={s.note}>Your name correction; original suggestion: {item.name}</Text>:null}
    <Pressable accessibilityRole="button" accessibilityLabel={`Correct name item ${number}`} accessibilityState={{expanded:editing}} onPress={()=>setEditing(value=>!value)} style={s.locate}><Text style={s.link}>{editing?'Hide name correction':item.name_confirmation_required?'Confirm object name':'Correct name'}</Text></Pressable>
    {editing?<TextInput accessibilityLabel={`Correct object name ${number}`} value={name} onChangeText={onName} maxLength={120} placeholder={item.name_confirmation_required?'Name the item you can identify':`Optional correction: ${item.name}`} placeholderTextColor="#66756b" style={s.input}/>:null}
    {editing && item.name_confirmation_required?<Text style={s.note}>Original model guess (not confirmed): {item.name}</Text>:null}
    {editing?<Text style={s.note}>Original object score: {score==null?'not available':`${Math.round(score*100)}%`}. Material score: {identity?.material_prediction.confidence==null?'not available':`${Math.round(identity.material_prediction.confidence*100)}%`}. Scores are not accuracy.</Text>:null}
    <Pressable accessibilityRole="button" accessibilityLabel={`Locate item ${number}`} onPress={onDetails} style={s.locate}><Text style={s.link}>Locate in photo</Text></Pressable>
  </View>;
}
const s=StyleSheet.create({
  options:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:10},option:{borderWidth:1,borderColor:'#cddfd2',borderRadius:10,padding:10,minHeight:46,justifyContent:'center'},active:{backgroundColor:'#dcefe2',borderColor:'#176b45'},
  card:{borderWidth:1,borderColor:'#dce9df',borderRadius:18,padding:16,backgroundColor:'#fff',marginTop:14},chosen:{borderWidth:2,borderColor:'#176b45'},
  row:{flexDirection:'row',alignItems:'center',gap:12,minHeight:52},copy:{flex:1,minWidth:0},badge:{width:32,height:32,borderRadius:16,justifyContent:'center',alignItems:'center'},white:{color:'#fff',fontWeight:'800'},
  name:{fontSize:18,lineHeight:26,fontWeight:'700',color:'#143f30'},body:{fontSize:16,lineHeight:24,color:'#35483e',marginTop:6},note:{fontSize:13,lineHeight:20,color:'#57645d',marginTop:6},tick:{fontSize:26,color:'#176b45'},
  input:{borderWidth:1,borderColor:'#dce9df',borderRadius:10,padding:12,fontSize:16,color:'#143f30',marginTop:10,minHeight:48},locate:{minHeight:48,justifyContent:'center'},link:{color:'#176b45',fontWeight:'700',fontSize:15},
});
