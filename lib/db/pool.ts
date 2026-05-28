import "server-only";

import fs from "fs";
import path from "path";
import { Pool, type PoolConfig } from "pg";

const RDS_CA_BUNDLE_PATH = path.join(process.cwd(), "lib/db/rds-ca-bundle.pem");

function getPoolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const sslEnabled = process.env.DATABASE_SSL === "true";

  return {
    connectionString,
    ssl: sslEnabled
      ? {
          rejectUnauthorized: true,
          ca: fs.readFileSync(RDS_CA_BUNDLE_PATH),
        }
      : undefined,
    statement_timeout: 30_000,
    max: 10,
  };
}

declare global {
  var __pgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global.__pgPool) {
    global.__pgPool = new Pool(getPoolConfig());
  }
  return global.__pgPool;
}

export async function withTransaction<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
