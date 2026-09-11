import React, { useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSync } from '../context/SyncContext';
import { useLiveData } from '../components/useLiveData';
import { Empty } from '../components/ui';
import { dateTime } from '../components/format';
import { listNotifications, markAllNotificationsRead } from '../db/repo';
import { colors, radius, space, type } from '../theme';

export default function NotificationsScreen() {
  const { refreshStatus } = useSync();
  const { data } = useLiveData(listNotifications);

  // Opening this screen marks messages as read (after they've been shown once).
  useEffect(() => {
    const t = setTimeout(async () => {
      await markAllNotificationsRead();
      refreshStatus();
    }, 1500);
    return () => clearTimeout(t);
  }, [refreshStatus]);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg }}
      data={data || []}
      keyExtractor={(n) => n.id}
      renderItem={({ item }) => (
        <View style={[styles.card, !item.is_read && styles.unread]}>
          <Text style={styles.title}>{item.title}</Text>
          {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
          <Text style={styles.time}>{dateTime(item.created_at)}</Text>
        </View>
      )}
      ListEmptyComponent={<Empty title="No messages yet" message="Messages from the MLA office appear here after each sync." />}
    />
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md, borderLeftWidth: 4, borderLeftColor: colors.surface },
  unread: { borderLeftColor: colors.primary },
  title: { ...type.heading, color: colors.ink },
  body: { ...type.body, color: colors.ink, marginTop: space.sm, lineHeight: 23 },
  time: { ...type.tiny, color: colors.muted, marginTop: space.md },
});
