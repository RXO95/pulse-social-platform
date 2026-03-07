/**
 * Push Notification Utilities for Pulse Mobile
 * =============================================
 * Uses expo-notifications + Expo Push Tokens.
 *
 * Call registerForPushNotifications() on app startup (after auth).
 * It will:
 *  1. Request permission
 *  2. Get the Expo push token
 *  3. POST it to the backend for storage
 *  4. Configure notification channels (Android)
 */

import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform, Alert } from "react-native";
import api from "../api/client";

// ─── Configure how notifications appear when app is in foreground ───
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and send the token to the backend.
 * Returns the push token string or null if registration fails.
 */
export async function registerForPushNotifications() {
  // Create notification channel for Android (must be done early)
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Messages",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1d9bf0",
      sound: "default",
    });
  }

  // Check / request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission not granted:", finalStatus);
    return null;
  }

  // Get the Expo push token
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || "944de932-dc74-42d3-9825-ae92750b2706",
    });
    const pushToken = tokenData.data;
    console.log("Push token:", pushToken);

    // Send to backend
    try {
      await api.post("/messages/push-token", { push_token: pushToken });
      console.log("Push token sent to server");
    } catch (err) {
      console.error("Failed to send push token to server:", err);
    }

    return pushToken;
  } catch (err) {
    console.error("Failed to get push token:", err);
    return null;
  }
}

/**
 * Add a notification response listener (when user taps a notification).
 * Returns a subscription that should be cleaned up on unmount.
 */
export function addNotificationResponseListener(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Add a listener for notifications received while app is in foreground.
 * Returns a subscription that should be cleaned up on unmount.
 */
export function addNotificationReceivedListener(callback) {
  return Notifications.addNotificationReceivedListener(callback);
}
