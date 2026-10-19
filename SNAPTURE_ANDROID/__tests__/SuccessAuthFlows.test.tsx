import React from 'react';
import Renderer from 'react-test-renderer';
import { TextInput } from 'react-native';
import App from '../App';
import SuccessAlertDialog from '../src/SuccessAlertDialog';
import { confirmPasswordReset, getCurrentUser, loginUser, registerUser, requestPasswordReset, selectRecommendation, updatePrediction } from '../src/api';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children, SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('../src/MainExperience', () => ({ MainExperience: () => null, BottomNavigation: () => null }));
jest.mock('../src/api', () => ({ getCurrentUser: jest.fn(), loginUser: jest.fn(), registerUser: jest.fn(), confirmPasswordReset: jest.fn(), requestPasswordReset: jest.fn(), selectRecommendation: jest.fn(), updatePrediction: jest.fn() }));
const findComponent = (tree: Renderer.ReactTestRenderer, name: string) => tree.root.find(node => typeof node.type === 'function' && node.type.name === name);
const press = async (tree: Renderer.ReactTestRenderer, label: string) => {
  const button = tree.root.findAllByProps({ label }).find(node => typeof node.props.onPress === 'function')!;
  expect(button).toBeDefined();
  await Renderer.act(async () => { await button.props.onPress(); });
};
beforeEach(() => { jest.clearAllMocks(); (getCurrentUser as jest.Mock).mockResolvedValue(null); });

test.each([true, false])('existing recommendation save success=%s preserves its navigation until OK', async success => {
  (getCurrentUser as jest.Mock).mockResolvedValue({ id: 1, role: 'regular' });
  const prediction = { id: 8, title: 'Paper', model_class: 'paper', decision: 'paper', confidence: .9, threshold: .8, recommendation_choices: [] };
  (updatePrediction as jest.Mock).mockResolvedValue({ prediction });
  if (success) (selectRecommendation as jest.Mock).mockResolvedValue({ prediction });
  else (selectRecommendation as jest.Mock).mockRejectedValue(new Error('Recommendation save failed'));
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<App />); });
  const navigate = findComponent(tree, 'MainShell').props.navigate;
  await Renderer.act(async () => { navigate('assessment'); });
  await Renderer.act(async () => { findComponent(tree, 'AssessmentScreen').props.onChange(prediction); });
  await Renderer.act(async () => { navigate('recommendations'); });
  await Renderer.act(async () => { findComponent(tree, 'LiveRecommendationsScreen').props.setSelected('wrap'); });
  await Renderer.act(async () => { await findComponent(tree, 'LiveRecommendationsScreen').props.onSave(); });
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(success ? 1 : 0);
  expect(findComponent(tree, 'LiveRecommendationsScreen').props.selected).toBe('wrap');
  if (success) {
    await Renderer.act(async () => { tree.root.findByType(SuccessAlertDialog).props.onConfirm(); });
    expect(findComponent(tree, 'MainShell').props.screen).toBe('saved');
  } else expect(findComponent(tree, 'LiveRecommendationsScreen').props.error).toBe('Recommendation save failed');
  await Renderer.act(async () => { tree.unmount(); });
});

test.each([true, false])('account creation success=%s confirms before navigating; errors remain on form', async success => {
  if (success) (registerUser as jest.Mock).mockResolvedValue({ user: { id: 1 } });
  else (registerUser as jest.Mock).mockRejectedValue(new Error('Account could not be created'));
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<App />); });
  await Renderer.act(async () => { findComponent(tree, 'AuthScreen').props.onSwitch(); });
  await Renderer.act(async () => { const auth = findComponent(tree, 'AuthScreen'); auth.props.setEmail('test@example.com'); auth.props.setPassword('securepass'); auth.props.setConfirmPassword('securepass'); });
  await Renderer.act(async () => { await findComponent(tree, 'AuthScreen').props.onSubmit(); });
  expect(findComponent(tree, 'AuthScreen').props.mode).toBe('register');
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(success ? 1 : 0);
  if (success) {
    await Renderer.act(async () => { tree.root.findByType(SuccessAlertDialog).props.onConfirm(); });
    expect(tree.root.findAll(node => typeof node.type === 'function' && node.type.name === 'AuthScreen')).toHaveLength(0);
  } else expect(findComponent(tree, 'AuthScreen').props.error).toBe('Account could not be created');
  await Renderer.act(async () => { tree.unmount(); });
});

test('ordinary login succeeds without a success popup', async () => {
  (loginUser as jest.Mock).mockResolvedValue({ user: { id: 1 } });
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<App />); });
  await Renderer.act(async () => { const auth = findComponent(tree, 'AuthScreen'); auth.props.setEmail('test@example.com'); auth.props.setPassword('securepass'); });
  await Renderer.act(async () => { await findComponent(tree, 'AuthScreen').props.onSubmit(); });
  expect(loginUser).toHaveBeenCalled();
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(0);
  await Renderer.act(async () => { tree.unmount(); });
});

test.each([true, false])('password reset success=%s confirms only the completed reset, then returns to login', async success => {
  (requestPasswordReset as jest.Mock).mockResolvedValue({ reset_token: 'test-token', detail: 'Recovery requested' });
  if (success) (confirmPasswordReset as jest.Mock).mockResolvedValue({ detail: 'Password updated' });
  else (confirmPasswordReset as jest.Mock).mockRejectedValue(new Error('Reset failed'));
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<App />); });
  await Renderer.act(async () => { findComponent(tree, 'AuthScreen').props.setEmail('test@example.com'); });
  await Renderer.act(async () => { findComponent(tree, 'AuthScreen').props.onForgot(); });
  await press(tree, 'Send reset code');
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(0);
  await Renderer.act(async () => { tree.root.findAllByType(TextInput).filter(node => node.props.secureTextEntry).forEach(node => node.props.onChangeText('newpassword')); });
  await press(tree, 'Reset password');
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(success ? 1 : 0);
  if (success) {
    await Renderer.act(async () => { tree.root.findByType(SuccessAlertDialog).props.onConfirm(); });
    expect(findComponent(tree, 'AuthScreen').props.mode).toBe('login');
  } else { expect(JSON.stringify(tree.toJSON())).toContain('Reset failed'); expect(tree.root.findAllByType(TextInput).find(node => node.props.secureTextEntry)?.props.value).toBe('newpassword'); }
  await Renderer.act(async () => { tree.unmount(); });
});
