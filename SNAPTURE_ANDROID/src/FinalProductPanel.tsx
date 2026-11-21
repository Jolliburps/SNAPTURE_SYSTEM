import React from 'react';
import {Alert,View} from 'react-native';
import Text from './PublicText';
import {launchCamera} from 'react-native-image-picker';
import {Action,PrivatePhoto,u} from './UpcyclingUI';
import {upcyclingRequest,type PhotoProject} from './upcyclingApi';

export default function FinalProductPanel({project,busy,onRequest,onChange}:{project:PhotoProject;busy:boolean;onRequest:(fn:()=>Promise<void>)=>void;onChange:(project:PhotoProject)=>void}){
  const latest=project.final_assessments?.[0];
  const submit=()=>onRequest(async()=>{
    const photo=await launchCamera({mediaType:'photo',quality:.8,maxWidth:2000,maxHeight:2000,saveToPhotos:false});
    if(photo.didCancel)return;
    if(!photo.assets?.[0]?.uri)throw new Error(photo.errorMessage || 'Camera unavailable.');
    const response=await upcyclingRequest<{project:PhotoProject}>(`projects/${project.id}/final/`,'POST',undefined,{uri:photo.assets[0].uri,...(project.verification_capabilities?.human_assisted?{fields:{final_confirmed:'true'}}:{})});
    onChange(response.project);
  });
  return <View style={u.card}>
    <Text style={u.heading}>{project.verification_capabilities?.human_assisted?'Finished-product documentation':'Finished-product assessment'}</Text>
    {project.verification_capabilities?.human_assisted?<Text style={u.body}>Inspect your work against every instruction, then explicitly confirm and submit a new whole-product photo. This is user-confirmed completion.</Text>:null}
    <Text style={u.body}>Show the whole product in a new photo after all steps are {project.verification_capabilities?.human_assisted?'user-confirmed':'verified'}. This submission is separate from the last step evidence.</Text>
    <Text style={u.small}>Use a clear angle that shows the required components. If a feature is hidden, submit another useful angle. Colour or decoration need not match a reference unless required by the project.</Text>
    {!project.verification_capabilities?.human_assisted && !project.verification_capabilities?.final_available?<Text style={u.body}>Automatic final assessment is unavailable or published final criteria are incomplete. Evidence can be recorded, but completion remains locked.</Text>:null}
    {latest?<View>
      <PrivatePhoto path={latest.image_url} label="Whole finished-product submission"/>
      <Text accessibilityRole="header" style={u.heading}>{latest.title}</Text><Text style={u.body}>{latest.feedback}</Text>
      {latest.criteria.map(row=><View key={row.id}><Text style={u.fieldLabel}>{row.id.replace(/_/g,' ')}: {row.status.replace(/_/g,' ')}</Text><Text style={u.small}>{row.evidence}</Text></View>)}
      <Text style={u.small}>{project.verification_capabilities?.human_assisted?'User-confirmed documentation; not AI-verified.':latest.validated?'Assessed against published visible criteria.':'Not verified.'} Photos do not certify safety, strength or functionality.</Text>
      {latest.verdict!=='meets_requirements' && !(project.verification_capabilities?.human_assisted && latest.verdict==='user_confirmed')?<Text style={u.body}>This project stays In Progress. Follow the feedback, then submit corrected work or a clearer angle.</Text>:null}
      {latest.status==='unavailable'?<Action title="Recheck final evidence" disabled={busy} onPress={()=>onRequest(async()=>{const response=await upcyclingRequest<{project:PhotoProject}>(`projects/${project.id}/final/`,'POST',{recheck_assessment_id:latest.id});onChange(response.project);})}/>:null}
    </View>:null}
    <Action title={latest?'Submit a corrected product or another angle':'Photograph the whole finished product'} variant="primary" disabled={busy} onPress={()=>{if(project.verification_capabilities?.human_assisted){Alert.alert('Confirm the finished product','Inspect the whole product against the listed instructions. This records your confirmation, not an AI verdict.',[{text:'Cancel',style:'cancel'},{text:'I confirm - take photo',onPress:submit}]);}else submit();}}/>
  </View>;
}

