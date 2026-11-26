import { generateId, CorrelationId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import { omitUnavailableTenantContact } from "../src/utilities/tenantContactErrors.js";

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock("pagopa-interop-commons", async (original) => ({
  ...(await original<typeof import("pagopa-interop-commons")>()),
  logger: () => ({ warn }),
}));

const onContactError = omitUnavailableTenantContact({
  "X-Correlation-Id": generateId<CorrelationId>(),
  Authorization: "Bearer user",
  "X-Forwarded-For": undefined,
});

describe("optional tenant contact", () => {
  it("propagates a role or authentication failure", () => {
    for (const status of [401, 403]) {
      expect(() =>
        onContactError({ isAxiosError: true, response: { status } })
      ).toThrow(expect.objectContaining({ response: { status } }));
    }
  });

  it("omits an absent contact", () => {
    expect(
      onContactError({ isAxiosError: true, response: { status: 404 } })
    ).toBeUndefined();
  });

  it.each([500, 503, undefined])(
    "omits unavailable contacts (%s) without logging the address",
    (status) => {
      warn.mockClear();
      const address = "contact@example.org";
      expect(
        onContactError({
          isAxiosError: true,
          message: address,
          response: status ? { status, data: address } : undefined,
        })
      ).toBeUndefined();
      expect(warn).toHaveBeenCalledOnce();
      expect(JSON.stringify(warn.mock.calls)).not.toContain(address);
    }
  );

  it("sanitizes client validation failures", () => {
    expect(() => onContactError(new Error("contact@example.org"))).toThrow(
      "Tenant contact request failed"
    );
  });
});
