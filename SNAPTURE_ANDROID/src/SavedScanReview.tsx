import React, { useEffect, useState } from 'react';
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import { getSavedScan, imageUrl, type Prediction, type ScanScene } from './api';
import SceneResults from './SceneResults';
import WasteRecommendations from './WasteRecommendations';

/** Read-only history: load by the selected ID, never reuse the last camera URI. */
export default function SavedScanReview({id,onBack,onRetry,onBrowseIdeas,onOpenGuide}:{id:number;onBack:()=>void;onRetry:()=>void;onBrowseIdeas?:()=>void;onOpenGuide?:(prediction:Prediction,id:string)=>Promise<void>}) {
  const [result,setResult]=useState<{prediction:Prediction;scene:ScanScene|null}|null>(null);
  const [error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  const [expanded,setExpanded]=useState(false);
  const [photoError,setPhotoError]=useState(false);
  useEffect(()=>{
    let active=true;setResult(null);setError('');setPhotoError(false);setExpanded(false);
    getSavedScan(id).then(value=>{if(active)setResult(value);}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Unable to open this saved scan.');});
    return ()=>{active=false;};
  },[id,attempt]);
  useEffect(()=>{
    const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{onBack();return true;});
    return ()=>subscription.remove();
  },[onBack]);
  if(result?.scene)return <SceneResults key={result.scene.id} initial={result.scene} historical selectedPredictionId={result.prediction.id} onBack={onBack} onRetry={onRetry} onBrowseIdeas={onBrowseIdeas} onOpenGuide={onOpenGuide}/>;
  const prediction=result?.prediction;
  const assessment=prediction?.assessment;
  const photo=prediction?.original_image_url || prediction?.image_url;
  return <ScrollView contentContainerStyle={s.page}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to scan history" style={s.action} onPress={onBack}><Text style={s.link}>Back to scan history</Text></Pressable>
    <Text style={s.title}>Saved scan</Text>
    {error?<><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry saved scan" style={s.action} onPress={()=>setAttempt(value=>value+1)}><Text style={s.link}>Try again</Text></Pressable></>:null}
    {!prediction && !error?<Text style={s.body}>Loading saved scan...</Text>:null}
    {prediction?<>
      <Text style={s.body}>{new Date(prediction.created_at).toLocaleString()}</Text>
      <Text style={s.body}>Saved result · viewing this scan does not run detection again.</Text>
      {photo && !photoError?<Image accessibilityLabel="Original scanned photo" source={{uri:imageUrl(photo)}} onError={()=>setPhotoError(true)} style={s.photo} resizeMode="contain"/>:<View style={s.card}><Text style={s.body}>{prediction.input_method==='manual'?'This was a no-photo assessment. No photo was saved.':'The original photo is unavailable. Its file may be missing or the image service may be offline. The saved result is still available below.'}</Text></View>}
      <View style={s.card}>
        <Pressable accessibilityRole="button" accessibilityLabel="Expand saved item details" accessibilityState={{expanded}} onPress={()=>setExpanded(value=>!value)} style={s.header}>
          <View style={s.copy}><Text style={s.name}>{prediction.title}</Text><Text style={s.category}>{assessment?.segregation.category || 'No saved bin assignment'}</Text></View>
          {expanded?<ChevronUp size={24} color="#176b45"/>:<ChevronDown size={24} color="#176b45"/>}
        </Pressable>
        {expanded?<View style={s.details}>
          <Text style={s.body}>{prediction.input_method==='manual'?'User-selected material, not AI verification':`${Math.round(prediction.confidence*100)}% saved model confidence`}</Text>
          {assessment?<><Text style={s.body}>{assessment.segregation.explanation}</Text>{assessment.segregation.instructions.map((line,index)=><Text key={index} style={s.body}>{line}</Text>)}{prediction.recommendation_choices.map(idea=><Text key={idea.id} style={s.body}>{idea.title}</Text>)}</>:<Text style={s.body}>No assessment snapshot was saved for this older item. Its original model result is shown without generating new sorting advice.</Text>}
          <WasteRecommendations key={prediction.id} prediction={prediction}/>
        </View>:null}
      </View>
    </>:null}
    {onBrowseIdeas?<Pressable accessibilityRole="button" accessibilityLabel="Browse general reuse ideas" style={s.action} onPress={onBrowseIdeas}><Text style={s.link}>Browse general reuse ideas</Text></Pressable>:null}
  </ScrollView>;
}
const s=StyleSheet.create({
  page:{flexGrow:1,padding:20,paddingBottom:45,backgroundColor:'#f7f9f5'},title:{fontSize:27,fontWeight:'800',color:'#143f30',marginVertical:12},body:{fontSize:16,lineHeight:25,color:'#35483e',marginBottom:10},
  action:{minHeight:48,justifyContent:'center'},link:{fontSize:16,fontWeight:'700',color:'#176b45'},error:{fontSize:16,color:'#a12020'},photo:{width:'100%',height:300,backgroundColor:'#dae5df',borderRadius:16,marginVertical:14},
  card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#dce9df',borderRadius:18,padding:16,marginTop:14},header:{minHeight:56,flexDirection:'row',alignItems:'center',gap:12},copy:{flex:1,minWidth:0},name:{fontSize:19,lineHeight:26,fontWeight:'700',color:'#143f30'},category:{fontSize:16,lineHeight:23,color:'#176b45',marginTop:5},details:{marginTop:16},
});
