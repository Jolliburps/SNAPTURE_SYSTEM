import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { addSceneRegion, getScene, imageUrl, type ImageQuality, type Prediction, type ScanScene, type SceneItem } from './api';
import MarkObjectModal from './MarkObjectModal';
import DetectionItemCard from './DetectionItemCard';

export const GROUP_COLORS: Record<string, string> = { biodegradable: '#247544', recyclable: '#19739c', non_biodegradable: '#715a98', special: '#a24432', review: '#896322' };
const GROUP_NAMES: Record<string, string> = { biodegradable: 'Biodegradable', recyclable: 'Recyclable / reusable', non_biodegradable: 'Residual', special: 'Special / hazardous', review: 'Unidentified / needs review' };
const GROUP_REASONS: Record<string, string> = {
  biodegradable: 'Plant or food material may break down, but a photo cannot confirm its contents, contamination or composting suitability.',
  recyclable: 'This resembles a recoverable material. Recycling still depends on the exact material, cleanliness and local acceptance.',
  non_biodegradable: 'Residual is a reported or suggested route, not a conclusion based only on being non-biodegradable. Confirm the item and local rules before disposal.',
  special: 'A battery-like item may need separate handling. Keep it apart and ask your barangay or CESD for item-specific instructions.',
  review: 'The visual suggestion is not enough to establish a disposal route.',
};
const RECOVERY_OPTIONS: Record<string, string[]> = {
  biodegradable: ['Ask CESD about composting suitable plant or kitchen scraps. Check the ingredients and available space first.'],
  recyclable: ['Ask an accepting collector or MRF about recovery after confirming the material.', 'Check an item for published reuse ideas before preparing it.'],
  non_biodegradable: ['Ask your barangay whether a recovery or diversion program accepts the exact material. Do not burn or melt it yourself.'],
  special: ['Use an authorized collection route confirmed by your barangay or CESD. DIY reuse is not recommended for suspected hazardous items.'],
  review: ['Confirm the object and its contents before cleaning, combining or reusing it.'],
};

export function QualityFeedback({ quality }: { quality?: ImageQuality }) {
  if (!quality?.flags?.length) return null;
  return <View style={s.warning}><Text style={s.heading}>Photo check</Text>{quality.flags.map(flag => <Text key={flag.code} style={s.body}>{flag.message}</Text>)}<Text style={s.small}>These are possible issues, not a quality certification.</Text></View>;
}

function Action({ title, onPress, secondary = false }: { title: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={secondary ? s.secondary : s.action}><Text style={secondary ? s.link : s.actionText}>{title}</Text></Pressable>;
}

const GROUP_ORDER = ['biodegradable', 'recyclable', 'non_biodegradable', 'special', 'review'];
function itemGroup(item: SceneItem) {
  if (item.display_group) return item.display_group;
  return item.score < .28 && item.prediction.assessment?.material.status !== 'user_selected' ? 'review' : item.suggested_group || 'review';
}
function canDraw(item: SceneItem) {
  return item.box.length === 4 && item.box.every(value => Number.isFinite(value) && value >= 0 && value <= 1) && item.box[2] > item.box[0] && item.box[3] > item.box[1];
}
export function containRect(width: number, height: number, boxWidth: number, boxHeight: number) {
  const scale = Math.min(boxWidth / width, boxHeight / height);
  return { x: (boxWidth - width * scale) / 2, y: (boxHeight - height * scale) / 2, width: width * scale, height: height * scale };
}

export default function SceneResults({ initial, onBack, onReview, onRetry, onOpenGuide, historical=false, selectedPredictionId, onBrowseIdeas }: { initial: ScanScene; onBack: () => void; onReview?: (prediction: Prediction) => void; onRetry: () => void; onOpenGuide?: (prediction: Prediction, ideaId: string) => Promise<void>; historical?:boolean; selectedPredictionId?:number; onBrowseIdeas?:()=>void }) {
  const [scene, setScene] = useState(initial);
  const [error, setError] = useState('');
  const selectedItem=initial.items.find(item=>item.prediction.id===selectedPredictionId);
  const [selected, setSelected] = useState<number | null>(selectedItem?.id ?? (initial.items.length === 1 ? initial.items[0].id : null));
  const [expanded, setExpanded] = useState<Record<number, boolean>>(selectedItem?{[selectedItem.id]:true}:{});
  const [marking, setMarking] = useState(false);
  const [starting, setStarting] = useState('');
  const [photoWidth, setPhotoWidth] = useState(300);
  const [photoError,setPhotoError]=useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const photoY = useRef(0);
  const cardY = useRef<Record<number, number>>({});
  useEffect(()=>{
    if(!historical)return;
    const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{onBack();return true;});
    return ()=>subscription.remove();
  },[historical,onBack]);
  useEffect(() => {
    if(historical)return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      getScene(initial.id).then(result => {
        if (!active) return;
        setScene(result.scene);
        if (result.scene.status === 'processing') timer = setTimeout(load, 2000);
      }).catch(() => { if (active) setError('Showing the last result. Reopen this scan to refresh item details.'); });
    };
    load();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [initial.id,historical]);
  const checked = scene.items.filter(item => item.prediction.assessment?.quick_check?.user_reviewed || item.prediction.assessment?.quick_check?.sorting_complete || item.prediction.assessment?.segregation.status === 'available').length;
  const candidateCount = scene.items.filter(item => !item.background).length;
  const single = candidateCount === 1;
  const numbers = new Map([...scene.items].sort((a,b) => a.id-b.id).map((item,index) => [item.id,index+1]));
  const eligible = scene.items.filter(canDraw);
  const drawn = eligible;
  const stageHeight = single ? 280 : 360;
  const rect = containRect(scene.width,scene.height,photoWidth,stageHeight);
  const chooseBox = (item: SceneItem) => {
    setSelected(item.id); setExpanded(old => ({ ...old,[item.id]:true }));
    requestAnimationFrame(() => scroll.current?.scrollTo({ y: Math.max(0,(cardY.current[item.id] || 0)-12), animated:true }));
  };
  const chooseCard = (item: SceneItem) => {
    setSelected(item.id);
    setExpanded(old=>({...old,[item.id]:!old[item.id]}));
  };
  const showPhoto = (item: SceneItem) => {
    setSelected(item.id);
    if (canDraw(item)) scroll.current?.scrollTo({ y:photoY.current,animated:true });
  };
  const openGuide = async (item: SceneItem, ideaId: string) => {
    if (!onOpenGuide || starting) return;
    setStarting(ideaId); setError('');
    try { await onOpenGuide(item.prediction,ideaId); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to open this guide.'); }
    finally { setStarting(''); }
  };
  return <ScrollView ref={scroll} contentContainerStyle={s.page}>
    <Action title="Back" onPress={onBack} secondary />
    <Text style={s.title}>{single ? 'Item result' : candidateCount ? 'Sort this scan' : 'Review this photo'}</Text>
    {scene.created_at?<Text style={[s.body,s.resultBody]}>{new Date(scene.created_at).toLocaleString()}</Text>:null}
    {historical?<Text style={[s.small,s.resultBody]}>Saved scan · viewing this photo does not run detection again.</Text>:null}
    <Text style={[s.body,s.resultBody]}>{candidateCount} waste suggestions · {checked} reviewed</Text>
    <Text style={s.small}>Suggested groups need material and local-acceptance checks. The model can miss or confuse objects. An unidentified item keeps its box; it is not automatically residual waste.</Text>
    <QualityFeedback quality={scene.quality} />
    <View onLayout={event => { photoY.current = event.nativeEvent.layout.y; setPhotoWidth(event.nativeEvent.layout.width); }} style={[s.photo,{height:stageHeight}]}>
      {scene.image_url && !photoError?<Image source={{ uri:imageUrl(scene.image_url) }} onError={()=>setPhotoError(true)} accessibilityLabel="Original scanned photo" resizeMode="contain" style={StyleSheet.absoluteFill} />:<Text style={s.missingPhoto}>The photo is unavailable or privacy processing is not ready. Saved item results are still shown below.</Text>}
      {scene.image_url && !photoError?drawn.map(item => {
        const color = GROUP_COLORS[itemGroup(item)] || GROUP_COLORS.review;
        const left=rect.x+item.box[0]*rect.width, top=rect.y+item.box[1]*rect.height;
        return <React.Fragment key={item.id}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Select box ${numbers.get(item.id)}`} accessibilityState={{selected:selected===item.id}} onPress={() => chooseBox(item)} style={[s.box,selected===item.id && s.selectedBox,{left,top,width:(item.box[2]-item.box[0])*rect.width,height:(item.box[3]-item.box[1])*rect.height,borderColor:color}]} />
          <Pressable accessibilityRole="button" accessibilityLabel={`Select item badge ${numbers.get(item.id)}`} hitSlop={8} onPress={() => chooseBox(item)} style={[s.numberBadge,{left:Math.min(photoWidth-32,Math.max(0,left)),top:Math.min(stageHeight-32,Math.max(0,top)),backgroundColor:color}]}><Text style={s.numberText}>{numbers.get(item.id)}</Text></Pressable>
        </React.Fragment>;
      }):null}
    </View>
    <Text style={[s.small,s.resultBody]}>{drawn.length ? 'Tap a box to open its item. Tap an item below to expand or collapse its details.' : 'No object boxes to display. Review any items below or retake the photo.'}</Text>
    {scene.background_objects?.length ? <Text style={s.small}>Possible background objects excluded from sorting: {scene.background_objects.map(row=>row.name).join(', ')}. If these are discarded items, ask CESD about the appropriate collection route.</Text> : null}
    {scene.truncated ? <Text style={s.low}>The detector reached its proposal limit. Some regions are not shown. Use a separate photo or mark a missed item.</Text> : null}
    {!historical && scene.status === 'complete' ? <Action title="Mark a missed item" secondary onPress={() => setMarking(true)} /> : null}
    {!single ? <View style={s.legend}>{GROUP_ORDER.map(key => <Text key={key} style={[s.legendText,{color:GROUP_COLORS[key]}]}>{GROUP_NAMES[key]} {scene.items.filter(item=>itemGroup(item)===key).length}</Text>)}</View> : null}
    {error || scene.error ? <Text accessibilityRole="alert" style={s.error}>{error || scene.error}</Text> : null}
    {scene.status==='processing' ? <View style={s.card}><Text style={s.heading}>Analyzing this photo...</Text><Text style={s.body}>This result updates automatically when analysis finishes.</Text></View> : null}
    {scene.status==='complete' && !scene.items.length ? <View style={s.card}><Text style={s.heading}>No clear waste items found</Text><Text style={s.body}>This does not mean no waste is present. Try fewer separated items or choose a material manually from the camera screen.</Text></View> : null}
    {scene.items.length ? <Text accessibilityRole="header" style={s.itemsTitle}>Detected items</Text> : null}
    {[...scene.items].sort((a,b)=>a.id-b.id).map(item=>{
      const group=itemGroup(item);
      return <DetectionItemCard key={item.id} item={item} number={numbers.get(item.id)!}
        category={GROUP_NAMES[group] || GROUP_NAMES.review} color={GROUP_COLORS[group] || GROUP_COLORS.review}
        explanation={GROUP_REASONS[group] || GROUP_REASONS.review} recoveryOptions={RECOVERY_OPTIONS[group] || RECOVERY_OPTIONS.review}
        fallbackPreparation={group==='special'?'Keep suspected hazardous items separate. Ask CESD for handling instructions; do not mix, burn or empty unknown contents.':'Confirm the item and its contents first. Preparation such as rinsing or flattening is shown only when published guidance applies.'}
        expanded={Boolean(expanded[item.id])} selected={selected===item.id}
        onToggle={()=>chooseCard(item)} onShowPhoto={scene.image_url && !photoError?()=>showPhoto(item):undefined} onReview={!historical && onReview?()=>onReview(item.prediction):undefined}
        onOpenGuide={onOpenGuide ? ideaId=>{openGuide(item,ideaId);} : undefined} openingGuide={starting} guidesBusy={Boolean(starting)}
        onLayout={y=>{cardY.current[item.id]=y;}} />;
    })}
    <View style={s.learn}><Text style={s.heading}>Did you know?</Text><Text style={s.body}>A recycling number identifies the plastic type, not whether your collector accepts it. Check local acceptance before handing it over.</Text><Text style={s.small}>US EPA common-recyclables guidance and CESD reference library. Progress records details checked, not measured environmental impact.</Text></View>
    {onBrowseIdeas?<><Action title="Browse general reuse ideas" secondary onPress={onBrowseIdeas}/><Text style={s.small}>The idea library is not an assessment or approval for the items in this scan.</Text></>:null}
    <Action title="Scan another photo" onPress={onRetry} />
    {marking ? <MarkObjectModal image={scene.image_url} width={scene.width} height={scene.height} onClose={() => setMarking(false)} onSave={async (box, requestId) => { const result = await addSceneRegion(scene.id, box, requestId); setScene(result.scene); }} /> : null}
  </ScrollView>;
}


const s = StyleSheet.create({
  missingPhoto:{padding:20,fontSize:16,lineHeight:25,color:'#35483e'},
  itemsTitle:{fontSize:21,lineHeight:29,color:'#143f30',fontWeight:'700',marginTop:22},resultBody:{fontSize:16,lineHeight:24},
  page: { flexGrow: 1, backgroundColor: '#f7f9f5', padding: 20, paddingBottom: 45 }, title: { color: '#143f30', fontSize: 27, fontWeight: '800', marginBottom: 8 },
  heading: { color: '#143f30', fontSize: 17, fontWeight: '700', marginBottom: 7 }, body: { color: '#35483e', fontSize: 14, lineHeight: 21, marginBottom: 8 }, small: { fontSize: 12, color: '#57645d', lineHeight: 18, marginBottom: 8 },
  photo: { width: '100%', backgroundColor: '#dae5df', marginVertical: 12, overflow: 'hidden' }, box: { position: 'absolute', borderWidth: 2 }, selectedBox: { borderWidth: 4 },
  numberBadge: { position: 'absolute', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, numberText: { color: '#fff', fontWeight: '800', fontSize: 14 }, low: { color: '#896322', lineHeight: 20, marginBottom: 8 },
  card: { borderWidth: 1, borderColor: '#dce9df', borderRadius: 18, padding: 16, backgroundColor: '#fff', marginTop: 14 },
  action: { padding: 14, backgroundColor: '#176b45', borderRadius: 12, marginTop: 10 }, actionText: { color: '#fff', fontWeight: '700', textAlign: 'center' }, secondary: { paddingVertical: 12 }, link: { color: '#176b45', fontWeight: '700' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, legendText: { fontSize: 14, lineHeight: 22, fontWeight: '700' }, warning: { backgroundColor: '#fff3dc', padding: 14, borderRadius: 14, marginVertical: 10 }, error: { color: '#a12020' }, learn: { backgroundColor: '#e7f2e9', borderRadius: 16, padding: 16, marginTop: 18 }, historyPhoto: { width: '100%', height: 150, borderRadius: 12, marginBottom: 12 },
});
