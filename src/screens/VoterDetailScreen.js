import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSync } from '../context/SyncContext';
import { useLiveData } from '../components/useLiveData';
import { Badge, Button, Field, KeyValue, ListRow, PartyPickerModal, Section, partyColor } from '../components/ui';
import { dateTime, genderLabel, isValidMobile } from '../components/format';
import { getVoter, listResponsesForVoter, listSurveys, setVoted, setVotedParty, updateVoterPhone } from '../db/repo';
import { colors, radius, space, type } from '../theme';

export default function VoterDetailScreen({ route, navigation }) {
  const { voterId } = route.params;
  const { notifyLocalChange } = useSync();
  const { data } = useLiveData(async () => {
    const [voter, surveys, responses] = await Promise.all([
      getVoter(voterId),
      listSurveys(),
      listResponsesForVoter(voterId),
    ]);
    return { voter, surveys, responses };
  }, [voterId]);

  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pickingParty, setPickingParty] = useState(false);

  useEffect(() => {
    if (data?.voter) setPhone(data.voter.mobile_number || '');
  }, [data?.voter?.mobile_number]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;
  const { voter, surveys, responses } = data;
  if (!voter) {
    return (
      <View style={{ padding: space.xl }}>
        <Text style={type.body}>This voter is no longer in your booth list.</Text>
      </View>
    );
  }

  async function savePhone() {
    const value = phone.trim();
    if (value && !isValidMobile(value)) return setPhoneError('Enter a valid 10-digit mobile number.');
    setPhoneError(null);
    setSaving(true);
    try {
      await updateVoterPhone(voter.id, value);
      notifyLocalChange();
      Alert.alert('Phone number saved', 'It will be sent to the office at the next sync.');
    } finally {
      setSaving(false);
    }
  }

  function toggleVoted() {
    if (!voter.is_voted) {
      setPickingParty(true);
      return;
    }
    Alert.alert('Undo voted', `${voter.serial_no}. ${voter.name}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Undo voted',
        style: 'destructive',
        onPress: async () => {
          await setVoted(voter.id, false);
          notifyLocalChange();
        },
      },
    ]);
  }

  async function choseParty(party) {
    setPickingParty(false);
    if (voter.is_voted) await setVotedParty(voter.id, party);
    else await setVoted(voter.id, true, party);
    notifyLocalChange();
  }

  const phoneChanged = (voter.mobile_number || '') !== phone.trim();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Text style={styles.serial}>Serial {voter.serial_no}</Text>
          <Text style={styles.name}>{voter.name}</Text>
          <View style={{ flexDirection: 'row', marginTop: space.sm }}>
            {voter.is_voted ? <Badge label="Voted" tone="success" /> : null}
            {voter.survey_count > 0 ? <Badge label={`Surveyed ×${voter.survey_count}`} tone="success" /> : null}
          </View>
          {voter.is_voted ? (
            <Pressable style={styles.partyPill} onPress={() => setPickingParty(true)}>
              <View style={[styles.partyDot, { backgroundColor: partyColor(voter.voted_party) }]} />
              <Text style={styles.partyPillText}>{voter.voted_party || 'Which party? (your guess)'}</Text>
            </Pressable>
          ) : null}
        </View>

        <Section title="Voter details">
          <KeyValue label="EPIC no" value={voter.epic_no} />
          <KeyValue label={voter.relation_type || 'Relation'} value={voter.relation_name} />
          <KeyValue label="Gender / age" value={`${genderLabel(voter.gender)}, ${voter.age ?? '—'}`} />
          <KeyValue label="House no" value={voter.house_no} />
          <KeyValue label="Section" value={voter.section} />
        </Section>

        <Section title="Phone number">
          <Field
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="10-digit mobile number"
            error={phoneError}
          />
          <Button title="Save phone number" onPress={savePhone} loading={saving} disabled={!phoneChanged} />
        </Section>

        <Section title="Family">
          {voter.household_id ? (
            <ListRow
              title={`Family ${voter.family_code}`}
              subtitle="Open to see members or add people"
              onPress={() => navigation.navigate('HouseholdDetail', { householdId: voter.household_id })}
            />
          ) : (
            <>
              <Text style={styles.muted}>This voter is not in a family yet.</Text>
              <Button
                title="Create a family with this voter"
                icon="user-plus"
                variant="secondary"
                onPress={() => navigation.navigate('HouseholdForm', { seedVoterId: voter.id })}
              />
            </>
          )}
        </Section>

        <Section title="Surveys">
          {surveys.length === 0 ? <Text style={styles.muted}>No surveys are active right now.</Text> : null}
          {surveys.map((s) => (
            <Button
              key={s.id}
              title={`Start: ${s.title}`}
              icon="clipboard"
              variant="secondary"
              style={{ marginBottom: space.sm }}
              onPress={() =>
                navigation.navigate('SurveyWizard', { surveyId: s.id, voterId: voter.id, householdId: voter.household_id })
              }
            />
          ))}
          {responses.map((r) => (
            <Text key={r.id} style={styles.response}>
              {r.title || 'Survey'} · {dateTime(r.collected_at)} · {r.synced ? 'sent' : 'waiting to send'}
            </Text>
          ))}
        </Section>

        <Button
          title={voter.is_voted ? 'Undo voted' : 'Mark as voted'}
          variant={voter.is_voted ? 'danger' : 'success'}
          icon={voter.is_voted ? 'rotate-ccw' : 'check'}
          onPress={toggleVoted}
        />
      </ScrollView>
      <PartyPickerModal
        visible={pickingParty}
        subtitle="Your guess only — ballots are secret, this is never confirmed."
        current={voter.voted_party}
        onSelect={choseParty}
        onClose={() => setPickingParty(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  head: { marginBottom: space.lg },
  serial: { ...type.small, color: colors.muted, fontWeight: '600' },
  name: { ...type.title, color: colors.ink },
  muted: { ...type.small, color: colors.muted, marginBottom: space.md },
  response: { ...type.tiny, color: colors.muted, marginTop: space.sm },
  partyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: 40,
    marginTop: space.sm,
  },
  partyDot: { width: 10, height: 10, borderRadius: 5, marginRight: space.sm },
  partyPillText: { ...type.small, fontWeight: '700', color: colors.ink },
});
