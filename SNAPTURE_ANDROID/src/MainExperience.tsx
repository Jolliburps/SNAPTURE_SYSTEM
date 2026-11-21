import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Modal,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Text from './PublicText';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import BookOpen from 'lucide-react-native/icons/book-open';
import Bookmark from 'lucide-react-native/icons/bookmark';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Camera from 'lucide-react-native/icons/camera';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import FolderOpen from 'lucide-react-native/icons/folder-open';
import House from 'lucide-react-native/icons/house';
import Info from 'lucide-react-native/icons/info';
import Leaf from 'lucide-react-native/icons/leaf';
import Lightbulb from 'lucide-react-native/icons/lightbulb';
import MapPin from 'lucide-react-native/icons/map-pin';
import Recycle from 'lucide-react-native/icons/recycle';
import Search from 'lucide-react-native/icons/search';
import Settings from 'lucide-react-native/icons/settings';
import ShieldAlert from 'lucide-react-native/icons/shield-alert';
import UserRound from 'lucide-react-native/icons/user-round';
import type { LucideIcon } from 'lucide-react-native';

import {
  getMaterials,
  getCollectionNotices,
  type CollectionEntry,
  getPredictionOverview,
  listProjects,
  listSavedPredictions,
  setProjectStep,
  restartProject,
  startProject,
  type ApiUser,
  type MaterialGuide,
  type PredictionSummary,
  type UserProject,
} from './api';
import { getLocalUpdates, type LocalUpdate } from './localUpdates';
import ProjectPanels from './ProjectPanels';
import SettingsPage from './SettingsPage';
import useProfileSettingsNavigation from './useProfileSettingsNavigation';
import useContentRefresh from './useContentRefresh';
import UpcyclingHub from './UpcyclingHub';
import IdeaDetails, { ideaStatus } from './IdeaDetails';
import TutorialPhoto from './TutorialPhoto';
import {photoFirstRecommendations} from './recommendationOrder';
import { useSuccessAlert } from './SuccessAlertDialog';
import BarangayPickerModal from './BarangayPickerModal';
import useBarangayEditor from './useBarangayEditor';
import { savedIdeas, type Idea } from './projectData';

export type MainRoute = 'home' | 'learn' | 'camera' | 'assessment' | 'waste' | 'profile' | 'calendar' | 'ideas' | 'projects' | 'projects-completed' | 'saved' | 'settings' | 'history';
type TabRoute = 'home' | 'learn' | 'camera' | 'waste' | 'profile';
type Navigate = (route: MainRoute) => void;

const WASTE_CATEGORY_ICONS: Record<string, number> = {
  pete_bottles: require('./assets/icons/pete-bottles.png'),
  hdpe_containers: require('./assets/icons/hdpe-containers.png'),
  cardboard: require('./assets/icons/cardboard.png'),
  paper: require('./assets/icons/paper.png'),
  fabric_scraps: require('./assets/icons/fabric-scraps.png'),
  coconut_shells: require('./assets/icons/coconut-shells.png'),
  dry_untreated_wood_scraps: require('./assets/icons/dry-wood-scraps.png'),
};
const SNAPTURE_CAMERA_LOGO = require('./assets/icons/camera-badge.png');
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

const TABS: Array<{ key: TabRoute; label: string; icon: LucideIcon }> = [
  { key: 'home', label: 'Home', icon: House },
  { key: 'learn', label: 'Ideas', icon: Lightbulb },
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
          ? <View style={styles.cameraTab}><Image source={SNAPTURE_CAMERA_LOGO} resizeMode="contain" style={styles.cameraTabLogo} /></View>
          : <Icon size={23} color={selected ? COLORS.green : COLORS.muted} strokeWidth={selected ? 2.5 : 1.9} />}
        {key !== 'camera' ? <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.8} style={[styles.tabLabel, selected && styles.tabLabelActive]}>{label}</Text> : null}
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
  const all=photoFirstRecommendations(guides.flatMap((guide) => [...(guide.photo_ideas || []),...guide.upcycling,...(guide.idea_references || []),...(guide.home_tutorials || [])].map((idea) => ({ ...idea, material: guide.short_title || guide.title, guideLabel: guide.label }))));
  return [...new Map(all.map(idea=>[`${idea.guideLabel}:${idea.id}`,idea])).values()];
}

function IdeaCard({ idea, onPress, compact = false }: { idea: Idea; onPress: () => void; compact?: boolean }) {
  return <Pressable style={[styles.ideaCard, compact && styles.ideaCardCompact]} onPress={onPress}>
    {idea.photos?.finished.url?<TutorialPhoto photo={idea.photos.finished} label={`${idea.title}: finished-product reference`} compact/>:<View style={styles.ideaArtwork}><Lightbulb size={31} color={COLORS.green} strokeWidth={1.7} /></View>}
    <View style={styles.ideaCopy}><Text style={styles.ideaMaterial}>{idea.material}</Text><Text style={styles.ideaTitle} numberOfLines={2}>{idea.title}</Text><Text style={styles.ideaSummary} numberOfLines={compact ? 2 : 3}>{idea.summary}</Text></View>
    <View style={styles.ideaFoot}><Text style={styles.ideaFootText}>{ideaStatus(idea)}</Text><ChevronRight size={17} color={COLORS.green} /></View>
  </Pressable>;
}

export function MainExperience({ screen, navigate: navigateRoute, user, onUserChange, onCategory, onLogout }: {
  screen: MainRoute;
  navigate: Navigate;
  user: ApiUser | null;
  onUserChange: (next: ApiUser) => void;
  onCategory: (label: string) => void;
  onLogout: () => void;
}) {
  const { revision: contentRevision } = useContentRefresh();
  const [guides, setGuides] = useState<MaterialGuide[]>([]);
  const [guidesLoading, setGuidesLoading] = useState(true);
  const [guidesError, setGuidesError] = useState('');
  const [scanCount, setScanCount] = useState(0);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState('');
  const [savedRecords, setSavedRecords] = useState<PredictionSummary[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState('');
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState('');
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [projectOrigin, setProjectOrigin] = useState<'home' | 'profile'>('profile');
  const {openProfileSettings,closeProfileSettings,backLabel}=useProfileSettingsNavigation(screen,navigateRoute);
  const navigate: Navigate = (route) => {
    if(route==='settings'){openProfileSettings();return;}
    if (route === 'projects' || route === 'projects-completed' || route === 'saved') {
      setProjectOrigin(screen === 'home' ? 'home' : 'profile');
    }
    navigateRoute(route);
  };
  const backgroundScreen = screen === 'projects' || screen === 'projects-completed' || screen === 'saved' ? projectOrigin : screen;

  const loadGuides = useCallback(() => {
    setGuidesLoading(true);
    setGuidesError('');
    getMaterials().then((response) => setGuides(response.materials)).catch((error) => setGuidesError(error instanceof Error ? error.message : 'Unable to load materials.')).finally(() => setGuidesLoading(false));
  }, []);
  const loadRecords = useCallback(() => {
    setRecordsLoading(true);
    setRecordsError('');
    getPredictionOverview().then((response) => { setScanCount(response.total_count); }).catch((error) => setRecordsError(error instanceof Error ? error.message : 'Unable to load scans.')).finally(() => setRecordsLoading(false));
  }, []);
  const loadSaved = useCallback(() => {
    setSavedLoading(true); setSavedError('');
    listSavedPredictions().then(setSavedRecords).catch((error) => setSavedError(error instanceof Error ? error.message : 'Unable to load saved ideas.')).finally(() => setSavedLoading(false));
  }, []);
  const loadProjects = useCallback(() => {
    setProjectsLoading(true); setProjectsError('');
    listProjects().then(setProjects).catch((error) => setProjectsError(error instanceof Error ? error.message : 'Unable to load projects.')).finally(() => setProjectsLoading(false));
  }, []);
  useEffect(() => { loadGuides(); loadRecords(); loadSaved(); loadProjects(); }, [loadGuides, loadRecords, loadSaved, loadProjects]);
  useEffect(() => {
    if (contentRevision > 0) { loadGuides(); loadRecords(); loadSaved(); loadProjects(); }
  }, [contentRevision, loadGuides, loadRecords, loadSaved, loadProjects]);
  useEffect(() => {
    if (screen === 'waste' || screen === 'ideas' || screen === 'learn') loadGuides();
  }, [screen, loadGuides]);
  const ideas = useMemo(() => flattenIdeas(guides), [guides]);
  const saved = useMemo(() => savedIdeas(savedRecords, ideas), [savedRecords, ideas]);
  const tab: TabRoute = ['learn','ideas'].includes(backgroundScreen) ? 'learn' : backgroundScreen === 'waste' ? 'waste' : ['profile', 'settings', 'history'].includes(backgroundScreen) ? 'profile' : 'home';
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
  const restartSavedProject = async (projectId: number) => {
    const { project } = await restartProject(projectId);
    setProjects(current => current.map(item => item.id === project.id ? project : item));
    return project;
  };

  return <View style={styles.appPage}>
    {backgroundScreen === 'home' ? <HomePage user={user} projects={projects} projectsLoading={projectsLoading} projectsError={projectsError} savedCount={saved.length} savedLoading={savedLoading} savedError={savedError} scanCount={scanCount} recordsLoading={recordsLoading} recordsError={recordsError} navigate={navigate}/> : null}
    {screen === 'learn' ? <IdeasPage ideas={ideas} loading={guidesLoading} error={guidesError} retry={loadGuides} navigate={navigate} onOpen={setSelectedIdea}/> : null}
    {screen === 'waste' ? <WastePage guides={guides} loading={guidesLoading} error={guidesError} retry={loadGuides} onCategory={onCategory} /> : null}
    {backgroundScreen === 'profile' ? <ProfilePage user={user} scanCount={scanCount} recordsLoading={recordsLoading} recordsError={recordsError} savedCount={saved.length} savedLoading={savedLoading} savedError={savedError} projects={projects} projectsLoading={projectsLoading} projectsError={projectsError} navigate={navigate} onOpenSettings={openProfileSettings} onUserChange={onUserChange} /> : null}
    {screen === 'calendar' ? <CalendarPage user={user} navigate={navigate} /> : null}
    {screen === 'ideas' ? <IdeasPage ideas={ideas} loading={guidesLoading} error={guidesError} retry={loadGuides} navigate={navigate} onOpen={setSelectedIdea} /> : null}
    {screen === 'settings' ? <SettingsPage user={user} onUserChange={onUserChange} onBack={closeProfileSettings} backLabel={backLabel} onLogout={onLogout} /> : null}
    <BottomNavigation active={tab} navigate={navigate} />
    {screen === 'projects' || screen === 'projects-completed' || screen === 'saved' ? <ProjectPanels section={screen==='saved'?'saved':'projects'} initialFilter={screen==='projects-completed'?'completed':'all'} projects={projects} projectsLoading={projectsLoading} projectsError={projectsError} saved={saved} savedLoading={savedLoading} savedError={savedError} onClose={() => navigate(projectOrigin)} onStart={startSavedProject} onStep={updateStep} onRestart={restartSavedProject} onProjectChange={(updated,replacedId)=>setProjects(current=>[updated,...current.filter(project=>project.id!==replacedId && project.id!==updated.id)])} onShowProjects={() => navigate('projects-completed')} /> : null}
    <Modal visible={selectedIdea !== null} animationType="slide" transparent onRequestClose={() => setSelectedIdea(null)}>
      <View style={styles.modalShade}><View style={styles.ideaModal}><BackHeader title="Project idea" onBack={() => setSelectedIdea(null)} />{selectedIdea ? <ScrollView showsVerticalScrollIndicator={false}><IdeaDetails idea={selectedIdea}/></ScrollView> : null}</View></View>
    </Modal>
  </View>;
}

function LocalUpdates({ updates, loading, error, onRefresh }: { updates: LocalUpdate[]; loading: boolean; error: string; onRefresh:()=>void }) {
  return <><SectionHeading title="Local updates" /><Pressable accessibilityRole="button" onPress={onRefresh} style={{alignSelf:'flex-start',paddingVertical:8,marginBottom:8}}><Text style={styles.miniLinkText}>Refresh local updates</Text></Pressable>{error ? <Text style={styles.errorText}>{error}</Text> : null}
    {updates.length ? updates.map((update) => <View key={update.id} style={styles.updateCard}><View style={styles.cardIconAmber}><Info size={20} color={COLORS.green} /></View><View style={styles.updateCopy}><Text style={styles.updateCategory}>{update.category} · {new Date(update.publishedAt).toLocaleDateString()}</Text><Text style={styles.updateTitle}>{update.title}</Text><Text style={styles.mutedSmall}>{update.description}</Text></View></View>)
      : <EmptyCard icon={Info} title={loading ? 'Loading local updates…' : error ? 'Local updates unavailable' : 'No new local updates'} body="Verified announcements from the SNAPTURE administrator will appear here when available." />}</>;
}

function HomeLocalUpdates() {
  const { revision, refresh } = useContentRefresh();
  const [updates, setUpdates] = useState<LocalUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true); setError(''); setUpdates([]);
    getLocalUpdates().then((items) => { if (mounted) setUpdates(items); })
      .catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : 'Unable to load local updates.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [revision]);

  return <LocalUpdates updates={updates} loading={loading} error={error} onRefresh={refresh}/>;
}

function HomePage({ user, projects, projectsLoading, projectsError, savedCount, savedLoading, savedError, scanCount, recordsLoading, recordsError, navigate }: {
  user:ApiUser|null;projects:UserProject[];projectsLoading:boolean;projectsError:string;savedCount:number;savedLoading:boolean;savedError:string;scanCount:number;recordsLoading:boolean;recordsError:string;navigate:Navigate;
}) {
  const firstName=user?.display_name && user.display_name!==user.email?user.display_name.trim().split(/\s+/)[0]:'';
  const ongoingCount=projects.filter(p=>p.status==='active').length;
  const completedCount=projects.filter(p=>p.status==='completed').length;
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
    <BrandHeader subtitle="Scan today. A cleaner tomorrow." right={<Pressable style={styles.avatar} onPress={()=>navigate('profile')} accessibilityLabel="Open profile"><Text style={styles.avatarLetter}>{firstName?firstName[0].toUpperCase():'S'}</Text></Pressable>}/>
    <Text style={styles.greeting}>Good day{firstName?`, ${firstName}`:''}</Text>
    <Text style={styles.heroTitle}>Small actions, a cleaner community.</Text>
    <Text style={styles.heroSub}>Discover what to do with one item at a time.</Text>
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
      <View style={styles.recentCopy}><Text style={styles.recentTitle}>My scans</Text><Text style={styles.mutedSmall}>{recordsLoading ? 'Loading scans…' : recordsError ? 'Scans unavailable' : scanCount ? 'Saved photos and item results' : 'No scans yet'}</Text></View>
      <ChevronRight size={18} color={COLORS.green} />
    </Pressable>
    <HomeLocalUpdates/>
  </ScrollView>;
}

function WastePage({ guides, loading, error, retry, onCategory }: { guides: MaterialGuide[]; loading: boolean; error: string; retry: () => void; onCategory: (label: string) => void }) {
  const visible = guides;
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"><BrandHeader /><PageIntro title="Waste materials" subtitle="Explore materials currently supported by SNAPTURE." /><Pressable accessibilityRole="button" onPress={retry}><Text style={styles.miniLinkText}>Refresh materials</Text></Pressable>{error ? <Text style={styles.errorText}>{error}</Text> : null}{loading && !guides.length ? <EmptyCard icon={Recycle} title="Loading materials…" body="Fetching the supported material guide." /> : null}{!loading && !guides.length ? <EmptyCard icon={Recycle} title="Materials unavailable" body="Connect to the backend to load the current supported categories." action="Try again" onAction={retry} /> : null}<View style={styles.wasteGrid}>{visible.map((guide, index) => { const categoryIcon = WASTE_CATEGORY_ICONS[guide.label]; return <Pressable key={guide.label} style={styles.wasteCard} onPress={() => onCategory(guide.label)}><View style={[styles.wasteArtwork, { backgroundColor: ['#e8f4ec', '#e8f3fa', '#fff3e5', '#f1ecfa'][index % 4] }]}>{categoryIcon ? <Image source={categoryIcon} resizeMode="contain" style={styles.wasteArtworkImage} /> : <Recycle size={29} color={COLORS.green} strokeWidth={1.7} />}</View><Text style={styles.wasteTitle}>{guide.short_title || guide.title}</Text><Text style={styles.wasteSub} numberOfLines={2}>{guide.description}</Text><View style={styles.wasteFoot}><Text style={styles.wasteFootText}>Open guide</Text><ChevronRight size={16} color={COLORS.green} /></View></Pressable>; })}</View>{guides.length > 0 && visible.length === 0 ? <EmptyCard icon={Search} title="No match found" body="Try another supported material name." /> : null}</ScrollView>;
}

function CalendarPage({ user, navigate }: { user: ApiUser | null; navigate: Navigate }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const { revision, refresh } = useContentRefresh();
  const [notices, setNotices] = useState<CollectionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [noticeError, setNoticeError] = useState('');
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  useEffect(() => {
    let active = true;
    setNotices([]); setNoticeError(''); setLoading(true);
    getCollectionNotices(monthKey).then(result => { if (active) setNotices(result.entries); }).catch(reason => { if (active) setNoticeError(reason instanceof Error ? reason.message : 'Collection information unavailable.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [monthKey, user?.barangay, revision]);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: firstWeekday + days }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const entries = notices.filter((entry) => entry.date === dateKey);
  const changeMonth = (offset: number) => { setMonth(new Date(year, monthIndex + offset, 1)); setSelectedDay(1); };
  if (noticeError) return <ScrollView contentContainerStyle={styles.scrollContent}><BackHeader title="Collection schedule" onBack={() => navigate('home')} /><EmptyCard icon={CalendarDays} title="Collection service unavailable" body={noticeError} action="Retry schedule" onAction={refresh} /></ScrollView>;
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}><BackHeader title="Collection schedule" onBack={() => navigate('home')} /><PageIntro title="Barangay calendar" subtitle="Collection schedules published for your selected barangay." /><View style={styles.noticeCard}><MapPin size={19} color={COLORS.green} /><Text style={styles.noticeText}>{user?.barangay ? `Selected barangay: ${user.barangay}` : 'No barangay selected yet. Set one in Profile.'}</Text></View><Pressable accessibilityRole="button" onPress={refresh}><Text style={styles.miniLinkText}>Refresh schedules</Text></Pressable><View style={styles.calendarCard}><View style={styles.calendarHeader}><Pressable onPress={() => changeMonth(-1)} accessibilityLabel="Previous month" style={styles.monthButton}><ChevronLeft size={22} color={COLORS.green} /></Pressable><Text style={styles.calendarMonth}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text><Pressable onPress={() => changeMonth(1)} accessibilityLabel="Next month" style={styles.monthButton}><ChevronRight size={22} color={COLORS.green} /></Pressable></View><View style={styles.calendarGrid}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => <Text key={`${label}-${index}`} style={styles.weekday}>{label}</Text>)}{cells.map((day, index) => <Pressable key={index} disabled={!day} onPress={() => day && setSelectedDay(day)} style={[styles.calendarCell, day === selectedDay && styles.calendarCellSelected]}><Text style={[styles.calendarDay, day === selectedDay && styles.calendarDaySelected]}>{day || ''}</Text></Pressable>)}</View></View><SectionHeading title={new Date(year, monthIndex, selectedDay).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} />{entries.length ? entries.map((entry) => <View key={entry.id || `${entry.date}-${entry.title}-${entry.description}`} style={styles.scheduleEntry}><Text style={styles.scheduleTitle}>{entry.title}</Text><Text style={styles.mutedSmall}>{entry.barangay} · {entry.status}</Text>{entry.description ? <Text style={styles.emptyBody}>{entry.description}</Text> : null}</View>) : <EmptyCard icon={CalendarDays} title={loading ? 'Loading schedules...' : 'No published schedule available'} body={user?.barangay ? 'No schedule for this date. Try another date or refresh.' : 'Select your barangay in Profile to see collection schedules.'} />}</ScrollView>;
}

function IdeasPage({ ideas, loading, error, retry, navigate, onOpen }: { ideas: Idea[]; loading: boolean; error: string; retry: () => void; navigate: Navigate; onOpen: (idea: Idea) => void }) {
  const [filter,setFilter]=useState('all');
  const [query,setQuery]=useState('');
  const materials=[...new Map(ideas.map(idea=>[idea.guideLabel,idea.material])).entries()];
  const visible=ideas.filter(idea=>(filter==='all'||idea.guideLabel===filter) && `${idea.title} ${idea.material} ${idea.summary}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
    <BrandHeader/>
    <PageIntro title="Upcycling Ideas" subtitle="Explore all upcycling ideas by material. Check your item before starting."/>
    <SearchField value={query} onChange={setQuery} placeholder="Search projects or materials"/>
    {error?<Text style={styles.errorText}>{error}</Text>:null}
    <View style={styles.ideaFilters}>{[['all','All materials'],...materials].map(([key,title])=><Pressable key={key} accessibilityRole="button" accessibilityLabel={`Filter ideas: ${title}`} accessibilityState={{selected:filter===key}} onPress={()=>setFilter(key)} style={[styles.ideaFilter,filter===key && styles.ideaFilterSelected]}><Text style={styles.ideaFilterText}>{title}</Text></Pressable>)}</View>
    <Pressable accessibilityRole="button" onPress={retry} style={{alignSelf:'flex-start',minHeight:44,justifyContent:'center',marginBottom:8}}><Text style={styles.miniLinkText}>Refresh ideas</Text></Pressable>
    {visible.map(idea=><IdeaCard key={`${idea.guideLabel}-${idea.id}`} idea={idea} onPress={()=>onOpen(idea)}/>)}
    {!visible.length?<EmptyCard icon={Lightbulb} title={loading?'Loading ideas…':'No published ideas available'} body="Ideas and their review status appear when the material library is available." action={!loading?'Try again':undefined} onAction={retry}/>:null}
  </ScrollView>;
}

function ProfilePage({ user, scanCount, recordsLoading, recordsError, savedCount, savedLoading, savedError, projects, projectsLoading, projectsError, navigate, onOpenSettings, onUserChange }: { user: ApiUser | null; scanCount: number; recordsLoading: boolean; recordsError: string; savedCount: number; savedLoading: boolean; savedError: string; projects: UserProject[]; projectsLoading: boolean; projectsError: string; navigate: Navigate; onOpenSettings:()=>void; onUserChange: (user: ApiUser) => void }) {
  const { showSuccess, successDialog } = useSuccessAlert();
  const barangay = useBarangayEditor(user, onUserChange, showSuccess);
  const completedCount = projects.filter((project) => project.status === 'completed').length;
  const unfinishedCount = projects.filter(project=>project.status==='active').length;
  return <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <BrandHeader right={<Pressable onPress={onOpenSettings} accessibilityRole="button" accessibilityLabel="Open settings" hitSlop={12}><Settings size={22} color={COLORS.deep} /></Pressable>} />
    <PageIntro title="My profile" subtitle="Your activity and account settings." />
    <UpcyclingHub/>
    <View style={styles.profileHero}>
      <View style={styles.profileAvatar}>
        {user?.profile_picture_url ? <Image source={{ uri: user.profile_picture_url }} style={styles.profileImage} /> : <Text style={styles.profileInitial}>{(user?.display_name || user?.email || 'S').charAt(0).toUpperCase()}</Text>}
      </View>
      <View style={styles.profileIdentity}>
        <Text style={styles.profileName}>{user?.display_name && user.display_name !== user.email ? user.display_name : 'SNAPTURE user'}</Text>
        <Text style={styles.profileEmail}>{user?.email || 'Email unavailable'}</Text>
      </View>
    </View>
    <View style={styles.statsRow}>
      <View style={styles.statCard}><Camera size={20} color={COLORS.green} /><Text style={styles.statValue}>{recordsError ? '—' : recordsLoading ? '…' : scanCount}</Text><Text style={styles.statLabel}>Items scanned</Text></View>
    </View>
    <View style={styles.statsRow}>
      <View style={styles.statCard}><ClipboardList size={20} color={COLORS.green}/><Text style={styles.statValue}>{projectsError ? '?' : projectsLoading ? '?' : unfinishedCount}</Text><Text style={styles.statLabel}>Unfinished projects</Text></View>
      <View style={styles.statCard}><FolderOpen size={20} color={COLORS.green} /><Text style={styles.statValue}>{projectsError ? '—' : projectsLoading ? '…' : completedCount}</Text><Text style={styles.statLabel}>Projects completed</Text></View>
    </View>
    {recordsError ? <Text style={styles.errorText}>{recordsError}</Text> : null}
    {projectsError ? <Text style={styles.errorText}>{projectsError}</Text> : null}
    <SectionHeading title="Barangay Residence" />
    <View style={styles.barangayCard}>
      <View style={styles.barangayHead}><MapPin size={20} color={COLORS.green} /><Text style={styles.barangayTitle}>Barangay</Text></View>
      {barangay.editing ? <>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose barangay" disabled={barangay.saving} onPress={barangay.open} style={styles.barangaySelector}><Text style={styles.barangayValue}>{barangay.draft || 'Choose barangay'}</Text><ChevronRight size={17} color={COLORS.green} /></Pressable>
        <Text style={styles.mutedSmall}>Only your barangay is needed. Do not enter a street address.</Text>
        {barangay.error ? <Text style={styles.errorText}>{barangay.error}</Text> : null}
        <Pressable style={styles.fullButton} onPress={barangay.save} disabled={!barangay.canSave}><Text style={styles.fullButtonText}>{barangay.saving ? 'Saving…' : 'Save barangay'}</Text></Pressable>
        <Pressable disabled={barangay.saving} onPress={barangay.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
      </> : <>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose barangay" disabled={!user} onPress={barangay.open}><Text style={styles.barangayValue}>{barangay.saved || 'Not set'}</Text></Pressable>
        <Text style={styles.mutedSmall}>Your barangay of residence. Used for relevant local updates and published schedules.</Text>
        <Pressable disabled={!user} onPress={barangay.open} style={styles.inlineAction}><Text style={styles.inlineActionText}>{user?.barangay ? 'Change barangay' : 'Set barangay'}</Text><ChevronRight size={15} color={COLORS.green} /></Pressable>
      </>}
    </View>
    <BarangayPickerModal visible={barangay.pickerOpen} selected={barangay.draft} onSelect={barangay.select} onClose={barangay.closePicker} />
    {successDialog}
  </ScrollView>;
}

const styles = StyleSheet.create({
  ideaFilters:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:14},ideaFilter:{minHeight:38,paddingHorizontal:10,paddingVertical:8,borderWidth:1,borderColor:COLORS.line,borderRadius:20,justifyContent:'center'},ideaFilterSelected:{backgroundColor:COLORS.mint,borderColor:COLORS.green},ideaFilterText:{fontSize:12,lineHeight:18,color:COLORS.green,fontWeight:'700'},
  appPage: { flex: 1, backgroundColor: COLORS.pale },
  barangaySelector: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, minHeight: 45, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
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
  wasteArtworkImage: { width: 58, height: 58 },
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
  profileIdentity: { flex: 1, minWidth:0, marginLeft: 14 },
  profileName: { color: COLORS.text, fontSize: 19,lineHeight:27, fontWeight: '800' },
  profileEmail: { color: COLORS.muted, fontSize: 14,lineHeight:21, marginTop: 5,flexShrink:1 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statCard: { flex: 1, minHeight: 106, borderRadius: 17, backgroundColor: COLORS.mint, padding: 13 },
  statValue: { color: COLORS.deep, fontSize: 22, fontWeight: '900', marginTop: 6 },
  statLabel: { color: COLORS.text, fontSize: 13,lineHeight:19, fontWeight: '700' },
  statNote: { color: COLORS.muted, fontSize: 12,lineHeight:18, marginTop: 4 },
  profileLinkCard: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 17, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 9, minHeight: 65 },
  barangayCard: { backgroundColor: COLORS.white, borderColor: COLORS.line, borderWidth: 1, borderRadius: 18, padding: 16 },
  barangayHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barangayTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900' },
  barangayValue: { color: COLORS.text, fontSize: 15, fontWeight: '800', marginTop: 11 },
  barangayInput: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, minHeight: 46, marginTop: 13, paddingHorizontal: 12, color: COLORS.text },
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
  tabLabel: { color: COLORS.muted, fontSize: 10, textAlign:'center', fontWeight: '700', marginTop: 4 },
  tabLabelActive: { color: COLORS.green, fontWeight: '900' },
  cameraTab: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', marginTop: -27, elevation: 5 },
  cameraTabLogo: { width: 70, height: 70 },
});
