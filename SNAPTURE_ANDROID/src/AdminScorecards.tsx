import React, { useRef, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getEvaluationReport, getEvaluationRuns, type EvaluationReport, type EvaluationRunSummary, type EvaluationRate } from './api';

const percent = (value: number | null) => value === null ? 'Not measured' : `${(value * 100).toFixed(1)}%`;
function Button({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={s.button}><Text style={s.link}>{title}</Text></Pressable>;
}
function Rate({ title, value }: { title: string; value: EvaluationRate }) {
  return <View style={s.row}><Text style={s.label}>{title}: {percent(value.value)}</Text><Text style={s.body}>{value.numerator} / {value.denominator} evaluated{value.ci95 ? ` · 95% interval ${(value.ci95[0]*100).toFixed(1)}–${(value.ci95[1]*100).toFixed(1)}%` : ''}</Text></View>;
}

export default function AdminScorecards() {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<EvaluationRunSummary[]>([]);
  const [result, setResult] = useState<EvaluationReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const load = async (id?: number) => {
    setOpen(true); setBusy(true); setError('');
    try {
      if (id !== undefined) {
        const response = await getEvaluationReport(id);
        if (active.current) setResult(response);
      } else {
        const response = await getEvaluationRuns();
        if (active.current) { setRuns(response.runs); setResult(null); }
      }
    } catch (reason) { if (active.current) setError(reason instanceof Error ? reason.message : 'Unable to load evaluation scorecards.'); }
    finally { if (active.current) setBusy(false); }
  };
  return <View style={s.card}>
    <Text style={s.heading}>Research evaluation scorecards</Text>
    <Text style={s.body}>Expert-reviewed test cases, not camera confidence or user-satisfaction scores.</Text>
    {!open ? <Button title="Open evaluation scorecards" onPress={() => { load(); }} /> : <>
      <Button title="Close scorecards" disabled={busy} onPress={() => setOpen(false)} />
      {busy ? <Text style={s.body}>Loading scorecards...</Text> : null}
      {error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button title="Retry scorecards" disabled={busy} onPress={() => { load(result?.run.id); }} /></> : null}
      {!busy && !error && !result && !runs.length ? <Text style={s.body}>No evaluation runs yet. Create a run and adjudicate test cases in Django administration. No accuracy claim is available.</Text> : null}
      {!result ? runs.map(run => <Button key={run.id} title={`${run.name} · ${run.split} · ${run.frozen ? 'Frozen' : 'Draft'}`} disabled={busy} onPress={() => { load(run.id); }} />) : <>
        <Text style={s.heading}>{result.run.name}</Text>
        <Text style={s.body}>{result.run.split} · Dataset {result.run.dataset_version} · {result.run.frozen ? 'Frozen report' : 'Draft — not a final thesis result'}</Text>
        <Text style={s.body}>{result.counts.adjudicated} / {result.counts.total} cases adjudicated · {result.counts.unreviewed} unreviewed. Manual entries excluded from camera scoring: {result.counts.manual_excluded_from_camera}.</Text>
        <Text style={s.heading}>1. Material identification</Text>
        <Text style={s.label}>Raw classification macro-F1: {percent(result.identification.macro_f1)}</Text>
        {!result.identification.all_scope_classes_tested ? <Text style={s.body}>Not all supported materials have test examples yet.</Text> : null}
        {result.identification.per_material.map(row => <View key={row.label} style={s.row}><Text style={s.label}>{row.label.replace(/_/g, ' ')} · {row.support} reference items</Text><Text style={s.body}>Precision {percent(row.precision)} · Recall {percent(row.recall)} · F1 {percent(row.f1)}</Text></View>)}
        <Rate title="Raw confidence-gate correctness" value={result.identification.accepted_correctness} />
        <Rate title="Raw confidence-gate coverage" value={result.identification.acceptance_coverage} />
        <Rate title="Needs-review rate" value={result.identification.review_rate} />
        <Rate title="Unsupported items falsely accepted" value={result.identification.unsupported_false_acceptance} />
        <Text style={s.heading}>2. Segregation guidance</Text>
        <Rate title="Acceptable route or appropriate referral" value={result.segregation.correct_route} />
        <Rate title="Unsafe segregation guidance" value={result.segregation.unsafe_guidance} />
        <Rate title="Appropriate request for review" value={result.segregation.appropriate_review} />
        <Rate title="Unnecessary request for review" value={result.segregation.unnecessary_review} />
        <Text style={s.heading}>3. Recycling / upcycling recommendations</Text>
        <Text style={s.body}>{result.recommendations.judged} / {result.recommendations.shown} shown recommendations judged · {result.recommendations.unjudged} awaiting review.</Text>
        <Rate title="Acceptable recommendations" value={result.recommendations.acceptable} />
        <Rate title="Unsafe recommendations" value={result.recommendations.unsafe} />
        <Rate title="Eligible cases with a suitable idea" value={result.recommendations.eligible_cases_with_acceptable_idea} />
        <Rate title="Appropriate withholding" value={result.recommendations.appropriate_withholding} />
        <Text style={s.body}>Safety failures cannot be averaged away by other criteria.</Text>
        <Text style={s.heading}>Limits and interpretation</Text>
        {result.warnings.map((warning, index) => <Text key={index} style={s.body}>{warning}</Text>)}
        <Text style={s.body}>Download the full confusion matrix and CSV from Django administration. No combined system-accuracy percentage is calculated.</Text>
        <Button title="Back to evaluation runs" disabled={busy} onPress={() => { load(); }} />
      </>}
    </>}
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderColor: '#dce9df', borderWidth: 1, borderRadius: 18, padding: 16, marginVertical: 14 },
  heading: { color: '#143f30', fontSize: 17, fontWeight: '800', marginVertical: 10 },
  body: { color: '#57645d', fontSize: 13, lineHeight: 20, marginBottom: 8 },
  label: { color: '#1c3027', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  row: { borderBottomColor: '#dce9df', borderBottomWidth: 1, paddingVertical: 10 },
  button: { minHeight: 46, justifyContent: 'center', paddingVertical: 10 }, link: { color: '#176b45', fontSize: 14, fontWeight: '800' }, error: { color: '#a12622', fontSize: 13 },
});
