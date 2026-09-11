import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSync } from '../context/SyncContext';
import { useLiveData } from '../components/useLiveData';
import { Badge, Button, KeyValue, Section } from '../components/ui';
import { VoterRow } from './VotersScreen';
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

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg }}>
      <Text style={styles.code}>{household.family_code}</Text>
      <Text style={styles.sub}>{household.members.length} members</Text>

      <Section title="Address">
        <KeyValue label="House no" value={household.house_no} />
        <KeyValue label="Address / landmark" value={household.address} />
      </Section>

      <Section title="Members" flush>
        {household.members.map((m) => (
          <VoterRow
            key={m.id}
            voter={{ ...m, family_code: null }}
            right={m.id === household.head_voter_id ? <Badge label="Head" tone="primary" /> : null}
            onPress={() => navigation.navigate('VoterDetail', { voterId: m.id })}
          />
        ))}
      </Section>

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
      <Button
        title="Edit family"
        icon="edit-2"
        variant="secondary"
        style={{ marginBottom: space.md }}
        onPress={() => navigation.navigate('HouseholdForm', { householdId: household.id })}
      />
      <Button title="Remove family" icon="trash-2" variant="danger" onPress={confirmDelete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  code: { ...type.title, color: colors.ink },
  sub: { ...type.small, color: colors.muted, marginBottom: space.lg },
});
