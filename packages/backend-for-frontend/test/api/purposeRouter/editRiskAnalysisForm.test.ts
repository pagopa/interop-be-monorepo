/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { PurposeId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API PUT /purposes/{purposeId}/riskAnalysis/form test", () => {
  const mockPurposeId: PurposeId = generateId();
  const defaultBody: bffApi.RiskAnalysisFormSeed = {
    version: "3.0",
    answers: {
      purpose: ["INSTITUTIONAL"],
      institutionalPurpose: ["MyPurpose"],
    },
  };

  beforeEach(() => {
    clients.purposeProcessClient.editRiskAnalysisForm = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurposeId,
    body: bffApi.RiskAnalysisFormSeed = defaultBody
  ) =>
    request(api)
      .put(`${appBasePath}/purposes/${purposeId}/riskAnalysis/form`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Reviewer", async () => {
    const token = generateToken(authRole.REVIEWER_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { purposeId: "invalid" as PurposeId },
    { body: {} },
    { body: { version: 1, answers: {} } },
    { body: { version: "3.0" } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId, body }) => {
      const token = generateToken(authRole.REVIEWER_ROLE);
      const res = await makeRequest(
        token,
        purposeId ?? mockPurposeId,
        (body ?? defaultBody) as bffApi.RiskAnalysisFormSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
