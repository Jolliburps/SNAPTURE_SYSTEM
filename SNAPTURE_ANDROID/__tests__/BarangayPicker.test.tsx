import React from 'react';
import Renderer from 'react-test-renderer';
import { Modal, SectionList, TextInput } from 'react-native';
import BarangayPickerModal from '../src/BarangayPickerModal';
import { BARANGAY_DISTRICTS, filterBarangays, isBarangay } from '../src/barangaysData';

test('preserves all supplied names without duplicates (47 supplied, not the stated 48)', () => {
  expect(BARANGAY_DISTRICTS.map(group => group.data.length)).toEqual([23, 24]);
  const names = BARANGAY_DISTRICTS.flatMap(group => group.data);
  expect(names).toHaveLength(47);
  expect(new Set(names).size).toBe(47);
  expect(names).toEqual(expect.arrayContaining(['Kaingin Digman', 'Sinbanali', 'P.F. Espiritu 6', 'Queens Row Central', 'Zapote 3']));
  expect(isBarangay('Molino 7')).toBe(true);
  expect(isBarangay('Unknown barangay')).toBe(false);
});

test('case-insensitive partial search preserves groups and hides empty headers', () => {
  expect(filterBarangays('  mOLiNo  ')).toEqual([{ title: 'District 2: Bacoor East', data: BARANGAY_DISTRICTS[1].data.slice(0, 7) }]);
  expect(filterBarangays('talaba').map(group => group.data)).toEqual([['Talaba 1'], ['Talaba 2', 'Talaba 3']]);
  expect(filterBarangays('P.F. Espiritu').flatMap(group => group.data)).toHaveLength(6);
  expect(filterBarangays('no match')).toEqual([]);
  expect(filterBarangays('')).toEqual(BARANGAY_DISTRICTS);
});

test('picker searches locally, highlights current choice, selects and dismisses', async () => {
  const select = jest.fn(), close = jest.fn();
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<BarangayPickerModal visible selected="Bayanan" onSelect={select} onClose={close} />); });
  await Renderer.act(async () => { tree.root.findByType(TextInput).props.onChangeText('BAY'); });
  expect(tree.root.findByType(SectionList).props.sections).toEqual([{ title: 'District 1: Bacoor West', data: ['Bayanan', 'Dulong Bayan', 'Habay 1', 'Habay 2'] }]);
  const choice = tree.root.findAllByProps({ accessibilityLabel: 'Bayanan' }).find(node => typeof node.props.onPress === 'function')!;
  expect(choice.props.accessibilityState.checked).toBe(true);
  await Renderer.act(async () => { choice.props.onPress(); });
  expect(select).toHaveBeenCalledWith('Bayanan');
  await Renderer.act(async () => { tree.root.findByType(TextInput).props.onChangeText('no match'); });
  expect(tree.root.findByType(SectionList).props.sections).toHaveLength(0);
  expect(tree.root.findByType(SectionList).props.ListEmptyComponent.props.children).toContain('No barangays found');
  await Renderer.act(async () => { tree.root.findByType(Modal).props.onRequestClose(); });
  expect(close).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => { tree.update(<BarangayPickerModal visible={false} selected="Bayanan" onSelect={select} onClose={close} />); });
  await Renderer.act(async () => { tree.update(<BarangayPickerModal visible selected="Bayanan" onSelect={select} onClose={close} />); });
  expect(tree.root.findByType(TextInput).props.value).toBe('');
  await Renderer.act(async () => { tree.unmount(); });
});
