import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, updateMyProfile } from '../src/api';

const previousFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = previousFetch; });

test('existing profile service sends only barangay using authenticated JSON PATCH', async () => {
  await AsyncStorage.setItem('snapture_api_token', 'test-token');
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { barangay: 'Molino 2' } }) });
  const result = await updateMyProfile({ barangay: 'Molino 2' });
  expect(globalThis.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/auth/me/`, {
    method: 'PATCH', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ barangay: 'Molino 2' }),
  });
  expect(result.user.barangay).toBe('Molino 2');
});

test('existing service propagates backend validation errors, never inventing success', async () => {
  await AsyncStorage.setItem('snapture_api_token', 'test-token');
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'Invalid barangay' }) });
  await expect(updateMyProfile({ barangay: 'Molino 2' })).rejects.toThrow('Invalid barangay');
});
