from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.auth import router as auth_router
from app.routes.posts import router as posts_router
from app.routes.feed import router as feed_router
from app.routes.likes import router as likes_router
from app.routes.users import router as users_router
from app.routes.follow import router as follow_router
from app.routes.personal_feed import router as personal_feed_router
from app.routes.trending import router as trending_router
from app.routes.search import router as search_router
from app.routes.comments import router as comments_router
from app.routes.translate import router as translate_router
from app.routes.entities import router as entities_router
from app.routes.bookmarks import router as bookmarks_router
from app.routes.messages import router as messages_router
from app.routes.widgets import router as widgets_router
from app.routes.reposts import router as reposts_router
from app.routes.notifications import router as notifications_router

app = FastAPI(
    title="Pulse Backend API",
    docs_url="/docs",
    openapi_url="/openapi.json"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (can be restricted to specific domains)
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

app.include_router(auth_router)
app.include_router(posts_router)
app.include_router(feed_router)
app.include_router(likes_router)
app.include_router(users_router)
app.include_router(follow_router)
app.include_router(personal_feed_router)
app.include_router(trending_router)
app.include_router(search_router)
app.include_router(comments_router)
app.include_router(translate_router)
app.include_router(entities_router)
app.include_router(bookmarks_router)
app.include_router(messages_router)
app.include_router(widgets_router)
app.include_router(reposts_router)
app.include_router(notifications_router)

@app.get("/")
def root():
    return {"status": "Pulse backend running"}
