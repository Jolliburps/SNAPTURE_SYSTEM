import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import { imageUrl, type SceneItem } from './api';
import WasteRecommendations from './WasteRecommendations';
import ScanUpcyclingIdeas from './ScanUpcyclingIdeas';

function CardAction({title,onPress,disabled=false}:{title:string;onPress:()=>void;disabled?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={[s.action,disabled && s.disabled]}><Text style={s.actionText}>{title}</Text></Pressable>;
}

/** Presentation only: the category and instructions come from existing results. */
export default function DetectionItemCard({item,number,category,color,explanation,recoveryOptions,fallbackPreparation,expanded,selected,onToggle,onShowPhoto,onReview,onOpenGuide,openingGuide,guidesBusy,onLayout}:{
  item:SceneItem;number:number;category:string;color:string;explanation:string;recoveryOptions:string[];fallbackPreparation:string;
  expanded:boolean;selected:boolean;onToggle:()=>void;onShowPhoto?:()=>void;onReview?:()=>void;
  onOpenGuide?:(id:string)=>void;openingGuide:string;guidesBusy:boolean;onLayout:(y:number)=>void;
}) {
  const assessment=item.prediction.assessment;
  const low=item.low_confidence || item.display_box===undefined && item.score<.28;
  const instructions=assessment?.segregation.instructions || [];
  const handling=item.handling;
  const special=handling?.route==='special_handling';
  const ideas=handling?handling.recommendations:item.prediction.recommendation_choices || [];
  return <View onLayout={event=>onLayout(event.nativeEvent.layout.y)} style={[s.card,selected && s.selected]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Select item ${number} card`} accessibilityValue={{text:`${item.name}. ${category}`}} accessibilityState={{expanded,selected}} accessibilityHint={expanded?'Collapse item details':'Expand classification and sorting details'} onPress={onToggle} style={s.header}>
      <View style={[s.number,{backgroundColor:color}]}><Text style={s.numberText}>{number}</Text></View>
      <View style={s.copy}>
        <Text style={s.name}>{item.identification?.user_object_name || item.name}</Text>
        <Text style={[s.category,{color}]}>{handling?.title || category}</Text>
        {low?<Text style={s.status}>Unconfirmed suggestion</Text>:null}
        {item.background?<Text style={s.status}>Possible background object</Text>:null}
      </View>
      <View accessible={false} importantForAccessibility="no-hide-descendants">{expanded?<ChevronUp size={24} color="#176b45"/>:<ChevronDown size={24} color="#176b45"/>}</View>
    </Pressable>
    {expanded?<View style={s.details}>
      {item.prediction.image_url?<Image source={{uri:imageUrl(item.prediction.image_url)}} resizeMode="contain" style={s.crop} accessibilityLabel={`Detected item ${number} crop for review`}/>:null}
      {handling?<View><Text style={s.section}>{handling.title}</Text><Text style={s.body}>{handling.explanation}</Text>
        {handling.instructions.map((line,index)=><Text key={index} style={s.body}>{line}</Text>)}
        <Text style={s.reference}>Project status: {handling.verification_status.replace(/_/g,' ')}. Disposal selection is your intention, not AI ground truth.</Text>
        {handling.sources.map((source,index)=><Text selectable key={index} style={s.reference}>{source.title || source.source || 'Project review'}{source.url?`\n${source.url}`:''}{source.review_level?` · ${source.review_level}`:''}</Text>)}
      </View>:null}
      {!special?<>
      <Text style={s.body}>{item.review_reason || item.route.reason}</Text>
      <Text style={s.body}>{assessment?.material.status==='user_selected'?`${item.prediction.title} — selected by you, not AI verification.`:'Material not confirmed. Review the item before following sorting advice.'}</Text>
      <Text style={s.section}>Why this group?</Text><Text style={s.body}>{explanation}</Text>
      <Text style={s.section}>Disposal route</Text><Text style={s.body}>{item.route.label}. {item.route.reason}</Text>
      <Text style={s.section}>Preparation</Text>
      {instructions.length?instructions.map((line,index)=><Text key={index} style={s.body}>{line}</Text>):<Text style={s.body}>{fallbackPreparation}</Text>}
      {onReview?<CardAction title={`Review item ${number}`} onPress={onReview}/>:null}
      <ScanUpcyclingIdeas key={item.prediction.id} prediction={item.prediction}/>
      <Text style={s.section}>Reuse / recycling options</Text>
      {ideas.length?ideas.map(idea=><View key={idea.id}><Text style={s.body}>{idea.title}</Text>{onOpenGuide?<CardAction title={openingGuide===idea.id?'Opening guide...':`Open guide: ${idea.title}`} disabled={guidesBusy} onPress={()=>onOpenGuide(idea.id)}/>:null}</View>):<>
        <Text style={s.reference}>General reference, not item-specific approval:</Text>
        {recoveryOptions.map((line,index)=><Text key={index} style={s.body}>{line}</Text>)}
        {onReview?<Text style={s.reference}>Use Review item to check whether a reviewed project is available.</Text>:null}
      </>}
      <WasteRecommendations key={item.prediction.id} prediction={item.prediction}/>
      </>:null}
      {onShowPhoto?<CardAction title={`Show item ${number} in photo`} onPress={onShowPhoto}/>:null}
    </View>:null}
  </View>;
}

const s=StyleSheet.create({
  card:{borderWidth:1,borderColor:'#dce9df',borderRadius:18,backgroundColor:'#fff',marginTop:14},selected:{borderColor:'#176b45',borderWidth:2},
  header:{flexDirection:'row',alignItems:'center',gap:12,padding:16,minHeight:88},copy:{flex:1,minWidth:0},
  number:{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center'},numberText:{fontSize:16,fontWeight:'800',color:'#fff'},
  name:{fontSize:19,fontWeight:'700',lineHeight:26,color:'#143f30',flexShrink:1},category:{fontSize:16,fontWeight:'700',lineHeight:23,marginTop:5},status:{fontSize:14,lineHeight:21,color:'#71511b',marginTop:5},
  details:{paddingHorizontal:16,paddingBottom:16,borderTopWidth:1,borderTopColor:'#e1ebe4'},crop:{height:150,width:'100%',backgroundColor:'#edf3ef',marginTop:14,marginBottom:12,borderRadius:10},
  section:{fontSize:17,fontWeight:'700',color:'#143f30',marginTop:16,marginBottom:7},body:{fontSize:16,lineHeight:25,color:'#35483e',marginBottom:8},reference:{fontSize:14,lineHeight:22,color:'#57645d',marginBottom:8},
  action:{minHeight:48,justifyContent:'center',borderWidth:1,borderColor:'#176b45',borderRadius:12,padding:12,marginTop:10},actionText:{fontSize:16,lineHeight:23,color:'#176b45',fontWeight:'700',textAlign:'center'},disabled:{opacity:.5},
});
