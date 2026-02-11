import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      await login(res.data.access_token);
    } catch (err) {
      const msg =
        err.response?.data?.detail || "Invalid credentials. Please try again.";
      Alert.alert("Login Failed", msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#1a1a2e", "#16213e", "#0f3460"]} style={styles.gradient}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand */}
          <View style={styles.brandContainer}>
            <Text style={styles.appName}>Pulse</Text>
            <Text style={styles.subtitle}>
              Welcome back! Please login to your account.
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="name@company.com"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {isLoading ? (
              <ActivityIndicator
                size="large"
                color="#764ba2"
                style={{ marginTop: 16 }}
              />
            ) : (
              <TouchableOpacity style={styles.button} onPress={submit} activeOpacity={0.85}>
                <Text style={styles.buttonText}>Login to Pulse</Text>
              </TouchableOpacity>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Don't have an account?{" "}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
                <Text style={styles.link}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  appName: {
    fontSize: 42,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 1,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 24,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#0f1419",
  },
  button: {
    backgroundColor: "#0f1419",
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    color: "#64748b",
    fontSize: 14,
  },
  link: {
    color: "#1d9bf0",
    fontWeight: "600",
    fontSize: 14,
  },
});
