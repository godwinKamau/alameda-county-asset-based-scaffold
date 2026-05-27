import "server-only";

import {
  decryptWithKey,
  encryptWithKey,
  parseEncryptionKey,
  type EncryptedPayload,
} from "./crypto-core";

function getEncryptionKey(): Buffer {
  return parseEncryptionKey(process.env.FIELD_ENCRYPTION_KEY);
}

export type { EncryptedPayload };

export function encrypt(plaintext: string): EncryptedPayload {
  return encryptWithKey(plaintext, getEncryptionKey());
}

export function decrypt(payload: EncryptedPayload): string {
  return decryptWithKey(payload, getEncryptionKey());
}

export function validateEncryptionKey(): void {
  getEncryptionKey();
}
