import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/client";

export default function NewsWidget({ theme: t }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get("/widgets/news?country=in&lang=en");
      setArticles((res.data || []).slice(0, 10));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNews();
    setRefreshing(false);
  }, [fetchNews]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  if (loading && !refreshing) {
    return (
      <View style={[s.loadingWrap, { backgroundColor: t.cardBg }]}>
        <Text style={{ fontSize: 32 }}>📰</Text>
        <ActivityIndicator size="small" color={t.accentBlue} style={{ marginTop: 8 }} />
        <Text style={{ color: t.textSecondary, fontSize: 13, marginTop: 4 }}>
          Loading news...
        </Text>
      </View>
    );
  }

  if (error || !articles.length) {
    return (
      <View style={[s.loadingWrap, { backgroundColor: t.cardBg }]}>
        <Text style={{ fontSize: 32 }}>📰</Text>
        <Text style={{ color: t.textSecondary, fontSize: 14, marginTop: 8 }}>
          {error ? "Couldn't load news" : "No articles found"}
        </Text>
        <TouchableOpacity onPress={fetchNews} style={{ marginTop: 8 }}>
          <Text style={{ color: t.accentBlue, fontWeight: "600" }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const openLink = (url) => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <FlatList
      data={articles}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accentBlue} />
      }
      ListHeaderComponent={
        <View style={{ paddingVertical: 12 }}>
          <Text style={[s.header, { color: t.text }]}>Top Headlines</Text>
          <Text style={{ color: t.textSecondary, fontSize: 13 }}>
            Google News · India
          </Text>
        </View>
      }
      renderItem={({ item, index }) => (
        <TouchableOpacity
          onPress={() => openLink(item.link)}
          activeOpacity={0.7}
          style={[s.card, { backgroundColor: t.cardBg, borderColor: t.border }]}
        >
          <View style={s.cardRow}>
            <View style={[s.numBadge, { backgroundColor: t.accentBlue + "18" }]}>
              <Text style={[s.numText, { color: t.accentBlue }]}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={[s.title, { color: t.text }]}
                numberOfLines={3}
              >
                {item.title}
              </Text>
              <View style={s.metaRow}>
                {item.source ? (
                  <Text style={[s.source, { color: t.textSecondary }]}>{item.source}</Text>
                ) : null}
                {item.source && item.time_ago ? (
                  <Text style={{ color: t.textSecondary, fontSize: 12 }}> · </Text>
                ) : null}
                {item.time_ago ? (
                  <Text style={{ color: t.textSecondary, fontSize: 12 }}>{item.time_ago}</Text>
                ) : null}
              </View>
            </View>
            <Ionicons name="open-outline" size={16} color={t.textSecondary} />
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const s = StyleSheet.create({
  loadingWrap: {
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
    margin: 12,
  },
  header: { fontSize: 20, fontWeight: "800" },
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  cardRow: { flexDirection: "row", alignItems: "center" },
  numBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  numText: { fontWeight: "800", fontSize: 14 },
  title: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  source: { fontSize: 12, fontWeight: "600" },
});
