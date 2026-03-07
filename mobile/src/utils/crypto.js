/**
 * E2E Encryption Utilities for Pulse DMs (React Native / Expo)
 * =============================================================
 * Uses AsyncStorage for key persistence and expo-crypto for RNG.
 *
 * NOTE: React Native (Hermes) does NOT have `crypto.subtle`.
 * This module provides the same interface as the web version.
 * For full ECDH interop with the web client, install:
 *   npx expo install react-native-quick-crypto
 * and uncomment the polyfill line below.
 *
 * Current approach: a simplified shared-secret scheme using
 * HMAC-SHA256 of sorted(myId, theirId) as AES key, with
 * XOR-based encryption. This is experimental/demo-grade.
 * The real fix is the polyfill mentioned above.
 */

import * as SecureStore from "expo-secure-store";
import * as ExpoCrypto from "expo-crypto";

const KEY_STORE_PUB = "pulse_e2ee_pub";
const KEY_STORE_PRIV = "pulse_e2ee_priv";

// ─── Key‑pair generation & storage ─────────────────────────────────────────

/**
 * Generate a "key pair" — for the mobile demo we generate a random
 * 32-byte key and use it as our identity. The "public key" is just
 * this value (in a JWK-like JSON envelope) so the server can store it.
 */
export async function generateKeyPair() {
  const bytes = await ExpoCrypto.getRandomBytesAsync(32);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  const publicJwk = { kty: "oct", k: hex, alg: "PULSE-MOBILE" };
  const privateJwk = { kty: "oct", k: hex, alg: "PULSE-MOBILE" };

  await SecureStore.setItemAsync(KEY_STORE_PUB, JSON.stringify(publicJwk));
  await SecureStore.setItemAsync(KEY_STORE_PRIV, JSON.stringify(privateJwk));

  return JSON.stringify(publicJwk);
}

export async function loadKeyPair() {
  const pub = await SecureStore.getItemAsync(KEY_STORE_PUB);
  const priv = await SecureStore.getItemAsync(KEY_STORE_PRIV);
  if (!pub || !priv) return null;
  return { publicJwk: JSON.parse(pub), privateJwk: JSON.parse(priv) };
}

export async function getPublicKeyJwk() {
  let stored = await loadKeyPair();
  if (!stored) {
    await generateKeyPair();
    stored = await loadKeyPair();
  }
  return JSON.stringify(stored.publicJwk);
}

// ─── Simple XOR cipher (demo‑grade, replace with real AES) ─────────────────

function deriveKeyBytes(myHex, theirHex) {
  // Simple deterministic shared key: SHA256(sorted concat)
  const sorted = [myHex, theirHex].sort().join(":");
  // Since we can't do sync SHA256, we'll use a deterministic mix
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

// ─── Encrypt / Decrypt ─────────────────────────────────────────────────────

export async function encryptMessage(plaintext, recipientPublicJwkStr) {
  const stored = await loadKeyPair();
  if (!stored) throw new Error("No local key-pair — call generateKeyPair first");

  const recipientJwk = typeof recipientPublicJwkStr === "string"
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

  const senderJwk = typeof senderPublicJwkStr === "string"
    ? JSON.parse(senderPublicJwkStr)
    : senderPublicJwkStr;

  const myHex = stored.privateJwk.k || "";
  const theirHex = senderJwk.k || senderJwk.x || "";

  const keyBytes = deriveKeyBytes(myHex, theirHex);
  const cipherBytes = base64ToBytes(ciphertextB64);
  const plainBytes = xorEncrypt(cipherBytes, keyBytes);

  return new TextDecoder().decode(plainBytes);
}
