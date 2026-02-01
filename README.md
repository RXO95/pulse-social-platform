# Pulse – AI Powered Social Media Platform

Pulse is a full-stack social media backend inspired by Twitter / Reddit, enhanced with
**AI-powered multilingual content moderation and trending detection**.

The platform integrates a custom-trained **Indian language NER model** with modern backend architecture.

---

## Features

### Authentication
- JWT-based authentication
- Secure password hashing
- Long-lived tokens for development

### Posts
- Create posts
- Global feed
- Personalized feed (following-based)
- Like system

### Social Graph
- Follow / unfollow users
- Followers & following relationships

### AI Moderation (Core Highlight)
- Multilingual Named Entity Recognition (NER)
- Hindi + Hinglish + English support
- Real-time moderation during post creation
- Violence + entity-based risk scoring
- Automatic post blocking for high-risk content

### Trending Topics
- AI-extracted trending entities
- 24-hour rolling trends
- Powered by NER (not hashtags)

---

## Architecture

Frontend (future)
|
v
Backend (FastAPI)
|
v
ML Microservice (NER Model)


### Why microservices?
- ML model isolated from business logic
- Independent scaling
- Production-style deployment
- Real-world system design

---

## Machine Learning

- Custom-trained Transformer-based NER model
- SentencePiece tokenizer
- Supports Indian languages
- HuggingFace-compatible deployment
- Served via FastAPI inference service

NER is used for:
- moderation
- sensitive entity detection
- trending topics

---

## Tech Stack

### Backend
- FastAPI
- MongoDB Atlas
- JWT Authentication
- Motor (async MongoDB)
- REST APIs

### ML Service
- PyTorch
- Transformers
- FastAPI
- SentencePiece
- Custom inference pipeline

---

## 📂 Project Structure

pulse-social-platform/
├── backend/
├── ml-service/
├── frontend/ (planned)
└── README.md


---

## Setup (Development)

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### ML Service
```bash
cd ml-service
pip install -r requirements.txt
uvicorn app.main:app --port 9001 --reload
```

### Model Files

Due to GitHub size limits, trained NER model files are not included.

Download separately and place in:

ml-service/models/ner_model/

## Future Enhancements
- Frontend (React / Next.js)
- User search
- Admin moderation dashboard
- Reporting & strike system
- Recommendation engine
- WebSocket live feed
- Analytics

## Author

Rakshit Kumar