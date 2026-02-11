import React, { createContext, useContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore token on app launch
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync("token");
        if (stored) setToken(stored);
      } catch (e) {
        console.warn("Failed to restore token", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (newToken) => {
    await SecureStore.setItemAsync("token", newToken);
    setToken(newToken);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync("token");
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        login,
        logout,
        isAuthenticated: !!token,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
