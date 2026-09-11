import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PARTIES } from '../config';
import { colors, radius, space, type } from '../theme';

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style }) {
  const v = VARIANTS[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? v.pressed : v.bg, borderColor: v.border },
        off && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Feather name={icon} size={18} color={v.fg} style={{ marginRight: space.sm }} /> : null}
          <Text style={[styles.buttonText, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const VARIANTS = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.white, border: colors.primary },
  secondary: { bg: colors.surface, pressed: colors.primarySoft, fg: colors.primary, border: colors.primary },
  success: { bg: colors.success, pressed: '#145C39', fg: colors.white, border: colors.success },
  danger: { bg: colors.surface, pressed: colors.dangerSoft, fg: colors.danger, border: colors.danger },
};

export function Field({ label, hint, error, style, ...inputProps }) {
  return (
    <View style={[{ marginBottom: space.lg }, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, error && { borderColor: colors.danger }]}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function SearchBar({ value, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={styles.search}>
      <Feather name="search" size={18} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.searchInput}
        autoCorrect={false}
        autoCapitalize="none"
        keyboardType={keyboardType}
        returnKeyType="search"
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={12} accessibilityLabel="Clear search">
          <Feather name="x" size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

// flush = list rows run edge to edge inside the section.
export function Section({ title, right, children, style, flush }) {
  return (
    <View style={[styles.section, flush && styles.sectionFlush, style]}>
      {title ? (
        <View style={[styles.sectionHead, flush && { paddingHorizontal: space.lg }]}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const TONES = {
  neutral: [colors.bg, colors.muted],
  success: [colors.successSoft, colors.success],
  warn: [colors.warnSoft, colors.warn],
  danger: [colors.dangerSoft, colors.danger],
  primary: [colors.primarySoft, colors.primary],
};

export function Badge({ label, tone = 'neutral' }) {
  const [bg, fg] = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={[styles.chipText, active && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function Progress({ label, value, total }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <View style={{ marginBottom: space.lg }}>
      <View style={styles.progressHead}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>
          {value} of {total} · {pct}%
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: pct === 100 ? colors.success : colors.primary }]} />
      </View>
    </View>
  );
}

export function ListRow({ title, subtitle, meta, right, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.primarySoft }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? <View style={styles.rowMeta}>{meta}</View> : null}
      </View>
      {right}
      {onPress ? <Feather name="chevron-right" size={20} color={colors.muted} style={{ marginLeft: space.sm }} /> : null}
    </Pressable>
  );
}

export function Empty({ title, message, action }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyText}>{message}</Text> : null}
      {action ? <View style={{ marginTop: space.lg, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function partyColor(code) {
  return PARTIES.find((p) => p.code === code)?.color || colors.muted;
}

// Asks the operator which party they think the voter supports. This is the
// operator's own guess — ballots are secret, so it is never confirmed data.
export function PartyPickerModal({ visible, title, subtitle, current, onSelect, onClose }) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle}>{title || 'Which party do you think they voted for?'}</Text>
          {subtitle ? <Text style={styles.modalSubtitle}>{subtitle}</Text> : null}
          {PARTIES.map((p) => (
            <Pressable
              key={p.code}
              onPress={() => onSelect(p.code)}
              style={({ pressed }) => [
                styles.partyRow,
                current === p.code && { borderColor: p.color, backgroundColor: colors.bg },
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={[styles.partyDot, { backgroundColor: p.color }]} />
              <Text style={styles.partyRowText}>{p.code}</Text>
              {current === p.code ? <Feather name="check" size={18} color={p.color} /> : null}
            </Pressable>
          ))}
          <Pressable onPress={onClose} style={styles.modalCancel}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function KeyValue({ label, value }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value == null || value === '' ? '—' : String(value)}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center' },
  buttonText: { ...type.body, fontWeight: '700' },
  label: { ...type.small, fontWeight: '600', color: colors.ink, marginBottom: space.xs },
  input: {
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    ...type.body,
    color: colors.ink,
  },
  hint: { ...type.tiny, color: colors.muted, marginTop: space.xs },
  error: { ...type.tiny, color: colors.danger, marginTop: space.xs, fontWeight: '600' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 50,
  },
  searchInput: { flex: 1, ...type.body, color: colors.ink, marginHorizontal: space.sm, paddingVertical: space.sm },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.lg,
  },
  sectionFlush: { paddingHorizontal: 0, paddingBottom: 0, overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  sectionTitle: { ...type.heading, color: colors.ink },
  badge: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm, marginRight: space.xs },
  badgeText: { ...type.tiny, fontWeight: '700' },
  chip: {
    paddingHorizontal: space.md,
    height: 36,
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: space.sm,
  },
  chipText: { ...type.small, fontWeight: '600', color: colors.ink },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.xs },
  progressLabel: { ...type.small, fontWeight: '600', color: colors.ink },
  progressValue: { ...type.small, color: colors.muted },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.bg, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 64,
  },
  rowTitle: { ...type.body, fontWeight: '600', color: colors.ink },
  rowSub: { ...type.small, color: colors.muted, marginTop: 2 },
  rowMeta: { flexDirection: 'row', marginTop: space.xs, flexWrap: 'wrap' },
  empty: { padding: space.xxl, alignItems: 'center' },
  emptyTitle: { ...type.heading, color: colors.ink, textAlign: 'center' },
  emptyText: { ...type.small, color: colors.muted, textAlign: 'center', marginTop: space.sm, lineHeight: 20 },
  kv: { flexDirection: 'row', paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  kvLabel: { ...type.small, color: colors.muted, width: 120 },
  kvValue: { ...type.small, color: colors.ink, fontWeight: '600', flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(22,35,44,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg },
  modalTitle: { ...type.heading, color: colors.ink, marginBottom: space.xs },
  modalSubtitle: { ...type.small, color: colors.muted, marginBottom: space.md },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    marginTop: space.sm,
  },
  partyDot: { width: 14, height: 14, borderRadius: 7, marginRight: space.md },
  partyRowText: { ...type.body, fontWeight: '600', color: colors.ink, flex: 1 },
  modalCancel: { marginTop: space.lg, alignItems: 'center', paddingVertical: space.sm },
  modalCancelText: { ...type.body, color: colors.muted, fontWeight: '600' },
});
