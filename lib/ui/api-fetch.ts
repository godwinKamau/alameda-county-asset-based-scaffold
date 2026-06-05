export const DATABASE_WAKING_CODE = "DATABASE_WAKING";

const WAKING_CONFIRM_MESSAGE =
  "The database is starting up after sleeping. Reload the page to continue?";

export class DatabaseWakingError extends Error {
  constructor(message = "Database is starting up") {
    super(message);
    this.name = "DatabaseWakingError";
  }
}

export function isDatabaseWakingError(error: unknown): error is DatabaseWakingError {
  return error instanceof DatabaseWakingError;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status !== 503) {
    return response;
  }

  const data = await response.clone().json().catch(() => ({}));
  if (data.code !== DATABASE_WAKING_CODE) {
    return response;
  }

  const message =
    typeof data.error === "string"
      ? data.error
      : "The database is starting up after sleeping.";

  if (window.confirm(WAKING_CONFIRM_MESSAGE)) {
    window.location.reload();
  }

  throw new DatabaseWakingError(message);
}
