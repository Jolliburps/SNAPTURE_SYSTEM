import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type Prediction } from './api';

/** Shared by live results and read-only history; never fetches the latest scan. */
export default function WasteRecommendations({prediction}:{prediction:Prediction}) {
  const [sources,setSources]=useState(false);
  const guidance=prediction.assessment?.management_guidance;
  if(!guidance)return null;
  return <View>
    <Text accessibilityRole="header" style={s.title}>Detailed recommendations</Text>
    <Text style={s.note}>{guidance.notice}</Text>
    {guidance.legacy_supplement?<Text style={s.note}>Reference supplement for this older scan, based on its saved material and answers. This was not part of its original assessment.</Text>:null}
    {guidance.sections.map(section=><View key={section.key}>
      <Text accessibilityRole="header" style={s.heading}>{section.title}</Text>
      {section.instructions.map((line,index)=><Text key={index} style={s.body}>{line}</Text>)}
    </View>)}
    <Pressable accessibilityRole="button" accessibilityLabel={`Recommendation sources for scan item ${prediction.id}`} accessibilityState={{expanded:sources}} onPress={()=>setSources(value=>!value)} style={s.action}>
      <Text style={s.link}>{sources?'Hide recommendation sources':'Recommendation sources'}</Text>
    </Pressable>
    {sources?<View><Text style={s.note}>Sources checked {guidance.source_checked_on}. Not verification of current local service availability.</Text>{guidance.sources.map(source=><Text selectable key={source.url} style={s.note}>{source.title}{'\n'}{source.url}</Text>)}</View>:null}
  </View>;
}
const s=StyleSheet.create({
  title:{fontSize:19,lineHeight:26,fontWeight:'700',color:'#143f30',marginTop:18,marginBottom:8},
  heading:{fontSize:17,lineHeight:24,fontWeight:'700',color:'#143f30',marginTop:16,marginBottom:7},
  body:{fontSize:16,lineHeight:25,color:'#35483e',marginBottom:8},note:{fontSize:14,lineHeight:22,color:'#57645d',marginBottom:8},
  action:{minHeight:48,justifyContent:'center',paddingVertical:12},link:{fontSize:16,lineHeight:23,fontWeight:'700',color:'#176b45'},
});
