import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createManualPrediction, imageUrl, selectRecommendation, updatePrediction, type Prediction } from './api';
import { useSuccessAlert } from './SuccessAlertDialog';

export const MATERIAL_NAMES: Record<string, string> = {
  pete_bottles: 'PETE bottles', hdpe_containers: 'HDPE containers', cardboard: 'Cardboard',
  paper: 'Paper', fabric_scraps: 'Fabric scraps', dry_untreated_wood_scraps: 'Dry untreated wood scraps',
};

function AssessmentButton({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={[s.button, disabled && s.disabled]}><Text style={s.buttonText}>{title}</Text></Pressable>;
}

export default function AssessmentScreen({ prediction, onChange, onBack, onSaved, onRetry, onManualReset }: {
  prediction: Prediction | null; onChange: (value: Prediction) => void; onBack: () => void;
  onSaved: () => void; onRetry: () => void; onManualReset?: () => void;
}) {
  const { showSuccess, successDialog } = useSuccessAlert();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setAnswers({}); setQuantity(prediction?.quantity ? String(prediction.quantity) : ''); setError('');
  }, [prediction?.id, prediction?.quantity]);
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await operation(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to complete the request.'); }
    finally { setBusy(false); }
  };
  const save = () => run(async () => {
    if (!prediction) return;
    const { condition, previous_contents, ...context } = answers;
    const fields: Record<string, unknown> = { answers: context };
    if (quantity.trim()) fields.quantity = quantity.trim();
    if (condition !== undefined) fields.condition = condition;
    if (previous_contents !== undefined) fields.previous_contents = previous_contents;
    const result = await updatePrediction(prediction.id, fields);
    onChange(result.prediction); setAnswers({});
    showSuccess('Your item details have been saved and the assessment has been updated.');
  });
  const assessment = prediction?.assessment;
  return <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" onPress={onBack}><Text style={s.back}>Back</Text></Pressable>
    <Text style={s.title}>Assess this item</Text>
    {prediction?.image_url ? <Image source={{uri:imageUrl(prediction.image_url)}} resizeMode="contain" style={s.itemImage} accessibilityLabel="Item being assessed" /> : null}
    <Text style={s.body}>Material identity, segregation and project suitability are separate decisions. This is educational support, not a safety certification.</Text>
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {!prediction ? <>
      <Text style={s.heading}>Choose a material manually</Text>
      <Text style={s.body}>Select only what you can identify. Manual selection does not count as an AI prediction.</Text>

      {Object.entries(MATERIAL_NAMES).map(([label, name]) => <AssessmentButton key={label} disabled={busy} title={name} onPress={() => run(async () => { onChange((await createManualPrediction(label)).prediction); })} />)}

    </> : <>
      <View style={s.card}><Text style={s.heading}>1. Material</Text><Text style={s.heading}>{assessment?.material.title || prediction.title}</Text>
        <Text style={s.body}>{assessment?.material.status === 'user_selected' ? 'User-selected material, not AI verification.' : `Model suggestion: ${Math.round(prediction.confidence * 100)}% confidence, not measured accuracy.`}</Text>
        {prediction.experimental_model ? <Text style={s.body}>Experimental model. Independent field accuracy has not been established.</Text> : null}
      </View>
      {(assessment?.questions || []).map(question => <View key={question.id} style={s.card}>
        <Text style={s.heading}>{question.label}</Text>
        {question.options.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: (answers[question.id] ?? assessment?.context[question.id]) === option }} disabled={busy} onPress={() => setAnswers(old => ({ ...old, [question.id]: option }))} style={[s.choice, (answers[question.id] ?? assessment?.context[question.id]) === option && s.selected]}><Text style={s.body}>{MATERIAL_NAMES[option] || option}</Text></Pressable>)}
      </View>)}
      <Text style={s.heading}>How many items do you have?</Text><TextInput accessibilityLabel="Item quantity" keyboardType="number-pad" value={quantity} onChangeText={setQuantity} placeholder="Enter the actual quantity" style={s.input} />
      <AssessmentButton disabled={busy} title={busy ? 'Updating...' : 'Update assessment'} onPress={save} />
      {assessment?.safety ? <View style={s.card}><Text style={s.heading}>{assessment.safety.title}</Text><Text style={s.body}>{assessment.safety.explanation}</Text>
        {assessment.safety.instructions.map((line, index) => <Text key={index} style={s.body}>{index + 1}. {line}</Text>)}
        {assessment.safety.sources.map(source => <Text key={source.key} style={s.source}>{source.source}{'\n'}{source.review_note}</Text>)}
      </View> : null}
      <View style={s.card}><Text style={s.heading}>2. Segregation guidance</Text><Text style={s.status}>{assessment?.segregation.category || assessment?.segregation.status.replace(/_/g, ' ') || 'Not assessed'}</Text>
        <Text style={s.body}>{assessment?.segregation.explanation}</Text>
        {assessment?.segregation.instructions.map((line, i) => <Text key={i} style={s.body}>{i + 1}. {line}</Text>)}
        {assessment?.segregation.sources.map(source => <Text key={source.key} style={s.source}>{source.source}{'\n'}Version {source.version} - {source.review_level.replace(/_/g, ' ')}. {source.review_note}</Text>)}
      </View>
      <View style={s.card}><Text style={s.heading}>3. Reuse and upcycling</Text><Text style={s.status}>{assessment?.upcycling.status.replace(/_/g, ' ') || 'Not assessed'}</Text><Text style={s.body}>{assessment?.upcycling.explanation}</Text>
        {(prediction.recommendation_choices || []).map(project => <View key={project.id} style={s.project}><Text style={s.heading}>{project.title}</Text><Text style={s.body}>{project.summary}</Text><Text style={s.body}>{project.materials.join(', ')}</Text>{project.steps.map((step, i) => <Text key={i} style={s.body}>{i + 1}. {step}</Text>)}<Text style={s.body}>{project.safety_note}</Text><AssessmentButton disabled={busy} title="Save this project" onPress={() => run(async () => { onChange((await selectRecommendation(prediction.id, project.id)).prediction); showSuccess(`“${project.title}” has been saved to your ideas.`, onSaved); })} /></View>)}
      </View>
      <AssessmentButton disabled={busy} title={prediction.input_method === 'manual' ? 'Choose another material' : 'Assess another item'} onPress={prediction.input_method === 'manual' && onManualReset ? onManualReset : onRetry} />
    </>}
    {successDialog}
  </ScrollView>;
}

const s = StyleSheet.create({
  itemImage: { width: '100%', height: 180, backgroundColor: '#edf3ef', borderRadius: 12, marginVertical: 12 },
  page: { padding: 20, paddingBottom: 50, backgroundColor: '#f7f9f5', flexGrow: 1 },
  back: { color: '#176b45', fontSize: 17, paddingVertical: 12 }, title: { fontSize: 26, color: '#143f30', fontWeight: '800' },
  heading: { color: '#143f30', fontSize: 17, fontWeight: '700', marginVertical: 6 }, body: { color: '#35483e', fontSize: 14, lineHeight: 21 },
  card: { padding: 16, borderWidth: 1, borderColor: '#dce9df', borderRadius: 16, backgroundColor: 'white', marginTop: 16 },
  button: { padding: 15, backgroundColor: '#176b45', borderRadius: 12, marginTop: 12 }, buttonText: { color: 'white', fontWeight: '700', textAlign: 'center' },
  choice: { borderWidth: 1, borderColor: '#dce9df', padding: 13, borderRadius: 10, marginTop: 8 }, selected: { backgroundColor: '#e8f5ec', borderColor: '#176b45' },
  input: { borderWidth: 1, borderColor: '#a5b9ac', color: '#143f30', padding: 12, borderRadius: 10, marginTop: 8 },
  error: { color: '#a12020', paddingVertical: 10 }, status: { color: '#176b45', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  source: { color: '#57645d', fontSize: 12, marginTop: 10 }, project: { marginTop: 16, borderTopWidth: 1, borderColor: '#dce9df', paddingTop: 10 }, disabled: { opacity: 0.6 },
});
