import { DrizzleQueryError, eq } from "drizzle-orm";
import { contact } from "pagopa-interop-contact-data-db-models";
import { describe, expect, it } from "vitest";

import { describeError } from "../src/utilities/errors.js";
import { db } from "./utils.js";

describe("describeError", () => {
  it("reports only the cause of a query error, without SQL and parameters", async () => {
    const error = await db
      .select()
      .from(contact)
      .where(eq(contact.id, "not-a-uuid"))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DrizzleQueryError);
    expect(describeError(error)).toContain(
      "invalid input syntax for type uuid"
    );
    expect(describeError(error)).not.toContain("Failed query");
  });

  it("reports the message of other errors", () => {
    expect(describeError(new Error("failed"))).toBe("failed");
    expect(describeError("failed")).toBe("failed");
  });
});
