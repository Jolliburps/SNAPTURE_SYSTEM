import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from './PublicText';
import type { Prediction } from './api';

export const PROCEED_LABEL = 'Proceed to Upcycling Recommendation';
export function screeningInputKey(p: Prediction) {
  return JSON.stringify([
    p.id,
    p.scene_id,
    p.decision,
    p.condition,
    p.previous_contents,
    p.quantity,
    Object.entries(p.answers || {}).sort(([a], [b]) => a.localeCompare(b)),
    p.model_version,
    p.screening_revision,
    p.screening || p.assessment?.screening,
  ]);
}
export default function ScreeningOutcome({
  prediction,
  onProceed,
  disabled = false,
}: {
  prediction: Prediction;
  onProceed?: (prediction: Prediction) => void;
  disabled?: boolean;
}) {
  const result = prediction.screening || prediction.assessment?.screening;
  const key = screeningInputKey(prediction);
  const submitted = useRef('');
  const [busyKey, setBusyKey] = useState('');
  const hazardous = prediction.waste_identifier?.category === 'C';
  const eligible = !hazardous && result?.status === 'eligible' && result.eligible === true;
  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.title}>
        Upcycling screening
      </Text>
      <Text style={s.body}>
        {hazardous || result?.status === 'ineligible' || result?.status === 'unsupported'
          ? 'Not Eligible for Upcycling' : result?.status?.replace(/_/g, ' ') || 'Review required'}
      </Text>
      {(
        result?.reasons || [
          'Complete the item review before requesting recommendations.',
        ]
      ).map(line => (
        <Text key={line} style={s.body}>
          {line}
        </Text>
      ))}
      {eligible && onProceed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={PROCEED_LABEL}
          disabled={disabled || busyKey === key}
          style={[s.button, (disabled || busyKey === key) && s.disabled]}
          onPress={() => {
            if (disabled || submitted.current === key) return;
            submitted.current = key;
            setBusyKey(key);
            onProceed(prediction);
          }}
        >
          <Text style={s.buttonText}>{PROCEED_LABEL}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dce9df',
    backgroundColor: '#fff',
    marginTop: 16,
  },
  title: { fontSize: 19, fontWeight: '700', color: '#143f30', marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 23, color: '#35483e', marginBottom: 6 },
  button: {
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: '#176b45',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  buttonText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.5 },
});
