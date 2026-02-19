import { describe, it, expect, vi } from "vitest";

vi.mock("../src/config/config.js", () => ({
  config: {
    bffUrl: "https://selfcare.dev.interop.pagopa.it/0.0/backend-for-frontend",
  },
}));

import {
  buildEserviceLink,
  buildAgreementLink,
  buildPurposeLink,
  buildDelegationLink,
  viewAllNewUpdatedEservicesLink,
  notificationSettingsLink,
} from "../src/services/deeplinkBuilder.js";

describe("deeplinkBuilder - base path preservation", () => {
  const selfcareId = "test-selfcare-id";

  it("should preserve BFF_URL base path in eservice deeplink", () => {
    const url = new URL(
      buildEserviceLink("eservice-id", "descriptor-id", selfcareId)
    );
    expect(url.pathname).toBe(
      "/0.0/backend-for-frontend/emailDeepLink/eserviceCatalog"
    );
    expect(url.searchParams.get("entityId")).toBe("eservice-id/descriptor-id");
    expect(url.searchParams.get("selfcareId")).toBe(selfcareId);
  });

  it("should preserve BFF_URL base path in agreement deeplink", () => {
    const url = new URL(buildAgreementLink("agreement-id", true, selfcareId));
    expect(url.pathname).toBe(
      "/0.0/backend-for-frontend/emailDeepLink/agreementToProducer"
    );
  });

  it("should preserve BFF_URL base path in purpose deeplink", () => {
    const url = new URL(buildPurposeLink("purpose-id", false, selfcareId));
    expect(url.pathname).toBe(
      "/0.0/backend-for-frontend/emailDeepLink/purposeToConsumer"
    );
  });

  it("should preserve BFF_URL base path in delegation deeplink", () => {
    const url = new URL(buildDelegationLink(selfcareId));
    expect(url.pathname).toBe(
      "/0.0/backend-for-frontend/emailDeepLink/delegation"
    );
  });

  it("should preserve BFF_URL base path in view all link", () => {
    const url = new URL(viewAllNewUpdatedEservicesLink(selfcareId));
    expect(url.pathname).toBe(
      "/0.0/backend-for-frontend/emailDeepLink/eserviceCatalog"
    );
  });

  it("should preserve BFF_URL base path in notification settings link", () => {
    const url = new URL(notificationSettingsLink(selfcareId));
    expect(url.pathname).toBe(
      "/0.0/backend-for-frontend/emailDeepLink/notificationSettings"
    );
  });
});
