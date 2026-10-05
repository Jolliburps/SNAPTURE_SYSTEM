import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Camera, ChevronRight, LogOut, UserRound } from 'lucide-react-native';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';

import { updateMyProfile, uploadProfilePicture, type ApiUser } from './api';

type Props = { user: ApiUser | null; onUserChange: (user: ApiUser) => void; onBack: () => void; onLogout: () => void };

const GREEN = '#176b45';
const TEXT = '#1c3027';
const MUTED = '#708178';
const LINE = '#dce9df';

export default function SettingsPage({ user, onUserChange, onBack, onLogout }: Props) {
  const [name, setName] = useState(user?.display_name && user.display_name !== user.email ? user.display_name : '');
  const [nameBusy, setNameBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<Asset | null>(null);
  const [nameMessage, setNameMessage] = useState('');
  const [photoMessage, setPhotoMessage] = useState('');
  const [nameError, setNameError] = useState('');
  const [photoError, setPhotoError] = useState('');
  useEffect(() => { setName(user?.display_name && user.display_name !== user.email ? user.display_name : ''); }, [user?.display_name, user?.email]);

  const saveName = async () => {
    const trimmed = name.trim();
    setNameError(''); setNameMessage('');
    if (!trimmed || trimmed.length > 120) { setNameError('Enter a name of 1 to 120 characters.'); return; }
    setNameBusy(true);
    try { const response = await updateMyProfile({ display_name: trimmed }); onUserChange(response.user); setNameMessage('Name updated.'); }
    catch (error) { setNameError(error instanceof Error ? error.message : 'Unable to update name.'); }
    finally { setNameBusy(false); }
  };
  const choosePhoto = async () => {
    setPhotoError(''); setPhotoMessage('');
    try {
      const response = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, maxWidth: 1024, maxHeight: 1024, quality: 0.8 });
      if (response.didCancel) return;
      const asset = response.assets?.[0];
      if (!asset?.uri) { setPhotoError(response.errorMessage || 'No image was selected.'); return; }
      setPendingPhoto(asset);
    } catch (error) { setPhotoError(error instanceof Error ? error.message : 'Unable to open photos.'); }
  };
  const savePhoto = async () => {
    if (!pendingPhoto?.uri) return;
    setPhotoBusy(true); setPhotoError(''); setPhotoMessage('');
    try {
      const response = await uploadProfilePicture(pendingPhoto.uri, pendingPhoto.fileName || 'profile.jpg', pendingPhoto.type || 'image/jpeg');
      onUserChange(response.user); setPendingPhoto(null); setPhotoMessage('Profile picture updated.');
    } catch (error) { setPhotoError(error instanceof Error ? error.message : 'Unable to save picture.'); }
    finally { setPhotoBusy(false); }
  };
  const avatarUri = pendingPhoto?.uri || user?.profile_picture_url;

  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <Pressable style={styles.back} onPress={onBack}><ArrowLeft size={20} color={GREEN} /><Text style={styles.backText}>Profile</Text></Pressable>
    <Text style={styles.title}>Settings</Text><Text style={styles.subtitle}>Your account information and preferences.</Text>
    <View style={styles.card}>
      <Text style={styles.heading}>Profile picture</Text>
      <View style={styles.photoRow}><View style={styles.avatar}>{avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatarImage} /> : <UserRound size={29} color={GREEN} />}</View><View style={styles.photoCopy}><Text style={styles.label}>Your photo</Text><Text style={styles.muted}>{pendingPhoto ? 'Preview selected. Save to use it on your profile.' : 'Choose a JPEG, PNG, or WebP image under 5 MB.'}</Text></View></View>
      <Pressable style={styles.secondaryButton} onPress={choosePhoto}><Camera size={17} color={GREEN} /><Text style={styles.secondaryText}>{avatarUri ? 'Change photo' : 'Choose photo'}</Text></Pressable>
      {pendingPhoto ? <Pressable style={styles.primaryButton} onPress={savePhoto} disabled={photoBusy}><Text style={styles.primaryText}>{photoBusy ? 'Uploading…' : 'Save picture'}</Text><ChevronRight size={17} color="#fff" /></Pressable> : null}
      {pendingPhoto ? <Pressable onPress={() => setPendingPhoto(null)}><Text style={styles.cancel}>Cancel selection</Text></Pressable> : null}
      {photoError ? <Text style={styles.error}>{photoError}</Text> : null}{photoMessage ? <Text style={styles.success}>{photoMessage}</Text> : null}
    </View>
    <View style={styles.card}>
      <Text style={styles.heading}>Display name</Text><Text style={styles.muted}>This is shown in SNAPTURE. Your email and sign-in identity stay the same.</Text>
      <TextInput value={name} onChangeText={setName} maxLength={120} autoCapitalize="words" placeholder="Enter your name" placeholderTextColor={MUTED} style={styles.input} />
      <Pressable style={styles.primaryButton} onPress={saveName} disabled={nameBusy}><Text style={styles.primaryText}>{nameBusy ? 'Saving…' : 'Save name'}</Text></Pressable>
      {nameError ? <Text style={styles.error}>{nameError}</Text> : null}{nameMessage ? <Text style={styles.success}>{nameMessage}</Text> : null}
    </View>
    <View style={styles.card}><Text style={styles.heading}>Account information</Text><Text style={styles.label}>Email</Text><Text style={styles.muted}>{user?.email || 'Unavailable'}</Text><Text style={[styles.label, styles.spaced]}>Barangay</Text><Text style={styles.muted}>{user?.barangay || 'Not set — edit from Profile'}</Text></View>
    <Pressable style={styles.logout} onPress={onLogout}><LogOut size={18} color="#a73c30" /><Text style={styles.logoutText}>Log out</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 115 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 40, marginBottom: 10 },
  backText: { color: GREEN, fontSize: 13, fontWeight: '800' },
  title: { color: TEXT, fontSize: 27, fontWeight: '900' },
  subtitle: { color: MUTED, fontSize: 13, marginTop: 5, marginBottom: 18 },
  card: { backgroundColor: '#fff', borderColor: LINE, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  heading: { color: TEXT, fontSize: 16, fontWeight: '900', marginBottom: 8 },
  photoRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  avatar: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#e8f5ec', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 66, height: 66, borderRadius: 33 },
  photoCopy: { flex: 1, marginLeft: 13 },
  label: { color: TEXT, fontSize: 12, fontWeight: '800', marginBottom: 4 },
  spaced: { marginTop: 16 },
  muted: { color: MUTED, fontSize: 11, lineHeight: 17 },
  secondaryButton: { borderColor: GREEN, borderWidth: 1, borderRadius: 12, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  secondaryText: { color: GREEN, fontWeight: '900', fontSize: 12 },
  primaryButton: { backgroundColor: GREEN, borderRadius: 12, minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 10 },
  primaryText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  input: { borderColor: LINE, borderWidth: 1, borderRadius: 12, minHeight: 45, paddingHorizontal: 12, color: TEXT, marginTop: 13 },
  cancel: { textAlign: 'center', color: MUTED, fontSize: 11, padding: 10 },
  error: { color: '#a12622', fontSize: 11, marginTop: 8 },
  success: { color: GREEN, fontSize: 11, marginTop: 8 },
  logout: { minHeight: 50, borderColor: '#eed8d4', borderWidth: 1, borderRadius: 14, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', marginTop: 7 },
  logoutText: { color: '#a73c30', fontSize: 13, fontWeight: '900' },
});
