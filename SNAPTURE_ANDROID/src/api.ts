import AsyncStorage from '@react-native-async-storage/async-storage';

// The physical-phone prototype reaches the computer through `adb reverse`.
// Run `adb reverse tcp:8000 tcp:8000` while the USB debugging cable is attached.
// Use 10.0.2.2 instead when running on the Android emulator.
export const API_BASE_URL = 'http://127.0.0.1:8000/api';
const TOKEN_KEY = 'snapture_api_token';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch {
    throw new Error(controller.signal.aborted?'The server took too long to respond. Please try again.':'Cannot connect to the SNAPTURE server. Keep the USB cable connected and restore the phone connection on the PC. Make sure the backend is running.');
  } finally {
    clearTimeout(timeout);
  }
}

export type ApiUser = {
  id: number;
  email: string;
  display_name: string;
  barangay: string;
  profile_picture_url: string | null;
  role: 'regular' | 'admin';
};

export type PredictionSummary = {
  input_method?: 'camera' | 'manual';
  id: number;
  title: string;
  confidence: number;
  created_at: string;
  image_url: string | null; 
  scene_id?: number | null;
  item_count?: number;
  original_image_url?: string | null;
  saved_assessment_available?: boolean;
  selected_recommendation: string;
  recommendation_choices?: Recommendation[];
};

export type TutorialPhoto = {
  url: string | null;
  step_index?: number;
  source_stage: number | 'finished';
  photo_status: string;
  visual_type?: string;
  visual_note?: string;
  original_image_url?: string | null;
  source_step_url?: string;
};

export type TutorialPhotos = {
  version: string;
  source_id: string;
  source_url: string;
  credit: string;
  photo_rights: string;
  finished: TutorialPhoto;
  steps: TutorialPhoto[];
};

export type Recommendation = {
  id: string;
  title: string;
  summary: string;
  materials: string[];
  steps: string[];
  quantity_note?: string;
  safety_note?: string;
  photos?: TutorialPhotos;
  basis?: 'educational_catalog';
  review?: {review_level?:string;source?:string;review_note?:string;digest?:string};
};

export type IdeaReference = Recommendation & {status:'source_checked'|'awaiting_review'|'educational';can_start:false;source:string;review_note:string;conditions:string[]};

export type UserProject = {
  photo_workflow?:boolean;
  completion_photo_url?:string|null;
  completion_id?:number|null;
  completion_verification?:string|null;
  id: number;
  source_prediction_id: number | null;
  recommendation_id: string;
  title: string;
  material: string;
  summary: string;
  materials: string[];
  steps: string[];
  safety_note: string;
  reference?: {source?:string;review_level?:string;reviewed_at?:string;key?:string;version?:number;digest?:string;photos?:TutorialPhotos;suitability_requirements?:{checkpoint_criteria?:string[]}};
  completed_steps: number[];
  completed_count: number;
  total_steps: number;
  progress_percent: number;
  status: 'active' | 'completed';
  can_change_idea?: boolean;
  created_at: string;
  updated_at: string;
};

export type MaterialGuide = {
  label: string;
  title: string;
  short_title: string;
  description: string;
  examples: string[];
  preparation: string[];
  recycling: string;
  disposal: string;
  model_status: string;
  upcycling: Recommendation[];
  photo_ideas?: IdeaReference[];
  home_tutorials?: IdeaReference[];
  idea_references?: IdeaReference[];
};

export type Prediction = PredictionSummary & {
  scan_snapshot_available?:boolean;
  screening?: ScreeningResult; screening_revision?:string;
  focus_box?: number[] | null;
  recognition?: {status:'supported'|'needs_review'|'unsupported';suggested_label:string|null;reason:string;unavailable?:boolean};
  waste_identifier?: WasteIdentity | null;
  review_contribution?: string | null;
  image_quality?: ImageQuality;
  input_method?: 'camera' | 'manual';
  assessment?: Assessment | null;
  model_class: string;
  raw_model_class?: string;
  decision: string;
  label: string;
  threshold: number;
  model_version: string;
  experimental_model?: boolean;
  quantity: number | null;
  condition: string;
  previous_contents: string;
  answers: Record<string, unknown>;
  recommendation_choices: Recommendation[];
  upcycling_ideas?: Recommendation[];
  needs_verification?: boolean;
  verification_reasons?: string[];
  alternatives?: Array<{ class: string; confidence: number }>;
};

export type AssessmentQuestion = { id: string; label: string; options: string[]; required: boolean };
export type WasteIdentity = {
  box: number[] | null; fine_class: string | null; category: string; category_label: string;
  suggested_category: string; category_basis: string; target_material: string | null; confidence: number;
  condition: string; safety_gate_passed: boolean; needs_confirmation: boolean;
  top_predictions: { label: string; score: number }[]; handling_steps: string[];
  general_guidance?: { status: string; instructions: string[]; source: { name: string; url: string; section: string; date: string | null } };
};
export type ImageQuality = { flags: { code: string; message: string }[]; limitations: string; automatic_routing?:boolean };
export type CaptureFrame = { aspect: number; x: number; y: number; width: number; height: number };
export type ObjectIdentification = {
  object_prediction: {name:string;confidence:number|null;source:string;score_kind:string};
  user_object_name:string;material_prediction:{label:string;title:string;confidence:number|null;status:string;basis:string};
  ai_waste_category:string|null;selected_for_disposal:boolean;
};
export type HandlingAdvice = ObjectIdentification & {
  version:string;route:string;title:string;explanation:string;instructions:string[];
  sources:Array<{title?:string;url?:string;source?:string;review_level?:string}>;
  upcycling_eligible:boolean;recommendations:Recommendation[];verification_status:string;
};
export type ItemAction='keep'|'discard'|'recover';
export type ActionAdvice={version:string;chosen_action:ItemAction|null;condition:string;suggested_action:string;title:string;steps:string[];caution:string;status:string;waste_group:string;projects:Recommendation[];sources:Array<{title:string;url?:string;status?:string}>;composition_note?:string};
export type SceneItem = { id: number; box: number[]; name: string; display_name?:string; name_confirmation_required?:boolean; score: number; prediction: Prediction; route: { key: string; label: string; reason: string }; suggested_group?: string; display_box?: boolean; display_group?: string; low_confidence?: boolean; background?: boolean; review_reason?: string;detection_status?:'accepted'|'review'|'excluded'|'duplicate'|'material_only';duplicate_of?:number;identification?:ObjectIdentification;handling?:HandlingAdvice;action_advice?:ActionAdvice;automatic_route?:{enabled?:boolean;action:'discard'|'recover';needs_review:boolean;confirmation_required:boolean;label:string;note:string} };
export type ScanScene = { id: number; image_url: string; created_at?: string; width: number; height: number; frame: number[]; single_item?:{enabled:boolean;status?:string}; status: string; error: string; quality: ImageQuality; items: SceneItem[]; truncated: boolean; detector: string; limitations: string; background_objects?: { name: string; count: number }[];disposal_selection?:{confirmed:boolean;item_ids:number[];confirmed_at?:string;item_actions?:Record<number,ItemAction>;item_conditions?:Record<number,string>} };
export const imageUrl = (uri: string) => {
  const url=uri.startsWith('/') ? `${API_BASE_URL.replace(/\/api$/, '')}${uri}` : uri;
  // Refresh older cached responses after automatic face blurring was disabled.
  return /\/media\/(scenes|predictions)\//.test(url)?`${url}${url.includes('?')?'&':'?'}photo=unblurred-v1`:url;
};

export async function preparePrivatePreview(uri:string) {
  const token=await getStoredToken();
  if(!token)throw new Error('Please log in to prepare a private photo preview.');
  const data=new FormData();
  data.append('image',{uri:/^(file|content):/.test(uri)?uri:`file://${uri}`,name:'privacy-preview.jpg',type:'image/jpeg'} as unknown as Blob);
  return parseResponse<{preview_uri:string;faces_blurred:number;version:string}>(await fetchWithTimeout(`${API_BASE_URL}/photo-privacy/preview/`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:data},60000));
}

export async function addSceneRegion(id: number, box: number[], requestId: string) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in before reviewing a scan.');
  return parseResponse<{ scene: ScanScene }>(await fetchWithTimeout(`${API_BASE_URL}/scenes/${id}/items/`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ box, request_id: requestId }),
  }));
}

export async function confirmDisposalSelection(id:number,itemIds:number[],objectNames:Record<number,string>,itemActions?:Record<number,ItemAction>,itemConditions?:Record<number,string>,automaticRouting=false) {
  const token=await getStoredToken();
  if(!token)throw new Error('Please log in before confirming items.');
  return parseResponse<{scene:ScanScene}>(await fetchWithTimeout(`${API_BASE_URL}/scenes/${id}/disposal-selection/`,{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({item_ids:itemIds,object_names:objectNames,...(itemActions?{item_actions:itemActions}:{}),...(itemConditions?{item_conditions:itemConditions}:{}),...(automaticRouting?{automatic_routing:true}:{})}),
  }));
}

export async function contributeIdentification(id: number, withdraw = false) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in before contributing.');
  return parseResponse<{ status?: string; withdrawn?: boolean }>(await fetchWithTimeout(`${API_BASE_URL}/predictions/${id}/review-contribution/`, {
    method: withdraw ? 'DELETE' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(withdraw ? {} : { body: JSON.stringify({ consent: true }) }),
  }));
}

export type ReportedConcern='minor_damage'|'dirt'|'wet'|'contamination'|'unknown';
export type ScanDetails={assessment_mode?:'ai'|'human_assisted';human_assisted_acknowledged?:boolean;mode:'single'|'batch';quantity:number;approximate_size:string;category_hint?:string;inspection_report?:'none_seen'|'concern_photo';previous_contents?:string;moisture_cause?:string;usable_quantity?:number;condition_policy?:'inspection-first-v1';reported_concern?:ReportedConcern;capture_mode?:'all-sides-v1'|'material-guided-v1'};

export type PreviewMaterialScore={label:string;score:number};
export type OutsideItemView='back'|'left'|'right'|'side'|'top'|'bottom';
export type MaterialPreview=(
  {status:'supported';label:string;token?:string;resinCode?:'1'|'2'} |
  {status:'out_of_scope';disposal_token?:string} |
  {status:'special_handling';handling_kind?:'separate'|'hazardous'} |
  {status:'photo_review'|'unavailable'}
) & {reason:string;box?:[number,number,number,number];image_width?:number;image_height?:number;crop_scores?:PreviewMaterialScore[];guide_scores?:PreviewMaterialScore[];resin_review_token?:string;capture_plan?:{views:OutsideItemView[];inside:boolean}};

export async function previewScanMaterial(uri:string,frame:CaptureFrame) {
  const token=await getStoredToken();
  if(!token)throw new Error('Please log in before checking the material.');
  const data=new FormData();
  data.append('image',{uri:/^(file|content):/.test(uri)?uri:`file://${uri}`,name:'capture.jpg',type:'image/jpeg'} as unknown as Blob);
  data.append('frame',JSON.stringify(frame));
  return parseResponse<MaterialPreview>(await fetchWithTimeout(`${API_BASE_URL}/scenes/material-preview/`,{
    method:'POST',headers:{Authorization:`Bearer ${token}`},body:data,
  },90000));
}

export async function createScene(uri: string, requestId: string, frame?: CaptureFrame, singleItem=false, session?:{primaryView:string;views:Array<{view:string;uri:string;frame:CaptureFrame}>;details?:ScanDetails;previewToken?:string;resinCode?:'1'|'2';concernPhotos?:Array<{uri:string;frame:CaptureFrame}>}) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in before analyzing.');
  const data = new FormData();
  data.append('image', { uri: /^(file|content):/.test(uri) ? uri : `file://${uri}`, name: 'capture.jpg', type: 'image/jpeg' } as unknown as Blob);
  data.append('request_id', requestId);
  if (frame) data.append('frame', JSON.stringify(frame));
  if (singleItem) data.append('single_item','1');
  if(session){
    if(session.concernPhotos?.length){
      session.concernPhotos.forEach(({uri:concern},index)=>{
        data.append('concern_photo',{uri:/^(file|content):/.test(concern)?concern:`file://${concern}`,name:`concern-${index+1}.jpg`,type:'image/jpeg'} as unknown as Blob);
      });
      data.append('concern_frames',JSON.stringify(session.concernPhotos.map(photo=>photo.frame)));
    }
    if(session.previewToken)data.append('material_preview_token',session.previewToken);
    if(session.resinCode)data.append('resin_code',session.resinCode);
    if(session.details)data.append('scan_details',JSON.stringify(session.details));
    data.append('primary_view',session.primaryView);data.append('same_item_confirmed','true');
    data.append('view_names',JSON.stringify(session.views.map(v=>v.view)));data.append('view_frames',JSON.stringify(session.views.map(v=>v.frame)));
    session.views.forEach(v=>data.append('additional_views',{uri:/^(file|content):/.test(v.uri)?v.uri:`file://${v.uri}`,name:`${v.view}.jpg`,type:'image/jpeg'} as unknown as Blob));
  }
  const photoCount = (session?.views.length ?? 0) + (session?.concernPhotos?.length ?? 0);
  const response = await fetchWithTimeout(`${API_BASE_URL}/scenes/`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: data }, 180000+120000*photoCount);
  return parseResponse<{ scene: ScanScene }>(response);
}

export async function getScene(id: number) {
  const token = await getStoredToken();
  return parseResponse<{ scene: ScanScene }>(await fetchWithTimeout(`${API_BASE_URL}/scenes/${id}/`, { headers: { Authorization: `Bearer ${token}` } }));
}

export async function listScenes() {
  const token = await getStoredToken();
  return parseResponse<{ scenes: ScanScene[] }>(await fetchWithTimeout(`${API_BASE_URL}/scenes/`, { headers: { Authorization: `Bearer ${token}` } }));
}

export async function deleteScene(id: number) {
  const token = await getStoredToken();
  return parseResponse<{ deleted: boolean }>(await fetchWithTimeout(`${API_BASE_URL}/scenes/${id}/`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }));
}
export type LearningEntry = { key: string; version: number; title: string; category: string; summary: string; instructions: string[]; warnings: string; source: string; review_note: string; review_level: string; content_type?: 'policy' | 'material'; file_url?: string | null; material_type?: 'PDF Guide' | 'Infographic' | 'Video'; effective_date?: string; updated_at?: string };

export function publicFileUrl(path: string) {
  // File routes are relative to the server origin, not to /api.
  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  return path.startsWith('/') && !path.startsWith('//') ? `${origin}${path}` : '';
}

export type Announcement = { id: string; title: string; description: string; category: string; publishedAt: string };
export async function getAnnouncements() {
  return parseResponse<{ entries: Announcement[] }>(await fetchWithTimeout(`${API_BASE_URL}/announcements/`));
}

export async function getLearningInformation() {
  const response = await fetchWithTimeout(`${API_BASE_URL}/learning/`);
  return parseResponse<{ entries: LearningEntry[] }>(response);
}
export type CollectionEntry = { id?: string; date: string; barangay: string; title: string; status: string; description?: string; source: string };

export async function getCollectionNotices(month: string) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in to view collection information.');
  const response = await fetchWithTimeout(`${API_BASE_URL}/collection/?month=${encodeURIComponent(month)}`, { headers: { Authorization: `Bearer ${token}` } });
  return parseResponse<{ entries: CollectionEntry[]; status: string }>(response);
}
export type GuidanceSource = { key: string; version: number; source: string; review_level: string; review_note: string };
export type Assessment = {
  screening?: ScreeningResult;
  management_guidance?: {
    version:string; material_label:string; status:string; notice:string; legacy_supplement?:boolean;
    sections:{key:string;title:string;instructions:string[]}[];
    sources:{title:string;url:string}[]; source_checked_on:string;
  };
  quick_check?: { has_sorting_rule: boolean; has_reviewed_projects: boolean; sorting_question_ids: string[]; project_question_ids: string[]; sorting_complete: boolean; user_reviewed?: boolean };
  version: string;
  material: { label: string; title: string; status: string; explanation: string; input_method: string };
  questions: AssessmentQuestion[];
  missing_information: string[];
  segregation: { status: string; category: string | null; instructions: string[]; explanation: string; sources: GuidanceSource[] };
  upcycling: { status: string; explanation: string; recommendations: Recommendation[] };
  context: Record<string, unknown>;
  safety?: { title: string; explanation: string; instructions: string[]; sources: GuidanceSource[] } | null;
};

export async function createManualPrediction(label: string) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in before assessing an item.');
  const response = await fetchWithTimeout(`${API_BASE_URL}/predictions/manual/`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });
  return parseResponse<{ prediction: Prediction }>(response);
}

export async function getAssessmentQuestions(label: string) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in before checking an item.');
  return parseResponse<{ label: string; questions: AssessmentQuestion[]; quick_check?: Assessment['quick_check'] }>(await fetchWithTimeout(`${API_BASE_URL}/predictions/questions/${encodeURIComponent(label)}/`, { headers:{ Authorization:`Bearer ${token}` } }));
}

export type AdminPredictionSummary = {
  id: number;
  reference: string;
  title: string;
  decision: string;
  confidence: number;
  created_at: string;
};

export type AdminOverview = {
  users_count: number;
  predictions_count: number;
  admin_count: number;
  category_counts: Record<string, number>;
  recent_predictions: AdminPredictionSummary[];
};

export type AdminPredictionDetail = {
  id: number;
  reference: string;
  user_id: number;
  title: string;
  decision: string;
  model_class: string;
  confidence: number;
  threshold: number;
  model_version: string;
  quantity: number | null;
  condition: string;
  previous_contents: string;
  answers: Record<string, unknown>;
  selected_recommendation: string;
  created_at: string;
  image_url: string | null;
};

type AuthResponse = { user: ApiUser; token: string };

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof payload?.detail === 'string' ? payload.detail : 'The request failed.';
    throw new Error(detail);
  }
  return payload as T;
}

export async function registerUser(email: string, password: string, displayName = '', barangay = '') {
  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, display_name: displayName, barangay }),
  });
  const payload = await parseResponse<AuthResponse>(response);
  await AsyncStorage.setItem(TOKEN_KEY, payload.token);
  return payload;
}

export async function loginUser(email: string, password: string) {
  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const payload = await parseResponse<AuthResponse>(response);
  await AsyncStorage.setItem(TOKEN_KEY, payload.token);
  return payload;
}

export async function requestPasswordReset(email: string) {
  const response = await fetch(`${API_BASE_URL}/auth/password-reset/request/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return parseResponse<{ requested: boolean; detail: string; reset_token?: string }>(response);
}

export async function confirmPasswordReset(email: string, token: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/password-reset/confirm/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token, password }),
  });
  return parseResponse<{ reset: boolean; detail: string }>(response);
}

export async function logoutUser() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    await fetch(`${API_BASE_URL}/auth/logout/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getStoredToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getCurrentUser() {
  const token = await getStoredToken();
  if (!token) return null;
  const response = await fetch(`${API_BASE_URL}/auth/me/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    await AsyncStorage.removeItem(TOKEN_KEY);
    return null;
  }
  const payload = await parseResponse<{ user: ApiUser }>(response);
  return payload.user;
}

export async function updateMyProfile(fields: { display_name?: string; barangay?: string }) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in to update your profile.');
  const response = await fetch(`${API_BASE_URL}/auth/me/`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  return parseResponse<{ user: ApiUser }>(response);
}

export async function uploadProfilePicture(uri: string, fileName = 'profile.jpg', mimeType = 'image/jpeg') {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in to update your picture.');
  const body = new FormData();
  body.append('image', { uri, name: fileName, type: mimeType } as unknown as Blob);
  const response = await fetch(`${API_BASE_URL}/auth/me/photo/`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body,
  });
  return parseResponse<{ user: ApiUser }>(response);
}

export async function listProjects() {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in to view projects.');
  const response = await fetch(`${API_BASE_URL}/projects/`, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await parseResponse<{ projects: UserProject[] }>(response);
  return payload.projects;
}

export async function startProject(predictionId: number, recommendationId?: string) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in to start a project.');
  const response = await fetch(`${API_BASE_URL}/projects/`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prediction_id: predictionId, ...(recommendationId ? {recommendation_id:recommendationId} : {}) }),
  });
  return parseResponse<{ project: UserProject }>(response);
}

export async function setProjectStep(projectId: number, stepIndex: number, completed: boolean) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in to update a project.');
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/steps/${stepIndex}/`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  });
  return parseResponse<{ project: UserProject }>(response);
}

export async function restartProject(projectId: number) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in to restart a project.');
  return parseResponse<{ project: UserProject }>(await fetchWithTimeout(`${API_BASE_URL}/projects/${projectId}/restart/`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }));
}

export async function getProjectIdeas(projectId:number) {
  const token=await getStoredToken();
  if(!token)throw new Error('Please log in to change a project idea.');
  return parseResponse<{ideas:Array<Recommendation & {existing_project_id?:number;existing_project_status?:'active'|'completed'}>;source?:{prediction_id:number;material:string;object_name:string;image_url:string|null}}>(await fetchWithTimeout(`${API_BASE_URL}/projects/${projectId}/ideas/`,{headers:{Authorization:`Bearer ${token}`}}));
}

export async function changeProjectIdea(projectId:number,recommendationId:string) {
  const token=await getStoredToken();
  if(!token)throw new Error('Please log in to change a project idea.');
  return parseResponse<{project:UserProject}>(await fetchWithTimeout(`${API_BASE_URL}/projects/${projectId}/ideas/`,{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({recommendation_id:recommendationId}),
  }));
}

export async function getAdminOverview() {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in as an administrator.');
  const response = await fetch(`${API_BASE_URL}/auth/admin/overview/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<AdminOverview>(response);
}

export type EvaluationRate = { numerator: number; denominator: number; value: number | null; ci95: [number, number] | null };
export type EvaluationRunSummary = { id: number; name: string; split: string; dataset_version: string; frozen: boolean };
export type EvaluationReport = {
  run: EvaluationRunSummary;
  counts: { total: number; adjudicated: number; unreviewed: number; manual_excluded_from_camera: number };
  identification: { macro_f1: number | null; all_scope_classes_tested: boolean; per_material: { label: string; support: number; precision: number | null; recall: number | null; f1: number | null }[]; accepted_correctness: EvaluationRate; acceptance_coverage: EvaluationRate; review_rate: EvaluationRate; unsupported_false_acceptance: EvaluationRate };
  segregation: { correct_route: EvaluationRate; unsafe_guidance: EvaluationRate; appropriate_review: EvaluationRate; unnecessary_review: EvaluationRate };
  recommendations: { shown: number; judged: number; unjudged: number; acceptable: EvaluationRate; unsafe: EvaluationRate; eligible_cases_with_acceptable_idea: EvaluationRate; appropriate_withholding: EvaluationRate };
  warnings: string[];
};
export async function getEvaluationRuns() {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in as an administrator.');
  return parseResponse<{ runs: EvaluationRunSummary[] }>(await fetchWithTimeout(`${API_BASE_URL}/evaluations/`, { headers: { Authorization: `Bearer ${token}` } }));
}
export async function getEvaluationReport(id: number) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in as an administrator.');
  return parseResponse<EvaluationReport>(await fetchWithTimeout(`${API_BASE_URL}/evaluations/${id}/`, { headers: { Authorization: `Bearer ${token}` } }));
}

export async function getAdminPredictionDetail(predictionId: number) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in as an administrator.');
  const response = await fetch(`${API_BASE_URL}/auth/admin/predictions/${predictionId}/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<AdminPredictionDetail>(response);
}

export async function getMaterials() {
  const response = await fetch(`${API_BASE_URL}/materials/`);
  return parseResponse<{ materials: MaterialGuide[] }>(response);
}

export async function listPredictions() {
  const payload = await getPredictionOverview(true);
  return payload.predictions;
}

export async function getSavedScan(id: number) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in to view your saved scan.');
  return parseResponse<{ prediction: Prediction; scene: ScanScene | null }>(await fetchWithTimeout(`${API_BASE_URL}/predictions/${id}/?history=1`, { headers: { Authorization: `Bearer ${token}` } }));
}

export async function getPredictionOverview(grouped = false) {
  const token = await getStoredToken();
  if (!token) return { predictions: [], total_count: 0 };
  const response = await fetch(`${API_BASE_URL}/predictions/${grouped?'?grouped=1':''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<{ predictions: PredictionSummary[]; total_count: number }>(response);
}

export async function listSavedPredictions() {
  const token = await getStoredToken();
  if (!token) return [];
  const response = await fetch(`${API_BASE_URL}/predictions/saved/`, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await parseResponse<{ predictions: PredictionSummary[] }>(response);
  return payload.predictions;
}

export async function deletePrediction(predictionId: number) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in before deleting history.');
  const response = await fetch(`${API_BASE_URL}/predictions/${predictionId}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<{ deleted: boolean; id: number }>(response);
}

export async function deleteAllPredictions() {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in before deleting history.');
  const response = await fetch(`${API_BASE_URL}/predictions/clear/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<{ deleted: boolean; count: number }>(response);
}

export async function createPrediction(uri: string, fields: Record<string, string> = {}) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in before analyzing an image.');
  const formData = new FormData();
  const uploadUri = uri.startsWith('file://') || uri.startsWith('content://') ? uri : `file://${uri}`;
  formData.append('image', { uri: uploadUri, name: 'capture.jpg', type: 'image/jpeg' } as unknown as Blob);
  Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
  const response = await fetchWithTimeout(`${API_BASE_URL}/predictions/create/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return parseResponse<{ prediction: Prediction; result: Record<string, unknown>; recommendations: Recommendation[] }>(response);
}

export async function updatePrediction(predictionId: number, fields: Record<string, unknown>) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in before updating a prediction.');
  const response = await fetchWithTimeout(`${API_BASE_URL}/predictions/${predictionId}/`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fields),
  });
  return parseResponse<{ prediction: Prediction; recommendations: Recommendation[] }>(response);
}

export async function selectRecommendation(predictionId: number, recommendationId: string) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in before selecting a recommendation.');
  const response = await fetchWithTimeout(`${API_BASE_URL}/predictions/${predictionId}/recommendation/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recommendation_id: recommendationId }),
  });
  return parseResponse<{ prediction: Prediction }>(response);
}

export type ScreeningResult = {
  version?:string;
  status:'eligible'|'needs_information'|'needs_preparation'|'ineligible'|'unsupported';
  eligible:boolean;reasons:string[];missing_information:string[];
};
export type RecommendationResponse = {prediction_id:number;scene_id:number|null;revision:string;
  screening:ScreeningResult;status:'available'|'no_matching_project';recommendations:Recommendation[]};

export async function requestUpcyclingRecommendations(predictionId:number,screeningRevision?:string) {
  const token=await getStoredToken();
  if(!token)throw new Error('Please log in before requesting recommendations.');
  const response=await fetchWithTimeout(`${API_BASE_URL}/predictions/${predictionId}/recommendations/`,{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({screening_revision:screeningRevision}),
  });
  return parseResponse<RecommendationResponse>(response);
}
