import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useLiveData } from '../components/useLiveData';
import { Button, Empty, ListRow, SearchBar } from '../components/ui';
import { listHouseholds } from '../db/repo';
import { colors, space } from '../theme';

export default function HouseholdsScreen({ navigation }) {
  const [search, setSearch] = useState('');
  const { data } = useLiveData(() => listHouseholds(search), [search]);
  const households = data || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.top}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Family ID, house no or head's name" />
      </View>
      <FlatList
        data={households}
        keyExtractor={(h) => h.id}
        renderItem={({ item }) => (
          <ListRow
            title={item.family_code}
            subtitle={`${item.head_name || 'No head set'} · House ${item.house_no || '—'} · ${item.member_count} ${
              item.member_count === 1 ? 'member' : 'members'
            }`}
            onPress={() => navigation.navigate('HouseholdDetail', { householdId: item.id })}
          />
        )}
        ListEmptyComponent={
          <Empty
            title={search ? 'No families match' : 'No families mapped yet'}
            message={search ? 'Try the house number or the Family ID.' : 'Group voters who live in the same house into a family. Each family gets a Family ID.'}
          />
        }
      />
      <View style={styles.bottom}>
        <Button title="Map a new family" icon="plus" onPress={() => navigation.navigate('HouseholdForm', {})} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { padding: space.lg, paddingBottom: space.sm },
  bottom: { padding: space.lg, backgroundColor: colors.bg },
});
