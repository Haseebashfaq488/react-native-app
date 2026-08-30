import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import api, { ApiError, TicketListItem } from "@/lib/api";
import AppHeader, { HeaderMenu } from "@/components/AppHeader";
import TicketCard from "@/components/TicketCard";

export default function Stats() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const count = (status: string) =>
    tickets.filter((t) => t.status === status).length;

  const cards = [
    { label: "Open", value: count("OPEN"), dot: "bg-teal-500" },
    { label: "In Progress", value: count("IN_PROGRESS"), dot: "bg-blue-500" },
    { label: "Resolved", value: count("RESOLVED"), dot: "bg-emerald-500" },
    { label: "Escalated", value: count("ESCALATED"), dot: "bg-red-500" },
  ];

  return (
    <View className="flex-1 bg-white">
      <AppHeader right={<HeaderMenu />} />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => String(item.ticket_id)}
          contentContainerClassName="px-4 pb-8"
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
          ListHeaderComponent={
            <View>
              {error ? (
                <View className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3">
                  <Text className="text-red-600 text-xs">{error}</Text>
                </View>
              ) : null}

              <View className="bg-white border border-gray-100 rounded-2xl p-4 mt-4 mb-3 flex-row items-center justify-between">
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

              <View className="flex-row flex-wrap gap-3 mb-6">
                {cards.map((c) => (
                  <View
                    key={c.label}
                    className="bg-white border border-gray-100 rounded-2xl p-4 w-[47%] flex-grow"
                  >
                    <View className="flex-row items-center gap-1.5 mb-1">
                      <View className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                      <Text className="text-gray-400 text-xs">{c.label}</Text>
                    </View>
                    <Text className="text-gray-900 text-2xl font-bold">
                      {c.value}
                    </Text>
                  </View>
                ))}
              </View>

              <Text className="text-gray-900 font-bold text-lg mb-3">
                All Tickets
              </Text>
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
        />
      )}
    </View>
  );
}
