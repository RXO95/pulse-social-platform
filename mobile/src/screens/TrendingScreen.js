import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, getTheme } from "../context/ThemeContext";
import api from "../api/client";

export default function TrendingScreen({ navigation }) {
  const [trending, setTrending] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { darkMode } = useTheme();
  const t = getTheme(darkMode);

  const fetchTrending = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/trending/");
      setTrending(res.data);
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTrending();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchTrending();
  }, []);

  const getLabelIcon = (label) => {
    switch (label) {
      case "PER": return "person";
      case "ORG": return "business";
      case "GPE":
      case "LOC": return "location";
      default: return "pricetag";
    }
  };

  const getLabelName = (label) => {
    switch (label) {
      case "PER": return "Person";
      case "ORG": return "Organization";
      case "GPE": return "Location";
      case "LOC": return "Place";
      default: return "Topic";
    }
  };

  const getLabelColor = (label) => {
    switch (label) {
      case "PER": return "#8b5cf6";
      case "ORG": return "#3b82f6";
      case "GPE":
      case "LOC": return "#10b981";
      default: return "#f59e0b";
    }
  };

  const renderTrending = ({ item, index }) => {
    const color = getLabelColor(item.label);
    return (
      <TouchableOpacity
        style={[styles.trendCard, { backgroundColor: t.cardBg, borderColor: t.border }]}
        onPress={() => navigation.navigate("EntityExplore", { entityText: item.text })}
        activeOpacity={0.8}
      >
        <View style={styles.trendRow}>
          <View style={[styles.rankBadge, { backgroundColor: color + "20" }]}>
            <Text style={[styles.rankText, { color }]}>{index + 1}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.trendText, { color: t.text }]}>{item.text}</Text>
            <View style={styles.trendMeta}>
              <Ionicons name={getLabelIcon(item.label)} size={14} color={color} />
              <Text style={[styles.trendLabel, { color: t.textSecondary }]}>
                {getLabelName(item.label)}
              </Text>
              <Text style={[styles.trendCount, { color: t.textSecondary }]}>
                · {item.count} mention{item.count > 1 ? "s" : ""}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={t.textSecondary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={["top"]}>
      <View style={[styles.navBar, { backgroundColor: t.headerBg, borderColor: t.border }]}>
        <Text style={[styles.navTitle, { color: t.text }]}>Trending</Text>
      </View>

      <View style={styles.headerSection}>
        <Text style={[styles.pageTitle, { color: t.text }]}>What's happening</Text>
        <Text style={{ color: t.textSecondary, fontSize: 14 }}>
          Trending topics from the last 24 hours
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={t.accentBlue} />
        </View>
      ) : (
        <FlatList
          data={trending}
          keyExtractor={(item, idx) => `${item.text}-${idx}`}
          renderItem={renderTrending}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accentBlue} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="flash-outline" size={48} color={t.textSecondary} />
              <Text style={{ color: t.textSecondary, marginTop: 12, fontSize: 15 }}>
                No trending topics right now
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  navTitle: { fontSize: 22, fontWeight: "800" },
  headerSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  pageTitle: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  trendCard: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  trendRow: { flexDirection: "row", alignItems: "center" },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: { fontWeight: "800", fontSize: 15 },
  trendText: { fontWeight: "700", fontSize: 16, marginBottom: 4 },
  trendMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  trendLabel: { fontSize: 13 },
  trendCount: { fontSize: 13 },
  emptyWrap: { alignItems: "center", marginTop: 60 },
});
