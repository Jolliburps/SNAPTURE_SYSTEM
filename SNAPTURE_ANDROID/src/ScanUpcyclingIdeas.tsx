import React, { useContext, useRef, useState } from 'react';
import { startProject, type Prediction } from './api';
import { ProjectFlowContext } from './ProjectFlowContext';
import UpcyclingIdeaChoices from './UpcyclingIdeaChoices';

export default function ScanUpcyclingIdeas({prediction}:{prediction:Prediction}) {
  const openProject=useContext(ProjectFlowContext);
  const [starting,setStarting]=useState('');
  const [error,setError]=useState('');
  const busy=useRef(false);
  const ideas=(prediction.upcycling_ideas || []).filter(idea=>idea.steps?.length);
  const choose=async(id:string)=>{
    if(busy.current)return;
    if(!openProject){setError('Reopen this scan from the app to start a project.');return;}
    busy.current=true;setStarting(id);setError('');
    try{
      const result=await startProject(prediction.id,id);
      openProject(result.project);
    }catch(reason){setError(reason instanceof Error?reason.message:'Unable to start this task. Try again.');}
    finally{busy.current=false;setStarting('');}
  };
  if(!ideas.length)return null;
  return <UpcyclingIdeaChoices material={prediction.assessment?.material.title || prediction.title} ideas={ideas} busyId={starting} error={error} onChoose={id=>{choose(id);}}/>;
}
