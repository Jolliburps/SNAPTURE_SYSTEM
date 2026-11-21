import React, {useState} from 'react';
import {ActivityIndicator, Image, Linking, StyleSheet, View} from 'react-native';
import Text from './PublicText';
import {publicFileUrl, type TutorialPhoto as Photo, type TutorialPhotos} from './api';

function PhotoView({photo,label,compact=false}:{photo:Photo;label:string;compact?:boolean}) {
  const [loading,setLoading]=useState(true);
  const [failed,setFailed]=useState(false);
  const uri=photo.url?publicFileUrl(photo.url):'';
  return <View>
    {uri && !failed?<>
      <Image accessibilityLabel={label} source={{uri}} resizeMode="contain" style={compact?s.thumbnail:s.image}
        onLoad={()=>setLoading(false)} onError={()=>{setFailed(true);setLoading(false);}}/>
      {loading?<View accessibilityLiveRegion="polite"><ActivityIndicator color="#176b45"/><Text style={s.note}>Loading reference photo...</Text></View>:null}
    </>:<Text style={s.note}>Reference photo unavailable. Follow the text instruction.</Text>}
    {photo.visual_note?<Text style={s.note}>{photo.visual_note}</Text>:null}
  </View>;
}

export default function TutorialPhoto({photo,label,compact=false}:{photo?:Photo;label:string;compact?:boolean}) {
  return photo?<PhotoView key={`${photo.url}:${photo.source_stage}:${photo.step_index}`} photo={photo} label={label} compact={compact}/>:null;
}

export function PhotoCredits({photos}:{photos?:TutorialPhotos}) {
  const [linkError,setLinkError]=useState(false);
  if(!photos)return null;
  return <View>
    <Text selectable style={s.note}>Photo reference: {photos.credit}. {photos.photo_rights}.</Text>
    <Text selectable accessibilityRole="link" style={s.note} onPress={()=>{Linking.openURL(photos.source_url).catch(()=>setLinkError(true));}}>{photos.source_url}</Text>
    {linkError?<Text style={s.note}>Unable to open the source. You can copy the link above.</Text>:null}
  </View>;
}

const s=StyleSheet.create({image:{width:'100%',height:200,marginVertical:10},thumbnail:{width:'100%',height:84},note:{fontSize:14,lineHeight:22,color:'#57645d',marginVertical:8}});
