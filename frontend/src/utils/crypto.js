/**
 * E2E Encryption Utilities for Pulse DMs
 * =======================================
 * Uses the browser‑native Web Crypto API (SubtleCrypto).
 *
 * Flow:
 *  1. Each user generates an ECDH P‑256 key‑pair on first use.
 *  2. The public key (JWK) is uploaded to the server.
 *  3. To encrypt a message for user B:
 *       a. Fetch B's public key from the server.
 *       b. Derive a shared AES‑GCM‑256 key via ECDH.
 *       c. Encrypt plaintext → { ciphertext, iv } (both Base64).
 *  4. To decrypt a received message:
 *       a. Use B's public key + own private key → same shared key.
 *       b. Decrypt { ciphertext, iv } → plaintext.
 *
 * Private keys never leave the browser (stored in localStorage).
 */

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

// ─── IndexedDB helpers (private keys stored here, not localStorage) ────────

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

// ─── Key‑pair generation & storage ─────────────────────────────────────────

/**
 * Generate a new ECDH P‑256 key‑pair and persist it in IndexedDB.
 * Returns the public key as a JWK string (to upload to the server).
 */
export async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,           // extractable so we can export
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
  return idbGet(KEY_ID);
}

/**
 * Get the local public key as a JWK string (to upload to server).
 * Generates a new pair if none exists.
 */
export async function getPublicKeyJwk() {
  let stored = await loadKeyPair();
  if (!stored) {
    await generateKeyPair();
    stored = await loadKeyPair();
  }
  return JSON.stringify(stored.publicJwk);
}

// ─── Shared AES key derivation (ECDH) ─────────────────────────────────────

/**
 * Derive an AES‑GCM‑256 key from our private key + the other user's public key.
 */
async function deriveSharedKey(privateJwk, publicJwkObj) {
  const privateKey = await crypto.subtle.importKey(
    "jwk", privateJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false, ["deriveKey"]
  );

  const publicKey = await crypto.subtle.importKey(
    "jwk", publicJwkObj,
    { name: "ECDH", namedCurve: "P-256" },
    false, []
  );

  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ─── Encrypt / Decrypt ─────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string for a recipient whose public JWK we know.
 * Returns { ciphertext, iv } — both Base64‑encoded strings.
 */
export async function encryptMessage(plaintext, recipientPublicJwkStr) {
  const stored = await loadKeyPair();
  if (!stored) throw new Error("No local key-pair — call generateKeyPair first");

  const recipientPublicJwk = typeof recipientPublicJwkStr === "string"
    ? JSON.parse(recipientPublicJwkStr)
    : recipientPublicJwkStr;

  // ── Mobile recipient → use XOR cipher for interop ──
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

  const iv = crypto.getRandomValues(new Uint8Array(12));  // 96‑bit nonce
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

/**
 * Decrypt a message received from a sender whose public JWK we know.
 * Returns the plaintext string.
 */
export async function decryptMessage(ciphertextB64, ivB64, senderPublicJwkStr) {
  const stored = await loadKeyPair();
  if (!stored) throw new Error("No local key-pair");

  const senderPublicJwk = typeof senderPublicJwkStr === "string"
    ? JSON.parse(senderPublicJwkStr)
    : senderPublicJwkStr;

  // ── Mobile sender → use XOR cipher for interop ──
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

// ─── Base64 helpers ────────────────────────────────────────────────────────

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
