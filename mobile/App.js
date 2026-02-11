import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import RootNavigator from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
          <StatusBar style="auto" />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
