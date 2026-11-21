import React,{useRef,useState} from 'react';
import {BackHandler,Image,Keyboard,Modal,ScrollView,Text,View,type ScrollViewInstance} from 'react-native';
import Recycle from 'lucide-react-native/icons/recycle';
import ShieldAlert from 'lucide-react-native/icons/shield-alert';
import Camera from 'lucide-react-native/icons/camera';
import Check from 'lucide-react-native/icons/check';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import {createScene,previewScanMaterial,type CaptureFrame,type MaterialPreview,type OutsideItemView,type ReportedConcern,type ScanDetails,type ScanScene} from './api';
import {SCAN_MATERIAL_ICONS,SCAN_MATERIAL_NAMES} from './detectionPresentation';
import {GALLERY_FRAME} from './CaptureGuide';
import {Action,Chip,Field,ScreenHeader,u} from './UpcyclingUI';
import {MATERIAL_EXAMPLE_PHOTOS} from './MaterialConditionGuide';

function MaterialScores({preview}:{preview:MaterialPreview|null}){
  const scores=preview?.crop_scores;
  if(!scores?.length)return null;
  return <View style={{marginTop:12}}>
    <Text style={u.heading}>Possible material categories</Text>
    <Text style={u.fieldLabel}>Outlined region</Text>
    {scores.map(({label,score})=><View key={label} style={{flexDirection:'row',justifyContent:'space-between',gap:12}}>
      <Text style={[u.body,{flex:1}]}>{SCAN_MATERIAL_NAMES[label] || label}</Text><Text style={u.body}>{`${(score*100).toFixed(1)}%`}</Text>
    </View>)}
    <Text style={u.small}>These scores describe the outlined region. Follow the result above to continue.</Text>
  </View>;
}

function PlasticCodeExample({code,label}:{code:'1'|'2';label:string}){
  return <View accessible accessibilityRole="image" accessibilityLabel={`Example plastic code ${code} for ${label}`}
    style={[u.buttonSlot,{alignItems:'center',backgroundColor:'#edf3e9',borderRadius:12,padding:8}]}>
    <View style={{width:64,height:64,alignItems:'center'}}>
      <Recycle size={64} color="#143f30" strokeWidth={1.6}/>
      <Text allowFontScaling={false} style={{position:'absolute',top:23,fontSize:18,lineHeight:20,fontWeight:'800',color:'#143f30'}}>{code}</Text>
    </View>
    <Text style={[u.small,{marginBottom:0,textAlign:'center'}]}>{label}</Text>
  </View>;
}

type Photo={uri:string;frame:CaptureFrame};
const VIEW_GUIDES:Record<OutsideItemView,{name:string;hint:string}>={
  back:{name:'Back',hint:'Show the opposite face of the same item or group.'},
  left:{name:'Left side',hint:'Show the left edge or side from the front position.'},
  right:{name:'Right side',hint:'Show the opposite edge or side.'},
  side:{name:'Edge',hint:'Show an edge so cracks, tears or bends are visible.'},
  top:{name:'Top',hint:'Show the top and the area around the opening.'},
  bottom:{name:'Bottom',hint:'Show the base. For plastic, include the recycling number if visible.'},
};
const LEGACY_VIEWS:OutsideItemView[]=['back','left','right','top','bottom'];
const INSIDE_HINT='If the container is already open, aim at the inside walls and base. Skip this photo if you can’t see inside safely. Do not open a sealed or unknown container just for a photo.';
type ItemView=OutsideItemView|'inside';
const EXPOSURES=['No chemical contact known','Water or beverage','Food or oil','Chemical or cleaning product','Other / unknown'];
const MOISTURE_CAUSES=['Water','Oil','Chemical','Unknown'];
const CONCERNS:ReadonlyArray<{value:ReportedConcern;label:string}>=[
  {value:'minor_damage',label:'Slightly torn or creased, clean and dry'},
  {value:'dirt',label:'Ordinary removable dirt'},
  {value:'wet',label:'Damp or wet area'},
  {value:'contamination',label:'Suspected mold, oil or chemical residue'},
  {value:'unknown',label:'Unidentified stain, damage, or other concern'},
];
const SIZE_GUIDANCE:Record<string,{label:string;example:string}>= {
  pete_bottles:{label:'Bottle capacity',example:'e.g. 500 mL'},
  hdpe_containers:{label:'Container capacity',example:'e.g. 1 L'},
  paper:{label:'Paper size',example:'e.g. A4 or 15 × 10 cm'},
  cardboard:{label:'Approximate size',example:'Length × width, e.g. 20 × 10 cm'},
  fabric_scraps:{label:'Approximate size',example:'Length × width when laid flat, e.g. 25 × 15 cm'},
  coconut_shells:{label:'Widest diameter',example:'Across the widest part, e.g. 10 cm'},
  dry_untreated_wood_scraps:{label:'Approximate size',example:'Length × width × thickness, e.g. 30 × 8 × 2 cm'},
};

function MainPhotoPreview({photo,preview}:{photo:Photo;preview:MaterialPreview|null}){
  const [layout,setLayout]=useState({width:0,height:0});
  const width=preview?.image_width || 0, height=preview?.image_height || 0;
  const scale=width && height?Math.min(layout.width/width,layout.height/height):0;
  const [x1,y1,x2,y2]=preview?.box || [0,0,0,0];
  return <View style={[u.photo,{overflow:'hidden'}]} onLayout={event=>setLayout(event.nativeEvent.layout)}>
    <Image accessibilityLabel="Main photo preview" source={{uri:/^(file|content):/.test(photo.uri)?photo.uri:`file://${photo.uri}`}} style={{width:'100%',height:'100%'}} resizeMode="contain"/>
    {preview?.box && scale>0?<View pointerEvents="none" accessible accessibilityLabel="Detected object outline" style={{
      position:'absolute',left:(layout.width-width*scale)/2+x1*width*scale,top:(layout.height-height*scale)/2+y1*height*scale,
      width:(x2-x1)*width*scale,height:(y2-y1)*height*scale,borderWidth:2,borderRadius:5,
      borderColor:preview.status==='supported'?'#1b7954':preview.status==='special_handling'?'#ad3824':'#986b20',
    }}/>:null}
  </View>;
}
export default function ScanSession({renderCamera,onBack,onManual,onComplete}:{renderCamera:(capture:(uri:string,frame?:CaptureFrame)=>void,back:()=>void,hint:string)=>React.ReactNode;onBack:()=>void;onManual:()=>void;onComplete:(scene:ScanScene)=>void}){
  const [mainPhoto,setMainPhoto]=useState<Photo>(),[taking,setTaking]=useState<'front'|'concern'|ItemView|null>(null);
  const [sidePhotos,setSidePhotos]=useState<Partial<Record<ItemView,Photo>>>({});
  const [preview,setPreview]=useState<MaterialPreview|null>(null),[stage,setStage]=useState<'preview'|'views'|'details'>('preview');
  const [quantity,setQuantity]=useState(''),[size,setSize]=useState('');
  const [inspectionReport,setInspectionReport]=useState<ScanDetails['inspection_report']>();
  const [concernPhotos,setConcernPhotos]=useState<Photo[]>([]);
  const [concern,setConcern]=useState<ReportedConcern>();
  const [exposure,setExposure]=useState('');
  const [moisture,setMoisture]=useState('');
  const [usableQuantity,setUsableQuantity]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const lock=useRef(false),request=useRef('');
  const detailsScroll=useRef<ScrollViewInstance>(null);
  const revealCloseUp=useRef(false);
  const back=()=>{
    if(lock.current)return;
    if(taking)setTaking(null);
    else if(stage==='details')setStage('views');
    else if(stage==='views')setStage('preview');
    else onBack();
  };
  React.useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{back();return true;});return()=>sub.remove();});
  const changed=()=>{request.current='';setError('');};
  const checkMainPhoto=async(photo:Photo)=>{
    if(lock.current)return;
    lock.current=true;
    setBusy(true);
    setPreview(null);
    setError('');
    try{setPreview(await previewScanMaterial(photo.uri,photo.frame));}
    catch(e){setError(e instanceof Error?e.message:'Could not check the material. Try again.');}
    finally{lock.current=false;setBusy(false);}
  };
  const mode=Number(quantity)>1?'batch':'single';
  const category=preview?.status==='supported'?preview.label:'';
  const disposal=preview?.status==='out_of_scope' && !!preview.disposal_token;
  const capturePlan=preview?.capture_plan;
  const insideHint=category==='cardboard'
    ?'For an open box, show the bottom and inside corners. Skip this photo for a flat sheet or a closed box.'
    :category==='coconut_shells'
      ?'If the shell is already open, show the inner surface and rim. Skip this photo if the inside is covered or unsafe to reach.'
      :INSIDE_HINT;
  const requiredViews=(capturePlan?.views ?? LEGACY_VIEWS).map(view=>({
    view,...(view==='bottom' && category==='dry_untreated_wood_scraps'
      ?{name:'Cut end',hint:'Show the end of the piece so splits and the thickness are visible.'}
      :VIEW_GUIDES[view]),
  }));
  const viewKeys:ItemView[]=[...requiredViews.map(({view})=>view),...(capturePlan?.inside?['inside' as const]:[])];
  const capturedCount=requiredViews.filter(({view})=>sidePhotos[view]).length+1;
  const nextView=requiredViews.find(({view})=>!sidePhotos[view]);
  const sizeGuide=SIZE_GUIDANCE[category] || {label:'Approximate size',example:'e.g. 20 × 10 cm'};
  const valid=/^\d+$/.test(quantity.trim()) && Number(quantity)>=1 && Number(quantity)<=100000 && (disposal || !!size.trim()) && size.length<=160;
  const needsUsableQuantity=mode==='batch' && inspectionReport==='concern_photo';
  const usableQuantityReady=!needsUsableQuantity || (/^\d+$/.test(usableQuantity.trim()) && Number(usableQuantity)<=Number(quantity));
  const detailsReady=valid && !!exposure && usableQuantityReady &&
    (inspectionReport==='none_seen' || (inspectionReport==='concern_photo' && concernPhotos.length>0 && !!concern &&
      (concern!=='wet' || !!moisture)));
  const analyze=async()=>{
    if(lock.current || !mainPhoto || !preview || (preview.status!=='supported' && !disposal) || nextView || !detailsReady)return;
    Keyboard.dismiss();
    lock.current=true;setBusy(true);setError('');
    if(!request.current)request.current=`session_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
    const details:ScanDetails={
      mode,quantity:Number(quantity),approximate_size:disposal?'Not applicable':size.trim(),inspection_report:inspectionReport,previous_contents:exposure,
      condition_policy:'inspection-first-v1',capture_mode:capturePlan?'material-guided-v1':'all-sides-v1',
      ...(inspectionReport==='concern_photo'?{reported_concern:concern}:{}),
      ...(concern==='wet' && moisture?{moisture_cause:moisture}:{}),
      ...(needsUsableQuantity?{usable_quantity:Number(usableQuantity)}:{}),
    };
    const previewToken=preview.status==='supported'?preview.token:preview.status==='out_of_scope'?preview.disposal_token:undefined;
    try{
      const {scene}=await createScene(mainPhoto.uri,request.current,mainPhoto.frame,true,{
        primaryView:'front',views:viewKeys.flatMap(view=>{
          const photo=sidePhotos[view];
          return photo?[{view,...photo}]:[];
        }),details,
        ...(previewToken?{previewToken}:{}),
        ...(preview.status==='supported' && preview.resinCode?{resinCode:preview.resinCode}:{}),
        ...(concernPhotos.length?{concernPhotos}:{}),
      });
      if(scene.status==='failed'){
        request.current='';
        throw new Error(scene.error || 'Analysis failed. Your photos are kept; try again.');
      }
      if(scene.status==='processing')throw new Error('Still processing. Wait and retry.');
      onComplete(scene);
    }
    catch(e){setError(e instanceof Error?e.message:'Unable to analyze. Your photos are kept.');}
    finally{lock.current=false;setBusy(false);}
  };
  if(taking)return renderCamera((uri,frame)=>{
    const photo={uri,frame:frame || GALLERY_FRAME};
    changed();setTaking(null);
    if(taking==='concern'){
      revealCloseUp.current=true;
      setConcernPhotos(previous=>[...previous,photo]);setInspectionReport('concern_photo');return;
    }
    if(taking!=='front'){
      setSidePhotos(previous=>({...previous,[taking]:photo}));return;
    }
    setMainPhoto(photo);setStage('preview');
    void checkMainPhoto(photo);
  },back,taking==='concern'?'Show the concern clearly and keep part of the same item in view.':
    taking==='front'?'Front: Show the whole item with a little space around it.':
      taking==='inside'?insideHint:requiredViews.find(({view})=>view===taking)?.hint || '');
  if(mainPhoto && stage==='preview'){
    const title=preview?.status==='supported'?(SCAN_MATERIAL_NAMES[preview.label] || 'Supported material'):
      preview?.status==='special_handling'?(preview.handling_kind==='separate'?'Keep this item separate':'Hazardous Waste'):
        preview?.status==='out_of_scope'?(disposal?'Outside the upcycling categories':'Out of Scope'):
        preview?.status==='photo_review'?'Photo Needs Review':preview?.status==='unavailable'?'Material Check Unavailable':'Checking material';
    const excluded=preview?.status==='special_handling' || preview?.status==='out_of_scope';
    const reportCode=(code:'1'|'2')=>{
      if(preview?.status!=='photo_review' || !preview.resin_review_token)return;
      setPreview({...preview,status:'supported',label:code==='1'?'pete_bottles':'hdpe_containers',
        reason:`Recycling code #${code} recorded. Photograph the remaining sides to continue.`,
        token:preview.resin_review_token,resinCode:code});
    };
    return <ScrollView key="material-preview" contentContainerStyle={u.page}>
      <ScreenHeader backLabel="Back" onBack={back} disabled={busy}/>
      <Text style={u.title}>1. Photograph the item</Text>
      <View style={u.card}>
        <MainPhotoPreview photo={mainPhoto} preview={preview}/>
        {!excluded?<><Text accessibilityRole="header" style={u.heading}>{error?'Material Check Unavailable':title}</Text>
        {error?<Text accessibilityRole="alert" style={u.error}>{error}</Text>:<Text style={u.body}>{preview?.reason || 'Checking the material shown in your main photo.'}</Text>}</>:null}
        <MaterialScores preview={preview}/>
      </View>
      {excluded?<View accessibilityRole="alert" style={[u.card,{backgroundColor:'#fff1e8',borderColor:'#edc5a8'}]}>
        <ShieldAlert size={24} color="#a33e21"/>
        <Text style={[u.heading,{color:'#a33e21'}]}>{title}</Text><Text style={u.body}>{preview?.reason}</Text>
      </View>:null}
      {preview?.status==='photo_review' && preview.resin_review_token?<View style={u.card}>
        <Text style={u.heading}>Find the plastic code</Text>
        <Text style={u.body}>Turn the bottle or container over. Look for a small triangle molded into the base, near the center or along the edge. If the mark is faint, tilt it under a light to read the number inside.</Text>
        <View style={u.buttonRow}>
          <PlasticCodeExample code="1" label="Water and soft drink bottles"/>
          <PlasticCodeExample code="2" label="Thick plastic jugs and bottles"/>
        </View>
        <Text style={u.body}>Choose the number you can read on the item. For a batch, check that every piece has the same code.</Text>
        <Action title="My item has code #1" onPress={()=>reportCode('1')}/>
        <Action title="My item has code #2" onPress={()=>reportCode('2')}/>
        <Text style={u.small}>No readable code or a different number? Tap Retake scan below.</Text>
      </View>:null}
      {preview?.status==='supported' || disposal?<Action title="Photograph the other sides" variant="primary" onPress={()=>setStage('views')}/>:null}
      {!busy && (!preview || preview.status==='unavailable')?<Action title="Retry material check" variant="primary" onPress={()=>{void checkMainPhoto(mainPhoto);}}/>:null}
      {!busy && !excluded?<Action title="Retake scan" onPress={()=>setTaking('front')}/>:null}
      {excluded?<Action title="Scan another item" variant={disposal?'secondary':'primary'} onPress={()=>{
        setMainPhoto(undefined);setSidePhotos({});setPreview(null);setQuantity('');setSize('');
        setInspectionReport(undefined);setConcernPhotos([]);setConcern(undefined);setExposure('');setMoisture('');setUsableQuantity('');changed();
      }}/>:null}
    </ScrollView>;
  }
  if(!mainPhoto)return <Modal visible transparent animationType="fade" onRequestClose={onBack}>
    <View style={{flex:1,justifyContent:'center',backgroundColor:'#091912aa',padding:20}}>
      <ScrollView style={{maxHeight:'85%',backgroundColor:'#f7f9f5',borderRadius:20}} contentContainerStyle={{padding:22}}>
        <Text accessibilityRole="header" style={[u.heading,{textAlign:'center'}]}>Take your main photo</Text>
        <Text style={u.body}>Start with the front or largest surface. SNAPTURE will show which other photos help check this item. Then answer a short form. For a batch, keep the same group in each photo.</Text>
        <Text style={u.body}>Keep the whole subject inside the camera guide. Use even lighting and a plain background, and hold the phone steady.</Text>
        <Text style={u.body}>If you spot a leak, exposed sharp edge, or other danger, leave the item in place. Do not turn it over for a photo.</Text>
        <View style={u.row}>{Object.keys(MATERIAL_EXAMPLE_PHOTOS).map(label=><View key={label} style={{width:'30%',marginBottom:8}}>
          <Image source={MATERIAL_EXAMPLE_PHOTOS[label]} resizeMode="contain" style={{width:'100%',height:58}}/>
          <Text style={u.small}>{SCAN_MATERIAL_NAMES[label]}</Text>
        </View>)}</View>
        <Action title="Open camera" variant="primary" onPress={()=>setTaking('front')}/>
        <Action title="Cancel scan" variant="ghost" onPress={onBack}/>
      </ScrollView>
    </View>
  </Modal>;
  if(stage==='views')return <ScrollView key="item-views" contentContainerStyle={u.page}>
    <ScreenHeader backLabel="Front photo" onBack={back}/>
    <Text accessibilityRole="header" style={u.title}>1. Photograph the item</Text>
    <Text accessibilityLiveRegion="polite" style={u.body}>{capturedCount} of {requiredViews.length+1} required photos taken</Text>
    <Text style={u.body}>Keep the same item or group in each photo.</Text>
    {nextView?<View style={u.card}><Text style={u.heading}>{nextView.name}</Text><Text style={u.body}>{nextView.hint}</Text>
      <Action title={`Take ${nextView.name.toLowerCase()} photo`} variant="primary" onPress={()=>setTaking(nextView.view)}/>
    </View>:null}
    {!nextView && capturePlan?.inside?<View style={u.card}>
      <Camera size={24} color="#176b45"/>
      <Text style={u.heading}>Inside the item (optional)</Text>
      <Text style={u.body}>{insideHint}</Text>
      {sidePhotos.inside?<Text accessibilityLiveRegion="polite" style={u.body}>Inside photo added</Text>:null}
      <Action title={sidePhotos.inside?'Retake inside photo':'Take inside photo'} onPress={()=>setTaking('inside')}/>
      {sidePhotos.inside?<Action title="Remove inside photo" variant="ghost" onPress={()=>{
        setSidePhotos(previous=>({...previous,inside:undefined}));changed();
      }}/>:null}
    </View>:null}
    <Action title="Continue to item details" variant="primary" disabled={!!nextView} onPress={()=>setStage('details')}/>
    {([{view:'front' as const,name:'Front',photo:mainPhoto},...requiredViews.map(item=>({...item,photo:sidePhotos[item.view]}))]).map(({view,name,photo})=><View key={view} style={u.card}>
      {photo?<Check size={24} color="#176b45"/>:<Camera size={24} color="#176b45"/>}
      <Text style={u.heading}>{name}</Text>
      {photo?<><Image accessibilityLabel={`${name} photo`} source={{uri:/^(file|content):/.test(photo.uri)?photo.uri:`file://${photo.uri}`}} style={{height:85,width:130}} resizeMode="contain"/>
        <Action title={`Retake ${name.toLowerCase()} photo`} onPress={()=>setTaking(view)}/></>:null}
    </View>)}
  </ScrollView>;
  return <ScrollView key="item-details" ref={detailsScroll} contentContainerStyle={u.page} keyboardShouldPersistTaps="handled">
    <ScreenHeader backLabel="Item photos" onBack={back} disabled={busy}/>
    <ClipboardList size={28} color="#176b45"/>
    <Text accessibilityRole="header" style={u.title}>2. Tell us about the item</Text>
    {category?<View style={u.card}>
      <Image source={SCAN_MATERIAL_ICONS[category]} resizeMode="contain" style={{width:48,height:48}}/>
      <Text style={u.heading}>{SCAN_MATERIAL_NAMES[category]}</Text>
    </View>:null}
    <Field label="How many pieces?" placeholder="e.g. 2" numeric value={quantity} editable={!busy} onChange={v=>{setQuantity(v);setUsableQuantity('');if(inspectionReport==='none_seen')setInspectionReport(undefined);changed();}}/>
    {!disposal?<><Field label={sizeGuide.label} placeholder={sizeGuide.example} value={size} editable={!busy} onChange={v=>{setSize(v);changed();}}/>
    <Text style={u.body}>Enter the usable size of one piece with its unit. {sizeGuide.example}. Scan different sizes separately.</Text></>:null}
    <Text style={u.fieldLabel}>Inspect every side before continuing</Text>
    <Text style={u.body}>Check every piece, including its edges and any interior you can see safely. Choose “Other / unknown” if you can’t confirm what was inside or spilled on it.</Text>
    <Text style={u.fieldLabel}>What was inside it or spilled on it?</Text>
    <View style={u.row}>{EXPOSURES.map(value=><Chip key={value} title={value==='Chemical or cleaning product'?'Alcohol, sanitizer, or cleaning chemicals':value} selected={exposure===value} disabled={busy}
      onPress={()=>{setExposure(value);changed();}}/>)}</View>
    <Text style={u.fieldLabel}>Did you find any tears, creases, damp spots, dirt, stains, suspected mold, or damage to a usable area?</Text>
    <Text style={u.small}>Choose None only if you inspected every piece and found them all clean, dry, and free of visible concerns. Use Scan to photograph each area that needs checking.</Text>
    <View style={u.buttonRow} onLayout={event=>{
      if(!revealCloseUp.current)return;
      revealCloseUp.current=false;
      detailsScroll.current?.scrollTo({y:Math.max(0,event.nativeEvent.layout.y-16),animated:false});
    }}>
      <View style={u.buttonSlot}><Chip title="None" selected={inspectionReport==='none_seen'} disabled={busy} onPress={()=>{setInspectionReport('none_seen');setConcernPhotos([]);setConcern(undefined);setMoisture('');setUsableQuantity('');changed();}}/></View>
      <View style={u.buttonSlot}><Chip title="Scan" selected={inspectionReport==='concern_photo'} disabled={busy} onPress={()=>setTaking('concern')}/></View>
    </View>
    {concernPhotos.length>0?<View style={u.card}>
      <Text style={u.fieldLabel}>Inspection close-ups</Text>
      <Text style={u.small}>These are the photos used for condition checking. Tap Scan again to add another area.</Text>
      {concernPhotos.map((photo,index)=><View key={`${photo.uri}-${index}`}>
        <Image accessibilityLabel={`Inspection close-up ${index+1}`}
          source={{uri:/^(file|content):/.test(photo.uri)?photo.uri:`file://${photo.uri}`}}
          style={u.photo} resizeMode="contain"/>
        <Action title={`Remove close-up ${index+1}`} variant="ghost" disabled={busy} onPress={()=>{
          setConcernPhotos(previous=>previous.filter((_,position)=>position!==index));
          if(concernPhotos.length===1){setInspectionReport(undefined);setConcern(undefined);setMoisture('');setUsableQuantity('');}
          changed();
        }}/>
      </View>)}
    </View>:null}
    {inspectionReport==='concern_photo'?<>
      <Text style={u.fieldLabel}>What is the most serious concern in the photos?</Text>
      <View style={u.row}>{CONCERNS.map(({value,label})=><Chip key={value} title={label} selected={concern===value} disabled={busy}
        onPress={()=>{if(concern!==value){setConcern(value);setMoisture('');changed();}}}/>)}</View>
    </>:null}
    {concern==='wet'?<>
      <Text style={u.fieldLabel}>What caused the damp area?</Text>
      <Text style={u.small}>Choose Unknown if you are unsure.</Text>
      <View style={u.row}>{MOISTURE_CAUSES.map(value=><Chip key={value} title={value} selected={moisture===value} disabled={busy}
        onPress={()=>{setMoisture(value);changed();}}/>)}</View>
    </>:null}
    {needsUsableQuantity?<Field label="Usable pieces after inspection" placeholder="e.g. 2" numeric value={usableQuantity} editable={!busy}
      onChange={v=>{setUsableQuantity(v);changed();}}/>:null}
    {needsUsableQuantity?<Text style={u.small}>Exclude questionable pieces from this count. Enter 0 if none remain.</Text>:null}
    {error?<Text accessibilityRole="alert" style={u.error}>{error}</Text>:null}
    <Action title="Check my item" label={busy?'Checking your photos and answers…':undefined} variant="primary" disabled={busy || !detailsReady} onPress={analyze}/>
    <Action title="Choose material without a photo" variant="ghost" disabled={busy} onPress={onManual}/>
  </ScrollView>;
}
