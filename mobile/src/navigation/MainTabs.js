import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
  AppState,
  Text,
  Image,
} from "react-native";
import PagerView from "react-native-pager-view";
import { NavigationContainer, NavigationIndependentTree } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, getTheme } from "../context/ThemeContext";
import {
  registerForPushNotifications,
  addNotificationResponseListener,
} from "../utils/notifications";
import api from "../api/client";

import FeedScreen from "../screens/FeedScreen";
import ExploreScreen from "../screens/ExploreScreen";
import BookmarksScreen from "../screens/BookmarksScreen";
import ProfileScreen from "../screens/ProfileScreen";
import PostDetailScreen from "../screens/PostDetailScreen";
import EntityExploreScreen from "../screens/EntityExploreScreen";
import FollowListScreen from "../screens/FollowListScreen";
import ConversationsScreen from "../screens/ConversationsScreen";
import ChatScreen from "../screens/ChatScreen";
import TrendingScreen from "../screens/TrendingScreen";
import SettingsScreen from "../screens/SettingsScreen";
import NotificationsScreen from "../screens/NotificationsScreen";

const FeedStackNav = createNativeStackNavigator();
const ExploreStackNav = createNativeStackNavigator();
const MessagesStackNav = createNativeStackNavigator();
const ProfileStackNav = createNativeStackNavigator();

const TABS = [
  { key: "Home",     iconFilled: "home",        iconOutline: "home-outline" },
  { key: "Explore",  iconFilled: "compass",     iconOutline: "compass-outline" },
  { key: "Messages", iconFilled: "chatbubbles", iconOutline: "chatbubbles-outline" },
  { key: "Profile",  iconFilled: "person",      iconOutline: "person-outline" },
];

const { width: SW } = Dimensions.get("window");

// ─── Nested stacks ───
// Each stack reports its depth so the PagerView can disable swipe
// when the user is deep inside a stack (e.g. PostDetail).

function FeedStack({ onDepthChange }) {
  return (
    <NavigationIndependentTree>
    <NavigationContainer>
      <FeedStackNav.Navigator
        screenOptions={{ headerShown: false }}
        screenListeners={{
          state: (e) => {
            onDepthChange?.(e.data?.state?.routes?.length ?? 1);
          },
        }}
      >
        <FeedStackNav.Screen name="FeedHome" component={FeedScreen} />
        <FeedStackNav.Screen name="PostDetail" component={PostDetailScreen} />
        <FeedStackNav.Screen name="EntityExplore" component={EntityExploreScreen} />
        <FeedStackNav.Screen name="Profile" component={ProfileScreen} />
        <FeedStackNav.Screen name="FollowList" component={FollowListScreen} />
        <FeedStackNav.Screen name="Bookmarks" component={BookmarksScreen} />
        <FeedStackNav.Screen name="Trending" component={TrendingScreen} />
        <FeedStackNav.Screen name="Settings" component={SettingsScreen} />
        <FeedStackNav.Screen name="Notifications" component={NotificationsScreen} />
      </FeedStackNav.Navigator>
    </NavigationContainer>
    </NavigationIndependentTree>
  );
}

function ExploreStack({ onDepthChange }) {
  return (
    <NavigationIndependentTree>
    <NavigationContainer>
      <ExploreStackNav.Navigator
        screenOptions={{ headerShown: false }}
        screenListeners={{
          state: (e) => {
            onDepthChange?.(e.data?.state?.routes?.length ?? 1);
          },
        }}
      >
        <ExploreStackNav.Screen name="ExploreHome" component={ExploreScreen} />
        <ExploreStackNav.Screen name="EntityExplore" component={EntityExploreScreen} />
        <ExploreStackNav.Screen name="PostDetail" component={PostDetailScreen} />
        <ExploreStackNav.Screen name="Profile" component={ProfileScreen} />
        <ExploreStackNav.Screen name="Settings" component={SettingsScreen} />
        <ExploreStackNav.Screen name="Notifications" component={NotificationsScreen} />
        <ExploreStackNav.Screen name="Bookmarks" component={BookmarksScreen} />
      </ExploreStackNav.Navigator>
    </NavigationContainer>
    </NavigationIndependentTree>
  );
}

function MessagesStack({ onDepthChange }) {
  return (
    <NavigationIndependentTree>
    <NavigationContainer>
      <MessagesStackNav.Navigator
        screenOptions={{ headerShown: false }}
        screenListeners={{
          state: (e) => {
            onDepthChange?.(e.data?.state?.routes?.length ?? 1);
          },
        }}
      >
        <MessagesStackNav.Screen name="ConversationsHome" component={ConversationsScreen} />
        <MessagesStackNav.Screen name="Chat" component={ChatScreen} />
        <MessagesStackNav.Screen name="Profile" component={ProfileScreen} />
        <MessagesStackNav.Screen name="Settings" component={SettingsScreen} />
        <MessagesStackNav.Screen name="Notifications" component={NotificationsScreen} />
        <MessagesStackNav.Screen name="Bookmarks" component={BookmarksScreen} />
      </MessagesStackNav.Navigator>
    </NavigationContainer>
    </NavigationIndependentTree>
  );
}

function ProfileStack({ onDepthChange }) {
  return (
    <NavigationIndependentTree>
    <NavigationContainer>
      <ProfileStackNav.Navigator
        screenOptions={{ headerShown: false }}
        screenListeners={{
          state: (e) => {
            onDepthChange?.(e.data?.state?.routes?.length ?? 1);
          },
        }}
      >
        <ProfileStackNav.Screen name="ProfileHome" component={ProfileScreen} />
        <ProfileStackNav.Screen name="PostDetail" component={PostDetailScreen} />
        <ProfileStackNav.Screen name="FollowList" component={FollowListScreen} />
        <ProfileStackNav.Screen name="Bookmarks" component={BookmarksScreen} />
        <ProfileStackNav.Screen name="Settings" component={SettingsScreen} />
        <ProfileStackNav.Screen name="Notifications" component={NotificationsScreen} />
      </ProfileStackNav.Navigator>
    </NavigationContainer>
    </NavigationIndependentTree>
  );
}

// ─── Main Tab Navigator with Swipe ───
export default function MainTabs() {
  const { darkMode, accentColor } = useTheme();
  const t = getTheme(darkMode, accentColor);

  const pagerRef = useRef(null);
  const [activeTab, setActiveTab] = useState(0);
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  // Current user profile pic for tab bar
  const [userPicUrl, setUserPicUrl] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/users/me");
        setUserPicUrl(res.data?.profile_pic_url || null);
      } catch {}
    })();
  }, []);

  // Track depth of each stack so we disable swipe when user navigates deep
  const stackDepths = useRef([1, 1, 1, 1]);
  const [swipeEnabled, setSwipeEnabled] = useState(true);

  const updateDepth = useCallback((tabIndex, depth) => {
    stackDepths.current[tabIndex] = depth;
    // Only enable swipe if the currently active stack is at root (depth === 1)
    setSwipeEnabled(stackDepths.current[activeTab] <= 1);
  }, [activeTab]);

  // Re-evaluate swipe enabled whenever activeTab changes
  useEffect(() => {
    setSwipeEnabled(stackDepths.current[activeTab] <= 1);
  }, [activeTab]);

  // Unread messages badge
  const [unreadCount, setUnreadCount] = useState(0);
  const fetchUnread = useCallback(async () => {
    try {
      const res = await api.get("/messages/unread-count");
      setUnreadCount(res.data?.unread || 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnread();
    const iv = setInterval(fetchUnread, 30000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") fetchUnread();
    });
    return () => { clearInterval(iv); sub.remove(); };
  }, [fetchUnread]);

  // ─── Push notifications ───
  useEffect(() => { registerForPushNotifications(); }, []);
  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === "new_message") {
        pagerRef.current?.setPage(2); // Messages tab
      }
    });
    return () => sub.remove();
  }, []);

  // ─── Tab / Pager sync ───
  const onPageSelected = (e) => {
    const idx = e.nativeEvent.position;
    setActiveTab(idx);
    Animated.spring(indicatorAnim, {
      toValue: idx,
      useNativeDriver: true,
      tension: 68,
      friction: 12,
    }).start();
    if (idx === 2) setUnreadCount(0); // Opened Messages
  };

  const goToTab = (idx) => {
    pagerRef.current?.setPage(idx);
  };

  // ─── Indicator layout ───
  const tabWidth = SW / TABS.length;
  const indicatorTranslate = indicatorAnim.interpolate({
    inputRange: TABS.map((_, i) => i),
    outputRange: TABS.map((_, i) => i * tabWidth + tabWidth / 2 - 16),
  });

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Swipeable page area */}
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={onPageSelected}
        scrollEnabled={swipeEnabled}
        overdrag={false}
      >
        <View key="0" style={{ flex: 1 }}>
          <FeedStack onDepthChange={(d) => updateDepth(0, d)} />
        </View>
        <View key="1" style={{ flex: 1 }}>
          <ExploreStack onDepthChange={(d) => updateDepth(1, d)} />
        </View>
        <View key="2" style={{ flex: 1 }}>
          <MessagesStack onDepthChange={(d) => updateDepth(2, d)} />
        </View>
        <View key="3" style={{ flex: 1 }}>
          <ProfileStack onDepthChange={(d) => updateDepth(3, d)} />
        </View>
      </PagerView>

      {/* Bottom Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: t.tabBarBg, borderTopColor: t.border }]}>
        {/* Animated indicator line */}
        <Animated.View
          style={[
            styles.indicator,
            {
              backgroundColor: t.accentBlue,
              transform: [{ translateX: indicatorTranslate }],
            },
          ]}
        />

        {TABS.map((tab, i) => {
          const isActive = activeTab === i;
          const showBadge = tab.key === "Messages" && unreadCount > 0;
          const isProfileTab = tab.key === "Profile";

          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => goToTab(i)}
              style={styles.tabBtn}
              activeOpacity={0.7}
            >
              <View>
                {isProfileTab && userPicUrl ? (
                  <View style={[styles.profilePicWrap, isActive && { borderColor: t.accentBlue }]}>
                    <Image source={{ uri: userPicUrl }} style={styles.profilePic} />
                  </View>
                ) : (
                  <Ionicons
                    name={isActive ? tab.iconFilled : tab.iconOutline}
                    size={24}
                    color={isActive ? t.accentBlue : t.textSecondary}
                  />
                )}
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, { color: isActive ? t.accentBlue : t.textSecondary }]}>
                {tab.key}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingBottom: 20,
    paddingTop: 8,
    position: "relative",
  },
  indicator: {
    position: "absolute",
    top: 0,
    width: 32,
    height: 3,
    borderRadius: 2,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: "#e0245e",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  profilePicWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
  },
  profilePic: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
});
