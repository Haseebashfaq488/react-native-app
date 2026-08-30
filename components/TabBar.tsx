import { View, Text, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

/** Tab config: route name → icon + label (per the SupportSync design). */
const TABS: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; label: string }
> = {
  index: { icon: "grid", label: "Home" },
  chat: { icon: "chatbubble-ellipses", label: "Chat" },
  stats: { icon: "stats-chart", label: "Stats" },
  profile: { icon: "person", label: "Profile" },
};

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-white border-t border-gray-100 pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      <View className="flex-row items-center justify-around px-3">
        {state.routes.map((route, i) => {
          const active = state.index === i;
          const tab = TABS[route.name] ?? {
            icon: "ellipse" as const,
            label: route.name,
          };
          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              accessibilityRole="button"
              className={`flex-row items-center gap-2 px-4 py-2.5 rounded-full ${
                active ? "bg-indigo-600" : ""
              }`}
            >
              <Ionicons
                name={tab.icon}
                size={18}
                color={active ? "#ffffff" : "#9ca3af"}
              />
              <Text
                className={`text-sm ${
                  active ? "text-white font-semibold" : "text-gray-400"
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
