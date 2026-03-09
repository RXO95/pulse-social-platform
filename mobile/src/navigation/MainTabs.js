import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
  AppState,
  Text,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
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

const Tab = createBottomTabNavigator();
const FeedStackNav = createNativeStackNavigator();
const ExploreStackNav = createNativeStackNavigator();
const MessagesStackNav = createNativeStackNavigator();
const ProfileStackNav = createNativeStackNavigator();

// ─── Nested stacks ───
function FeedStack() {
  return (
    <FeedStackNav.Navigator screenOptions={{ headerShown: false }}>
      <FeedStackNav.Screen name="FeedHome" component={FeedScreen} />
      <FeedStackNav.Screen name="PostDetail" component={PostDetailScreen} />
      <FeedStackNav.Screen name="EntityExplore" component={EntityExploreScreen} />
      <FeedStackNav.Screen name="Profile" component={ProfileScreen} />
      <FeedStackNav.Screen name="FollowList" component={FollowListScreen} />
      <FeedStackNav.Screen name="Bookmarks" component={BookmarksScreen} />
    </FeedStackNav.Navigator>
  );
}

function ExploreStack() {
  return (
    <ExploreStackNav.Navigator screenOptions={{ headerShown: false }}>
      <ExploreStackNav.Screen name="ExploreHome" component={ExploreScreen} />
      <ExploreStackNav.Screen name="EntityExplore" component={EntityExploreScreen} />
      <ExploreStackNav.Screen name="PostDetail" component={PostDetailScreen} />
      <ExploreStackNav.Screen name="Profile" component={ProfileScreen} />
    </ExploreStackNav.Navigator>
  );
}

function MessagesStack() {
  return (
    <MessagesStackNav.Navigator screenOptions={{ headerShown: false }}>
      <MessagesStackNav.Screen name="ConversationsHome" component={ConversationsScreen} />
      <MessagesStackNav.Screen name="Chat" component={ChatScreen} />
      <MessagesStackNav.Screen name="Profile" component={ProfileScreen} />
    </MessagesStackNav.Navigator>
  );
}

function ProfileStack() {
  return (
    <ProfileStackNav.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStackNav.Screen name="ProfileHome" component={ProfileScreen} />
      <ProfileStackNav.Screen name="PostDetail" component={PostDetailScreen} />
      <ProfileStackNav.Screen name="FollowList" component={FollowListScreen} />
      <ProfileStackNav.Screen name="Bookmarks" component={BookmarksScreen} />
    </ProfileStackNav.Navigator>
  );
}

// ─── Custom Tab Bar ───
function CustomTabBar({ state, descriptors, navigation }) {
  const { darkMode } = useTheme();
  const t = getTheme(darkMode);
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

  const TAB_META = {
    Home:     { iconFilled: "home",        iconOutline: "home-outline" },
    Explore:  { iconFilled: "compass",     iconOutline: "compass-outline" },
    Messages: { iconFilled: "chatbubbles", iconOutline: "chatbubbles-outline" },
    Profile:  { iconFilled: "person",      iconOutline: "person-outline" },
  };

  return (
    <View style={[styles.tabBar, { backgroundColor: t.tabBarBg, borderTopColor: t.border }]}>  
      {state.routes.map((route, i) => {
        const isActive = state.index === i;
        const meta = TAB_META[route.name] || {};
        const showBadge = route.name === "Messages" && unreadCount > 0;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!event.defaultPrevented) {
                navigation.navigate(route.name);
              }
              if (route.name === "Messages") setUnreadCount(0);
            }}
            style={styles.tabBtn}
            activeOpacity={0.7}
          >
            <View>
              <Ionicons
                name={isActive ? meta.iconFilled : meta.iconOutline}
                size={24}
                color={isActive ? t.accentBlue : t.textSecondary}
              />
              {showBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, { color: isActive ? t.accentBlue : t.textSecondary }]}>
              {route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Main Tab Navigator ───
export default function MainTabs() {
  const { darkMode } = useTheme();
  const t = getTheme(darkMode);
  const navigationRef = useRef(null);

  // ─── Push notifications ───
  useEffect(() => { registerForPushNotifications(); }, []);

  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === "new_message" && navigationRef.current) {
        navigationRef.current.navigate("Messages");
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={FeedStack} />
      <Tab.Screen name="Explore" component={ExploreStack} />
      <Tab.Screen name="Messages" component={MessagesStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingBottom: 20,
    paddingTop: 8,
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
});
