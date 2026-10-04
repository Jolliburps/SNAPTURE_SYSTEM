import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Camera, type CameraRef, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';

import { confirmPasswordReset, createPrediction, deleteAllPredictions, deletePrediction, getAdminOverview, getAdminPredictionDetail, getCurrentUser, getMaterials, listPredictions, loginUser, logoutUser, registerUser, requestPasswordReset, selectRecommendation, updatePrediction, type AdminOverview, type AdminPredictionDetail, type ApiUser, type MaterialGuide, type Prediction, type PredictionSummary } from './src/api';

type Screen =
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'admin-login'
  | 'admin-dashboard'
  | 'home'
  | 'materials'
  | 'material-detail'
  | 'camera'
  | 'quality'
  | 'result'
  | 'questions'
  | 'safety'
  | 'recommendations'
  | 'history'
  | 'more';

type Category = { name: string; icon: string; glyph: string; color: string };

/* Legacy icon set removed from the active UI.
// Legacy icon set kept only for the old visual prototype below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CATEGORIES: Category[] = [
  { name: 'PETE bottles', icon: '♧', color: '#dff3e5' },
  { name: 'HDPE containers', icon: '♧', color: '#e6f4df' },
  { name: 'Cardboard', icon: '□', color: '#fff2d1' },
  { name: 'Paper', icon: '▤', color: '#e5f1f7' },
  { name: 'Fabric scraps', icon: '◇', color: '#f4e7f5' },
  { name: 'Coconut shells', icon: '◒', color: '#f4eadc' },
  { name: 'Dry wood scraps', icon: '▰', color: '#f3e4d3' },
];

*/

const DISPLAY_CATEGORIES: Category[] = [
  { name: 'PETE bottles', icon: 'P', glyph: 'bottle', color: '#dff3e5' },
  { name: 'HDPE containers', icon: 'H', glyph: 'container', color: '#e6f4df' },
  { name: 'Cardboard', icon: 'C', glyph: 'box', color: '#fff2d1' },
  { name: 'Paper', icon: 'P', glyph: 'paper', color: '#e5f1f7' },
  { name: 'Fabric scraps', icon: 'F', glyph: 'shirt', color: '#f4e7f5' },
  { name: 'Coconut shells', icon: 'Co', glyph: 'coconut', color: '#f4eadc' },
  { name: 'Dry wood scraps', icon: 'W', glyph: 'wood', color: '#f1b1b1' },
];

const CATEGORY_LABELS: Record<string, string> = {
  'PETE bottles': 'pete_bottles',
  'HDPE containers': 'hdpe_containers',
  'Cardboard': 'cardboard',
  'Paper': 'paper',
  'Fabric scraps': 'fabric_scraps',
  'Coconut shells': 'coconut_shells',
  'Dry wood scraps': 'dry_untreated_wood_scraps',
};

const CATEGORY_ASSETS: Record<string, number> = {
  bottle: require('./src/assets/icons/pete-bottles.png'),
  container: require('./src/assets/icons/hdpe-containers.png'),
  box: require('./src/assets/icons/cardboard.png'),
  paper: require('./src/assets/icons/paper.png'),
  shirt: require('./src/assets/icons/fabric-scraps.png'),
  coconut: require('./src/assets/icons/coconut-shells.png'),
  wood: require('./src/assets/icons/dry-wood-scraps.png'),
};

const CAMERA_BADGE = require('./src/assets/icons/camera-badge.png');

function CategoryGlyph({ kind, size = 34 }: { kind?: string; size?: number }) {
  const source = CATEGORY_ASSETS[kind || ''];
  return source ? <Image source={source} resizeMode="contain" style={{ width: size, height: size }} /> : null;
}

// The app follows the same strict scope as the backend.  A raw model label
// such as glass, plastic, metal, or trash is never a user-facing
// identification; it is shown as an unidentified/unsupported object instead.
const SUPPORTED_DECISIONS = new Set(Object.values(CATEGORY_LABELS));

function isSupportedPrediction(prediction: Prediction | null): boolean {
  return Boolean(
    prediction
      && SUPPORTED_DECISIONS.has(prediction.decision)
      && !prediction.needs_verification
      && prediction.confidence >= prediction.threshold,
  );
}

function displayPredictionTitle(prediction: Prediction | null): string {
  return isSupportedPrediction(prediction)
    ? prediction?.title || 'Supported material'
    : 'Unidentified or unsupported object';
}

/* Legacy hard-coded recommendations replaced by the backend material catalog.
const RECOMMENDATIONS = [
  { title: 'Self-watering planter', description: 'Use several clean bottles to create a simple vertical garden.', materials: 'Clean bottles · scissors · soil · small plants', icon: '♧' },
  { title: 'Desk organizer', description: 'Cut and decorate the containers for pens, tools, or art supplies.', materials: 'Clean containers · cutter · fabric or paint', icon: '▥' },
  { title: 'Seed starter set', description: 'Turn multiple containers into labeled starters for herbs and seedlings.', materials: 'Containers · soil · seeds · labels', icon: '✿' },
];

*/

const COLORS = {
  primary: '#1b5e20', secondary: '#43a047', background: '#f7f9f5', surface: '#ffffff',
  text: '#263238', muted: '#6b7b72', border: '#d9e5dc',
};

type FollowUpPrompt = {
  title: string;
  description: string;
  options: string[];
  kind: 'verification' | 'wood_safety';
};

function followUpPromptFor(prediction: Prediction | null): FollowUpPrompt | null {
  if (!prediction) return null;
  // Follow-up questions are only useful for supported materials. An
  // unidentified or low-confidence result should return the user to the
  // camera instead of leading to an empty recommendation page.
  if (!isSupportedPrediction(prediction)) return null;
  const modelClass = (prediction.raw_model_class || prediction.model_class).toLowerCase();
  const needsVerification = Boolean(
    prediction.needs_verification
      || prediction.decision === 'unknown_unsupported'
      || ['plastic', 'metal'].includes(modelClass)
      || prediction.confidence < prediction.threshold,
  );

  if (needsVerification) {
    const genericPlastic = ['plastic', 'metal'].includes(modelClass);
    return {
      title: 'One quick confirmation',
      description: genericPlastic
        ? 'The photo looks like a general plastic item. If you can see a recycling code, choose it below. You can also skip this if you are unsure.'
        : 'The model is not certain enough to assign a supported material. Confirm only if the material is obvious to you.',
      /*
      options: genericPlastic
        ? ['PET/PETE · code 1', 'HDPE · code 2', 'Not sure'],
      */
      options: genericPlastic
        ? ['PET/PETE code 1', 'HDPE code 2', 'Not sure']
        : ['I can confirm the material', 'Not sure'],
      kind: 'verification',
    };
  }

  if (prediction.decision === 'dry_untreated_wood_scraps') {
    return {
      title: 'One safety check',
      description: 'Wood projects depend on the surface being safe to handle. Which statement best matches the pieces?',
      options: ['No visible hazards', 'Paint, treatment, nails, or mold', 'Not sure'],
      kind: 'wood_safety',
    };
  }

  return null;
}

function App() {
  // Open directly on the sign-in screen so users do not have to pass through
  // a separate introductory page.
  const [screen, setScreen] = useState<Screen>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminIdentifier, setAdminIdentifier] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  // Keep the fast path useful without asking the user for a number. They can
  // optionally change this on the recommendations screen for a larger batch.
  const [quantity, setQuantity] = useState('1');
  const [condition, setCondition] = useState('Clean and dry');
  const [previousContents, setPreviousContents] = useState('Other / unknown');
  const [availableMaterials, setAvailableMaterials] = useState('');
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState('');
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const navigate = (next: Screen) => setScreen(next);
  const openCategory = (label: string) => {
    setSelectedCategory(label);
    setScreen('material-detail');
  };

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) {
        setCurrentUser(user);
        setScreen(user.role === 'admin' ? 'admin-dashboard' : 'home');
      }
    }).catch(() => undefined);
  }, []);

  const submitAuth = async (mode: 'login' | 'register') => {
    if (mode === 'login' && email.trim().toLowerCase() === 'admin') {
      setAdminIdentifier('admin');
      setAdminPassword('');
      setAuthError('');
      setAdminError('');
      setScreen('admin-login');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setAuthError('Passwords do not match. Please enter the same password twice.');
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    try {
      const payload = mode === 'login'
        ? await loginUser(email.trim(), password)
        : await registerUser(email.trim(), password);
      setCurrentUser(payload.user);
      setScreen('home');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to complete authentication.');
    } finally {
      setAuthBusy(false);
    }
  };

  const submitAdminAuth = async () => {
    setAdminBusy(true);
    setAdminError('');
    try {
      const payload = await loginUser(adminIdentifier.trim(), adminPassword);
      if (payload.user.role !== 'admin') {
        await logoutUser();
        throw new Error('This account does not have administrator access.');
      }
      setCurrentUser(payload.user);
      setScreen('admin-dashboard');
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Unable to sign in as administrator.');
    } finally {
      setAdminBusy(false);
    }
  };

  const signOut = async () => {
    await logoutUser();
    setCurrentUser(null);
    setPrediction(null);
    setCapturedUri(null);
    setFollowUpAnswer('');
    setQuantity('1');
    setScreen('login');
  };

  const analyzeCapturedPhoto = async () => {
    if (!capturedUri) {
      setAnalysisError('Capture a photo before analyzing.');
      return false;
    }
    setAnalysisBusy(true);
    setAnalysisError('');
    console.log('[SNAPTURE] analyze:start');
    try {
      const response = await createPrediction(capturedUri);
      setPrediction(response.prediction);
      setSelectedRecommendation('');
      setFollowUpAnswer('');
      console.log('[SNAPTURE] analyze:success', {
        predictionId: response.prediction.id,
        modelClass: response.prediction.model_class,
        decision: response.prediction.decision,
        confidence: response.prediction.confidence,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to analyze this photo.';
      console.error('[SNAPTURE] analyze:error', message);
      setAnalysisError(message);
      return false;
    } finally {
      setAnalysisBusy(false);
    }
  };

  const saveQuestionnaire = async () => {
    if (!prediction) {
      setAnalysisError('Analyze the image before answering the questions.');
      return false;
    }
    setAnalysisBusy(true);
    setAnalysisError('');
    try {
      const followUp = followUpPromptFor(prediction);
      const effectiveCondition = followUp?.kind === 'wood_safety' && followUpAnswer
        ? followUpAnswer
        : condition;
      const response = await updatePrediction(prediction.id, {
        quantity: quantity || '1',
        condition: effectiveCondition,
        previous_contents: previousContents,
        available_materials: availableMaterials,
        answers: {
          quantity: quantity || '1',
          condition: effectiveCondition,
          previous_contents: previousContents,
          available_materials: availableMaterials,
          follow_up: followUpAnswer || null,
        },
      });
      setPrediction(response.prediction);
      return true;
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Unable to save the item details.');
      return false;
    } finally {
      setAnalysisBusy(false);
    }
  };

  const startAnotherScan = () => {
    setPrediction(null);
    setCapturedUri(null);
    setFollowUpAnswer('');
    setSelectedRecommendation('');
    setAnalysisError('');
    navigate('camera');
  };

  const continueFromResult = async () => {
    if (!prediction) return;
    if (!isSupportedPrediction(prediction)) {
      startAnotherScan();
      return;
    }
    if (followUpPromptFor(prediction)) {
      setFollowUpAnswer('');
      navigate('questions');
      return;
    }
    if (await saveQuestionnaire()) navigate('recommendations');
  };

  const saveRecommendation = async () => {
    if (!prediction || !selectedRecommendation) return false;
    if (!(await saveQuestionnaire())) return false;
    setAnalysisBusy(true);
    setAnalysisError('');
    try {
      const response = await selectRecommendation(prediction.id, selectedRecommendation);
      setPrediction(response.prediction);
      return true;
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Unable to save your selected project.');
      return false;
    } finally {
      setAnalysisBusy(false);
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        {screen === 'login' && <AuthScreen mode="login" email={email} password={password} confirmPassword={confirmPassword} setEmail={setEmail} setPassword={setPassword} setConfirmPassword={setConfirmPassword} onSubmit={() => submitAuth('login')} onSwitch={() => { setAuthError(''); setConfirmPassword(''); navigate('register'); }} onForgot={() => { setAuthError(''); navigate('forgot-password'); }} onBack={() => navigate('login')} error={authError} busy={authBusy} />}
        {screen === 'register' && <AuthScreen mode="register" email={email} password={password} confirmPassword={confirmPassword} setEmail={setEmail} setPassword={setPassword} setConfirmPassword={setConfirmPassword} onSubmit={() => submitAuth('register')} onSwitch={() => { setAuthError(''); setConfirmPassword(''); navigate('login'); }} onForgot={() => { setAuthError(''); navigate('forgot-password'); }} onBack={() => navigate('login')} error={authError} busy={authBusy} />}
        {screen === 'forgot-password' && <ForgotPasswordScreen email={email} setEmail={setEmail} onBack={() => navigate('login')} />}
        {screen === 'admin-login' && <AdminLoginScreen identifier={adminIdentifier} password={adminPassword} setIdentifier={setAdminIdentifier} setPassword={setAdminPassword} onSubmit={submitAdminAuth} onBack={() => navigate('login')} error={adminError} busy={adminBusy} />}
        {screen === 'admin-dashboard' && <AdminDashboardScreen user={currentUser} onLogout={signOut} />}
        {['home', 'materials', 'history', 'more'].includes(screen) && <MainShell screen={screen} navigate={navigate} user={currentUser} onLogout={signOut} onCategory={openCategory} />}
        {screen === 'material-detail' && selectedCategory && <MaterialDetailScreen label={selectedCategory} navigate={navigate} onBack={() => navigate('materials')} />}
        {screen === 'camera' && <NativeCameraScreen onBack={() => navigate('home')} onCaptured={(uri) => { setCapturedUri(uri); setPrediction(null); setQuantity('1'); setCondition('Clean and dry'); setPreviousContents('Other / unknown'); setAvailableMaterials(''); setFollowUpAnswer(''); setAnalysisError(''); navigate('quality'); }} />}
        {screen === 'quality' && <LiveQualityScreen photoUri={capturedUri} error={analysisError} analyzing={analysisBusy} onBack={() => navigate('camera')} onContinue={async () => { if (await analyzeCapturedPhoto()) navigate('result'); }} />}
        {screen === 'result' && <LiveResultScreen photoUri={capturedUri} prediction={prediction} error={analysisError} onBack={() => navigate('quality')} onContinue={continueFromResult} />}
        {screen === 'questions' && <LiveQuestionsScreen quantity={quantity} setQuantity={setQuantity} condition={condition} setCondition={setCondition} previousContents={previousContents} setPreviousContents={setPreviousContents} availableMaterials={availableMaterials} setAvailableMaterials={setAvailableMaterials} prompt={followUpPromptFor(prediction)} answer={followUpAnswer} setAnswer={setFollowUpAnswer} error={analysisError} busy={analysisBusy} onBack={() => navigate('result')} onContinue={async () => { if (await saveQuestionnaire()) navigate('safety'); }} />}
        {screen === 'safety' && <LiveSafetyScreen prediction={prediction} error={analysisError} onBack={() => navigate('questions')} onContinue={() => navigate('recommendations')} onRetry={startAnotherScan} />}
        {screen === 'recommendations' && <LiveRecommendationsScreen prediction={prediction} selected={selectedRecommendation} setSelected={setSelectedRecommendation} quantity={quantity} setQuantity={setQuantity} busy={analysisBusy} error={analysisError} onBack={() => navigate(followUpPromptFor(prediction) ? 'safety' : 'result')} onRetry={startAnotherScan} onSave={async () => { if (await saveRecommendation()) navigate('history'); }} />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function AuthScreen({ mode, email, password, confirmPassword, setEmail, setPassword, setConfirmPassword, onSubmit, onSwitch, onForgot, onBack, error, busy }: { mode: 'login' | 'register'; email: string; password: string; confirmPassword: string; setEmail: (value: string) => void; setPassword: (value: string) => void; setConfirmPassword: (value: string) => void; onSubmit: () => void; onSwitch: () => void; onForgot: () => void; onBack: () => void; error: string; busy: boolean }) {
  const isLogin = mode === 'login';
  const isAdminShortcut = isLogin && email.trim().toLowerCase() === 'admin';
  const [googleNotice, setGoogleNotice] = useState(false);
  return <ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled">
    <View style={styles.leafDecorationTop} />
    <View pointerEvents="none" style={styles.leafDecorationBottom} />
    {!isLogin ? <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable> : null}
    <View style={[styles.authBrandBlock, isLogin ? styles.authBrandBlockLogin : styles.authBrandBlockInner]}>
      <View style={styles.authLogoBadge}><Text style={styles.authLogoIcon}>◒</Text></View>
      <Text style={styles.authBrand}>SNAPTURE</Text>
      <Text style={styles.authTagline}>Give waste another purpose.</Text>
      <Text style={styles.authIntro}>{isLogin ? 'Identify. Assess. Reuse.\nA safer way to turn household waste into something\nuseful.' : 'Create an account to save your scans and history.'}</Text>
    </View>
    <View style={styles.formCard}>
      <Text style={[styles.inputLabel, styles.authInputLabel]}>Email address</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#9aa9a0" autoCapitalize="none" keyboardType="email-address" style={[styles.input, styles.authInput]} />
      <Text style={[styles.inputLabel, styles.authInputLabel]}>Password</Text>
      <TextInput value={password} onChangeText={setPassword} placeholder="Enter your password" placeholderTextColor="#9aa9a0" secureTextEntry style={[styles.input, styles.authInput]} />
      {isLogin ? <Pressable onPress={onForgot} style={styles.forgotButton}><Text style={styles.forgotText}>Forgot password?</Text></Pressable> : <>
        <Text style={[styles.inputLabel, styles.authInputLabel]}>Confirm password</Text>
        <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter your password" placeholderTextColor="#9aa9a0" secureTextEntry style={[styles.input, styles.authInput]} />
      </>}
      {error ? <Text style={styles.authError}>{error}</Text> : null}
      <PrimaryButton label={busy ? 'Please wait...' : isLogin ? 'Log in' : 'Create account'} onPress={onSubmit} disabled={busy || !email.trim() || (!isAdminShortcut && !password) || (!isLogin && !confirmPassword)} />
      <View style={styles.orRow}><View style={styles.divider} /><Text style={styles.orText}>or</Text><View style={styles.divider} /></View>
      <SecondaryButton label="Continue with Google" onPress={() => setGoogleNotice(true)} />
      {googleNotice ? <View style={styles.authNotice}><Text style={styles.authNoticeTitle}>Google sign-in is not connected yet</Text><Text style={styles.authNoticeText}>This local build does not have a Google OAuth client configured. Use email and password for now.</Text></View> : null}
    </View>
    <Pressable onPress={onSwitch} style={styles.textButton}><Text style={styles.textButtonLabel}>{isLogin ? 'New to SNAPTURE? ' : 'Already registered? '}<Text style={styles.textButtonStrong}>{isLogin ? 'Create an account' : 'Log in'}</Text></Text></Pressable>
  </ScrollView>;
}

function ForgotPasswordScreen({ email, setEmail, onBack }: { email: string; setEmail: (value: string) => void; onBack: () => void }) {
  const [step, setStep] = useState<'request' | 'confirm' | 'success'>('request');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const requestReset = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setError('Enter the email address used for your SNAPTURE account.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await requestPasswordReset(normalizedEmail);
      setToken(response.reset_token || '');
      setMessage(response.reset_token
        ? 'A local reset code was generated. It is filled in below for this development build.'
        : response.detail);
      setStep('confirm');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to start password reset.');
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = async () => {
    if (!token.trim()) {
      setError('Enter the reset code sent to your email.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Your new password must contain at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await confirmPasswordReset(email.trim().toLowerCase(), token.trim(), newPassword);
      setMessage(response.detail);
      setStep('success');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reset your password.');
    } finally {
      setBusy(false);
    }
  };

  return <ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled">
    <View style={styles.leafDecorationTop} />
    <View pointerEvents="none" style={styles.leafDecorationBottom} />
    <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
    <View style={[styles.authBrandBlock, styles.authBrandBlockInner]}>
      <View style={styles.authLogoBadge}><Text style={styles.authLogoIcon}>◒</Text></View>
      <Text style={styles.authBrand}>SNAPTURE</Text>
      <Text style={styles.authTagline}>Give waste another purpose.</Text>
    </View>
    <View style={styles.resetHeadingBlock}>
      <Text style={styles.authTitle}>{step === 'request' ? 'Forgot password?' : step === 'confirm' ? 'Create a new password' : 'Password updated'}</Text>
      <Text style={styles.authSubtitle}>{step === 'request' ? 'Enter your email address to request account recovery.' : step === 'confirm' ? 'Use the reset code and choose a new password.' : 'Your SNAPTURE account is ready to use again.'}</Text>
    </View>
    <View style={styles.formCard}>
      {step === 'request' ? <>
        <Text style={[styles.inputLabel, styles.authInputLabel]}>Email address</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#9aa9a0" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" style={[styles.input, styles.authInput]} />
        {error ? <Text style={styles.authError}>{error}</Text> : null}
        <PrimaryButton label={busy ? 'Requesting...' : 'Send reset code'} onPress={requestReset} disabled={busy || !email.trim()} />
      </> : step === 'confirm' ? <>
        {message ? <View style={styles.resetInfo}><Text style={styles.resetInfoText}>{message}</Text></View> : null}
        <Text style={[styles.inputLabel, styles.authInputLabel]}>Reset code</Text>
        <TextInput value={token} onChangeText={setToken} placeholder="Paste your reset code" placeholderTextColor="#9aa9a0" autoCapitalize="none" autoCorrect={false} style={[styles.input, styles.authInput]} />
        <Text style={[styles.inputLabel, styles.authInputLabel]}>New password</Text>
        <TextInput value={newPassword} onChangeText={setNewPassword} placeholder="At least 8 characters" placeholderTextColor="#9aa9a0" secureTextEntry style={[styles.input, styles.authInput]} />
        <Text style={[styles.inputLabel, styles.authInputLabel]}>Confirm new password</Text>
        <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter your new password" placeholderTextColor="#9aa9a0" secureTextEntry style={[styles.input, styles.authInput]} />
        {error ? <Text style={styles.authError}>{error}</Text> : null}
        <PrimaryButton label={busy ? 'Updating...' : 'Reset password'} onPress={confirmReset} disabled={busy || !token.trim() || !newPassword || !confirmPassword} />
        <SecondaryButton label="Use a different email" onPress={() => { setStep('request'); setToken(''); setError(''); setMessage(''); }} disabled={busy} />
      </> : <>
        <View style={styles.resetSuccess}><Text style={styles.resetSuccessTitle}>Reset complete</Text><Text style={styles.resetSuccessText}>{message || 'Your password has been updated.'}</Text></View>
        <PrimaryButton label="Back to login" onPress={onBack} />
      </>}
      {step !== 'success' ? <Pressable onPress={onBack} style={styles.textButton}><Text style={styles.textButtonLabel}>Remember your password? <Text style={styles.textButtonStrong}>Log in</Text></Text></Pressable> : null}
    </View>
  </ScrollView>;
}

function AdminLoginScreen({ identifier, password, setIdentifier, setPassword, onSubmit, onBack, error, busy }: { identifier: string; password: string; setIdentifier: (value: string) => void; setPassword: (value: string) => void; onSubmit: () => void; onBack: () => void; error: string; busy: boolean }) {
  return <ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled">
    <View style={styles.leafDecorationTop} />
    <View pointerEvents="none" style={styles.leafDecorationBottom} />
    <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
    <View style={styles.adminBrandBlock}>
      <View style={styles.authLogoBadge}><Text style={styles.authLogoIcon}>◒</Text></View>
      <Text style={styles.authBrand}>SNAPTURE</Text>
      <Text style={styles.authTagline}>Administrator access</Text>
    </View>
    <View style={styles.adminHeadingBlock}>
      <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>ADMIN</Text></View>
      <Text style={styles.authTitle}>Administrator sign in</Text>
      <Text style={styles.authSubtitle}>Use your SNAPTURE administrator account to manage the system.</Text>
    </View>
    <View style={styles.formCard}>
      <Text style={[styles.inputLabel, styles.authInputLabel]}>Username or email</Text>
      <TextInput value={identifier} onChangeText={setIdentifier} placeholder="admin" placeholderTextColor="#9aa9a0" autoCapitalize="none" style={[styles.input, styles.authInput]} />
      <Text style={[styles.inputLabel, styles.authInputLabel]}>Administrator password</Text>
      <TextInput value={password} onChangeText={setPassword} placeholder="Enter your password" placeholderTextColor="#9aa9a0" secureTextEntry style={[styles.input, styles.authInput]} />
      {error ? <Text style={styles.authError}>{error}</Text> : null}
      <PrimaryButton label={busy ? 'Signing in...' : 'Sign in as administrator'} onPress={onSubmit} disabled={busy || !identifier.trim() || !password} />
      <SecondaryButton label="Back to user login" onPress={onBack} disabled={busy} />
    </View>
    <Text style={styles.adminSecurityNote}>Administrator access is checked by the Django API. Regular accounts cannot open this dashboard.</Text>
  </ScrollView>;
}

/* Legacy dashboard prototype retained in git history; the privacy-safe dashboard below is the only active implementation.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyAdminDashboardScreen({ user, onLogout }: { user: ApiUser | null; onLogout: () => void }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadOverview = () => {
    setLoading(true);
    setError('');
    getAdminOverview().then(setOverview).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load the admin dashboard.')).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOverview();
  }, []);

  return <View style={styles.appPage}><ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
    <View style={styles.adminHeader}><View><Text style={styles.adminEyebrow}>SNAPTURE CONTROL CENTER</Text><Text style={styles.pageTitle}>Administrator dashboard</Text><Text style={styles.pageSubtitle}>Signed in as {user?.email || 'administrator'}.</Text></View><Pressable onPress={onLogout} style={styles.adminLogout}><Text style={styles.adminLogoutText}>Log out</Text></Pressable></View>
    {error ? <View style={styles.adminErrorCard}><Text style={styles.authError}>{error}</Text><SecondaryButton label="Try again" onPress={loadOverview} disabled={loading} /></View> : null}
    {loading && !overview ? <View style={styles.emptyState}><Text style={styles.emptyTitle}>Loading dashboard...</Text><Text style={styles.emptyText}>Fetching the latest system overview.</Text></View> : null}
    {overview ? <>
      <View style={styles.adminMetricGrid}>
        <View style={styles.adminMetricCard}><Text style={styles.adminMetricValue}>{overview.users_count}</Text><Text style={styles.adminMetricLabel}>Registered users</Text></View>
        <View style={styles.adminMetricCard}><Text style={styles.adminMetricValue}>{overview.predictions_count}</Text><Text style={styles.adminMetricLabel}>Predictions</Text></View>
        <View style={styles.adminMetricCard}><Text style={styles.adminMetricValue}>{overview.admin_count}</Text><Text style={styles.adminMetricLabel}>Administrators</Text></View>
      </View>
      <View style={styles.adminSectionHeader}><Text style={styles.sectionTitle}>Recent prediction activity</Text><Pressable onPress={loadOverview}><Text style={styles.viewAll}>{loading ? 'Updating...' : 'Refresh'}</Text></Pressable></View>
      {overview.recent_predictions.length ? overview.recent_predictions.map((record) => <View style={styles.adminRecord} key={record.id}><View style={styles.adminRecordIcon}><Text style={styles.adminRecordIconText}>AI</Text></View><View style={styles.historyCopy}><Text style={styles.historyTitle}>{record.title}</Text><Text style={styles.historyMeta}>{record.user_email}</Text><Text style={styles.historyMeta}>{new Date(record.created_at).toLocaleString()} · {Math.round(record.confidence * 100)}% confidence</Text></View></View>) : <View style={styles.emptyState}><Text style={styles.emptyTitle}>No predictions yet</Text><Text style={styles.emptyText}>User analyses will appear here.</Text></View>}
    </> : null}
  </ScrollView></View>;
}

*/

function AdminDashboardScreen({ user, onLogout }: { user: ApiUser | null; onLogout: () => void }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<AdminPredictionDetail | null>(null);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadOverview = () => {
    setLoading(true);
    setError('');
    getAdminOverview().then(setOverview).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load the admin dashboard.')).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const openRecord = async (id: number) => {
    setDetailError('');
    try {
      setSelectedRecord(await getAdminPredictionDetail(id));
    } catch (reason) {
      setDetailError(reason instanceof Error ? reason.message : 'Unable to open this record.');
    }
  };

  return <View style={styles.appPage}><ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
    <View style={styles.adminHeader}><View><Text style={styles.adminEyebrow}>SNAPTURE CONTROL CENTER</Text><Text style={styles.pageTitle}>Administrator dashboard</Text><Text style={styles.pageSubtitle}>Signed in as {user?.email || 'administrator'}.</Text></View><Pressable onPress={onLogout} style={styles.adminLogout}><Text style={styles.adminLogoutText}>Log out</Text></Pressable></View>
    <View style={styles.privacyNotice}><Text style={styles.privacyNoticeTitle}>Privacy-first view</Text><Text style={styles.privacyNoticeText}>Activity is anonymized here. Open a record only when you need to evaluate a model result.</Text></View>
    {error ? <View style={styles.adminErrorCard}><Text style={styles.authError}>{error}</Text><SecondaryButton label="Try again" onPress={loadOverview} disabled={loading} /></View> : null}
    {loading && !overview ? <View style={styles.emptyState}><Text style={styles.emptyTitle}>Loading dashboard...</Text><Text style={styles.emptyText}>Fetching privacy-safe system statistics.</Text></View> : null}
    {overview ? <>
      <View style={styles.adminMetricGrid}>
        <View style={styles.adminMetricCard}><Text style={styles.adminMetricValue}>{overview.users_count}</Text><Text style={styles.adminMetricLabel}>Registered users</Text></View>
        <View style={styles.adminMetricCard}><Text style={styles.adminMetricValue}>{overview.predictions_count}</Text><Text style={styles.adminMetricLabel}>Identification results</Text></View>
        <View style={styles.adminMetricCard}><Text style={styles.adminMetricValue}>{overview.admin_count}</Text><Text style={styles.adminMetricLabel}>Administrators</Text></View>
      </View>
      <View style={styles.adminSectionHeader}><Text style={styles.sectionTitle}>Category totals</Text><Text style={styles.viewAll}>No personal data</Text></View>
      <View style={styles.categoryTotals}>{Object.entries(overview.category_counts).map(([category, count]) => <View style={styles.categoryTotalRow} key={category}><Text style={styles.categoryTotalName}>{category.replace(/_/g, ' ')}</Text><Text style={styles.categoryTotalValue}>{count}</Text></View>)}</View>
      <View style={styles.adminSectionHeader}><Text style={styles.sectionTitle}>Recent anonymized activity</Text><Pressable onPress={loadOverview}><Text style={styles.viewAll}>{loading ? 'Updating...' : 'Refresh'}</Text></Pressable></View>
      {overview.recent_predictions.length ? overview.recent_predictions.map((record) => <Pressable style={styles.adminRecord} key={record.id} onPress={() => openRecord(record.id)}><View style={styles.adminRecordIcon}><Text style={styles.adminRecordIconText}>AI</Text></View><View style={styles.historyCopy}><Text style={styles.historyTitle}>{record.title}</Text><Text style={styles.historyMeta}>{record.reference} - {new Date(record.created_at).toLocaleString()}</Text><Text style={styles.historyMeta}>{Math.round(record.confidence * 100)}% model confidence</Text></View><Text style={styles.adminRecordAction}>View</Text></Pressable>) : <View style={styles.emptyState}><Text style={styles.emptyTitle}>No identification results yet</Text><Text style={styles.emptyText}>User analyses will appear here without personal details.</Text></View>}
      {detailError ? <Text style={styles.authError}>{detailError}</Text> : null}
      {selectedRecord ? <View style={styles.adminDetailCard}><View style={styles.adminDetailHeader}><Text style={styles.infoTitle}>Record {selectedRecord.reference}</Text><Pressable onPress={() => setSelectedRecord(null)}><Text style={styles.viewAll}>Close</Text></Pressable></View><Text style={styles.infoText}>Material: {selectedRecord.title}</Text><Text style={styles.infoText}>Model class: {selectedRecord.model_class}</Text><Text style={styles.infoText}>Confidence: {Math.round(selectedRecord.confidence * 100)}%</Text><Text style={styles.infoText}>Quantity: {selectedRecord.quantity || 'Not provided'}</Text><Text style={styles.infoText}>Condition: {selectedRecord.condition || 'Not provided'}</Text><Text style={styles.infoText}>Previous contents: {selectedRecord.previous_contents || 'Not provided'}</Text><Text style={styles.adminDetailNote}>Personal email and image are intentionally not displayed in the mobile dashboard.</Text></View> : null}
    </> : null}
  </ScrollView></View>;
}

function MainShell({ screen, navigate, user, onLogout, onCategory }: { screen: Screen; navigate: (next: Screen) => void; user: ApiUser | null; onLogout: () => void; onCategory: (label: string) => void }) {
  if (screen === 'materials') return <MaterialsScreen navigate={navigate} onCategory={onCategory} />;
  if (screen === 'history') return <HistoryScreen navigate={navigate} />;
  if (screen === 'more') return <ProfileScreen navigate={navigate} onLogout={onLogout} user={user} />;
  return <HomeScreenV2 navigate={navigate} user={user} onCategory={onCategory} />;
}

function MaterialsScreen({ navigate, onCategory }: { navigate: (next: Screen) => void; onCategory: (label: string) => void }) {
  const [guides, setGuides] = useState<MaterialGuide[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getMaterials().then((response) => setGuides(response.materials)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load the material library.'));
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleCategories = DISPLAY_CATEGORIES.filter((category) => {
    if (!normalizedQuery) return true;
    const guide = guides.find((item) => item.label === CATEGORY_LABELS[category.name]);
    return category.name.toLowerCase().includes(normalizedQuery)
      || guide?.description.toLowerCase().includes(normalizedQuery)
      || guide?.upcycling.some((item) => item.title.toLowerCase().includes(normalizedQuery));
  });

  return <View style={styles.appPage}>
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>Materials library</Text>
      <Text style={styles.pageSubtitle}>Learn what each thesis material is, how to prepare it, and what you can make from it.</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search materials or project ideas" placeholderTextColor="#8a998f" style={styles.searchInput} />
      {error ? <Text style={styles.libraryNote}>The guide is using the local category list while the server reconnects.</Text> : null}
      <View style={styles.materialList}>{visibleCategories.map((category) => <Pressable key={category.name} style={styles.materialListCard} onPress={() => onCategory(CATEGORY_LABELS[category.name])}><View style={[styles.categoryIcon, { backgroundColor: category.color }]}><CategoryGlyph kind={category.glyph} size={36} /></View><View style={styles.materialListCopy}><Text style={styles.materialListTitle}>{category.name}</Text><Text style={styles.materialListDescription}>{guides.find((item) => item.label === CATEGORY_LABELS[category.name])?.description || 'Open the guide to learn more about this material.'}</Text><Text style={styles.categoryAction}>Open guide</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</View>
      {visibleCategories.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyTitle}>No material found</Text><Text style={styles.emptyText}>Try a category name or an upcycling project.</Text></View> : null}
    </ScrollView>
    <BottomNav active="materials" navigate={navigate} />
  </View>;
}

function MaterialDetailScreen({ label, navigate, onBack }: { label: string; navigate: (next: Screen) => void; onBack: () => void }) {
  const [guide, setGuide] = useState<MaterialGuide | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const category = DISPLAY_CATEGORIES.find((item) => CATEGORY_LABELS[item.name] === label);

  const loadGuide = useCallback(() => {
    setLoading(true);
    setError('');
    getMaterials().then((response) => setGuide(response.materials.find((item) => item.label === label) || null)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load this material guide.')).finally(() => setLoading(false));
  }, [label]);

  useEffect(() => {
    loadGuide();
  }, [loadGuide]);

  return <SimplePage title={guide?.title || category?.name || 'Material guide'} onBack={onBack}>
    {error ? <Text style={styles.libraryNote}>The guide could not be loaded from the server. Start the backend and try again.</Text> : null}
    {guide ? <>
      <View style={styles.guideHero}><View style={[styles.guideIcon, { backgroundColor: category?.color || '#e6f4df' }]}><CategoryGlyph kind={category?.glyph} size={48} /></View><View style={styles.guideHeroCopy}><Text style={styles.guideTitle}>{guide.title}</Text><Text style={styles.guideDescription}>{guide.description}</Text></View></View>
      <View style={styles.guideStatus}><Text style={styles.guideStatusTitle}>Before you act</Text><Text style={styles.guideStatusText}>{guide.model_status}</Text></View>
      <InfoCard title="Common examples" items={guide.examples.length ? guide.examples : ['Examples are not available yet.']} />
      <InfoCard title="Preparation" items={guide.preparation} />
      <View style={styles.infoCard}><Text style={styles.infoTitle}>Recycling guidance</Text><Text style={styles.infoText}>{guide.recycling}</Text><Text style={[styles.infoTitle, styles.infoTitleSpacing]}>Disposal guidance</Text><Text style={styles.infoText}>{guide.disposal}</Text></View>
      <Text style={[styles.sectionTitle, styles.guideSectionTitle]}>Upcycling ideas</Text>
      {guide.upcycling.map((recommendation) => <View key={recommendation.id} style={styles.recommendationCard}><View style={styles.projectIcon}><Text style={styles.projectIconText}>Idea</Text></View><View style={styles.projectCopy}><Text style={styles.projectTitle}>{recommendation.title}</Text><Text style={styles.projectDescription}>{recommendation.summary}</Text><Text style={styles.projectMaterials}>{recommendation.materials.join(' • ')}</Text></View></View>)}
      <PrimaryButton label="Scan this material" onPress={() => navigate('camera')} />
    </> : <View style={styles.emptyState}><Text style={styles.emptyTitle}>{loading ? 'Loading material guide...' : 'Material guide unavailable'}</Text><Text style={styles.emptyText}>{error || 'The guide includes preparation, recycling, disposal, and project ideas.'}</Text>{!loading ? <SecondaryButton label="Try again" onPress={loadGuide} /> : null}</View>}
  </SimplePage>;
}

function HomeScreenV2({ navigate, user, onCategory }: { navigate: (next: Screen) => void; user: ApiUser | null; onCategory: (label: string) => void }) {
  const [recent, setRecent] = useState<PredictionSummary | null>(null);
  const { width } = useWindowDimensions();
  const horizontalPadding = Math.max(10, Math.min(20, width * 0.045));
  const tileWidth = (width - (horizontalPadding * 2) - (Math.max(8, Math.min(18, width * 0.05)) * 2)) / 3;
  // Keep the category artwork close to the reference proportions on narrow
  // phones while still scaling up slightly on tablets.
  const tileSize = Math.max(48, Math.min(54, tileWidth * 0.68));
  const lastTileOffset = (width - (horizontalPadding * 2) - tileWidth) / 2;
  useEffect(() => {
    listPredictions().then((records) => setRecent(records[0] || null)).catch(() => undefined);
  }, []);
  const recentCategory = recent
    ? DISPLAY_CATEGORIES.find((category) => recent.title.toLowerCase().includes(category.name.split(' ')[0].toLowerCase()))
    : undefined;
  return <View style={styles.appPage}>
    <View pointerEvents="none" style={styles.dashboardBottomWash} />
    <ScrollView contentContainerStyle={[styles.dashboardPageContent, { paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
      <View style={styles.homeHeader}><View style={styles.homeHeaderCopy}><Text style={styles.smallGreeting} numberOfLines={1} ellipsizeMode="tail">Good day{user?.display_name ? `, ${user.display_name}` : ''}</Text><Text style={styles.homeTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Make an impact today.</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>{(user?.display_name || 'S').charAt(0).toUpperCase()}</Text></View></View>
      <View style={styles.dashboardSectionHeader}><Text style={styles.dashboardSectionTitle}>What can I recycle?</Text><Pressable onPress={() => navigate('materials')} hitSlop={8}><Text style={styles.dashboardViewAll}>Seven categories</Text></Pressable></View>
      <View style={styles.dashboardCategoryGrid}>{DISPLAY_CATEGORIES.map((category, index) => <Pressable key={category.name} style={[styles.dashboardCategoryItem, { width: tileWidth }, index === DISPLAY_CATEGORIES.length - 1 && { marginLeft: lastTileOffset }]} onPress={() => onCategory(CATEGORY_LABELS[category.name])}><View style={[styles.dashboardCategoryIcon, { width: tileSize, height: tileSize, borderRadius: Math.round(tileSize * 0.22), backgroundColor: category.color }]}><CategoryGlyph kind={category.glyph} size={tileSize * 0.72} /></View><Text style={styles.dashboardCategoryName}>{category.name}</Text><Text style={styles.dashboardCategoryAction}>Learn more</Text></Pressable>)}</View>
      <View style={styles.dashboardSectionHeader}><Text style={styles.dashboardSectionTitle}>Recent scans</Text><Pressable onPress={() => navigate('history')} hitSlop={8}><Text style={styles.dashboardViewAll}>See history</Text></Pressable></View>
      {recent ? <Pressable style={styles.dashboardRecentCard} onPress={() => navigate('history')}><View style={[styles.dashboardRecentImage, { backgroundColor: recentCategory?.color || '#e6f4df' }]}><CategoryGlyph kind={recentCategory?.glyph} size={34} /></View><View style={styles.dashboardRecentCopy}><Text style={styles.dashboardRecentTitle} numberOfLines={1}>{recent.title}</Text><Text style={styles.dashboardRecentMeta} numberOfLines={2}>{new Date(recent.created_at).toLocaleString()} | {Math.round(recent.confidence * 100)}% confidence</Text><Text style={styles.dashboardSavedTag}>Saved privately</Text></View><Text style={styles.dashboardOpen}>Open</Text></Pressable> : <View style={styles.dashboardRecentEmpty}><Text style={styles.recentEmptyTitle}>No scans yet</Text><Text style={styles.recentMeta}>Your completed analyses will appear here.</Text></View>}
    </ScrollView>
    <BottomNav active="home" navigate={navigate} />
  </View>;
}

/* Legacy home/camera/result prototypes removed from the active render tree.
// Legacy home prototype retained for comparison.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function HomeScreen({ navigate, user }: { navigate: (next: Screen) => void; user: ApiUser | null }) {
  return <View style={styles.appPage}>
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <View style={styles.homeHeader}><View><Text style={styles.smallGreeting}>Good day{user?.display_name ? `, ${user.display_name}` : ''}</Text><Text style={styles.homeTitle}>Make an impact today.</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>{(user?.display_name || 'J').charAt(0).toUpperCase()}</Text></View></View>
      <Pressable style={styles.scanCard} onPress={() => navigate('camera')}><View style={styles.scanIcon}><Text style={styles.scanIconText}>⌾</Text></View><View style={styles.scanCopy}><Text style={styles.scanTitle}>Scan an object</Text><Text style={styles.scanSubtitle}>Take a clear photo of one household object.</Text></View><View style={styles.arrowCircle}><Text style={styles.arrow}>→</Text></View></Pressable>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>What can I recycle?</Text><Text style={styles.viewAll}>View all</Text></View>
      <TextInput placeholder="Search materials or projects" placeholderTextColor="#8a998f" style={styles.searchInput} />
      <View style={styles.categoryGrid}>{DISPLAY_CATEGORIES.map((category) => <Pressable key={category.name} style={styles.categoryItem} onPress={() => navigate('camera')}><View style={[styles.categoryIcon, { backgroundColor: category.color }]}><Text style={styles.categoryIconText}>{category.icon}</Text></View><Text style={styles.categoryName}>{category.name}</Text></Pressable>)}</View>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Recent scans</Text><Text style={styles.viewAll} onPress={() => navigate('history')}>See history</Text></View>
      <View style={styles.recentCard}><View style={styles.recentImage}><Text style={styles.recentImageText}>♧</Text></View><View style={styles.recentCopy}><Text style={styles.recentTitle}>PETE bottle</Text><Text style={styles.recentMeta}>Yesterday · Sample UI record</Text><Text style={styles.supportedTag}>Supported</Text></View><Text style={styles.chevron}>›</Text></View>
    </ScrollView>
    <BottomNav active="home" navigate={navigate} />
  </View>;
}

// Legacy prototype kept temporarily for visual comparison with the new native flow.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CameraScreen({ onBack, onCaptured }: { onBack: () => void; onCaptured: () => void }) {
  return <View style={styles.cameraPage}>
    <View style={styles.cameraHeader}><Pressable onPress={onBack}><Text style={styles.cameraHeaderIcon}>×</Text></Pressable><Text style={styles.cameraHeaderTitle}>Scan an object</Text><Text style={styles.cameraHeaderIcon}>ϟ</Text></View>
    <View style={styles.cameraPreview}><View style={styles.cameraGuide}><Text style={styles.cameraGuideText}>Place one object inside the frame</Text></View><Text style={styles.cameraHint}>Make sure the object is clear, well-lit, and in focus.</Text></View>
    <View style={styles.cameraControls}><Pressable style={styles.galleryButton}><Text style={styles.galleryIcon}>▧</Text><Text style={styles.controlLabel}>Gallery</Text></Pressable><Pressable style={styles.shutterOuter} onPress={onCaptured}><View style={styles.shutterInner} /></Pressable><Pressable style={styles.galleryButton}><Text style={styles.galleryIcon}>↻</Text><Text style={styles.controlLabel}>Flip</Text></Pressable></View>
    <Text style={styles.cameraFootnote}>Camera integration will be connected to the Android native camera module.</Text>
  </View>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function QualityScreen({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return <SimplePage title="Image quality check" onBack={onBack}><View style={styles.photoPlaceholder}><Text style={styles.photoBottle}>♧</Text><Text style={styles.photoLabel}>Photo preview</Text><View style={styles.goodBadge}><Text style={styles.goodBadgeText}>Good quality</Text></View></View><CheckList items={['Image is clear and sharp', 'Good lighting', 'Object is well framed', 'Background is not distracting', 'Object is fully visible']} /><PrimaryButton label="Continue" onPress={onContinue} /><SecondaryButton label="Retake photo" onPress={onBack} /></SimplePage>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ResultScreen({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return <SimplePage title="Identification result" onBack={onBack}><View style={styles.resultCard}><View style={styles.photoSmall}><Text style={styles.photoBottle}>♧</Text></View><View style={styles.resultCopy}><Text style={styles.resultName}>PETE bottle</Text><Text style={styles.resultConfidence}>Live model confidence will appear here</Text><Text style={styles.supportedTag}>Supported material</Text></View></View><InfoCard title="Visible condition" items={['No visible cracks or damage', 'Surface appears dry', 'No visible foreign matter']} /><InfoCard title="Next step" items={['Answer a few questions so recommendations can match your quantity and intended use.']} /><PrimaryButton label="Continue to questions" onPress={onContinue} /></SimplePage>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function QuestionsScreen({ quantity, setQuantity, condition, setCondition, onBack, onContinue }: { quantity: string; setQuantity: (value: string) => void; condition: string; setCondition: (value: string) => void; onBack: () => void; onContinue: () => void }) {
  return <SimplePage title="Tell us about the item" onBack={onBack}><Text style={styles.questionIntro}>These answers help SNAPTURE find better reuse options.</Text><Text style={styles.inputLabel}>How many items do you have?</Text><TextInput value={quantity} onChangeText={setQuantity} placeholder="Example: 10" placeholderTextColor="#9aa9a0" keyboardType="number-pad" style={styles.input} /><Text style={styles.inputLabel}>What is their current condition?</Text><View style={styles.choiceList}>{['Clean and dry', 'Needs cleaning', 'Damaged or cracked', 'Not sure'].map((choice) => <Choice key={choice} label={choice} selected={condition === choice} onPress={() => setCondition(choice)} />)}</View><Text style={styles.inputLabel}>What was the previous content?</Text><View style={styles.choiceList}>{['Water or beverage', 'Food or oil', 'Chemical or cleaning product', 'Other / unknown'].map((choice) => <Choice key={choice} label={choice} selected={false} onPress={() => {}} />)}</View><PrimaryButton label="Continue to safety check" onPress={onContinue} /></SimplePage>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SafetyScreen({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return <SimplePage title="Safety check" onBack={onBack}><View style={styles.safetyCard}><View style={styles.safetyIcon}><Text style={styles.safetyIconText}>✓</Text></View><Text style={styles.safetyTitle}>No immediate issues found</Text><Text style={styles.safetyDescription}>This is an educational decision-support result based only on the visible image and information provided.</Text></View><InfoCard title="Evidence summary" items={['Image quality: Good', 'Identification: PETE bottle', 'Condition: User-provided']} /><View style={styles.disclaimer}><Text style={styles.disclaimerText}>This result does not certify chemical, microbial, structural, or food-contact safety.</Text></View><PrimaryButton label="View recommendations" onPress={onContinue} /></SimplePage>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function RecommendationsScreen({ selected, setSelected, quantity, onBack, onSave }: { selected: string; setSelected: (value: string) => void; quantity: string; onBack: () => void; onSave: () => void }) {
  const quantityLabel = quantity === '1' ? 'one item' : quantity === '3' ? 'a few items' : quantity === '10' ? 'many items' : 'your items';
  return <SimplePage title="Recommendations" onBack={onBack}><View style={styles.recommendationBanner}><Text style={styles.bannerIcon}>✿</Text><View style={styles.bannerCopy}><Text style={styles.bannerTitle}>Eligible for reuse ideas</Text><Text style={styles.bannerSubtitle}>Options are adjusted for {quantityLabel}.</Text></View></View><Text style={styles.sectionTitle}>Choose a project</Text>{RECOMMENDATIONS.map((recommendation) => <Pressable key={recommendation.title} style={[styles.recommendationCard, selected === recommendation.title && styles.recommendationSelected]} onPress={() => setSelected(recommendation.title)}><View style={styles.projectIcon}><Text style={styles.projectIconText}>{recommendation.icon}</Text></View><View style={styles.projectCopy}><Text style={styles.projectTitle}>{recommendation.title}</Text><Text style={styles.projectDescription}>{recommendation.description}</Text><Text style={styles.projectMaterials}>{recommendation.materials}</Text></View><Text style={styles.radio}>{selected === recommendation.title ? '●' : '○'}</Text></Pressable>)}<PrimaryButton label={selected ? 'Save selected project' : 'Choose a project'} onPress={onSave} disabled={!selected} /></SimplePage>;
}

*/

function toImageUri(uri: string) {
  return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('http://') || uri.startsWith('https://')
    ? uri
    : `file://${uri}`;
}

function NativeCameraScreen({ onBack, onCaptured }: { onBack: () => void; onCaptured: (uri: string) => void }) {
  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
  const device = useCameraDevice(cameraPosition);
  const cameraRef = useRef<CameraRef>(null);
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput({ quality: 0.85 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const torchModeRef = useRef<'on' | 'off' | null>('off');
  const flashSupported = cameraPosition === 'back' && Boolean(device?.hasFlash || device?.hasTorch);
  const torchSupported = cameraPosition === 'back' && Boolean(device?.hasTorch);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      requestPermission().catch(() => undefined);
    }
  }, [canRequestPermission, hasPermission, requestPermission]);

  // Keep the physical torch in sync with the selected flash mode. Auto uses
  // the capture flash only; it must not enable the continuous torch. We use
  // one controller path here so CameraX does not cancel a duplicate torch
  // request when the mode changes on Xiaomi devices.
  useEffect(() => {
    if (!cameraReady || !torchSupported) return;
    const controller = cameraRef.current?.controller;
    if (!controller) return;
    const targetTorchMode = flashMode === 'on' ? 'on' : 'off';
    if (torchModeRef.current === targetTorchMode) return;
    torchModeRef.current = targetTorchMode;
    controller.setTorchMode(targetTorchMode).catch((reason) => {
      torchModeRef.current = null;
      const message = reason instanceof Error ? reason.message : String(reason || '');
      // CameraX cancels a superseded torch request while applying a newer
      // state. That is expected during a fast mode change, not a user error.
      if (/operation.?canceled|cancelled|canceled/i.test(message)) return;
      setError(message ? `Flash could not be changed: ${message}` : 'Flash could not be changed on this device.');
    });
  }, [cameraReady, flashMode, torchSupported]);

  const capture = async () => {
    if (!device || busy) return;
    setBusy(true);
    setError('');
    console.log('[SNAPTURE] camera:capture:start', { cameraPosition, flashMode });
    try {
      // The capture setting controls the flash at the instant the photo is taken.
      // The Camera `torchMode` prop below keeps the light on while previewing.
      const photo = await photoOutput.capturePhotoToFile(
        { flashMode: device?.hasFlash ? flashMode : 'off' },
        {},
      );
      console.log('[SNAPTURE] camera:capture:success');
      onCaptured(photo.filePath);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to capture a photo.';
      console.error('[SNAPTURE] camera:capture:error', message);
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const selectFromGallery = () => {
    setError('');
    console.log('[SNAPTURE] gallery:open');
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 1, includeBase64: false },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          setError(response.errorMessage || 'Unable to open the photo gallery.');
          return;
        }
        const uri = response.assets?.[0]?.uri;
        if (uri) {
          console.log('[SNAPTURE] gallery:selected');
          onCaptured(uri);
        } else {
          setError('No photo was selected.');
        }
      },
    );
  };

  const toggleCamera = () => {
    if (cameraPosition === 'back') {
      cameraRef.current?.controller?.setTorchMode('off').catch(() => undefined);
      torchModeRef.current = 'off';
    }
    setCameraPosition((current) => {
      const next = current === 'back' ? 'front' : 'back';
      console.log('[SNAPTURE] camera:switch', next);
      if (next === 'front') setFlashMode('off');
      return next;
    });
  };

  const cycleFlashMode = () => {
    if (!flashSupported) {
      setError('Flash is not available on this camera. Switch to the rear camera.');
      return;
    }
    setError('');
    setFlashMode((current) => {
      const next = current === 'off' ? 'on' : current === 'on' ? 'auto' : 'off';
      console.log('[SNAPTURE] flash:mode', next);
      return next;
    });
  };

  const handleSessionError = (reason: Error) => {
    const message = reason?.message || '';
    if (/torch|flash/i.test(message)) {
      setError(`Flash could not be enabled: ${message}`);
      return;
    }
    setSessionError(message);
    setError('The camera could not start on this device. Check Android camera privacy or device-policy settings, then try again.');
  };

  if (!hasPermission) {
    return <View style={styles.cameraPermissionPage}><Pressable onPress={onBack}><Text style={styles.cameraHeaderIcon}>Back</Text></Pressable><Text style={styles.cameraPermissionTitle}>Camera access is required</Text><Text style={styles.cameraPermissionText}>SNAPTURE needs camera access to identify a household material. Allow it in Android permissions, then try again.</Text><PrimaryButton label={canRequestPermission ? 'Allow camera' : 'Open camera settings'} onPress={() => { if (canRequestPermission) requestPermission(); else Linking.openSettings(); }} /></View>;
  }

  if (!device) {
    return <View style={styles.cameraPermissionPage}><Pressable onPress={onBack}><Text style={styles.cameraHeaderIcon}>Back</Text></Pressable><Text style={styles.cameraPermissionTitle}>Camera unavailable</Text><Text style={styles.cameraPermissionText}>No rear camera was detected on this device or emulator.</Text></View>;
  }

  if (sessionError) {
    return <View style={styles.cameraPermissionPage}><Pressable onPress={onBack}><Text style={styles.cameraHeaderIcon}>Back</Text></Pressable><Text style={styles.cameraPermissionTitle}>Camera is unavailable</Text><Text style={styles.cameraPermissionText}>Android reported that the camera is disabled by a privacy control or device policy. SNAPTURE will not continue with a broken preview. Enable camera access in Android settings, then try again.</Text>{error ? <Text style={styles.cameraError}>{error}</Text> : null}<PrimaryButton label="Try camera again" onPress={() => { setSessionError(''); setError(''); }} /><SecondaryButton label="Open camera settings" onPress={() => Linking.openSettings()} /></View>;
  }

  const flashModeLabel = flashMode === 'on' ? 'On' : flashMode === 'auto' ? 'Auto' : 'Off';
  return <View style={styles.cameraPage}>
    <View style={styles.cameraHeader}><Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back"><Text style={styles.cameraBackIcon}>‹</Text></Pressable><Text style={styles.cameraHeaderTitle}>Scan an object</Text><Pressable onPress={cycleFlashMode} disabled={!flashSupported} hitSlop={8} accessibilityRole="button" accessibilityLabel={flashSupported ? `Flash: ${flashModeLabel}` : 'Flash unavailable'}><View style={[styles.flashIconWrap, !flashSupported && styles.buttonDisabled]}><Text style={[styles.flashIcon, flashMode === 'on' && styles.flashIconActive]}>⚡︎</Text>{flashMode === 'auto' ? <Text style={styles.flashAutoLetter}>A</Text> : null}</View></Pressable></View>
    <View style={styles.cameraPreview}>
      <Camera ref={cameraRef} key={device.id} style={StyleSheet.absoluteFill} device={device} outputs={[photoOutput]} isActive={!sessionError} onStarted={() => { console.log('[SNAPTURE] camera:ready'); setCameraReady(true); }} onStopped={() => { console.log('[SNAPTURE] camera:stopped'); setCameraReady(false); }} onError={(reason) => { console.error('[SNAPTURE] camera:session_error', reason.message); handleSessionError(reason); }} />
      <Text style={styles.flashStatus} pointerEvents="none">Flash: {flashModeLabel}</Text>
      <View style={styles.cameraOverlay} pointerEvents="none"><View style={styles.cameraGuide}><Text style={styles.cameraGuideText}>Place one object inside the frame</Text></View><Text style={styles.cameraHint}>Make sure the object is clear, well-lit, and in focus.</Text></View>
    </View>
    {error ? <Text style={styles.cameraError}>{error}</Text> : null}
    <View style={styles.cameraControls}><Pressable style={styles.galleryButton} onPress={selectFromGallery} accessibilityRole="button" accessibilityLabel="Open gallery"><Text style={styles.galleryIcon} numberOfLines={1}>Gallery</Text><Text style={styles.controlLabel}>Info</Text></Pressable><View style={styles.shutterGroup}><Text style={styles.photoModeLabel}>Photo</Text><Pressable style={[styles.shutterOuter, busy && styles.buttonDisabled]} onPress={capture} disabled={busy} hitSlop={8} accessibilityRole="button" accessibilityLabel="Take photo"><View style={styles.shutterInner} /></Pressable></View><Pressable style={styles.cameraSwitchButton} onPress={toggleCamera} accessibilityRole="button" accessibilityLabel={`Switch to ${cameraPosition === 'back' ? 'front' : 'rear'} camera`}><Text style={styles.cameraSwitchIcon}>⇄</Text></Pressable></View>
  </View>;
}

function LiveQualityScreen({ photoUri, error, analyzing, onBack, onContinue }: { photoUri: string | null; error: string; analyzing: boolean; onBack: () => void; onContinue: () => void }) {
  return <SimplePage title="Image quality check" onBack={onBack}><View style={styles.photoPlaceholder}>{photoUri ? <Image source={{ uri: toImageUri(photoUri) }} style={styles.photoPreview} resizeMode="cover" /> : <Text style={styles.photoBottle}>Photo</Text>}<View style={styles.goodBadge}><Text style={styles.goodBadgeText}>Ready to review</Text></View></View><CheckList items={['Image is clear and sharp', 'Good lighting', 'Object is well framed', 'Background is not distracting', 'Object is fully visible']} /><Text style={styles.privacyHint}>When analyzed, this image is saved privately to your account. You can delete it later from My scans.</Text>{error ? <Text style={styles.authError}>{error}</Text> : null}<PrimaryButton label={analyzing ? 'Analyzing image...' : 'Analyze image'} onPress={onContinue} disabled={analyzing || !photoUri} /><SecondaryButton label="Retake photo" onPress={onBack} /></SimplePage>;
}

function LiveResultScreen({ photoUri, prediction, error, onBack, onContinue }: { photoUri: string | null; prediction: Prediction | null; error: string; onBack: () => void; onContinue: () => void }) {
  const confidence = prediction ? `${Math.round(prediction.confidence * 100)}% model confidence` : 'No identification available';
  const needsVerification = Boolean(prediction && !isSupportedPrediction(prediction));
  const resultTitle = prediction ? displayPredictionTitle(prediction) : 'Identification unavailable';
  const followUp = followUpPromptFor(prediction);
  const unsupported = Boolean(prediction && !isSupportedPrediction(prediction));
  return <SimplePage title="Identification result" onBack={onBack}>
    <View style={styles.resultCard}>{photoUri ? <Image source={{ uri: toImageUri(photoUri) }} style={styles.photoSmall} resizeMode="cover" /> : <View style={styles.photoSmall}><Text style={styles.photoBottle}>Photo</Text></View>}<View style={styles.resultCopy}><Text style={styles.resultName}>{resultTitle}</Text><Text style={styles.resultConfidence}>{confidence}</Text>{prediction ? <Text style={[styles.supportedTag, needsVerification && styles.verificationTag]}>{needsVerification ? 'Needs verification' : 'Educational result'}</Text> : null}</View></View>
    {error ? <Text style={styles.authError}>{error}</Text> : null}
    {unsupported ? <InfoCard title="Try another item" items={['This object is outside the supported SNAPTURE categories or the image is not certain enough.', 'Take one clear photo of a single supported material to receive reuse and recycling guidance.']} /> : <InfoCard title="Next step" items={[prediction ? (followUp ? 'We need one quick confirmation before tailoring the ideas.' : 'Your recommendations are ready. No extra questions are required for this result.') : 'Retake the photo and analyze again.']} />}
    {prediction ? <PrimaryButton label={unsupported ? 'Try another item' : followUp ? 'One quick check' : 'See recommendations'} onPress={onContinue} /> : <SecondaryButton label="Retake photo" onPress={onBack} />}
  </SimplePage>;
}

function LiveQuestionsScreen({ quantity, setQuantity, condition, setCondition, previousContents, setPreviousContents, availableMaterials, setAvailableMaterials, prompt, answer, setAnswer, error, busy, onBack, onContinue }: { quantity: string; setQuantity: (value: string) => void; condition: string; setCondition: (value: string) => void; previousContents: string; setPreviousContents: (value: string) => void; availableMaterials: string; setAvailableMaterials: (value: string) => void; prompt?: FollowUpPrompt | null; answer?: string; setAnswer?: (value: string) => void; error: string; busy: boolean; onBack: () => void; onContinue: () => void }) {
  if (prompt) {
    return <SimplePage title={prompt.title} onBack={onBack}>
      <Text style={styles.questionIntro}>{prompt.description}</Text>
      <View style={styles.choiceList}>{prompt.options.map((choice) => <Choice key={choice} label={choice} selected={answer === choice} onPress={() => setAnswer?.(choice)} />)}</View>
      <Text style={styles.optionalHint}>This is the only follow-up we need. You can choose “Not sure” and continue.</Text>
      {error ? <Text style={styles.authError}>{error}</Text> : null}
      <PrimaryButton label={busy ? 'Saving...' : 'Continue'} onPress={onContinue} disabled={busy || !answer} />
    </SimplePage>;
  }
  return <SimplePage title="Tell us about the item" onBack={onBack}><Text style={styles.questionIntro}>These answers help SNAPTURE find better reuse options and safety notes.</Text><Text style={styles.inputLabel}>How many items do you have?</Text><TextInput value={quantity} onChangeText={setQuantity} placeholder="Example: 10" placeholderTextColor="#9aa9a0" keyboardType="number-pad" style={styles.input} /><Text style={styles.inputLabel}>What is their current condition?</Text><View style={styles.choiceList}>{['Clean and dry', 'Needs cleaning', 'Damaged or cracked', 'Not sure'].map((choice) => <Choice key={choice} label={choice} selected={condition === choice} onPress={() => setCondition(choice)} />)}</View><Text style={styles.inputLabel}>What was the previous content?</Text><View style={styles.choiceList}>{['Water or beverage', 'Food or oil', 'Chemical or cleaning product', 'Other / unknown'].map((choice) => <Choice key={choice} label={choice} selected={previousContents === choice} onPress={() => setPreviousContents(choice)} />)}</View><Text style={styles.inputLabel}>What tools or materials do you already have?</Text><TextInput value={availableMaterials} onChangeText={setAvailableMaterials} placeholder="Example: scissors, soil, glue" placeholderTextColor="#9aa9a0" style={styles.input} />{error ? <Text style={styles.authError}>{error}</Text> : null}<PrimaryButton label={busy ? 'Saving details...' : 'Continue to safety check'} onPress={onContinue} disabled={busy || !quantity.trim()} /></SimplePage>;
}

function LiveSafetyScreen({ prediction, error, onBack, onContinue, onRetry }: { prediction: Prediction | null; error: string; onBack: () => void; onContinue: () => void; onRetry: () => void }) {
  const supported = isSupportedPrediction(prediction);
  const title = supported ? 'Review the safety notes' : 'Needs additional review';
  const identification = prediction ? displayPredictionTitle(prediction) : 'Not available';
  if (!supported) {
    return <SimplePage title="Try another item" onBack={onBack}><View style={styles.safetyCard}><View style={styles.safetyIcon}><Text style={styles.safetyIconText}>!</Text></View><Text style={styles.safetyTitle}>This item is not supported</Text><Text style={styles.safetyDescription}>SNAPTURE cannot provide reliable reuse guidance for this result. Try one clear photo of a supported material.</Text></View><InfoCard title="Identification" items={[identification, `Confidence: ${prediction ? `${Math.round(prediction.confidence * 100)}%` : 'Not available'}`]} />{error ? <Text style={styles.authError}>{error}</Text> : null}<PrimaryButton label="Try another item" onPress={onRetry} /></SimplePage>;
  }
  return <SimplePage title="Safety check" onBack={onBack}><View style={styles.safetyCard}><View style={styles.safetyIcon}><Text style={styles.safetyIconText}>OK</Text></View><Text style={styles.safetyTitle}>{title}</Text><Text style={styles.safetyDescription}>This is educational decision support based on the image, model output, and information you provided. It is not a safety certification.</Text></View><InfoCard title="Evidence summary" items={[`Identification: ${identification}`, `Confidence: ${prediction ? `${Math.round(prediction.confidence * 100)}%` : 'Not available'}`, `Condition: ${prediction?.condition || 'User-provided'}`]} /><View style={styles.disclaimer}><Text style={styles.disclaimerText}>{error || 'Do not use this result for food-contact, chemical, structural, or medical decisions.'}</Text></View><PrimaryButton label="View recommendations" onPress={onContinue} /></SimplePage>;
}

function LiveRecommendationsScreen({ prediction, selected, setSelected, quantity, setQuantity, busy, error, onBack, onSave, onRetry }: { prediction: Prediction | null; selected: string; setSelected: (value: string) => void; quantity: string; setQuantity: (value: string) => void; busy: boolean; error: string; onBack: () => void; onSave: () => void; onRetry: () => void }) {
  if (!isSupportedPrediction(prediction)) {
    return <SimplePage title="Try another item" onBack={onRetry}><View style={styles.safetyCard}><View style={styles.safetyIcon}><Text style={styles.safetyIconText}>!</Text></View><Text style={styles.safetyTitle}>No reuse choices available</Text><Text style={styles.safetyDescription}>This result is not a supported SNAPTURE material, so recommendations are not available.</Text></View><PrimaryButton label="Try another item" onPress={onRetry} /></SimplePage>;
  }
  const quantityLabel = quantity ? `${quantity} item${quantity === '1' ? '' : 's'}` : 'your items';
  const options = prediction?.recommendation_choices || [];
  return <SimplePage title="Recommendations" onBack={onBack}><View style={styles.recommendationBanner}><Text style={styles.bannerIcon}>Idea</Text><View style={styles.bannerCopy}><Text style={styles.bannerTitle}>Choose what fits your goal</Text><Text style={styles.bannerSubtitle}>Options are adjusted for {quantityLabel}.</Text></View></View><View style={styles.optionalPanel}><Text style={styles.optionalLabel}>How much do you have? <Text style={styles.optionalHint}>(optional)</Text></Text><View style={styles.quantityChoices}>{[['1', 'One'], ['3', 'A few'], ['10', 'Many']].map(([value, label]) => <Pressable key={value} onPress={() => setQuantity(value)} style={[styles.quantityChoice, quantity === value && styles.quantityChoiceSelected]}><Text style={[styles.quantityChoiceText, quantity === value && styles.quantityChoiceTextSelected]}>{label}</Text></Pressable>)}</View><Text style={styles.optionalHint}>You can continue with the default. The amount only changes the project guidance.</Text></View>{error ? <Text style={styles.authError}>{error}</Text> : null}<Text style={styles.sectionTitle}>Reuse and upcycling choices</Text>{options.map((recommendation) => <Pressable key={recommendation.id} style={[styles.recommendationCard, selected === recommendation.id && styles.recommendationSelected]} onPress={() => setSelected(recommendation.id)}><View style={styles.projectIcon}><Text style={styles.projectIconText}>Idea</Text></View><View style={styles.projectCopy}><Text style={styles.projectTitle}>{recommendation.title}</Text><Text style={styles.projectDescription}>{recommendation.summary}</Text><Text style={styles.projectMaterials}>{recommendation.materials.join(' | ')}</Text>{recommendation.quantity_note ? <Text style={styles.projectQuantity}>{recommendation.quantity_note}</Text> : null}</View><Text style={styles.radio}>{selected === recommendation.id ? 'Selected' : 'Choose'}</Text></Pressable>)}{options.length === 0 ? <Text style={styles.questionIntro}>No recommendations were returned for this result. Retake the photo or choose another item.</Text> : null}<PrimaryButton label={busy ? 'Saving...' : selected ? 'Save selected project' : 'Choose a project'} onPress={onSave} disabled={busy || !selected} /></SimplePage>;
}

/* Legacy history screen replaced by the private history implementation below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyHistoryScreen({ navigate }: { navigate: (next: Screen) => void }) {
  const [records, setRecords] = useState<PredictionSummary[]>([]);
  const [error, setError] = useState('');
  React.useEffect(() => {
    listPredictions().then(setRecords).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load history.'));
  }, []);
  return <View style={styles.appPage}><ScrollView contentContainerStyle={styles.pageContent}><Text style={styles.pageTitle}>History</Text><Text style={styles.pageSubtitle}>Your previous identification results.</Text>{error ? <Text style={styles.authError}>{error}</Text> : null}{records.length === 0 && !error ? <View style={styles.emptyState}><Text style={styles.emptyIcon}>◷</Text><Text style={styles.emptyTitle}>No saved scans yet</Text><Text style={styles.emptyText}>Analyze an object to see it here.</Text><PrimaryButton label="Scan an object" onPress={() => navigate('camera')} /></View> : records.map((record) => <View style={styles.historyRow} key={record.id}><View style={styles.historyIcon}><Text>♧</Text></View><View style={styles.historyCopy}><Text style={styles.historyTitle}>{record.title}</Text><Text style={styles.historyMeta}>{new Date(record.created_at).toLocaleString()} · {Math.round(record.confidence * 100)}% confidence</Text></View><Text style={styles.chevron}>›</Text></View>)}</ScrollView><BottomNav active="history" navigate={navigate} /></View>;
}

*/

function HistoryScreen({ navigate }: { navigate: (next: Screen) => void }) {
  const [records, setRecords] = useState<PredictionSummary[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadHistory = () => {
    setError('');
    listPredictions().then(setRecords).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load your history.'));
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const removeRecord = (id: number) => {
    Alert.alert('Delete this scan?', 'The saved image, result, and answers will be permanently removed from your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          await deletePrediction(id);
          setRecords((current) => current.filter((record) => record.id !== id));
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'Unable to delete this scan.');
        } finally {
          setBusy(false);
        }
      } },
    ]);
  };

  const clearHistory = () => {
    if (!records.length) return;
    Alert.alert('Clear all scans?', 'This permanently deletes your saved images, results, and answers. Other users are not affected.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          await deleteAllPredictions();
          setRecords([]);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'Unable to clear your history.');
        } finally {
          setBusy(false);
        }
      } },
    ]);
  };

  return <View style={styles.appPage}><ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
    <View style={styles.pageHeaderRow}><View><Text style={styles.pageTitle}>My scans</Text><Text style={styles.pageSubtitle}>Only you can see these saved identification results.</Text></View>{records.length ? <Pressable onPress={clearHistory} disabled={busy}><Text style={styles.deleteLink}>Clear all</Text></Pressable> : null}</View>
    {error ? <Text style={styles.authError}>{error}</Text> : null}
    <View style={styles.privacyNotice}><Text style={styles.privacyNoticeTitle}>Your history is private</Text><Text style={styles.privacyNoticeText}>Scans stay attached to your account until you choose to delete them.</Text></View>
    {records.length === 0 && !error ? <View style={styles.emptyState}><Text style={styles.emptyIcon}>Scan</Text><Text style={styles.emptyTitle}>No saved scans yet</Text><Text style={styles.emptyText}>Analyze an object to see your private history here.</Text><PrimaryButton label="Scan an object" onPress={() => navigate('camera')} /></View> : records.map((record) => <View style={styles.historyRow} key={record.id}><View style={styles.historyIcon}><Text style={styles.historyIconText}>AI</Text></View><View style={styles.historyCopy}><Text style={styles.historyTitle}>{record.title}</Text><Text style={styles.historyMeta}>{new Date(record.created_at).toLocaleString()} - {Math.round(record.confidence * 100)}% model confidence</Text></View><Pressable onPress={() => removeRecord(record.id)} disabled={busy} hitSlop={8}><Text style={styles.deleteLink}>Delete</Text></Pressable></View>)}
  </ScrollView><BottomNav active="history" navigate={navigate} /></View>;
}

/* Legacy projects prototype retained only in history.
// Legacy empty-project prototype retained for comparison.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ProjectsScreen({ navigate }: { navigate: (next: Screen) => void }) {
  return <View style={styles.appPage}><ScrollView contentContainerStyle={styles.pageContent}><Text style={styles.pageTitle}>Projects</Text><Text style={styles.pageSubtitle}>Reuse ideas you decided to keep.</Text><View style={styles.emptyState}><Text style={styles.emptyIcon}>✿</Text><Text style={styles.emptyTitle}>Your projects will appear here</Text><Text style={styles.emptyText}>Choose a recommendation after scanning an item.</Text><PrimaryButton label="Scan an object" onPress={() => navigate('camera')} /></View></ScrollView><BottomNav active="projects" navigate={navigate} /></View>;
}

*/

/* Legacy profile prototype replaced by the clearer profile screen below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyMoreScreen({ navigate, onLogout, user }: { navigate: (next: Screen) => void; onLogout: () => void; user: ApiUser | null }) {
  return <View style={styles.appPage}><ScrollView contentContainerStyle={styles.pageContent}><Text style={styles.pageTitle}>More</Text><Text style={styles.pageSubtitle}>Manage your SNAPTURE experience.</Text><View style={styles.profileCard}><View style={styles.largeAvatar}><Text style={styles.avatarText}>{(user?.display_name || 'J').charAt(0).toUpperCase()}</Text></View><View><Text style={styles.profileName}>{user?.display_name || 'SNAPTURE user'}</Text><Text style={styles.profileMeta}>{user?.role === 'admin' ? 'Administrator' : 'Regular user'}</Text></View></View>{['Profile settings', 'Privacy and data', 'Help and limitations', 'Log out'].map((item) => <Pressable key={item} style={styles.settingsRow} onPress={() => item === 'Log out' && onLogout()}><Text style={styles.settingsText}>{item}</Text><Text style={styles.chevron}>›</Text></Pressable>)}</ScrollView><BottomNav active="more" navigate={navigate} /></View>;
}

*/

function ProfileScreen({ navigate, onLogout, user }: { navigate: (next: Screen) => void; onLogout: () => void; user: ApiUser | null }) {
  return <View style={styles.appPage}><ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}><Text style={styles.pageTitle}>Profile</Text><Text style={styles.pageSubtitle}>Manage your account and privacy choices.</Text><View style={styles.profileCard}><View style={styles.largeAvatar}><Text style={styles.avatarText}>{(user?.display_name || 'S').charAt(0).toUpperCase()}</Text></View><View><Text style={styles.profileName}>{user?.display_name || 'SNAPTURE user'}</Text><Text style={styles.profileMeta}>{user?.role === 'admin' ? 'Administrator' : 'Regular user'}</Text></View></View><View style={styles.privacyNotice}><Text style={styles.privacyNoticeTitle}>Your data choices</Text><Text style={styles.privacyNoticeText}>Your scans are stored for your account history. You can remove them anytime from My scans. Administrators see anonymized activity by default.</Text></View><Pressable style={styles.settingsRow} onPress={() => navigate('history')}><Text style={styles.settingsText}>Manage my scans</Text><Text style={styles.chevron}>›</Text></Pressable><Pressable style={styles.settingsRow} onPress={() => navigate('materials')}><Text style={styles.settingsText}>Open materials library</Text><Text style={styles.chevron}>›</Text></Pressable><Pressable style={styles.settingsRow} onPress={onLogout}><Text style={styles.logoutText}>Log out</Text><Text style={styles.chevron}>›</Text></Pressable></ScrollView><BottomNav active="more" navigate={navigate} /></View>;
}

function SimplePage({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return <View style={styles.appPage}><ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}><View style={styles.innerHeader}><Pressable onPress={onBack}><Text style={styles.innerBack}>‹</Text></Pressable><Text style={styles.innerTitle}>{title}</Text><View style={styles.headerSpacer} /></View>{children}</ScrollView></View>;
}

function CheckList({ items }: { items: string[] }) {
  return <View style={styles.checkList}>{items.map((item) => <View style={styles.checkRow} key={item}><View style={styles.checkCircle}><Text style={styles.checkMark}>✓</Text></View><Text style={styles.checkText}>{item}</Text></View>)}</View>;
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return <View style={styles.infoCard}><Text style={styles.infoTitle}>{title}</Text>{items.map((item) => <View style={styles.infoRow} key={item}><Text style={styles.infoBullet}>✓</Text><Text style={styles.infoText}>{item}</Text></View>)}</View>;
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable style={[styles.choice, selected && styles.choiceSelected]} onPress={onPress}><View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>{selected && <View style={styles.radioInner} />}</View><Text style={styles.choiceText}>{label}</Text></Pressable>;
}

/* Legacy four-tab navigation replaced by the five-tab navigation below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyBottomNav({ active, navigate }: { active: 'home' | 'history' | 'projects' | 'more'; navigate: (next: Screen) => void }) {
  const items: Array<{ key: 'home' | 'history' | 'projects' | 'more'; label: string; icon: string }> = [{ key: 'home', label: 'Home', icon: '⌂' }, { key: 'history', label: 'History', icon: '◷' }, { key: 'projects', label: 'Projects', icon: '✿' }, { key: 'more', label: 'More', icon: '⋮' }];
  return <View style={styles.bottomNav}>{items.map((item) => <Pressable key={item.key} style={styles.navItem} onPress={() => navigate(item.key)} hitSlop={6} android_ripple={{ color: '#dceee0' }}><Text style={[styles.navIcon, active === item.key && styles.navActive]}>{item.icon}</Text><Text style={[styles.navLabel, active === item.key && styles.navActive]}>{item.label}</Text></Pressable>)}</View>;
}

*/

function BottomNav({ active, navigate }: { active: 'home' | 'materials' | 'history' | 'more'; navigate: (next: Screen) => void }) {
  const { width } = useWindowDimensions();
  const fabSize = Math.max(62, Math.min(74, width * 0.19));
  const items: Array<{ key: 'home' | 'materials' | 'history' | 'more'; title: string; subtitle: string }> = [
    { key: 'home', title: 'Home', subtitle: 'Home' },
    { key: 'materials', title: 'Learn', subtitle: 'Materials' },
    { key: 'history', title: 'My scans', subtitle: 'History' },
    { key: 'more', title: 'Me', subtitle: 'Profile' },
  ];
  return <View style={styles.bottomNav}>
    <Pressable style={styles.navItem} onPress={() => navigate('home')} hitSlop={6} android_ripple={{ color: '#dceee0' }}><Text style={[styles.navTitle, active === 'home' && styles.navActive]}>{items[0].title}</Text><Text style={[styles.navLabel, active === 'home' && styles.navActive]}>{items[0].subtitle}</Text></Pressable>
    <Pressable style={styles.navItem} onPress={() => navigate('materials')} hitSlop={6} android_ripple={{ color: '#dceee0' }}><Text style={[styles.navTitle, active === 'materials' && styles.navActive]}>{items[1].title}</Text><Text style={[styles.navLabel, active === 'materials' && styles.navActive]}>{items[1].subtitle}</Text></Pressable>
    <Pressable style={[styles.scanFab, { width: fabSize, height: fabSize, marginTop: -fabSize * 0.4 }]} onPress={() => navigate('camera')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Scan an object"><Image source={CAMERA_BADGE} resizeMode="contain" style={styles.scanFabImage} /></Pressable>
    <Pressable style={styles.navItem} onPress={() => navigate('history')} hitSlop={6} android_ripple={{ color: '#dceee0' }}><Text style={[styles.navTitle, active === 'history' && styles.navActive]}>{items[2].title}</Text><Text style={[styles.navLabel, active === 'history' && styles.navActive]}>{items[2].subtitle}</Text></Pressable>
    <Pressable style={styles.navItem} onPress={() => navigate('more')} hitSlop={6} android_ripple={{ color: '#dceee0' }}><Text style={[styles.navTitle, active === 'more' && styles.navActive]}>{items[3].title}</Text><Text style={[styles.navLabel, active === 'more' && styles.navActive]}>{items[3].subtitle}</Text></Pressable>
  </View>;
}

function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable style={[styles.primaryButton, disabled && styles.buttonDisabled]} onPress={onPress} disabled={disabled}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>;
}

function SecondaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable style={[styles.secondaryButton, disabled && styles.buttonDisabled]} onPress={onPress} disabled={disabled}><Text style={styles.secondaryButtonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  leafDecorationTop: { position: 'absolute', top: -24, left: -18, width: 150, height: 110, borderBottomRightRadius: 120, backgroundColor: '#dcedd2', opacity: 0.9 },
  leafDecorationBottom: { position: 'absolute', bottom: -28, right: -30, width: 150, height: 112, borderTopLeftRadius: 120, backgroundColor: '#dcedd2', opacity: 0.68 },
  primaryButton: { minHeight: 52, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 16 },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  buttonDisabled: { opacity: 0.45 },
  secondaryButton: { minHeight: 52, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 12 },
  secondaryButtonText: { color: COLORS.primary, fontWeight: '800', fontSize: 15 },
  textButton: { paddingVertical: 18, zIndex: 2 },
  textButtonLabel: { color: COLORS.muted, fontSize: 13 },
  textButtonStrong: { color: COLORS.primary, fontWeight: '800' },
  authPage: { flexGrow: 1, paddingHorizontal: 5, paddingBottom: 28, backgroundColor: COLORS.background },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#eaf2eb', alignItems: 'center', justifyContent: 'center', marginHorizontal: 15, marginTop: 14, marginBottom: 8 },
  backText: { color: COLORS.primary, fontSize: 13, fontWeight: '800' },
  authBrandBlock: { alignItems: 'center', marginBottom: 18 },
  authBrandBlockLogin: { marginTop: 72 },
  authBrandBlockInner: { marginTop: 0 },
  authLogoBadge: { width: 54, height: 54, borderRadius: 18, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  authLogoIcon: { color: COLORS.primary, fontSize: 24, fontWeight: '900', lineHeight: 27 },
  authBrand: { color: COLORS.primary, fontSize: 22, fontWeight: '900', letterSpacing: 1, marginTop: 10 },
  authTagline: { color: COLORS.primary, fontSize: 12, fontWeight: '700', marginTop: 5 },
  authIntro: { color: COLORS.muted, fontSize: 10, textAlign: 'center', lineHeight: 15, marginTop: 16, maxWidth: 270 },
  adminBrandBlock: { alignItems: 'center', marginTop: 8, marginBottom: 14 },
  adminHeadingBlock: { alignItems: 'center', marginHorizontal: 14, marginBottom: 8 },
  resetHeadingBlock: { alignItems: 'center', marginHorizontal: 14, marginBottom: 4 },
  authTitle: { color: COLORS.text, fontSize: 30, fontWeight: '900' },
  authSubtitle: { color: COLORS.muted, fontSize: 15, textAlign: 'center', marginTop: 8, marginBottom: 28 },
  authError: { color: '#b3261e', fontSize: 13, lineHeight: 19, marginTop: 12 },
  formCard: { backgroundColor: COLORS.background, paddingHorizontal: 13, paddingVertical: 9, marginHorizontal: 0, borderRadius: 0, borderWidth: 0, shadowOpacity: 0, elevation: 0 },
  adminBadge: { alignSelf: 'flex-start', backgroundColor: '#fff4cf', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 14 },
  adminBadgeText: { color: '#8a6912', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  adminSecurityNote: { color: COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 18, paddingHorizontal: 12 },
  inputLabel: { color: COLORS.text, fontSize: 14, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  input: { minHeight: 50, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, paddingHorizontal: 14, color: COLORS.text, backgroundColor: '#fbfdfb' },
  authInputLabel: { fontSize: 12, marginTop: 14, marginBottom: 6 },
  authInput: { minHeight: 46, borderRadius: 11, backgroundColor: '#fbfdfb' },
  resetInfo: { backgroundColor: '#eef7ef', borderRadius: 11, borderWidth: 1, borderColor: '#cce2cf', padding: 11, marginTop: 8 },
  resetInfoText: { color: '#42634c', fontSize: 12, lineHeight: 17 },
  resetSuccess: { backgroundColor: '#eef7ef', borderRadius: 14, borderWidth: 1, borderColor: '#b7dcbf', padding: 16, marginTop: 8 },
  resetSuccessTitle: { color: COLORS.primary, fontSize: 16, fontWeight: '900', marginBottom: 5 },
  resetSuccessText: { color: '#42634c', fontSize: 13, lineHeight: 18 },
  authNotice: { backgroundColor: '#fff8e5', borderRadius: 11, borderWidth: 1, borderColor: '#ead9a2', padding: 11, marginTop: 12 },
  authNoticeTitle: { color: '#765b13', fontSize: 12, fontWeight: '900', marginBottom: 4 },
  authNoticeText: { color: '#765b13', fontSize: 11, lineHeight: 16 },
  forgotButton: { alignSelf: 'flex-end', paddingVertical: 10, paddingLeft: 12 },
  forgotText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  divider: { flex: 1, height: 1, backgroundColor: COLORS.border },
  orText: { color: COLORS.muted, fontSize: 13 },
  appPage: { flex: 1, backgroundColor: COLORS.background },
  pageContent: { padding: 20, paddingBottom: 96 },
  dashboardPageContent: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 94 },
  adminHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  adminEyebrow: { color: '#8a6912', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 4 },
  adminLogout: { borderWidth: 1, borderColor: '#e3b8b2', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, marginTop: 4 },
  adminLogoutText: { color: '#b3261e', fontSize: 11, fontWeight: '800' },
  adminMetricGrid: { flexDirection: 'row', gap: 10, marginBottom: 5 },
  adminMetricCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 14, minHeight: 92, justifyContent: 'space-between' },
  adminMetricValue: { color: COLORS.primary, fontSize: 26, fontWeight: '900' },
  adminMetricLabel: { color: COLORS.muted, fontSize: 11, lineHeight: 15 },
  adminSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 11 },
  categoryTotals: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 12 },
  categoryTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  categoryTotalName: { color: COLORS.text, fontSize: 12, textTransform: 'capitalize' },
  categoryTotalValue: { color: COLORS.primary, fontSize: 12, fontWeight: '900' },
  adminRecord: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  adminRecordIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#e6f4df', alignItems: 'center', justifyContent: 'center' },
  adminRecordIconText: { color: COLORS.primary, fontWeight: '900', fontSize: 12 },
  adminRecordAction: { color: COLORS.primary, fontSize: 11, fontWeight: '900' },
  adminDetailCard: { backgroundColor: '#eef8ef', borderRadius: 18, borderWidth: 1, borderColor: '#b7dcbf', padding: 16, marginTop: 14 },
  adminDetailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  adminDetailNote: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 12 },
  adminErrorCard: { backgroundColor: '#fff1ef', borderRadius: 16, borderWidth: 1, borderColor: '#f1c2bd', padding: 14, marginBottom: 12 },
  privacyNotice: { backgroundColor: '#eef7ef', borderRadius: 16, borderWidth: 1, borderColor: '#cce2cf', padding: 14, marginBottom: 15 },
  privacyNoticeTitle: { color: COLORS.primary, fontSize: 13, fontWeight: '900', marginBottom: 4 },
  privacyNoticeText: { color: '#42634c', fontSize: 12, lineHeight: 18 },
  homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  homeHeaderCopy: { flex: 1, minWidth: 0, paddingRight: 8 },
  smallGreeting: { color: COLORS.muted, fontSize: 10 },
  homeTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginTop: 4 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f1db91', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.primary, fontWeight: '900' },
  scanCard: { backgroundColor: COLORS.primary, borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', minHeight: 114 },
  scanIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#e6f4df', alignItems: 'center', justifyContent: 'center' },
  scanIconText: { color: COLORS.primary, fontSize: 28 },
  scanCopy: { flex: 1, marginHorizontal: 13 },
  scanTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  scanSubtitle: { color: '#d9f0de', fontSize: 12, lineHeight: 17, marginTop: 4 },
  arrowCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  arrow: { color: COLORS.primary, fontSize: 21, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 11 },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  viewAll: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  searchInput: { minHeight: 48, borderRadius: 14, paddingHorizontal: 15, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, color: COLORS.text },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16, marginTop: 14 },
  categoryItem: { width: '24%', alignItems: 'center' },
  categoryIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  categoryIconText: { color: COLORS.primary, fontSize: 25 },
  categoryName: { color: COLORS.text, fontSize: 10, textAlign: 'center', marginTop: 5, lineHeight: 13 },
  categoryAction: { color: COLORS.primary, fontSize: 9, fontWeight: '800', marginTop: 4 },
  dashboardSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, marginBottom: 10 },
  dashboardSectionTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900' },
  dashboardViewAll: { color: COLORS.primary, fontSize: 9, fontWeight: '900' },
  dashboardCategoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 4 },
  dashboardCategoryItem: { width: '30%', alignItems: 'center', minHeight: 82 },
  dashboardCategoryIcon: { width: 50, height: 50, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dashboardCategoryName: { color: COLORS.text, fontSize: 9, fontStyle: 'italic', textAlign: 'center', marginTop: 4, lineHeight: 11 },
  dashboardCategoryAction: { color: COLORS.primary, fontSize: 8, fontWeight: '900', marginTop: 2 },
  dashboardRecentCard: { backgroundColor: COLORS.surface, borderRadius: 13, padding: 9, minHeight: 74, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  dashboardRecentImage: { width: 45, height: 45, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dashboardRecentCopy: { flex: 1, marginLeft: 9 },
  dashboardRecentTitle: { color: COLORS.text, fontSize: 12, fontWeight: '900' },
  dashboardRecentMeta: { color: COLORS.muted, fontSize: 8, lineHeight: 11, marginTop: 2 },
  dashboardSavedTag: { alignSelf: 'flex-start', color: COLORS.primary, backgroundColor: '#e0f1e3', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 7, fontSize: 8, fontWeight: '800', marginTop: 4 },
  dashboardOpen: { color: COLORS.muted, fontSize: 18, paddingHorizontal: 2 },
  dashboardRecentEmpty: { backgroundColor: COLORS.surface, borderRadius: 13, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  dashboardBottomWash: { position: 'absolute', right: -76, bottom: 42, width: 220, height: 128, borderTopLeftRadius: 180, backgroundColor: '#e5f3de', opacity: 0.5 },
  materialList: { marginTop: 16 },
  materialListCard: { backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, padding: 13, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  materialListCopy: { flex: 1, marginHorizontal: 12 },
  materialListTitle: { color: COLORS.text, fontSize: 15, fontWeight: '900' },
  materialListDescription: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  libraryNote: { color: '#77621d', backgroundColor: '#fff6d8', borderRadius: 12, padding: 11, fontSize: 12, lineHeight: 17, marginTop: 12 },
  privacyHint: { color: COLORS.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 12, paddingHorizontal: 10 },
  guideHero: { backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 16, flexDirection: 'row', alignItems: 'center' },
  guideIcon: { width: 62, height: 62, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  guideHeroCopy: { flex: 1, marginLeft: 13 },
  guideTitle: { color: COLORS.text, fontSize: 20, fontWeight: '900' },
  guideDescription: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  guideStatus: { backgroundColor: '#fff6d8', borderRadius: 15, padding: 13, marginTop: 14 },
  guideStatusTitle: { color: '#77621d', fontSize: 12, fontWeight: '900' },
  guideStatusText: { color: '#77621d', fontSize: 12, lineHeight: 17, marginTop: 4 },
  guideSectionTitle: { marginTop: 20, marginBottom: 4 },
  recentCard: { backgroundColor: COLORS.surface, borderRadius: 17, padding: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  recentEmpty: { backgroundColor: COLORS.surface, borderRadius: 17, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  recentEmptyTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900' },
  recentImage: { width: 62, height: 62, borderRadius: 14, backgroundColor: '#e6f4df', alignItems: 'center', justifyContent: 'center' },
  recentImageText: { fontSize: 31, color: COLORS.primary },
  recentCopy: { flex: 1, marginLeft: 12 },
  recentTitle: { color: COLORS.text, fontSize: 15, fontWeight: '900' },
  recentMeta: { color: COLORS.muted, fontSize: 11, marginTop: 4 },
  supportedTag: { alignSelf: 'flex-start', color: COLORS.primary, backgroundColor: '#e0f1e3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, fontSize: 10, fontWeight: '800', marginTop: 7 },
  verificationTag: { color: '#8a6912', backgroundColor: '#fff1c9' },
  chevron: { color: COLORS.muted, fontSize: 28, paddingHorizontal: 5 },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, minHeight: 62, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', paddingTop: 7, zIndex: 20, elevation: 20 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', minHeight: 54, paddingHorizontal: 2 },
  navTitle: { color: '#8b9a91', fontSize: 17, lineHeight: 20 },
  navIcon: { color: '#8b9a91', fontSize: 22 },
  navLabel: { color: '#8b9a91', fontSize: 9, marginTop: 2 },
  navActive: { color: COLORS.primary, fontWeight: '900' },
  scanFab: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center', marginTop: -28, zIndex: 30, elevation: 30 },
  scanFabImage: { width: '100%', height: '100%' },
  cameraPage: { flex: 1, backgroundColor: '#08150f' },
  cameraPermissionPage: { flex: 1, backgroundColor: '#08150f', padding: 24, justifyContent: 'center' },
  cameraPermissionTitle: { color: '#fff', fontSize: 25, fontWeight: '900', marginTop: 25 },
  cameraPermissionText: { color: '#d7e6dc', fontSize: 15, lineHeight: 22, marginTop: 12 },
  cameraHeader: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cameraHeaderIcon: { color: '#fff', fontSize: 28 },
  cameraBackIcon: { color: '#fff', fontSize: 42, lineHeight: 38, fontWeight: '300' },
  cameraHeaderTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  flashIconWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  flashIcon: { color: '#fff', fontSize: 36, lineHeight: 40, fontWeight: '900' },
  flashIconActive: { color: '#ffd21f' },
  flashAutoLetter: { position: 'absolute', right: 0, bottom: 0, color: '#fff', fontSize: 16, lineHeight: 18, fontWeight: '900' },
  cameraPreview: { flex: 1, marginHorizontal: 18, borderRadius: 24, backgroundColor: '#34483d', borderWidth: 1, borderColor: '#92b29e', alignItems: 'center', justifyContent: 'center' },
  cameraOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  flashStatus: { position: 'absolute', top: 22, alignSelf: 'center', color: '#fff', fontSize: 16, fontWeight: '700', zIndex: 3 },
  cameraGuide: { width: '72%', height: '62%', borderWidth: 2, borderColor: '#fff', borderRadius: 20, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  cameraGuideText: { color: '#fff', textAlign: 'center', fontWeight: '800', paddingHorizontal: 18 },
  cameraHint: { position: 'absolute', bottom: 18, color: '#f4f8f4', fontSize: 12, backgroundColor: '#0009', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  cameraControls: { minHeight: 136, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  cameraError: { color: '#ffd7d2', textAlign: 'center', fontSize: 12, paddingHorizontal: 24, paddingTop: 8 },
  galleryButton: { alignItems: 'center', width: 90 },
  galleryIcon: { color: '#fff', fontSize: 18 },
  controlLabel: { color: '#c9d7ce', fontSize: 11, marginTop: 5 },
  shutterGroup: { alignItems: 'center', justifyContent: 'center' },
  photoModeLabel: { color: '#ffd21f', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  cameraSwitchButton: { alignItems: 'center', justifyContent: 'center', width: 90, minHeight: 78 },
  cameraSwitchIcon: { color: '#fff', fontSize: 38, lineHeight: 42, fontWeight: '400' },
  shutterOuter: { width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  cameraFootnote: { color: '#a9c1b1', fontSize: 11, textAlign: 'center', paddingHorizontal: 30, paddingBottom: 10 },
  innerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  innerBack: { fontSize: 35, color: COLORS.primary, lineHeight: 35 },
  innerTitle: { flex: 1, color: COLORS.text, fontSize: 20, fontWeight: '900', marginLeft: 12 },
  headerSpacer: { width: 30 },
  photoPlaceholder: { height: 230, backgroundColor: '#e5eee8', borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  photoPreview: { width: '100%', height: '100%', borderRadius: 20 },
  photoBottle: { color: COLORS.primary, fontSize: 78 },
  photoLabel: { color: COLORS.muted, fontSize: 12, marginTop: 5 },
  goodBadge: { position: 'absolute', right: 12, bottom: 12, backgroundColor: '#e0f1e3', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  goodBadgeText: { color: COLORS.primary, fontWeight: '800', fontSize: 11 },
  checkList: { backgroundColor: COLORS.surface, borderRadius: 18, padding: 16, marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 7 },
  checkCircle: { width: 21, height: 21, borderRadius: 11, backgroundColor: '#e0f1e3', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  checkMark: { color: COLORS.primary, fontSize: 13, fontWeight: '900' },
  checkText: { color: COLORS.text, fontSize: 13, flex: 1 },
  resultCard: { backgroundColor: COLORS.surface, borderRadius: 18, padding: 14, flexDirection: 'row', borderWidth: 1, borderColor: COLORS.border },
  photoSmall: { width: 85, height: 85, borderRadius: 15, backgroundColor: '#e5eee8', alignItems: 'center', justifyContent: 'center' },
  resultCopy: { flex: 1, marginLeft: 13, justifyContent: 'center' },
  resultName: { color: COLORS.text, fontSize: 18, fontWeight: '900' },
  resultConfidence: { color: COLORS.muted, fontSize: 12, marginTop: 5 },
  infoCard: { backgroundColor: COLORS.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginTop: 14 },
  infoTitle: { color: COLORS.text, fontSize: 15, fontWeight: '900', marginBottom: 7 },
  infoRow: { flexDirection: 'row', marginVertical: 5 },
  infoBullet: { color: COLORS.secondary, fontWeight: '900', marginRight: 8 },
  infoText: { color: COLORS.text, fontSize: 13, flex: 1, lineHeight: 18 },
  questionIntro: { color: COLORS.muted, lineHeight: 20, marginBottom: 3 },
  choiceList: { gap: 8 },
  choice: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' },
  choiceSelected: { borderColor: COLORS.secondary, backgroundColor: '#eaf5eb' },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#99aaa0', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  radioOuterSelected: { borderColor: COLORS.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  choiceText: { color: COLORS.text, fontSize: 13 },
  safetyCard: { backgroundColor: '#e8f5e9', borderRadius: 21, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: '#b7dcbf' },
  safetyIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  safetyIconText: { color: '#fff', fontSize: 28, fontWeight: '900' },
  safetyTitle: { color: COLORS.primary, fontSize: 19, fontWeight: '900', marginTop: 12 },
  safetyDescription: { color: '#42634c', textAlign: 'center', lineHeight: 19, marginTop: 8 },
  disclaimer: { backgroundColor: '#fff6d8', borderRadius: 16, padding: 15, marginTop: 14 },
  disclaimerText: { color: '#77621d', lineHeight: 19, fontSize: 12 },
  recommendationBanner: { backgroundColor: COLORS.primary, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  bannerIcon: { color: '#fff', fontSize: 30, marginRight: 12 },
  bannerCopy: { flex: 1 },
  bannerTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  bannerSubtitle: { color: '#d7efdc', fontSize: 12, marginTop: 4 },
  recommendationCard: { backgroundColor: COLORS.surface, borderRadius: 18, padding: 13, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginTop: 10 },
  recommendationSelected: { borderColor: COLORS.secondary, backgroundColor: '#f0f9f1' },
  projectIcon: { width: 53, height: 53, borderRadius: 16, backgroundColor: '#e2f1e5', alignItems: 'center', justifyContent: 'center' },
  projectIconText: { color: COLORS.primary, fontSize: 28 },
  projectCopy: { flex: 1, marginHorizontal: 11 },
  projectTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900' },
  projectDescription: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  projectMaterials: { color: COLORS.primary, fontSize: 10, marginTop: 6 },
  projectQuantity: { color: COLORS.muted, fontSize: 10, lineHeight: 14, marginTop: 4 },
  optionalPanel: { backgroundColor: '#f4f8f4', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  optionalLabel: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  optionalHint: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 6 },
  quantityChoices: { flexDirection: 'row', gap: 8, marginTop: 10 },
  quantityChoice: { flex: 1, minHeight: 40, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  quantityChoiceSelected: { borderColor: COLORS.secondary, backgroundColor: '#eaf5eb' },
  quantityChoiceText: { color: COLORS.muted, fontSize: 12, fontWeight: '800' },
  quantityChoiceTextSelected: { color: COLORS.primary },
  radio: { color: COLORS.primary, fontSize: 20 },
  pageTitle: { color: COLORS.text, fontSize: 28, fontWeight: '900', marginTop: 12 },
  pageSubtitle: { color: COLORS.muted, fontSize: 14, marginTop: 6, marginBottom: 22 },
  pageHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  deleteLink: { color: '#b3261e', fontSize: 12, fontWeight: '900', paddingVertical: 14, paddingLeft: 12 },
  historyRow: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  historyIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#e5eee8', alignItems: 'center', justifyContent: 'center' },
  historyIconText: { color: COLORS.primary, fontSize: 11, fontWeight: '900' },
  historyCopy: { flex: 1, marginLeft: 12 },
  historyTitle: { color: COLORS.text, fontWeight: '900', fontSize: 14 },
  historyMeta: { color: COLORS.muted, fontSize: 11, marginTop: 4 },
  emptyState: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginTop: 8 },
  savedProjectCard: { backgroundColor: '#e8f5e9', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#b7dcbf', marginTop: 8 },
  savedProjectTag: { color: COLORS.secondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  savedProjectTitle: { color: COLORS.primary, fontSize: 22, fontWeight: '900', marginTop: 10 },
  savedProjectText: { color: '#42634c', fontSize: 13, lineHeight: 19, marginTop: 7 },
  emptyIcon: { color: COLORS.secondary, fontSize: 44 },
  emptyTitle: { color: COLORS.text, fontSize: 17, fontWeight: '900', marginTop: 12 },
  emptyText: { color: COLORS.muted, textAlign: 'center', lineHeight: 19, marginTop: 7 },
  profileCard: { backgroundColor: COLORS.surface, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 15 },
  largeAvatar: { width: 55, height: 55, borderRadius: 28, backgroundColor: '#f1db91', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  profileName: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  profileMeta: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  settingsRow: { backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, minHeight: 54, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingsText: { color: COLORS.text, fontSize: 14 },
  logoutText: { color: '#b3261e', fontSize: 14, fontWeight: '800' },
  infoTitleSpacing: { marginTop: 16 },
});

export default App;
