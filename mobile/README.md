# Pulse Mobile — React Native (Expo)

Native iOS & Android companion app for the Pulse social platform.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 | https://nodejs.org |
| Expo CLI | latest | `npm install -g expo-cli` |
| Expo Go (phone) | latest | App Store / Play Store |

## Quick Start

```bash
cd mobile

# 1 — Install dependencies
npm install

# 2 — Start the Expo dev server
npx expo start
```

Then scan the QR code with **Expo Go** (Android) or the Camera app (iOS).

## Connecting to Your Backend

Edit **`src/api/client.js`** and set `BASE_URL`:

| Device | URL |
|--------|-----|
| iOS Simulator | `http://localhost:8000` |
| Android Emulator | `http://10.0.2.2:8000` |
| Physical Device | `http://<your-LAN-IP>:8000` |

> Find your LAN IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`

## Project Structure

```
mobile/
├── App.js                       # Entry point
├── app.json                     # Expo config
├── package.json
└── src/
    ├── api/
    │   └── client.js            # Axios instance + auth interceptor
    ├── context/
    │   ├── AuthContext.js        # JWT token via SecureStore
    │   └── ThemeContext.js       # Dark / light mode
    ├── navigation/
    │   ├── RootNavigator.js     # Auth gate
    │   ├── AuthStack.js         # Login / Signup
    │   └── MainTabs.js          # Bottom tabs + nested stacks
    ├── screens/
    │   ├── LoginScreen.js
    │   ├── SignupScreen.js
    │   ├── FeedScreen.js        # Home feed + compose + search
    │   ├── ProfileScreen.js     # View / edit profile
    │   ├── PostDetailScreen.js  # Single post + comments
    │   ├── BookmarksScreen.js
    │   ├── TrendingScreen.js    # NER-powered trending entities
    │   ├── EntityExploreScreen.js
    │   └── FollowListScreen.js
    └── utils/
        └── helpers.js           # timeAgo, etc.
```

## Features (mirrors web app)

- Login / Signup with JWT auth (stored in SecureStore)
- Home feed with pull-to-refresh
- Create text posts
- Like, comment, bookmark
- Search posts
- NER entity tags — tap to explore
- Trending entities
- User profiles with follow/unfollow
- Edit own profile (username, bio, profile picture)
- Followers / following lists
- Dark mode toggle
- Bottom tab navigation

## Building for Production

```bash
# Build for iOS (requires Apple Developer account)
npx expo build:ios

# Build for Android
npx expo build:android

# Or use EAS Build (recommended)
npm install -g eas-cli
eas build --platform all
```

## Adding an AsyncStorage Dependency

The ThemeContext uses `@react-native-async-storage/async-storage`.
Install it:

```bash
npx expo install @react-native-async-storage/async-storage
```
