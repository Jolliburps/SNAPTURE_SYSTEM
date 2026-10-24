import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import type { UserProject } from './api';

type Props = {
  project: UserProject;
  onStep: (id: number, step: number, completed: boolean) => Promise<UserProject>;
  onRestart: (id: number) => Promise<UserProject>;
  onDone: () => void;
  directCompletion?: boolean;
};

function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={[secondary ? s.secondary : s.primary, disabled && s.disabled]}><Text style={secondary ? s.link : s.primaryText}>{title}</Text></Pressable>;
}

export default function ProjectGuide({ project, onStep, onRestart, onDone, directCompletion=false }: Props) {
  const [index, setIndex] = useState(() => Math.max(0, project.steps.findIndex((_, i) => !project.completed_steps.includes(i))));
  const [summary, setSummary] = useState(project.status === 'completed');
  const [busy, setBusy] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState('');
  const [expandedSafety, setExpandedSafety] = useState(false);
  const [details,setDetails]=useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const transitionVersion = useRef(0);
  const scale = useRef(new Animated.Value(1)).current;
  const scroll = useRef<ScrollViewInstance>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (timer.current) clearTimeout(timer.current); }; }, []);
  useEffect(() => {
    if (!summary) return;
    scale.setValue(.7);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  }, [scale, summary]);
  const jump = (next: number) => {
    transitionVersion.current += 1;
    if (timer.current) clearTimeout(timer.current);
    setTransitioning(false); setIndex(Math.max(0, Math.min(project.steps.length - 1, next)));
    scroll.current?.scrollTo({ y: 0, animated: true });
  };
  const changeStep = async (completed: boolean) => {
    if (busy || transitioning) return;
    if(directCompletion && completed && index===project.steps.length-1 && project.steps.some((_,i)=>i<index && !project.completed_steps.includes(i)))return;
    setBusy(true); setError('');
    const version = transitionVersion.current;
    try {
      const updated = await onStep(project.id, index, completed);
      if (!alive.current || version !== transitionVersion.current || !completed) return;
      if(directCompletion && updated.status==='completed'){onDone();return;}
      setTransitioning(true);
      timer.current = setTimeout(() => {
        if (!alive.current || version !== transitionVersion.current) return;
        setTransitioning(false);
        if (updated.status === 'completed') { setSummary(true); scroll.current?.scrollTo({ y: 0, animated: true }); }
        else if (index === updated.steps.length - 1) {
          jump(updated.steps.findIndex((_, i) => !updated.completed_steps.includes(i)));
          setError('Check the remaining earlier steps before finishing.');
        } else jump(index + 1);
      }, 500);
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : 'Unable to save this step.'); }
    finally { if (alive.current) setBusy(false); }
  };
  const restart = () => Alert.alert('Do this project again?', 'This resets the saved checklist to 0 completed steps. Use suitable material and reassess it if its condition has changed.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Reset progress', onPress: () => {
      setBusy(true); setError('');
      onRestart(project.id).then(() => { if (alive.current) { setSummary(false); jump(0); } })
        .catch(reason => { if (alive.current) setError(reason instanceof Error ? reason.message : 'Unable to restart.'); })
        .finally(() => { if (alive.current) setBusy(false); });
    } },
  ]);
  const done = project.completed_steps.includes(index);
  const last = index === project.steps.length - 1;
  const earlierComplete = project.steps.every((_,i)=>i>=index || project.completed_steps.includes(i));
  if (!project.steps.length) return <ScrollView contentContainerStyle={s.page}><Text style={s.title}>Guide unavailable</Text><Text style={s.body}>This older project has no usable steps. Choose a project with published instructions.</Text><Button title="Back to projects" onPress={onDone} /></ScrollView>;
  return <ScrollView ref={scroll} contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
    <Pressable accessibilityRole="button" accessibilityLabel="Project information and source" accessibilityState={{expanded:details}} onPress={()=>setDetails(value=>!value)} style={s.secondary}><Text style={s.link}>Project information and source</Text></Pressable>
    {details?<View style={s.card}>
      <Text style={s.heading}>{project.title}</Text><Text style={s.body}>Input material: {project.material}</Text>
      <Text style={s.body}>{project.summary || 'No separate finished-product description was saved.'}</Text>
      <Text style={s.heading}>Required materials and tools</Text>{project.materials.map((line,i)=><Text key={i} style={s.body}>{line}</Text>)}
      <Text style={s.heading}>Safety precautions</Text><Text style={s.body}>{project.safety_note}</Text>
      <Text style={s.heading}>Source and verification status</Text>
      <Text selectable style={s.body}>{project.reference?.source || 'No source snapshot was saved for this older project. Ask for a reviewed version before starting it again.'}</Text>
      <Text style={s.small}>{project.reference?.review_level?`Review status: ${project.reference.review_level.replace(/_/g,' ')}. Not a safety certification or CESD endorsement.`:'Verification status unavailable for this older saved project.'}</Text>
    </View>:null}
    {summary ? <>
      <Animated.View accessibilityLabel="Completed checkmark" style={[s.celebration, { transform: [{ scale }] }]}><Check color="#fff" size={46} /></Animated.View>
      <Text accessibilityRole="header" style={s.title}>Project completed!</Text><Text style={s.projectTitle}>{project.title}</Text>
      <View style={s.card}><Text style={s.heading}>{project.completed_count} of {project.total_steps} steps completed</Text><Text style={s.body}>Material: {project.material}</Text><Text style={s.badge}>Completed project · 100%</Text></View>
      <View style={s.fact}><Text style={s.heading}>Did you know?</Text><Text style={s.body}>Giving an item another use can delay its disposal. The benefit depends on the material and what the reused item replaces.</Text><Text style={s.small}>This checklist records your activity, not a measured weight or carbon saving.</Text></View>
      {project.safety_note ? <Text style={s.safetyText}>{project.safety_note}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      <Button title="Done" onPress={onDone} disabled={busy} />
      <Button title="Review steps" secondary onPress={() => { setSummary(false); jump(0); }} disabled={busy} />
      <Button title="Do it again" secondary onPress={restart} disabled={busy} />
    </> : <>
      <Text style={s.projectTitle}>{project.title}</Text><Text style={s.small}>{project.material} · {project.completed_count}/{project.total_steps} steps checked</Text>
      <View style={s.track}><View style={[s.fill, { width: `${project.progress_percent}%` }]} /></View>
      {project.safety_note ? <View style={s.safety}><Text style={s.safetyLabel}>Caution</Text><Text style={s.safetyText} numberOfLines={expandedSafety ? undefined : 2}>{project.safety_note}</Text><Pressable accessibilityRole="button" accessibilityLabel={expandedSafety ? 'Hide full caution' : 'Read full caution'} onPress={() => setExpandedSafety(value => !value)}><Text style={s.link}>{expandedSafety ? 'Show less' : 'Read full caution'}</Text></Pressable></View> : null}
      <Text accessibilityRole="header" style={s.title}>Step {index + 1} of {project.total_steps}</Text>
      <View style={s.instruction}><Text style={s.instructionText}>{project.steps[index]}</Text>{done ? <Text style={s.badge}>Step completed</Text> : null}</View>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      {transitioning ? <Text accessibilityLiveRegion="polite" style={s.badge}>Step saved. Moving on...</Text> : null}
      {directCompletion && last && !earlierComplete?<Text style={s.small}>Complete the earlier steps to enable Completed.</Text>:null}
      {!done ? <Button title={busy ? 'Saving...' : last ? directCompletion?'Completed':'Finish' : 'Mark as done'} onPress={() => { changeStep(true); }} disabled={busy || transitioning || !project.steps.length || directCompletion && last && !earlierComplete} /> : project.status === 'completed' ? <Button title="View completed summary" onPress={() => setSummary(true)} disabled={busy} /> : null}
      <View style={s.navigation}><Button title="Previous" secondary onPress={() => jump(index - 1)} disabled={busy || index === 0} />{!last ? <Button title="Next" secondary onPress={() => jump(index + 1)} disabled={busy} /> : null}</View>
      {done ? <Button title="Undo this step" secondary onPress={() => { changeStep(false); }} disabled={busy || transitioning} /> : null}
      <Text style={s.small}>Review any step below. Going back does not undo it.</Text>
      {project.steps.map((step, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Review step ${i+1}`} accessibilityState={{ selected: i === index }} disabled={busy} onPress={() => jump(i)} style={[s.step, i === index && s.selected]}><Text style={s.heading}>{project.completed_steps.includes(i) ? '✓ ' : ''}Step {i+1}</Text><Text style={s.body}>{step}</Text></Pressable>)}
    </>}
  </ScrollView>;
}

const s = StyleSheet.create({
  page: { padding: 20, paddingBottom: 35 }, title: { color: '#143f30', fontSize: 26, fontWeight: '800', marginVertical: 16 }, projectTitle: { color: '#143f30', fontSize: 21, fontWeight: '800', marginBottom: 10 },
  heading: { color: '#143f30', fontSize: 16, fontWeight: '700', marginBottom: 7 }, body: { color: '#35483e', fontSize: 15, lineHeight: 23 }, small: { color: '#63756a', fontSize: 12, lineHeight: 19, marginVertical: 8 },
  instruction: { borderWidth: 1, borderColor: '#dce9df', borderRadius: 16, padding: 18, marginVertical: 10 }, instructionText: { color: '#20392c', fontSize: 18, lineHeight: 28 }, card: { backgroundColor: '#edf6ef', padding: 18, borderRadius: 16, marginTop: 14 },
  primary: { backgroundColor: '#176b45', borderRadius: 12, padding: 16, minHeight: 50, alignItems: 'center', marginTop: 14 }, primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' }, secondary: { minHeight: 46, justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8 }, link: { color: '#176b45', fontSize: 14, fontWeight: '700', paddingVertical: 4 }, disabled: { opacity: .4 },
  track: { height: 7, backgroundColor: '#e5ebe6', borderRadius: 8, overflow: 'hidden', marginVertical: 8 }, fill: { height: '100%', backgroundColor: '#219653' }, navigation: { flexDirection: 'row', justifyContent: 'space-between' }, badge: { color: '#176b45', fontWeight: '700', marginTop: 10 },
  safety: { backgroundColor: '#fff4df', borderRadius: 12, padding: 10, marginTop: 12 }, safetyLabel: { fontWeight: '700', color: '#735719', marginBottom: 3 }, safetyText: { color: '#735719', fontSize: 12, lineHeight: 18 }, error: { color: '#a12622', marginTop: 10, lineHeight: 21 },
  step: { borderWidth: 1, borderColor: '#dce9df', borderRadius: 12, padding: 12, marginTop: 10 }, selected: { backgroundColor: '#edf6ef', borderColor: '#176b45' }, celebration: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#176b45', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 15 }, fact: { paddingVertical: 18 },
});
