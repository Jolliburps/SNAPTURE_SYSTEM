import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { preparePrivatePreview } from './api';

export default function PrivatePhotoPreview({uri,onBusyChange}:{uri:string|null;onBusyChange:(busy:boolean)=>void}) {
  const [preview,setPreview]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(true);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;setPreview('');setError('');setBusy(true);onBusyChange(true);
    if(!uri){setBusy(false);onBusyChange(false);return;}
    preparePrivatePreview(uri).then(result=>{
      if(!active)return;
      if(!result.preview_uri?.startsWith('data:image/jpeg;base64,'))throw new Error('No privacy-processed preview was returned.');
      setPreview(result.preview_uri);
    }).catch(()=>{if(active)setError('The photo cannot yet be displayed safely. Retry the privacy check, or analyze without a photo preview.');})
      .finally(()=>{if(active){setBusy(false);onBusyChange(false);}});
    return ()=>{active=false;};
  },[uri,attempt,onBusyChange]);
  return <View>
    <View style={s.photo}>{preview?<Image accessibilityLabel="Privacy-processed photo preview" source={{uri:preview}} resizeMode="contain" style={s.image} onError={()=>{setPreview('');setError('The protected preview could not be displayed. Retry the privacy check.');}}/>:<Text accessibilityLiveRegion="polite" style={s.message}>{busy?'Protecting photo privacy...':'Photo preview hidden for privacy.'}</Text>}</View>
    {error?<><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry photo privacy" disabled={busy} onPress={()=>{onBusyChange(true);setAttempt(value=>value+1);}} style={s.retry}><Text style={s.link}>Retry privacy check</Text></Pressable></>:null}
    <Text style={s.note}>Detected faces are blurred locally before display. Face detection may miss faces; check the preview and retake if needed.</Text>
  </View>;
}
const s=StyleSheet.create({photo:{height:230,borderRadius:18,overflow:'hidden',backgroundColor:'#e5eee8',alignItems:'center',justifyContent:'center'},image:{width:'100%',height:'100%'},message:{padding:20,fontSize:16,lineHeight:24,color:'#35483e',textAlign:'center'},error:{fontSize:14,lineHeight:22,color:'#a12020',marginTop:10},retry:{minHeight:48,justifyContent:'center'},link:{color:'#176b45',fontWeight:'700',fontSize:16},note:{fontSize:13,lineHeight:20,color:'#57645d',marginVertical:10}});
