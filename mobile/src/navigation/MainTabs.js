import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, getTheme } from "../context/ThemeContext";

import FeedScreen from "../screens/FeedScreen";
import TrendingScreen from "../screens/TrendingScreen";
import BookmarksScreen from "../screens/BookmarksScreen";
import ProfileScreen from "../screens/ProfileScreen";
import PostDetailScreen from "../screens/PostDetailScreen";
import EntityExploreScreen from "../screens/EntityExploreScreen";
import FollowListScreen from "../screens/FollowListScreen";

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

// ─── Main Tab Navigator ───
export default function MainTabs() {
  const { darkMode } = useTheme();
  const t = getTheme(darkMode);

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
      <Tab.Screen name="Trending" component={TrendingStack} />
      <Tab.Screen name="Bookmarks" component={BookmarksStack} />
      <Tab.Screen name="Me" component={ProfileStack} />
    </Tab.Navigator>
  );
}
