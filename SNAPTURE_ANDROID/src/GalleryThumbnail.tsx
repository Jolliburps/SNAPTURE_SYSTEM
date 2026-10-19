import React, { useEffect, useState } from 'react';
import { AppState, Image, NativeModules, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Images from 'lucide-react-native/icons/images';

export default function GalleryThumbnail({ onPress }: { onPress: () => void }) {
  const [uri, setUri] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try { const latest = await NativeModules.LatestPhoto?.getLatest(); if (active) { setUri(latest || null); setAllowed(Boolean(latest)); } } catch { if (active) setUri(null); }
    };
    refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { active = false; subscription.remove(); };
  }, []);
  const enable = async () => {
    if (Platform.OS !== 'android') return;
    const permissions = Number(Platform.Version) >= 34
      ? [PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES, PermissionsAndroid.PERMISSIONS.READ_MEDIA_VISUAL_USER_SELECTED]
      : [Number(Platform.Version) >= 33 ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE];
    await PermissionsAndroid.requestMultiple(permissions);
    const latest = await NativeModules.LatestPhoto?.getLatest(); setUri(latest || null); setAllowed(Boolean(latest));
  };
  return <View style={s.group}>
    <Pressable accessibilityRole="button" accessibilityLabel="Open gallery" onPress={onPress} style={s.circle}>
      {uri ? <Image source={{ uri }} style={s.image} onError={() => setUri(null)} /> : <Images color="#fff" size={26} />}
    </Pressable>
    {!allowed ? <Pressable accessibilityRole="button" accessibilityLabel="Allow latest photo thumbnail" onPress={() => { enable().catch(() => undefined); }} hitSlop={6}><Text style={s.permission}>Enable preview</Text></Pressable> : null}
  </View>;
}

const s = StyleSheet.create({ group: { width: 90, alignItems: 'center' }, circle: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', backgroundColor: '#23322b' }, image: { width: '100%', height: '100%' }, permission: { color: '#c9d7ce', fontSize: 12, marginTop: 3, paddingVertical: 8, minHeight: 44 } });
