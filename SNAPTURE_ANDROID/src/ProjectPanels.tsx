import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Bookmark, Check, ChevronRight, ClipboardList, FolderOpen, Lightbulb, Search, X } from 'lucide-react-native';

import type { UserProject } from './api';
import { activeProjectsSorted, type SavedEntry } from './projectData';

type Props = {
  section: 'projects' | 'saved';
  projects: UserProject[];
  projectsLoading: boolean;
  projectsError: string;
  saved: SavedEntry[];
  savedLoading: boolean;
  savedError: string;
  onClose: () => void;
  onStart: (predictionId: number) => Promise<UserProject>;
  onStep: (projectId: number, stepIndex: number, completed: boolean) => Promise<UserProject>;
};

const GREEN = '#176b45';
const TEXT = '#1c3027';
const MUTED = '#708178';
const LINE = '#dce9df';

function ProgressBar({ percent }: { percent: number }) {
  return <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, percent))}%` }]} /></View>;
}

function ProjectCard({ project, onPress }: { project: UserProject; onPress: () => void }) {
  return <Pressable style={styles.listCard} onPress={onPress} accessibilityLabel={`Open ${project.title}`}>
    <View style={styles.art}><FolderOpen size={27} color={GREEN} /></View>
    <View style={styles.cardCopy}>
      <Text style={styles.cardTitle} numberOfLines={1}>{project.title}</Text>
      <Text style={styles.cardSub} numberOfLines={1}>{project.material}</Text>
      <View style={styles.progressLine}><ProgressBar percent={project.progress_percent} /><Text style={styles.tiny}>{project.progress_percent}%</Text></View>
      <Text style={styles.tiny}>{project.status === 'completed' ? 'Completed' : `${project.completed_count} of ${project.total_steps} steps done`}</Text>
    </View><ChevronRight size={18} color={GREEN} />
  </Pressable>;
}

function BlankState({ title, body }: { title: string; body: string }) {
  return <View style={styles.empty}><FolderOpen size={28} color={GREEN} /><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.muted}>{body}</Text></View>;
}

export default function ProjectPanels({ section, projects, projectsLoading, projectsError, saved, savedLoading, savedError, onClose, onStart, onStep }: Props) {
  const [detail, setDetail] = useState<SavedEntry | null>(null);
  const [guideId, setGuideId] = useState<number | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [materialFilter, setMaterialFilter] = useState('All');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  useEffect(() => { setDetail(null); setGuideId(null); setFilter('all'); setSearch(''); setMaterialFilter('All'); setActionError(''); }, [section]);

  const active = useMemo(() => activeProjectsSorted(projects), [projects]);
  const completed = useMemo(() => projects.filter((project) => project.status === 'completed').slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at)), [projects]);
  const shown = filter === 'active' ? active : filter === 'completed' ? completed : [...active, ...completed];
  const materials = useMemo(() => ['All', ...Array.from(new Set(saved.map((entry) => entry.record.title)))], [saved]);
  const visibleSaved = saved.filter((entry) =>
    (materialFilter === 'All' || entry.record.title === materialFilter)
    && `${entry.idea?.title || ''} ${entry.record.title}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const project = projects.find((item) => item.id === guideId);
  const started = detail && projects.find((item) => item.source_prediction_id === detail.record.id && item.recommendation_id === detail.record.selected_recommendation);

  const openGuide = (item: UserProject) => {
    setGuideId(item.id);
    setStepIndex(item.steps.findIndex((_, index) => !item.completed_steps.includes(index)) >= 0
      ? item.steps.findIndex((_, index) => !item.completed_steps.includes(index)) : 0);
    setActionError('');
  };
  const back = () => {
    if (guideId !== null) { setGuideId(null); setActionError(''); return; }
    if (detail) { setDetail(null); setActionError(''); return; }
    onClose();
  };
  const start = async () => {
    if (!detail) return;
    setBusy(true); setActionError('');
    try { openGuide(await onStart(detail.record.id)); setDetail(null); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Unable to start project.'); }
    finally { setBusy(false); }
  };
  const toggleStep = async () => {
    if (!project) return;
    setBusy(true); setActionError('');
    try { await onStep(project.id, stepIndex, !project.completed_steps.includes(stepIndex)); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Unable to update step.'); }
    finally { setBusy(false); }
  };

  const title = project ? 'Step-by-Step Guide' : detail ? 'Saved idea' : section === 'projects' ? 'My projects' : 'Saved ideas';
  return <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={back}>
    <View style={styles.scrim}>
      <View style={styles.scrimTouch} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          {project || detail ? <Pressable onPress={back} accessibilityLabel="Back" hitSlop={10}><ArrowLeft size={22} color={TEXT} /></Pressable> : <View style={styles.headerSpace} />}
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={10}><X size={22} color={TEXT} /></Pressable>
        </View>

        {project ? <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.projectIntro}><View style={styles.artLarge}><ClipboardList size={30} color={GREEN} /></View><View style={styles.cardCopy}><Text style={styles.detailTitle}>{project.title}</Text><Text style={styles.muted}>From {project.material}</Text><Text style={styles.smallGreen}>{project.status === 'completed' ? 'Completed project' : 'In progress'}</Text></View></View>
          <Text style={styles.sectionTitle}>{project.progress_percent}% complete</Text>
          <ProgressBar percent={project.progress_percent} />
          <Text style={styles.muted}>{project.completed_count} completed · {project.total_steps - project.completed_count} remaining · {project.total_steps} total steps</Text>
          {project.safety_note ? <View style={styles.note}><Text style={styles.noteText}>{project.safety_note}</Text></View> : null}
          <Text style={styles.sectionTitle}>Steps</Text>
          {project.steps.map((step, index) => <Pressable key={`${project.id}-${index}`} style={[styles.stepRow, stepIndex === index && styles.stepRowActive]} onPress={() => setStepIndex(index)}>
            <View style={[styles.stepNumber, project.completed_steps.includes(index) && styles.stepDone]}>{project.completed_steps.includes(index) ? <Check size={15} color="#fff" /> : <Text style={styles.stepNumberText}>{index + 1}</Text>}</View>
            <View style={styles.cardCopy}><Text style={styles.stepTitle}>Step {index + 1}</Text><Text style={styles.muted} numberOfLines={stepIndex === index ? undefined : 1}>{step}</Text></View>
          </Pressable>)}
          <View style={styles.instruction}><Text style={styles.sectionTitle}>Step {stepIndex + 1} of {project.total_steps}</Text><Text style={styles.instructionText}>{project.steps[stepIndex]}</Text></View>
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
          <Pressable style={styles.primaryButton} onPress={toggleStep} disabled={busy}><Check size={18} color="#fff" /><Text style={styles.primaryText}>{busy ? 'Saving…' : project.completed_steps.includes(stepIndex) ? 'Mark as not done' : 'Mark step as done'}</Text></Pressable>
          <View style={styles.stepActions}><Pressable style={styles.secondaryButton} onPress={() => setStepIndex(Math.max(0, stepIndex - 1))} disabled={stepIndex === 0}><Text style={styles.secondaryText}>Previous</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => setStepIndex(Math.min(project.total_steps - 1, stepIndex + 1))} disabled={stepIndex >= project.total_steps - 1}><Text style={styles.secondaryText}>Next</Text></Pressable></View>
          <Text style={styles.footnote}>Text guide only. Video instructions are not available yet.</Text>
        </ScrollView> : detail ? <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.detailArtwork}><Lightbulb size={45} color={GREEN} /></View>
          <Text style={styles.detailTitle}>{detail.idea?.title || 'Saved recommendation'}</Text>
          <Text style={styles.smallGreen}>From {detail.record.title}</Text>
          <Text style={styles.description}>{detail.idea?.summary || 'Details for this older saved recommendation are unavailable.'}</Text>
          {detail.idea ? <><Text style={styles.sectionTitle}>Materials needed</Text>{detail.idea.materials.map((material, index) => <View key={`${index}-${material}`} style={styles.materialRow}><Text style={styles.muted}>• {material}</Text></View>)}<Text style={styles.sectionTitle}>{detail.idea.steps.length} text steps</Text>{detail.idea.safety_note ? <View style={styles.note}><Text style={styles.noteText}>{detail.idea.safety_note}</Text></View> : null}</> : null}
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
          {detail.idea?.steps.length ? <Pressable style={styles.primaryButton} onPress={started ? () => { openGuide(started); setDetail(null); } : start} disabled={busy}><Text style={styles.primaryText}>{busy ? 'Starting…' : started ? 'Continue project' : 'Start project'}</Text><ChevronRight size={18} color="#fff" /></Pressable> : null}
          <Text style={styles.footnote}>A saved idea enters My Projects only when you start it.</Text>
        </ScrollView> : section === 'projects' ? <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.muted}>Track projects you have started.</Text>
          <View style={styles.filters}>{(['all', 'active', 'completed'] as const).map((value) => <Pressable key={value} style={[styles.filterChip, filter === value && styles.filterSelected]} onPress={() => setFilter(value)}><Text style={[styles.filterText, filter === value && styles.filterTextSelected]}>{value === 'active' ? 'In progress' : value === 'all' ? 'All' : 'Completed'}</Text></Pressable>)}</View>
          {projectsError ? <Text style={styles.error}>{projectsError}</Text> : null}
          {shown.length ? shown.map((item) => <ProjectCard key={item.id} project={item} onPress={() => openGuide(item)} />) : <BlankState title={projectsLoading ? 'Loading projects…' : filter === 'completed' ? 'No completed projects yet' : 'No active projects yet'} body={projectsError ? 'Reconnect to load your projects.' : 'Start a saved idea to track its steps here.'} />}
        </ScrollView> : <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.muted}>Recommendations you selected after scanning. A separate favorite toggle is not available yet.</Text>
          <View style={styles.search}><Search size={18} color={MUTED} /><TextInput value={search} onChangeText={setSearch} placeholder="Search saved ideas" placeholderTextColor={MUTED} style={styles.searchInput} /></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{materials.map((value) => <Pressable key={value} style={[styles.filterChip, materialFilter === value && styles.filterSelected]} onPress={() => setMaterialFilter(value)}><Text style={[styles.filterText, materialFilter === value && styles.filterTextSelected]}>{value}</Text></Pressable>)}</ScrollView>
          {savedError ? <Text style={styles.error}>{savedError}</Text> : null}
          {visibleSaved.length ? visibleSaved.map((entry) => <Pressable key={entry.record.id} style={styles.listCard} onPress={() => setDetail(entry)}><View style={styles.art}><Bookmark size={24} color={GREEN} /></View><View style={styles.cardCopy}><Text style={styles.cardTitle} numberOfLines={1}>{entry.idea?.title || 'Saved recommendation'}</Text><Text style={styles.cardSub} numberOfLines={1}>From {entry.record.title}</Text><Text style={styles.smallGreen}>{projects.some((item) => item.source_prediction_id === entry.record.id && item.recommendation_id === entry.record.selected_recommendation) ? 'Started' : 'Saved for later'}</Text></View><ChevronRight size={18} color={GREEN} /></Pressable>) : <BlankState title={savedLoading ? 'Loading saved ideas…' : search || materialFilter !== 'All' ? 'No matching ideas' : 'No saved projects yet'} body={savedError ? 'Reconnect to load selected recommendations.' : 'Select a recommendation after scanning to save it here.'} />}
        </ScrollView>}
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#09191299' },
  scrimTouch: { flex: 1 },
  sheet: { maxHeight: '89%', minHeight: 380, backgroundColor: '#fff', borderTopLeftRadius: 23, borderTopRightRadius: 23, paddingTop: 9 },
  handle: { width: 42, height: 4, borderRadius: 3, alignSelf: 'center', backgroundColor: '#c7ccc9', marginBottom: 13 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 13, gap: 10 },
  headerSpace: { width: 22 },
  title: { flex: 1, color: TEXT, fontWeight: '900', fontSize: 19 },
  body: { paddingHorizontal: 20, paddingBottom: 35 },
  muted: { color: MUTED, fontSize: 12, lineHeight: 18 },
  filters: { flexDirection: 'row', gap: 8, paddingVertical: 16, paddingRight: 15 },
  filterChip: { borderRadius: 20, backgroundColor: '#f3f6f3', minHeight: 34, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  filterSelected: { backgroundColor: GREEN },
  filterText: { color: TEXT, fontSize: 11, fontWeight: '700' },
  filterTextSelected: { color: '#fff' },
  listCard: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 16, borderColor: LINE, borderWidth: 1, marginBottom: 10, minHeight: 82 },
  art: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#e7f3e9', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  artLarge: { width: 68, height: 68, borderRadius: 15, backgroundColor: '#e7f3e9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardCopy: { flex: 1 },
  cardTitle: { color: TEXT, fontSize: 13, fontWeight: '900' },
  cardSub: { color: MUTED, fontSize: 11, marginTop: 3 },
  tiny: { color: MUTED, fontSize: 10, marginTop: 5 },
  smallGreen: { color: GREEN, fontSize: 11, fontWeight: '800', marginTop: 6 },
  progressLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  progressTrack: { height: 7, borderRadius: 7, flex: 1, backgroundColor: '#e5ebe6', overflow: 'hidden', marginVertical: 6 },
  progressFill: { height: '100%', backgroundColor: '#219653', borderRadius: 7 },
  empty: { borderRadius: 16, borderColor: LINE, borderWidth: 1, padding: 19, alignItems: 'center', marginTop: 8 },
  emptyTitle: { color: TEXT, fontSize: 14, fontWeight: '900', marginTop: 10, marginBottom: 5 },
  search: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: LINE, borderRadius: 13, paddingHorizontal: 12, marginTop: 15 },
  searchInput: { flex: 1, minHeight: 43, color: TEXT, marginLeft: 8 },
  projectIntro: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  detailTitle: { color: TEXT, fontSize: 20, fontWeight: '900', lineHeight: 26 },
  sectionTitle: { color: TEXT, fontSize: 14, fontWeight: '900', marginTop: 17, marginBottom: 8 },
  note: { padding: 12, borderRadius: 13, backgroundColor: '#fff4df', marginTop: 15 },
  noteText: { color: '#735719', fontSize: 11, lineHeight: 17 },
  stepRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 13, marginVertical: 3 },
  stepRowActive: { backgroundColor: '#e9f6ed' },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e9eeea', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  stepDone: { backgroundColor: GREEN },
  stepNumberText: { color: TEXT, fontSize: 11, fontWeight: '900' },
  stepTitle: { color: TEXT, fontSize: 12, fontWeight: '800' },
  instruction: { padding: 13, borderColor: LINE, borderWidth: 1, borderRadius: 14, marginTop: 15 },
  instructionText: { color: TEXT, fontSize: 12, lineHeight: 19 },
  primaryButton: { backgroundColor: GREEN, borderRadius: 13, minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  stepActions: { flexDirection: 'row', gap: 9, marginTop: 9 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: GREEN, borderRadius: 12, minHeight: 43, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: GREEN, fontSize: 12, fontWeight: '800' },
  footnote: { color: MUTED, fontSize: 10, lineHeight: 15, marginTop: 16 },
  detailArtwork: { height: 130, borderRadius: 16, backgroundColor: '#e7f3e9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  description: { color: TEXT, fontSize: 12, lineHeight: 19, marginTop: 14 },
  materialRow: { paddingVertical: 7, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: LINE },
  error: { color: '#a12622', fontSize: 12, lineHeight: 18, marginVertical: 8 },
});
