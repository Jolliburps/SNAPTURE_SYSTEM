import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';

type Confirmation = { message: string; onConfirm?: () => void };

export default function SuccessAlertDialog({ message, onConfirm }: { message: string; onConfirm: () => void }) {
  return <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onConfirm} onShow={() => AccessibilityInfo.announceForAccessibility(`Success. ${message}`)}>
    <View style={styles.overlay}>
      <View style={styles.dialog} accessibilityViewIsModal>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} bounces={false}>
          <View style={styles.icon} accessible={false} importantForAccessibility="no-hide-descendants"><Check size={32} color="#176b45" strokeWidth={2.5} /></View>
          <Text accessibilityRole="header" style={styles.title}>Success</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="OK" onPress={onConfirm} style={styles.button}><Text style={styles.buttonText}>OK</Text></Pressable>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

// Keep the owner screen mounted. Only an explicit acknowledgement runs navigation.
// A small queue also preserves confirmations if two independent saves finish together.
export function useSuccessAlert() {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const pending = useRef<Confirmation[]>([]);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; pending.current = []; }; }, []);
  const showSuccess = useCallback((message: string, onConfirm?: () => void) => {
    if (!mounted.current) return;
    Keyboard.dismiss();
    const next = { message, onConfirm };
    pending.current.push(next);
    if (pending.current.length === 1) setConfirmation(next);
  }, []);
  const acknowledge = useCallback((current: Confirmation) => {
    if (pending.current[0] !== current || !mounted.current) return;
    pending.current.shift();
    setConfirmation(pending.current[0] || null);
    current.onConfirm?.();
  }, []);
  return { showSuccess, successDialog: confirmation ? <SuccessAlertDialog message={confirmation.message} onConfirm={() => acknowledge(confirmation)} /> : null };
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#09191299' },
  dialog: { width: '100%', maxWidth: 360, maxHeight: '85%', backgroundColor: '#fff', borderRadius: 22, elevation: 8, overflow: 'hidden' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { padding: 24, alignItems: 'center' },
  icon: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#e7f3e9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { color: '#1c3027', fontSize: 23, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  message: { color: '#35483e', fontSize: 16, lineHeight: 24, textAlign: 'center', marginBottom: 24 },
  button: { width: '100%', minHeight: 48, borderRadius: 12, backgroundColor: '#176b45', justifyContent: 'center', alignItems: 'center', padding: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
