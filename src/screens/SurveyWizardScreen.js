import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSync } from '../context/SyncContext';
import { Button } from '../components/ui';
import { getHousehold, getSurvey, getVoter, saveSurveyResponse } from '../db/repo';
import { colors, radius, space, type } from '../theme';

// Question types supported (set by the admin on the server):
//   single  – pick one option      multi – pick any options
//   number  – numeric answer        text  – free text
export default function SurveyWizardScreen({ route, navigation }) {
  const { surveyId, voterId, householdId } = route.params;
  const { notifyLocalChange } = useSync();
  const [survey, setSurvey] = useState(null);
  const [who, setWho] = useState('');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setSurvey(await getSurvey(surveyId));
      if (voterId) {
        const v = await getVoter(voterId);
        if (v) setWho(`${v.serial_no}. ${v.name}`);
      } else if (householdId) {
        const h = await getHousehold(householdId);
        if (h) setWho(`Family ${h.family_code}`);
      }
    })();
  }, [surveyId, voterId, householdId]);

  useLayoutEffect(() => {
    if (survey) navigation.setOptions({ title: survey.title });
  }, [navigation, survey]);

  if (!survey) return null;
  const questions = survey.questions;
  const total = questions.length;
  const onReview = step >= total;
  const q = questions[step];

  function setAnswer(value) {
    setError(null);
    setAnswers((a) => ({ ...a, [q.id]: value }));
  }

  function isEmpty(value) {
    return value == null || value === '' || (Array.isArray(value) && value.length === 0);
  }

  function next() {
    if (q.required && isEmpty(answers[q.id])) return setError('This question needs an answer.');
    setError(null);
    setStep(step + 1);
  }

  async function save() {
    setSaving(true);
    try {
      await saveSurveyResponse({ surveyId, voterId, householdId, answers });
      notifyLocalChange();
      Alert.alert('Survey saved', 'It will be sent to the office at the next sync.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not save the survey', e.message);
    } finally {
      setSaving(false);
    }
  }

  const pct = Math.round((Math.min(step, total) / total) * 100);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.progressWrap}>
        <Text style={styles.who}>{who}</Text>
        <Text style={styles.stepText}>{onReview ? 'Check the answers' : `Question ${step + 1} of ${total}`}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${onReview ? 100 : pct}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
        {onReview ? (
          questions.map((item, i) => (
            <Pressable key={item.id} style={styles.review} onPress={() => setStep(i)}>
              <Text style={styles.reviewQ}>{item.text}</Text>
              <Text style={styles.reviewA}>{formatAnswer(answers[item.id])}</Text>
              <Text style={styles.reviewEdit}>Tap to change</Text>
            </Pressable>
          ))
        ) : (
          <>
            <Text style={styles.question}>{q.text}</Text>
            {!q.required ? <Text style={styles.optional}>Optional</Text> : null}
            <QuestionInput question={q} value={answers[q.id]} onChange={setAnswer} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        )}
      </ScrollView>

      <View style={styles.bottom}>
        {step > 0 ? (
          <Button title="Back" variant="secondary" onPress={() => setStep(step - 1)} style={{ flex: 1, marginRight: space.md }} />
        ) : null}
        {onReview ? (
          <Button title="Save survey" icon="check" variant="success" onPress={save} loading={saving} style={{ flex: 2 }} />
        ) : (
          <Button title={step === total - 1 ? 'Review answers' : 'Next'} onPress={next} style={{ flex: 2 }} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function formatAnswer(v) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return 'Not answered';
  return Array.isArray(v) ? v.join(', ') : String(v);
}

function QuestionInput({ question, value, onChange }) {
  const { type: qType, options = [] } = question;

  if (qType === 'single' || qType === 'multi') {
    const multi = qType === 'multi';
    const selected = multi ? value || [] : value;
    return options.map((opt) => {
      const on = multi ? selected.includes(opt) : selected === opt;
      const toggle = () => {
        if (!multi) return onChange(opt);
        onChange(on ? selected.filter((x) => x !== opt) : [...selected, opt]);
      };
      return (
        <Pressable key={opt} onPress={toggle} style={[styles.option, on && styles.optionOn]} accessibilityState={{ selected: on }}>
          <Feather
            name={multi ? (on ? 'check-square' : 'square') : on ? 'check-circle' : 'circle'}
            size={22}
            color={on ? colors.primary : colors.muted}
          />
          <Text style={[styles.optionText, on && { color: colors.primary }]}>{opt}</Text>
        </Pressable>
      );
    });
  }

  return (
    <TextInput
      value={value == null ? '' : String(value)}
      onChangeText={(t) => onChange(qType === 'number' ? t.replace(/[^\d]/g, '') : t)}
      keyboardType={qType === 'number' ? 'number-pad' : 'default'}
      multiline={qType === 'text'}
      placeholder={qType === 'number' ? 'Enter a number' : 'Type the answer'}
      placeholderTextColor={colors.muted}
      style={[styles.input, qType === 'text' && { minHeight: 120, textAlignVertical: 'top' }]}
    />
  );
}

const styles = StyleSheet.create({
  progressWrap: { backgroundColor: colors.surface, padding: space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  who: { ...type.small, color: colors.ink, fontWeight: '700' },
  stepText: { ...type.tiny, color: colors.muted, marginTop: 2, marginBottom: space.sm },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.bg, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.primary, borderRadius: 4 },
  question: { ...type.title, color: colors.ink, marginBottom: space.xs, lineHeight: 30 },
  optional: { ...type.small, color: colors.muted, marginBottom: space.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginTop: space.md,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { ...type.body, color: colors.ink, marginLeft: space.md, fontWeight: '600', flex: 1 },
  input: {
    marginTop: space.md,
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: space.md,
    ...type.body,
    color: colors.ink,
  },
  error: { ...type.small, color: colors.danger, fontWeight: '600', marginTop: space.md },
  review: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, marginBottom: space.md },
  reviewQ: { ...type.small, color: colors.muted },
  reviewA: { ...type.body, color: colors.ink, fontWeight: '700', marginTop: space.xs },
  reviewEdit: { ...type.tiny, color: colors.primary, marginTop: space.xs, fontWeight: '600' },
  bottom: { flexDirection: 'row', padding: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.bg },
});
