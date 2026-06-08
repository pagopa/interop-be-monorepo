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
      version: "3.1",
      answers: {
        purpose: ["INSTITUTIONAL"],
        institutionalPurpose: ["MyPurpose"],
        usesPersonalData: ["YES"],
        personalDataTypes: ["OTHER"],
        otherPersonalDataTypes: ["MyDataTypes"],
        legalBasis: ["LEGAL_OBLIGATION", "PUBLIC_INTEREST"],
        legalObligationReference: ["YES"],
        legalBasisPublicInterest: ["RULE_OF_LAW"],
        ruleOfLawText: ["TheLaw"],
        knowsDataQuantity: ["NO"],
        dataQuantity: [],
        dataDownload: ["YES"],
        deliveryMethod: ["CLEARTEXT"],
        policyProvided: ["NO"],
        confirmPricipleIntegrityAndDiscretion: ["true"],
        reasonPolicyNotProvided: ["Because"],
        doneDpia: ["NO"],
        dataRetentionPeriod: ["10"],
        purposePursuit: ["MERE_CORRECTNESS"],
        checkedExistenceMereCorrectnessInteropCatalogue: ["true"],
        isRequestOnBehalfOfThirdParties: ["YES"],
        thirdPartiesRequestDataUsage: ["PA_ONLY"],
        declarationConfirmGDPR: ["true"],
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
