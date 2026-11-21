import React,{useEffect,useState} from 'react';
import {Image,Pressable,ScrollView,StyleSheet,View} from 'react-native';
import Text from './PublicText';
import ShieldAlert from 'lucide-react-native/icons/shield-alert';
import Trash from 'lucide-react-native/icons/trash';
import Recycle from 'lucide-react-native/icons/recycle';
import {imageUrl,type Prediction} from './api';
import {upcyclingRequest,type Suggestions,type VisualAssessment} from './upcyclingApi';
import {Action,PrivatePhoto,Badge,ScreenHeader,u} from './UpcyclingUI';
import SuitabilityProjects from './SuitabilityProjects';
import {MATERIAL_NAMES,SCAN_MATERIAL_ICONS,SCAN_MATERIAL_NAMES,materialReview} from './detectionPresentation';

export type ResultSnapshot={prediction:Prediction;classification:{kind:string;reason:string;next_action?:string};object:string;photos:Array<{view:string;image_url:string|null}>;visual:VisualAssessment;suggestions:Suggestions};
export default function ScanResult({prediction,historical=false,onBack,onRetry,onChange}:{prediction:Prediction;historical?:boolean;onBack:()=>void;onRetry:()=>void;onChange?:(p:Prediction)=>void}){
  const [snapshot,setSnapshot]=useState<ResultSnapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[index,setIndex]=useState(0),[attempt,setAttempt]=useState(0),[photoError,setPhotoError]=useState(false);
  const [currentMatches,setCurrentMatches]=useState(false);
  useEffect(()=>{let active=true;setLoading(true);setError('');upcyclingRequest<{snapshot:ResultSnapshot|null}>(`predictions/${prediction.id}/result/`).then(r=>{if(active)setSnapshot(r.snapshot);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[prediction.id,attempt]);
  const p=historical?(snapshot?.prediction || prediction):prediction;
  const currentHazard=prediction.waste_identifier?.category==='C' || prediction.previous_contents==='Chemical or cleaning product';
  const kind=(!historical && currentHazard?'hazardous':null) || snapshot?.classification.kind ||
    (p.waste_identifier?.category==='C'?'hazardous':p.recognition?.status!=='supported'?'unsupported':'supported');
  const displayKind=kind==='supported' && !(p.decision in MATERIAL_NAMES)?'unsupported':kind;
  const canCheckCurrent=historical && displayKind==='supported' && snapshot?.visual?.scan_details?.condition_policy==='inspection-first-v1';
  const showSavedMatches=historical && !currentMatches;
  const review=materialReview(p);
  const guidedPhotos=!!snapshot?.visual?.scan_details?.capture_mode;
  const matches=snapshot?.suggestions;
  const outcomeTitle=matches?.items.length?'Upcycling recommendations':
    matches?.verdict?.code==='no_suitable_project'?'No matching upcycling project':'Item needs a closer check';
  const retryLabel=!historical && displayKind==='unsupported' && review.retake?'Retake scan':'Scan another item';
  const photos=snapshot?.photos || [{view:'front',image_url:p.original_image_url || p.image_url}];
  const photo=photos[index] || photos[0];
  return <ScrollView contentContainerStyle={[u.page,s.page]} showsVerticalScrollIndicator={false}>
    <ScreenHeader backLabel="Back" backAccessibilityLabel={historical?'Back to scan history':'Back from scan result'} onBack={onBack}/>
    <Text accessibilityRole="header" style={s.title}>{displayKind==='hazardous'?'HAZARDOUS WASTE':displayKind==='disposal'?'For disposal or recycling':displayKind==='unsupported'?review.title:guidedPhotos?outcomeTitle:historical?'Your saved item':'Your scanned item'}</Text>
    {historical?<Text style={u.small}>Saved on {new Date(p.created_at).toLocaleString()} - no new detection</Text>:null}
    {loading?<Text style={u.small}>Loading saved assessment...</Text>:null}
    {error?<><Text style={u.error}>{error}</Text><Action title="Retry scan result" onPress={()=>setAttempt(v=>v+1)}/></>:null}
    {displayKind==='hazardous'?<View style={[u.card,{backgroundColor:'#fff1e8',borderColor:'#edc5a8'}]}><ShieldAlert size={32} color="#a33e21"/><Text style={[u.heading,{color:'#a33e21'}]}>Keep this item separate</Text><Text style={u.body}>{snapshot?.classification.reason || 'This item requires special handling.'}</Text><Text style={u.body}>{snapshot?.classification.next_action || 'Ask your barangay or CESD how to handle this item.'}</Text><Text style={u.body}>This item is not eligible for upcycling.</Text></View>:null}
    {displayKind==='disposal'?<View style={u.card}><Trash size={30} color="#725124"/><Text style={u.body}>{snapshot?.classification.reason}</Text><Text style={u.body}>{snapshot?.classification.next_action}</Text></View>:null}
    <View style={s.photoCard}>
      {photo?.image_url && !photoError?(photo.image_url.startsWith('/api/upcycling/')?<PrivatePhoto path={photo.image_url} label="Original scanned photo"/>:<Image accessibilityLabel="Original scanned photo" source={{uri:imageUrl(photo.image_url)}} onError={()=>setPhotoError(true)} resizeMode="contain" style={s.photo}/>):<View style={{height:160,justifyContent:'center',alignItems:'center'}}><Text style={u.small}>Photo unavailable. Your saved result is still here.</Text></View>}
      <View style={s.photoCaption}><Text style={s.caption}>{(photo?.view || 'front').replace(/^./,letter=>letter.toUpperCase())} view</Text><Text style={s.photoCount}>{photos.length>1?`${index+1} of ${photos.length} photos`:'Item photo'}</Text></View>
    </View>
    {photos.length>1?<View style={s.views}>{photos.map((v,i)=><Pressable key={`${v.view}-${i}`} accessibilityRole="button" accessibilityLabel={`Show ${v.view} view`} accessibilityState={{selected:index===i}} onPress={()=>{setIndex(i);setPhotoError(false);}} style={({pressed})=>[s.viewButton,index===i && s.viewSelected,pressed && {opacity:.8}]}><Text style={[s.viewLabel,index===i && s.viewLabelSelected]}>{v.view.replace(/^./,letter=>letter.toUpperCase())}</Text></Pressable>)}</View>:null}
    {displayKind==='unsupported' && !historical?<Text style={u.body}>{snapshot?.classification.reason || review.message}</Text>:null}
    {displayKind==='supported'?<>
      <View style={s.assessment}>{guidedPhotos?<Image source={SCAN_MATERIAL_ICONS[p.decision]} resizeMode="contain" style={{height:52,width:52}}/>:<Badge text={historical?'Saved assessment':'Preliminary material result'}/>}
        <Text style={s.material}>{SCAN_MATERIAL_NAMES[p.decision] || p.title}</Text>
        {guidedPhotos && matches?.items.length?<><Recycle size={22} color="#176b45"/><Text style={u.body}>Open a project to check what you need before you start.</Text></>:null}
        {guidedPhotos && snapshot?.visual.capability?.condition_assessment==='unavailable'?<Text style={u.small}>The condition check uses your inspection answers when automatic photo checks are unavailable.</Text>:null}
      </View>

      {historical && !snapshot?<Text style={u.small}>This older scan has no frozen project suggestions. Its saved assessment is preserved; current catalog results are not substituted.</Text>:null}
    </>:null}
    {canCheckCurrent?<Action title={currentMatches?'Show saved project matches':'Check current project matches'} onPress={()=>setCurrentMatches(value=>!value)}/>:null}
    {!loading && !error && (displayKind==='supported' || (!historical && !guidedPhotos && displayKind==='unsupported'))?<SuitabilityProjects key={`${p.id}:${showSavedMatches}`} primaryView={snapshot?.photos[0]?.view} prediction={showSavedMatches?p:prediction} onChange={onChange} historical={showSavedMatches} saved={showSavedMatches?snapshot || undefined:undefined}/>:null}
    <Action title="Done with scan result" label="Done" variant="primary" onPress={onBack}/>
    <View style={{alignItems:'center'}}><Pressable accessibilityRole="button" accessibilityLabel={retryLabel} onPress={onRetry} style={({pressed})=>({minHeight:48,paddingHorizontal:16,paddingVertical:12,justifyContent:'center',alignItems:'center',opacity:pressed?.7:1})}><Text style={{fontSize:14,lineHeight:21,fontWeight:'700',color:'#176b45',textAlign:'center'}}>{retryLabel}</Text></Pressable></View>
  </ScrollView>;
}

const s=StyleSheet.create({
  page:{paddingTop:8},title:{fontSize:24,lineHeight:31,fontWeight:'800',color:'#143f30',marginBottom:14},
  photoCard:{padding:12,backgroundColor:'#fff',borderRadius:20,marginTop:4,marginBottom:12,borderWidth:1,borderColor:'#dce9df'},
  photo:{width:'100%',height:220,borderRadius:12,backgroundColor:'#f0f4ed'},
  photoCaption:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,paddingHorizontal:2,paddingTop:12,paddingBottom:2},
  caption:{fontSize:13,lineHeight:20,color:'#42584b',fontWeight:'600'},photoCount:{fontSize:12,lineHeight:19,color:'#708178',flexShrink:1},
  views:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:22},
  viewButton:{minHeight:44,paddingHorizontal:14,paddingVertical:10,borderRadius:12,borderWidth:1,borderColor:'#dce9df',backgroundColor:'#fff',justifyContent:'center',alignItems:'center'},
  viewSelected:{backgroundColor:'#176b45',borderColor:'#176b45'},viewLabel:{fontSize:12,lineHeight:19,fontWeight:'600',color:'#4d6454'},viewLabelSelected:{color:'#fff'},
  assessment:{padding:18,backgroundColor:'#fff',borderRadius:18,borderWidth:1,borderColor:'#dce9df',marginTop:4,marginBottom:22},
  material:{fontSize:21,lineHeight:28,fontWeight:'700',color:'#143f30',marginTop:4,marginBottom:8},object:{fontSize:13,lineHeight:21,color:'#63756a'},
});
