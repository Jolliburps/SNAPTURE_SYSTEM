import AsyncStorage from '@react-native-async-storage/async-storage';

// Development address for the USB-connected phone on the current Wi-Fi.
// Replace this if the computer's LAN IPv4 address changes. Use 10.0.2.2 for
// the Android emulator instead.
export const API_BASE_URL = 'http://192.168.1.217:8000/api';
const TOKEN_KEY = 'snapture_api_token';

export type ApiUser = {
  id: number;
  email: string;
  display_name: string;
  barangay: string;
  profile_picture_url: string | null;
  role: 'regular' | 'admin';
};

export type PredictionSummary = {
  id: number;
  title: string;
  confidence: number;
  created_at: string;
  image_url: string | null;
  selected_recommendation: string;
  recommendation_choices?: Recommendation[];
};

export type Recommendation = {
  id: string;
  title: string;
  summary: string;
  materials: string[];
  steps: string[];
  quantity_note?: string;
  safety_note?: string;
};

export type UserProject = {
  id: number;
  source_prediction_id: number | null;
  recommendation_id: string;
  title: string;
  material: string;
  summary: string;
  materials: string[];
  steps: string[];
  safety_note: string;
  completed_steps: number[];
  completed_count: number;
  total_steps: number;
  progress_percent: number;
  status: 'active' | 'completed';
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
};

export type Prediction = PredictionSummary & {
  model_class: string;
  raw_model_class?: string;
  decision: string;
  label: string;
  threshold: number;
  model_version: string;
  quantity: number | null;
  condition: string;
  previous_contents: string;
  answers: Record<string, unknown>;
  recommendation_choices: Recommendation[];
  needs_verification?: boolean;
  verification_reasons?: string[];
  alternatives?: Array<{ class: string; confidence: number }>;
};

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
  const response = await fetch(`${API_BASE_URL}/auth/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, display_name: displayName, barangay }),
  });
  const payload = await parseResponse<AuthResponse>(response);
  await AsyncStorage.setItem(TOKEN_KEY, payload.token);
  return payload;
}

export async function loginUser(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/login/`, {
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

export async function startProject(predictionId: number) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in to start a project.');
  const response = await fetch(`${API_BASE_URL}/projects/`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prediction_id: predictionId }),
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

export async function getAdminOverview() {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in as an administrator.');
  const response = await fetch(`${API_BASE_URL}/auth/admin/overview/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<AdminOverview>(response);
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
  const payload = await getPredictionOverview();
  return payload.predictions;
}

export async function getPredictionOverview() {
  const token = await getStoredToken();
  if (!token) return { predictions: [], total_count: 0 };
  const response = await fetch(`${API_BASE_URL}/predictions/`, {
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
  const response = await fetch(`${API_BASE_URL}/predictions/create/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return parseResponse<{ prediction: Prediction; result: Record<string, unknown>; recommendations: Recommendation[] }>(response);
}

export async function updatePrediction(predictionId: number, fields: Record<string, unknown>) {
  const token = await getStoredToken();
  if (!token) throw new Error('Please log in before updating a prediction.');
  const response = await fetch(`${API_BASE_URL}/predictions/${predictionId}/`, {
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
  const response = await fetch(`${API_BASE_URL}/predictions/${predictionId}/recommendation/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recommendation_id: recommendationId }),
  });
  return parseResponse<{ prediction: Prediction }>(response);
}
