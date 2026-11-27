import { genericLogger } from "pagopa-interop-commons";
import { describe, expect, it, vi } from "vitest";

import { omitUnavailableTenantContact } from "../src/utilities/tenantContactErrors.js";

const warn = vi.fn();
const onContactError = omitUnavailableTenantContact({ ...genericLogger, warn });

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
      expect(warn).toHaveBeenCalledWith(
        `Unable to read tenant contact: ${status ?? "no response"}`
      );
    }
  );

  it("sanitizes client validation failures", () => {
    expect(() => onContactError(new Error("contact@example.org"))).toThrow(
      "Tenant contact request failed"
    );
  });
});
