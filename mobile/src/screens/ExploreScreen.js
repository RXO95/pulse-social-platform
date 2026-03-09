import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Dimensions,
  StyleSheet,
} from "react-native";
import PagerView from "react-native-pager-view";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, getTheme } from "../context/ThemeContext";
import api from "../api/client";
import WeatherWidget from "../components/WeatherWidget";
import NewsWidget from "../components/NewsWidget";

const { width: SW } = Dimensions.get("window");
const TABS = [
  { key: "weather", label: "Weather", icon: "sunny-outline" },
  { key: "news",    label: "News",    icon: "newspaper-outline" },
  { key: "trending",label: "Trending",icon: "flash-outline" },
];

export default function ExploreScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState(0);
  const pagerRef = useRef(null);
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  /* ─── Trending data ─── */
  const [trending, setTrending] = useState([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendRefreshing, setTrendRefreshing] = useState(false);

  const { darkMode } = useTheme();
  const t = getTheme(darkMode);

  const fetchTrending = async () => {
    setTrendLoading(true);
    try {
      const res = await api.get("/trending/");
      setTrending(res.data);
    } catch {} finally {
      setTrendLoading(false);
    }
  };

  const onTrendRefresh = useCallback(async () => {
    setTrendRefreshing(true);
    await fetchTrending();
    setTrendRefreshing(false);
  }, []);

  useEffect(() => {
    fetchTrending();
  }, []);

  /* ─── Tab animations ─── */
  const onPageSelected = (e) => {
    const idx = e.nativeEvent.position;
    setActiveTab(idx);
    Animated.spring(indicatorAnim, {
      toValue: idx,
      useNativeDriver: true,
      tension: 68,
      friction: 12,
    }).start();
  };

  const goToPage = (idx) => {
    pagerRef.current?.setPage(idx);
  };

  const tabWidth = (SW - 24) / TABS.length;
  const indicatorTranslate = indicatorAnim.interpolate({
    inputRange: TABS.map((_, i) => i),
    outputRange: TABS.map((_, i) => i * tabWidth),
  });

  /* ─── Trending helpers ─── */
  const getLabelIcon = (label) => {
    switch (label) {
      case "PER": return "person";
      case "ORG": return "business";
      case "LOC": return "location";
      default: return "pricetag";
    }
  };
  const getLabelName = (label) => {
    switch (label) {
      case "PER": return "Person";
      case "ORG": return "Organization";
      case "LOC": return "Location";
      default: return "Topic";
    }
  };
  const getLabelColor = (label) => {
    switch (label) {
      case "PER": return "#8b5cf6";
      case "ORG": return "#3b82f6";
      case "LOC": return "#10b981";
      default: return "#f59e0b";
    }
  };

  /* ─── Render ─── */
  return (
    <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={["top"]}>
      {/* Header */}
      <View style={[s.navBar, { backgroundColor: t.headerBg, borderColor: t.border }]}>
        <Text style={[s.navTitle, { color: t.text }]}>Explore</Text>
      </View>

      {/* Segmented control */}
      <View style={[s.segmentWrap, { backgroundColor: t.inputBg, borderColor: t.border }]}>
        <Animated.View
          style={[
            s.segmentIndicator,
            {
              width: tabWidth - 8,
              backgroundColor: t.accentBlue,
              transform: [{ translateX: Animated.add(indicatorTranslate, 4) }],
            },
          ]}
        />
        {TABS.map((tab, i) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => goToPage(i)}
            style={[s.segmentBtn, { width: tabWidth }]}
            activeOpacity={0.7}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === i ? "#fff" : t.textSecondary}
            />
            <Text
              style={[
                s.segmentLabel,
                { color: activeTab === i ? "#fff" : t.textSecondary },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Swipeable pages */}
      <PagerView
        ref={pagerRef}
        style={s.pager}
        initialPage={0}
        onPageSelected={onPageSelected}
      >
        {/* Page 0: Weather */}
        <View key="weather" style={s.page}>
          <FlatList
            data={[]}
            renderItem={null}
            ListHeaderComponent={<WeatherWidget theme={t} />}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </View>

        {/* Page 1: News */}
        <View key="news" style={s.page}>
          <NewsWidget theme={t} />
        </View>

        {/* Page 2: Trending */}
        <View key="trending" style={s.page}>
          {trendLoading ? (
            <View style={s.loaderWrap}>
              <ActivityIndicator size="large" color={t.accentBlue} />
            </View>
          ) : (
            <FlatList
              data={trending}
              keyExtractor={(item, idx) => `${item.text}-${idx}`}
              contentContainerStyle={{ paddingBottom: 16 }}
              refreshControl={
                <RefreshControl
                  refreshing={trendRefreshing}
                  onRefresh={onTrendRefresh}
                  tintColor={t.accentBlue}
                />
              }
              ListHeaderComponent={
                <View style={s.trendHeader}>
                  <Text style={[s.pageTitle, { color: t.text }]}>What's happening</Text>
                  <Text style={{ color: t.textSecondary, fontSize: 13 }}>
                    Trending topics from the last 24 hours
                  </Text>
                </View>
              }
              ListEmptyComponent={
                <View style={s.emptyWrap}>
                  <Ionicons name="flash-outline" size={48} color={t.textSecondary} />
                  <Text style={{ color: t.textSecondary, marginTop: 12, fontSize: 15 }}>
                    No trending topics right now
                  </Text>
                </View>
              }
              renderItem={({ item, index }) => {
                const color = getLabelColor(item.label);
                return (
                  <TouchableOpacity
                    style={[s.trendCard, { backgroundColor: t.cardBg, borderColor: t.border }]}
                    onPress={() => navigation.navigate("EntityExplore", { entityText: item.text })}
                    activeOpacity={0.8}
                  >
                    <View style={s.trendRow}>
                      <View style={[s.rankBadge, { backgroundColor: color + "20" }]}>
                        <Text style={[s.rankText, { color }]}>{index + 1}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[s.trendText, { color: t.text }]}>{item.text}</Text>
                        <View style={s.trendMeta}>
                          <Ionicons name={getLabelIcon(item.label)} size={14} color={color} />
                          <Text style={[s.trendLabel, { color: t.textSecondary }]}>
                            {getLabelName(item.label)}
                          </Text>
                          <Text style={[s.trendCount, { color: t.textSecondary }]}>
                            · {item.count} mention{item.count > 1 ? "s" : ""}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={t.textSecondary} />
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </PagerView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  navTitle: { fontSize: 22, fontWeight: "800" },
  segmentWrap: {
    flexDirection: "row",
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 14,
    padding: 4,
    position: "relative",
    borderWidth: 1,
  },
  segmentIndicator: {
    position: "absolute",
    top: 4,
    height: "100%",
    borderRadius: 11,
  },
  segmentBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 5,
    zIndex: 1,
  },
  segmentLabel: { fontSize: 13, fontWeight: "700" },
  pager: { flex: 1 },
  page: { flex: 1 },
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  trendHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  pageTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
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
