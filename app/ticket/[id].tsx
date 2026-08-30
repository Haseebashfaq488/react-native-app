import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import api, {
  ApiError,
  TicketDetail,
  ActivityLog,
} from "@/lib/api";
import AppHeader from "@/components/AppHeader";
import { StatusPill, statusBarColor } from "@/components/Badges";
import { ticketTag } from "@/lib/format";

export default function TicketDetailPage() {
  const params = useLocalSearchParams<{ id: string }>();
  const ticketId = Number(params.id);

  const [data, setData] = useState<TicketDetail | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function load() {
        if (!Number.isFinite(ticketId)) {
          setError("Invalid ticket id.");
          setLoading(false);
          return;
        }
        try {
          const [detail, logs] = await Promise.all([
            api.getTicket(ticketId),
            api.getTicketActivity(ticketId).catch(() => [] as ActivityLog[]),
          ]);
          if (!cancelled) {
            setData(detail);
            setActivity(logs);
            setError(null);
            setResponseText(detail.analysis?.suggested_response ?? "");
            setSentMessage(null);
          }
        } catch (err) {
          if (!cancelled) {
            setError(
              err instanceof ApiError ? err.message : "Failed to load ticket."
            );
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      setLoading(true);
      load();
      return () => {
        cancelled = true;
      };
    }, [ticketId])
  );

  const isHumanReview =
    data?.ticket.status === "IN_PROGRESS" ||
    data?.analysis?.final_decision === "HUMAN_REVIEW";

  async function onApprove() {
    if (!data || sending) return;
    setSending(true);
    try {
      await api.approveTicket(data.ticket.id);
      setSentMessage("Response approved and sent to the customer.");
      Alert.alert("Response sent", "The approved response was emailed to the customer.");
    } catch (err) {
      Alert.alert(
        "Could not send",
        err instanceof ApiError ? err.message : "Something went wrong."
      );
    } finally {
      setSending(false);
    }
  }

  async function onSend() {
    if (!data || sending) return;
    const text = responseText.trim();
    if (!text) {
      Alert.alert("Empty response", "Write a response before sending.");
      return;
    }
    setSending(true);
    try {
      await api.respondToTicket(data.ticket.id, text);
      setSentMessage("Your response was sent to the customer.");
      Alert.alert("Response sent", "Your response was emailed to the customer.");
    } catch (err) {
      Alert.alert(
        "Could not send",
        err instanceof ApiError ? err.message : "Something went wrong."
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <AppHeader showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View className="flex-1 bg-white">
        <AppHeader showBack />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-red-500 text-center mb-2">
            {error ?? "Ticket not found."}
          </Text>
          <Text className="text-gray-400 text-sm text-center">
            It may not exist yet, or the backend is unreachable.
          </Text>
        </View>
      </View>
    );
  }

  const t = data.ticket;
  const a = data.analysis;
  const confidence = a ? Math.round(a.confidence * 100) : 0;

  // ------------------------------------------------------------ detail view
  return (
    <View className="flex-1 bg-white">
      <AppHeader showBack />
      <ScrollView contentContainerClassName="px-5 py-5">
        {/* Header card */}
        <View
          className="bg-white border border-gray-100 rounded-2xl mb-4 overflow-hidden"
          style={{ borderLeftWidth: 4, borderLeftColor: statusBarColor(t.status) }}
        >
          <View className="p-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-400 text-xs font-medium">
                {ticketTag(t.id)}
              </Text>
              <StatusPill status={t.status} priority={t.priority} />
            </View>
            <Text className="text-gray-900 text-lg font-bold leading-6">
              {t.subject}
            </Text>
            <Text className="text-gray-400 text-xs mt-2">
              Created {new Date(t.created_at).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Message */}
        <SectionCard title="Message">
          <Text className="text-gray-800 text-sm leading-5">{t.message}</Text>
        </SectionCard>

        {/* Customer */}
        {data.customer ? (
          <SectionCard title="Customer">
            <Text className="text-gray-900 text-sm font-medium">
              {data.customer.name || "Unknown"}
            </Text>
            <Text className="text-gray-500 text-xs mt-0.5">
              {data.customer.email}
            </Text>
            <Text className="text-gray-400 text-xs mt-1">
              Plan: {data.customer.plan} · Payment:{" "}
              {data.customer.payment_status}
            </Text>
          </SectionCard>
        ) : null}

        {/* AI analysis */}
        {a ? (
          <SectionCard title="AI analysis">
            <View className="flex-row flex-wrap gap-2 mb-3">
              <View className="bg-indigo-50 rounded-full px-2.5 py-1">
                <Text className="text-indigo-600 text-xs font-semibold">
                  {(a.final_decision ?? a.recommended_action).replace(/_/g, " ")}
                </Text>
              </View>
              <View className="bg-gray-100 rounded-full px-2.5 py-1">
                <Text className="text-gray-500 text-xs font-medium">
                  {a.priority}
                </Text>
              </View>
              <View className="bg-gray-100 rounded-full px-2.5 py-1">
                <Text className="text-gray-500 text-xs font-medium">
                  {a.category.replace(/_/g, " ")}
                </Text>
              </View>
            </View>

            <Text className="text-gray-500 text-xs mb-1">Confidence</Text>
            <View className="h-2 bg-gray-200 rounded-full mb-1 overflow-hidden">
              <View
                className="h-2 bg-indigo-600 rounded-full"
                style={{ width: `${confidence}%` }}
              />
            </View>
            <Text className="text-gray-400 text-[11px] mb-3">{confidence}%</Text>

            <Text className="text-gray-500 text-xs mb-1">Reasoning</Text>
            <Text className="text-gray-800 text-sm leading-5 mb-3">
              {a.reasoning_summary}
            </Text>

            <Text className="text-gray-500 text-xs mb-1">
              Suggested response
            </Text>
            <Text className="text-gray-800 text-sm leading-5">
              {a.suggested_response}
            </Text>

            {a.ai_failed ? (
              <Text className="text-amber-600 text-xs mt-3">
                Note: AI analysis failed — defaulting to human review.
              </Text>
            ) : null}
          </SectionCard>
        ) : null}

        {/* Response box — AI answers automatically, human reviews & sends */}
        {(a || responseText || t.status === "IN_PROGRESS") ? (
          <View className="bg-white border border-indigo-100 rounded-2xl p-4 mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-900 font-bold">Send Response</Text>
              <StatusPill status={t.status} priority={t.priority} />
            </View>

            {isHumanReview ? (
              <View className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3 flex-row items-start gap-2">
                <Ionicons name="person-circle" size={16} color="#2563eb" />
                <Text className="text-blue-700 text-xs leading-4 flex-1">
                  This ticket needs human approval. Review the response below,
                  then approve and send it to the customer.
                </Text>
              </View>
            ) : t.status === "RESOLVED" ? (
              <View className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-3 flex-row items-start gap-2">
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text className="text-emerald-700 text-xs leading-4 flex-1">
                  This ticket was resolved automatically by the AI. You can still
                  edit and resend a response to the customer if needed.
                </Text>
              </View>
            ) : null}

            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-gray-900 text-sm min-h-[120px]"
              placeholder="Type the response to send to the customer…"
              placeholderTextColor="#9ca3af"
              value={responseText}
              onChangeText={setResponseText}
              multiline
              textAlignVertical="top"
            />

            {sentMessage ? (
              <View className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mt-3 flex-row items-center gap-2">
                <Ionicons name="paper-plane" size={14} color="#4f46e5" />
                <Text className="text-indigo-700 text-xs flex-1">
                  {sentMessage}
                </Text>
              </View>
            ) : null}

            {isHumanReview ? (
              <View className="flex-row gap-2 mt-3">
                <Pressable
                  onPress={onApprove}
                  disabled={sending}
                  className="flex-1 bg-indigo-600 rounded-xl py-3 items-center active:bg-indigo-700"
                >
                  {sending ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-white text-sm font-semibold">
                      Approve & Send
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={onSend}
                  disabled={sending || !responseText.trim()}
                  className="flex-1 bg-gray-900 rounded-xl py-3 items-center active:bg-gray-800"
                >
                  {sending ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-white text-sm font-semibold">
                      Send Custom
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={onSend}
                disabled={sending || !responseText.trim()}
                className={`mt-3 rounded-xl py-3 items-center ${
                  responseText.trim() && !sending
                    ? "bg-indigo-600 active:bg-indigo-700"
                    : "bg-gray-200"
                }`}
              >
                {sending ? (
                  <ActivityIndicator color="#4f46e5" />
                ) : (
                  <Text className="text-white text-sm font-semibold">
                    Send Response
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        ) : null}

        {/* Activity timeline */}
        <SectionCard title="Activity">
          {activity.length === 0 ? (
            <Text className="text-gray-400 text-sm">No activity yet.</Text>
          ) : (
            activity.map((entry, i) => (
              <View key={entry.id ?? i} className="flex-row gap-3 mb-4">
                <View className="items-center pt-1">
                  <View className="w-2 h-2 rounded-full bg-indigo-600" />
                  {i < activity.length - 1 ? (
                    <View className="w-px flex-1 bg-gray-200 mt-1" />
                  ) : null}
                </View>
                <View className="flex-1">
                  <Text className="text-gray-800 text-sm font-medium">
                    {entry.action.replace(/_/g, " ")}
                  </Text>
                  <Text className="text-gray-400 text-xs mt-0.5">
                    {entry.actor} · {new Date(entry.created_at).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </SectionCard>
      </ScrollView>
    </View>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-4">
      <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">
        {title}
      </Text>
      {children}
    </View>
  );
}
