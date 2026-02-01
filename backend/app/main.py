from fastapi import FastAPI
from app.routes.auth import router as auth_router
from app.routes.posts import router as posts_router
from app.routes.feed import router as feed_router
from app.routes.likes import router as likes_router


app = FastAPI(title="Pulse Backend API")

app.include_router(auth_router)
app.include_router(posts_router)
app.include_router(feed_router)
app.include_router(likes_router)


@app.get("/")
def root():
    return {"status": "Pulse backend running"}
