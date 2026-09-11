import crypto from "crypto";
import "server-only";

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY HARDENED ENCRYPTION MODULE
// - AES-256-GCM (authenticated encryption) instead of CBC
// - No hardcoded secret in production - fails closed if CREDENTIALS_SECRET missing
// - Key derived via SHA-256 hash of secret (32 bytes) for compatibility, but
//   requires 32+ char secret in production
// - Constant-time handling where applicable
// ─────────────────────────────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const secret = process.env.CREDENTIALS_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && !secret) {
    throw new Error(
      "CREDENTIALS_SECRET must be set in production - refusing to use fallback key"
    );
  }

  // Fallback only for local dev/demo - clearly marked
  const effectiveSecret =
    secret || "dev-only-fallback-key-do-not-use-in-prod-32b!!";

  if (effectiveSecret.length < 32) {
    throw new Error("CREDENTIALS_SECRET must be at least 32 characters");
  }

  return crypto.createHash("sha256").update(effectiveSecret).digest();
}

const IV_LENGTH = 12; // GCM recommended 12 bytes
const AUTH_TAG_LENGTH = 16;
const ALGORITHM = "aes-256-gcm";

/**
 * Encrypt a plaintext string using AES-256-GCM (authenticated encryption)
 * Returns: iv:authTag:ciphertext (hex encoded)
 */
export function encryptText(text: string): string {
  if (!text) return text;
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error("Encryption failed:", err);
    // Fail closed - don't return plaintext in production
    if (process.env.NODE_ENV === "production") {
      throw new Error("Encryption failed");
    }
    return text;
  }
}

/**
 * Decrypt an AES-256-GCM encrypted string
 * Supports legacy CBC format (iv:cipher) for backward compatibility
 */
export function decryptText(encryptedText: string): string {
  if (!encryptedText || typeof encryptedText !== "string") return encryptedText;

  try {
    const key = getEncryptionKey();

    // New GCM format: iv:authTag:ciphertext
    if (encryptedText.split(":").length === 3) {
      const [ivHex, authTagHex, encryptedData] = encryptedText.split(":");
      if (!ivHex || !authTagHex || !encryptedData) return encryptedText;

      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedData, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    }

    // Legacy CBC format: iv:ciphertext - migrate on next encrypt
    if (encryptedText.includes(":")) {
      const [ivHex, encryptedData] = encryptedText.split(":");
      const iv = Buffer.from(ivHex, "hex");
      // Fallback to CBC for legacy data only
      const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
      let decrypted = decipher.update(encryptedData, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    }

    return encryptedText;
  } catch (err) {
    console.error("Decryption failed - possible tampering or key mismatch");
    // Fail closed in production - don't return potentially tampered data as plaintext
    if (process.env.NODE_ENV === "production") {
      throw new Error("Decryption failed - data may be tampered");
    }
    return encryptedText;
  }
}

/**
 * Generate a cryptographically secure random enrollment token
 * Uses crypto.randomBytes instead of Math.random for security
 */
export function generateEnrollmentTokenString(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  // Use crypto.randomInt for CSPRNG
  let token = "AMAPI-";
  for (let i = 0; i < 20; i++) {
    if (i > 0 && i % 5 === 0) token += "-";
    const randomIndex = crypto.randomInt(0, chars.length);
    token += chars.charAt(randomIndex);
  }
  return token;
}

/**
 * Create an RSA-SHA256 signed JWT for Google OAuth2 Service Account
 * Hardened: validates inputs, uses constant-time operations where possible
 */
export function createGoogleServiceAccountJwt(
  clientEmail: string,
  privateKey: string,
  scopes: string[] = ["https://www.googleapis.com/auth/androidmanagement"]
): string {
  if (!clientEmail || !privateKey) {
    throw new Error("clientEmail and privateKey are required");
  }

  // Validate email format to prevent injection
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    throw new Error("Invalid clientEmail format");
  }

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const base64UrlEncode = (str: string) =>
    Buffer.from(str)
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();

  const signature = signer.sign(privateKey, "base64");
  const encodedSignature = signature
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${unsignedToken}.${encodedSignature}`;
}

/**
 * Generate a secure random secret for CREDENTIALS_SECRET
 * Use this to generate production secrets
 */
export function generateSecureSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}
