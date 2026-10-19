import React, { useState } from 'react';
import Renderer from 'react-test-renderer';
import { Modal, Pressable, Text, TextInput } from 'react-native';
import SuccessAlertDialog, { useSuccessAlert } from '../src/SuccessAlertDialog';

test('confirmation closes on OK, preserves local state, and runs its callback once', async () => {
  const confirmed = jest.fn();
  function Harness() {
    const [value, setValue] = useState('Draft remains');
    const { showSuccess, successDialog } = useSuccessAlert();
    return <><TextInput value={value} onChangeText={setValue} /><Pressable testID="save" onPress={() => showSuccess('Custom confirmation', confirmed)}><Text>Save</Text></Pressable>{successDialog}</>;
  }
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<Harness />); });
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(0);
  await Renderer.act(async () => { tree.root.findByProps({ testID: 'save' }).props.onPress(); });
  expect(tree.root.findByType(SuccessAlertDialog).props.message).toBe('Custom confirmation');
  expect(confirmed).not.toHaveBeenCalled();
  const acknowledge = tree.root.findByType(SuccessAlertDialog).props.onConfirm;
  const ok = tree.root.findAllByProps({ accessibilityLabel: 'OK' }).find(node => typeof node.props.onPress === 'function')!;
  await Renderer.act(async () => { ok.props.onPress(); acknowledge(); });
  expect(confirmed).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(0);
  expect(tree.root.findByType(TextInput).props.value).toBe('Draft remains');
  await Renderer.act(async () => { tree.unmount(); });
});

test('Android back acknowledges the same dialog and concurrent confirmations are retained', async () => {
  const first = jest.fn(), second = jest.fn();
  function Harness() {
    const { showSuccess, successDialog } = useSuccessAlert();
    return <><Pressable testID="save" onPress={() => { showSuccess('First save', first); showSuccess('Second save', second); }} />{successDialog}</>;
  }
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<Harness />); });
  await Renderer.act(async () => { tree.root.findByProps({ testID: 'save' }).props.onPress(); });
  expect(tree.root.findByType(SuccessAlertDialog).props.message).toBe('First save');
  const acknowledgeFirst = tree.root.findByType(Modal).props.onRequestClose;
  await Renderer.act(async () => { acknowledgeFirst(); acknowledgeFirst(); });
  expect(first).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(SuccessAlertDialog).props.message).toBe('Second save');
  await Renderer.act(async () => { tree.root.findByType(SuccessAlertDialog).props.onConfirm(); });
  expect(second).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(0);
  await Renderer.act(async () => { tree.unmount(); });
});
