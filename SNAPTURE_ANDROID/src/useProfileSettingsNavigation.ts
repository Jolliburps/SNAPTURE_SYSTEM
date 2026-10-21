import { useCallback, useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import type { MainRoute } from './MainExperience';

const LABELS:Partial<Record<MainRoute,string>>={profile:'Profile',home:'Home',learn:'Learn',waste:'Waste',calendar:'Calendar',ideas:'Ideas',projects:'My projects',saved:'Saved ideas',history:'History'};

/** Uses the existing screen-state router; no extra stack or redirect effect. */
export default function useProfileSettingsNavigation(screen:MainRoute,navigate:(route:MainRoute)=>void) {
  const current=useRef(screen);current.current=screen;
  const origin=useRef<MainRoute>('profile');
  const opening=useRef(false),closing=useRef(false);
  useEffect(()=>{opening.current=false;closing.current=false;},[screen]);
  const openProfileSettings=useCallback(()=>{
    if(current.current==='settings' || opening.current)return;
    origin.current=current.current;
    opening.current=true;
    navigate('settings');
  },[navigate]);
  const closeProfileSettings=useCallback(()=>{
    if(current.current!=='settings' || closing.current)return;
    closing.current=true;
    navigate(origin.current==='settings'?'profile':origin.current);
  },[navigate]);
  useEffect(()=>{
    if(screen!=='settings')return;
    const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{closeProfileSettings();return true;});
    return ()=>subscription.remove();
  },[screen,closeProfileSettings]);
  return {openProfileSettings,closeProfileSettings,backLabel:LABELS[origin.current] || 'Previous screen'};
}
