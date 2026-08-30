import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter, Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Field from "@/components/Field";
import api, { ApiError } from "@/lib/api";
import { saveSession } from "@/lib/session";

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSignIn() {
    if (!email.trim() || !password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const user = await api.login({
        email: email.trim(),
        password,
      });
      await saveSession(user);
      router.replace("/(tabs)");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not sign in. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onForgotPassword() {
    if (submitting) return;
    if (!email.trim()) {
      setError("Enter your email address to receive a reset link.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.forgotPassword(email.trim());
      Alert.alert(
        "Check your email",
        `A password reset link was sent to ${email.trim()}.`
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not send the reset link. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-gray-50"
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-1 justify-center px-5 py-8">
        <View className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm shadow-gray-200">
          <View className="items-center mb-6">
            <View className="w-16 h-16 bg-indigo-600 rounded-full items-center justify-center mb-3">
              <Ionicons name="headset" size={30} color="#ffffff" />
            </View>
            <Text className="text-indigo-600 text-2xl font-bold">
              SupportSync
            </Text>
            <Text className="text-gray-500 mt-1">
              Sign in to manage your tickets.
            </Text>
          </View>

          {error ? (
            <View className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
              <Text className="text-red-600 text-xs">{error}</Text>
            </View>
          ) : null}

          <View className="gap-4 mb-6">
            <Field
              label="Email Address"
              icon="mail"
              placeholder="name@company.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Field
              label="Password"
              icon="lock-closed"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <Pressable
            onPress={onSignIn}
            disabled={!email.trim() || !password || submitting}
            className={`rounded-xl py-4 flex-row items-center justify-center gap-2 ${
              !email.trim() || !password || submitting
                ? "bg-gray-300"
                : "bg-indigo-600 active:bg-indigo-700"
            }`}
          >
            {submitting ? (
              <ActivityIndicator color="#4f46e5" />
            ) : (
              <>
                <Text
                  className={`text-base font-semibold ${
                    email.trim() && password ? "text-white" : "text-gray-500"
                  }`}
                >
                  Sign In
                </Text>
                {email.trim() && password ? (
                  <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                ) : null}
              </>
            )}
          </Pressable>

          <View className="flex-row justify-between mt-5">
            <Pressable hitSlop={6} onPress={onForgotPassword}>
              <Text className="text-indigo-600 text-sm font-medium">
                Forgot Password?
              </Text>
            </Pressable>
            <Link href="/sign-up" asChild>
              <Pressable hitSlop={6}>
                <Text className="text-gray-500 text-sm">Create Account</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
