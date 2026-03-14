import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { Animated, Text, StyleSheet, Dimensions } from "react-native";

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-30)).current;
  const timeoutRef = useRef(null);

  const showToast = useCallback((message, type = "info", duration = 3000) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast({ message, type });
    opacity.setValue(0);
    translateY.setValue(-30);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();

    timeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -30, duration: 250, useNativeDriver: true }),
      ]).start(() => setToast(null));
    }, duration);
  }, [opacity, translateY]);

  const bgMap = { success: "#00ba7c", error: "#e0245e", info: "#1d9bf0", warning: "#ffad1f" };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.container,
            { backgroundColor: bgMap[toast.type] || bgMap.info, opacity, transform: [{ translateY }] },
          ]}
        >
          <Text style={styles.text}>{toast.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: width * 0.05,
    right: width * 0.05,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    zIndex: 99999,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    alignItems: "center",
  },
  text: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
  },
});
