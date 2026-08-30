import { View, Text, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Screen header per the SupportSync design: optional back arrow,
 * indigo "SupportSync" title, optional right slot (menu / button).
 * Padded below the device status bar (battery / clock) via safe-area insets.
 */
export default function AppHeader({
  title = "SupportSync",
  showBack = false,
  right,
}: {
  title?: string;
  showBack?: boolean;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-center justify-between px-4 pb-3 bg-white border-b border-gray-100"
      style={{ paddingTop: insets.top + 6 }}
    >
      <View className="w-20 items-start">
        {showBack ? (
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </Pressable>
        ) : null}
      </View>

      <Text className="text-indigo-600 text-lg font-bold">{title}</Text>

      <View className="w-20 items-end">{right}</View>
    </View>
  );
}

/** Vertical "⋮" menu icon button (right slot of the header). */
export function HeaderMenu({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <Ionicons name="ellipsis-vertical" size={20} color="#374151" />
    </Pressable>
  );
}
