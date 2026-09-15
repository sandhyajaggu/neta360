import React, { useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLiveData } from '../components/useLiveData';
import { Badge, Chip, Empty, ListRow, SearchBar } from '../components/ui';
import { listVoters } from '../db/repo';
import { colors, space, type } from '../theme';

const FILTERS = [
  ['all', 'All'],
  ['mapped', 'Mapped'],
  ['not_mapped', 'Not mapped'],
  ['mobile_available', 'Mobile available'],
  ['mobile_missing', 'Mobile missing'],
  ['survey_completed', 'Survey completed'],
  ['survey_pending', 'Survey pending'],
];

export default function VotersScreen({ navigation, route }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (route.params?.filter) setFilter(route.params.filter);
  }, [route.params?.filter]);

  const { data } = useLiveData(() => listVoters({ search, filter }), [search, filter]);
  const voters = data || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.top}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Name, Voter ID, house no or Family ID" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.md }}>
          {FILTERS.map(([key, label]) => (
            <Chip key={key} label={label} active={filter === key} onPress={() => setFilter(key)} />
          ))}
        </ScrollView>
      </View>
      <Text style={styles.count}>
        {voters.length === 300 ? 'Showing first 300 — search to narrow down' : `${voters.length} voters`}
      </Text>
      <FlatList
        data={voters}
        keyExtractor={(v) => v.id}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        renderItem={({ item }) => <VoterRow voter={item} onPress={() => navigation.navigate('VoterDetail', { voterId: item.id })} />}
        ListEmptyComponent={
          <Empty
            title={search ? 'No voters match your search' : 'No voters here'}
            message={search ? 'Check the spelling, or search by serial number instead.' : 'Pull down on Home to sync your booth list.'}
          />
        }
      />
    </View>
  );
}

export function VoterRow({ voter, onPress, right }) {
  const mapped = !!voter.household_id;
  return (
    <ListRow
      onPress={onPress}
      title={`${voter.serial_no}. ${voter.name}`}
      subtitle={`EPIC ${voter.epic_no || '—'} · House ${voter.house_no || '—'} · Family ${voter.family_code || '—'}`}
      right={right}
      meta={
        <>
          <Badge label={mapped ? '✓ Mapped' : '✗ Not mapped'} tone={mapped ? 'success' : 'danger'} />
          {voter.mobile_number ? <Badge label="Mobile available" tone="success" /> : <Badge label="Mobile missing" tone="warn" />}
          {voter.survey_count > 0 ? <Badge label="Surveyed" tone="success" /> : null}
          {voter.is_voted ? <Badge label="Voted" tone="success" /> : null}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  top: { padding: space.lg, paddingBottom: space.sm, backgroundColor: colors.bg },
  count: { ...type.tiny, color: colors.muted, paddingHorizontal: space.lg, paddingBottom: space.sm },
});
