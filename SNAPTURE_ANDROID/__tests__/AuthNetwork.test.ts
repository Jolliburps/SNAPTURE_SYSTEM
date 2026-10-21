import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser, registerUser } from '../src/api';

const previousFetch=globalThis.fetch;
afterEach(async()=>{globalThis.fetch=previousFetch;jest.useRealTimers();await AsyncStorage.clear();});

test.each([loginUser,registerUser])('auth network failures show USB/backend guidance without retries or saved credentials',async operation=>{
  globalThis.fetch=jest.fn().mockRejectedValue(new TypeError('Network request failed'));
  await expect(operation('test@example.com','test-password')).rejects.toThrow('Cannot connect to the SNAPTURE server. Keep the USB cable connected');
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getItem('snapture_api_token')).toBeNull();
});

test('backend authentication errors stay separate from connectivity errors',async()=>{
  globalThis.fetch=jest.fn().mockResolvedValue({ok:false,json:async()=>({detail:'Invalid credentials'})});
  await expect(loginUser('test@example.com','test-password')).rejects.toThrow('Invalid credentials');
});

test('an unreachable auth request times out and releases its pending operation',async()=>{
  jest.useFakeTimers();
  globalThis.fetch=jest.fn().mockImplementation((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')))));
  const failure=loginUser('test@example.com','test-password').catch(error=>error);
  await jest.advanceTimersByTimeAsync(30000);
  expect((await failure).message).toBe('The server took too long to respond. Please try again.');
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});
