import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from './PublicText';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import { getSavedScan, imageUrl, type Prediction, type ScanScene } from './api';
import SceneResults from './SceneResults';
import AssessmentScreen from './AssessmentScreen';
import ScreeningOutcome from './ScreeningOutcome';
import ScanResult from './ScanResult';
import { materialCategoryName } from './detectionPresentation';

/** Opening history is read-only; item review explicitly saves to its own ID. */
export default function SavedScanReview({id,onBack,onRetry,onOpenGuide,onProceed,resumeReview}:{resumeReview?:Prediction;onProceed?:(prediction:Prediction)=>void;id:number;onBack:()=>void;onRetry:()=>void;onOpenGuide?:(prediction:Prediction,id:string)=>Promise<void>}) {
  const [result,setResult]=useState<{prediction:Prediction;scene:ScanScene|null}|null>(null);
  const [error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  const [expanded,setExpanded]=useState(false);
  const [photoError,setPhotoError]=useState(false);
  const [reviewing,setReviewing]=useState<Prediction|null>(resumeReview || null);
  const resumeUsed=useRef(false);
  const [reviewStartInCheck,setReviewStartInCheck]=useState(!resumeReview);
  const openReview=(value:Prediction)=>{setReviewStartInCheck(true);setReviewing(value);};
  const closeReview=()=>{setReviewing(null);setAttempt(value=>value+1);};
  useEffect(()=>{
    let active=true;setResult(null);setError('');setPhotoError(false);setExpanded(false);setReviewing(resumeUsed.current?null:resumeReview || null);resumeUsed.current=true;
    getSavedScan(id).then(value=>{if(active)setResult(value);}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Unable to open this saved scan.');});
    return ()=>{active=false;};
  },[id,attempt]);
  useEffect(()=>{
    const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{if(reviewing)closeReview();else onBack();return true;});
    return ()=>subscription.remove();
  },[onBack,reviewing]);
  if(reviewing)return <AssessmentScreen onProceed={onProceed} startInCheck={reviewStartInCheck} prediction={reviewing} onChange={setReviewing} onBack={closeReview} onSaved={closeReview} onRetry={onRetry}/>;
  if(result?.prediction.scan_snapshot_available)return <ScanResult prediction={result.prediction} historical onBack={onBack} onRetry={onRetry}/>;
  if(result?.scene)return <SceneResults key={result.scene.id} initial={result.scene} historical onProceed={onProceed} selectedPredictionId={result.prediction.id} onBack={onBack} onRetry={onRetry} onReview={openReview} onOpenGuide={onOpenGuide}/>;
  const prediction=result?.prediction;
  const assessment=prediction?.assessment;
  const photo=prediction?.original_image_url || prediction?.image_url;
  return <ScrollView contentContainerStyle={s.page}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to scan history" style={s.back} onPress={onBack}><ChevronLeft size={22} color="#176b45"/><Text style={s.backText}>Back</Text></Pressable>
    <Text style={s.title}>Saved scan</Text>
    {error?<><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry saved scan" style={s.action} onPress={()=>setAttempt(value=>value+1)}><Text style={s.link}>Try again</Text></Pressable></>:null}
    {!prediction && !error?<Text style={s.body}>Loading saved scan...</Text>:null}
    {prediction?<>
      <Text style={s.body}>{new Date(prediction.created_at).toLocaleString()}</Text>
      <Text style={s.body}>Saved result · viewing this scan does not run detection again.</Text>
      {photo && !photoError?<Image accessibilityLabel="Original scanned photo" source={{uri:imageUrl(photo)}} onError={()=>setPhotoError(true)} style={s.photo} resizeMode="contain"/>:<View style={s.card}><Text style={s.body}>{prediction.input_method==='manual'?'This was a no-photo assessment. No photo was saved.':'The original photo is unavailable. Its file may be missing or the image service may be offline. The saved result is still available below.'}</Text></View>}
      <View style={s.card}>
        <Pressable accessibilityRole="button" accessibilityLabel="Expand saved item details" accessibilityState={{expanded}} onPress={()=>setExpanded(value=>!value)} style={s.header}>
          <View style={s.copy}><Text style={s.name}>{materialCategoryName(prediction)}</Text><Text style={s.category}>{assessment?.segregation.category || 'No saved bin assignment'}</Text></View>
          {expanded?<ChevronUp size={24} color="#176b45"/>:<ChevronDown size={24} color="#176b45"/>}
        </Pressable>
        {expanded?<View style={s.details}>
          <Text style={s.body}>{prediction.input_method==='manual'?'User-selected material, not AI verification':`${Math.round(prediction.confidence*100)}% saved model confidence`}</Text>
          {assessment?<><Text style={s.body}>{assessment.segregation.explanation}</Text>{assessment.segregation.instructions.map((line,index)=><Text key={index} style={s.body}>{line}</Text>)}</>:<Text style={s.body}>No assessment snapshot was saved for this older item. Its original model result is shown without generating new sorting advice.</Text>}
        </View>:null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Review saved item for recommendations" style={s.action} onPress={()=>openReview(prediction)}><Text style={s.link}>Check item details and recommendations</Text></Pressable>
      <ScreeningOutcome prediction={prediction}/>
    </>:null}
  </ScrollView>;
}
const s=StyleSheet.create({
  back:{alignSelf:'flex-start',minHeight:48,flexDirection:'row',alignItems:'center',gap:4,paddingRight:16,marginBottom:8},backText:{fontSize:16,fontWeight:'600',color:'#176b45'},
  page:{flexGrow:1,padding:20,paddingBottom:45,backgroundColor:'#f7f9f5'},title:{fontSize:27,fontWeight:'800',color:'#143f30',marginVertical:12},body:{fontSize:16,lineHeight:25,color:'#35483e',marginBottom:10},
  action:{minHeight:52,justifyContent:'center',alignItems:'center',borderWidth:2,borderColor:'#176b45',borderRadius:12,paddingHorizontal:16,paddingVertical:12,marginTop:16,backgroundColor:'#fff'},link:{fontSize:16,fontWeight:'700',color:'#176b45',textAlign:'center'},error:{fontSize:16,color:'#a12020'},photo:{width:'90%',alignSelf:'center',height:220,backgroundColor:'#eef3ec',borderRadius:16,marginTop:18,marginBottom:26},
  card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#dce9df',borderRadius:18,padding:16,marginTop:14},header:{minHeight:56,flexDirection:'row',alignItems:'center',gap:12},copy:{flex:1,minWidth:0},name:{fontSize:19,lineHeight:26,fontWeight:'700',color:'#143f30'},category:{fontSize:16,lineHeight:23,color:'#176b45',marginTop:5},details:{marginTop:16},
});
