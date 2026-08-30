import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { getSession } from "@/lib/session";

/** Entry point: signed-in users go to the app, others to Sign In. */
export default function Index() {
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    getSession().then((user) => {
      setLoggedIn(!!user);
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return <Redirect href={loggedIn ? "/(tabs)" : "/login"} />;
}
