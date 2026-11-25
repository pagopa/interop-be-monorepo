import { DrizzleQueryError } from "drizzle-orm";
import { match, P } from "ts-pattern";

/**
 * Returns an error message safe to log. The message of a Drizzle query error
 * embeds the SQL and all its parameters, so only its cause is reported.
 */
export const describeError = (error: unknown): string =>
  match(error)
    .with(P.instanceOf(DrizzleQueryError), ({ cause }) =>
      cause instanceof Error ? cause.message : "Database query failed"
    )
    .with(P.instanceOf(Error), ({ message }) => message)
    .otherwise(() => String(error));
