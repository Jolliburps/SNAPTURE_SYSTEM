import React,{useEffect,useRef,useState} from 'react';
import {AppState,BackHandler,ScrollView,StyleSheet,View} from 'react-native';
import Text from './PublicText';
import {Camera,useCameraDevice,useCameraPermission,usePhotoOutput} from 'react-native-vision-camera';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import {Action,u} from './UpcyclingUI';
import TutorialPhoto from './TutorialPhoto';
import type {TutorialPhoto as ReferencePhoto} from './api';

export type ScanFeedback={verified:boolean;message:string;unavailable?:boolean};
export default function LiveStepScanner({instruction,referencePhotos=[],available,reason,onFrame,onClose,onCheckingChange}:{instruction:string;referencePhotos?:ReferencePhoto[];available:boolean;reason?:string;onFrame:(uri:string)=>Promise<ScanFeedback>;onClose:()=>void;onCheckingChange?:(checking:boolean)=>void}){
  const device=useCameraDevice('back');
  const {hasPermission,canRequestPermission,requestPermission}=useCameraPermission();
  const output=usePhotoOutput({quality:.8});
  const outputRef=useRef(output),closeRef=useRef(onClose),busyRef=useRef(onCheckingChange);outputRef.current=output;closeRef.current=onClose;busyRef.current=onCheckingChange;
  const [ready,setReady]=useState(false),[running,setRunning]=useState(false),[checking,setChecking]=useState(false),[verified,setVerified]=useState(false),[message,setMessage]=useState('Show the result of this step. Move the camera to reveal the required details.');
  const [foreground,setForeground]=useState(AppState.currentState==='active');
  const [showReference,setShowReference]=useState(false);
  const mounted=useRef(true),inflight=useRef(false),version=useRef(0),callback=useRef(onFrame);
  callback.current=onFrame;
  useEffect(()=>{mounted.current=true;const app=AppState.addEventListener('change',state=>{setForeground(state==='active');if(state!=='active'){version.current++;setRunning(false);}});const back=BackHandler.addEventListener('hardwareBackPress',()=>{if(!inflight.current)closeRef.current();return true;});return()=>{mounted.current=false;version.current++;busyRef.current?.(false);app.remove();back.remove();};},[]);
  useEffect(()=>{if(!hasPermission && canRequestPermission)requestPermission().catch(()=>{if(mounted.current)setMessage('Camera permission is required.');});},[hasPermission,canRequestPermission,requestPermission]);
  useEffect(()=>{
    if(!running || !ready || !foreground || !available || !hasPermission)return;
    const generation=version.current;
    let timer:ReturnType<typeof setTimeout>|undefined,cancelled=false;
    const next=async()=>{
      if(cancelled || inflight.current)return;
      inflight.current=true;setChecking(true);busyRef.current?.(true);
      try{
        const photo=await outputRef.current.capturePhotoToFile({flashMode:'off'},{});
        if(cancelled || !mounted.current || generation!==version.current)return;
        const feedback=await callback.current(photo.filePath);
        if(cancelled || !mounted.current || generation!==version.current)return;
        setMessage(feedback.message);
        if(feedback.verified){setVerified(true);setRunning(false);}
        else if(feedback.unavailable)setRunning(false);
        else timer=setTimeout(next,4000);
      }catch(error){if(mounted.current && !cancelled){setMessage(error instanceof Error?error.message:'Unable to assess this view. Adjust the camera and retry.');setRunning(false);}}
      finally{inflight.current=false;if(mounted.current){setChecking(false);busyRef.current?.(false);}}
    };
    timer=setTimeout(next,800);
    return()=>{cancelled=true;if(timer)clearTimeout(timer);};
  },[running,ready,foreground,available,hasPermission]);
  return <ScrollView style={{flex:1,backgroundColor:'#101a15'}} contentContainerStyle={{padding:16,paddingBottom:28}}>
    <Text style={{color:'#fff',fontSize:22,fontWeight:'700',marginVertical:12}}>Step scan</Text>
    {hasPermission && device?<View style={{height:330,borderRadius:18,overflow:'hidden'}}><Camera style={StyleSheet.absoluteFill} device={device} outputs={[output]} resizeMode="cover" implementationMode="compatible" orientationSource="interface" isActive={foreground} onStarted={()=>setReady(true)} onStopped={()=>setReady(false)} onError={error=>{setMessage(error.message);setRunning(false);}}/></View>:<Text style={{color:'#fff'}}>Camera unavailable. Check camera access in settings.</Text>}
    <View style={[u.sectionHead,{alignItems:'flex-start',marginVertical:12}]}>
      <Text style={{color:'#fff',fontSize:18,flex:1}}>{instruction}</Text>
      {referencePhotos.length?<View style={{width:124,padding:6,backgroundColor:'#f7f9f5',borderRadius:12}}>
        <TutorialPhoto photo={referencePhotos[0]} label="Current step reference photo" compact/>
      </View>:null}
    </View>
    {referencePhotos.length?<Action title="View step reference" label={showReference?'Hide step reference':'Enlarge step reference'}
      expanded={showReference} onPress={()=>setShowReference(visible=>!visible)}/>:null}
    {showReference?<View style={u.card}>{referencePhotos.map((photo,i)=><TutorialPhoto key={photo.url}
      photo={photo} label={`Enlarged step reference photo ${i+1}`}/>)}</View>:null}
    <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:12}}>
      {verified?<CircleCheck color="#9bf5b7" size={24}/>:null}
      <Text accessibilityLiveRegion="polite" style={{color:verified?'#9bf5b7':'#fff',flex:1}}>{!available?reason || 'Unable to verify: an approved checker and published step criteria are required.':checking?'Checking this view...':verified?'Step verified. '+message:message}</Text>
    </View>
    <Text style={{color:'#d4e5d8'}}>Finish the action safely before scanning. Evidence frames are submitted while scanning; this is not continuous video recording or a safety certification.</Text>
    {!verified?<Action title={running?'Pause scanning':'Start scanning'} variant="primary" disabled={!available || !ready || !hasPermission || checking} onPress={()=>setRunning(v=>!v)}/>:null}
    <Action title={verified?'Continue from verified step':'Back to project step'} disabled={checking} onPress={onClose}/>
    {!available?<Text style={u.small}>No successful check is assumed while verification is unavailable.</Text>:null}
  </ScrollView>;
}
