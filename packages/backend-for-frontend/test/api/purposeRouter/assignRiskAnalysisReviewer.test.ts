/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { PurposeId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockApiError } from "../../mockUtils.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /purposes/{purposeId}/riskAnalysis/assign test", () => {
  const mockPurposeId: PurposeId = generateId();
  const defaultBody: bffApi.RiskAnalysisAssignmentSeed = {
    reviewMode: "REVIEWER_WRITES_REVIEWER_SIGNS",
    reviewerIds: [generateId()],
  };

  beforeEach(() => {
    clients.purposeProcessClientWithMetadata.getPurpose = vi.fn();
    clients.purposeProcessClient.assignRiskAnalysisReviewer = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurposeId,
    body: bffApi.RiskAnalysisAssignmentSeed = defaultBody
  ) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}/riskAnalysis/assign`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it("Should forward the process conflict without diagnostic reads", async () => {
    const error = getMockApiError(409, ["004-0044"]);
    vi.mocked(
      clients.purposeProcessClient.assignRiskAnalysisReviewer
    ).mockRejectedValue(error);

    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));

    expect(res.status).toBe(409);
    expect(res.body).toEqual(error.response?.data);
    expect(
      clients.purposeProcessClientWithMetadata.getPurpose
    ).not.toHaveBeenCalled();
  });

  it.each([
    { purposeId: "invalid" as PurposeId },
    { body: {} },
    {
      body: {
        reviewMode: "INVALID_MODE",
        reviewerIds: [generateId()],
      },
    },
    {
      body: {
        reviewMode: "REVIEWER_WRITES_REVIEWER_SIGNS",
        reviewerIds: [],
      },
    },
    {
      body: {
        reviewMode: "REVIEWER_WRITES_REVIEWER_SIGNS",
        reviewerIds: ["not-a-uuid"],
      },
    },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeId,
        body as bffApi.RiskAnalysisAssignmentSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
