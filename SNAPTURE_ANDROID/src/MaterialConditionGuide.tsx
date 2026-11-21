import React from 'react';
import {Image,Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import type {MaterialGuide} from './api';
import sources from './assets/material-examples/sources.json';

export const MATERIAL_EXAMPLE_PHOTOS:Record<string,number>={
  pete_bottles:require('./assets/material-examples/pete_bottles.jpg'),
  hdpe_containers:require('./assets/material-examples/hdpe_containers.jpg'),
  cardboard:require('./assets/material-examples/cardboard.jpg'),
  paper:require('./assets/material-examples/paper.jpg'),
  fabric_scraps:require('./assets/material-examples/fabric_scraps.jpg'),
  coconut_shells:require('./assets/material-examples/coconut_shells.jpg'),
  dry_untreated_wood_scraps:require('./assets/material-examples/dry_untreated_wood_scraps.jpg'),
};
const GUIDES:Record<string,{checks:string;prepare:string;limit:string}>={
  pete_bottles:{checks:'Confirm the PET/PETE code 1 marking and previous contents. Check cleanliness, cracks, deformation and usable shape.',prepare:'For a known food or beverage bottle, empty remaining contents, remove ordinary residue and let it dry. Confirm the condition again before choosing a project.',limit:'Chemical or unknown contents require separate assessment. A damaged bottle needs a project that explicitly accepts that damage; it is not automatically suitable.'},
  hdpe_containers:{checks:'Confirm the HDPE code 2 marking and original contents. Check residue, cracks and usable shape.',prepare:'Confirm the container history before cleaning. Follow the applicable item assessment; do not empty or rinse unknown chemical contents.',limit:'A shampoo or detergent container can illustrate this category without being eligible for household upcycling. The current project flow excludes known chemical or cleaning-product containers.'},
  cardboard:{checks:'Check wetness, mold, contamination, strength and the size of usable portions.',prepare:'Keep known uncontaminated cardboard dry. Check tape, coatings and attachments against the selected project requirements. Do not soak it.',limit:'Wet cardboard needs reassessment before a project can be cleared. Drying alone does not establish suitability. Mold or contamination excludes household projects. Torn pieces may fit projects accepting their remaining size and strength.'},
  paper:{checks:'Check dryness, contamination, coatings and the size of usable portions.',prepare:'Keep known uncontaminated paper dry. Check attachments and coatings against the project requirements; do not wash paper.',limit:'Wet or uncertain material needs assessment. Mold or contamination excludes household projects. Torn paper is usable only when the selected project accepts it.'},
  fabric_scraps:{checks:'Check cleanliness, dryness, contamination, attachments and usable size.',prepare:'For known uncontaminated washable fabric, follow its care label and dry it fully. Check for pins and sharp attachments before handling.',limit:'Mold or chemical contamination excludes household projects. The usable size and fabric properties must fit the selected project.'},
  coconut_shells:{checks:'Check remaining flesh, dryness, contamination, cracks and usable shell portions.',prepare:'For known uncontaminated shells, remove remaining flesh, clean and dry them. Follow the project safety instructions for sharp edges.',limit:'The reference photo shows halves before preparation. A cracked shell needs a project that accepts its remaining portions; its category alone does not qualify it.'},
  dry_untreated_wood_scraps:{checks:'Confirm untreated history and check moisture, paint, mold, hardware and usable condition.',prepare:'Keep unknown, painted or treated wood separate. Confirm the material history and applicable project instructions before cutting, sanding or removing hardware.',limit:'Appearance cannot establish treatment history. The current household project flow excludes treated, painted, moldy or hardware-containing wood.'},
};

export default function MaterialConditionGuide({guide}:{guide:MaterialGuide}){
  const content=GUIDES[guide.label],photo=MATERIAL_EXAMPLE_PHOTOS[guide.label],credit=sources.find(row=>row.label===guide.label);
  if(!content)return null;
  return <>
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>Common examples</Text>
      {photo?<Image source={photo} resizeMode="contain" accessibilityLabel={`${guide.title}: common example reference`} style={s.photo}/>:null}
      {credit?<Text style={s.caption}>{credit.caption}</Text>:null}
      {guide.examples.map(example=><Text key={example} style={s.body}>{'• '}{example}</Text>)}
      <Text style={s.note}>Reference examples only. Appearance does not confirm resin type, previous contents, treatment history or upcycling suitability.</Text>
      {credit?<Pressable accessibilityRole="link" accessibilityLabel={`Photo source for ${guide.title}`} onPress={()=>Linking.openURL(credit.source)} style={s.credit}><Text style={s.link}>Photo source: Pexels · Pexels License</Text></Pressable>:null}
    </View>
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>Condition requirements</Text>
      <Text style={s.body}>{content.checks}</Text>
      <Text style={s.subheading}>Check before upcycling</Text>
      <Text style={s.body}>{content.limit}</Text>
      <Text style={s.note}>Final suitability depends on the selected project's sourced requirements, including usable dimensions and quantity. AI confidence is not an upcycling eligibility percentage. This guide does not establish a numerical damage or moisture cutoff.</Text>
    </View>
    <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Preparation</Text><Text style={s.body}>{content.prepare}</Text><Text style={s.note}>Preparation is not approval. Scan the item and resolve missing condition details before starting a project.</Text></View>
  </>;
}
const s=StyleSheet.create({card:{padding:18,borderRadius:18,borderWidth:1,borderColor:'#dce9df',backgroundColor:'#fff',marginBottom:16},heading:{fontSize:18,lineHeight:25,fontWeight:'700',color:'#143f30',marginBottom:12},subheading:{fontSize:15,lineHeight:22,fontWeight:'700',color:'#143f30',marginTop:8,marginBottom:8},body:{fontSize:14,lineHeight:22,color:'#35483e',marginBottom:8},note:{fontSize:13,lineHeight:21,color:'#63756a',marginTop:8},photo:{height:190,width:'100%',borderRadius:12,backgroundColor:'#f2f6f1',marginBottom:12},caption:{fontSize:13,lineHeight:20,color:'#42584b',marginBottom:10},credit:{minHeight:44,justifyContent:'center'},link:{fontSize:12,lineHeight:19,color:'#176b45'}});
