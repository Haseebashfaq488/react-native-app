import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter, useFocusEffect } from "expo-router";
import api, { ApiError, TicketListItem } from "@/lib/api";
import AppHeader, { HeaderMenu } from "@/components/AppHeader";
import TicketCard from "@/components/TicketCard";

export default function Home() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setError(null);
      setTickets(await api.listTickets());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const q = search.trim().toLowerCase();
  const filtered = q
    ? tickets.filter(
        (t) =>
          t.subject.toLowerCase().includes(q) ||
          t.customer_name.toLowerCase().includes(q)
      )
    : tickets;
  const openCount = tickets.filter((t) => t.status === "OPEN").length;
  const progressCount = tickets.filter((t) => t.status === "IN_PROGRESS").length;

  return (
    <View className="flex-1 bg-white">
      <AppHeader right={<HeaderMenu />} />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.ticket_id)}
          contentContainerClassName="px-4 pb-32"
          ListHeaderComponent={
            <View>
              {error ? (
                <View className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3">
                  <Text className="text-red-600 text-xs">{error}</Text>
                </View>
              ) : null}

              <View className="flex-row items-center gap-2 bg-gray-100 rounded-xl px-4 mt-4 mb-4">
                <Ionicons name="search" size={17} color="#9ca3af" />
                <TextInput
                  className="flex-1 py-3 text-gray-900 text-sm"
                  placeholder="Search tickets..."
                  placeholderTextColor="#9ca3af"
                  value={search}
                  onChangeText={setSearch}
                />
              </View>

              <View className="bg-white border border-gray-100 rounded-2xl p-4 mb-3 flex-row items-center justify-between">
                <View>
                  <Text className="text-gray-900 font-semibold">
                    Total Tickets
                  </Text>
                  <Text className="text-gray-400 text-xs mt-0.5">All time</Text>
                </View>
                <Text className="text-indigo-600 text-3xl font-bold">
                  {tickets.length}
                </Text>
              </View>

              <View className="flex-row gap-3 mb-6">
                <View className="flex-1 bg-white border border-gray-100 rounded-2xl p-4">
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <View className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                    <Text className="text-gray-400 text-xs">Open</Text>
                  </View>
                  <Text className="text-gray-900 text-2xl font-bold">
                    {openCount}
                  </Text>
                </View>
                <View className="flex-1 bg-white border border-gray-100 rounded-2xl p-4">
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <View className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <Text className="text-gray-400 text-xs">In Progress</Text>
                  </View>
                  <Text className="text-gray-900 text-2xl font-bold">
                    {progressCount}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-gray-900 font-bold text-lg">
                  Active Tickets
                </Text>
                <Pressable onPress={() => router.push("/stats")} hitSlop={6}>
                  <Text className="text-indigo-600 text-sm font-medium">
                    View All
                  </Text>
                </Pressable>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <TicketCard
              ticket={item}
              onPress={() => router.push(`/ticket/${item.ticket_id}`)}
            />
          )}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-gray-400">No tickets found.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor="#4f46e5"
            />
          }
        />
      )}

      <Pressable
        onPress={() => router.push("/create-ticket")}
        className="absolute bottom-6 right-5 w-14 h-14 bg-teal-500 rounded-2xl items-center justify-center active:bg-teal-600"
        style={{
          elevation: 4,
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </Pressable>
    </View>
  );
}
