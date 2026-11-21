import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type SceneItem } from './api';
import { sceneItemTitle, isUpcyclingMaterial } from './detectionPresentation';

/** Select a material result to check its details. */
export default function DisposalObjectRow({item,number,color,checked,onToggle,onDetails,condition,onCondition}:{
  item:SceneItem;number:number;color:string;checked:boolean;
  onToggle:()=>void;onDetails:()=>void;
  condition?:string;onCondition?:(condition:string)=>void;
}) {
  const itemTitle=sceneItemTitle(item);
  const supported=isUpcyclingMaterial(item.prediction);
  const materialStatus=item.prediction.assessment?.material.status;
  return <View style={[s.card,checked && s.chosen]}>
    <Pressable accessibilityRole="checkbox" accessibilityLabel={`Select item ${number}: ${itemTitle}`} accessibilityState={{checked}} onPress={onToggle} style={s.row}>
      <View style={[s.badge,{backgroundColor:color}]}><Text style={s.white}>{number}</Text></View>
      <View style={s.copy}><Text style={s.name}>{itemTitle}</Text><Text style={s.body}>{checked?'Selected for guidance':'Tap to include this item'}</Text></View>
      <Text style={s.tick}>{checked?'✓':'○'}</Text>
    </Pressable>
    {supported && materialStatus!=='user_selected' && materialStatus!=='model_high_confidence'
      ?<Text style={s.note}>Suggested category. Check the material to continue.</Text>:null}
    {checked && onCondition?<View><Text style={s.body}>Condition</Text><View style={s.options}>{([['Clean and dry','Clean & dry'],['Needs cleaning','Needs cleaning'],['Damaged or cracked','Damaged'],['Moldy or contaminated','Contaminated'],['Not sure','Not sure']] as const).map(([value,title])=><Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${title} condition item ${number}`} accessibilityState={{checked:condition===value}} onPress={()=>onCondition(value)} style={[s.option,condition===value && s.active]}><Text style={s.link}>{title}</Text></Pressable>)}</View></View>:null}
    {item.display_box!==false?<Pressable accessibilityRole="button" accessibilityLabel={`Locate item ${number}`} onPress={onDetails} style={s.locate}><Text style={s.link}>Locate in photo</Text></Pressable>:null}
  </View>;
}
const s=StyleSheet.create({
  options:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:10},option:{borderWidth:1,borderColor:'#cddfd2',borderRadius:10,padding:10,minHeight:46,justifyContent:'center'},active:{backgroundColor:'#dcefe2',borderColor:'#176b45'},
  card:{borderWidth:1,borderColor:'#dce9df',borderRadius:18,padding:16,backgroundColor:'#fff',marginTop:14},chosen:{borderWidth:2,borderColor:'#176b45'},
  row:{flexDirection:'row',alignItems:'center',gap:12,minHeight:52},copy:{flex:1,minWidth:0},badge:{width:32,height:32,borderRadius:16,justifyContent:'center',alignItems:'center'},white:{color:'#fff',fontWeight:'800'},
  name:{fontSize:18,lineHeight:26,fontWeight:'700',color:'#143f30'},body:{fontSize:16,lineHeight:24,color:'#35483e',marginTop:6},note:{fontSize:13,lineHeight:20,color:'#57645d',marginTop:6},tick:{fontSize:26,color:'#176b45'},
  input:{borderWidth:1,borderColor:'#dce9df',borderRadius:10,padding:12,fontSize:16,color:'#143f30',marginTop:10,minHeight:48},locate:{minHeight:48,justifyContent:'center'},link:{color:'#176b45',fontWeight:'700',fontSize:15},
});
