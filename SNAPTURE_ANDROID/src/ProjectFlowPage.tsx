import React,{useEffect} from 'react';
import {BackHandler,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import X from 'lucide-react-native/icons/x';

/** Fixed navigation above a bounded viewport; long content grows, not the page. */
export default function ProjectFlowPage({title,onBack,onClose,backLabel,disabled=false,scroll=false,children}:{
  title:string;onBack:()=>void;onClose:()=>void;backLabel:string;disabled?:boolean;scroll?:boolean;children:React.ReactNode;
}) {
  useEffect(()=>{
    const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{if(!disabled)onBack();return true;});
    return()=>subscription.remove();
  },[onBack,disabled]);
  return <View testID="project-flow-page" style={s.page}>
    <View testID="project-flow-header" style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={backLabel} disabled={disabled} onPress={onBack} style={[s.icon,disabled && s.disabled]} hitSlop={6}><ArrowLeft size={26} color="#143f30"/></Pressable>
      <Text accessibilityRole="header" style={s.title}>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Close upcycling flow" accessibilityHint="Exit without deleting the project or changing progress" disabled={disabled} onPress={onClose} style={[s.icon,disabled && s.disabled]} hitSlop={6}><X size={26} color="#143f30"/></Pressable>
    </View>
    {scroll?<ScrollView testID="project-ideas-scroll" style={s.viewport} contentContainerStyle={s.content} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">{children}</ScrollView>:<View style={s.viewport}>{children}</View>}
  </View>;
}
const s=StyleSheet.create({page:{flex:1,minHeight:0,backgroundColor:'#f7f9f5'},header:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,paddingVertical:6,borderBottomWidth:1,borderBottomColor:'#dce9df',flexShrink:0},icon:{width:48,height:48,justifyContent:'center',alignItems:'center'},title:{flex:1,minWidth:0,fontSize:19,lineHeight:26,fontWeight:'700',color:'#143f30'},viewport:{flex:1,minHeight:0},content:{flexGrow:1,padding:20,paddingBottom:40},disabled:{opacity:.4}});
