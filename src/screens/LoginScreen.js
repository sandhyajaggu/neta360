import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Button, Field } from '../components/ui';
import { colors, radius, space, type } from '../theme';
import { DEMO_MODE } from '../config';

export default function LoginScreen() {
  const { login, expired } = useAuth();
  const [phone, setPhone] = useState(DEMO_MODE ? '9000000001' : '');
  const [password, setPassword] = useState(DEMO_MODE ? 'demo123' : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit() {
    if (!/^\d{10}$/.test(phone.trim())) return setError('Enter your 10-digit mobile number.');
    if (!password) return setError('Enter your password.');
    setBusy(true);
    setError(null);
    try {
      await login(phone, password);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brand}>
              <Text style={styles.brandGreen}>Neta</Text>
              <Text style={styles.brandOrange}>360</Text>
            </Text>
            <View style={styles.logoSpacer} />
          </View>
          <Text style={styles.tagline}>Booth operator app</Text>

          <View style={styles.card}>
            {expired ? (
              <Text style={styles.notice}>
                Your login has expired. Log in again — your saved work is still on this phone.
              </Text>
            ) : null}
            <Field
              label="Mobile number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="10-digit number"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Password from your admin"
              onSubmitEditing={onSubmit}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Log in" onPress={onSubmit} loading={busy} />
            {DEMO_MODE ? (
              <Text style={styles.demo}>Demo mode is on. Sample data is used and nothing is sent to a server.</Text>
            ) : null}
          </View>
          <Text style={styles.footer}>Forgot your password? Ask the MLA office admin to reset it.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  content: { flexGrow: 1, justifyContent: 'center', padding: space.xl },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 54, height: 54, marginRight: space.md },
  logoSpacer: { width: 54 + space.md },
  brand: { ...type.plate, fontSize: 40, lineHeight: 54 },
  brandGreen: { color: '#3FA85E' }, // logo's brand green, lightened for contrast on this dark background
  brandOrange: { color: '#FD7118' }, // logo's exact brand orange
  tagline: { ...type.body, color: '#BFD6DC', marginBottom: space.xl, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.xl },
  notice: {
    ...type.small,
    color: colors.warn,
    backgroundColor: colors.warnSoft,
    padding: space.md,
    borderRadius: radius.sm,
    marginBottom: space.lg,
  },
  error: { ...type.small, color: colors.danger, fontWeight: '600', marginBottom: space.md },
  demo: { ...type.tiny, color: colors.muted, marginTop: space.md, textAlign: 'center' },
  footer: { ...type.small, color: '#BFD6DC', textAlign: 'center', marginTop: space.xl },
});
