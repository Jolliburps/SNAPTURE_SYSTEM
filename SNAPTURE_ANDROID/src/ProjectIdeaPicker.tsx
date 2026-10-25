import React, {useEffect,useRef,useState} from 'react';
import {BackHandler,Image,Pressable,StyleSheet,Text,View} from 'react-native';
import {changeProjectIdea,getProjectIdeas,imageUrl,type UserProject} from './api';
import UpcyclingIdeaChoices,{type IdeaChoice} from './UpcyclingIdeaChoices';

/** Changing an unstarted plan replaces its choice, not another project's progress. */
export default function ProjectIdeaPicker({project,onChanged,onCancel,onBusyChange}:{project:UserProject;onChanged:(project:UserProject)=>void;onCancel:()=>void;onBusyChange?:(busy:boolean)=>void}) {
  const [ideas,setIdeas]=useState<IdeaChoice[]>([]);
  const [source,setSource]=useState<Awaited<ReturnType<typeof getProjectIdeas>>['source']>();
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(''),[error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  const alive=useRef(true),busy=useRef(false);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');
    getProjectIdeas(project.id).then(result=>{if(active){setIdeas(result.ideas);setSource(result.source);}})
      .catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Unable to load matching ideas.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[project.id,attempt]);
  useEffect(()=>{
    const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{if(!busy.current)onCancel();return true;});
    return()=>subscription.remove();
  },[onCancel]);
  const choose=async(id:string)=>{
    if(busy.current)return;
    busy.current=true;onBusyChange?.(true);setSaving(id);setError('');
    try{const result=await changeProjectIdea(project.id,id);onChanged(result.project);}
    catch(reason){if(alive.current)setError(reason instanceof Error?reason.message:'Unable to change this idea. Your original choice is kept.');}
    finally{busy.current=false;onBusyChange?.(false);if(alive.current)setSaving('');}
  };
  return <View>
    {source?.image_url?<Image accessibilityLabel="Original item for upcycling ideas" source={{uri:imageUrl(source.image_url)}} resizeMode="contain" style={s.photo}/>:null}
    {source?<Text style={s.body}>Item: {source.object_name}</Text>:null}
    {loading?<Text style={s.body}>Loading matching ideas...</Text>:null}
    {error?<><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Reload matching ideas" disabled={Boolean(saving)} onPress={()=>setAttempt(value=>value+1)} style={s.button}><Text style={s.link}>Try again</Text></Pressable></>:null}
    {!loading && !error && !ideas.length?<Text style={s.body}>No matching ideas are available right now. Your current project is unchanged.</Text>:null}
    {!loading && ideas.length?<UpcyclingIdeaChoices material={source?.material || project.material} ideas={ideas} selectedId={project.recommendation_id} busyId={saving} changing onChoose={id=>{choose(id);}}/>:null}
    <Pressable accessibilityRole="button" accessibilityLabel="Keep current idea" disabled={Boolean(saving)} onPress={onCancel} style={s.button}><Text style={s.link}>Keep current idea</Text></Pressable>
  </View>;
}
const s=StyleSheet.create({photo:{width:'100%',height:170,borderRadius:16,marginBottom:12,backgroundColor:'#edf3ef'},body:{fontSize:16,lineHeight:25,color:'#35483e',marginBottom:10},button:{minHeight:48,justifyContent:'center',paddingVertical:12},link:{fontSize:16,fontWeight:'700',color:'#176b45'},error:{fontSize:16,lineHeight:24,color:'#a12622'}});
