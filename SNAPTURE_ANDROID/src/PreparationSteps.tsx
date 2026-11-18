import React,{useState} from 'react';
import {Pressable,Text,View,StyleSheet} from 'react-native';
import {type PreparationPlan} from './materialPreparation';

export default function PreparationSteps({plan,busy,onComplete,onEdit}:{plan:PreparationPlan;busy:boolean;onComplete?:()=>void;onEdit:()=>void}){
  const [reviewing,setReviewing]=useState(false);
  if(plan.blocked)return <View style={s.card}><Text style={s.title}>{plan.title}</Text><Text style={s.body}>{plan.blocked}</Text>
    <Pressable accessibilityRole="button" onPress={onEdit} disabled={busy}><Text style={s.link}>Check item details</Text></Pressable></View>;
  return <View style={s.card}><Text style={s.title}>{plan.title}</Text>
    {!reviewing?<>
      {plan.steps.map((step,index)=><Text key={step} style={[s.body,s.step]}>{index+1}. {step}</Text>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Preparation finished" disabled={busy} onPress={()=>setReviewing(true)} style={s.button}><Text style={s.buttonText}>Preparation finished</Text></Pressable>
    </>:<>
      <Text style={s.title}>Is it ready now?</Text>
      <Text style={s.body}>Is the usable material clean, completely dry and free of mold or known chemical contamination? If you found damage, update its condition so we can match suitable projects.</Text>
      {onComplete?<Pressable accessibilityRole="button" accessibilityLabel="Confirm preparation readiness" disabled={busy} onPress={onComplete} style={[s.button,busy && s.disabled]}>
        <Text style={s.buttonText}>{busy?'Checking...':'Yes - show suitable ideas'}</Text></Pressable>:null}
      <Pressable accessibilityRole="button" accessibilityLabel="Not ready yet" disabled={busy} onPress={()=>setReviewing(false)}><Text style={s.link}>Not yet - review preparation</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Correct preparation condition" disabled={busy} onPress={onEdit}><Text style={s.link}>Change condition</Text></Pressable>
    </>}

  </View>;
}
const s=StyleSheet.create({card:{padding:16,borderRadius:16,borderWidth:1,borderColor:'#dce9df',backgroundColor:'#fff',marginTop:16},
  title:{fontSize:20,fontWeight:'700',color:'#143f30',marginBottom:8},body:{fontSize:15,lineHeight:22,color:'#35483e'},
  step:{paddingVertical:12,minHeight:48},small:{fontSize:12,lineHeight:18,color:'#57645d',marginTop:8},
  button:{backgroundColor:'#176b45',padding:15,borderRadius:12,marginTop:16},buttonText:{fontWeight:'700',color:'#fff',textAlign:'center'},
  disabled:{opacity:.5},link:{color:'#176b45',fontWeight:'700',paddingVertical:14}});
