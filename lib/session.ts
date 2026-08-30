import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "./api";

const KEY = "supportsync.session";

/** Persist the signed-in user across app restarts. */
export async function saveSession(user: AuthUser): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(user));
}

export async function getSession(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
