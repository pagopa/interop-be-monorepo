import { describe, it, expect } from "vitest";
import {
  CorrelationId,
  EmailNotificationMessagePayload,
  TenantId,
  UserId,
  generateId,
} from "pagopa-interop-models";
import { encodeEmailEvent } from "../../src/services/emailKafkaSinkService.js";

describe("encodeEmailEvent", () => {
  const correlationId = generateId<CorrelationId>();
  const tenantId = generateId<TenantId>();

  it("encodes a User-typed payload with the correct shape", () => {
    const userId = generateId<UserId>();
    const payload: EmailNotificationMessagePayload = {
      correlationId,
      tenantId,
      type: "User",
      userId,
      email: { subject: "hello", body: "<p>hi</p>" },
    };

    const encoded = JSON.parse(encodeEmailEvent(payload));
    expect(encoded).toEqual({
      correlationId,
      tenantId,
      type: "User",
      userId,
      email: { subject: "hello", body: "<p>hi</p>" },
    });
  });

  it("encodes a Tenant-typed payload with the correct shape", () => {
    const payload: EmailNotificationMessagePayload = {
      correlationId,
      tenantId,
      type: "Tenant",
      address: "contact@example.com",
      email: { subject: "hello", body: "<p>hi</p>" },
    };

    const encoded = JSON.parse(encodeEmailEvent(payload));
    expect(encoded).toEqual({
      correlationId,
      tenantId,
      type: "Tenant",
      address: "contact@example.com",
      email: { subject: "hello", body: "<p>hi</p>" },
    });
  });
});
