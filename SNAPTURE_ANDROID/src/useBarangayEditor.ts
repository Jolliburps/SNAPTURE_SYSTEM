import { useEffect, useRef, useState } from 'react';
import { updateMyProfile, type ApiUser } from './api';
import { isBarangay } from './barangaysData';

export default function useBarangayEditor(user: ApiUser | null, onUserChange: (user: ApiUser) => void, showSuccess: (message: string) => void) {
  const [draft, setDraft] = useState(user?.barangay || '');
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const saved = user?.barangay || '';
  useEffect(() => { if (!editing) setDraft(saved); }, [saved, editing]);
  useEffect(() => { setEditing(false); setPickerOpen(false); setError(''); }, [user?.id]);
  const open = () => {
    if (!user || inFlight.current) return;
    if (!editing) setDraft(saved);
    setEditing(true); setPickerOpen(true); setError('');
  };
  const cancel = () => {
    if (inFlight.current) return;
    setDraft(saved); setEditing(false); setPickerOpen(false); setError('');
  };
  const select = (value: string) => { setDraft(value); setPickerOpen(false); setError(''); };
  const save = async () => {
    if (!user || inFlight.current || draft === saved) return;
    if (!isBarangay(draft)) { setError('Choose a barangay from the list.'); return; }
    inFlight.current = true; setSaving(true); setError('');
    try {
      const response = await updateMyProfile({ barangay: draft });
      onUserChange(response.user);
      setDraft(response.user.barangay); setEditing(false);
      showSuccess('Your barangay has been saved.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save barangay.'); }
    finally { inFlight.current = false; setSaving(false); }
  };
  return { saved, draft, editing, pickerOpen, saving, error, open, cancel, select, closePicker: () => setPickerOpen(false), save, canSave: Boolean(user && isBarangay(draft) && draft !== saved && !saving) };
}
