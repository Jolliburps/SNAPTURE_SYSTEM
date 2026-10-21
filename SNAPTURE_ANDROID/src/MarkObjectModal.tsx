import React, { useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { imageUrl } from './api';

export default function MarkObjectModal({ image, width, height, onClose, onSave }: {
  image: string; width: number; height: number; onClose: () => void;
  onSave: (box: number[], requestId: string) => Promise<void>;
}) {
  const [corners, setCorners] = useState<number[][]>([]);
  const [stageWidth, setStageWidth] = useState(280);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef('region_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2));
  const scale = Math.min(stageWidth / width, 330 / height);
  const rect = { x: (stageWidth - width * scale) / 2, y: (330 - height * scale) / 2, width: width * scale, height: height * scale };
  const box = corners.length === 2 ? [Math.min(corners[0][0],corners[1][0]), Math.min(corners[0][1],corners[1][1]), Math.max(corners[0][0],corners[1][0]), Math.max(corners[0][1],corners[1][1])] : null;
  const valid = box && box[2]-box[0] >= .02 && box[3]-box[1] >= .02;
  const save = async () => {
    if (!valid || !box || busy) return;
    setBusy(true); setError('');
    try { await onSave(box, requestId.current); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save this region.'); setBusy(false); }
  };
  return <Modal transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={s.scrim}><View style={s.panel}>
      <Text accessibilityRole="header" style={s.title}>Mark a missed item</Text>
      <Text style={s.body}>Tap two opposite corners around one item. It will be saved as Unidentified, not as an AI detection.</Text>
      <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Mark two corners on the photo" onLayout={event => setStageWidth(event.nativeEvent.layout.width)} onPress={event => {
        const { locationX, locationY } = event.nativeEvent;
        const x = (locationX-rect.x)/rect.width, y = (locationY-rect.y)/rect.height;
        if (x < 0 || x > 1 || y < 0 || y > 1) return;
        setCorners(old => old.length === 2 ? [[x,y]] : [...old,[x,y]]);
        requestId.current = 'region_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
      }} style={s.photo}>
        <Image source={{uri:imageUrl(image)}} resizeMode="contain" style={StyleSheet.absoluteFill} pointerEvents="none" />
        {corners.map(([x,y],index) => <View key={index} pointerEvents="none" style={[s.dot,{left:rect.x+x*rect.width-5,top:rect.y+y*rect.height-5}]} />)}
        {box ? <View pointerEvents="none" style={[s.box,{left:rect.x+box[0]*rect.width,top:rect.y+box[1]*rect.height,width:(box[2]-box[0])*rect.width,height:(box[3]-box[1])*rect.height}]} /> : null}
      </Pressable>
      <Text accessibilityLiveRegion="polite" style={s.body}>{corners.length < 2 ? `${corners.length} of 2 corners marked` : valid ? 'Region ready. Tap again to redraw.' : 'Region too small. Tap to redraw.'}</Text>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Save unidentified region" disabled={!valid || busy} onPress={save} style={[s.save,(!valid || busy) && s.disabled]}><Text style={s.saveText}>{busy ? 'Saving...' : 'Save unidentified region'}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={onClose}><Text style={s.cancel}>Cancel</Text></Pressable>
    </View></View>
  </Modal>;
}
const s = StyleSheet.create({
  scrim: { flex:1, backgroundColor:'#0008', justifyContent:'center', padding:18 }, panel:{backgroundColor:'#fff',borderRadius:20,padding:18},
  title:{fontSize:20,fontWeight:'700',color:'#143f30',marginBottom:8},body:{fontSize:14,lineHeight:20,color:'#35483e',marginBottom:8},
  photo:{height:330,backgroundColor:'#e7ede9',marginVertical:10},box:{position:'absolute',borderWidth:2,borderColor:'#c79020'},dot:{position:'absolute',width:10,height:10,borderRadius:5,backgroundColor:'#c79020'},
  save:{padding:14,borderRadius:12,backgroundColor:'#176b45'},saveText:{color:'#fff',fontWeight:'700',textAlign:'center'},cancel:{color:'#176b45',textAlign:'center',padding:14},disabled:{opacity:.4},error:{color:'#a12020',marginBottom:8},
});
