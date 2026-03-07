"""
Direct‑Message routes  –  end‑to‑end encrypted
================================================
The server never sees plain‑text.  It stores:
  • ciphertext (Base64 AES‑GCM)
  • iv         (Base64 nonce)
  • ephemeral_key (optional, for future ECDH ratchet)

Key exchange happens client‑side via ECDH (P‑256).
Each user uploads their public key; the server just stores and serves it.
"""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect

from app.auth.dependency import get_current_user
from app.models.message import MessageCreate, PublicKeyPayload, PushTokenPayload
from app.services.database import db

router = APIRouter(prefix="/messages", tags=["Messages"])


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# HELPERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _conv_key(uid1: str, uid2: str) -> list:
    """Canonical participant pair – always sorted so look‑ups are deterministic."""
    return sorted([uid1, uid2])


def _serialize_doc(doc: dict) -> dict:
    """Convert MongoDB doc → JSON‑safe dict."""
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    return doc


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PUBLIC KEY MANAGEMENT  (for ECDH key exchange)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/keys")
async def upload_public_key(
    payload: PublicKeyPayload,
    user=Depends(get_current_user),
):
    """Store / update the caller's ECDH public key."""
    await db.user_keys.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "user_id": user["user_id"],
            "public_key": payload.public_key,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"message": "Public key stored"}


@router.get("/keys/{user_id}")
async def get_public_key(user_id: str, user=Depends(get_current_user)):
    """Fetch another user's ECDH public key for client‑side key derivation."""
    doc = await db.user_keys.find_one({"user_id": user_id})
    if not doc:
        raise HTTPException(404, "User has no public key registered")
    return {"user_id": user_id, "public_key": doc["public_key"]}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PUSH TOKEN MANAGEMENT  (Expo Push Notifications)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/push-token")
async def register_push_token(
    payload: PushTokenPayload,
    user=Depends(get_current_user),
):
    """Store / update the caller's Expo push token."""
    await db.push_tokens.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "user_id": user["user_id"],
            "push_token": payload.push_token,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"message": "Push token stored"}


async def _send_push_notification(recipient_id: str, sender_username: str):
    """Send an Expo push notification to the recipient if they have a token."""
    import json
    import urllib.request
    import asyncio

    doc = await db.push_tokens.find_one({"user_id": recipient_id})
    if not doc or not doc.get("push_token"):
        return

    push_token = doc["push_token"]
    message = {
        "to": push_token,
        "title": f"New message from @{sender_username}",
        "body": "You have a new encrypted message",
        "sound": "default",
        "priority": "high",
        "data": {"type": "new_message", "sender": sender_username},
        "channelId": "messages",
    }

    def _do_send():
        try:
            body = json.dumps(message).encode("utf-8")
            req = urllib.request.Request(
                "https://exp.host/--/api/v2/push/send",
                data=body,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5) as res:
                res.read()
        except Exception:
            pass  # Push failure shouldn't break messaging

    # Run blocking HTTP in thread pool so we don't block the event loop
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _do_send)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  CONVERSATIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/conversations")
async def list_conversations(user=Depends(get_current_user)):
    """Return all conversations the caller is part of, newest first."""
    uid = user["user_id"]
    cursor = db.conversations.find(
        {"participants": uid}
    ).sort("last_message_at", -1)

    convos = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])

        # Resolve the *other* participant's profile
        other_id = [p for p in doc["participants"] if p != uid]
        other_id = other_id[0] if other_id else uid  # self‑chat fallback

        other_user = await db.users.find_one({"_id": ObjectId(other_id)})
        doc["other_user"] = {
            "user_id": other_id,
            "username": other_user["username"] if other_user else "unknown",
            "profile_pic_url": other_user.get("profile_pic_url") if other_user else None,
        }

        # Unread count
        unread = await db.messages.count_documents({
            "conversation_id": doc["_id"],
            "sender_id": {"$ne": uid},
            "read": False,
        })
        doc["unread_count"] = unread

        convos.append(doc)

    return convos


@router.post("/conversations/{other_user_id}")
async def get_or_create_conversation(other_user_id: str, user=Depends(get_current_user)):
    """Get existing conversation with a user, or create a new one."""
    uid = user["user_id"]

    if uid == other_user_id:
        raise HTTPException(400, "Cannot message yourself")

    if not ObjectId.is_valid(other_user_id):
        raise HTTPException(400, "Invalid user ID")

    # Check that the other user exists
    other = await db.users.find_one({"_id": ObjectId(other_user_id)})
    if not other:
        raise HTTPException(404, "User not found")

    participants = _conv_key(uid, other_user_id)

    # Find existing
    conv = await db.conversations.find_one({"participants": participants})
    if conv:
        conv["_id"] = str(conv["_id"])
        conv["other_user"] = {
            "user_id": other_user_id,
            "username": other["username"],
            "profile_pic_url": other.get("profile_pic_url"),
        }
        return conv

    # Create new
    new_conv = {
        "participants": participants,
        "last_message_text": "",
        "last_message_at": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.conversations.insert_one(new_conv)
    new_conv["_id"] = str(result.inserted_id)
    new_conv["other_user"] = {
        "user_id": other_user_id,
        "username": other["username"],
        "profile_pic_url": other.get("profile_pic_url"),
    }
    return new_conv


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MESSAGES (encrypted)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    limit: int = 50,
    before: Optional[str] = None,
    user=Depends(get_current_user),
):
    """Fetch messages in a conversation (newest first). Supports cursor pagination."""
    uid = user["user_id"]

    if not ObjectId.is_valid(conversation_id):
        raise HTTPException(400, "Invalid conversation ID")

    # Verify caller is participant
    conv = await db.conversations.find_one({"_id": ObjectId(conversation_id)})
    if not conv or uid not in conv["participants"]:
        raise HTTPException(403, "Not a participant")

    query = {"conversation_id": conversation_id}
    if before and ObjectId.is_valid(before):
        query["_id"] = {"$lt": ObjectId(before)}

    cursor = db.messages.find(query).sort("_id", -1).limit(limit)
    msgs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        msgs.append(doc)

    # Mark messages from the other person as read
    await db.messages.update_many(
        {
            "conversation_id": conversation_id,
            "sender_id": {"$ne": uid},
            "read": False,
        },
        {"$set": {"read": True}},
    )

    return msgs


@router.post("/send")
async def send_message(
    payload: MessageCreate,
    user=Depends(get_current_user),
):
    """Send an encrypted message. Creates conversation if none exists."""
    uid = user["user_id"]
    recipient_id = payload.recipient_id

    if uid == recipient_id:
        raise HTTPException(400, "Cannot message yourself")
    if not ObjectId.is_valid(recipient_id):
        raise HTTPException(400, "Invalid recipient ID")

    # Ensure recipient exists
    recipient = await db.users.find_one({"_id": ObjectId(recipient_id)})
    if not recipient:
        raise HTTPException(404, "Recipient not found")

    participants = _conv_key(uid, recipient_id)

    # Get or create conversation
    conv = await db.conversations.find_one({"participants": participants})
    if not conv:
        conv_doc = {
            "participants": participants,
            "last_message_text": payload.ciphertext[:80],
            "last_message_at": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.conversations.insert_one(conv_doc)
        conv_id = str(result.inserted_id)
    else:
        conv_id = str(conv["_id"])

    # Store message
    msg = {
        "conversation_id": conv_id,
        "sender_id": uid,
        "sender_username": user["username"],
        "ciphertext": payload.ciphertext,
        "iv": payload.iv,
        "ephemeral_key": payload.ephemeral_key,
        "sender_public_key": payload.sender_public_key,
        "read": False,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.messages.insert_one(msg)
    msg["_id"] = str(result.inserted_id)

    # Update conversation's last‑message
    await db.conversations.update_one(
        {"_id": ObjectId(conv_id)},
        {"$set": {
            "last_message_text": payload.ciphertext[:80],
            "last_message_at": msg["created_at"],
        }},
    )

    # Push to WebSocket if recipient is connected
    ws = _active_connections.get(recipient_id)
    if ws:
        try:
            await ws.send_json({
                "type": "new_message",
                "conversation_id": conv_id,
                "message": msg,
            })
        except Exception:
            _active_connections.pop(recipient_id, None)

    # Send push notification (non-blocking, fire-and-forget)
    try:
        await _send_push_notification(recipient_id, user["username"])
    except Exception:
        pass

    return msg


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  UNREAD COUNT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/unread-count")
async def unread_count(user=Depends(get_current_user)):
    """Total unread messages across all conversations."""
    uid = user["user_id"]

    # Find all conversation IDs the user is in
    conv_ids = []
    async for conv in db.conversations.find({"participants": uid}, {"_id": 1}):
        conv_ids.append(str(conv["_id"]))

    if not conv_ids:
        return {"unread": 0}

    count = await db.messages.count_documents({
        "conversation_id": {"$in": conv_ids},
        "sender_id": {"$ne": uid},
        "read": False,
    })
    return {"unread": count}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  WEBSOCKET  – real‑time push (lightweight, no external broker)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

_active_connections: dict[str, WebSocket] = {}   # user_id → WebSocket


@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """
    Lightweight WS connection authenticated via JWT passed in the URL path.
    The server pushes new‑message events; the client can also send JSON
    pings to keep the connection alive.
    """
    from app.auth.jwt import decode_token          # local import to avoid cycles

    try:
        payload = decode_token(token)
    except Exception:
        await websocket.close(code=4001)
        return

    uid = payload.get("user_id")
    if not uid:
        await websocket.close(code=4001)
        return

    await websocket.accept()
    _active_connections[uid] = websocket

    try:
        while True:
            # Keep alive – client should send pings periodically
            data = await websocket.receive_text()
            # Echo a pong so the client knows the connection is alive
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        _active_connections.pop(uid, None)
    except Exception:
        _active_connections.pop(uid, None)
