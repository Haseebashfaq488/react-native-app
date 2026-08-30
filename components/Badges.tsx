import { View, Text } from "react-native";

/**
 * Light-theme status/priority pills per the SupportSync design:
 * soft colored background + colored text (e.g. Open = teal, In Progress = blue,
 * Urgent = red). Class strings stay as full literals for the Tailwind scanner.
 */

const PILL_STYLES: Record<string, string> = {
  OPEN: "bg-teal-50 text-teal-600",
  IN_PROGRESS: "bg-blue-50 text-blue-600",
  RESOLVED: "bg-emerald-50 text-emerald-600",
  ESCALATED: "bg-red-50 text-red-600",
  CRITICAL: "bg-red-50 text-red-600",
  URGENT: "bg-red-50 text-red-600",
};
const PILL_DEFAULT = "bg-gray-100 text-gray-500";

/** Status label; HIGH/CRITICAL priority is surfaced as "Urgent". */
export function StatusPill({
  status,
  priority,
}: {
  status: string;
  priority?: string;
}) {
  const isUrgent =
    priority === "HIGH" || priority === "CRITICAL" || status === "URGENT";
  const label = isUrgent ? "Urgent" : status.replace(/_/g, " ");
  const key = isUrgent ? "URGENT" : status;
  return (
    <View className={`rounded-full px-2.5 py-1 ${PILL_STYLES[key] ?? PILL_DEFAULT}`}>
      <Text className="text-xs font-semibold">{label}</Text>
    </View>
  );
}

/** Left accent bar color for ticket cards, by status. */
export const STATUS_BAR_COLOR: Record<string, string> = {
  OPEN: "#14b8a6", // teal
  IN_PROGRESS: "#3b82f6", // blue
  RESOLVED: "#10b981", // emerald
  ESCALATED: "#ef4444", // red
};

export function statusBarColor(status: string): string {
  return STATUS_BAR_COLOR[status] ?? "#9ca3af";
}
