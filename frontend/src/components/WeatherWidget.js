import { useEffect, useState, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════
   WeatherWidget — stunning gradient + animated weather card
   Uses Open-Meteo API (free, no key)
   ═══════════════════════════════════════════════════════════ */

/* ─── WMO weather-code → description + icon ─── */
const WMO = {
  0:  { desc: "Clear sky",            icon: "☀️",  bg: ["#FF9500","#FF5E3A"], night: ["#0F2027","#2C5364"] },
  1:  { desc: "Mainly clear",         icon: "🌤️",  bg: ["#F7B733","#FC4A1A"], night: ["#0F2027","#2C5364"] },
  2:  { desc: "Partly cloudy",        icon: "⛅",  bg: ["#89CFF0","#667DB6"], night: ["#1a2a3a","#2C5364"] },
  3:  { desc: "Overcast",             icon: "☁️",  bg: ["#8E9BAE","#5C6975"], night: ["#232526","#414345"] },
  45: { desc: "Fog",                  icon: "🌫️",  bg: ["#B5B5B5","#8E8E8E"], night: ["#2c3e50","#4a6574"] },
  48: { desc: "Freezing fog",         icon: "🌫️",  bg: ["#C9D6E3","#8EAABE"], night: ["#2c3e50","#4a6574"] },
  51: { desc: "Light drizzle",        icon: "🌦️",  bg: ["#74b9ff","#0984e3"], night: ["#141E30","#243B55"] },
  53: { desc: "Drizzle",              icon: "🌦️",  bg: ["#74b9ff","#0984e3"], night: ["#141E30","#243B55"] },
  55: { desc: "Dense drizzle",        icon: "🌧️",  bg: ["#636FA4","#4568DC"], night: ["#141E30","#243B55"] },
  61: { desc: "Light rain",           icon: "🌧️",  bg: ["#3C6E71","#284B63"], night: ["#141E30","#243B55"] },
  63: { desc: "Moderate rain",        icon: "🌧️",  bg: ["#3C6E71","#1B4965"], night: ["#0f0c29","#24243e"] },
  65: { desc: "Heavy rain",           icon: "🌧️",  bg: ["#2C3E50","#1B4965"], night: ["#0f0c29","#302b63"] },
  71: { desc: "Light snow",           icon: "🌨️",  bg: ["#E8EFF5","#B0C4CE"], night: ["#2c3e50","#4a6574"] },
  73: { desc: "Moderate snow",        icon: "❄️",  bg: ["#D7E1EC","#AAC4D8"], night: ["#2c3e50","#4a6574"] },
  75: { desc: "Heavy snow",           icon: "❄️",  bg: ["#C8D8E4","#97B4C8"], night: ["#283E51","#4B79A1"] },
  80: { desc: "Rain showers",         icon: "🌦️",  bg: ["#667DB6","#0082C8"], night: ["#141E30","#243B55"] },
  81: { desc: "Moderate showers",     icon: "🌧️",  bg: ["#536976","#292E49"], night: ["#0f0c29","#24243e"] },
  82: { desc: "Violent showers",      icon: "⛈️",  bg: ["#373B44","#4286f4"], night: ["#0f0c29","#302b63"] },
  95: { desc: "Thunderstorm",         icon: "⛈️",  bg: ["#373B44","#4286f4"], night: ["#0f0c29","#302b63"] },
  96: { desc: "T-storm + hail",       icon: "⛈️",  bg: ["#2C3E50","#4CA1AF"], night: ["#0f0c29","#302b63"] },
  99: { desc: "T-storm + heavy hail", icon: "⛈️",  bg: ["#2C3E50","#4CA1AF"], night: ["#0f0c29","#302b63"] },
};

function getWMO(code, isNight) {
  const entry = WMO[code] || WMO[0];
  return { ...entry, gradient: isNight ? entry.night : entry.bg };
}

function isNightTime() {
  const h = new Date().getHours();
  return h < 6 || h > 19;
}

/* ─── Animated weather particles (rain / snow / sun rays) ─── */
function WeatherParticles({ code }) {
  const isRain = [51,53,55,61,63,65,80,81,82,95,96,99].includes(code);
  const isSnow = [71,73,75].includes(code);
  const isSunny = [0,1].includes(code);

  if (isSunny) {
    return (
      <div style={{ position: "absolute", top: 10, right: 10, opacity: 0.25 }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)",
          animation: "sunPulse 3s ease-in-out infinite",
        }} />
        <style>{`
          @keyframes sunPulse {
            0%, 100% { transform: scale(1); opacity: 0.3; }
            50% { transform: scale(1.3); opacity: 0.5; }
          }
        `}</style>
      </div>
    );
  }

  if (isRain) {
    const drops = Array.from({ length: 20 }, (_, i) => i);
    return (
      <>
        {drops.map(i => (
          <div key={i} style={{
            position: "absolute",
            left: `${Math.random() * 100}%`,
            top: -10,
            width: 2, height: 12 + Math.random() * 8,
            background: "rgba(255,255,255,0.25)",
            borderRadius: 2,
            animation: `rainFall ${0.6 + Math.random() * 0.5}s linear infinite`,
            animationDelay: `${Math.random() * 1}s`,
          }} />
        ))}
        <style>{`
          @keyframes rainFall {
            0% { transform: translateY(-10px); opacity: 0.7; }
            100% { transform: translateY(200px); opacity: 0; }
          }
        `}</style>
      </>
    );
  }

  if (isSnow) {
    const flakes = Array.from({ length: 15 }, (_, i) => i);
    return (
      <>
        {flakes.map(i => (
          <div key={i} style={{
            position: "absolute",
            left: `${Math.random() * 100}%`,
            top: -10,
            width: 6, height: 6, borderRadius: "50%",
            background: "rgba(255,255,255,0.5)",
            animation: `snowFall ${2 + Math.random() * 2}s linear infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }} />
        ))}
        <style>{`
          @keyframes snowFall {
            0% { transform: translateY(-10px) rotate(0deg); opacity: 0.8; }
            100% { transform: translateY(200px) rotate(360deg); opacity: 0; }
          }
        `}</style>
      </>
    );
  }

  return null;
}

/* ─── Wind direction from degrees ─── */
function windDir(deg) {
  if (deg == null) return "";
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
}

/* ─── Day name helper ─── */
function dayName(dateStr, i) {
  if (i === 0) return "Today";
  if (i === 1) return "Tomorrow";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en", { weekday: "short" });
}

export default function WeatherWidget({ theme: t }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState("Locating...");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [coords, setCoords] = useState(null);
  const searchTimeout = useRef(null);

  /* ─── Get user location ─── */
  useEffect(() => {
    // Check localStorage for saved location
    try {
      const saved = localStorage.getItem("pulse_weather_location");
      if (saved) {
        const { lat, lon, name } = JSON.parse(saved);
        setCoords({ lat, lon });
        setLocationName(name);
        return;
      }
    } catch {}

    // Geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          // Reverse geocode
          fetch(`https://geocoding-api.open-meteo.com/v1/search?name=&latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&count=1`)
            .catch(() => {});
          reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          // Default: New Delhi
          setCoords({ lat: 28.6139, lon: 77.209 });
          setLocationName("New Delhi");
        },
        { timeout: 5000 }
      );
    } else {
      setCoords({ lat: 28.6139, lon: 77.209 });
      setLocationName("New Delhi");
    }
  }, []);

  const reverseGeocode = async (lat, lon) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`);
      const data = await res.json();
      const city = data.address?.city || data.address?.town || data.address?.village || data.address?.state || "Unknown";
      setLocationName(city);
    } catch {
      setLocationName("Your Location");
    }
  };

  /* ─── Fetch weather data ─── */
  const fetchWeather = useCallback(async () => {
    if (!coords) return;
    setLoading(true);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,uv_index,cloud_cover` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset` +
        `&timezone=auto&forecast_days=7`;
      const res = await fetch(url);
      const data = await res.json();
      setWeather(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [coords]);

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  /* ─── Location search ─── */
  const handleSearch = (q) => {
    setSearchQuery(q);
    clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch { setSearchResults([]); }
    }, 300);
  };

  const selectLocation = (loc) => {
    const name = `${loc.name}${loc.admin1 ? `, ${loc.admin1}` : ""}`;
    setCoords({ lat: loc.latitude, lon: loc.longitude });
    setLocationName(name);
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    try {
      localStorage.setItem("pulse_weather_location", JSON.stringify({ lat: loc.latitude, lon: loc.longitude, name }));
    } catch {}
  };

  /* ─── Render ─── */
  if (loading || !weather?.current) {
    return (
      <div style={{
        borderRadius: 16, padding: 24, textAlign: "center",
        background: t.cardBg, color: t.textSecondary, fontSize: 14,
        minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🌤️</div>
          Loading weather...
        </div>
      </div>
    );
  }

  const cur = weather.current;
  const daily = weather.daily;
  const night = isNightTime();
  const wmo = getWMO(cur.weather_code, night);
  const [g1, g2] = wmo.gradient;

  return (
    <div style={{
      borderRadius: 16,
      overflow: "hidden",
      position: "relative",
      background: `linear-gradient(135deg, ${g1}, ${g2})`,
      color: "#fff",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      transition: "background 0.5s",
    }}>
      <WeatherParticles code={cur.weather_code} />

      {/* Header: location + search toggle */}
      <div style={{ padding: "16px 16px 0", position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none", borderRadius: 20,
              color: "#fff", fontSize: 13, fontWeight: 600,
              padding: "5px 12px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              backdropFilter: "blur(4px)",
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="#fff"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            {locationName}
            <svg viewBox="0 0 24 24" width="12" height="12" fill="#fff"><path d="M7 10l5 5 5-5z"/></svg>
          </button>
          <div style={{ fontSize: 11, opacity: 0.7 }}>
            {new Date().toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" })}
          </div>
        </div>

        {/* Location search dropdown */}
        {searchOpen && (
          <div style={{
            marginTop: 8, background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(12px)", borderRadius: 12,
            padding: 8, position: "absolute", left: 16, right: 16, zIndex: 10,
          }}>
            <input
              autoFocus
              placeholder="Search city..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px", border: "none",
                borderRadius: 8, fontSize: 14, color: "#fff",
                background: "rgba(255,255,255,0.15)", outline: "none",
                boxSizing: "border-box",
              }}
            />
            {searchResults.length > 0 && (
              <div style={{ marginTop: 4, maxHeight: 160, overflowY: "auto" }}>
                {searchResults.map((loc, i) => (
                  <div key={i} onClick={() => selectLocation(loc)} style={{
                    padding: "8px 12px", cursor: "pointer", fontSize: 13,
                    borderRadius: 6, transition: "background 0.12s",
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    {loc.name}{loc.admin1 ? `, ${loc.admin1}` : ""} <span style={{ opacity: 0.5 }}>— {loc.country}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main temp + icon */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px 8px", position: "relative", zIndex: 1,
      }}>
        <div>
          <div style={{ fontSize: 56, fontWeight: 200, lineHeight: 1 }}>
            {Math.round(cur.temperature_2m)}°
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, opacity: 0.85, marginTop: 4 }}>
            {wmo.desc}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
            Feels like {Math.round(cur.apparent_temperature)}°
          </div>
        </div>
        <div style={{ fontSize: 56, lineHeight: 1, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.2))" }}>
          {wmo.icon}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        gap: 1, margin: "0 16px 12px",
        background: "rgba(255,255,255,0.1)", borderRadius: 12,
        overflow: "hidden",
      }}>
        {[
          { label: "Humidity", value: `${cur.relative_humidity_2m}%`, icon: "💧" },
          { label: "Wind", value: `${Math.round(cur.wind_speed_10m)} km/h ${windDir(cur.wind_direction_10m)}`, icon: "💨" },
          { label: "UV Index", value: cur.uv_index != null ? cur.uv_index.toFixed(1) : "—", icon: "☀️" },
          { label: "Pressure", value: `${Math.round(cur.pressure_msl)} hPa`, icon: "🔵" },
          { label: "Clouds", value: `${cur.cloud_cover}%`, icon: "☁️" },
          { label: "Hi/Lo", value: daily ? `${Math.round(daily.temperature_2m_max[0])}° / ${Math.round(daily.temperature_2m_min[0])}°` : "—", icon: "🌡️" },
        ].map((s, i) => (
          <div key={i} style={{
            padding: "10px 8px", textAlign: "center",
            background: "rgba(255,255,255,0.08)",
          }}>
            <div style={{ fontSize: 14 }}>{s.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{s.value}</div>
            <div style={{ fontSize: 10, opacity: 0.6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 7-day forecast strip */}
      {daily && (
        <div style={{
          display: "flex", overflowX: "auto",
          padding: "0 12px 14px", gap: 4,
          msOverflowStyle: "none", scrollbarWidth: "none",
        }}>
          {daily.time.slice(0, 7).map((date, i) => {
            const dWmo = getWMO(daily.weather_code[i], false);
            return (
              <div key={date} style={{
                flex: "0 0 auto", width: 56,
                padding: "8px 4px", textAlign: "center",
                background: i === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)",
                borderRadius: 10, fontSize: 11,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{dayName(date, i)}</div>
                <div style={{ fontSize: 18, lineHeight: 1 }}>{dWmo.icon}</div>
                <div style={{ marginTop: 4, fontWeight: 500 }}>
                  {Math.round(daily.temperature_2m_max[i])}°
                </div>
                <div style={{ opacity: 0.5, fontSize: 10 }}>
                  {Math.round(daily.temperature_2m_min[i])}°
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
