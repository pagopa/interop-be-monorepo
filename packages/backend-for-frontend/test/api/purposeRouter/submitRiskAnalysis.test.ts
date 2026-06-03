/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PurposeId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /purposes/{purposeId}/riskAnalysis/submit test", () => {
  const mockPurposeId: PurposeId = generateId();
  const defaultBody: bffApi.RiskAnalysisSubmissionSeed = {
    riskAnalysisForm: {
      version: "3.0",
      answers: {
        purpose: ["INSTITUTIONAL"],
        institutionalPurpose: ["test purpose description"],
        personalDataTypes: ["OTHER"],
        otherPersonalDataTypes: ["other data type"],
        legalBasis: ["LEGAL_OBLIGATION"],
        legalObligationReference: ["some law ref"],
        knowsDataQuantity: ["NO"],
        deliveryMethod: ["ANONYMOUS"],
        ppiIrreversibleAdditionalTechniques: ["CRYPTOGRAPHIC_HASH"],
        doneDpia: ["NO"],
        dataRetentionPeriod: ["24"],
        purposePursuit: ["MERE_CORRECTNESS"],
        checkedExistenceMereCorrectnessInteropCatalogue: ["true"],
        usesThirdPartyData: ["NO"],
        personalData: ["YES"],
      },
    },
  };

  beforeEach(() => {
    clients.purposeProcessClient.submitRiskAnalysis = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurposeId,
    body: bffApi.RiskAnalysisSubmissionSeed = defaultBody
  ) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}/riskAnalysis/submit`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { purposeId: "invalid" as PurposeId },
    { body: {} },
    { body: { riskAnalysisForm: {} } },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeId,
        body as bffApi.RiskAnalysisSubmissionSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
