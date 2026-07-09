import "server-only";

import { Client, isTracingEnabled as langsmithIsTracingEnabled } from "langsmith";

let client: Client | undefined;

export function getLangSmithClient(): Client {
  if (!client) {
    client = new Client();
  }
  return client;
}

export function isTracingEnabled(): boolean {
  return langsmithIsTracingEnabled();
}

export async function flushPendingTraces(): Promise<void> {
  if (!isTracingEnabled()) {
    return;
  }

  await getLangSmithClient().awaitPendingTraceBatches();
}
