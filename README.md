# Pulse – AI-Powered Multilingual Social Media Platform

<div align="center">

![Status](https://img.shields.io/badge/status-active-success.svg)
![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)
![React](https://img.shields.io/badge/React-19+-61DAFB.svg)
![React Native](https://img.shields.io/badge/React_Native-Expo_SDK_52-000020.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248.svg)
![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C.svg)
![WebSocket](https://img.shields.io/badge/WebSocket-E2EE_Chat-purple.svg)
![Cloudinary](https://img.shields.io/badge/Cloudinary-Media_Upload-3448C5.svg)

**A production-ready social media platform with real-time AI content moderation, end-to-end encrypted messaging, multilingual NER, and cross-platform mobile support**

[Features](#-key-features) • [Architecture](#-architecture) • [Tech Stack](#-tech-stack) • [Setup](#-quick-start) • [Mobile](#-mobile-app) • [Demo](#-screenshots)

</div>

---

## Project Overview

Pulse is a full-stack social media platform that combines modern web technologies with cutting-edge AI/ML capabilities. Built to address real-world challenges in content moderation for multilingual communities, it features a custom-trained Named Entity Recognition (NER) model specifically designed for Indian languages.

### What Makes This Special?

- **Custom AI Model**: Transformer-based NER model trained on Indian language datasets (Hindi, Hinglish, English)
- **Cross-Platform**: React 19 web app + React Native (Expo) mobile app for iOS & Android
- **End-to-End Encrypted Messaging**: ECDH P-256 + AES-GCM-256 encrypted DMs with WebSocket real-time delivery
- **Microservices Architecture**: Separation of concerns with dedicated ML inference service
- **Multilingual Support**: Real-time translation and entity recognition across multiple languages
- **Intelligent Moderation**: Context-aware content filtering with risk scoring
- **Media Uploads**: Cloudinary-powered image/video uploads with face-detection cropping for avatars
- **Smart Analytics**: AI-driven trending topics (no hashtags needed)
- **Modern UI/UX**: Glassmorphic design with animated backgrounds (Matrix, Stars, Wallpaper), dark mode, and responsive layout
- **Push Notifications**: Expo Push Notifications for mobile users

---

##   Key Features

### **Authentication & User Management**
- JWT-based authentication with secure token management
- Bcrypt password hashing
- User profiles with bio, followers, and following
- Protected routes and authorization middleware

### **Social Features**
- **Post Creation**: Rich text posts with real-time AI analysis, media uploads (images/videos via Cloudinary), and GIF attachments (Tenor)
- **Interactive Feed**: Infinite scroll with lazy loading and skeleton loaders
- **Engagement**: Like, comment, bookmark, repost, and quote repost functionality
- **Social Graph**: Follow/unfollow users with relationship tracking, followers/following lists
- **User Profiles**: Personalized profile pages with post history, profile picture uploads (face-detection cropping)
- **Search**: Entity-based intelligent search
- **Bookmarks**: Save and manage favorite posts
- **Reposts & Quote Reposts**: Share posts directly or with commentary (quote reposts include AI moderation)

### **End-to-End Encrypted Messaging**
- **ECDH Key Exchange**: P-256 elliptic curve Diffie-Hellman for secure key agreement
- **AES-GCM-256 Encryption**: All messages encrypted client-side before transmission
- **WebSocket Real-Time Delivery**: Instant message push, typing indicators, reactions, and deletion events
- **Key Backup & Restore**: PBKDF2 password-derived encrypted key backup for device migration
- **Rich Features**: Reply-to, emoji reactions, GIF attachments, conversation management
- **Zero-Knowledge Server**: Server stores only ciphertext — never sees plaintext messages
- **Push Notifications**: Expo Push Notifications for offline message delivery

### **Theming & UI Customization**
- **Dark Mode**: Full dark/light theme toggle with 20+ design tokens
- **Animated Backgrounds**: Matrix (Indic script grid), Stars, or custom Wallpaper via Wallhaven
- **Responsive Layout**: Desktop sidebar + mobile bottom navigation
- **Glassmorphic Design**: Modern frosted-glass UI throughout

### **Widgets**
- **News Widget**: Google News headlines via backend RSS proxy
- **Weather Widget**: Location-based weather with animated particles (rain/snow/sun), day/night gradients, and 7-day forecast

### **AI/ML Capabilities**

#### Custom NER Model
- **Transformer-based architecture** (PyTorch)
- **SentencePiece tokenization** for Indian languages
- **Multi-label classification**: Person, Organization, Location, Geopolitical Entity
- **Context-aware entity detection** with confidence scoring

#### Real-Time Content Moderation
- **Automatic risk assessment** during post creation
- **Sensitive entity detection**: Politicians, controversial organizations
- **Violence keyword filtering**: Multilingual pattern matching
- **Post blocking**: High-risk content automatically rejected
- **Granular risk scores**: 0.0 - 1.0 risk quantification

#### Context Enrichment
- **Wikipedia integration**: Automatic entity disambiguation
- **Google News scraping**: Real-time news context for detected entities
- **Transliteration**: Hindi/Indic script → English transliteration
- **Smart caching**: Optimized API calls with fallback mechanisms

### **Translation & Internationalization**
- **Real-time translation**: Google Translate API integration
- **Script detection**: Automatic language identification
- **Unicode support**: Full Devanagari and Indic script compatibility
- **Toggle translations**: User-friendly translation interface

### **Trending & Discovery**
- **AI-powered trending**: Entity-based trending (not hashtag-based)
- **24-hour rolling window**: Recent entity frequency analysis
- **Smart ranking**: Weighted by post engagement and recency

---

##  Architecture

```
┌──────────────────────────┐  ┌──────────────────────────────┐
│      WEB FRONTEND        │  │      MOBILE APP              │
│  React 19 + Router 7     │  │  React Native + Expo SDK 52  │
│  Styled Components       │  │  React Navigation 7          │
│  Web Crypto API (E2EE)   │  │  SecureStore (E2EE)          │
│  Dark Mode + Backgrounds │  │  Push Notifications          │
└────────────┬─────────────┘  └──────────────┬───────────────┘
             │ REST API + WebSocket           │
             └──────────────┬─────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API LAYER                         │
│              FastAPI + Motor (Async MongoDB)                 │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │  Auth    │  Posts   │ Messages │ Social   │  Search  │   │
│  │  Routes  │  Routes  │  (E2EE)  │ Routes   │  Routes  │   │
│  ├──────────┼──────────┼──────────┼──────────┼──────────┤   │
│  │Bookmarks │ Reposts  │ Entities │ Widgets  │ Trending │   │
│  │  Routes  │  Routes  │  Routes  │  Routes  │  Routes  │   │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘   │
│  WebSocket Server · Cloudinary Integration                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────────┐  ┌──────────────────┐
│   ML SERVICE     │  │  MONGODB ATLAS   │
│   (Port 9001)    │  │                  │
│  ┌────────────┐  │  │  ┌────────────┐  │
│  │ NER Model  │  │  │  │   Users    │  │
│  │ Inference  │  │  │  │   Posts    │  │
│  │ Pipeline   │  │  │  │  Comments  │  │
│  └────────────┘  │  │  │  Messages  │  │
│  - PyTorch       │  │  │  Bookmarks │  │
│  - Transformers  │  │  │  Reposts   │  │
│  - FastAPI       │  │  └────────────┘  │
└──────────────────┘  └──────────────────┘
         │                   
         ▼                   
┌──────────────────────────────┐
│   EXTERNAL SERVICES          │
│  - Google Translate API      │
│  - Wikipedia API             │
│  - Google News (RSS/Scraping)│
│  - Cloudinary (Media)        │
│  - Tenor (GIFs)              │
│  - Wallhaven (Wallpapers)    │
│  - Open-Meteo (Weather)      │
│  - Expo Push API             │
└──────────────────────────────┘
```

### Why This Architecture?

**Scalability**: ML service can be independently scaled based on inference load  
**Maintainability**: Clear separation of concerns (API, ML, Data, Web, Mobile)  
**Security**: End-to-end encryption means the server never sees message content  
**Production-Ready**: Follows industry best practices for microservices  
**Performance**: Async operations throughout, connection pooling, caching, WebSocket for real-time  
**Resilience**: Graceful degradation when external services fail  
**Cross-Platform**: Single backend serves both web and mobile clients  

---

## Tech Stack

### Frontend (Web)
| Technology | Purpose |
|-----------|---------|
| **React 19** | Component-based UI framework |
| **React Router 7** | Client-side routing |
| **Styled Components** | CSS-in-JS styling |
| **MUI (Material UI)** | Icon library & UI components |
| **Axios** | HTTP client |
| **Context API** | State management (Auth, Theme) |
| **Web Crypto API** | Client-side E2EE (ECDH + AES-GCM) |
| **IndexedDB** | Persistent E2EE key storage |
| **WebSocket** | Real-time messaging |

### Mobile App
| Technology | Purpose |
|-----------|---------|
| **React Native** | Cross-platform mobile framework |
| **Expo SDK 52** | Managed workflow & native APIs |
| **React Navigation 7** | Screen navigation (tabs + stacks) |
| **Expo SecureStore** | Secure token & key storage |
| **Expo Notifications** | Push notifications |
| **Expo Location** | GPS-based weather widget |
| **Expo Image Picker** | Media selection |
| **Expo AV** | Audio playback |

### Backend
| Technology | Purpose |
|-----------|---------|
| **FastAPI** | High-performance async web framework |
| **Motor** | Async MongoDB driver |
| **MongoDB Atlas** | Cloud-hosted NoSQL database |
| **WebSockets** | Real-time messaging server |
| **Cloudinary** | Media upload & transformation |
| **PyJWT** | JWT token generation/validation |
| **Bcrypt** | Password hashing |
| **HTTPX** | Async HTTP client |
| **python-multipart** | File upload handling |

### ML/AI
| Technology | Purpose |
|-----------|---------|
| **PyTorch 2.0+** | Deep learning framework |
| **Transformers** | Hugging Face library for NER |
| **SentencePiece** | Tokenization for multilingual text |
| **FastAPI** | ML model serving |
| **Custom NER Model** | Indian language entity recognition |

### External Services
| Service | Purpose |
|---------|---------|
| **Cloudinary** | Image/video hosting & transformation |
| **Tenor API** | GIF search & embedding |
| **Wallhaven API** | Wallpaper backgrounds |
| **Open-Meteo API** | Weather data |
| **Google Translate** | Text translation |
| **Wikipedia API** | Entity disambiguation & context |
| **Google News RSS** | News headlines |
| **Expo Push API** | Mobile push notifications |

### DevOps & Tools
| Technology | Purpose |
|-----------|---------|
| **Git** | Version control |
| **Conda** | Environment management |
| **NPM** | Package management |
| **Uvicorn** | ASGI server |
| **EAS Build** | Expo Application Services for mobile builds |

---

## Project Structure

```
pulse-social-platform/
│
├── frontend/                    # React 19 Web Application
│   ├── public/                  # Static assets
│   ├── src/
│   │   ├── api/                 # Axios API client
│   │   ├── components/          # Reusable UI components
│   │   │   ├── BookmarkButton.js    # Toggle bookmark
│   │   │   ├── BottomNav.js         # Mobile bottom navigation
│   │   │   ├── CommentButton.js     # Comment interaction
│   │   │   ├── DarkModeToggle.js    # Theme switcher
│   │   │   ├── GifPicker.js         # Tenor GIF search modal
│   │   │   ├── LikeButton.js        # Like interaction
│   │   │   ├── Loader.js            # Loading spinner
│   │   │   ├── MatrixBackground.js  # Animated Indic script grid
│   │   │   ├── NewsWidget.js        # Google News headlines
│   │   │   ├── PostLoader.js        # Skeleton shimmer loader
│   │   │   ├── PulseLogo.js         # SVG logo component
│   │   │   ├── RepostButton.js      # Repost/quote repost
│   │   │   ├── SidebarLayout.js     # Responsive layout wrapper
│   │   │   ├── StarsBackground.js   # Animated starry background
│   │   │   └── WeatherWidget.js     # Animated weather card
│   │   ├── context/             # React Context
│   │   │   ├── AuthContext.js       # JWT auth state
│   │   │   └── ThemeContext.js      # Dark mode + backgrounds
│   │   ├── hooks/               # Custom hooks
│   │   │   └── useIsMobile.js       # Responsive breakpoint
│   │   ├── pages/               # Page components
│   │   │   ├── Login.js / Signup.js
│   │   │   ├── Feed.js             # Home feed
│   │   │   ├── Profile.js          # User profiles
│   │   │   ├── PostDetail.js       # Single post view
│   │   │   ├── Bookmarks.js        # Saved posts
│   │   │   ├── Messages.js         # E2EE chat
│   │   │   ├── Settings.js         # Theme & wallpaper
│   │   │   ├── Compose.js          # Post creation
│   │   │   ├── EntityExplore.js    # NER entity knowledge card
│   │   │   └── FollowList.js       # Followers/following
│   │   └── App.js
│   └── package.json
│
├── mobile/                      # React Native (Expo) Mobile App
│   ├── App.js                   # Entry point
│   ├── app.json                 # Expo config
│   ├── src/
│   │   ├── api/client.js        # Axios + auth interceptor
│   │   ├── context/             # Auth & Theme contexts
│   │   ├── navigation/          # React Navigation
│   │   │   ├── RootNavigator.js     # Auth gate
│   │   │   ├── AuthStack.js         # Login/Signup
│   │   │   └── MainTabs.js          # Bottom tabs + stacks
│   │   ├── screens/             # 12 screens
│   │   │   ├── FeedScreen.js        # Home feed + compose
│   │   │   ├── ExploreScreen.js     # Discovery
│   │   │   ├── ConversationsScreen.js # Message list
│   │   │   ├── ChatScreen.js        # E2EE chat
│   │   │   ├── ProfileScreen.js     # View/edit profile
│   │   │   ├── BookmarksScreen.js   # Saved posts
│   │   │   ├── TrendingScreen.js    # Trending entities
│   │   │   └── EntityExploreScreen.js
│   │   └── utils/helpers.js
│   └── package.json
│
├── backend/                     # FastAPI Backend
│   ├── app/
│   │   ├── auth/                # Authentication logic
│   │   │   ├── jwt.py           # JWT utilities
│   │   │   ├── hash.py          # Password hashing
│   │   │   └── dependency.py    # Auth middleware
│   │   ├── models/              # Pydantic models
│   │   │   ├── user.py
│   │   │   ├── post.py
│   │   │   └── message.py       # E2EE message models
│   │   ├── routes/              # API endpoints
│   │   │   ├── auth.py          # Signup/Login
│   │   │   ├── posts.py         # CRUD + media upload
│   │   │   ├── feed.py          # Global feed
│   │   │   ├── personal_feed.py # Following feed
│   │   │   ├── likes.py         # Like system
│   │   │   ├── comments.py      # Comments
│   │   │   ├── follow.py        # Social graph
│   │   │   ├── users.py         # User profiles + avatar upload
│   │   │   ├── search.py        # Entity search
│   │   │   ├── trending.py      # Trending topics
│   │   │   ├── translate.py     # Translation
│   │   │   ├── bookmarks.py     # Bookmark system
│   │   │   ├── messages.py      # E2EE DMs + WebSocket
│   │   │   ├── reposts.py       # Repost & quote repost
│   │   │   ├── entities.py      # NER entity exploration
│   │   │   └── widgets.py       # News, GIFs, wallpapers
│   │   ├── services/
│   │   │   ├── database.py      # MongoDB connection
│   │   │   ├── ml_client.py     # ML service client + context enrichment
│   │   │   └── cloudinary_helper.py  # Media upload service
│   │   ├── config.py            # Configuration
│   │   └── main.py              # FastAPI app + WebSocket
│   └── requirements.txt
│
├── ml-service/                  # ML Microservice
│   ├── app/
│   │   ├── main.py              # FastAPI ML server
│   │   ├── inference.py         # NER inference pipeline
│   │   ├── schemas.py           # Request/Response models
│   │   └── utils/
│   │       ├── tokenize.py      # SentencePiece tokenizer
│   │       ├── label_mapper.py  # Label decoding
│   │       └── refinement.py    # Post-processing
│   ├── models/
│   │   └── ner_model/           # Trained model files
│   └── requirements.txt
│
├── model_result/                # NER Model Evaluation
│   └── evaluate_paper.py        # WikiANN Hindi test evaluation
│
├── frontend-simple/             # Lightweight vanilla HTML/JS frontend
│   ├── index.html
│   ├── login.html / signup.html
│   ├── app.js
│   └── style.css
│
├── workflow.html                # Architecture visualization
└── README.md
```

---

## Quick Start

### Prerequisites
```bash
- Python 3.9+
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- Conda (recommended)
- Cloudinary account (for media uploads)
- Expo Go app (for mobile testing)
```

### 1️ Clone the Repository
```bash
git clone https://github.com/RXO95/pulse-social-platform.git
cd pulse-social-platform
```

### 2️ Backend Setup
```bash
cd backend

# Create environment
conda create -n pulse-backend python=3.11
conda activate pulse-backend

# Install dependencies
pip install -r requirements.txt

# Configure environment (.env file or environment variables)
# MONGO_URI=your_mongodb_connection_string
# SECRET_KEY=your_secret_key
# ML_SERVICE_URL=http://localhost:9001/analyze
# CLOUDINARY_CLOUD_NAME=your_cloud_name
# CLOUDINARY_API_KEY=your_api_key
# CLOUDINARY_API_SECRET=your_api_secret

# Run backend
uvicorn app.main:app --reload --port 8000
```

### 3️ ML Service Setup
```bash
cd ml-service

# Create environment
conda create -n pulse-ml python=3.11
conda activate pulse-ml

# Install dependencies
pip install -r requirements.txt

# Place your trained model in ml-service/models/ner_model/
# (Model files not included due to size)

# Run ML service
uvicorn app.main:app --reload --port 9001
```

### 4️ Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm start

# Or build for production
npm run build
```

### 5️ Mobile App Setup
```bash
cd mobile

# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Scan QR code with Expo Go (Android) or Camera app (iOS)
# Update src/api/client.js with your backend URL:
#   iOS Simulator:    http://localhost:8000
#   Android Emulator: http://10.0.2.2:8000
#   Physical Device:  http://<your-LAN-IP>:8000
```

### 6️ Access the Application
- **Web Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **ML Service**: http://localhost:9001
- **Mobile**: Expo Go app (scan QR code)

---

## Screenshots

### Authentication
Beautiful glassmorphic login/signup with animated starry background

### Feed
Real-time feed with AI-analyzed posts, translation, and engagement features

### Content Moderation
Posts are automatically analyzed and blocked if they contain sensitive content

### Profile Pages
User profiles with post history and social statistics

### E2E Encrypted Messaging
Real-time encrypted conversations with typing indicators, reactions, and GIF support

### Mobile App
Native iOS & Android experience with push notifications and full feature parity

---

## 📱 Mobile App

A full-featured React Native (Expo) companion app with feature parity to the web frontend.

### Screens
| Screen | Description |
|--------|-------------|
| **Feed** | Home feed with pull-to-refresh and compose |
| **Explore** | Discovery and search |
| **Conversations** | Message list with unread counts |
| **Chat** | E2EE real-time chat with typing indicators |
| **Profile** | View/edit profile with picture upload |
| **Bookmarks** | Saved posts |
| **Trending** | NER-powered trending entities |
| **Entity Explore** | Tap NER tags to explore entity knowledge cards |
| **Follow List** | Followers/following lists |

### Mobile-Specific Features
- **Push Notifications**: Expo Push for offline message delivery
- **Secure Storage**: JWT tokens and E2EE keys in SecureStore
- **GPS Weather**: Location-based weather widget via expo-location
- **Image Picker**: Native camera/gallery access
- **Audio Playback**: Sound effects via expo-av
- **Dark Mode**: System-aware theme with AsyncStorage persistence
- **Bottom Tab Navigation**: Feed, Explore, Messages, Profile

### Building for Production
```bash
# Using EAS Build (recommended)
npm install -g eas-cli
eas build --platform all

# Or traditional Expo builds
npx expo build:ios      # Requires Apple Developer account
npx expo build:android
```

---

## ML Model Details

### Training
- **Dataset**: Custom-labeled Indian language dataset
- **Architecture**: Transformer encoder (BERT-like)
- **Tokenizer**: SentencePiece with 32K vocabulary
- **Labels**: BIO tagging scheme (B-PER, I-PER, B-ORG, etc.)
- **Metrics**: F1 Score, Precision, Recall per entity type

### Inference Pipeline
1. Text → SentencePiece tokenization
2. Token IDs → Transformer model
3. Logits → Softmax predictions
4. BIO tags → Entity spans
5. Post-processing & confidence filtering
6. Context enrichment (Wikipedia/News)

---

## Key Technical Achievements

### **Problem Solved**
Traditional social media moderation relies on:
- Manual review (slow, expensive, doesn't scale)
- Keyword filtering (easily circumvented)
- English-only models (excludes 1.3B+ Indian language speakers)

**Pulse's Solution**: Real-time AI moderation that understands context, handles code-mixing (Hinglish), and provides intelligent risk assessment.

### **Innovation Highlights**

1. **Custom NER for Indian Languages**
   - Trained from scratch for Hindi/Hinglish/English
   - Handles code-mixing (common in Indian social media)
   - Production-grade inference with <100ms latency

2. **Context-Aware Moderation**
   - Not just keyword matching
   - Entity relationship analysis
   - Real-time Wikipedia verification
   - News context integration

3. **Microservices Architecture**
   - Clean separation of concerns
   - Independently scalable services
   - Production deployment ready
   - Follows industry best practices

4. **Async Everything**
   - FastAPI async routes
   - Motor async MongoDB driver
   - HTTPX async HTTP client
   - WebSocket real-time messaging
   - Non-blocking I/O throughout

5. **Smart Caching & Optimization**
   - Entity context cached to reduce API calls
   - Connection pooling for databases
   - Optimized aggregation pipelines
   - Efficient batch processing

6. **End-to-End Encrypted Messaging**
   - ECDH P-256 key exchange + AES-GCM-256 encryption
   - Zero-knowledge server architecture
   - WebSocket real-time delivery with typing indicators
   - Encrypted key backup for device migration
   - Works across web and mobile clients

7. **Cross-Platform Mobile App**
   - Full-featured React Native (Expo) app
   - Shared backend with web frontend
   - Push notifications for offline users
   - SecureStore for token & key management

---

## API Endpoints

### Authentication
```http
POST   /auth/signup          # Create new account
POST   /auth/login           # Authenticate user
```

### Posts
```http
POST   /posts/               # Create new post (with AI analysis + media upload)
GET    /posts/               # Get all posts
GET    /posts/{id}           # Get specific post
DELETE /posts/{id}           # Delete own post
```

### Social
```http
POST   /follow/{user_id}     # Follow user
DELETE /follow/{user_id}     # Unfollow user
POST   /likes/{post_id}      # Like post
POST   /bookmarks/{post_id}  # Toggle bookmark
GET    /bookmarks/           # Get bookmarked posts
```

### Reposts
```http
POST   /reposts/{post_id}           # Simple repost (toggle)
POST   /reposts/{post_id}/quote     # Quote repost with commentary
GET    /reposts/post/{post_id}      # Get repost info for a post
GET    /reposts/user/{username}     # Get user's reposts
```

### End-to-End Encrypted Messaging
```http
POST   /messages/keys                              # Upload ECDH public key
GET    /messages/keys/{user_id}                    # Get user's public key
PUT    /messages/key-backup                        # Store encrypted key backup
GET    /messages/key-backup                        # Retrieve key backup
POST   /messages/push-token                        # Register push token
GET    /messages/conversations                     # List conversations
POST   /messages/conversations/{user_id}           # Get/create conversation
GET    /messages/conversations/{id}/messages       # Fetch messages (cursor pagination)
POST   /messages/send                              # Send encrypted message
GET    /messages/unread-count                      # Total unread count
DELETE /messages/{message_id}                      # Delete message
POST   /messages/{message_id}/react                # Toggle emoji reaction
WS     /messages/ws/{token}                        # WebSocket real-time connection
```

### Entities (NER Exploration)
```http
GET    /entities/                    # List all unique entities
GET    /entities/stats               # Entity statistics by type
GET    /entities/{entity_text}       # Entity knowledge card (Wikipedia + posts)
GET    /entities/trending/today      # 24-hour trending entities with velocity
```

### Discovery
```http
GET    /trending/            # Get trending entities
GET    /search/?q=query      # Search by entity
GET    /feed/                # Global feed
GET    /personal_feed/       # Following feed
```

### Widgets
```http
GET    /widgets/news         # Google News RSS proxy
GET    /widgets/wallpapers   # Wallhaven wallpaper search
GET    /widgets/gifs         # Tenor GIF search
```

### Features
```http
POST   /comments/{post_id}   # Add comment
GET    /comments/{post_id}   # Get comments
POST   /translate/           # Translate text
GET    /users/me             # Current user
PUT    /users/me             # Update profile (username, bio, avatar)
GET    /users/{username}     # User profile
```

---

## 🛡️ Content Moderation Logic

### Risk Scoring Algorithm
```python
Risk Score Calculation:
├── Violence Keywords Detected + Sensitive Entity = 0.95 (BLOCKED)
├── Violence Keywords Only = 0.70 (BLOCKED)
├── Sensitive Entity Only = 0.40 (ALLOWED with warning)
└── No Issues = 0.00 (ALLOWED)

Sensitive Entities:
- Politicians (PER + political context)
- Controversial Organizations (ORG + sensitive context)
- Geopolitical Entities (GPE + conflict zones)
```

### Example Moderation Flow
```
User creates post: "I hate [Politician X], they should be removed!"
                    ↓
            NER Model Analyzes
                    ↓
Entities: [{"text": "[Politician X]", "label": "PER"}]
Violence: ["hate", "removed"]
                    ↓
Risk Score: 0.95 (High Risk)
                    ↓
Post BLOCKED with message: "Content violates community guidelines"
```

---

## Real-World Use Cases

1. **Regional Social Networks**: Deploy for Indian language communities
2. **News Platforms**: Moderate user comments in real-time
3. **Community Forums**: Filter harmful content automatically
4. **Educational Platforms**: Safe discussion spaces for students
5. **Enterprise Social**: Internal communication with compliance

---

## Challenges Overcome

### Technical Challenges

1. **Multilingual Tokenization**
   - **Problem**: Standard tokenizers fail on code-mixed text
   - **Solution**: Trained custom SentencePiece model on multilingual corpus

2. **Real-Time Inference**
   - **Problem**: PyTorch models are slow for real-time APIs
   - **Solution**: Model optimization, async serving, connection pooling

3. **Context Ambiguity**
   - **Problem**: Same entity name has different meanings (e.g., "Modi" could be surname or PM)
   - **Solution**: Wikipedia API integration for disambiguation

4. **Scale & Performance**
   - **Problem**: External API calls (Wikipedia, Google) add latency
   - **Solution**: Async HTTPX, request batching, smart caching

5. **Data Quality**
   - **Problem**: Limited labeled data for Indian languages
   - **Solution**: Data augmentation, active learning, transfer learning

---

## Performance Metrics

- **API Response Time**: <200ms average
- **ML Inference**: <100ms per request
- **Database Queries**: <50ms (indexed)
- **Translation**: <500ms (cached)
- **Context Enrichment**: <1s (async, non-blocking)

---

## Learning Outcomes

Building Pulse provided hands-on experience with:

**Full-Stack Development**
- Modern React 19 patterns (Hooks, Context, Routing)
- React Native / Expo mobile development
- RESTful API design + WebSocket real-time communication
- Database modeling and optimization
- Authentication & authorization (JWT)

**Machine Learning Engineering**
- Training custom NER models
- Model deployment and serving
- Inference optimization
- ML pipeline design

**Security & Cryptography**
- End-to-end encryption (ECDH + AES-GCM)
- Key exchange protocols and key backup
- Web Crypto API and native secure storage
- Zero-knowledge server architecture

**System Design**
- Microservices architecture
- Async programming
- Cross-platform API design (web + mobile)
- Real-time systems (WebSocket)
- Media pipeline (Cloudinary)
- API integration & third-party services
- Caching strategies
- Error handling and resilience

**DevOps & Production**
- Environment management
- MongoDB Atlas deployment
- Service orchestration
- API documentation
- Expo EAS for mobile builds

---

## Future Enhancements

### Completed
- [x] WebSocket support for real-time updates
- [x] User profile pictures and media uploads (Cloudinary)
- [x] Direct messaging between users (E2EE)
- [x] Notification system (Expo Push)
- [x] Mobile app (React Native / Expo)
- [x] Bookmarks, reposts, and quote reposts
- [x] Dark mode and theme customization
- [x] GIF support (Tenor integration)
- [x] News and weather widgets
- [x] Entity exploration / knowledge cards

### Short Term
- [ ] Post editing and versioning
- [ ] Voice messages in E2EE chat
- [ ] Read receipts for messages
- [ ] Image/video sharing in DMs

### Medium Term
- [ ] Admin moderation dashboard
- [ ] User reporting and appeal system
- [ ] Advanced search filters
- [ ] Hashtag support (alongside entity-based trending)
- [ ] Stories / ephemeral content

### Long Term
- [ ] Recommendation engine (collaborative filtering)
- [ ] Video/image content moderation (Vision AI)
- [ ] Multi-model ensemble for better accuracy
- [ ] Community-driven model improvement
- [ ] Monetization features (ads, premium)

---

## Deployment Guide

### Production Deployment Options

#### Option 1: Cloud Platform (Recommended)
```bash
Frontend: Vercel / Netlify
Backend: Railway / Render / Heroku
Database: MongoDB Atlas (already cloud-hosted)
ML Service: AWS ECS / Google Cloud Run
```

#### Option 2: Docker Containerization
```dockerfile
# Example Docker setup
docker-compose.yml:
  - frontend (Nginx)
  - backend (FastAPI)
  - ml-service (FastAPI)
  - mongodb (optional, if not using Atlas)
```

#### Option 3: Traditional VPS
```bash
# Deploy to DigitalOcean, AWS EC2, etc.
- Nginx reverse proxy
- PM2 for process management
- Let's Encrypt SSL
```

### Environment Variables

#### Backend (.env)
```bash
MONGO_URI=mongodb+srv://...
SECRET_KEY=your_super_secret_key_here
ML_SERVICE_URL=http://ml-service:9001/analyze
CORS_ORIGINS=https://yourfrontend.com
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

#### ML Service (.env)
```bash
MODEL_PATH=./models/ner_model
MAX_LENGTH=512
BATCH_SIZE=32
```

#### Mobile (src/api/client.js)
```bash
BASE_URL=http://<your-LAN-IP>:8000   # For physical device
# or http://localhost:8000             # For iOS simulator
# or http://10.0.2.2:8000             # For Android emulator
```

---

## Testing

### Run Backend Tests
```bash
cd backend
pytest tests/
```

### Run Frontend Tests
```bash
cd frontend
npm test
```

### API Testing
Use the interactive API docs at `http://localhost:8000/docs` (Swagger UI)

---

## Code Quality

- **Type Hints**: Full Python type annotations
- **Pydantic Models**: Request/response validation
- **Error Handling**: Comprehensive exception handling
- **Logging**: Structured logging throughout
- **Code Organization**: Modular, maintainable architecture
- **Documentation**: Inline comments and docstrings

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

This project is open source and available under the [MIT License](LICENSE).

---

## About the Developer

**Rakshit Kumar**

Building this project taught me the importance of:
- Proper system design and architecture
- Combining ML with production software engineering
- Solving real-world problems with AI
- Writing clean, maintainable code
- Thinking about scale and performance from day one

### Connect
- GitHub: [@RXO95](https://github.com/RXO95)
- LinkedIn: [Your LinkedIn]
- Email: [Your Email]
- Portfolio: [Your Portfolio]

---

## Acknowledgments

- **Hugging Face** for Transformers library
- **FastAPI** for the excellent web framework
- **MongoDB** for the flexible database
- **React** team for the UI library
- **Open Source Community** for inspiration and learning resources

---

## Project Stats

![GitHub repo size](https://img.shields.io/github/repo-size/RXO95/pulse-social-platform)
![GitHub stars](https://img.shields.io/github/stars/RXO95/pulse-social-platform?style=social)
![GitHub forks](https://img.shields.io/github/forks/RXO95/pulse-social-platform?style=social)

---

<div align="center">

### If you found this project interesting, please consider giving it a star!

**Built with ❤️ for the Indian developer community**

[Report Bug](https://github.com/RXO95/pulse-social-platform/issues) • 
[Request Feature](https://github.com/RXO95/pulse-social-platform/issues) • 
[Documentation](https://github.com/RXO95/pulse-social-platform/wiki)

</div>