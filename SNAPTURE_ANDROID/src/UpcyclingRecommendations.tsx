import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import React, { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import {
  requestUpcyclingRecommendations,
  type Prediction,
  type RecommendationResponse,
} from './api';
import ScanUpcyclingIdeas from './ScanUpcyclingIdeas';
import { screeningInputKey } from './ScreeningOutcome';

// Reuse this explicit intent across guide/back remounts; retries use a new attempt.
const requests = new Map<
  string,
  {
    attempt: number;
    pending: ReturnType<typeof requestUpcyclingRecommendations>;
  }
>();
export default function UpcyclingRecommendations({
  prediction,
  intent,
  onBack,
}: {
  prediction: Prediction;
  intent: number;
  onBack: () => void;
}) {
  const key = screeningInputKey(prediction);
  const requestKey = JSON.stringify([intent, key]);
  const authorization = useRef({ intent, key, invalidated: false });
  if (authorization.current.intent !== intent)
    authorization.current = { intent, key, invalidated: false };
  if (authorization.current.key !== key)
    authorization.current.invalidated = true;
  const authorized = !authorization.current.invalidated;
  const screening = prediction.screening || prediction.assessment?.screening;
  const permitted =
    authorized && screening?.status === 'eligible' && screening.eligible;
  const [result, setResult] = useState<{
    key: string;
    value: RecommendationResponse;
  } | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(
    () => requests.get(requestKey)?.attempt || 0,
  );
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  useEffect(() => {
    const request = ++generation.current;
    let active = true;
    setResult(null);
    setError('');
    setLoading(Boolean(permitted));
    if (permitted) {
      const cached = requests.get(requestKey);
      let pending = cached?.attempt === attempt ? cached.pending : undefined;
      if (!pending) {
        pending = prediction.screening_revision
          ? requestUpcyclingRecommendations(
              prediction.id,
              prediction.screening_revision,
            )
          : requestUpcyclingRecommendations(prediction.id);
        requests.set(requestKey, { attempt, pending });
        if (requests.size > 20) requests.delete(requests.keys().next().value!);
      }
      pending
        .then(value => {
          if (active && request === generation.current) {
            if (
              value.prediction_id !== prediction.id ||
              value.scene_id !== (prediction.scene_id ?? null)
            )
              throw new Error(
                'The recommendation response did not match this item. Return to screening.',
              );
            setResult({ key, value });
          }
        })
        .catch(reason => {
          if (active && request === generation.current)
            setError(
              reason instanceof Error
                ? reason.message
                : 'Unable to request recommendations.',
            );
        })
        .finally(() => {
          if (active && request === generation.current) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [
    intent,
    key,
    attempt,
    permitted,
    prediction.id,
    prediction.scene_id,
    prediction.screening_revision,
    requestKey,
  ]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onBack]);
  const response = permitted && result?.key === key ? result.value : null;
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to screening"
        onPress={onBack}
        style={s.back}
      >
        <ChevronLeft size={22} color="#176b45" />
        <Text style={s.link}>Back to screening</Text>
      </Pressable>
      <Text accessibilityRole="header" style={s.title}>
        Upcycling recommendations
      </Text>
      {!permitted ? (
        <Text style={s.body}>
          The item or screening details changed. Return to screening before
          requesting recommendations.
        </Text>
      ) : null}
      {permitted && loading ? (
        <Text accessibilityLiveRegion="polite" style={s.body}>
          Finding matching projects...
        </Text>
      ) : null}
      {error && permitted ? (
        <>
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry recommendations"
            disabled={loading}
            onPress={() => setAttempt(old => old + 1)}
            style={s.action}
          >
            <Text style={s.link}>Try again</Text>
          </Pressable>
        </>
      ) : null}
      {response && !response.recommendations.length ? (
        <Text style={s.body}>
          This item passed screening, but no matching project was found. You can
          return to review its details. This does not mean the item is unsafe.
        </Text>
      ) : null}
      {response?.recommendations.length ? (
        <ScanUpcyclingIdeas
          key={`${prediction.id}-${response.revision}`}
          prediction={{
            ...prediction,
            upcycling_ideas: response.recommendations,
            recommendation_choices: [],
          }}
        />
      ) : null}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: {
    padding: 20,
    paddingBottom: 48,
    backgroundColor: '#f7f9f5',
    flexGrow: 1,
  },
  back: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  link: { fontSize: 16, fontWeight: '700', color: '#176b45' },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#143f30',
    marginBottom: 16,
  },
  body: { fontSize: 16, lineHeight: 25, color: '#35483e', marginVertical: 12 },
  action: {
    borderWidth: 2,
    borderColor: '#176b45',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  error: { color: '#a12020', fontSize: 15, lineHeight: 23 },
});
