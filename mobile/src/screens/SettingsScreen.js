import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, getTheme, ACCENT_COLORS } from "../context/ThemeContext";

export default function SettingsScreen({ navigation }) {
  const { darkMode, toggleDarkMode, accentColor, setAccentColor } = useTheme();
  const t = getTheme(darkMode, accentColor);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={["top"]}>
      {/* Nav */}
      <View style={[styles.navBar, { backgroundColor: t.headerBg, borderColor: t.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: t.text }]}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ─── Appearance Section ─── */}
        <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>APPEARANCE</Text>

        {/* Dark Mode */}
        <View style={[styles.settingRow, { backgroundColor: t.cardBg, borderColor: t.border }]}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: darkMode ? "#333" : "#f0f0f0" }]}>
              <Ionicons name={darkMode ? "moon" : "sunny"} size={20} color={darkMode ? "#ffd400" : "#ff9500"} />
            </View>
            <View>
              <Text style={[styles.settingLabel, { color: t.text }]}>Dark Mode</Text>
              <Text style={[styles.settingDesc, { color: t.textSecondary }]}>
                {darkMode ? "Dark theme active" : "Light theme active"}
              </Text>
            </View>
          </View>
          <Switch
            value={darkMode}
            onValueChange={toggleDarkMode}
            trackColor={{ false: "#ccc", true: accentColor + "80" }}
            thumbColor={darkMode ? accentColor : "#fff"}
          />
        </View>

        {/* ─── Accent Color Section ─── */}
        <Text style={[styles.sectionTitle, { color: t.textSecondary, marginTop: 28 }]}>ACCENT COLOR</Text>
        <Text style={[styles.sectionDesc, { color: t.textSecondary }]}>
          Choose a color that highlights buttons, links, and active elements
        </Text>

        <View style={[styles.colorGrid, { backgroundColor: t.cardBg, borderColor: t.border }]}>
          {ACCENT_COLORS.map((preset) => {
            const isActive = accentColor === preset.color;
            return (
              <TouchableOpacity
                key={preset.id}
                style={styles.colorOption}
                onPress={() => setAccentColor(preset.color)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.colorCircle,
                    { backgroundColor: preset.color },
                    isActive && styles.colorCircleActive,
                  ]}
                >
                  {isActive && <Ionicons name="checkmark" size={18} color="#fff" />}
                </View>
                <Text style={[styles.colorLabel, { color: isActive ? preset.color : t.textSecondary }]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── Preview Section ─── */}
        <Text style={[styles.sectionTitle, { color: t.textSecondary, marginTop: 28 }]}>PREVIEW</Text>
        <View style={[styles.previewCard, { backgroundColor: t.cardBg, borderColor: t.border }]}>
          <View style={styles.previewRow}>
            <View style={[styles.previewAvatar, { backgroundColor: t.avatarBg }]}>
              <Text style={styles.previewAvatarText}>P</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.previewUser, { color: t.text }]}>@pulse_user</Text>
              <Text style={[styles.previewContent, { color: t.text }]}>
                This is how your posts will look with the selected theme! 🎨
              </Text>
            </View>
          </View>
          <View style={styles.previewActions}>
            <View style={styles.previewAction}>
              <Ionicons name="heart" size={18} color="#f91880" />
              <Text style={{ color: t.textSecondary, fontSize: 12, marginLeft: 4 }}>24</Text>
            </View>
            <View style={styles.previewAction}>
              <Ionicons name="chatbubble-outline" size={18} color={accentColor} />
              <Text style={{ color: t.textSecondary, fontSize: 12, marginLeft: 4 }}>8</Text>
            </View>
            <View style={styles.previewAction}>
              <Ionicons name="repeat" size={18} color="#00ba7c" />
              <Text style={{ color: t.textSecondary, fontSize: 12, marginLeft: 4 }}>3</Text>
            </View>
            <View style={styles.previewAction}>
              <Ionicons name="bookmark" size={18} color={accentColor} />
            </View>
          </View>
          <TouchableOpacity style={[styles.previewBtn, { backgroundColor: accentColor }]}>
            <Text style={styles.previewBtnText}>Accent Button</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  navTitle: { fontSize: 18, fontWeight: "700" },
  scrollContent: { padding: 16, paddingBottom: 40 },

  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 10 },
  sectionDesc: { fontSize: 13, marginBottom: 12, lineHeight: 18 },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  settingLabel: { fontSize: 16, fontWeight: "600" },
  settingDesc: { fontSize: 12, marginTop: 2 },

  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  colorOption: {
    width: "30%",
    alignItems: "center",
    paddingVertical: 12,
  },
  colorCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  colorCircleActive: {
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.5)",
  },
  colorLabel: { fontSize: 12, fontWeight: "600" },

  previewCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  previewRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  previewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  previewAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  previewUser: { fontWeight: "700", fontSize: 14, marginBottom: 4 },
  previewContent: { fontSize: 14, lineHeight: 20 },
  previewActions: { flexDirection: "row", gap: 24, marginBottom: 12, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: "rgba(128,128,128,0.2)" },
  previewAction: { flexDirection: "row", alignItems: "center" },
  previewBtn: {
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: "center",
  },
  previewBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
