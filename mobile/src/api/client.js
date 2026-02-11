// ─── Pulse Mobile – API Configuration ───
// Change this to your backend URL.
// • For local dev on physical device: use your computer's LAN IP (e.g. http://192.168.1.42:8000)
// • For iOS simulator:  http://localhost:8000
// • For Android emulator: http://10.0.2.2:8000
// • For production: https://your-api-domain.com

import * as SecureStore from "expo-secure-store";

// ⚠️  Change this to your machine's LAN IP when testing on a physical device
const BASE_URL = "https://webpulse.social";
const API_BASE = `${BASE_URL}/api`;

/**
 * Lightweight fetch wrapper that mirrors the axios-like API used by screens.
 * Uses the built-in React Native `fetch` — no Node polyfills needed.
 */
const api = {
  /**
   * Core request method. Returns { data } to stay compatible with
   * the axios-style `res.data` usage throughout the app.
   */
  async request(method, path, body, extraHeaders = {}) {
    const token = await SecureStore.getItemAsync("token");
    const headers = { ...extraHeaders };
    if (token) headers.Authorization = `Bearer ${token}`;

    const isFormData = body instanceof FormData;
    if (!isFormData && body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const opts = { method, headers };
    if (body) {
      opts.body = isFormData ? body : JSON.stringify(body);
    }

    const res = await fetch(`${API_BASE}${path}`, opts);

    // Try to parse JSON; fall back to text
    let data;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    if (!res.ok) {
      const err = new Error(data?.detail || `Request failed (${res.status})`);
      err.response = { status: res.status, data };
      throw err;
    }

    return { data, status: res.status };
  },

  get(path)                   { return this.request("GET", path); },
  post(path, body, cfg)       { return this.request("POST", path, body, cfg?.headers); },
  put(path, body, cfg)        { return this.request("PUT", path, body, cfg?.headers); },
  delete(path)                { return this.request("DELETE", path); },
};

export default api;
export { BASE_URL };
