import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSync } from '../context/SyncContext';
import { useLiveData } from '../components/useLiveData';
import { Chip, Empty, PartyPickerModal, SearchBar, partyColor } from '../components/ui';
import { clock } from '../components/format';
import { getDashboardStats, getPartyCounts, listVoters, setVoted, setVotedParty } from '../db/repo';
import { PARTIES } from '../config';
import { colors, radius, space, type } from '../theme';

// Poll-day screen: type the serial number from the voter slip, tap once.
export default function TurnoutScreen() {
  const { notifyLocalChange } = useSync();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('not_voted');
  const [picking, setPicking] = useState(null); // voter being asked about right now

  const { data } = useLiveData(async () => {
    const [voters, stats, partyCounts] = await Promise.all([
      listVoters({ search, filter, limit: 100 }),
      getDashboardStats(),
      getPartyCounts(),
    ]);
    return { voters, stats, partyCounts };
  }, [search, filter]);

  const voters = data?.voters || [];
  const stats = data?.stats || { total: 0, voted: 0 };
  const partyCounts = data?.partyCounts || {};
  const pct = stats.total ? ((stats.voted / stats.total) * 100).toFixed(1) : '0.0';

  function mark(v) {
    setPicking(v);
  }

  async function choseParty(party) {
    const v = picking;
    setPicking(null);
    if (!v) return;
    if (v.is_voted) await setVotedParty(v.id, party);
    else {
      await setVoted(v.id, true, party);
      setSearch('');
    }
    notifyLocalChange();
  }

  function undo(v) {
    Alert.alert('Undo voted?', `${v.serial_no}. ${v.name}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Undo',
        style: 'destructive',
        onPress: async () => {
          await setVoted(v.id, false);
          notifyLocalChange();
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.counter}>
        <Text style={styles.counterBig}>{stats.voted}</Text>
        <View style={{ marginLeft: space.md, flex: 1 }}>
          <Text style={styles.counterLabel}>voted out of {stats.total}</Text>
          <Text style={styles.counterPct}>{pct}% turnout</Text>
        </View>
      </View>
      {stats.voted > 0 ? (
        <View style={styles.partyStrip}>
          {PARTIES.map((p) => (
            <View key={p.code} style={styles.partyStripItem}>
              <View style={[styles.partyDotSmall, { backgroundColor: p.color }]} />
              <Text style={styles.partyStripText}>
                {p.code} {partyCounts[p.code] || 0}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ padding: space.lg, paddingBottom: space.sm }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Serial number or name" keyboardType="default" />
        <View style={{ flexDirection: 'row', marginTop: space.md }}>
          <Chip label="Not voted" active={filter === 'not_voted'} onPress={() => setFilter('not_voted')} />
          <Chip label="Voted" active={filter === 'voted'} onPress={() => setFilter('voted')} />
        </View>
      </View>
      <FlatList
        data={voters}
        keyExtractor={(v) => v.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.serial}>{item.serial_no}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.sub}>
                {item.gender} {item.age} · House {item.house_no || '—'}
                {item.is_voted ? ` · voted ${clock(item.voted_at)}` : ''}
              </Text>
            </View>
            {item.is_voted ? (
              <>
                <Pressable style={styles.partyPill} onPress={() => setPicking(item)}>
                  <View style={[styles.partyDotSmall, { backgroundColor: partyColor(item.voted_party) }]} />
                  <Text style={styles.partyPillText}>{item.voted_party || 'Which party?'}</Text>
                </Pressable>
                <Pressable style={[styles.action, styles.undo]} onPress={() => undo(item)}>
                  <Text style={[styles.actionText, { color: colors.danger }]}>Undo</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]} onPress={() => mark(item)}>
                <Text style={styles.actionText}>Voted</Text>
              </Pressable>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Empty
            title={filter === 'voted' ? 'No one marked as voted yet' : search ? 'No match' : 'Everyone has voted'}
            message={search ? 'Check the serial number on the voter slip.' : undefined}
          />
        }
      />
      <PartyPickerModal
        visible={!!picking}
        subtitle={picking ? `${picking.serial_no}. ${picking.name} — your guess only, ballots are secret.` : ''}
        current={picking?.voted_party}
        onSelect={choseParty}
        onClose={() => setPicking(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  counter: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: space.xl, paddingVertical: space.lg },
  counterBig: { ...type.plate, color: colors.white },
  counterLabel: { ...type.body, color: colors.white, fontWeight: '600' },
  counterPct: { ...type.small, color: '#BFD6DC' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  serial: { ...type.title, color: colors.primary, width: 64 },
  name: { ...type.body, fontWeight: '600', color: colors.ink },
  sub: { ...type.tiny, color: colors.muted, marginTop: 2 },
  action: { backgroundColor: colors.success, borderRadius: radius.md, paddingHorizontal: space.lg, height: 48, justifyContent: 'center' },
  undo: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.danger },
  actionText: { ...type.body, fontWeight: '800', color: colors.white },
  partyStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.primaryPressed,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  partyStripItem: { flexDirection: 'row', alignItems: 'center', marginRight: space.lg, marginVertical: 2 },
  partyStripText: { ...type.tiny, color: colors.white, fontWeight: '600' },
  partyDotSmall: { width: 8, height: 8, borderRadius: 4, marginRight: space.xs },
  partyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    height: 48,
    marginRight: space.sm,
  },
  partyPillText: { ...type.tiny, fontWeight: '700', color: colors.ink },
});
