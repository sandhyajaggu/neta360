import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { useLiveData } from '../components/useLiveData';
import { Button, Progress, Section } from '../components/ui';
import { timeAgo } from '../components/format';
import { getDashboardStats } from '../db/repo';
import { colors, radius, space, type } from '../theme';

export default function DashboardScreen({ navigation }) {
  const { session } = useAuth();
  const sync = useSync();
  const { data: stats } = useLiveData(getDashboardStats);
  const booth = session.booth;
  const s = stats || { total: 0, mapped: 0, withPhone: 0, surveyed: 0, voted: 0, families: 0, unread: 0 };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: space.xxl }}
      refreshControl={<RefreshControl refreshing={sync.syncing} onRefresh={sync.runSync} />}
    >
      <View style={styles.plate}>
        <Text style={styles.plateLabel}>Booth</Text>
        <Text style={styles.plateNo}>{booth.booth_no}</Text>
        <Text style={styles.plateName}>{booth.name}</Text>
        <Text style={styles.plateArea}>
          {booth.village}, {booth.mandal} mandal
        </Text>
        <Text style={styles.plateCount}>
          {s.total} voters · {s.families} families
        </Text>
      </View>

      <View style={{ padding: space.lg }}>
        <SyncStrip sync={sync} />

        {s.unread > 0 ? (
          <Pressable style={styles.alert} onPress={() => navigation.navigate('Notifications')}>
            <Feather name="bell" size={18} color={colors.primary} />
            <Text style={styles.alertText}>
              {s.unread} new {s.unread === 1 ? 'message' : 'messages'} from the office
            </Text>
            <Feather name="chevron-right" size={18} color={colors.primary} />
          </Pressable>
        ) : null}

        <Section title="Booth progress">
          <Progress label="Voters mapped to a family" value={s.mapped} total={s.total} />
          <Progress label="Phone numbers collected" value={s.withPhone} total={s.total} />
          <Progress label="Voters surveyed" value={s.surveyed} total={s.total} />
          <Progress label="Voted (poll day)" value={s.voted} total={s.total} />
        </Section>

        <Button
          title="Map a new family"
          icon="users"
          onPress={() => navigation.navigate('HouseholdForm', {})}
          style={{ marginBottom: space.md }}
        />
        <Button
          title="Find voters without a family"
          icon="search"
          variant="secondary"
          onPress={() => navigation.navigate('Voters', { filter: 'no_family' })}
        />
      </View>
    </ScrollView>
  );
}

function SyncStrip({ sync }) {
  let tone = colors.success;
  let text = `All changes sent · synced ${timeAgo(sync.lastSyncAt)}`;
  if (sync.syncing) {
    tone = colors.primary;
    text = 'Syncing…';
  } else if (!sync.online) {
    tone = colors.warn;
    text = sync.pending
      ? `Offline · ${sync.pending} changes saved on phone`
      : 'Offline · you can keep working';
  } else if (sync.failed) {
    tone = colors.danger;
    text = `${sync.failed} changes could not be sent. Open More for details.`;
  } else if (sync.pending) {
    tone = colors.warn;
    text = `${sync.pending} changes waiting to be sent`;
  }
  return (
    <View style={styles.strip}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.stripText}>{text}</Text>
        {sync.error && !sync.syncing ? <Text style={styles.stripError}>{sync.error}</Text> : null}
      </View>
      <Pressable onPress={sync.runSync} disabled={sync.syncing} hitSlop={10} style={styles.syncBtn}>
        <Text style={styles.syncBtnText}>Sync now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { backgroundColor: colors.primary, paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xl },
  plateLabel: { ...type.small, color: '#BFD6DC', fontWeight: '600' },
  plateNo: { ...type.plate, color: colors.white, marginTop: -4 },
  plateName: { ...type.heading, color: colors.white },
  plateArea: { ...type.small, color: '#D6E6EA', marginTop: 2 },
  plateCount: { ...type.small, color: '#BFD6DC', marginTop: space.md },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.lg,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: space.md },
  stripText: { ...type.small, color: colors.ink, fontWeight: '600' },
  stripError: { ...type.tiny, color: colors.muted, marginTop: 2 },
  syncBtn: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  syncBtnText: { ...type.small, color: colors.primary, fontWeight: '700' },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.lg,
  },
  alertText: { ...type.small, color: colors.primary, fontWeight: '700', flex: 1, marginLeft: space.sm },
});
