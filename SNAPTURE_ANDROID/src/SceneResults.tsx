import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { deleteScene, getScene, imageUrl, listScenes, type ImageQuality, type Prediction, type ScanScene, type SceneItem } from './api';

export const GROUP_COLORS: Record<string, string> = { biodegradable: '#247544', recyclable: '#19739c', non_biodegradable: '#715a98', special: '#a24432', review: '#896322' };
const GROUP_NAMES: Record<string, string> = { biodegradable: 'Biodegradable', recyclable: 'Recyclable', non_biodegradable: 'Non-biodegradable', special: 'Special handling', review: 'Needs review' };
const GROUP_REASONS: Record<string, string> = {
  biodegradable: 'Plant or food material may break down, but a photo cannot confirm its contents, contamination or composting suitability.',
  recyclable: 'This resembles a recoverable material. Recycling still depends on the exact material, cleanliness and local acceptance.',
  non_biodegradable: 'This resembles material that is not suitable for ordinary home composting. That does not automatically mean landfill disposal.',
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
  return item.display_box ?? (item.score >= .28 && !item.background);
}
export function containRect(width: number, height: number, boxWidth: number, boxHeight: number) {
  const scale = Math.min(boxWidth / width, boxHeight / height);
  return { x: (boxWidth - width * scale) / 2, y: (boxHeight - height * scale) / 2, width: width * scale, height: height * scale };
}

export default function SceneResults({ initial, onBack, onReview, onRetry, onOpenGuide }: { initial: ScanScene; onBack: () => void; onReview: (prediction: Prediction) => void; onRetry: () => void; onOpenGuide?: (prediction: Prediction, ideaId: string) => Promise<void> }) {
  const [scene, setScene] = useState(initial);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number | null>(initial.items.length === 1 ? initial.items[0].id : null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [starting, setStarting] = useState('');
  const [photoWidth, setPhotoWidth] = useState(300);
  const scroll = useRef<ScrollViewInstance>(null);
  const photoY = useRef(0);
  const groupY = useRef<Record<string, number>>({});
  const cardY = useRef<Record<number, number>>({});
  useEffect(() => {
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
  }, [initial.id]);
  const checked = scene.items.filter(item => item.prediction.assessment?.material.status === 'user_selected' && item.prediction.assessment.missing_information.length === 0 && item.prediction.quantity).length;
  const candidateCount = scene.items.filter(item => !item.background).length;
  const single = candidateCount === 1;
  const numbers = new Map([...scene.items].sort((a,b) => a.id-b.id).map((item,index) => [item.id,index+1]));
  const eligible = scene.items.filter(canDraw);
  let drawn = eligible.slice(0,6);
  const focused = eligible.find(item => item.id === selected);
  if (focused && !drawn.includes(focused)) drawn = [...drawn.slice(0,5),focused];
  const stageHeight = single ? 280 : 360;
  const rect = containRect(scene.width,scene.height,photoWidth,stageHeight);
  const chooseBox = (item: SceneItem) => {
    setSelected(item.id); setExpanded(old => ({ ...old,[itemGroup(item)]:true }));
    if (itemGroup(item)==='review') setReviewOpen(true);
    requestAnimationFrame(() => scroll.current?.scrollTo({ y: Math.max(0,(groupY.current[itemGroup(item)] || 0)+(cardY.current[item.id] || 0)-12), animated:true }));
  };
  const chooseCard = (item: SceneItem) => {
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
    <Text style={s.body}>{candidateCount} waste suggestions · {checked} with details checked</Text>
    <Text style={s.small}>Suggested groups need material and local-acceptance checks. The model can miss or confuse objects.</Text>
    <QualityFeedback quality={scene.quality} />
    <View onLayout={event => { photoY.current = event.nativeEvent.layout.y; setPhotoWidth(event.nativeEvent.layout.width); }} style={[s.photo,{height:stageHeight}]}>
      <Image source={{ uri:imageUrl(scene.image_url) }} resizeMode="contain" style={StyleSheet.absoluteFill} />
      {drawn.map(item => {
        const color = GROUP_COLORS[itemGroup(item)] || GROUP_COLORS.review;
        const left=rect.x+item.box[0]*rect.width, top=rect.y+item.box[1]*rect.height;
        return <React.Fragment key={item.id}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Select box ${numbers.get(item.id)}`} accessibilityState={{selected:selected===item.id}} onPress={() => chooseBox(item)} style={[s.box,selected===item.id && s.selectedBox,{left,top,width:(item.box[2]-item.box[0])*rect.width,height:(item.box[3]-item.box[1])*rect.height,borderColor:color}]} />
          <Pressable accessibilityRole="button" accessibilityLabel={`Select item badge ${numbers.get(item.id)}`} onPress={() => chooseBox(item)} style={[s.numberBadge,{left:Math.min(photoWidth-32,Math.max(0,left)),top:Math.min(stageHeight-32,Math.max(0,top)),backgroundColor:color}]}><Text style={s.numberText}>{numbers.get(item.id)}</Text></Pressable>
        </React.Fragment>;
      })}
    </View>
    <Text style={s.small}>{drawn.length ? 'Tap a numbered box to find its card. Tap a card to highlight its box.' : 'No sufficiently strong object boxes to display. Check the review group below or retake the photo.'}</Text>
    {scene.background_objects?.length ? <Text style={s.small}>Possible background objects excluded from sorting: {scene.background_objects.map(row=>row.name).join(', ')}. If these are discarded items, ask CESD about the appropriate collection route.</Text> : null}
    {eligible.length>6 ? <Text style={s.small}>Showing at most 6 boxes at once. Select another item card to focus its box.</Text> : null}
    {!single ? <View style={s.legend}>{GROUP_ORDER.map(key => <Text key={key} style={[s.legendText,{color:GROUP_COLORS[key]}]}>{GROUP_NAMES[key]} {scene.items.filter(item=>itemGroup(item)===key).length}</Text>)}</View> : null}
    {error || scene.error ? <Text accessibilityRole="alert" style={s.error}>{error || scene.error}</Text> : null}
    {scene.status==='processing' ? <View style={s.card}><Text style={s.heading}>Analyzing this photo...</Text><Text style={s.body}>This result updates automatically when analysis finishes.</Text></View> : null}
    {scene.status==='complete' && !scene.items.length ? <View style={s.card}><Text style={s.heading}>No clear waste items found</Text><Text style={s.body}>This does not mean no waste is present. Try fewer separated items or choose a material manually from the camera screen.</Text></View> : null}
    {GROUP_ORDER.map(group => {
      const items = scene.items.filter(item => itemGroup(item)===group);
      if (!items.length) return null;
      const shown = expanded[group] ? items : items.slice(0,3);
      const open = group!=='review' || reviewOpen || scene.items.length===1;
      const instructions = [...new Set(items.flatMap(item => item.prediction.assessment?.segregation.status==='available' ? item.prediction.assessment.segregation.instructions : []))].slice(0,4);
      const ideas = items.flatMap(item=>item.prediction.recommendation_choices.map(idea=>({item,idea}))).filter((entry,index,array)=>array.findIndex(other=>other.idea.id===entry.idea.id)===index).slice(0,2);
      return <View key={group} onLayout={event => { groupY.current[group]=event.nativeEvent.layout.y; }} style={s.group}>
        <Pressable accessibilityRole="button" accessibilityLabel={group==='review' ? 'Toggle needs review' : GROUP_NAMES[group]} onPress={() => { if(group==='review') setReviewOpen(value=>!value); }}><Text style={[s.groupTitle,{color:GROUP_COLORS[group]}]}>{GROUP_NAMES[group]} · {items.length}</Text>{group==='review' && !single ? <Text style={s.link}>{open ? 'Hide review items' : 'Show low-confidence or background items'}</Text> : null}</Pressable>
        {open ? <>
          <Text style={s.body}>{GROUP_REASONS[group]}</Text>
          {shown.map(item => <View key={item.id} onLayout={event => { cardY.current[item.id]=event.nativeEvent.layout.y; }} style={[s.card,selected===item.id && s.selectedCard]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Select item ${numbers.get(item.id)} card`} accessibilityState={{selected:selected===item.id}} onPress={() => chooseCard(item)}>
              <Text style={s.heading}>{numbers.get(item.id)}. {item.name}</Text>
              {item.low_confidence || item.display_box===undefined && item.score<.28 ? <Text style={s.low}>Low confidence · review before sorting</Text> : null}
              {item.background ? <Text style={s.low}>Possible background object, not included in sorting</Text> : null}
              <Text style={s.body}>{item.review_reason || item.route.reason}</Text>
              <Text style={s.small}>{item.prediction.assessment?.material.status==='user_selected' ? item.prediction.title : 'Material not confirmed'}</Text>
              {(selected===item.id || single) && item.prediction.image_url ? <Image source={{uri:imageUrl(item.prediction.image_url)}} resizeMode="contain" style={s.itemCrop} accessibilityLabel="Detected item crop for review" /> : null}
            </Pressable>
            <Action title={`Review item ${numbers.get(item.id)}`} onPress={() => onReview(item.prediction)} secondary />
            {selected===item.id || single ? <><Text style={s.label}>Disposal route</Text><Text style={s.body}>{item.route.label}. {item.route.reason}</Text>{item.prediction.assessment?.segregation.instructions.map((line,i)=><Text key={i} style={s.body}>{line}</Text>)}</> : null}
          </View>)}
          {items.length>3 ? <Action secondary title={expanded[group] ? 'Show fewer items' : `Show ${items.length-3} more items`} onPress={() => setExpanded(old=>({...old,[group]:!old[group]}))} /> : null}
          <View style={s.groupGuide}><Text style={s.heading}>Preparation</Text>{instructions.length ? instructions.map((line,i)=><Text key={i} style={s.body}>{line}</Text>) : <Text style={s.body}>{group==='special' ? 'Keep suspected hazardous items separate. Ask CESD for handling instructions; do not mix, burn or empty unknown contents.' : 'Confirm the item and its contents first. Preparation such as rinsing or flattening is shown only when published guidance applies.'}</Text>}
          <Text style={s.heading}>Reuse / recycling options</Text>
          {ideas.length ? ideas.map(({item,idea})=><View key={idea.id}><Text style={s.body}>{idea.title}</Text>{onOpenGuide ? <Action title={starting===idea.id ? 'Opening guide...' : `Open guide: ${idea.title}`} onPress={() => { openGuide(item,idea.id); }} /> : null}</View>) : <><Text style={s.small}>General options from the CESD learning material, not item-specific approval:</Text>{RECOVERY_OPTIONS[group].map((line,i)=><Text key={i} style={s.body}>{line}</Text>)}<Text style={s.small}>Review an item to check eligibility for a step-by-step project.</Text></>}
          </View>
        </> : null}
      </View>;
    })}
    <View style={s.learn}><Text style={s.heading}>Did you know?</Text><Text style={s.body}>A recycling number identifies the plastic type, not whether your collector accepts it. Check local acceptance before handing it over.</Text><Text style={s.small}>US EPA common-recyclables guidance and CESD reference library. Progress records details checked, not measured environmental impact.</Text></View>
    <Action title="Scan another photo" onPress={onRetry} />
  </ScrollView>;
}

export function SceneHistory({ onBack, onOpen }: { onBack: () => void; onOpen: (scene: ScanScene) => void }) {
  const [scenes, setScenes] = useState<ScanScene[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { listScenes().then(result => setScenes(result.scenes)).catch(reason => setError(reason.message)).finally(() => setLoading(false)); }, []);
  return <ScrollView contentContainerStyle={s.page}><Action title="Back" onPress={onBack} secondary /><Text style={s.title}>Photo scans</Text>
    {error ? <Text style={s.error}>{error}</Text> : null}
    {!scenes.length ? <Text style={s.body}>{loading ? 'Loading scans...' : 'No photo scans yet.'}</Text> : null}
    {scenes.map(scene => <View key={scene.id} style={s.card}><Pressable accessibilityRole="button" onPress={() => onOpen(scene)}><Image source={{ uri: imageUrl(scene.image_url) }} style={s.historyPhoto} /><Text style={s.heading}>{scene.items.length} item suggestions</Text><Text style={s.body}>{scene.status}</Text></Pressable><Action title="Delete this photo scan" secondary onPress={() => Alert.alert('Delete scan?', 'This removes the full photo and its item crops. Started projects remain.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { deleteScene(scene.id).then(() => setScenes(old => old.filter(row => row.id !== scene.id))).catch(reason => setError(reason.message)); } }])} /></View>)}
  </ScrollView>;
}

const s = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: '#f7f9f5', padding: 20, paddingBottom: 45 }, title: { color: '#143f30', fontSize: 27, fontWeight: '800', marginBottom: 8 },
  heading: { color: '#143f30', fontSize: 17, fontWeight: '700', marginBottom: 7 }, body: { color: '#35483e', fontSize: 14, lineHeight: 21, marginBottom: 8 }, small: { fontSize: 12, color: '#57645d', lineHeight: 18, marginBottom: 8 },
  label: { color: '#57645d', fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 4 }, photo: { width: '100%', backgroundColor: '#dae5df', marginVertical: 12, overflow: 'hidden' }, box: { position: 'absolute', borderWidth: 2 }, boxLabel: { color: '#fff', fontSize: 10, padding: 2 },
  itemCrop: { width: '100%', height: 130, backgroundColor: '#edf3ef', marginVertical: 8 }, selectedBox: { borderWidth: 4 },
  numberBadge: { position: 'absolute', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, numberText: { color: '#fff', fontWeight: '800', fontSize: 14 }, selectedCard: { borderColor: '#176b45', borderWidth: 2, backgroundColor: '#edf6ef' }, group: { marginTop: 22 }, groupTitle: { fontWeight: '800', fontSize: 20 }, groupGuide: { backgroundColor: '#edf3ef', borderRadius: 14, padding: 14, marginTop: 14 }, low: { color: '#896322', lineHeight: 20, marginBottom: 8 },
  card: { borderWidth: 1, borderColor: '#dce9df', borderRadius: 18, padding: 16, backgroundColor: '#fff', marginTop: 14 },
  action: { padding: 14, backgroundColor: '#176b45', borderRadius: 12, marginTop: 10 }, actionText: { color: '#fff', fontWeight: '700', textAlign: 'center' }, secondary: { paddingVertical: 12 }, link: { color: '#176b45', fontWeight: '700' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, legendText: { fontSize: 12, fontWeight: '700' }, warning: { backgroundColor: '#fff3dc', padding: 14, borderRadius: 14, marginVertical: 10 }, error: { color: '#a12020' }, learn: { backgroundColor: '#e7f2e9', borderRadius: 16, padding: 16, marginTop: 18 }, historyPhoto: { width: '100%', height: 150, borderRadius: 12, marginBottom: 12 },
});
