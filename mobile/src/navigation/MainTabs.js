import React, { useEffect, useRef, useState, useCallback } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { AppState } from "react-native";
import { useTheme, getTheme } from "../context/ThemeContext";
import {
  registerForPushNotifications,
  addNotificationResponseListener,
} from "../utils/notifications";
import api from "../api/client";

import FeedScreen from "../screens/FeedScreen";
import TrendingScreen from "../screens/TrendingScreen";
import BookmarksScreen from "../screens/BookmarksScreen";
import ProfileScreen from "../screens/ProfileScreen";
import PostDetailScreen from "../screens/PostDetailScreen";
import EntityExploreScreen from "../screens/EntityExploreScreen";
import FollowListScreen from "../screens/FollowListScreen";
import ConversationsScreen from "../screens/ConversationsScreen";
import ChatScreen from "../screens/ChatScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ─── Feed stack (Feed -> PostDetail, Entity, Profile) ───
function FeedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FeedHome" component={FeedScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="EntityExplore" component={EntityExploreScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="FollowList" component={FollowListScreen} />
    </Stack.Navigator>
  );
}

// ─── Trending stack ───
function TrendingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TrendingHome" component={TrendingScreen} />
      <Stack.Screen name="EntityExplore" component={EntityExploreScreen} />
    </Stack.Navigator>
  );
}

// ─── Bookmarks stack ───
function BookmarksStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BookmarksHome" component={BookmarksScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

// ─── Profile stack ───
function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="FollowList" component={FollowListScreen} />
    </Stack.Navigator>
  );
}

// ─── Messages stack ───
function MessagesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ConversationsHome" component={ConversationsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

// ─── Main Tab Navigator ───
export default function MainTabs() {
  const { darkMode } = useTheme();
  const t = getTheme(darkMode);
  const navigationRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread message count
  const fetchUnread = useCallback(async () => {
    try {
      const res = await api.get("/messages/unread-count");
      setUnreadCount(res.data?.unread || 0);
    } catch {}
  }, []);

  // Poll unread count every 30s + when app comes to foreground
  useEffect(() => {
    fetchUnread();
    const iv = setInterval(fetchUnread, 30000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") fetchUnread();
    });
    return () => {
      clearInterval(iv);
      sub.remove();
    };
  }, [fetchUnread]);

  // Register push notifications on mount
  useEffect(() => {
    registerForPushNotifications();
  }, []);

  // Handle notification tap → navigate to Messages
  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === "new_message") {
        // Navigate to Messages tab
        try {
          navigationRef.current?.navigate("Messages");
        } catch { /* ignore */ }
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: t.accentBlue,
        tabBarInactiveTintColor: t.textSecondary,
        tabBarStyle: {
          backgroundColor: t.tabBarBg,
          borderTopColor: t.border,
          borderTopWidth: 1,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          switch (route.name) {
            case "Feed":
              iconName = focused ? "home" : "home-outline";
              break;
            case "Messages":
              iconName = focused ? "chatbubbles" : "chatbubbles-outline";
              break;
            case "Trending":
              iconName = focused ? "flash" : "flash-outline";
              break;
            case "Bookmarks":
              iconName = focused ? "bookmark" : "bookmark-outline";
              break;
            case "Me":
              iconName = focused ? "person" : "person-outline";
              break;
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Feed" component={FeedStack} />
      <Tab.Screen
        name="Messages"
        component={MessagesStack}
        options={{
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: "#e0245e", color: "#fff", fontSize: 10, fontWeight: "700" },
        }}
        listeners={{ tabPress: () => { setUnreadCount(0); } }}
      />
      <Tab.Screen name="Trending" component={TrendingStack} />
      <Tab.Screen name="Bookmarks" component={BookmarksStack} />
      <Tab.Screen name="Me" component={ProfileStack} />
    </Tab.Navigator>
  );
}
