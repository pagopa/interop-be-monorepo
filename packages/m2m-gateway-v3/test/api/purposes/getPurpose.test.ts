import { purposeApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockedApiPurpose,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { toM2MGatewayApiPurpose } from "../../../src/api/purposeApiConverter.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, mockPurposeService } from "../../vitest.api.setup.js";

describe("GET /purpose/:purposeId router test", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  const makeRequest = async (token: string, purposeId: string) =>
    request(api)
      .get(`${appBasePath}/purposes/${purposeId}`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send();

  const reviewerWorkflow: purposeApi.ReviewerWorkflow = {
    reviewers: [
      {
        id: generateId(),
        sentToReviewerAt: "2026-10-19T12:00:00.000Z",
      },
    ],
    signingState: purposeApi.RiskAnalysisSigningState.Values.ASSIGNED,
  };
  const expectedReviewerWorkflow = {
    ...reviewerWorkflow,
    reviewers: reviewerWorkflow.reviewers.map(({ id, ...reviewer }) => ({
      ...reviewer,
      userId: id,
    })),
  };

  const mockApiPurpose = {
    ...getMockedApiPurpose(),
    reviewerWorkflow,
  };
  const mockM2MPurposeResponse = toM2MGatewayApiPurpose(
    mockApiPurpose,
    mockApiPurpose.consumerId
  );

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeService.getPurpose = vi
        .fn()
        .mockResolvedValue(mockM2MPurposeResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockM2MPurposeResponse.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurposeResponse);
      expect(res.body.reviewerWorkflow).toEqual(expectedReviewerWorkflow);
    }
  );

  it("Should accept a reviewer workflow without reviewer details", async () => {
    const purposeWithoutReviewers = {
      ...mockM2MPurposeResponse,
      reviewerWorkflow: {
        signingState: reviewerWorkflow.signingState,
      },
    };
    mockPurposeService.getPurpose = vi
      .fn()
      .mockResolvedValue(purposeWithoutReviewers);

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, purposeWithoutReviewers.id);

    expect(res.status).toBe(200);
    expect(res.body.reviewerWorkflow).toEqual(
      purposeWithoutReviewers.reviewerWorkflow
    );
  });

  it("Should return 400 for incorrect value for purpose id", async () => {
    mockPurposeService.getPurpose = vi
      .fn()
      .mockResolvedValue(mockM2MPurposeResponse);

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "INVALID ID");
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId());
    expect(res.status).toBe(403);
  });

  it.each([
    { ...mockM2MPurposeResponse, createdAt: undefined },
    { ...mockM2MPurposeResponse, eserviceId: "invalidId" },
    { ...mockM2MPurposeResponse, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeService.getPurpose = vi.fn().mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockM2MPurposeResponse.id);

      expect(res.status).toBe(500);
    }
  );
});
