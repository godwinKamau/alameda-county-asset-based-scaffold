import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export function parseEncryptionKey(hex: string | undefined): Buffer {
  if (!hex) {
    throw new Error("FIELD_ENCRYPTION_KEY is not set");
  }

  const key = Buffer.from(hex, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `FIELD_ENCRYPTION_KEY must be a ${KEY_LENGTH}-byte hex string (${KEY_LENGTH * 2} hex chars)`,
    );
  }

  return key;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
}

export function encryptWithKey(
  plaintext: string,
  key: Buffer,
): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, authTag]);

  return {
    ciphertext: combined.toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptWithKey(
  payload: EncryptedPayload,
  key: Buffer,
): string {
  const iv = Buffer.from(payload.iv, "base64");
  const combined = Buffer.from(payload.ciphertext, "base64");

  if (combined.length < AUTH_TAG_LENGTH) {
    throw new Error("Invalid ciphertext: too short");
  }

  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(0, combined.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
