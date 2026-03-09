import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SW } = Dimensions.get("window");

/* ─── WMO weather-code → description + icon ─── */
const WMO = {
  0:  { desc: "Clear sky",            icon: "☀️",  colors: ["#FF9500","#FF5E3A"] },
  1:  { desc: "Mainly clear",         icon: "🌤️",  colors: ["#F7B733","#FC4A1A"] },
  2:  { desc: "Partly cloudy",        icon: "⛅",  colors: ["#89CFF0","#667DB6"] },
  3:  { desc: "Overcast",             icon: "☁️",  colors: ["#8E9BAE","#5C6975"] },
  45: { desc: "Fog",                  icon: "🌫️",  colors: ["#B5B5B5","#8E8E8E"] },
  48: { desc: "Freezing fog",         icon: "🌫️",  colors: ["#C9D6E3","#8EAABE"] },
  51: { desc: "Light drizzle",        icon: "🌦️",  colors: ["#74b9ff","#0984e3"] },
  53: { desc: "Drizzle",              icon: "🌦️",  colors: ["#74b9ff","#0984e3"] },
  55: { desc: "Dense drizzle",        icon: "🌧️",  colors: ["#636FA4","#4568DC"] },
  61: { desc: "Light rain",           icon: "🌧️",  colors: ["#3C6E71","#284B63"] },
  63: { desc: "Moderate rain",        icon: "🌧️",  colors: ["#3C6E71","#1B4965"] },
  65: { desc: "Heavy rain",           icon: "🌧️",  colors: ["#2C3E50","#1B4965"] },
  71: { desc: "Light snow",           icon: "🌨️",  colors: ["#E8EFF5","#B0C4CE"] },
  73: { desc: "Moderate snow",        icon: "❄️",  colors: ["#D7E1EC","#AAC4D8"] },
  75: { desc: "Heavy snow",           icon: "❄️",  colors: ["#C8D8E4","#97B4C8"] },
  80: { desc: "Rain showers",         icon: "🌦️",  colors: ["#667DB6","#0082C8"] },
  81: { desc: "Moderate showers",     icon: "🌧️",  colors: ["#536976","#292E49"] },
  82: { desc: "Violent showers",      icon: "⛈️",  colors: ["#373B44","#4286f4"] },
  95: { desc: "Thunderstorm",         icon: "⛈️",  colors: ["#373B44","#4286f4"] },
  96: { desc: "T-storm + hail",       icon: "⛈️",  colors: ["#2C3E50","#4CA1AF"] },
  99: { desc: "T-storm + heavy hail", icon: "⛈️",  colors: ["#2C3E50","#4CA1AF"] },
};

function getWMO(code) {
  return WMO[code] || WMO[0];
}

function windDir(deg) {
  if (deg == null) return "";
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function dayName(dateStr, i) {
  if (i === 0) return "Today";
  if (i === 1) return "Tmrw";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en", { weekday: "short" });
}

export default function WeatherWidget({ theme: t }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState("Locating...");
  const [coords, setCoords] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  /* ─── Get user location ─── */
  useEffect(() => {
    (async () => {
      // Check AsyncStorage for saved location
      try {
        const saved = await AsyncStorage.getItem("pulse_weather_location");
        if (saved) {
          const { lat, lon, name } = JSON.parse(saved);
          setCoords({ lat, lon });
          setLocationName(name);
          return;
        }
      } catch {}

      // Request permission + get location
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
          reverseGeocode(loc.coords.latitude, loc.coords.longitude);
        } else {
          // Default: New Delhi
          setCoords({ lat: 28.6139, lon: 77.209 });
          setLocationName("New Delhi");
        }
      } catch {
        setCoords({ lat: 28.6139, lon: 77.209 });
        setLocationName("New Delhi");
      }
    })();
  }, []);

  const reverseGeocode = async (lat, lon) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`
      );
      const data = await res.json();
      const city =
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.state ||
        "Your Location";
      setLocationName(city);
    } catch {
      setLocationName("Your Location");
    }
  };

  /* ─── Fetch weather ─── */
  const fetchWeather = useCallback(async () => {
    if (!coords) return;
    setLoading(true);
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&timezone=auto&forecast_days=7`;
      const res = await fetch(url);
      const data = await res.json();
      setWeather(data);
    } catch {} finally {
      setLoading(false);
    }
  }, [coords]);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  /* ─── Location search ─── */
  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en`
      );
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    }
  };

  const selectLocation = async (loc) => {
    const name = `${loc.name}${loc.admin1 ? `, ${loc.admin1}` : ""}`;
    setCoords({ lat: loc.latitude, lon: loc.longitude });
    setLocationName(name);
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    try {
      await AsyncStorage.setItem(
        "pulse_weather_location",
        JSON.stringify({ lat: loc.latitude, lon: loc.longitude, name })
      );
    } catch {}
  };

  /* ─── Loading ─── */
  if (loading || !weather?.current) {
    return (
      <View style={[s.loadingWrap, { backgroundColor: t.cardBg }]}>
        <Text style={{ fontSize: 32 }}>🌤️</Text>
        <ActivityIndicator size="small" color={t.accentBlue} style={{ marginTop: 8 }} />
        <Text style={{ color: t.textSecondary, fontSize: 13, marginTop: 4 }}>
          Loading weather...
        </Text>
      </View>
    );
  }

  const cur = weather.current;
  const daily = weather.daily;
  const wmo = getWMO(cur.weather_code);

  return (
    <View style={s.wrapper}>
      {/* Main current weather card */}
      <View style={[s.mainCard, { backgroundColor: wmo.colors[0] }]}>
        {/* Location bar */}
        <View style={s.locationRow}>
          <TouchableOpacity
            onPress={() => setSearchOpen(!searchOpen)}
            style={s.locationBtn}
          >
            <Ionicons name="location" size={14} color="#fff" />
            <Text style={s.locationText}>{locationName}</Text>
            <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <Text style={s.dateText}>
            {new Date().toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" })}
          </Text>
        </View>

        {/* Search */}
        {searchOpen && (
          <View style={s.searchBox}>
            <TextInput
              autoFocus
              placeholder="Search city..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={searchQuery}
              onChangeText={handleSearch}
              style={s.searchInput}
            />
            {searchResults.map((loc, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => selectLocation(loc)}
                style={s.searchResult}
              >
                <Ionicons name="location-outline" size={14} color="#fff" />
                <Text style={s.searchResultText}>
                  {loc.name}{loc.admin1 ? `, ${loc.admin1}` : ""}{loc.country ? ` — ${loc.country}` : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Big temp + icon */}
        <View style={s.tempRow}>
          <Text style={s.weatherIcon}>{wmo.icon}</Text>
          <View>
            <Text style={s.tempBig}>{Math.round(cur.temperature_2m)}°</Text>
            <Text style={s.descText}>{wmo.desc}</Text>
          </View>
        </View>

        {/* Details row */}
        <View style={s.detailsRow}>
          <View style={s.detailItem}>
            <Ionicons name="water-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={s.detailVal}>{cur.relative_humidity_2m}%</Text>
          </View>
          <View style={s.detailItem}>
            <Ionicons name="thermometer-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={s.detailVal}>Feels {Math.round(cur.apparent_temperature)}°</Text>
          </View>
          <View style={s.detailItem}>
            <Ionicons name="flag-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={s.detailVal}>
              {Math.round(cur.wind_speed_10m)} km/h {windDir(cur.wind_direction_10m)}
            </Text>
          </View>
        </View>
      </View>

      {/* 7-day forecast */}
      {daily && (
        <View style={[s.forecastWrap, { backgroundColor: t.cardBg, borderColor: t.border }]}>
          <Text style={[s.forecastTitle, { color: t.text }]}>7-Day Forecast</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={daily.time}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item, index }) => {
              const dWmo = getWMO(daily.weather_code[index]);
              return (
                <View style={[s.dayCard, { backgroundColor: t.bg, borderColor: t.border }]}>
                  <Text style={[s.dayName, { color: t.textSecondary }]}>{dayName(item, index)}</Text>
                  <Text style={{ fontSize: 22 }}>{dWmo.icon}</Text>
                  <Text style={[s.dayTemp, { color: t.text }]}>
                    {Math.round(daily.temperature_2m_max[index])}°
                  </Text>
                  <Text style={{ fontSize: 11, color: t.textSecondary }}>
                    {Math.round(daily.temperature_2m_min[index])}°
                  </Text>
                  {daily.precipitation_probability_max[index] > 20 && (
                    <View style={s.rainChip}>
                      <Ionicons name="water" size={9} color="#1d9bf0" />
                      <Text style={{ fontSize: 9, color: "#1d9bf0" }}>
                        {daily.precipitation_probability_max[index]}%
                      </Text>
                    </View>
                  )}
                </View>
              );
            }}
          />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  loadingWrap: {
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
  },
  wrapper: { paddingHorizontal: 12, paddingTop: 8 },
  mainCard: {
    borderRadius: 20,
    padding: 18,
    overflow: "hidden",
  },
  locationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  locationBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  locationText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  dateText: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  searchBox: {
    marginTop: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
    padding: 8,
  },
  searchInput: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: "#fff",
  },
  searchResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  searchResultText: { color: "#fff", fontSize: 13 },
  tempRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 12,
  },
  weatherIcon: { fontSize: 56 },
  tempBig: { color: "#fff", fontSize: 48, fontWeight: "800", lineHeight: 52 },
  descText: { color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: "500" },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailVal: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },
  forecastWrap: {
    borderRadius: 16,
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
  },
  forecastTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  dayCard: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 8,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 72,
  },
  dayName: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  dayTemp: { fontSize: 15, fontWeight: "700", marginTop: 2 },
  rainChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 4,
  },
});
