import crypto from "crypto";
import "server-only";

// Credential encryption uses AES-256-GCM with authenticated ciphertext.
// Production refuses missing/weak encryption secrets and refuses unauthenticated legacy CBC data.
function getEncryptionKey(): Buffer {
  const secret = process.env.CREDENTIALS_SECRET;
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && (!secret || secret.length < 32)) throw new Error("CREDENTIALS_SECRET must be at least 32 characters in production");
  const effectiveSecret = secret || "dev-only-fallback-key-do-not-use-in-prod-32b!!";
  if (effectiveSecret.length < 32) throw new Error("CREDENTIALS_SECRET must be at least 32 characters");
  return crypto.createHash("sha256").update(effectiveSecret, "utf8").digest();
}

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ALGORITHM = "aes-256-gcm";

export function encryptText(text: string): string {
  if (!text) return text;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted}`;
}

export function decryptText(encryptedText: string): string {
  if (!encryptedText || typeof encryptedText !== "string") return encryptedText;
  const key = getEncryptionKey();
  const parts = encryptedText.split(":");

  try {
    if (parts.length === 3) {
      const [ivHex, authTagHex, encryptedData] = parts;
      if (!/^[0-9a-f]+$/i.test(ivHex) || ivHex.length !== IV_LENGTH * 2 || !/^[0-9a-f]+$/i.test(authTagHex) || authTagHex.length !== AUTH_TAG_LENGTH * 2 || !/^[0-9a-f]*$/i.test(encryptedData)) throw new Error("Invalid ciphertext format");
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedData, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    }

    // Legacy CBC ciphertext has no authentication tag and is unsafe against tampering.
    // Production deliberately rejects it; re-enter credentials so they are re-encrypted with GCM.
    if (parts.length === 2) {
      if (process.env.NODE_ENV === "production") throw new Error("Legacy unauthenticated credential ciphertext rejected in production");
      const [ivHex, encryptedData] = parts;
      if (!/^[0-9a-f]+$/i.test(ivHex) || ivHex.length !== 32 || !/^[0-9a-f]+$/i.test(encryptedData)) throw new Error("Invalid legacy ciphertext");
      const decipher = crypto.createDecipheriv("aes-256-cbc", key, Buffer.from(ivHex, "hex"));
      let decrypted = decipher.update(encryptedData, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    }

    throw new Error("Invalid encrypted credential format");
  } catch (err) {
    console.error("Credential decryption failed - possible tampering or key mismatch");
    throw new Error(process.env.NODE_ENV === "production" ? "Credential decryption failed" : "Credential decryption failed");
  }
}

export function generateEnrollmentTokenString(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "AMAPI-";
  for (let i = 0; i < 20; i++) {
    if (i > 0 && i % 5 === 0) token += "-";
    token += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return token;
}

export function createGoogleServiceAccountJwt(clientEmail: string, privateKey: string, scopes: string[] = ["https://www.googleapis.com/auth/androidmanagement"]): string {
  if (!clientEmail || !privateKey) throw new Error("clientEmail and privateKey are required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) throw new Error("Invalid clientEmail format");
  if (!Array.isArray(scopes) || scopes.length === 0 || scopes.some(s => typeof s !== "string" || s.length > 500)) throw new Error("Invalid OAuth scopes");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iss: clientEmail, scope: scopes.join(" "), aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now };
  const base64UrlEncode = (str: string) => Buffer.from(str).toString("base64url");
  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  return `${unsignedToken}.${signer.sign(privateKey, "base64url")}`;
}

export function generateSecureSecret(length: number = 32): string {
  if (!Number.isInteger(length) || length < 32 || length > 1024) throw new Error("Secret length must be between 32 and 1024 bytes");
  return crypto.randomBytes(length).toString("hex");
}
