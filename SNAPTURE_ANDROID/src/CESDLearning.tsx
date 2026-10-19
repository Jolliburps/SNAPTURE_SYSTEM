import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getLearningInformation, type LearningEntry } from './api';

export default function CESDLearning() {
  const [entries, setEntries] = useState<LearningEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setEntries([]);
    getLearningInformation().then(result => { if (active) setEntries(result.entries); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load learning information.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  return <View style={s.section}>
    <Text style={s.title}>CESD reference library</Text>
    <Text style={s.body}>Educational summaries from supplied CESD materials and named cross-checks. These are not live announcements or CESD approval of SNAPTURE.</Text>
    {loading ? <Text style={s.body}>Loading references...</Text> : null}
    {error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)}><Text style={s.link}>Retry references</Text></Pressable></> : null}
    {!loading && !error && !entries.length ? <Text style={s.body}>No published reference information is available yet.</Text> : null}
    {entries.map(entry => <View key={entry.key} style={s.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={entry.title} accessibilityState={{ expanded: selected === entry.key }} onPress={() => setSelected(selected === entry.key ? null : entry.key)}>
        <Text style={s.tag}>{entry.category} - {entry.review_level.replace(/_/g, ' ')}</Text>
        <Text style={s.heading}>{entry.title}</Text><Text style={s.body}>{entry.summary}</Text>
        <Text style={s.link}>{selected === entry.key ? 'Hide details' : 'Read guidance and source'}</Text>
      </Pressable>
      {selected === entry.key ? <View>
        {entry.instructions.map((line, index) => <Text key={index} style={s.body}>{index + 1}. {line}</Text>)}
        <Text style={s.warning}>{entry.warnings}</Text>
        <Text selectable style={s.source}>{entry.source}</Text>
        <Text style={s.source}>Version {entry.version}. {entry.review_note}</Text>
      </View> : null}
    </View>)}
  </View>;
}

const s = StyleSheet.create({
  section: { marginVertical: 16 }, title: { fontSize: 23, fontWeight: '800', color: '#143f30', marginBottom: 8 },
  heading: { fontSize: 17, fontWeight: '700', color: '#143f30', marginVertical: 6 }, body: { fontSize: 14, color: '#35483e', lineHeight: 21, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce9df', borderRadius: 16, padding: 16, marginTop: 12 },
  tag: { fontSize: 12, color: '#57645d' }, source: { fontSize: 12, color: '#57645d', marginTop: 8 },
  warning: { color: '#77451b', lineHeight: 20, marginTop: 10 }, link: { color: '#176b45', fontWeight: '700', paddingVertical: 8 }, error: { color: '#a12020' },
});
