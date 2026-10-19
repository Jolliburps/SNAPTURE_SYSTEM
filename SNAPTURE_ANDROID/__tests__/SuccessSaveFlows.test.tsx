import React from 'react';
import Renderer from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import SettingsPage from '../src/SettingsPage';
import { MainExperience } from '../src/MainExperience';
import SuccessAlertDialog from '../src/SuccessAlertDialog';
import BarangayPickerModal from '../src/BarangayPickerModal';
import { updateMyProfile, uploadProfilePicture, type ApiUser } from '../src/api';

jest.mock('../src/api', () => ({
  updateMyProfile: jest.fn(), uploadProfilePicture: jest.fn(),
  getMaterials: jest.fn().mockResolvedValue({ materials: [] }),
  getPredictionOverview: jest.fn().mockResolvedValue({ predictions: [], total_count: 0 }),
  listSavedPredictions: jest.fn().mockResolvedValue([]), listProjects: jest.fn().mockResolvedValue([]),
}));
jest.mock('../src/localUpdates', () => ({ getLocalUpdates: jest.fn().mockResolvedValue([]) }));

const user = { id: 1, email: 'test@example.com', display_name: 'Test', barangay: 'Test barangay', profile_picture_url: null, role: 'regular' } as ApiUser;
const press = async (tree: Renderer.ReactTestRenderer, label: string) => {
  const button = tree.root.findAll(node => typeof node.props.onPress === 'function' && node.findAllByType(Text).some(text => text.props.children === label))[0];
  expect(button).toBeDefined();
  await Renderer.act(async () => { await button.props.onPress(); });
};
beforeEach(() => { jest.clearAllMocks(); });

test('name confirmation waits for server success and OK keeps Settings and the edited value', async () => {
  let resolve!: (value: { user: ApiUser }) => void;
  (updateMyProfile as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
  const onUserChange = jest.fn(), onBack = jest.fn();
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<SettingsPage user={user} onUserChange={onUserChange} onBack={onBack} onLogout={jest.fn()} />); });
  await Renderer.act(async () => { tree.root.findByType(TextInput).props.onChangeText('Updated name'); });
  const save = tree.root.findAll(node => typeof node.props.onPress === 'function' && node.findAllByType(Text).some(text => text.props.children === 'Save name'))[0];
  let saving!: Promise<void>;
  await Renderer.act(async () => { saving = save.props.onPress(); });
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(0);
  await Renderer.act(async () => { resolve({ user: { ...user, display_name: 'Updated name' } }); await saving; });
  expect(onUserChange).toHaveBeenCalled();
  expect(tree.root.findByType(SuccessAlertDialog).props.message).toContain('display name');
  await press(tree, 'OK');
  expect(onBack).not.toHaveBeenCalled();
  expect(tree.root.findByType(TextInput).props.value).toBe('Updated name');
  await Renderer.act(async () => { tree.unmount(); });
});

test('failed name save uses existing error and never opens a success dialog', async () => {
  (updateMyProfile as jest.Mock).mockRejectedValue(new Error('Save failed'));
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<SettingsPage user={user} onUserChange={jest.fn()} onBack={jest.fn()} onLogout={jest.fn()} />); });
  await press(tree, 'Save name');
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Save failed');
  await Renderer.act(async () => { tree.unmount(); });
});

test.each([true, false])('photo selection alone does not confirm; upload success=%s controls confirmation', async success => {
  (launchImageLibrary as jest.Mock).mockResolvedValue({ assets: [{ uri: 'file:///photo.jpg' }] });
  if (success) (uploadProfilePicture as jest.Mock).mockResolvedValue({ user: { ...user, profile_picture_url: '/photo.jpg' } });
  else (uploadProfilePicture as jest.Mock).mockRejectedValue(new Error('Upload failed'));
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<SettingsPage user={user} onUserChange={jest.fn()} onBack={jest.fn()} onLogout={jest.fn()} />); });
  await press(tree, 'Choose photo');
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(0);
  await press(tree, 'Save picture');
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(success ? 1 : 0);
  if (success) { await press(tree, 'OK'); expect(JSON.stringify(tree.toJSON())).not.toContain('Save picture'); }
  else expect(JSON.stringify(tree.toJSON())).toContain('Upload failed');
  await Renderer.act(async () => { tree.unmount(); });
});

test.each([true, false])('barangay save success=%s retains Profile and existing error behavior', async success => {
  if (success) (updateMyProfile as jest.Mock).mockResolvedValue({ user: { ...user, barangay: 'Bayanan' } });
  else (updateMyProfile as jest.Mock).mockRejectedValue(new Error('Location save failed'));
  const navigate = jest.fn(), onUserChange = jest.fn();
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<MainExperience screen="profile" navigate={navigate} user={user} onUserChange={onUserChange} onCategory={jest.fn()} onLogout={jest.fn()} />); });
  await press(tree, 'Change barangay');
  await Renderer.act(async () => { tree.root.findByType(BarangayPickerModal).props.onSelect('Bayanan'); });
  await press(tree, 'Save barangay');
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(success ? 1 : 0);
  if (success) { expect(onUserChange).toHaveBeenCalled(); await press(tree, 'OK'); expect(navigate).not.toHaveBeenCalled(); }
  else { expect(JSON.stringify(tree.toJSON())).toContain('Location save failed'); expect(tree.root.findByType(BarangayPickerModal).props.selected).toBe('Bayanan'); }
  await Renderer.act(async () => { tree.unmount(); });
});
