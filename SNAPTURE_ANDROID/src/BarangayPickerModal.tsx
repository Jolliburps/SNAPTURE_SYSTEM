import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import Search from 'lucide-react-native/icons/search';
import X from 'lucide-react-native/icons/x';
import { filterBarangays } from './barangaysData';

type Props = { visible: boolean; selected: string; onSelect: (barangay: string) => void; onClose: () => void };

export default function BarangayPickerModal({ visible, selected, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const sections = useMemo(() => filterBarangays(search), [search]);
  useEffect(() => { if (visible) setSearch(''); }, [visible]);
  const close = () => { Keyboard.dismiss(); onClose(); };
  return <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={close}>
    <KeyboardAvoidingView style={styles.scrim} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={styles.backdrop} accessibilityRole="button" accessibilityLabel="Close barangay picker" onPress={close} />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.handle} />
        <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>Choose barangay</Text><Pressable accessibilityRole="button" accessibilityLabel="Close barangay picker" onPress={close} hitSlop={10}><X size={22} color="#1c3027" /></Pressable></View>
        <Text style={styles.current}>{selected ? `Selected: ${selected}` : 'Choose your barangay in Bacoor.'}</Text>
        <View style={styles.search}><Search size={18} color="#708178" /><TextInput accessibilityLabel="Search barangays" value={search} onChangeText={setSearch} placeholder="Search barangays" placeholderTextColor="#708178" autoCorrect={false} autoCapitalize="none" returnKeyType="search" onSubmitEditing={Keyboard.dismiss} style={styles.input} /></View>
        <SectionList sections={sections} keyExtractor={name => name} extraData={selected} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" stickySectionHeadersEnabled contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => <Text accessibilityRole="header" style={styles.district}>{section.title}</Text>}
          renderItem={({ item }) => <Pressable accessibilityRole="radio" accessibilityLabel={item} accessibilityState={{ checked: selected === item }} style={[styles.row, selected === item && styles.selected]} onPress={() => { Keyboard.dismiss(); onSelect(item); }}><Text style={styles.name}>{item}</Text>{selected === item ? <Check size={19} color="#176b45" /> : null}</Pressable>}
          ListEmptyComponent={<Text accessibilityRole="alert" style={styles.empty}>No barangays found. Try another name.</Text>} />
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#09191299' }, backdrop: { flex: 1 },
  sheet: { height: '85%', backgroundColor: '#fff', borderTopLeftRadius: 23, borderTopRightRadius: 23, paddingTop: 9 },
  handle: { width: 42, height: 4, borderRadius: 3, alignSelf: 'center', backgroundColor: '#c7ccc9', marginBottom: 13 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 10, paddingBottom: 13 },
  title: { flex: 1, color: '#1c3027', fontSize: 19, fontWeight: '900' },
  current: { color: '#708178', fontSize: 12, lineHeight: 18, marginHorizontal: 20, marginBottom: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, borderColor: '#dce9df', borderWidth: 1, borderRadius: 12, marginHorizontal: 20, paddingHorizontal: 12, marginBottom: 8 },
  input: { flex: 1, minHeight: 48, color: '#1c3027', fontSize: 14 }, list: { paddingHorizontal: 20, paddingBottom: 35 },
  district: { color: '#176b45', fontSize: 13, fontWeight: '800', paddingVertical: 14, backgroundColor: '#fff' },
  row: { minHeight: 48, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 1, borderColor: '#dce9df', marginBottom: 7 },
  selected: { backgroundColor: '#e8f5ec', borderColor: '#176b45' }, name: { flex: 1, fontSize: 14, color: '#1c3027' },
  empty: { color: '#708178', fontSize: 14, lineHeight: 21, paddingVertical: 24 },
});
