import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store has no working implementation in a plain browser (react-native-web) —
// fall back to localStorage there so the app doesn't crash when run with `expo start --web`.
// Native (Android/iOS) always uses the real, encrypted SecureStore.
const isWeb = Platform.OS === 'web';

export async function getItemAsync(key) {
  if (isWeb) return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key, value) {
  if (isWeb) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key) {
  if (isWeb) {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}
