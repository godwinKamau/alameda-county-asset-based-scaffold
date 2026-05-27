import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decryptWithKey,
  encryptWithKey,
  parseEncryptionKey,
} from "./crypto-core";

const TEST_KEY = parseEncryptionKey("a".repeat(64));

describe("AES-256-GCM encryption", () => {
  it("roundtrips plaintext", () => {
    const plaintext = "Student demonstrates emerging proficiency in writing.";
    const encrypted = encryptWithKey(plaintext, TEST_KEY);
    const decrypted = decryptWithKey(encrypted, TEST_KEY);
    assert.equal(decrypted, plaintext);
  });

  it("produces different ciphertext for same plaintext", () => {
    const plaintext = "Same text";
    const a = encryptWithKey(plaintext, TEST_KEY);
    const b = encryptWithKey(plaintext, TEST_KEY);
    assert.notEqual(a.ciphertext, b.ciphertext);
    assert.notEqual(a.iv, b.iv);
  });

  it("detects tampered ciphertext", () => {
    const encrypted = encryptWithKey("Sensitive insight data", TEST_KEY);
    const tampered = {
      ...encrypted,
      ciphertext: Buffer.from("tampered-data!!!").toString("base64"),
    };

    assert.throws(() => decryptWithKey(tampered, TEST_KEY));
  });

  it("rejects missing encryption key", () => {
    assert.throws(() => parseEncryptionKey(undefined), /FIELD_ENCRYPTION_KEY/);
  });

  it("rejects short encryption key", () => {
    assert.throws(() => parseEncryptionKey("abcd"), /32-byte hex/);
  });
});
