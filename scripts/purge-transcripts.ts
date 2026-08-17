import fs from "fs";
import path from "path";

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
    console.error("DATABASE_URL_MIGRATIONS is not set");
    process.exit(1);
  }

  const retentionDays = Number.parseInt(
    process.env.TRANSCRIPT_RETENTION_DAYS ?? "180",
    10,
  );
  if (retentionDays === 0) {
    console.log("TRANSCRIPT_RETENTION_DAYS=0 — skipping purge");
    return;
  }

  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const deleted = await client.query(
      `DELETE FROM session_transcripts WHERE purge_after <= NOW()`,
    );
    console.log(`Purged ${deleted.rowCount ?? 0} expired transcript(s).`);
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
