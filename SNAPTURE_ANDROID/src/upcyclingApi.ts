import {API_BASE_URL,getStoredToken,type UserProject,type Recommendation,type ScanDetails} from './api';

export type SuggestedProject=Recommendation & {status:string;preliminary:boolean;can_start:boolean;missing_information:string[];reasons:string[];requirements:Record<string,any>;available_quantity:number|null;additional_quantity:number|null;requirements_source?:string;requires_project_review?:boolean};
export type AssessmentFeedback={code:string;title:string;message:string};
export type AssessmentVerdict={code:string;title:string;reason:string;next_action:string;can_start:boolean;blocking_reasons:string[];required_input?:'exposure'|'closeup'|'exposure_and_closeup'|'moisture_and_closeup'|'usable_quantity'|'project_requirements'};
export type WorkflowState={safety_acknowledged?:boolean;inspection_confirmed?:boolean;usable_quantity?:number;moisture_cause?:string;preparation_completed?:boolean;preparation_required?:boolean;reassessment_required?:boolean;human_condition_confirmed?:boolean};
export type Suggestions={verdict?:AssessmentVerdict;assessment_feedback?:AssessmentFeedback[];items:SuggestedProject[];outcome:string;message:string;facts:Record<string,any>;fact_sources?:Record<string,string>};
export type Lot={id:number;prediction_id:number|null;material:string;quantity:number;consumed:number;available:number;attributes:Record<string,any>};
export type Completion={id:number;project_id:number;name:string;image_url:string;materials:Array<{name:string;quantity:number}>;completed_at:string;description:string;verification_status:string;usage:Array<{lot_id:number;quantity:number}>};
export type FinalAssessment={id:number;image_url:string;verdict:string;title:string;criteria:Array<{id:string;status:string;evidence:string}>;feedback:string;status:string;validated:boolean;model?:string;created_at:string};
export type PhotoProject=UserProject & {final_assessments?:FinalAssessment[];verification_capabilities?:{human_assisted?:boolean;manual_confirmation_available?:boolean;step_available:boolean;final_available:boolean;reason:string};step_criteria?:Array<{id:string;instruction:string}>;completion_record?:Completion|null;step_photos?:Array<{id:number;step_index:number;image_url:string;status:string;assessment:{status?:string;feedback?:string;message?:string;verdict?:string;criteria?:Array<{id:string;status:string;evidence:string}>}}>};
export type VisualAssessment={verdict?:AssessmentVerdict;scan_details?:ScanDetails;workflow?:WorkflowState;capability?:{condition_assessment:string};primary_view?:string|null;primary:{status:string;message?:string};observations:Array<{field:string;value:string;source:string;certainty:string}>;conflicts:string[];views:Array<{id:number;view:string;image_url:string|null;warnings?:string[]}>;facts:Record<string,{value:unknown;source:string}>;limits:string};
export type Program={id:number;organization_id:number;organization:string;title:string;description:string;eligibility:string;guidelines:string;accepted_materials:string[];criteria:Array<{name:string;maximum:number}>;starts_at:string;ends_at:string;awards:string};
export type Submission={id:number;program_id:number;project:Completion;program:Program;status:string;scores:Record<string,number>;feedback:string;recognition:string;reviewer:string|null;total:number|null};

export async function upcyclingRequest<T>(path:string,method='GET',value?:unknown,photo?:{uri:string;fields?:Record<string,string>}):Promise<T>{
  const token=await getStoredToken();if(!token)throw new Error('Please log in.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),180000);
  const headers:Record<string,string>={Authorization:`Bearer ${token}`};let body:RequestInit['body'];
  if(photo){const data=new FormData();data.append('image',{uri:/^(file|content):/.test(photo.uri)?photo.uri:`file://${photo.uri}`,name:'item.jpg',type:'image/jpeg'} as unknown as Blob);Object.entries(photo.fields || {}).forEach(([key,v])=>data.append(key,v));body=data;}
  else if(value!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(value);}
  try{const response=await fetch(`${API_BASE_URL}/upcycling/${path}`,{method,headers,body,signal:controller.signal});const result=await response.json();if(!response.ok)throw new Error(result.detail || 'Request failed.');return result;}
  catch(error){if(controller.signal.aborted)throw new Error('The request timed out. Refresh before retrying.');throw error;}
  finally{clearTimeout(timer);}
}
export const getSuggestions=(id:number,goal='',inventory=false)=>upcyclingRequest<Suggestions>(`predictions/${id}/projects/?goal=${encodeURIComponent(goal)}&inventory=${inventory}`);
export const getVisual=(id:number)=>upcyclingRequest<{assessment:VisualAssessment;prediction?:import('./api').Prediction}>(`predictions/${id}/assessment/`);
export const saveFacts=(id:number,facts:Record<string,unknown>)=>upcyclingRequest(`predictions/${id}/assessment/`,'PATCH',{facts});
export const startSuitable=(id:number,recommendation_id:string,inventory=false)=>upcyclingRequest<{project:PhotoProject}>(`predictions/${id}/projects/?inventory=${inventory}`,'POST',{recommendation_id});
export const listInventory=()=>upcyclingRequest<{lots:Lot[]}>('inventory/');
export const getPhotoProject=(id:number)=>upcyclingRequest<{project:PhotoProject}>(`projects/${id}/`);
export const listCompletions=()=>upcyclingRequest<{completions:Completion[]}>('completions/');
export const getCommunity=()=>upcyclingRequest<{programs:Program[];review_programs:Program[];memberships:Array<{organization_id:number;name:string;role:string}>;submissions:Submission[]}>('community/');
