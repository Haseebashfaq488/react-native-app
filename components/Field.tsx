import { View, Text, TextInput } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { TextInputProps } from "react-native";

/**
 * Labeled input with a leading icon, per the SupportSync auth design
 * (e.g. "Email Address" + mail icon + "name@company.com" placeholder).
 */
export default function Field({
  label,
  icon,
  ...inputProps
}: { label: string; icon: keyof typeof Ionicons.glyphMap } & TextInputProps) {
  return (
    <View>
      <Text className="text-gray-700 text-sm font-medium mb-2">{label}</Text>
      <View className="flex-row items-center bg-gray-50 rounded-xl px-4 border border-gray-200">
        <Ionicons name={icon} size={17} color="#9ca3af" />
        <TextInput
          className="flex-1 py-3.5 px-3 text-gray-900 text-base"
          placeholderTextColor="#9ca3af"
          {...inputProps}
        />
      </View>
    </View>
  );
}
