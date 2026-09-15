import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSync } from '../context/SyncContext';
import { useLiveData } from '../components/useLiveData';
import { Badge, Button, KeyValue, Section } from '../components/ui';
import { deleteHousehold, getHousehold, listSurveys } from '../db/repo';
import { colors, space, type } from '../theme';

export default function HouseholdDetailScreen({ route, navigation }) {
  const { householdId } = route.params;
  const { notifyLocalChange } = useSync();
  const { data } = useLiveData(async () => {
    const [household, surveys] = await Promise.all([getHousehold(householdId), listSurveys()]);
    return { household, surveys };
  }, [householdId]);

  if (!data) return null;
  const { household, surveys } = data;
  if (!household) {
    return (
      <View style={{ padding: space.xl }}>
        <Text style={type.body}>This family was removed.</Text>
      </View>
    );
  }

  function confirmDelete() {
    Alert.alert(
      `Remove family ${household.family_code}?`,
      'The voters stay in your booth list. They just will not belong to any family.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove family',
          style: 'destructive',
          onPress: async () => {
            await deleteHousehold(household.id);
            notifyLocalChange();
            navigation.goBack();
          },
        },
      ]
    );
  }

  // Auto-calculated — the operator never edits these directly, they follow from the member list.
  const familyMembers = household.members.length;
  const registeredVoters = household.members.filter((m) => m.epic_no).length;
  const mappedVoters = registeredVoters; // being a household member is what "mapped" means
  const pendingVoters = familyMembers - mappedVoters;
  const mobileAvailable = household.members.filter((m) => m.mobile_number).length;
  const surveyedCount = household.members.filter((m) => m.survey_count > 0).length;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg }}>
      <Text style={styles.code}>{household.family_code}</Text>
      <Text style={styles.sub}>{familyMembers} members</Text>

      <Section title="Household information">
        <KeyValue label="Family ID" value={household.family_code} />
        <KeyValue label="House no" value={household.house_no} />
        <KeyValue label="Address" value={household.address} />
      </Section>

      <Section title="Family dashboard">
        <View style={styles.statGrid}>
          <Stat label="Family members" value={familyMembers} />
          <Stat label="Registered voters" value={registeredVoters} />
          <Stat label="Mapped voters" value={mappedVoters} tone="success" />
          <Stat label="Pending voters" value={pendingVoters} tone={pendingVoters ? 'warn' : undefined} />
          <Stat label="Mobiles available" value={`${mobileAvailable}/${familyMembers}`} />
          <Stat label="Survey status" value={`${surveyedCount}/${familyMembers}`} />
        </View>
      </Section>

      <Section title="Members" flush>
        {household.members.map((m) => (
          <Pressable
            key={m.id}
            style={({ pressed }) => [styles.memberRow, pressed && { backgroundColor: colors.primarySoft }]}
            onPress={() => navigation.navigate('VoterDetail', { voterId: m.id })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName} numberOfLines={1}>
                {m.name}
              </Text>
              <Text style={styles.memberSub}>{m.epic_no || 'No Voter ID'}</Text>
            </View>
            {m.id === household.head_voter_id ? <Badge label="Head" tone="primary" /> : null}
            <Badge label={m.epic_no ? '✓' : 'Pending'} tone={m.epic_no ? 'success' : 'warn'} />
          </Pressable>
        ))}
      </Section>

      <Button
        title="+ Add family member"
        icon="user-plus"
        variant="secondary"
        style={{ marginBottom: space.md }}
        onPress={() => navigation.navigate('HouseholdForm', { householdId: household.id })}
      />

      {surveys.map((s) => (
        <Button
          key={s.id}
          title={`Start: ${s.title}`}
          icon="clipboard"
          style={{ marginBottom: space.md }}
          onPress={() =>
            navigation.navigate('SurveyWizard', {
              surveyId: s.id,
              householdId: household.id,
              voterId: household.head_voter_id,
            })
          }
        />
      ))}
      <Button title="Remove family" icon="trash-2" variant="danger" onPress={confirmDelete} />
    </ScrollView>
  );
}

function Stat({ label, value, tone }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone === 'success' && { color: colors.success }, tone === 'warn' && { color: colors.warn }]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  code: { ...type.title, color: colors.ink },
  sub: { ...type.small, color: colors.muted, marginBottom: space.lg },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.sm },
  stat: { width: '33.33%', paddingHorizontal: space.sm, marginBottom: space.md },
  statValue: { ...type.heading, color: colors.ink },
  statLabel: { ...type.tiny, color: colors.muted, marginTop: 2 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 64,
  },
  memberName: { ...type.body, fontWeight: '600', color: colors.ink },
  memberSub: { ...type.small, color: colors.muted, marginTop: 2 },
});
