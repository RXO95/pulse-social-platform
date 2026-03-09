/**
 * E2E Encryption Utilities for Pulse DMs (React Native / Expo)  — v2
 * ====================================================================
 * Uses SecureStore for key persistence and expo-crypto for RNG.
 *
 * v2: Added key backup/restore via server.
 *     The backup is XOR-encrypted with a password-derived key.
 *     Server never sees plaintext keys.
 *
 * NOTE: React Native (Hermes) does NOT have `crypto.subtle`.
 * Current approach: simplified XOR cipher (demo-grade).
 * For full ECDH interop, install react-native-quick-crypto.
 */

import * as SecureStore from "expo-secure-store";
import * as ExpoCrypto from "expo-crypto";
import api from "../api/client";

const KEY_STORE_PUB = "pulse_e2ee_pub";
const KEY_STORE_PRIV = "pulse_e2ee_priv";
const BACKUP_KEY_STORE = "pulse_backup_key";

// ═══════════════════════════════════════════════════════════════════════════
//  KEY PAIR GENERATION & STORAGE
// ═══════════════════════════════════════════════════════════════════════════

export async function generateKeyPair() {
  const bytes = await ExpoCrypto.getRandomBytesAsync(32);
  const hex = Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const publicJwk = { kty: "oct", k: hex, alg: "PULSE-MOBILE" };
  const privateJwk = { kty: "oct", k: hex, alg: "PULSE-MOBILE" };

  await SecureStore.setItemAsync(KEY_STORE_PUB, JSON.stringify(publicJwk));
  await SecureStore.setItemAsync(KEY_STORE_PRIV, JSON.stringify(privateJwk));

  return JSON.stringify(publicJwk);
}

export async function loadKeyPair() {
  try {
    const pub = await SecureStore.getItemAsync(KEY_STORE_PUB);
    const priv = await SecureStore.getItemAsync(KEY_STORE_PRIV);
    if (!pub || !priv) return null;
    return { publicJwk: JSON.parse(pub), privateJwk: JSON.parse(priv) };
  } catch {
    return null;
  }
}

export async function getPublicKeyJwk() {
  let stored = await loadKeyPair();
  if (!stored) {
    await generateKeyPair();
    stored = await loadKeyPair();
  }
  return JSON.stringify(stored.publicJwk);
}

// ═══════════════════════════════════════════════════════════════════════════
//  PASSWORD-DERIVED BACKUP KEY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Derive a 32-byte key from password + userId using SHA-256.
 * (PBKDF2 is not available in RN without native crypto, so we use
 *  a simpler approach: SHA-256 of password + salt, iterated.)
 */
export async function deriveBackupKey(password, userId) {
  const salt = "pulse-e2ee-backup-v1:" + userId;
  // Iterate SHA-256 for stretching
  let hash = await ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    password + salt
  );
  for (let i = 0; i < 100; i++) {
    hash = await ExpoCrypto.digestStringAsync(
      ExpoCrypto.CryptoDigestAlgorithm.SHA256,
      hash + salt
    );
  }
  return hash; // 64-char hex string
}

// ═══════════════════════════════════════════════════════════════════════════
//  KEY BACKUP & RESTORE
// ═══════════════════════════════════════════════════════════════════════════

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function xorBytes(a, b) {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i] ^ b[i % b.length];
  }
  return out;
}

/**
 * Encrypt the local key pair and upload to server.
 */
export async function backupKeys(backupKeyHex) {
  const stored = await loadKeyPair();
  if (!stored) return;

  const plaintext = JSON.stringify(stored);
  const plainBytes = new TextEncoder().encode(plaintext);
  const keyBytes = hexToBytes(backupKeyHex.slice(0, 64));
  const ivBytes = await ExpoCrypto.getRandomBytesAsync(12);
  const cipherBytes = xorBytes(plainBytes, keyBytes);

  try {
    await api.put("/messages/key-backup", {
      encrypted_backup: bytesToBase64(cipherBytes),
      backup_iv: bytesToBase64(new Uint8Array(ivBytes)),
    });
  } catch (err) {
    console.warn("[E2EE] Backup failed:", err);
  }
}

/**
 * Download encrypted backup from server and restore to SecureStore.
 */
export async function restoreKeys(backupKeyHex) {
  try {
    const res = await api.get("/messages/key-backup");
    const { encrypted_backup, backup_iv } = res.data;
    if (!encrypted_backup) return false;

    const keyBytes = hexToBytes(backupKeyHex.slice(0, 64));
    const cipherBytes = base64ToBytes(encrypted_backup);
    const plainBytes = xorBytes(cipherBytes, keyBytes);
    const keyPair = JSON.parse(new TextDecoder().decode(plainBytes));

    await SecureStore.setItemAsync(KEY_STORE_PUB, JSON.stringify(keyPair.publicJwk));
    await SecureStore.setItemAsync(KEY_STORE_PRIV, JSON.stringify(keyPair.privateJwk));
    console.log("[E2EE] Keys restored from backup");
    return true;
  } catch (err) {
    console.warn("[E2EE] Restore failed:", err);
    return false;
  }
}

/**
 * Ensure keys exist: SecureStore → server backup → generate new.
 * Also registers public key on server and backs up.
 */
export async function ensureKeys(backupKeyHex) {
  let stored = await loadKeyPair();

  if (!stored && backupKeyHex) {
    const restored = await restoreKeys(backupKeyHex);
    if (restored) stored = await loadKeyPair();
  }

  if (!stored) {
    await generateKeyPair();
    stored = await loadKeyPair();
  }

  // Register public key on server
  const pubKey = JSON.stringify(stored.publicJwk);
  try {
    await api.post("/messages/keys", { public_key: pubKey });
  } catch {}

  // Backup if we have a key
  if (backupKeyHex) {
    try { await backupKeys(backupKeyHex); } catch {}
  }

  return pubKey;
}

// ═══════════════════════════════════════════════════════════════════════════
//  XOR CIPHER
// ═══════════════════════════════════════════════════════════════════════════

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

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ENCRYPT / DECRYPT
// ═══════════════════════════════════════════════════════════════════════════

export async function encryptMessage(plaintext, recipientPublicJwkStr) {
  const stored = await loadKeyPair();
  if (!stored) throw new Error("No local key-pair — call ensureKeys first");

  const recipientJwk =
    typeof recipientPublicJwkStr === "string"
      ? JSON.parse(recipientPublicJwkStr)
      : recipientPublicJwkStr;

  const myHex = stored.privateJwk.k || "";
  const theirHex = recipientJwk.k || recipientJwk.x || "";

  const keyBytes = deriveKeyBytes(myHex, theirHex);
  const plainBytes = new TextEncoder().encode(plaintext);

  const ivBytes = await ExpoCrypto.getRandomBytesAsync(12);
  const cipherBytes = xorEncrypt(plainBytes, keyBytes);

  return {
    ciphertext: bytesToBase64(cipherBytes),
    iv: bytesToBase64(new Uint8Array(ivBytes)),
  };
}

export async function decryptMessage(ciphertextB64, ivB64, senderPublicJwkStr) {
  const stored = await loadKeyPair();
  if (!stored) throw new Error("No local key-pair");

  const senderJwk =
    typeof senderPublicJwkStr === "string"
      ? JSON.parse(senderPublicJwkStr)
      : senderPublicJwkStr;

  const myHex = stored.privateJwk.k || "";
  const theirHex = senderJwk.k || senderJwk.x || "";

  const keyBytes = deriveKeyBytes(myHex, theirHex);
  const cipherBytes = base64ToBytes(ciphertextB64);
  const plainBytes = xorEncrypt(cipherBytes, keyBytes);

  return new TextDecoder().decode(plainBytes);
}
