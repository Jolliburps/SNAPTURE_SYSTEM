import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FolderOpen,
  House,
  Info,
  Leaf,
  Lightbulb,
  MapPin,
  Recycle,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';

import {
  getMaterials,
  getPredictionOverview,
  listProjects,
  listSavedPredictions,
  setProjectStep,
  startProject,
  updateMyProfile,
  type ApiUser,
  type MaterialGuide,
  type PredictionSummary,
  type UserProject,
} from './api';
import { getLocalUpdates, type LocalUpdate } from './localUpdates';
import ProjectPanels from './ProjectPanels';
import SettingsPage from './SettingsPage';
import { activeProjectsSorted, savedIdeas, type Idea } from './projectData';

export type MainRoute = 'home' | 'learn' | 'camera' | 'waste' | 'profile' | 'calendar' | 'ideas' | 'projects' | 'saved' | 'settings' | 'history';
type TabRoute = 'home' | 'learn' | 'camera' | 'waste' | 'profile';
type Navigate = (route: MainRoute) => void;

const COLORS = {
  green: '#176b45',
  deep: '#143f30',
  mint: '#e8f5ec',
  pale: '#f5f9f5',
  line: '#dce9df',
  muted: '#708178',
  text: '#1c3027',
  white: '#ffffff',
  amber: '#fff3df',
};

// Real schedule entries can replace this empty source once a verified
// barangay-level feed is available. No official dates are inferred here.
type CollectionEntry = { date: string; barangay: string; title: string; status: string; description?: string };
const COLLECTION_ENTRIES: CollectionEntry[] = [];

type LearnTopic = {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tint: string;
  content: string;
  sourceStatus: 'General guidance' | 'Awaiting verified local information';
};

const LEARN_TOPICS: LearnTopic[] = [
  { id: 'segregation', title: 'Waste segregation', subtitle: 'Separate materials before collection', icon: ClipboardList, tint: '#e6f2ff', content: 'Keep different material types separate where practical. Check the material guide for preparation advice, and follow your barangay instructions when they become available.', sourceStatus: 'General guidance' },
  { id: 'disposal', title: 'Disposal guidelines', subtitle: 'Prepare items responsibly', icon: Recycle, tint: '#e7f5e8', content: 'The Waste library contains material-specific preparation and disposal guidance. For uncertain or hazardous items, seek verified local instructions before disposal.', sourceStatus: 'General guidance' },
  { id: 'restricted', title: 'Prohibited waste', subtitle: 'Local restrictions and special handling', icon: ShieldAlert, tint: '#fff0e7', content: 'Verified local restricted-waste rules have not been added yet. Do not use this page as a list of official prohibitions.', sourceStatus: 'Awaiting verified local information' },
  { id: 'policies', title: 'Local policies', subtitle: 'Barangay and city information', icon: BookOpen, tint: '#f1eafd', content: 'Verified Bacoor City and barangay policy information will appear here when an authoritative source is connected.', sourceStatus: 'Awaiting verified local information' },
  { id: 'facilities', title: 'Recycling facilities', subtitle: 'Drop-off and collection locations', icon: MapPin, tint: '#e8f4f8', content: 'Verified facility names, locations, and opening hours have not been added yet.', sourceStatus: 'Awaiting verified local information' },
  { id: 'habits', title: 'Everyday practices', subtitle: 'Small steps at home', icon: Sparkles, tint: '#fff4df', content: 'Consider reuse before disposal, and keep reusable items clean and safe to handle. The scan flow can help identify a supported material and suggest suitable ideas.', sourceStatus: 'General guidance' },
];

const TABS: Array<{ key: TabRoute; label: string; icon: LucideIcon }> = [
  { key: 'home', label: 'Home', icon: House },
  { key: 'learn', label: 'Learn', icon: BookOpen },
  { key: 'camera', label: 'Camera', icon: Camera },
  { key: 'waste', label: 'Waste', icon: Recycle },
  { key: 'profile', label: 'Profile', icon: UserRound },
];

export function BottomNavigation({ active, navigate }: { active: TabRoute; navigate: Navigate }) {
  return <View style={styles.bottomNav} accessibilityRole="tablist">
    {TABS.map(({ key, label, icon: Icon }) => {
      const selected = active === key;
      return <Pressable
        key={key}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        onPress={() => navigate(key)}
        style={styles.tab}
      >
        {key === 'camera'
          ? <View style={styles.cameraTab}><Icon size={27} color={COLORS.white} strokeWidth={2.3} /></View>
          : <Icon size={23} color={selected ? COLORS.green : COLORS.muted} strokeWidth={selected ? 2.5 : 1.9} />}
        <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{label}</Text>
      </Pressable>;
    })}
  </View>;
}

function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text>{action && onAction ? <Pressable onPress={onAction} hitSlop={10}><Text style={styles.sectionAction}>{action}  ›</Text></Pressable> : null}</View>;
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <View style={styles.searchField}><Search size={19} color={COLORS.muted} /><TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={COLORS.muted} style={styles.searchText} autoCorrect={false} /></View>;
}

function EmptyCard({ icon: Icon, title, body, action, onAction }: { icon: LucideIcon; title: string; body: string; action?: string; onAction?: () => void }) {
  return <View style={styles.emptyCard}><View style={styles.emptyIcon}><Icon size={22} color={COLORS.green} /></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text>{action && onAction ? <Pressable onPress={onAction} style={styles.inlineAction}><Text style={styles.inlineActionText}>{action}</Text><ChevronRight size={15} color={COLORS.green} /></Pressable> : null}</View>;
}

function BrandHeader({ title, subtitle, right }: { title?: string; subtitle?: string; right?: React.ReactNode }) {
  return <View style={styles.brandHeader}><View style={styles.brandMark}><Leaf size={21} color={COLORS.green} fill="#d9efdf" /></View><View style={styles.brandCopy}><Text style={styles.brandName}>{title || 'SNAPTURE'}</Text>{subtitle ? <Text style={styles.brandSub}>{subtitle}</Text> : null}</View>{right}</View>;
}

function PageIntro({ title, subtitle }: { title: string; subtitle: string }) {
  return <View style={styles.pageIntro}><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageSubtitle}>{subtitle}</Text></View>;
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <View style={styles.backHeader}><Pressable style={styles.backButton} onPress={onBack} accessibilityLabel="Go back"><ArrowLeft size={21} color={COLORS.deep} /></Pressable><Text style={styles.backTitle}>{title}</Text></View>;
}

function flattenIdeas(guides: MaterialGuide[]) {
  return guides.flatMap((guide) => guide.upcycling.map((idea) => ({ ...idea, material: guide.short_title || guide.title, guideLabel: guide.label })));
}

function IdeaCard({ idea, onPress, compact = false }: { idea: Idea; onPress: () => void; compact?: boolean }) {
  return <Pressable style={[styles.ideaCard, compact && styles.ideaCardCompact]} onPress={onPress}>
    <View style={styles.ideaArtwork}><Lightbulb size={31} color={COLORS.green} strokeWidth={1.7} /></View>
    <View style={styles.ideaCopy}><Text style={styles.ideaMaterial}>{idea.material}</Text><Text style={styles.ideaTitle} numberOfLines={2}>{idea.title}</Text><Text style={styles.ideaSummary} numberOfLines={compact ? 2 : 3}>{idea.summary}</Text></View>
    <View style={styles.ideaFoot}><Text style={styles.ideaFootText}>{idea.steps.length} steps</Text><ChevronRight size={17} color={COLORS.green} /></View>
  </Pressable>;
}

export function MainExperience({ screen, navigate, user, onUserChange, onCategory, onLogout }: {
  screen: MainRoute;
  navigate: Navigate;
  user: ApiUser | null;
  onUserChange: (next: ApiUser) => void;
  onCategory: (label: string) => void;
  onLogout: () => void;
}) {
  const [guides, setGuides] = useState<MaterialGuide[]>([]);
  const [guidesLoading, setGuidesLoading] = useState(true);
  const [guidesError, setGuidesError] = useState('');
  const [records, setRecords] = useState<PredictionSummary[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState('');
  const [savedRecords, setSavedRecords] = useState<PredictionSummary[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState('');
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState('');
  const [updates, setUpdates] = useState<LocalUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [updatesError, setUpdatesError] = useState('');
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);

  const loadGuides = useCallback(() => {
    setGuidesLoading(true);
    setGuidesError('');
    getMaterials().then((response) => setGuides(response.materials)).catch((error) => setGuidesError(error instanceof Error ? error.message : 'Unable to load materials.')).finally(() => setGuidesLoading(false));
  }, []);
  const loadRecords = useCallback(() => {
    setRecordsLoading(true);
    setRecordsError('');
    getPredictionOverview().then((response) => { setRecords(response.predictions); setScanCount(response.total_count); }).catch((error) => setRecordsError(error instanceof Error ? error.message : 'Unable to load scans.')).finally(() => setRecordsLoading(false));
  }, []);
  const loadSaved = useCallback(() => {
    setSavedLoading(true); setSavedError('');
    listSavedPredictions().then(setSavedRecords).catch((error) => setSavedError(error instanceof Error ? error.message : 'Unable to load saved ideas.')).finally(() => setSavedLoading(false));
  }, []);
  const loadProjects = useCallback(() => {
    setProjectsLoading(true); setProjectsError('');
    listProjects().then(setProjects).catch((error) => setProjectsError(error instanceof Error ? error.message : 'Unable to load projects.')).finally(() => setProjectsLoading(false));
  }, []);

  useEffect(() => {
    getLocalUpdates().then(setUpdates).catch((error) => setUpdatesError(error instanceof Error ? error.message : 'Unable to load local updates.')).finally(() => setUpdatesLoading(false));
  }, []);

  useEffect(() => { loadGuides(); loadRecords(); loadSaved(); loadProjects(); }, [loadGuides, loadRecords, loadSaved, loadProjects]);
  const ideas = useMemo(() => flattenIdeas(guides), [guides]);
  const saved = useMemo(() => savedIdeas(savedRecords, ideas), [savedRecords, ideas]);
  const active = useMemo(() => activeProjectsSorted(projects), [projects]);
  const tab: TabRoute = screen === 'learn' ? 'learn' : screen === 'waste' ? 'waste' : ['profile', 'projects', 'saved', 'settings', 'history'].includes(screen) ? 'profile' : 'home';
  const startSavedProject = async (predictionId: number) => {
    const { project } = await startProject(predictionId);
    setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]);
    return project;
  };
  const updateStep = async (projectId: number, stepIndex: number, completed: boolean) => {
    const { project } = await setProjectStep(projectId, stepIndex, completed);
    setProjects((current) => current.map((item) => item.id === project.id ? project : item));
    return project;
  };

  return <View style={styles.appPage}>
    {screen === 'home' ? <HomePage user={user} records={records} recordsLoading={recordsLoading} recordsError={recordsError} ideas={ideas} guidesLoading={guidesLoading} guidesError={guidesError} updates={updates} updatesLoading={updatesLoading} updatesError={updatesError} activeProjects={active} projectsLoading={projectsLoading} projectsError={projectsError} navigate={navigate} onOpenIdea={setSelectedIdea} /> : null}
    {screen === 'learn' ? <LearnPage navigate={navigate} /> : null}
    {screen === 'waste' ? <WastePage guides={guides} loading={guidesLoading} error={guidesError} retry={loadGuides} onCategory={onCategory} /> : null}
    {['profile', 'projects', 'saved'].includes(screen) ? <ProfilePage user={user} scanCount={scanCount} recordsLoading={recordsLoading} recordsError={recordsError} savedCount={saved.length} savedLoading={savedLoading} savedError={savedError} projects={projects} projectsLoading={projectsLoading} projectsError={projectsError} navigate={navigate} onUserChange={onUserChange} /> : null}
    {screen === 'calendar' ? <CalendarPage user={user} navigate={navigate} /> : null}
    {screen === 'ideas' ? <IdeasPage ideas={ideas} loading={guidesLoading} error={guidesError} retry={loadGuides} navigate={navigate} onOpen={setSelectedIdea} /> : null}
    {screen === 'settings' ? <SettingsPage user={user} onUserChange={onUserChange} onBack={() => navigate('profile')} onLogout={onLogout} /> : null}
    <BottomNavigation active={tab} navigate={navigate} />
    {screen === 'projects' || screen === 'saved' ? <ProjectPanels section={screen} projects={projects} projectsLoading={projectsLoading} projectsError={projectsError} saved={saved} savedLoading={savedLoading} savedError={savedError} onClose={() => navigate('profile')} onStart={startSavedProject} onStep={updateStep} /> : null}
    <Modal visible={selectedIdea !== null} animationType="slide" transparent onRequestClose={() => setSelectedIdea(null)}>
      <View style={styles.modalShade}><View style={styles.ideaModal}><BackHeader title="Project idea" onBack={() => setSelectedIdea(null)} />{selectedIdea ? <ScrollView showsVerticalScrollIndicator={false}><Text style={styles.pageTitle}>{selectedIdea.title}</Text><Text style={styles.pageSubtitle}>{selectedIdea.summary}</Text><Text style={styles.detailLabel}>Materials</Text>{selectedIdea.materials.map((item, index) => <Text key={`${index}-${item}`} style={styles.detailText}>• {item}</Text>)}<Text style={styles.detailLabel}>Steps</Text>{selectedIdea.steps.map((step, index) => <Text key={`${index}-${step}`} style={styles.detailText}>{index + 1}. {step}</Text>)}{selectedIdea.safety_note ? <Text style={styles.detailWarning}>{selectedIdea.safety_note}</Text> : null}<Text style={styles.placeholderNote}>Select a recommendation after scanning to save it. Start it from Profile when you are ready to track steps.</Text></ScrollView> : null}</View></View>
    </Modal>
  </View>;
}

function LocalUpdates({ updates, loading, error }: { updates: LocalUpdate[]; loading: boolean; error: string }) {
  return <><SectionHeading title="Local updates" />{error ? <Text style={styles.errorText}>{error}</Text> : null}
    {updates.length ? updates.map((update) => <View key={update.id} style={styles.updateCard}><View style={styles.cardIconAmber}><Info size={20} color={COLORS.green} /></View><View style={styles.updateCopy}><Text style={styles.updateCategory}>{update.category} · {new Date(update.publishedAt).toLocaleDateString()}</Text><Text style={styles.updateTitle}>{update.title}</Text><Text style={styles.mutedSmall}>{update.description}</Text></View></View>)
      : <EmptyCard icon={Info} title={loading ? 'Loading local updates…' : error ? 'Local updates unavailable' : 'No new local updates'} body="Verified announcements from the SNAPTURE administrator will appear here when available." />}</>;
}

function HomePage({ user, records, recordsLoading, recordsError, ideas, guidesLoading, guidesError, updates, updatesLoading, updatesError, activeProjects, projectsLoading, projectsError, navigate, onOpenIdea }: {
  user: ApiUser | null; records: PredictionSummary[]; recordsLoading: boolean; recordsError: string; ideas: Idea[]; guidesLoading: boolean; guidesError: string; updates: LocalUpdate[]; updatesLoading: boolean; updatesError: string; activeProjects: UserProject[]; projectsLoading: boolean; projectsError: string; navigate: Navigate; onOpenIdea: (idea: Idea) => void;
}) {
  const [query, setQuery] = useState('');
  const { width } = useWindowDimensions();
  const firstName = user?.display_name && user.display_name !== user.email ? user.display_name.trim().split(/\s+/)[0] : '';
  const matches = query.trim() ? ideas.filter((idea) => `${idea.title} ${idea.material}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 4) : [];
  const recent = records[0];
  const topProject = activeProjects[0];

  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <BrandHeader subtitle="Scan today. A cleaner tomorrow." right={<Pressable style={styles.avatar} onPress={() => navigate('profile')} accessibilityLabel="Open profile"><Text style={styles.avatarLetter}>{firstName ? firstName[0].toUpperCase() : 'S'}</Text></Pressable>} />
    <Text style={styles.greeting}>Good day{firstName ? `, ${firstName}` : ''}</Text>
    <Text style={styles.heroTitle}>Small actions, a cleaner community.</Text>
    <Text style={styles.heroSub}>Discover what to do with one item at a time.</Text>
    <SearchField value={query} onChange={setQuery} placeholder="Search ideas and materials" />
    {query.trim() ? <View style={styles.searchResults}>{matches.length ? matches.map((idea) => <Pressable key={`${idea.guideLabel}-${idea.id}`} style={styles.searchResult} onPress={() => onOpenIdea(idea)}><Search size={15} color={COLORS.green} /><Text style={styles.searchResultText}>{idea.title} · {idea.material}</Text><ChevronRight size={16} color={COLORS.muted} /></Pressable>) : <Text style={styles.mutedSmall}>{guidesLoading ? 'Searching materials…' : 'No matching ideas yet.'}</Text>}</View> : null}
    <LocalUpdates updates={updates} loading={updatesLoading} error={updatesError} />
    <View style={[styles.homePair, width < 360 && styles.homePairStack]}>
      <View style={styles.homeMiniCard}><View style={styles.cardIconMint}><CalendarDays size={20} color={COLORS.green} /></View><Text style={styles.miniTitle}>Collection schedule</Text><Text style={styles.miniBody}>{user?.barangay ? `Barangay ${user.barangay}` : 'Choose your barangay in Profile'}</Text><Text style={styles.miniMuted}>No verified schedule available yet.</Text><Pressable onPress={() => navigate('calendar')} style={styles.miniLink}><Text style={styles.miniLinkText}>View calendar</Text><ChevronRight size={15} color={COLORS.green} /></Pressable></View>
      <View style={styles.homeMiniCard}><View style={styles.cardIconAmber}><FolderOpen size={20} color={COLORS.green} /></View><Text style={styles.miniTitle}>Ongoing projects</Text><Text style={styles.miniBody}>{topProject ? topProject.title : projectsLoading ? 'Loading projects…' : projectsError ? 'Projects unavailable' : 'No ongoing projects yet.'}</Text>{topProject ? <><Text style={styles.miniMuted}>{topProject.completed_count} of {topProject.total_steps} steps · {topProject.progress_percent}% complete</Text><View style={styles.homeProgressTrack}><View style={[styles.homeProgressFill, { width: `${topProject.progress_percent}%` }]} /></View></> : <Text style={styles.miniMuted}>{projectsError ? 'Reconnect to load projects.' : 'Start a saved idea to track its steps.'}</Text>}<Pressable onPress={() => navigate('projects')} style={styles.miniLink}><Text style={styles.miniLinkText}>View all</Text><ChevronRight size={15} color={COLORS.green} /></Pressable></View>
    </View>
    <SectionHeading title="Ideas for a greener tomorrow" action="View all" onAction={() => navigate('ideas')} />
    {guidesError ? <Text style={styles.errorText}>{guidesError}</Text> : null}
    {ideas.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalIdeas}>{ideas.slice(0, 5).map((idea) => <IdeaCard key={`${idea.guideLabel}-${idea.id}`} idea={idea} compact onPress={() => onOpenIdea(idea)} />)}</ScrollView> : <EmptyCard icon={Lightbulb} title={guidesLoading ? 'Loading ideas…' : guidesError ? 'Ideas unavailable' : 'Recommendations will appear here'} body="Ideas are provided by the material guide when the backend is available." />}
    <SectionHeading title="Recent scan" action="Scan history" onAction={() => navigate('history')} />
    {recordsError ? <Text style={styles.errorText}>{recordsError}</Text> : null}
    {recent ? <Pressable style={styles.recentCard} onPress={() => navigate('history')}><View style={styles.cardIconMint}><Recycle size={21} color={COLORS.green} /></View><View style={styles.recentCopy}><Text style={styles.recentTitle}>{recent.title}</Text><Text style={styles.mutedSmall}>{new Date(recent.created_at).toLocaleDateString()} · {Math.round(recent.confidence * 100)}% confidence</Text></View><ChevronRight size={18} color={COLORS.green} /></Pressable> : <EmptyCard icon={Camera} title={recordsLoading ? 'Loading scans…' : recordsError ? 'Scans unavailable' : 'No scans yet'} body={recordsError ? 'Reconnect and open your history to try again.' : 'Your completed scans will appear here.'} action={!recordsError ? 'Start scanning' : undefined} onAction={() => navigate('camera')} />}
  </ScrollView>;
}

function LearnPage({ navigate }: { navigate: Navigate }) {
  const [selected, setSelected] = useState<LearnTopic | null>(null);
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
    {selected ? <><BackHeader title="Learn" onBack={() => setSelected(null)} /><View style={[styles.topicIconLarge, { backgroundColor: selected.tint }]}><selected.icon size={30} color={COLORS.green} /></View><PageIntro title={selected.title} subtitle={selected.subtitle} /><View style={styles.guidanceCard}><Text style={styles.guidanceLabel}>{selected.sourceStatus}</Text><Text style={styles.guidanceBody}>{selected.content}</Text></View>{['disposal', 'segregation'].includes(selected.id) ? <Pressable style={styles.fullButton} onPress={() => navigate('waste')}><Text style={styles.fullButtonText}>Open Waste materials</Text><ChevronRight size={18} color={COLORS.white} /></Pressable> : null}</> : <><BrandHeader /><PageIntro title="Learn" subtitle="Guides and information for thoughtful waste management." /><View style={styles.noticeCard}><Info size={19} color={COLORS.green} /><Text style={styles.noticeText}>Local policies and facilities will be added after they are verified. General tips are labeled below.</Text></View>{LEARN_TOPICS.map((topic) => { const Icon = topic.icon; return <Pressable key={topic.id} style={styles.learnCard} onPress={() => setSelected(topic)}><View style={[styles.learnIcon, { backgroundColor: topic.tint }]}><Icon size={24} color={COLORS.green} /></View><View style={styles.learnCopy}><Text style={styles.learnTitle}>{topic.title}</Text><Text style={styles.learnSub}>{topic.subtitle}</Text><Text style={styles.learnStatus}>{topic.sourceStatus}</Text></View><ChevronRight size={18} color={COLORS.muted} /></Pressable>; })}</>}
  </ScrollView>;
}

function WastePage({ guides, loading, error, retry, onCategory }: { guides: MaterialGuide[]; loading: boolean; error: string; retry: () => void; onCategory: (label: string) => void }) {
  const [query, setQuery] = useState('');
  const visible = guides.filter((guide) => `${guide.title} ${guide.description}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"><BrandHeader /><PageIntro title="Waste materials" subtitle="Explore materials currently supported by SNAPTURE." /><SearchField value={query} onChange={setQuery} placeholder="Search supported materials" />{error ? <Text style={styles.errorText}>{error}</Text> : null}{loading && !guides.length ? <EmptyCard icon={Recycle} title="Loading materials…" body="Fetching the supported material guide." /> : null}{!loading && !guides.length ? <EmptyCard icon={Recycle} title="Materials unavailable" body="Connect to the backend to load the current supported categories." action="Try again" onAction={retry} /> : null}<View style={styles.wasteGrid}>{visible.map((guide, index) => <Pressable key={guide.label} style={styles.wasteCard} onPress={() => onCategory(guide.label)}><View style={[styles.wasteArtwork, { backgroundColor: ['#e8f4ec', '#e8f3fa', '#fff3e5', '#f1ecfa'][index % 4] }]}><Recycle size={29} color={COLORS.green} strokeWidth={1.7} /></View><Text style={styles.wasteTitle} numberOfLines={2}>{guide.short_title || guide.title}</Text><Text style={styles.wasteSub} numberOfLines={2}>{guide.description}</Text><View style={styles.wasteFoot}><Text style={styles.wasteFootText}>Open guide</Text><ChevronRight size={16} color={COLORS.green} /></View></Pressable>)}</View>{guides.length > 0 && visible.length === 0 ? <EmptyCard icon={Search} title="No match found" body="Try another supported material name." /> : null}</ScrollView>;
}

function CalendarPage({ user, navigate }: { user: ApiUser | null; navigate: Navigate }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: firstWeekday + days }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const entries = COLLECTION_ENTRIES.filter((entry) => entry.date === dateKey && (!user?.barangay || entry.barangay.toLowerCase() === user.barangay.toLowerCase()));
  const changeMonth = (offset: number) => { setMonth(new Date(year, monthIndex + offset, 1)); setSelectedDay(1); };
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}><BackHeader title="Collection schedule" onBack={() => navigate('home')} /><PageIntro title="Barangay calendar" subtitle="Collection information will be filtered by your barangay when verified data is available." /><View style={styles.noticeCard}><MapPin size={19} color={COLORS.green} /><Text style={styles.noticeText}>{user?.barangay ? `Selected barangay: ${user.barangay}` : 'No barangay selected yet. Set one in Profile.'}</Text></View><View style={styles.calendarCard}><View style={styles.calendarHeader}><Pressable onPress={() => changeMonth(-1)} accessibilityLabel="Previous month" style={styles.monthButton}><ChevronLeft size={22} color={COLORS.green} /></Pressable><Text style={styles.calendarMonth}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text><Pressable onPress={() => changeMonth(1)} accessibilityLabel="Next month" style={styles.monthButton}><ChevronRight size={22} color={COLORS.green} /></Pressable></View><View style={styles.calendarGrid}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => <Text key={`${label}-${index}`} style={styles.weekday}>{label}</Text>)}{cells.map((day, index) => <Pressable key={index} disabled={!day} onPress={() => day && setSelectedDay(day)} style={[styles.calendarCell, day === selectedDay && styles.calendarCellSelected]}><Text style={[styles.calendarDay, day === selectedDay && styles.calendarDaySelected]}>{day || ''}</Text></Pressable>)}</View></View><SectionHeading title={new Date(year, monthIndex, selectedDay).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} />{entries.length ? entries.map((entry) => <View key={`${entry.date}-${entry.title}`} style={styles.scheduleEntry}><Text style={styles.scheduleTitle}>{entry.title}</Text><Text style={styles.mutedSmall}>{entry.barangay} · {entry.status}</Text>{entry.description ? <Text style={styles.emptyBody}>{entry.description}</Text> : null}</View>) : <EmptyCard icon={CalendarDays} title="No verified schedule available" body="Dates are empty until a verified barangay schedule is connected." />}</ScrollView>;
}

function IdeasPage({ ideas, loading, error, retry, navigate, onOpen }: { ideas: Idea[]; loading: boolean; error: string; retry: () => void; navigate: Navigate; onOpen: (idea: Idea) => void }) {
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}><BackHeader title="Home" onBack={() => navigate('home')} /><PageIntro title="Ideas & recommendations" subtitle="Projects from the supported material guides." />{error ? <Text style={styles.errorText}>{error}</Text> : null}{ideas.length ? ideas.map((idea) => <IdeaCard key={`${idea.guideLabel}-${idea.id}`} idea={idea} onPress={() => onOpen(idea)} />) : <EmptyCard icon={Lightbulb} title={loading ? 'Loading ideas…' : 'No recommendations available'} body="Ideas will appear when the material guides are available." action={!loading ? 'Try again' : undefined} onAction={retry} />}</ScrollView>;
}

function ProfilePage({ user, scanCount, recordsLoading, recordsError, savedCount, savedLoading, savedError, projects, projectsLoading, projectsError, navigate, onUserChange }: { user: ApiUser | null; scanCount: number; recordsLoading: boolean; recordsError: string; savedCount: number; savedLoading: boolean; savedError: string; projects: UserProject[]; projectsLoading: boolean; projectsError: string; navigate: Navigate; onUserChange: (user: ApiUser) => void }) {
  const [barangay, setBarangay] = useState(user?.barangay || '');
  const [editingBarangay, setEditingBarangay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  useEffect(() => { setBarangay(user?.barangay || ''); }, [user?.barangay]);
  const saveBarangay = async () => {
    setSaving(true); setSaveError(''); setSaveMessage('');
    try { const response = await updateMyProfile({ barangay: barangay.trim() }); onUserChange(response.user); setEditingBarangay(false); setSaveMessage('Barangay saved.'); }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Unable to save barangay.'); }
    finally { setSaving(false); }
  };
  const completedCount = projects.filter((project) => project.status === 'completed').length;
  const ongoingCount = projects.filter((project) => project.status === 'active').length;
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <BrandHeader right={<Pressable onPress={() => navigate('settings')} accessibilityLabel="Open settings" hitSlop={12}><Settings size={22} color={COLORS.deep} /></Pressable>} />
    <PageIntro title="My profile" subtitle="Your activity and account settings." />
    <Pressable style={styles.profileHero} onPress={() => navigate('settings')} accessibilityLabel="Open profile settings">
      <View style={styles.profileAvatar}>
        {user?.profile_picture_url ? <Image source={{ uri: user.profile_picture_url }} style={styles.profileImage} /> : <Text style={styles.profileInitial}>{(user?.display_name || user?.email || 'S').charAt(0).toUpperCase()}</Text>}
      </View>
      <View style={styles.profileIdentity}>
        <Text style={styles.profileName}>{user?.display_name && user.display_name !== user.email ? user.display_name : 'SNAPTURE user'}</Text>
        <Text style={styles.profileEmail}>{user?.email || 'Email unavailable'}</Text>
      </View>
      <ChevronRight size={17} color={COLORS.green} />
    </Pressable>
    <View style={styles.statsRow}>
      <View style={styles.statCard}><Camera size={20} color={COLORS.green} /><Text style={styles.statValue}>{recordsError ? '—' : recordsLoading ? '…' : scanCount}</Text><Text style={styles.statLabel}>Items scanned</Text></View>
      <View style={styles.statCard}><FolderOpen size={20} color={COLORS.green} /><Text style={styles.statValue}>{projectsError ? '—' : projectsLoading ? '…' : completedCount}</Text><Text style={styles.statLabel}>Projects completed</Text></View>
    </View>
    {recordsError ? <Text style={styles.errorText}>{recordsError}</Text> : null}
    {projectsError ? <Text style={styles.errorText}>{projectsError}</Text> : null}
    <SectionHeading title="My projects" action="View all" onAction={() => navigate('projects')} />
    <Pressable style={styles.profileLinkCard} onPress={() => navigate('projects')}>
      <View style={styles.cardIconMint}><FolderOpen size={20} color={COLORS.green} /></View>
      <View style={styles.recentCopy}><Text style={styles.recentTitle}>My projects</Text><Text style={styles.mutedSmall}>{projectsLoading ? 'Loading projects…' : projectsError ? 'Projects unavailable' : String(ongoingCount) + ' in progress · ' + String(completedCount) + ' completed'}</Text></View>
      <ChevronRight size={18} color={COLORS.green} />
    </Pressable>
    <Pressable style={styles.profileLinkCard} onPress={() => navigate('saved')}>
      <View style={styles.cardIconAmber}><Bookmark size={20} color={COLORS.green} /></View>
      <View style={styles.recentCopy}><Text style={styles.recentTitle}>Saved / favorite projects</Text><Text style={styles.mutedSmall}>{savedLoading ? 'Loading saved ideas…' : savedError ? 'Saved ideas unavailable' : savedCount ? String(savedCount) + ' selected idea' + (savedCount === 1 ? '' : 's') : 'No saved ideas yet'}</Text></View>
      <ChevronRight size={18} color={COLORS.green} />
    </Pressable>
    <SectionHeading title="Scan history" action="View all" onAction={() => navigate('history')} />
    <Pressable style={styles.profileLinkCard} onPress={() => navigate('history')}>
      <View style={styles.cardIconMint}><ClipboardList size={20} color={COLORS.green} /></View>
      <View style={styles.recentCopy}><Text style={styles.recentTitle}>My scans</Text><Text style={styles.mutedSmall}>{recordsLoading ? 'Loading scans…' : recordsError ? 'Scans unavailable' : scanCount ? String(scanCount) + ' saved scan' + (scanCount === 1 ? '' : 's') : 'No scans yet'}</Text></View>
      <ChevronRight size={18} color={COLORS.green} />
    </Pressable>
    <SectionHeading title="Collection location" />
    <View style={styles.barangayCard}>
      <View style={styles.barangayHead}><MapPin size={20} color={COLORS.green} /><Text style={styles.barangayTitle}>Barangay</Text></View>
      {editingBarangay ? <>
        <TextInput value={barangay} onChangeText={setBarangay} style={styles.barangayInput} placeholder="Enter your barangay" placeholderTextColor={COLORS.muted} maxLength={120} autoCapitalize="words" />
        <Text style={styles.mutedSmall}>Only your barangay is needed. Do not enter a street address.</Text>
        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
        <Pressable style={styles.fullButton} onPress={saveBarangay} disabled={saving}><Text style={styles.fullButtonText}>{saving ? 'Saving…' : 'Save barangay'}</Text></Pressable>
        <Pressable onPress={() => { setEditingBarangay(false); setBarangay(user?.barangay || ''); }}><Text style={styles.cancelText}>Cancel</Text></Pressable>
      </> : <>
        <Text style={styles.barangayValue}>{user?.barangay || 'Not set'}</Text>
        <Text style={styles.mutedSmall}>Used to filter collection schedules when verified data is connected.</Text>
        {saveMessage ? <Text style={styles.successText}>{saveMessage}</Text> : null}
        <Pressable onPress={() => setEditingBarangay(true)} style={styles.inlineAction}><Text style={styles.inlineActionText}>{user?.barangay ? 'Change barangay' : 'Set barangay'}</Text><ChevronRight size={15} color={COLORS.green} /></Pressable>
      </>}
    </View>
    <SectionHeading title="Account" />
    <Pressable style={styles.profileLinkCard} onPress={() => navigate('settings')}>
      <View style={styles.cardIconMint}><Settings size={20} color={COLORS.green} /></View>
      <View style={styles.recentCopy}><Text style={styles.recentTitle}>Settings</Text><Text style={styles.mutedSmall}>Name, profile picture, and account information</Text></View>
      <ChevronRight size={18} color={COLORS.green} />
    </Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  appPage: { flex: 1, backgroundColor: COLORS.pale },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 116 },
  brandHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 46, marginBottom: 22 },
  brandMark: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginRight: 5 },
  brandCopy: { flex: 1 },
  brandName: { color: COLORS.deep, fontSize: 16, fontWeight: '900', letterSpacing: 1.6 },
  brandSub: { color: COLORS.muted, fontSize: 9, marginTop: 1 },
  avatar: { width: 39, height: 39, borderRadius: 20, backgroundColor: '#d5eddd', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: COLORS.deep, fontWeight: '900', fontSize: 17 },
  greeting: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  heroTitle: { color: COLORS.text, fontSize: 27, fontWeight: '900', lineHeight: 34, marginTop: 4, maxWidth: 310 },
  heroSub: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 18 },
  searchField: { minHeight: 48, backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 16 },
  searchText: { flex: 1, color: COLORS.text, fontSize: 13, paddingVertical: 8, marginLeft: 9 },
  searchResults: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 14, padding: 8, marginBottom: 15 },
  searchResult: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 9, minHeight: 42 },
  searchResultText: { flex: 1, color: COLORS.text, fontSize: 12 },
  updateCard: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  updateCopy: { flex: 1, marginLeft: 12 },
  updateCategory: { color: COLORS.green, fontSize: 10, fontWeight: '800' },
  updateTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900', marginTop: 4 },
  scanFeature: { backgroundColor: COLORS.green, borderRadius: 22, minHeight: 106, padding: 17, flexDirection: 'row', alignItems: 'center' },
  scanFeatureIcon: { width: 50, height: 50, borderRadius: 17, backgroundColor: '#e4f4e8', alignItems: 'center', justifyContent: 'center' },
  scanFeatureCopy: { flex: 1, marginHorizontal: 13 },
  scanFeatureTitle: { color: COLORS.white, fontSize: 16, fontWeight: '900' },
  scanFeatureSub: { color: '#d5ebdc', fontSize: 11, lineHeight: 16, marginTop: 5 },
  homePair: { flexDirection: 'row', gap: 10, marginTop: 18 },
  homePairStack: { flexDirection: 'column' },
  homeMiniCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, padding: 15, minHeight: 190 },
  cardIconMint: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.mint, alignItems: 'center', justifyContent: 'center' },
  cardIconAmber: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.amber, alignItems: 'center', justifyContent: 'center' },
  miniTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900', marginTop: 10 },
  miniBody: { color: COLORS.text, fontSize: 11, lineHeight: 15, marginTop: 6 },
  miniMuted: { color: COLORS.muted, fontSize: 10, lineHeight: 14, marginTop: 4, flex: 1 },
  homeProgressTrack: { height: 6, backgroundColor: '#e5ebe6', borderRadius: 6, overflow: 'hidden', marginTop: 9 },
  homeProgressFill: { height: '100%', backgroundColor: '#219653', borderRadius: 6 },
  miniLink: { flexDirection: 'row', alignItems: 'center', marginTop: 10, minHeight: 30 },
  miniLinkText: { color: COLORS.green, fontSize: 11, fontWeight: '800' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900', flexShrink: 1 },
  sectionAction: { color: COLORS.green, fontSize: 11, fontWeight: '800' },
  horizontalIdeas: { gap: 12, paddingRight: 20 },
  ideaCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 19, overflow: 'hidden', marginBottom: 11 },
  ideaCardCompact: { width: 192, marginBottom: 0 },
  ideaArtwork: { height: 84, backgroundColor: '#e4f2e7', alignItems: 'center', justifyContent: 'center' },
  ideaCopy: { paddingHorizontal: 13, paddingTop: 11 },
  ideaMaterial: { color: COLORS.green, fontSize: 10, fontWeight: '800' },
  ideaTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900', marginTop: 4 },
  ideaSummary: { color: COLORS.muted, fontSize: 11, lineHeight: 15, marginTop: 5 },
  ideaFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, paddingVertical: 10 },
  ideaFootText: { color: COLORS.muted, fontSize: 10 },
  recentCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center' },
  recentCopy: { flex: 1, marginHorizontal: 12 },
  recentTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900' },
  mutedSmall: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  emptyCard: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 18, padding: 16, alignItems: 'flex-start' },
  emptyIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: COLORS.mint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900', marginTop: 10 },
  emptyBody: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  inlineAction: { flexDirection: 'row', alignItems: 'center', minHeight: 36, marginTop: 6 },
  inlineActionText: { color: COLORS.green, fontSize: 11, fontWeight: '900' },
  pageIntro: { marginBottom: 19 },
  pageTitle: { color: COLORS.text, fontSize: 27, fontWeight: '900' },
  pageSubtitle: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  noticeCard: { backgroundColor: COLORS.mint, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 15 },
  noticeText: { color: COLORS.deep, fontSize: 11, lineHeight: 17, flex: 1 },
  learnCard: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 17, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10, minHeight: 82 },
  learnIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  learnCopy: { flex: 1, marginHorizontal: 12 },
  learnTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900' },
  learnSub: { color: COLORS.muted, fontSize: 11, marginTop: 3 },
  learnStatus: { color: COLORS.green, fontSize: 9, fontWeight: '700', marginTop: 5 },
  topicIconLarge: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  guidanceCard: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 18, padding: 18 },
  guidanceLabel: { color: COLORS.green, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  guidanceBody: { color: COLORS.text, fontSize: 13, lineHeight: 20, marginTop: 8 },
  fullButton: { minHeight: 48, borderRadius: 14, backgroundColor: COLORS.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 15, marginTop: 18 },
  fullButtonText: { color: COLORS.white, fontSize: 13, fontWeight: '900' },
  wasteGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 4 },
  wasteCard: { width: '48.5%', backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 18, overflow: 'hidden', marginBottom: 12, minHeight: 195 },
  wasteArtwork: { height: 77, alignItems: 'center', justifyContent: 'center' },
  wasteTitle: { color: COLORS.text, fontSize: 12, fontWeight: '900', marginHorizontal: 12, marginTop: 10 },
  wasteSub: { color: COLORS.muted, fontSize: 10, lineHeight: 14, marginHorizontal: 12, marginTop: 4, flex: 1 },
  wasteFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 12, marginVertical: 9 },
  wasteFootText: { color: COLORS.green, fontSize: 10, fontWeight: '800' },
  errorText: { color: '#a12622', fontSize: 12, lineHeight: 18, marginVertical: 10 },
  backHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 23 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.mint, alignItems: 'center', justifyContent: 'center' },
  backTitle: { color: COLORS.deep, fontSize: 14, fontWeight: '800', marginLeft: 12 },
  calendarCard: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 19, padding: 12 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  monthButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  calendarMonth: { color: COLORS.text, fontSize: 15, fontWeight: '900' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.28%', textAlign: 'center', color: COLORS.muted, fontSize: 11, fontWeight: '800', paddingVertical: 8 },
  calendarCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  calendarCellSelected: { backgroundColor: COLORS.green },
  calendarDay: { color: COLORS.text, fontSize: 12 },
  calendarDaySelected: { color: COLORS.white, fontWeight: '900' },
  scheduleEntry: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  scheduleTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900' },
  profileHero: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 19, flexDirection: 'row', alignItems: 'center', padding: 16 },
  profileAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.mint, alignItems: 'center', justifyContent: 'center' },
  profileImage: { width: 54, height: 54, borderRadius: 27 },
  profileInitial: { color: COLORS.green, fontSize: 22, fontWeight: '900' },
  profileIdentity: { flex: 1, marginLeft: 12 },
  profileName: { color: COLORS.text, fontSize: 17, fontWeight: '900' },
  profileEmail: { color: COLORS.muted, fontSize: 11, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statCard: { flex: 1, minHeight: 106, borderRadius: 17, backgroundColor: COLORS.mint, padding: 13 },
  statValue: { color: COLORS.deep, fontSize: 22, fontWeight: '900', marginTop: 6 },
  statLabel: { color: COLORS.text, fontSize: 11, fontWeight: '800' },
  statNote: { color: COLORS.muted, fontSize: 9, marginTop: 2 },
  profileLinkCard: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 17, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 9, minHeight: 65 },
  barangayCard: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 18, padding: 16 },
  barangayHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barangayTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900' },
  barangayValue: { color: COLORS.text, fontSize: 15, fontWeight: '800', marginTop: 11 },
  barangayInput: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, minHeight: 46, marginTop: 13, paddingHorizontal: 12, color: COLORS.text },
  successText: { color: COLORS.green, fontSize: 11, marginTop: 8 },
  cancelText: { color: COLORS.muted, fontSize: 12, textAlign: 'center', padding: 12 },
  logoutButton: { marginTop: 21, borderWidth: 1, borderColor: '#eed8d4', borderRadius: 15, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  logoutText: { color: '#a73c30', fontSize: 13, fontWeight: '800' },
  savedIdeaRow: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 15, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  modalShade: { flex: 1, backgroundColor: '#07170baa', justifyContent: 'flex-end' },
  ideaModal: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '83%' },
  detailLabel: { color: COLORS.text, fontSize: 15, fontWeight: '900', marginTop: 17, marginBottom: 6 },
  detailText: { color: COLORS.text, fontSize: 12, lineHeight: 19, marginBottom: 5 },
  detailWarning: { color: '#895c1d', backgroundColor: COLORS.amber, borderRadius: 11, padding: 10, fontSize: 11, lineHeight: 17, marginTop: 14 },
  placeholderNote: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginVertical: 18 },
  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 73, backgroundColor: COLORS.white, borderTopColor: COLORS.line, borderTopWidth: 1, flexDirection: 'row', elevation: 12, zIndex: 20 },
  tab: { flex: 1, minHeight: 65, alignItems: 'center', justifyContent: 'center', paddingTop: 6 },
  tabLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '700', marginTop: 4 },
  tabLabelActive: { color: COLORS.green, fontWeight: '900' },
  cameraTab: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', marginTop: -21, borderWidth: 4, borderColor: COLORS.white, elevation: 5 },
});
