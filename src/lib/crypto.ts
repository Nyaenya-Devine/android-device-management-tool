import crypto from "crypto";

// Secret for local encryption of sensitive credentials in database
const ENCRYPTION_KEY = process.env.CREDENTIALS_SECRET || "android-mgmt-enterprise-aes-secret-key-32b!"; // 32 chars
const IV_LENGTH = 16;

/**
 * Encrypt a plaintext string using AES-256-CBC
 */
export function encryptText(text: string): string {
  try {
    const key = crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return `${iv.toString("hex")}:${encrypted}`;
  } catch (err) {
    console.error("Encryption failed:", err);
    return text;
  }
}

/**
 * Decrypt an AES-256-CBC encrypted string
 */
export function decryptText(encryptedText: string): string {
  try {
    if (!encryptedText || !encryptedText.includes(":")) {
      return encryptedText;
    }
    const [ivHex, encryptedData] = encryptedText.split(":");
    const key = crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err);
    return encryptedText;
  }
}

/**
 * Generate a random Android Management API style enrollment token
 */
export function generateEnrollmentTokenString(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "AMAPI-";
  for (let i = 0; i < 20; i++) {
    if (i > 0 && i % 5 === 0) token += "-";
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Create an RSA-SHA256 signed JWT for Google OAuth2 Service Account
 */
export function createGoogleServiceAccountJwt(
  clientEmail: string,
  privateKey: string,
  scopes: string[] = ["https://www.googleapis.com/auth/androidmanagement"]
): string {
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
