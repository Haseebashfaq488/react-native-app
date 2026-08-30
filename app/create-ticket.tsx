import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import api, { ApiError, TicketSubmitResult } from "@/lib/api";
import { getSession } from "@/lib/session";
import AppHeader from "@/components/AppHeader";
import Field from "@/components/Field";
import { StatusPill } from "@/components/Badges";

const DECISION_PILL: Record<string, string> = {
  AUTO_RESPONSE: "bg-emerald-50 text-emerald-600",
  HUMAN_REVIEW: "bg-blue-50 text-blue-600",
  ESCALATE: "bg-red-50 text-red-600",
};

export default function CreateTicket() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TicketSubmitResult | null>(null);
  const [showTrace, setShowTrace] = useState(false);

  // Pre-fill from the signed-in session (still editable).
  useEffect(() => {
    getSession().then((session) => {
      if (session) {
        setName(session.name ?? "");
        setEmail(session.email);
      }
    });
  }, []);

  const isValid =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    subject.trim().length > 0 &&
    message.trim().length > 0;

  async function onSubmit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.submitTicket({
        customer_name: name.trim(),
        customer_email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      setResult(res);
    } catch (err) {
      Alert.alert(
        "Could not submit ticket",
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setResult(null);
    setShowTrace(false);
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
  }

  // ------------------------------------------------------------- result view
  if (result) {
    const confidence = Math.round(result.analysis.confidence * 100);
    return (
      <View className="flex-1 bg-white">
        <AppHeader showBack />
        <ScrollView contentContainerClassName="px-5 py-6">
          <View className="items-center mb-6">
            <View className="w-14 h-14 bg-emerald-50 rounded-full items-center justify-center mb-3">
              <Ionicons name="checkmark" size={28} color="#059669" />
            </View>
            <Text className="text-gray-900 text-xl font-bold">
              Ticket #{result.ticket_id} created
            </Text>
            <Text className="text-gray-500 text-sm mt-1 text-center">
              {result.ai_failed
                ? "Saved and routed to a human agent."
                : "Our AI support agent analyzed your request."}
            </Text>
          </View>

          {result.ai_failed ? (
            <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex-row items-start gap-2.5">
              <Ionicons name="warning" size={16} color="#b45309" />
              <Text className="text-amber-700 text-xs leading-4 flex-1">
                The AI agent is unavailable right now (rate limit). Your ticket
                was saved and sent for human review — the details below are a
                placeholder, not real AI output.
              </Text>
            </View>
          ) : null}

          <View className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-4">
            <View className="flex-row flex-wrap gap-2 mb-4">
              <View
                className={`rounded-full px-2.5 py-1 ${
                  DECISION_PILL[result.decision] ?? "bg-gray-100"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    result.decision === "HUMAN_REVIEW"
                      ? "text-blue-600"
                      : result.decision === "ESCALATE"
                        ? "text-red-600"
                        : "text-emerald-600"
                  }`}
                >
                  {result.decision.replace(/_/g, " ")}
                </Text>
              </View>
              <StatusPill status="OPEN" priority={result.analysis.priority} />
              <View className="bg-gray-100 rounded-full px-2.5 py-1">
                <Text className="text-gray-500 text-xs font-medium">
                  {result.analysis.category.replace(/_/g, " ")}
                </Text>
              </View>
            </View>

            <Text className="text-gray-500 text-xs mb-1">AI confidence</Text>
            <View className="h-2 bg-gray-200 rounded-full mb-1 overflow-hidden">
              <View
                className="h-2 bg-indigo-600 rounded-full"
                style={{ width: `${confidence}%` }}
              />
            </View>
            <Text className="text-gray-400 text-[11px] mb-4">{confidence}%</Text>

            <Text className="text-gray-500 text-xs mb-1">Reasoning</Text>
            <Text className="text-gray-800 text-sm leading-5 mb-4">
              {result.analysis.reasoning_summary}
            </Text>

            <Text className="text-gray-500 text-xs mb-1">Suggested response</Text>
            <Text className="text-gray-800 text-sm leading-5">
              {result.analysis.suggested_response}
            </Text>

            {result.decision === "AUTO_RESPONSE" ? (
              <View className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mt-4 flex-row items-center gap-2">
                <Ionicons name="paper-plane" size={14} color="#059669" />
                <Text className="text-emerald-700 text-xs leading-4 flex-1">
                  {result.auto_response_sent
                    ? "This response was sent to the customer automatically by the AI."
                    : "This ticket was resolved automatically. Response ready in the ticket."}
                </Text>
              </View>
            ) : (
              <View className="bg-blue-50 border border-blue-100 rounded-xl p-3 mt-4 flex-row items-center gap-2">
                <Ionicons name="person-circle" size={14} color="#2563eb" />
                <Text className="text-blue-700 text-xs leading-4 flex-1">
                  This ticket needs human approval. Review and send the response
                  from the ticket page.
                </Text>
              </View>
            )}
          </View>

          <Pressable onPress={() => setShowTrace(!showTrace)} className="mb-4">
            <Text className="text-indigo-600 text-sm font-semibold text-center">
              {showTrace ? "Hide" : "Show"} AI agent steps
            </Text>
          </Pressable>
          {showTrace ? (
            <View className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-4">
              {result.agent_trace.map((step, i) => (
                <View key={i} className="mb-3">
                  <Text className="text-indigo-600 text-xs font-semibold">
                    {i + 1}. {step.tool}
                  </Text>
                  <Text className="text-gray-400 text-xs mt-1">
                    {step.output}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={() => router.replace(`/ticket/${result.ticket_id}`)}
            className="bg-indigo-600 rounded-xl py-4 items-center active:bg-indigo-700 mb-3"
          >
            <Text className="text-white text-base font-semibold">
              View ticket
            </Text>
          </Pressable>
          <Pressable
            onPress={resetForm}
            className="border border-gray-200 rounded-xl py-4 items-center active:bg-gray-50"
          >
            <Text className="text-gray-600 text-base font-semibold">
              Create another ticket
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // --------------------------------------------------------------- form view
  return (
    <View className="relative flex-1 bg-white">
      <AppHeader showBack />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 py-6"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-2xl font-bold text-gray-900 mb-1">
          Create Ticket
        </Text>
        <Text className="text-gray-500 text-sm mb-6">
          Tell us what went wrong — our AI agent will analyze it right away.
        </Text>

        <View className="gap-4 mb-6">
          <Field
            label="Full Name"
            icon="person"
            placeholder="John Doe"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
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
            label="Subject"
            icon="create-outline"
            placeholder="Brief summary of the issue"
            value={subject}
            onChangeText={setSubject}
          />
          <View>
            <Text className="text-gray-700 text-sm font-medium mb-2">
              Message
            </Text>
            <View className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
              <TextInput
                className="text-gray-900 text-base h-24"
                placeholder="Describe the issue in detail…"
                placeholderTextColor="#9ca3af"
                value={message}
                onChangeText={setMessage}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>
        </View>

        <Pressable
          onPress={onSubmit}
          disabled={!isValid || submitting}
          className={`rounded-xl py-4 items-center ${
            !isValid || submitting
              ? "bg-gray-200"
              : "bg-indigo-600 active:bg-indigo-700"
          }`}
        >
          {submitting ? (
            <ActivityIndicator color="#4f46e5" />
          ) : (
            <Text
              className={`text-base font-semibold ${
                isValid ? "text-white" : "text-gray-400"
              }`}
            >
              Submit Ticket
            </Text>
          )}
        </Pressable>

        {submitting ? (
          <View className="absolute inset-0 bg-white/95 items-center justify-center px-8">
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text className="text-gray-900 text-base font-semibold mt-4 text-center">
              Analyzing your ticket with AI…
            </Text>
            <Text className="text-gray-500 text-xs mt-2 text-center">
              This usually takes 10–30 seconds. Please keep the app open.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
