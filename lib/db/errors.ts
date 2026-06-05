import "server-only";

import { NextResponse } from "next/server";

export const DATABASE_WAKING_CODE = "DATABASE_WAKING";

const NODE_CONNECTION_CODES = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNRESET",
  "EHOSTUNREACH",
  "EAI_AGAIN",
]);

const PG_CONNECTION_CODES = new Set(["57P03", "08001", "08004", "08006"]);

const MESSAGE_PATTERNS = [
  /connection terminated/i,
  /timeout exceeded when trying to connect/i,
  /terminating connection/i,
  /cannot connect now/i,
  /the database system is starting up/i,
];

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

export function isDatabaseWakingError(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code) {
    if (NODE_CONNECTION_CODES.has(code) || PG_CONNECTION_CODES.has(code)) {
      return true;
    }
  }

  const message = getErrorMessage(error);
  if (message && MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
    return true;
  }

  return false;
}

export function databaseWakingResponse(): NextResponse {
  return NextResponse.json(
    {
      error:
        "The database is starting up after sleeping. Please wait a few seconds and reload.",
      code: DATABASE_WAKING_CODE,
    },
    { status: 503 },
  );
}
