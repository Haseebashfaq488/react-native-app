import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import api, { ApiError, ChatTurn } from "@/lib/api";
import { getSession } from "@/lib/session";
import AppHeader from "@/components/AppHeader";
import { clockTime } from "@/lib/format";

interface DisplayMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  time: string;
  failed?: boolean;
}

const inputClass =
  "flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base";

export default function Chat() {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: "welcome",
      role: "ai",
      content:
        "Hello! Welcome to SupportSync. How can I help you with your account, billing or technical questions today?",
      time: clockTime(new Date()),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convertVisible, setConvertVisible] = useState(false);
  const [subject, setSubject] = useState("");
  const [converting, setConverting] = useState(false);

  // Personalize the AI with the signed-in user's email (falls back to guest).
  useEffect(() => {
    getSession().then((session) => setCustomerEmail(session?.email ?? null));
  }, []);

  /** Reset to a fresh conversation (new chat). */
  function startNewConversation() {
    setConversationId(null);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "ai",
        content:
          "Hello! Welcome to SupportSync. How can I help you with your account, billing or technical questions today?",
        time: clockTime(new Date()),
      },
    ]);
    setInput("");
    setError(null);
  }

  /** Send a message. Lazily creates the conversation on the first send. */
  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    const now = clockTime(new Date());
    const userMsg: DisplayMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      time: now,
    };
    const history: ChatTurn[] = [...messages, userMsg].map(
      ({ role, content }) => ({ role, content })
    );

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      let convId = conversationId;
      if (convId == null) {
        const conv = await api.startChat("guest");
        convId = conv.conversation_id;
        setConversationId(convId);
      }
      const res = await api.sendChat({
        messages: history,
        conversation_id: convId,
        customer_email: customerEmail,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "ai",
          content: res.reply,
          time: clockTime(new Date()),
          failed: res.ai_failed,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Message failed to send."
      );
    } finally {
      setSending(false);
    }
  }

  async function convertToTicket() {
    const subj = subject.trim();
    if (!subj || converting) return;
    if (conversationId == null) {
      Alert.alert(
        "Nothing to convert yet",
        "Send a message first so the AI has context to analyze."
      );
      return;
    }
    setConverting(true);
    try {
      const res = await api.convertChatToTicket({
        conversation_id: conversationId,
        customer_email: customerEmail ?? "guest",
        subject: subj,
      });
      setConvertVisible(false);
      setSubject("");
      Alert.alert(
        "Ticket created",
        `Ticket #${res.ticket_id} was created from this chat.\nDecision: ${res.decision.replace(
          /_/g,
          " "
        )}`,
        [
          {
            text: "View ticket",
            onPress: () => router.push(`/ticket/${res.ticket_id}`),
          },
          { text: "Stay in chat", style: "cancel" },
        ]
      );
    } catch (err) {
      Alert.alert(
        "Could not create ticket",
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setConverting(false);
    }
  }

  // ---------------------------------------------------------------- chat view
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AppHeader
        right={
          <View className="flex-row items-center gap-1.5">
            <Pressable
              onPress={startNewConversation}
              className="bg-gray-100 rounded-lg px-2.5 py-2 flex-row items-center gap-1 active:bg-gray-200"
            >
              <Ionicons name="add-circle-outline" size={14} color="#4f46e5" />
              <Text className="text-indigo-600 text-xs font-semibold">
                New
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setConvertVisible(true)}
              className="bg-indigo-600 rounded-lg px-3 py-2 flex-row items-center gap-1 active:bg-indigo-700"
            >
              <Ionicons name="add" size={14} color="#ffffff" />
              <Text className="text-white text-xs font-semibold">
                Create Ticket
              </Text>
            </Pressable>
          </View>
        }
      />

      {error ? (
        <View className="mx-4 mt-2 bg-red-50 border border-red-100 rounded-xl p-3">
          <Text className="text-red-600 text-xs">{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={[...messages].reverse()}
        inverted
        keyExtractor={(m) => m.id}
        contentContainerClassName="px-4 py-4"
        renderItem={({ item }) => <Bubble message={item} />}
        ListFooterComponent={
          <View className="items-center pb-4">
            <View className="bg-gray-100 rounded-full px-4 py-1.5">
              <Text className="text-gray-400 text-[11px] font-semibold tracking-wide">
                TODAY
              </Text>
            </View>
          </View>
        }
        ListHeaderComponent={
          sending ? (
            <View className="flex-row items-end gap-2 mt-2">
              <AgentAvatar />
              <View className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <Text className="text-gray-400 text-sm">Typing…</Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* Input row */}
      <View className="px-4 py-3 bg-white border-t border-gray-100">
        <View className="flex-row items-center gap-2 bg-gray-100 rounded-full pl-4 pr-1.5 py-1.5">
          <Ionicons name="attach" size={18} color="#9ca3af" />
          <TextInput
            className="flex-1 py-1.5 text-gray-900 text-sm"
            placeholder="Type your message..."
            placeholderTextColor="#9ca3af"
            value={input}
            onChangeText={setInput}
            multiline
          />
          <Pressable
            onPress={send}
            disabled={!input.trim() || sending}
            testID="chat-send"
            className={`w-9 h-9 rounded-full items-center justify-center ${
              input.trim() && !sending
                ? "bg-indigo-600 active:bg-indigo-700"
                : "bg-gray-300"
            }`}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#4f46e5" />
            ) : (
              <Ionicons name="paper-plane" size={15} color="#ffffff" />
            )}
          </Pressable>
        </View>
      </View>

      {/* Convert-to-ticket modal */}
      <Modal
        visible={convertVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConvertVisible(false)}
      >
        <View className="flex-1 bg-black/40 items-center justify-center px-6">
          <View className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 p-5">
            <Text className="text-gray-900 text-lg font-bold mb-1">
              Create ticket from chat
            </Text>
            <Text className="text-gray-500 text-sm mb-4">
              Give it a short subject — the whole conversation will be analyzed
              by the AI agent.
            </Text>
            <TextInput
              className={`${inputClass} mb-4`}
              placeholder="e.g. Refund for double charge"
              placeholderTextColor="#9ca3af"
              value={subject}
              onChangeText={setSubject}
            />
            <Pressable
              onPress={convertToTicket}
              disabled={!subject.trim() || converting}
              className={`py-3.5 rounded-xl items-center mb-2 ${
                subject.trim() && !converting
                  ? "bg-indigo-600 active:bg-indigo-700"
                  : "bg-gray-200"
              }`}
            >
              {converting ? (
                <ActivityIndicator color="#4f46e5" />
              ) : (
                <Text
                  className={`text-base font-semibold ${
                    subject.trim() ? "text-white" : "text-gray-400"
                  }`}
                >
                  Create ticket
                </Text>
              )}
            </Pressable>
            <Pressable onPress={() => setConvertVisible(false)} className="py-2">
              <Text className="text-gray-500 text-center">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function AgentAvatar() {
  return (
    <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center">
      <Ionicons name="headset" size={15} color="#4f46e5" />
    </View>
  );
}

function Bubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <View className="items-end mb-3">
        <View className="bg-indigo-600 rounded-2xl rounded-br-sm px-4 py-3 max-w-[80%]">
          <Text className="text-white text-sm leading-5">
            {message.content}
          </Text>
        </View>
        <View className="flex-row items-center gap-1 mt-1">
          <Text className="text-gray-400 text-[10px]">{message.time}</Text>
          <Ionicons name="checkmark-done" size={12} color="#c7d2fe" />
        </View>
      </View>
    );
  }
  return (
    <View className="items-start mb-3">
      <View className="flex-row items-end gap-2 max-w-[85%]">
        <AgentAvatar />
        <View className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
          <Text className="text-gray-800 text-sm leading-5">
            {message.content}
          </Text>
          {message.failed ? (
            <View className="flex-row items-center gap-1 mt-2 pt-2 border-t border-gray-200">
              <Ionicons name="warning" size={11} color="#b45309" />
              <Text className="text-amber-700 text-[10px] flex-1">
                AI is temporarily unavailable (rate limit) — this is a fallback
                reply.
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text className="text-gray-400 text-[10px] mt-1 ml-10">
        {message.time}
      </Text>
    </View>
  );
}
