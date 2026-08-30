import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter, useFocusEffect } from "expo-router";
import api, { ApiError, TicketListItem, AuthUser } from "@/lib/api";
import { getSession, clearSession } from "@/lib/session";
import AppHeader, { HeaderMenu } from "@/components/AppHeader";

const PLAN_LABEL: Record<string, string> = {
  free: "Free Plan",
  pro: "Pro Plan",
  enterprise: "Pro Enterprise",
};

export default function Profile() {
  const router = useRouter();
  const [resolvedCount, setResolvedCount] = useState<number | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSession().then((session) => {
        if (!cancelled) setUser(session);
      });
      api
        .listTickets()
        .then((tickets: TicketListItem[]) => {
          if (!cancelled) {
            setResolvedCount(
              tickets.filter((t) => t.status === "RESOLVED").length
            );
          }
        })
        .catch(() => {
          if (!cancelled) setResolvedCount(0);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  function comingSoon(feature: string) {
    Alert.alert(feature, "This section is coming soon.");
  }

  async function onChangePassword() {
    const email = user?.email;
    if (!email) {
      Alert.alert("Not signed in", "Sign in to change your password.");
      return;
    }
    setSendingReset(true);
    try {
      await api.forgotPassword(email);
      Alert.alert(
        "Check your email",
        `A password reset link was sent to ${email}. Click it to create a new password.`
      );
    } catch (err) {
      Alert.alert(
        "Could not send reset link",
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSendingReset(false);
    }
  }

  const planKey = (user?.plan ?? "free").toLowerCase();
  const planLabel = PLAN_LABEL[planKey] ?? "Free Plan";
  const email = user?.email || "guest@novaware.dev";

  // Demo billing history — for demonstration only.
  const billing = [
    {
      id: 1,
      title: "Pro Enterprise subscription",
      date: "Sep 12, 2026",
      amount: "$49.00",
      status: "Paid",
    },
    {
      id: 2,
      title: "Pro Enterprise subscription",
      date: "Aug 12, 2026",
      amount: "$49.00",
      status: "Paid",
    },
    {
      id: 3,
      title: "Pro Enterprise subscription",
      date: "Jul 12, 2026",
      amount: "$49.00",
      status: "Paid",
    },
  ];

  // ------------------------------------------------------------- profile view
  return (
    <View className="flex-1 bg-white">
      <AppHeader right={<HeaderMenu />} />
      <ScrollView contentContainerClassName="px-4 pb-10">
        {/* Profile card */}
        <View className="items-center mt-5 mb-6">
          <View className="w-20 h-20 rounded-full bg-indigo-100 items-center justify-center mb-3">
            <Text className="text-indigo-600 text-2xl font-bold">
              {(user?.name || "G").trim().slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text className="text-gray-900 text-2xl font-bold">
            {user?.name?.trim() || "Guest User"}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-1.5">
            <Ionicons name="mail" size={13} color="#9ca3af" />
            <Text className="text-gray-500 text-sm">{email}</Text>
          </View>
          <View className="flex-row gap-2 mt-3">
            <View className="bg-indigo-50 rounded-full px-3 py-1.5">
              <Text className="text-indigo-600 text-xs font-medium">
                {planLabel}
              </Text>
            </View>
            <View className="bg-gray-100 rounded-full px-3 py-1.5 flex-row items-center gap-1">
              <Ionicons name="location" size={12} color="#6b7280" />
              <Text className="text-gray-500 text-xs">NovaWare Cloud</Text>
            </View>
          </View>
        </View>

        {/* Current plan card */}
        <View className="bg-indigo-600 rounded-2xl p-4 mb-4">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-indigo-200 text-[11px] font-semibold tracking-widest">
              CURRENT PLAN
            </Text>
            <Ionicons name="diamond" size={18} color="#ffffff" />
          </View>
          <Text className="text-white text-2xl font-bold mb-3">
            {planLabel}
          </Text>
          <View className="bg-white/10 rounded-xl p-3 mb-3">
            <Text className="text-white/90 text-sm">Renews on Oct 12, 2026</Text>
            <Text className="text-white/60 text-xs mt-0.5">
              14 team members included
            </Text>
          </View>
          <Pressable
            onPress={() => comingSoon("Manage Subscription")}
            className="border border-white/40 rounded-xl py-2.5 flex-row items-center justify-center gap-1.5 active:bg-white/10"
          >
            <Text className="text-white text-sm font-medium">
              Manage Subscription
            </Text>
            <Ionicons name="open-outline" size={13} color="#ffffff" />
          </Pressable>
        </View>

        {/* Stats row */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl p-4 items-center">
            <Ionicons name="ticket" size={18} color="#4f46e5" />
            <Text className="text-gray-900 text-2xl font-bold mt-1">
              {resolvedCount ?? "—"}
            </Text>
            <Text className="text-gray-400 text-xs mt-0.5">
              Tickets Resolved
            </Text>
          </View>
          <View className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl p-4 items-center">
            <Ionicons name="person" size={18} color="#4f46e5" />
            <Text className="text-gray-900 text-2xl font-bold mt-1">
              {user?.id != null ? `#${user.id}` : "—"}
            </Text>
            <Text className="text-gray-400 text-xs mt-0.5">Customer ID</Text>
          </View>
        </View>

        {/* Personal information */}
        <View className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-4">
          <View className="flex-row items-center gap-2 mb-3">
            <Ionicons name="person" size={16} color="#374151" />
            <Text className="text-gray-900 font-bold">Personal Information</Text>
          </View>
          <InfoRow label="Name" value={user?.name?.trim() || "Not set"} icon="person-outline" />
          <InfoRow label="Email" value={email} icon="mail-outline" last />
        </View>

        {/* Security */}
        <View className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-4">
          <View className="flex-row items-center gap-2 mb-3">
            <Ionicons name="shield-checkmark" size={16} color="#374151" />
            <Text className="text-gray-900 font-bold">Security</Text>
          </View>
          <InfoRow label="Email" value={email} icon="mail-outline" />
          <InfoRow label="Password" value="••••••••" icon="lock-closed-outline" last />
          <Pressable
            onPress={onChangePassword}
            disabled={sendingReset}
            className="mt-3 bg-indigo-600 rounded-xl py-3 flex-row items-center justify-center gap-2 active:bg-indigo-700"
          >
            {sendingReset ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="key" size={14} color="#ffffff" />
                <Text className="text-white text-sm font-semibold">
                  Change Password
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Billing history (demo) */}
        <View className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-4">
          <View className="flex-row items-center gap-2 mb-3">
            <Ionicons name="card" size={16} color="#374151" />
            <Text className="text-gray-900 font-bold">Billing History</Text>
          </View>
          {billing.map((b) => (
            <View
              key={b.id}
              className="flex-row items-center justify-between py-3 border-b border-gray-100"
            >
              <View className="flex-1 pr-3">
                <Text className="text-gray-800 text-sm font-medium">
                  {b.title}
                </Text>
                <Text className="text-gray-400 text-xs mt-0.5">
                  {b.date} · {b.amount}
                </Text>
              </View>
              <Text className="text-emerald-600 text-xs font-semibold">
                {b.status}
              </Text>
            </View>
          ))}
        </View>

        {/* Log out */}
        <Pressable
          onPress={async () => {
            await clearSession();
            router.replace("/login");
          }}
          className="border border-red-200 rounded-xl py-3.5 flex-row items-center justify-center gap-2 active:bg-red-50"
        >
          <Ionicons name="log-out-outline" size={17} color="#ef4444" />
          <Text className="text-red-500 text-sm font-medium">
            Log Out of SupportSync
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function InfoRow({
  label,
  value,
  icon,
  last,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center py-3 ${
        last ? "" : "border-b border-gray-100"
      }`}
    >
      <View className="w-8 items-center">
        <Ionicons name={icon} size={16} color="#9ca3af" />
      </View>
      <View className="flex-1 pr-3">
        <Text className="text-gray-400 text-xs">{label}</Text>
        <Text className="text-gray-800 text-sm font-medium mt-0.5">{value}</Text>
      </View>
    </View>
  );
}
