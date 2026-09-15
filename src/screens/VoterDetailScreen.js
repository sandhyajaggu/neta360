import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { useLiveData } from '../components/useLiveData';
import { Badge, Button, Field, KeyValue, ListRow, PartyPickerModal, Section, partyColor } from '../components/ui';
import { dateTime, genderLabel, isValidMobile } from '../components/format';
import { api } from '../api/client';
import {
  confirmVoterMobile,
  getVoter,
  listResponsesForVoter,
  listSurveys,
  setVoted,
  setVotedParty,
  updateVoterPhone,
  updateVoterProfile,
} from '../db/repo';
import { colors, radius, space, type } from '../theme';

export default function VoterDetailScreen({ route, navigation }) {
  const { voterId } = route.params;
  const { session } = useAuth();
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

  const [otpStage, setOtpStage] = useState('idle'); // idle | sent
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const scrollRef = useRef(null);
  const contactY = useRef(0);

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

  // Clearing a wrong number doesn't need a fresh OTP — only saving a new one does.
  async function removeNumber() {
    setSaving(true);
    try {
      await updateVoterPhone(voter.id, '');
      notifyLocalChange();
      setOtpStage('idle');
    } finally {
      setSaving(false);
    }
  }

  async function sendOtp() {
    const value = phone.trim();
    if (!isValidMobile(value)) return setPhoneError('Enter a valid 10-digit mobile number.');
    setPhoneError(null);
    setOtpError(null);
    setSendingOtp(true);
    try {
      const res = await api.sendMobileOtp(voter.id, value);
      setOtp('');
      setOtpStage('sent');
      if (res?.demo_otp) Alert.alert('OTP sent (demo mode)', `No real SMS gateway is set up yet, so here's the code: ${res.demo_otp}`);
      else Alert.alert('OTP sent', `We sent a verification code to ${value}.`);
    } catch (e) {
      Alert.alert('Could not send OTP', e.message);
    } finally {
      setSendingOtp(false);
    }
  }

  async function verifyOtp() {
    const value = phone.trim();
    if (!/^\d{6}$/.test(otp.trim())) return setOtpError('Enter the 6-digit code.');
    setOtpError(null);
    setVerifyingOtp(true);
    try {
      await api.verifyMobileOtp(voter.id, value, otp.trim());
      await confirmVoterMobile(voter.id, value);
      notifyLocalChange();
      setOtpStage('idle');
      setOtp('');
      Alert.alert('Mobile number saved', 'The number is verified and saved to this voter.');
    } catch (e) {
      setOtpError(e.message);
    } finally {
      setVerifyingOtp(false);
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

  function startEdit() {
    setProfile({
      dob: voter.dob || '',
      voterStatus: voter.voter_status || '',
      street: voter.street || '',
      village: voter.village || '',
      ward: voter.ward || '',
      altMobile: voter.alt_mobile || '',
    });
    setEditing(true);
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await updateVoterProfile(voter.id, profile);
      notifyLocalChange();
      setEditing(false);
    } finally {
      setSavingProfile(false);
    }
  }

  const phoneChanged = (voter.mobile_number || '') !== phone.trim();
  const phoneVerified = !phoneChanged && phone.trim() !== '' && !!voter.mobile_verified;
  const mapped = !!voter.household_id;
  const relationship = voter.household_id
    ? voter.head_voter_id === voter.id
      ? 'Head'
      : 'Member'
    : '—';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: space.lg }}
        keyboardShouldPersistTaps="handled"
      >
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

        <View style={styles.quickRow}>
          <QuickAction icon="edit-2" label="EDIT" onPress={startEdit} />
          <QuickAction
            icon="users"
            label="FAMILY"
            onPress={() =>
              voter.household_id
                ? navigation.navigate('HouseholdDetail', { householdId: voter.household_id })
                : navigation.navigate('HouseholdForm', { seedVoterId: voter.id })
            }
          />
          <QuickAction
            icon="phone"
            label="MOBILE"
            onPress={() => scrollRef.current?.scrollTo({ y: Math.max(contactY.current - space.lg, 0), animated: true })}
          />
          <QuickAction
            icon="clipboard"
            label="SURVEY"
            onPress={() => {
              if (surveys[0]) {
                navigation.navigate('SurveyWizard', { surveyId: surveys[0].id, voterId: voter.id, householdId: voter.household_id });
              }
            }}
          />
        </View>

        <Section title="Basic information">
          <KeyValue label="Voter name" value={voter.name} />
          <KeyValue label="Voter ID" value={voter.epic_no} />
          <KeyValue label="Date of birth" value={voter.dob} />
          <KeyValue label="Age" value={voter.age} />
          <KeyValue label="Gender" value={genderLabel(voter.gender)} />
          <KeyValue label="Voter status" value={voter.voter_status || 'Active'} />
        </Section>

        <Section title="Address">
          <KeyValue label="House number" value={voter.house_no} />
          <KeyValue label="Street" value={voter.street} />
          <KeyValue label="Village" value={voter.village || session.booth.village} />
          <KeyValue label="Ward" value={voter.ward} />
          <KeyValue label="Booth" value={`${session.booth.booth_no} · ${session.booth.name}`} />
        </Section>

        <Section title="Household">
          <KeyValue label="Family ID" value={voter.family_code} />
          <KeyValue label="Relationship to household" value={relationship} />
        </Section>

        <View onLayout={(e) => { contactY.current = e.nativeEvent.layout.y; }}>
        <Section title="Contact">
          <Field
            label="Mobile number"
            value={phone}
            onChangeText={(t) => {
              setPhone(t.replace(/\D/g, ''));
              setPhoneError(null);
              setOtpStage('idle');
            }}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="10-digit mobile number"
            error={phoneError}
          />

          {phoneVerified ? (
            <View style={{ alignSelf: 'flex-start' }}>
              <Badge label="✓ Verified" tone="success" />
            </View>
          ) : otpStage === 'idle' ? (
            <View style={{ flexDirection: 'row' }}>
              <Button
                title="Send OTP"
                onPress={sendOtp}
                loading={sendingOtp}
                disabled={!phone.trim()}
                style={{ flex: 1 }}
              />
              {!phone.trim() && voter.mobile_number ? (
                <Button
                  title="Remove"
                  variant="danger"
                  onPress={removeNumber}
                  loading={saving}
                  style={{ marginLeft: space.sm }}
                />
              ) : null}
            </View>
          ) : (
            <>
              <Field
                label="Enter the 6-digit OTP"
                value={otp}
                onChangeText={(t) => {
                  setOtp(t.replace(/\D/g, ''));
                  setOtpError(null);
                }}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="OTP sent to this number"
                error={otpError}
                hint={`Sent to ${phone.trim()}`}
              />
              <Button title="Verify & save" onPress={verifyOtp} loading={verifyingOtp} />
              <Button title="Resend OTP" variant="secondary" onPress={sendOtp} loading={sendingOtp} style={{ marginTop: space.sm }} />
            </>
          )}

          <View style={{ marginTop: space.md }}>
            <KeyValue label="Mobile verification" value={voter.mobile_verified ? '✓ Verified' : 'Not verified'} />
            <KeyValue label="Alternate contact" value={voter.alt_mobile} />
          </View>
        </Section>
        </View>

        <Section title="Mapping">
          <View style={styles.flow}>
            <FlowStep label="Voter" value={voter.name} />
            <FlowArrow />
            <FlowStep label="Booth" value={session.booth.booth_no} />
            <FlowArrow />
            <FlowStep label="Household" value={voter.house_no || '—'} />
            <FlowArrow />
            <FlowStep label="Family ID" value={voter.family_code || '—'} />
          </View>
          <View style={{ marginTop: space.md }}>
            <KeyValue label="Family mapping" value={mapped ? '✓' : '✗'} />
            <KeyValue label="Household mapping" value={mapped ? '✓' : '✗'} />
            <KeyValue label="Booth mapping" value="✓" />
          </View>
          <View style={{ alignSelf: 'flex-start', marginTop: space.md }}>
            <Badge label={mapped ? '🟢 Mapped' : '🔴 Not mapped'} tone={mapped ? 'success' : 'danger'} />
          </View>
        </Section>

        {voter.household_id ? (
          <ListRow
            title={`Family ${voter.family_code}`}
            subtitle="Open to see members or add people"
            onPress={() => navigation.navigate('HouseholdDetail', { householdId: voter.household_id })}
          />
        ) : (
          <Button
            title="Create a family with this voter"
            icon="user-plus"
            variant="secondary"
            style={{ marginTop: space.md, marginBottom: space.lg }}
            onPress={() => navigation.navigate('HouseholdForm', { seedVoterId: voter.id })}
          />
        )}

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

      {editing ? (
        <View style={styles.editSheet}>
          <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
            <Text style={styles.editTitle}>Edit voter profile</Text>
            <Text style={styles.muted}>These are supplementary details not sent by the admin website yet.</Text>
            <Field label="Date of birth" value={profile.dob} onChangeText={(t) => setProfile((p) => ({ ...p, dob: t }))} placeholder="DD-MM-YYYY" />
            <Field label="Voter status" value={profile.voterStatus} onChangeText={(t) => setProfile((p) => ({ ...p, voterStatus: t }))} placeholder="Active" />
            <Field label="Street" value={profile.street} onChangeText={(t) => setProfile((p) => ({ ...p, street: t }))} />
            <Field label="Village" value={profile.village} onChangeText={(t) => setProfile((p) => ({ ...p, village: t }))} />
            <Field label="Ward" value={profile.ward} onChangeText={(t) => setProfile((p) => ({ ...p, ward: t }))} />
            <Field
              label="Alternate contact"
              value={profile.altMobile}
              onChangeText={(t) => setProfile((p) => ({ ...p, altMobile: t.replace(/\D/g, '') }))}
              keyboardType="number-pad"
              maxLength={10}
            />
            <Button title="Save" onPress={saveProfile} loading={savingProfile} style={{ marginTop: space.md }} />
            <Button title="Cancel" variant="secondary" onPress={() => setEditing(false)} style={{ marginTop: space.sm }} />
          </ScrollView>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function QuickAction({ icon, label, onPress }) {
  return (
    <Pressable style={({ pressed }) => [styles.quickBtn, pressed && { backgroundColor: colors.primarySoft }]} onPress={onPress}>
      <Feather name={icon} size={18} color={colors.primary} />
      <Text style={styles.quickBtnText}>{label}</Text>
    </Pressable>
  );
}

function FlowStep({ label, value }) {
  return (
    <View style={styles.flowStep}>
      <Text style={styles.flowLabel}>{label}</Text>
      <Text style={styles.flowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function FlowArrow() {
  return <Feather name="arrow-down" size={16} color={colors.muted} style={{ marginVertical: 2 }} />;
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
  quickRow: { flexDirection: 'row', marginBottom: space.lg },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    marginRight: space.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  quickBtnText: { ...type.tiny, fontWeight: '700', color: colors.primary, marginTop: 4 },
  flow: { alignItems: 'center' },
  flowStep: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  flowLabel: { ...type.tiny, color: colors.muted, fontWeight: '700' },
  flowValue: { ...type.small, color: colors.ink, fontWeight: '600', marginTop: 2 },
  editSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: colors.bg,
  },
  editTitle: { ...type.title, color: colors.ink, marginBottom: space.xs },
});
