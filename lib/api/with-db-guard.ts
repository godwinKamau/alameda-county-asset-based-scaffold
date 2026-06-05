import "server-only";

import {
  databaseWakingResponse,
  isDatabaseWakingError,
} from "@/lib/db/errors";

export function withDbGuard(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response>;

export function withDbGuard<Context>(
  handler: (req: Request, context: Context) => Promise<Response>,
): (req: Request, context: Context) => Promise<Response>;

export function withDbGuard(
  handler: (req: Request, context?: unknown) => Promise<Response>,
) {
  return async (req: Request, context?: unknown) => {
    try {
      if (context === undefined) {
        return await handler(req);
      }
      return await handler(req, context);
    } catch (error) {
      if (isDatabaseWakingError(error)) {
        return databaseWakingResponse();
      }
      throw error;
    }
  };
}
