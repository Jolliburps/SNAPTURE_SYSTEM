import React, {useState} from 'react';
import {Image,StyleSheet,View} from 'react-native';
import type {CaptureFrame} from './api';

/** A centered square in the actual center-cover preview, not the whole screen. */
export function cameraGuideFrame(width:number,height:number):CaptureFrame|undefined {
  if(!Number.isFinite(width) || !Number.isFinite(height) || width<=0 || height<=0)return undefined;
  const side=Math.min(width,height)*.8;
  return {aspect:width/height,x:(width-side)/(2*width),y:(height-side)/(2*height),width:side/width,height:side/height};
}

export const GALLERY_FRAME:CaptureFrame={aspect:1,x:0,y:0,width:1,height:1};

export function FramedPhotoPreview({uri,frame}:{uri:string;frame:CaptureFrame}) {
  const [availableWidth,setAvailableWidth]=useState(280);
  const height=Math.min(280,availableWidth/frame.aspect);
  return <View style={s.reviewOuter} onLayout={event=>{if(event.nativeEvent.layout.width>0)setAvailableWidth(event.nativeEvent.layout.width);}}>
    <View style={[s.reviewInner,{height,width:height*frame.aspect}]}>
      <Image accessibilityLabel="Your captured photo" source={{uri}} style={StyleSheet.absoluteFill} resizeMode="cover"/>
      <CaptureGuide frame={frame}/>
    </View>
  </View>;
}

/** Overlay and uploaded crop use exactly the same normalized rectangle. */
export default function CaptureGuide({frame}:{frame:CaptureFrame}) {
  const left=`${frame.x*100}%` as const,top=`${frame.y*100}%` as const;
  const width=`${frame.width*100}%` as const,height=`${frame.height*100}%` as const;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityLabel="Single-item scan border">
    <View style={[s.shade,s.topShade,{height:top}]}/>
    <View style={[s.shade,s.bottomShade,{top:`${(frame.y+frame.height)*100}%`}]}/>
    <View style={[s.shade,s.leftShade,{top,width:left,height}]}/>
    <View style={[s.shade,s.rightShade,{left:`${(frame.x+frame.width)*100}%`,top,height}]}/>
    <View style={[s.border,{left,top,width,height}]}/>
  </View>;
}
const s=StyleSheet.create({
  reviewOuter:{width:'100%',alignItems:'center'},reviewInner:{overflow:'hidden',backgroundColor:'#000'},
  shade:{position:'absolute',backgroundColor:'#0008'},topShade:{left:0,right:0,top:0},bottomShade:{left:0,right:0,bottom:0},leftShade:{left:0},rightShade:{right:0},
  border:{position:'absolute',borderWidth:2,borderColor:'#c4f4d7'},
});
