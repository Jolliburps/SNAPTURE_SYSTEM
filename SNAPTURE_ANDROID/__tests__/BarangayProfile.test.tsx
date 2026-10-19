import React, { useState } from 'react';
import Renderer from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import SettingsPage from '../src/SettingsPage';
import BarangayPickerModal from '../src/BarangayPickerModal';
import SuccessAlertDialog from '../src/SuccessAlertDialog';
import { updateMyProfile, type ApiUser } from '../src/api';

jest.mock('../src/api', () => ({ updateMyProfile: jest.fn() }));
const savedUser = { id: 1, email: 'test@example.com', display_name: 'Resident', barangay: 'Molino 1', profile_picture_url: null, role: 'regular' } as ApiUser;
const onBack = jest.fn();
function Harness({ initial = savedUser }: { initial?: ApiUser | null }) {
  const [user, setUser] = useState(initial);
  return <SettingsPage user={user} onUserChange={setUser} onBack={onBack} onLogout={jest.fn()} />;
}
const press = async (tree: Renderer.ReactTestRenderer, label: string) => {
  const button = tree.root.findAll(node => typeof node.props.onPress === 'function' && (node.props.accessibilityLabel === label || node.findAllByType(Text).some(text => text.props.children === label)))[0];
  expect(button).toBeDefined();
  await Renderer.act(async () => { await button.props.onPress(); });
};
beforeEach(() => jest.clearAllMocks());

test('searching and selecting only changes the draft; Save PATCH succeeds before success feedback', async () => {
  let resolve!: (value: { user: ApiUser }) => void;
  (updateMyProfile as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<Harness />); });
  expect(tree.root.findByType(BarangayPickerModal).props.selected).toBe('Molino 1');
  await press(tree, 'Choose barangay');
  await Renderer.act(async () => { tree.root.findByProps({ accessibilityLabel: 'Search barangays' }).props.onChangeText('Zapote'); });
  expect(updateMyProfile).not.toHaveBeenCalled();
  await Renderer.act(async () => { tree.root.findByType(BarangayPickerModal).props.onSelect('Zapote 2'); });
  expect(tree.root.findByType(BarangayPickerModal).props.visible).toBe(false);
  expect(updateMyProfile).not.toHaveBeenCalled();
  const save = tree.root.findAll(node => typeof node.props.onPress === 'function' && node.findAllByType(Text).some(text => text.props.children === 'Save barangay'))[0];
  let saving!: Promise<void>;
  await Renderer.act(async () => { saving = save.props.onPress(); });
  expect(updateMyProfile).toHaveBeenCalledWith({ barangay: 'Zapote 2' });
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(0);
  await Renderer.act(async () => { resolve({ user: { ...savedUser, barangay: 'Zapote 2' } }); await saving; });
  await press(tree, 'OK');
  expect(onBack).not.toHaveBeenCalled();
  expect(tree.root.findByType(BarangayPickerModal).props.selected).toBe('Zapote 2');
  expect(tree.root.findByType(TextInput).props.value).toBe('Resident');
  await Renderer.act(async () => { tree.unmount(); });
});

test.each(['Network request failed', 'barangay must be text of 120 characters or fewer.'])('save failure (%s) preserves saved value and draft, and Cancel restores it', async error => {
  (updateMyProfile as jest.Mock).mockRejectedValue(new Error(error));
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<Harness />); });
  await press(tree, 'Choose barangay');
  await Renderer.act(async () => { tree.root.findByType(BarangayPickerModal).props.onSelect('Niog'); });
  await press(tree, 'Save barangay');
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(0);
  expect(tree.root.findByType(SettingsPage).props.user.barangay).toBe('Molino 1');
  expect(tree.root.findByType(BarangayPickerModal).props.selected).toBe('Niog');
  expect(JSON.stringify(tree.toJSON())).toContain(error);
  await press(tree, 'Cancel');
  expect(tree.root.findByType(BarangayPickerModal).props.selected).toBe('Molino 1');
  await Renderer.act(async () => { tree.unmount(); });
});

test('legacy saved text and loading users are not replaced by an arbitrary default', async () => {
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<Harness initial={{ ...savedUser, barangay: 'Legacy value' }} />); });
  expect(tree.root.findByType(BarangayPickerModal).props.selected).toBe('Legacy value');
  expect(updateMyProfile).not.toHaveBeenCalled();
  await Renderer.act(async () => { tree.unmount(); tree = Renderer.create(<Harness initial={null} />); });
  const field = tree.root.findAllByProps({ accessibilityLabel: 'Choose barangay' }).find(node => typeof node.props.onPress === 'function')!;
  expect(field.props.disabled).toBe(true);
  expect(tree.root.findByType(BarangayPickerModal).props.selected).toBe('');
  await Renderer.act(async () => { field.props.onPress(); });
  expect(tree.root.findByType(BarangayPickerModal).props.visible).toBe(false);
  expect(updateMyProfile).not.toHaveBeenCalled();
  await Renderer.act(async () => { tree.unmount(); });
});
