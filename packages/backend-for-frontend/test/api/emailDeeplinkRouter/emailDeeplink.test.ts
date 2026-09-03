import { generateId, NotificationType } from "pagopa-interop-models";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { api } from "../../vitest.api.setup.js";

describe("API GET /emailDeepLink/:notificationType/:entityId", () => {
  const entityId = generateId();
  const selfcareId = generateId();

  const makeRequest = (
    notificationType: NotificationType,
    selfcareId?: string
  ): request.Test =>
    request(api)
      .get(`${appBasePath}/emailDeepLink/${notificationType}/${entityId}`)
      .set("X-Correlation-Id", generateId())
      .query(selfcareId ? { selfcareId } : {});

  it.each<[NotificationType, string]>([
    ["draftPurposeDeletedWithRiskAnalysisToReviewer", "/analisi-del-rischio"],
    [
      "certifiedVerifiedAttributeAssignedRevokedToAssignee",
      "/aderente/anagrafica",
    ],
    ["purposeActivatedRejectedToConsumer", `/fruizione/finalita/${entityId}`],
    ["agreementManagementToProducer", `/erogazione/richieste/${entityId}`],
  ])(
    "should redirect %s to %s through token-exchange",
    async (notificationType, redirectPath) => {
      const res = await makeRequest(notificationType, selfcareId);

      expect(res.status).toBe(302);
      const location = new URL(res.headers.location);
      expect(location.origin).toBe(new URL(config.frontendBaseUrl).origin);
      expect(location.pathname).toBe("/token-exchange");
      expect(location.searchParams.get("institutionId")).toBe(selfcareId);
      expect(location.searchParams.get("productId")).toBe(
        config.selfcareProductName
      );
      expect(location.searchParams.get("redirectUrl")).toBe(redirectPath);
    }
  );

  it("should fall back to the frontend base URL without selfcareId", async () => {
    const res = await makeRequest(
      "draftPurposeDeletedWithRiskAnalysisToReviewer"
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(config.frontendBaseUrl);
  });
});
