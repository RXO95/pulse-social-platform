from fastapi import APIRouter, Depends, Query
from bson import ObjectId
from datetime import datetime

from app.services.database import db
from app.auth.dependency import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/")
async def get_notifications(
    limit: int = Query(50, ge=1, le=200),
    user=Depends(get_current_user),
):
    """
    Aggregate notifications for the current user:
    - Someone liked your post
    - Someone commented on your post
    - Someone followed you
    - Someone reposted your post (simple or quote)
    Does NOT include bookmarks (private).
    Returns newest-first, limited.
    """
    user_id = user["user_id"]
    username = user["username"]
    notifications = []

    # ── 1. Likes on my posts ──
    my_posts = await db.posts.find(
        {"user_id": user_id}, {"_id": 1, "content": 1}
    ).to_list(1000)
    post_map = {str(p["_id"]): p.get("content", "")[:80] for p in my_posts}
    post_ids = list(post_map.keys())

    if post_ids:
        likes = await db.likes.find(
            {"post_id": {"$in": post_ids}, "user_id": {"$ne": user_id}}
        ).to_list(500)

        # Batch-fetch usernames for like user_ids
        like_user_ids = list({l["user_id"] for l in likes})
        like_users = {}
        if like_user_ids:
            users_cursor = db.users.find(
                {"user_id": {"$in": like_user_ids}},
                {"user_id": 1, "username": 1, "profile_pic_url": 1},
            )
            async for u in users_cursor:
                like_users[u["user_id"]] = {
                    "username": u.get("username", "unknown"),
                    "profile_pic_url": u.get("profile_pic_url"),
                }

        for l in likes:
            actor = like_users.get(l["user_id"], {})
            notifications.append({
                "type": "like",
                "actor_username": actor.get("username", "someone"),
                "actor_pic": actor.get("profile_pic_url"),
                "post_id": l["post_id"],
                "post_preview": post_map.get(l["post_id"], ""),
                "created_at": l["_id"].generation_time.isoformat(),
                "_sort": l["_id"].generation_time,
            })

    # ── 2. Comments on my posts ──
    if post_ids:
        comments = await db.comments.find(
            {"post_id": {"$in": post_ids}, "user_id": {"$ne": user_id}}
        ).sort("created_at", -1).to_list(200)

        for c in comments:
            # Fetch commenter profile pic
            commenter = await db.users.find_one(
                {"user_id": c["user_id"]},
                {"profile_pic_url": 1},
            )
            notifications.append({
                "type": "comment",
                "actor_username": c.get("username", "someone"),
                "actor_pic": commenter.get("profile_pic_url") if commenter else None,
                "post_id": c["post_id"],
                "post_preview": post_map.get(c["post_id"], ""),
                "comment_preview": (c.get("content") or "")[:80],
                "created_at": c.get("created_at", c["_id"].generation_time).isoformat()
                    if isinstance(c.get("created_at"), datetime)
                    else c["_id"].generation_time.isoformat(),
                "_sort": c.get("created_at", c["_id"].generation_time),
            })

    # ── 3. Follows ──
    follows = await db.follows.find(
        {"following_id": user_id, "follower_id": {"$ne": user_id}}
    ).sort("created_at", -1).to_list(200)

    fol_user_ids = list({f["follower_id"] for f in follows})
    fol_users = {}
    if fol_user_ids:
        cursor = db.users.find(
            {"user_id": {"$in": fol_user_ids}},
            {"user_id": 1, "username": 1, "profile_pic_url": 1},
        )
        async for u in cursor:
            fol_users[u["user_id"]] = {
                "username": u.get("username", "unknown"),
                "profile_pic_url": u.get("profile_pic_url"),
            }

    for f in follows:
        actor = fol_users.get(f["follower_id"], {})
        ts = f.get("created_at", f["_id"].generation_time)
        notifications.append({
            "type": "follow",
            "actor_username": actor.get("username", "someone"),
            "actor_pic": actor.get("profile_pic_url"),
            "created_at": ts.isoformat() if isinstance(ts, datetime) else ts,
            "_sort": ts if isinstance(ts, datetime) else f["_id"].generation_time,
        })

    # ── 4. Reposts of my posts ──
    if post_ids:
        reposts = await db.reposts.find(
            {"original_post_id": {"$in": post_ids}, "user_id": {"$ne": user_id}}
        ).sort("created_at", -1).to_list(200)

        rep_user_ids = list({r["user_id"] for r in reposts})
        rep_users = {}
        if rep_user_ids:
            cursor = db.users.find(
                {"user_id": {"$in": rep_user_ids}},
                {"user_id": 1, "username": 1, "profile_pic_url": 1},
            )
            async for u in cursor:
                rep_users[u["user_id"]] = {
                    "username": u.get("username", "unknown"),
                    "profile_pic_url": u.get("profile_pic_url"),
                }

        for r in reposts:
            actor = rep_users.get(r["user_id"], {})
            ts = r.get("created_at", r["_id"].generation_time)
            is_quote = r.get("is_quote", False)
            notifications.append({
                "type": "quote_repost" if is_quote else "repost",
                "actor_username": actor.get("username", r.get("username", "someone")),
                "actor_pic": actor.get("profile_pic_url"),
                "post_id": r["original_post_id"],
                "post_preview": post_map.get(r["original_post_id"], ""),
                "quote_content": (r.get("quote_content") or "")[:80] if is_quote else None,
                "created_at": ts.isoformat() if isinstance(ts, datetime) else ts,
                "_sort": ts if isinstance(ts, datetime) else r["_id"].generation_time,
            })

    # ── Sort & limit ──
    notifications.sort(key=lambda n: n["_sort"], reverse=True)
    for n in notifications:
        del n["_sort"]

    return notifications[:limit]
