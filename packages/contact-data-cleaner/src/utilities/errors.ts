import { DrizzleQueryError } from "drizzle-orm";

/**
 * Returns an error message safe to log. The message of a Drizzle query error
 * embeds the SQL and all its parameters, so only its cause is reported.
 */
export const describeError = (error: unknown): string => {
  if (error instanceof DrizzleQueryError) {
    return error.cause instanceof Error
      ? error.cause.message
      : "Database query failed";
  }
  return error instanceof Error ? error.message : String(error);
};
