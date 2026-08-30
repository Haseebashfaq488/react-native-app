import { View, Text, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusPill, statusBarColor } from "@/components/Badges";
import { timeAgo, ticketTag } from "@/lib/format";
import type { TicketListItem } from "@/lib/api";

/**
 * Ticket card per the SupportSync design: left status color bar, #TCK tag,
 * status pill, subject, relative time and a customer-initials avatar.
 */
export default function TicketCard({
  ticket,
  onPress,
}: {
  ticket: TicketListItem;
  onPress?: () => void;
}) {
  const initial = (ticket.customer_name || "?")
    .trim()
    .slice(0, 1)
    .toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-2xl border border-gray-100 mb-3 overflow-hidden active:bg-gray-50"
    >
      <View className="flex-row">
        <View
          className="w-1.5 self-stretch"
          style={{ backgroundColor: statusBarColor(ticket.status) }}
        />
        <View className="flex-1 p-4">
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-gray-400 text-xs font-medium">
              {ticketTag(ticket.ticket_id)}
            </Text>
            <StatusPill status={ticket.status} priority={ticket.priority} />
          </View>

          <Text
            className="text-gray-900 font-semibold text-[15px] leading-5 mb-3"
            numberOfLines={2}
          >
            {ticket.subject}
          </Text>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="time-outline" size={13} color="#9ca3af" />
              <Text className="text-gray-400 text-xs">
                {timeAgo(ticket.created_at)}
              </Text>
            </View>
            <View className="w-7 h-7 rounded-full bg-indigo-100 items-center justify-center">
              <Text className="text-indigo-600 text-xs font-bold">
                {initial}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
