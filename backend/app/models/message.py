from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MessageCreate(BaseModel):
    """Payload sent by the client when sending a DM."""
    recipient_id: str
    ciphertext: str          # Base64-encoded AES-GCM ciphertext
    iv: str                  # Base64-encoded AES-GCM initialisation vector
    ephemeral_key: str = ""  # Optional: sender's ephemeral public key (ECDH)
    sender_public_key: str = ""  # Sender's public key at time of encryption
    recipient_public_key: str = ""  # Recipient's public key at time of encryption
    reply_to: Optional[str] = None  # message_id being replied to
    gif_url: Optional[str] = None   # Tenor GIF URL (not encrypted)


class ReactionPayload(BaseModel):
    """Payload for adding/removing a reaction to a message."""
    emoji: str               # The emoji used for the reaction


class MessageInDB(BaseModel):
    """Shape of a message document stored in MongoDB."""
    conversation_id: str
    sender_id: str
    sender_username: str
    ciphertext: str
    iv: str
    ephemeral_key: str = ""
    created_at: datetime


class ConversationInDB(BaseModel):
    """Shape of a conversation document stored in MongoDB."""
    participants: list       # [user_id_1, user_id_2]  — sorted
    last_message_text: str = ""   # ciphertext preview (still encrypted)
    last_message_at: Optional[datetime] = None
    created_at: datetime


class KeyBackupPayload(BaseModel):
    """Client stores encrypted E2EE key backup. Server cannot decrypt this."""
    encrypted_backup: str    # Base64 AES-GCM encrypted key pair
    backup_iv: str           # Base64 initialisation vector


class PublicKeyPayload(BaseModel):
    """Client registers / updates its ECDH public key."""
    public_key: str          # JWK-serialised ECDH public key


class PushTokenPayload(BaseModel):
    """Client registers its Expo push token for notifications."""
    push_token: str          # e.g. "ExponentPushToken[xxxx]"
