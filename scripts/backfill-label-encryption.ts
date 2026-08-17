import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { encryptWithKey, parseEncryptionKey } from "../lib/encryption/crypto-core";

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const contents = fs.readFileSync(envPath, "utf8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

async function main() {
  const connectionString =
    process.env.DATABASE_URL_MIGRATIONS ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL_MIGRATIONS or DATABASE_URL is not set");
    process.exit(1);
  }

  const key = parseEncryptionKey(process.env.FIELD_ENCRYPTION_KEY);
  const sslEnabled = process.env.DATABASE_SSL === "true";
  const pool = new Pool({
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: true } : undefined,
  });

  const client = await pool.connect();

  try {
    const result = await client.query<{
      id: string;
      label: string | null;
    }>(
      `SELECT id, label
       FROM student_roster_entries
       WHERE label_encrypted IS NULL`,
    );

    console.log(`Found ${result.rows.length} roster rows to encrypt.`);

    for (const row of result.rows) {
      const plaintext = (row.label ?? "").trim();
      const encrypted = encryptWithKey(plaintext, key);
      await client.query(
        `UPDATE student_roster_entries
         SET label_encrypted = $2, label_iv = $3
         WHERE id = $1`,
        [row.id, encrypted.ciphertext, encrypted.iv],
      );
    }

    const after = await client.query<{ null_encrypted: number }>(
      `SELECT COUNT(*) FILTER (WHERE label_encrypted IS NULL)::int AS null_encrypted
       FROM student_roster_entries`,
    );

    if ((after.rows[0]?.null_encrypted ?? 0) > 0) {
      console.error(
        `Backfill incomplete: ${after.rows[0]?.null_encrypted} rows still missing label_encrypted.`,
      );
      process.exit(1);
    }

    console.log("Label encryption backfill complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
