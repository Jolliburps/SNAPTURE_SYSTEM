import React,{useContext,useEffect,useRef,useState} from 'react';
import {Alert,Modal,ScrollView,View} from 'react-native';
import Text from './PublicText';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {getCommunity,listCompletions,listInventory,upcyclingRequest,type Completion,type Lot} from './upcyclingApi';
import {Action,Field,Hero,Chip,Badge,ScreenHeader,u} from './UpcyclingUI';
import FolderOpen from 'lucide-react-native/icons/folder-open';
import SuitabilityProjects from './SuitabilityProjects';
import {type Prediction} from './api';
import {ProjectFlowContext} from './ProjectFlowContext';

function ModalSurface({children}:{children:React.ReactNode}){
  return <SafeAreaProvider><SafeAreaView style={u.safeArea}>{children}</SafeAreaView></SafeAreaProvider>;
}

export default function UpcyclingHub(){
  const [open,setOpen]=useState(false),[tab,setTab]=useState('Collection'),[lots,setLots]=useState<Lot[]>([]),[completed,setCompleted]=useState<Completion[]>([]);
  const [community,setCommunity]=useState<Awaited<ReturnType<typeof getCommunity>>|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[values,setValues]=useState<Record<string,string>>({});
  const [inventoryItem,setInventoryItem]=useState<Prediction|null>(null);
  const [editingLot,setEditingLot]=useState<number|null>(null);
  const openProcedure=useContext(ProjectFlowContext);
  const [recommendationsOpen,setRecommendationsOpen]=useState(false);
  const lock=useRef(false),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const load=async()=>{const [stock,finished,groups]=await Promise.all([listInventory(),listCompletions(),getCommunity()]);if(alive.current){setLots(stock.lots);setCompleted(finished.completions);setCommunity(groups);}};
  const run=async(fn:()=>Promise<void>)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await fn();}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Unable to load.');}finally{lock.current=false;if(alive.current)setBusy(false);}};
  const input=(key:string,v:string)=>setValues(old=>({...old,[key]:v}));
  return <>
    <View style={u.card}><View style={u.row}><View style={u.heroMark}><FolderOpen size={22} color="#176b45"/></View><Text style={u.heading}>Your upcycling space</Text></View><Text style={u.small}>Manage your collected materials and view organization ratings.</Text><Action title="My collection and ratings" label="Open my upcycling" variant="primary" onPress={()=>{setOpen(true);run(load);}}/></View>
    <Modal visible={open} animationType="slide" onRequestClose={()=>{if(!busy)setOpen(false);}}>
      <ProjectFlowContext.Provider value={openProcedure?p=>{setRecommendationsOpen(false);setOpen(false);openProcedure(p);}:null}>
      <ModalSurface><ScrollView contentContainerStyle={[u.page,{paddingTop:8}]} keyboardShouldPersistTaps="handled">
        <ScreenHeader onBack={()=>setOpen(false)} onRefresh={()=>run(load)} disabled={busy}/>
        <Hero eyebrow="Your upcycling space" title="Small steps. Useful things." subtitle="Keep what you can use. Celebrate what you've made."/>
        <View style={[u.row,{marginBottom:18,alignItems:'stretch'}]}><View style={u.stat}><Text style={u.count}>{lots.reduce((n,l)=>n+l.available,0)}</Text><Text style={u.small}>Items collected</Text></View><View style={u.stat}><Text style={u.count}>{completed.length}</Text><Text style={u.small}>Creations saved</Text></View></View>
        <View style={u.hubTabs}>{['Collection','Ratings'].map(t=><View key={t} style={u.hubTab}><Chip title={t} selected={tab===t} disabled={busy} style={u.hubTabButton} onPress={()=>setTab(t)}/></View>)}</View>
        <View style={u.statusSlot}><Text accessibilityLiveRegion="polite" style={[u.small,{marginBottom:0}]}>{busy?'Loading…':' '}</Text></View>{error?<Text accessibilityRole="alert" style={u.error}>{error}</Text>:null}
        {tab==='Collection'?<><Text style={u.heading}>Ready for a second life</Text><Text style={u.small}>Add materials from a scan. Update your supply as you collect more.</Text>
          {!lots.length?<View style={u.empty}><FolderOpen size={34} color="#477052"/><Text style={u.heading}>Your next project starts here</Text><Text style={[u.body,{textAlign:'center'}]}>Scan an item, then add it to your collection to keep track of what you have.</Text></View>:null}
          {[...new Set(lots.map(l=>l.material))].map(material=><View key={material}><Text style={u.heading}>{material.replace(/_/g,' ')} · {lots.filter(l=>l.material===material).reduce((n,l)=>n+l.available,0)} available</Text>
            {lots.filter(l=>l.material===material).map(l=><View key={l.id} style={u.card}><View style={u.sectionHead}><Badge text={`${l.available} available`} positive={l.available>0}/><Text style={u.small}>{l.consumed} used</Text></View><Text style={u.small}>{Object.entries(l.attributes).filter(([k])=>['condition','object_type','shape'].includes(k)).map(([,v])=>String(v)).join(' · ')}</Text>
              {l.prediction_id?<Action title={`Find projects for lot ${l.id}`} label="Find something to make" variant="primary" disabled={busy} onPress={()=>run(async()=>{const result=await upcyclingRequest<{prediction:Prediction}>(`inventory/${l.id}/prediction/`);if(alive.current){setInventoryItem(result.prediction);setRecommendationsOpen(true);}})}/>:null}
              <Action title={`Edit lot ${l.id}`} label="Update my supply" variant="ghost" expanded={editingLot===l.id} disabled={busy} onPress={()=>setEditingLot(editingLot===l.id?null:l.id)}/>
              {editingLot===l.id?<>
              <Field label={`Total quantity for lot ${l.id}`} numeric value={values[`lot${l.id}`] ?? String(l.quantity)} onChange={v=>input(`lot${l.id}`,v)}/>
              <Action title={`Update lot ${l.id}`} disabled={busy} onPress={()=>run(async()=>{await upcyclingRequest(`inventory/${l.id}/`,'PATCH',{quantity:Number(values[`lot${l.id}`] ?? l.quantity)});await load();})}/>
              <Action title={`Remove unused lot ${l.id}`} label="Remove this unused material" variant="danger" disabled={busy || l.consumed>0} onPress={()=>Alert.alert('Remove collected material?','This removes the unused collection record, not the scan.',[{text:'Cancel'},{text:'Remove',onPress:()=>run(async()=>{await upcyclingRequest(`inventory/${l.id}/`,'DELETE');await load();})}])}/>
              </>:null}
            </View>)}
          </View>)}
        </>:null}
        {tab==='Ratings'?<>{!community?.submissions.length?<Text style={u.body}>No organization submissions yet.</Text>:null}{community?.submissions.map(s=><View key={s.id} style={u.card}><Text style={u.heading}>{s.project.name} · {s.program.title}</Text><Text style={u.body}>{s.status}{s.total!==null?` · ${s.total}/${s.program.criteria.reduce((sum,c)=>sum+c.maximum,0)}`:''}</Text>{Object.entries(s.scores).map(([key,value])=><Text key={key} style={u.body}>{key}: {value}</Text>)}<Text style={u.body}>{s.feedback || 'Awaiting organization review.'}</Text><Text style={u.small}>{s.recognition}{s.reviewer?` · Reviewed by ${s.reviewer}`:''}</Text></View>)}</>:null}
      </ScrollView></ModalSurface>
      <Modal visible={recommendationsOpen} animationType="slide" onRequestClose={()=>setRecommendationsOpen(false)}><ModalSurface><ScrollView contentContainerStyle={u.page}><Action title="Back to My Collection" variant="ghost" onPress={()=>setRecommendationsOpen(false)}/>{inventoryItem?<SuitabilityProjects key={inventoryItem.id} prediction={inventoryItem} includeCollection/>:null}</ScrollView></ModalSurface></Modal>
      </ProjectFlowContext.Provider>
    </Modal>
  </>;
}
