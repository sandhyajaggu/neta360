import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { useLiveData } from '../components/useLiveData';
import { Badge, Button, Field, SearchBar } from '../components/ui';
import { getHousehold, getVoter, listCandidateMembers, saveHousehold } from '../db/repo';
import { colors, radius, space, type } from '../theme';

// Create a new family, or edit one (route.params.householdId).
// Opening from a voter (route.params.seedVoterId) pre-fills that voter.
export default function HouseholdFormScreen({ route, navigation }) {
  const { householdId, seedVoterId } = route.params || {};
  const { session } = useAuth();
  const { notifyLocalChange } = useSync();

  const [houseNo, setHouseNo] = useState('');
  const [address, setAddress] = useState('');
  const [members, setMembers] = useState({}); // id -> voter
  const [headId, setHeadId] = useState(null);
  const [search, setSearch] = useState('');
  const [familyCode, setFamilyCode] = useState(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: householdId ? 'Edit family' : 'Map a new family' });
  }, [navigation, householdId]);

  useEffect(() => {
    (async () => {
      if (householdId) {
        const h = await getHousehold(householdId);
        if (h) {
          setHouseNo(h.house_no || '');
          setAddress(h.address || '');
          setFamilyCode(h.family_code);
          setMembers(Object.fromEntries(h.members.map((m) => [m.id, m])));
          setHeadId(h.head_voter_id);
        }
      } else if (seedVoterId) {
        const v = await getVoter(seedVoterId);
        if (v) {
          setHouseNo(v.house_no || '');
          setMembers({ [v.id]: v });
          setHeadId(v.id);
        }
      }
      setReady(true);
    })();
  }, [householdId, seedVoterId]);

  const { data: candidates } = useLiveData(
    () => listCandidateMembers({ houseNo, search, householdId }),
    [houseNo, search, householdId]
  );
  const available = (candidates || []).filter((v) => !members[v.id]);
  const memberList = Object.values(members).sort((a, b) => (b.age || 0) - (a.age || 0));

  function add(v) {
    setMembers((m) => ({ ...m, [v.id]: v }));
    if (!headId) setHeadId(v.id);
  }

  function remove(id) {
    const next = { ...members };
    delete next[id];
    setMembers(next);
    if (headId === id) setHeadId(Object.keys(next)[0] || null);
  }

  async function onSave() {
    const ids = Object.keys(members);
    if (!ids.length) return Alert.alert('Add at least one member', 'Pick voters from the list below.');
    if (!houseNo.trim()) return Alert.alert('House number is needed', 'Enter the house number of this family.');
    setSaving(true);
    try {
      const id = await saveHousehold({
        id: householdId,
        boothNo: session.booth.booth_no,
        houseNo: houseNo.trim(),
        address: address.trim(),
        headVoterId: headId && members[headId] ? headId : ids[0],
        memberIds: ids,
      });
      notifyLocalChange();
      navigation.replace('HouseholdDetail', { householdId: id });
    } catch (e) {
      Alert.alert('Could not save the family', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return null;

  const header = (
    <View style={{ padding: space.lg }}>
      {familyCode ? <Text style={styles.code}>Family ID {familyCode}</Text> : (
        <Text style={styles.help}>A Family ID is created automatically when you save.</Text>
      )}
      <Field label="House number" value={houseNo} onChangeText={setHouseNo} placeholder="e.g. 4-12" autoCapitalize="characters" />
      <Field label="Address or landmark (optional)" value={address} onChangeText={setAddress} placeholder="e.g. Near Rama temple" />

      <Text style={styles.groupTitle}>Members ({memberList.length})</Text>
      {memberList.length === 0 ? <Text style={styles.help}>No members yet. Tap voters below to add them.</Text> : null}
      {memberList.map((v) => (
        <View key={v.id} style={styles.member}>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberName} numberOfLines={1}>
              {v.serial_no}. {v.name}
            </Text>
            <Text style={styles.memberSub}>
              {v.gender} {v.age} · House {v.house_no || '—'}
            </Text>
          </View>
          {headId === v.id ? (
            <Badge label="Head" tone="primary" />
          ) : (
            <Pressable onPress={() => setHeadId(v.id)} style={styles.smallBtn} hitSlop={6}>
              <Text style={styles.smallBtnText}>Make head</Text>
            </Pressable>
          )}
          <Pressable onPress={() => remove(v.id)} hitSlop={10} style={{ marginLeft: space.md }} accessibilityLabel={`Remove ${v.name}`}>
            <Feather name="x-circle" size={22} color={colors.danger} />
          </Pressable>
        </View>
      ))}

      <Text style={[styles.groupTitle, { marginTop: space.xl }]}>Add voters</Text>
      <Text style={styles.help}>Voters with the same house number are shown first. Only voters without a family are listed.</Text>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search name, serial or EPIC" />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={available}
        keyExtractor={(v) => v.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [styles.candidate, pressed && { backgroundColor: colors.primarySoft }]} onPress={() => add(item)}>
            <Feather name="plus-circle" size={22} color={colors.primary} style={{ marginRight: space.md }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName} numberOfLines={1}>
                {item.serial_no}. {item.name}
              </Text>
              <Text style={styles.memberSub}>
                {item.gender} {item.age} · House {item.house_no || '—'} · {item.relation_type} {item.relation_name}
              </Text>
            </View>
            {houseNo.trim() && item.house_no === houseNo.trim() ? <Badge label="Same house" tone="success" /> : null}
          </Pressable>
        )}
        ListEmptyComponent={<Text style={[styles.help, { paddingHorizontal: space.lg }]}>No more voters without a family match this search.</Text>}
      />
      <View style={styles.bottom}>
        <Button title={householdId ? 'Save changes' : 'Save family'} icon="check" onPress={onSave} loading={saving} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  code: { ...type.heading, color: colors.primary, marginBottom: space.lg },
  help: { ...type.small, color: colors.muted, marginBottom: space.md, lineHeight: 20 },
  groupTitle: { ...type.heading, color: colors.ink, marginBottom: space.sm },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
  },
  memberName: { ...type.body, fontWeight: '600', color: colors.ink },
  memberSub: { ...type.tiny, color: colors.muted, marginTop: 2 },
  smallBtn: { paddingHorizontal: space.sm, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  smallBtnText: { ...type.tiny, color: colors.primary, fontWeight: '700' },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 60,
  },
  bottom: { padding: space.lg, backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
