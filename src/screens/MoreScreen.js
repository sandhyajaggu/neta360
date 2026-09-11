import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { useLiveData } from '../components/useLiveData';
import { Button, KeyValue, ListRow, Section } from '../components/ui';
import { dateTime, timeAgo } from '../components/format';
import { discardFailedOutbox, listFailedOutbox } from '../db/repo';
import { DEMO_MODE } from '../config';
import { colors, space, type } from '../theme';

const ENTITY_LABEL = {
  voter_mobile: 'Phone / family change',
  household: 'Family',
  survey_response: 'Survey',
  turnout: 'Voted mark',
};

export default function MoreScreen({ navigation }) {
  const { session, logout } = useAuth();
  const sync = useSync();
  const { data: failed } = useLiveData(listFailedOutbox);

  function confirmLogout() {
    const warning = sync.pending
      ? `${sync.pending} changes have not been sent yet and will be lost. Sync first if you can.`
      : 'All booth data will be removed from this phone. You can log in again any time.';
    Alert.alert('Log out?', warning, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  }

  function confirmDiscard() {
    Alert.alert(
      'Discard failed changes?',
      'These changes were rejected by the server. Discarding them restores the office copy on the next sync.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await discardFailedOutbox();
            sync.notifyLocalChange();
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg }}>
      <Section title="You">
        <KeyValue label="Name" value={session.operator.name} />
        <KeyValue label="Mobile" value={session.operator.phone} />
        <KeyValue label="Booth" value={`${session.booth.booth_no} · ${session.booth.name}`} />
      </Section>

      <Section title="Sync">
        <KeyValue label="Internet" value={sync.online ? 'Connected' : 'Offline'} />
        <KeyValue label="Last synced" value={sync.lastSyncAt ? `${timeAgo(sync.lastSyncAt)} (${dateTime(sync.lastSyncAt)})` : 'Never'} />
        <KeyValue label="Waiting to send" value={sync.pending} />
        {sync.error ? <Text style={styles.error}>{sync.error}</Text> : null}
        <Button title="Sync now" icon="refresh-cw" onPress={sync.runSync} loading={sync.syncing} style={{ marginTop: space.lg }} />
      </Section>

      {failed && failed.length ? (
        <Section title={`Could not send (${failed.length})`}>
          {failed.slice(0, 20).map((f) => (
            <View key={f.id} style={styles.failed}>
              <Text style={styles.failedTitle}>{ENTITY_LABEL[f.entity] || f.entity}</Text>
              <Text style={styles.failedErr}>{f.last_error}</Text>
            </View>
          ))}
          <Button title="Discard failed changes" variant="danger" onPress={confirmDiscard} style={{ marginTop: space.md }} />
        </Section>
      ) : null}

      <Section flush>
        <ListRow title="Messages from the office" onPress={() => navigation.navigate('Notifications')} />
      </Section>

      <Button title="Log out" icon="log-out" variant="danger" onPress={confirmLogout} />
      {DEMO_MODE ? <Text style={styles.demo}>Demo mode · sample data only</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  error: { ...type.small, color: colors.danger, marginTop: space.md },
  failed: { paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  failedTitle: { ...type.small, fontWeight: '700', color: colors.ink },
  failedErr: { ...type.tiny, color: colors.danger, marginTop: 2 },
  demo: { ...type.tiny, color: colors.muted, textAlign: 'center', marginTop: space.lg },
});
