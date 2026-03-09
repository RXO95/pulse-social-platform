import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/client";

const { width: SCREEN_W } = Dimensions.get("window");
const NUM_COLUMNS = 2;
const GAP = 8;
const ITEM_W = (SCREEN_W - 32 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export default function GifPicker({ visible, onClose, onSelect, theme: t }) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nextPos, setNextPos] = useState("");
  const debounceRef = useRef(null);

  const fetchGifs = useCallback(
    async (searchQ, pos = "") => {
      setLoading(true);
      try {
        const q = searchQ.trim() || "trending";
        const url = `/widgets/gifs?q=${encodeURIComponent(q)}&limit=20${
          pos ? `&pos=${pos}` : ""
        }`;
        const res = await api.get(url);
        const data = res.data;
        if (pos) {
          setGifs((prev) => [...prev, ...(data.results || [])]);
        } else {
          setGifs(data.results || []);
        }
        setNextPos(data.next || "");
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Load trending on open
  useEffect(() => {
    if (visible) {
      setQuery("");
      setGifs([]);
      setNextPos("");
      fetchGifs("trending");
    }
  }, [visible, fetchGifs]);

  // Debounced search
  const handleSearch = useCallback(
    (text) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setGifs([]);
        setNextPos("");
        fetchGifs(text);
      }, 400);
    },
    [fetchGifs]
  );

  const loadMore = () => {
    if (!loading && nextPos) {
      fetchGifs(query, nextPos);
    }
  };

  const renderGif = ({ item }) => (
    <TouchableOpacity
      style={[s.gifItem, { width: ITEM_W }]}
      activeOpacity={0.7}
      onPress={() => {
        onSelect(item.url, item.preview);
        onClose();
      }}
    >
      <Image
        source={{ uri: item.preview || item.url }}
        style={[s.gifImage, { width: ITEM_W, height: ITEM_W * 0.75 }]}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: t.cardBg }]}>
          {/* Header */}
          <View style={[s.header, { borderBottomColor: t.border }]}>
            <Text style={[s.title, { color: t.text }]}>Search GIFs</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={t.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={[s.searchRow, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
            <Ionicons name="search" size={18} color={t.textSecondary} />
            <TextInput
              style={[s.searchInput, { color: t.text }]}
              placeholder="Search Tenor…"
              placeholderTextColor={t.textSecondary}
              value={query}
              onChangeText={handleSearch}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch("")}>
                <Ionicons name="close-circle" size={18} color={t.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Grid */}
          <FlatList
            data={gifs}
            keyExtractor={(item, idx) => item.id + idx}
            renderItem={renderGif}
            numColumns={NUM_COLUMNS}
            columnWrapperStyle={s.row}
            contentContainerStyle={s.grid}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator
                  size="large"
                  color={t.accentBlue}
                  style={{ marginTop: 40 }}
                />
              ) : (
                <Text style={[s.emptyText, { color: t.textSecondary }]}>
                  {query ? "No GIFs found" : "Type to search GIFs"}
                </Text>
              )
            }
            ListFooterComponent={
              loading && gifs.length > 0 ? (
                <ActivityIndicator
                  color={t.accentBlue}
                  style={{ paddingVertical: 16 }}
                />
              ) : null
            }
          />

          {/* Tenor attribution */}
          <View style={[s.attribution, { borderTopColor: t.border }]}>
            <Text style={{ color: t.textSecondary, fontSize: 11 }}>
              Powered by Tenor
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    minHeight: "55%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 17, fontWeight: "700" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    paddingVertical: 2,
  },
  grid: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12 },
  row: { gap: GAP, marginBottom: GAP },
  gifItem: { borderRadius: 10, overflow: "hidden" },
  gifImage: { borderRadius: 10 },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 15,
  },
  attribution: {
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
  },
});
