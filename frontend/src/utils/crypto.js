/**
 * E2E Encryption Utilities for Pulse DMs  —  v2
 * ================================================
 * Uses the browser‑native Web Crypto API (SubtleCrypto).
 *
 * v2 improvements:
 *  • Password-derived backup key — private key is encrypted and stored
 *    on the server so it survives browser data clears / device switches.
 *  • The server never sees the plaintext private key (encrypted with a
 *    key derived from the user's password via PBKDF2).
 *  • ensureKeys() tries: IndexedDB → server backup → generate new.
 *  • Both sender_public_key AND recipient_public_key are stored per
 *    message so decryption always has the correct keys.
 *
 * Flow:
 *  1. At login, derive a backupKey from the password via PBKDF2.
 *  2. ensureKeys() loads or restores the ECDH key‑pair.
 *  3. Encrypt/decrypt use ECDH P‑256 + AES‑GCM‑256 (unchanged).
 *  4. Mobile interop via XOR cipher (unchanged).
 *
 * Private keys never leave the browser in plaintext.
 */

import API from "../api/api";

const DB_NAME = "pulse_e2ee";
const STORE_NAME = "keys";
const KEY_ID = "identity";

// ─── Mobile key detection ──────────────────────────────────────────────────

function isMobileKey(jwk) {
  if (!jwk) return false;
  const obj = typeof jwk === "string" ? JSON.parse(jwk) : jwk;
  return obj.alg === "PULSE-MOBILE" || (obj.kty === "oct" && !!obj.k);
}

// ─── XOR cipher (matches mobile/src/utils/crypto.js exactly) ───────────────

function deriveKeyBytes(myHex, theirHex) {
  const sorted = [myHex, theirHex].sort().join(":");
  const key = new Uint8Array(32);
  for (let i = 0; i < sorted.length && i < 32; i++) {
    key[i % 32] ^= sorted.charCodeAt(i);
  }
  return key;
}

function xorEncrypt(plainBytes, keyBytes) {
  const out = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i++) {
    out[i] = plainBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return out;
}

// ─── IndexedDB helpers ─────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Base64 / Hex helpers ──────────────────────────────────────────────────

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToBuf(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes.buffer;
}

// ═══════════════════════════════════════════════════════════════════════════
//  PASSWORD‑DERIVED BACKUP KEY  (PBKDF2)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Derive a 256‑bit AES‑GCM key from the user's password.
 * Returns the key as a hex string (for storing in localStorage).
 * This key is used to encrypt/decrypt the E2EE private key backup.
 */
export async function deriveBackupKey(password, userId) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const salt = enc.encode("pulse-e2ee-backup-v1:" + userId);
  const aesKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, // extractable → so we can export to hex
    ["encrypt", "decrypt"]
  );
  const raw = await crypto.subtle.exportKey("raw", aesKey);
  return bufToHex(raw);
}

/** Import a backup key from its hex representation. */
async function importBackupKey(hex) {
  return crypto.subtle.importKey(
    "raw",
    hexToBuf(hex),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  KEY BACKUP  &  RESTORE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Encrypt the local key‑pair and upload it to the server.
 * The server stores opaque ciphertext it cannot decrypt.
 */
export async function backupKeys(backupKeyHex, token) {
  const stored = await loadKeyPair();
  if (!stored) return;

  const aesKey = await importBackupKey(backupKeyHex);
  const plaintext = new TextEncoder().encode(JSON.stringify(stored));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    plaintext
  );

  await fetch(`${API}/messages/key-backup`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      encrypted_backup: bufToBase64(cipherBuf),
      backup_iv: bufToBase64(iv),
    }),
  });
}

/**
 * Download the encrypted backup from the server and restore to IndexedDB.
 * Returns true on success, false if no backup or decryption failed.
 */
export async function restoreKeys(backupKeyHex, token) {
  try {
    const res = await fetch(`${API}/messages/key-backup`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;

    const { encrypted_backup, backup_iv } = await res.json();
    if (!encrypted_backup || !backup_iv) return false;

    const aesKey = await importBackupKey(backupKeyHex);
    const cipherBuf = base64ToBuf(encrypted_backup);
    const iv = base64ToBuf(backup_iv);

    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      cipherBuf
    );
    const keyPair = JSON.parse(new TextDecoder().decode(plainBuf));
    await idbSet(KEY_ID, keyPair);
    console.log("[E2EE] Keys restored from server backup");
    return true;
  } catch (err) {
    console.warn("[E2EE] Key restore failed:", err);
    return false;
  }
}

/**
 * Ensure the user has a valid ECDH key‑pair.
 * Priority: IndexedDB → server backup → generate new.
 * Also registers the public key with the server and backs up if needed.
 */
export async function ensureKeys(token, backupKeyHex) {
  // 1. Try IndexedDB first
  let stored = await loadKeyPair();

  if (!stored && backupKeyHex) {
    // 2. Try server backup
    const restored = await restoreKeys(backupKeyHex, token);
    if (restored) stored = await loadKeyPair();
  }

  if (!stored) {
    // 3. Generate new key pair as last resort
    await generateKeyPair();
    stored = await loadKeyPair();
  }

  // Register public key on server
  const pubKey = JSON.stringify(stored.publicJwk);
  await fetch(`${API}/messages/keys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ public_key: pubKey }),
  });

  // Back up keys if we have a backup key
  if (backupKeyHex) {
    try {
      await backupKeys(backupKeyHex, token);
    } catch (err) {
      console.warn("[E2EE] Key backup failed:", err);
    }
  }

  return pubKey;
}

// ═══════════════════════════════════════════════════════════════════════════
//  KEY‑PAIR GENERATION  &  STORAGE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a new ECDH P‑256 key‑pair and persist it in IndexedDB.
 * Returns the public key as a JWK string (to upload to the server).
 */
export async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );

  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  await idbSet(KEY_ID, { publicJwk, privateJwk });

  return JSON.stringify(publicJwk);
}

/**
 * Load the local key‑pair from IndexedDB.
 * Returns { publicJwk, privateJwk } or null.
 */
export async function loadKeyPair() {
  try {
    return await idbGet(KEY_ID);
  } catch {
    return null;
  }
}

/**
 * Get the local public key as a JWK string.
 * Generates a new pair if none exists (legacy path — prefer ensureKeys).
 */
export async function getPublicKeyJwk() {
  let stored = await loadKeyPair();
  if (!stored) {
    await generateKeyPair();
    stored = await loadKeyPair();
  }
  return JSON.stringify(stored.publicJwk);
}

// ═══════════════════════════════════════════════════════════════════════════
//  ECDH SHARED KEY DERIVATION
// ═══════════════════════════════════════════════════════════════════════════

async function deriveSharedKey(privateJwk, publicJwkObj) {
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"]
  );

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    publicJwkObj,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  ENCRYPT  /  DECRYPT
// ═══════════════════════════════════════════════════════════════════════════

export async function encryptMessage(plaintext, recipientPublicJwkStr) {
  const stored = await loadKeyPair();
  if (!stored) throw new Error("No local key-pair — call ensureKeys first");

  const recipientPublicJwk =
    typeof recipientPublicJwkStr === "string"
      ? JSON.parse(recipientPublicJwkStr)
      : recipientPublicJwkStr;

  // ── Mobile recipient → XOR cipher for interop ──
  if (isMobileKey(recipientPublicJwk)) {
    const myIdentity = stored.publicJwk.k || stored.publicJwk.x || "";
    const theirHex = recipientPublicJwk.k || "";
    const keyBytes = deriveKeyBytes(myIdentity, theirHex);
    const plainBytes = new TextEncoder().encode(plaintext);
    const ivBytes = crypto.getRandomValues(new Uint8Array(12));
    const cipherBytes = xorEncrypt(plainBytes, keyBytes);
    return {
      ciphertext: bufToBase64(cipherBytes),
      iv: bufToBase64(ivBytes),
    };
  }

  // ── Web recipient → ECDH + AES‑GCM ──
  const aesKey = await deriveSharedKey(stored.privateJwk, recipientPublicJwk);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoded
  );

  return {
    ciphertext: bufToBase64(cipherBuf),
    iv: bufToBase64(iv),
  };
}

export async function decryptMessage(ciphertextB64, ivB64, senderPublicJwkStr) {
  const stored = await loadKeyPair();
  if (!stored) throw new Error("No local key-pair");

  const senderPublicJwk =
    typeof senderPublicJwkStr === "string"
      ? JSON.parse(senderPublicJwkStr)
      : senderPublicJwkStr;

  // ── Mobile sender → XOR cipher for interop ──
  if (isMobileKey(senderPublicJwk)) {
    const myIdentity = stored.publicJwk.k || stored.publicJwk.x || "";
    const theirHex = senderPublicJwk.k || "";
    const keyBytes = deriveKeyBytes(myIdentity, theirHex);
    const cipherBytes = new Uint8Array(base64ToBuf(ciphertextB64));
    const plainBytes = xorEncrypt(cipherBytes, keyBytes);
    return new TextDecoder().decode(plainBytes);
  }

  // ── Web sender → ECDH + AES‑GCM ──
  const aesKey = await deriveSharedKey(stored.privateJwk, senderPublicJwk);
  const cipherBuf = base64ToBuf(ciphertextB64);
  const iv = base64ToBuf(ivB64);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    cipherBuf
  );

  return new TextDecoder().decode(plainBuf);
}
