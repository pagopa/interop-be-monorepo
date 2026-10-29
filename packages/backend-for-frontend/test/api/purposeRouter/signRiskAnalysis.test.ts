/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AxiosError } from "axios";
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { PurposeId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { getMockApiError } from "../../mockUtils.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /purposes/{purposeId}/riskAnalysis/sign test", () => {
  const mockPurposeId: PurposeId = generateId();
  const defaultBody: bffApi.RiskAnalysisSignSeed = {
    metadataVersionToSign: 1,
  };

  beforeEach(() => {
    config.featureFlagNewOperators = true;
    clients.purposeProcessClient.signRiskAnalysis = vi
      .fn()
      .mockResolvedValue({ id: mockPurposeId });
    clients.purposeProcessClientWithMetadata.getPurpose = vi.fn();
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurposeId,
    body: bffApi.RiskAnalysisSignSeed = defaultBody
  ) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}/riskAnalysis/sign`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Reviewer", async () => {
    const token = generateToken(authRole.REVIEWER_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
    expect(
      clients.purposeProcessClient.signRiskAnalysis
    ).toHaveBeenCalledExactlyOnceWith(
      defaultBody,
      expect.objectContaining({ params: { purposeId: mockPurposeId } })
    );
    expect(
      clients.purposeProcessClientWithMetadata.getPurpose
    ).not.toHaveBeenCalled();
  });

  it.each([
    "004-0049",
    "004-0066",
    "004-0067",
    "004-0064",
    "004-10034",
    "004-0016",
  ])(
    "Should forward process conflict %s without diagnostic reads or retries",
    async (code) => {
      const error = getMockApiError(409, [code]);
      vi.mocked(
        clients.purposeProcessClient.signRiskAnalysis
      ).mockRejectedValue(error);
      const token = generateToken(authRole.REVIEWER_ROLE);

      const res = await makeRequest(token);

      expect(res.status).toBe(409);
      expect(res.body).toEqual(error.response?.data);
      expect(
        clients.purposeProcessClient.signRiskAnalysis
      ).toHaveBeenCalledExactlyOnceWith(defaultBody, {
        params: { purposeId: mockPurposeId },
        headers: expect.objectContaining({
          Authorization: `Bearer ${token}`,
          "X-Correlation-Id": res.headers["x-correlation-id"],
        }),
      });
      expect(
        clients.purposeProcessClientWithMetadata.getPurpose
      ).not.toHaveBeenCalled();
    }
  );

  it("Should preserve multiple process errors without reclassifying them", async () => {
    const error = getMockApiError(409, ["004-0049", "004-0016"]);
    vi.mocked(clients.purposeProcessClient.signRiskAnalysis).mockRejectedValue(
      error
    );

    const res = await makeRequest(generateToken(authRole.REVIEWER_ROLE));

    expect(res.status).toBe(409);
    expect(res.body).toEqual(error.response?.data);
    expect(
      clients.purposeProcessClientWithMetadata.getPurpose
    ).not.toHaveBeenCalled();
  });

  it.each([400, 403, 404])(
    "Should preserve process status %s without diagnostic reads",
    async (status) => {
      const error = getMockApiError(status, ["004-0049"]);
      vi.mocked(
        clients.purposeProcessClient.signRiskAnalysis
      ).mockRejectedValue(error);

      const res = await makeRequest(generateToken(authRole.REVIEWER_ROLE));

      expect(res.status).toBe(status);
      expect(res.body).toEqual(error.response?.data);
      expect(
        clients.purposeProcessClientWithMetadata.getPurpose
      ).not.toHaveBeenCalled();
    }
  );

  it("Should preserve network errors without diagnostic reads or retries", async () => {
    vi.mocked(clients.purposeProcessClient.signRiskAnalysis).mockRejectedValue(
      new AxiosError("network failure")
    );

    const res = await makeRequest(generateToken(authRole.REVIEWER_ROLE));

    expect(res.status).toBe(500);
    expect(
      clients.purposeProcessClient.signRiskAnalysis
    ).toHaveBeenCalledOnce();
    expect(
      clients.purposeProcessClientWithMetadata.getPurpose
    ).not.toHaveBeenCalled();
  });

  it.each([
    { purposeId: "invalid" as PurposeId },
    { body: {} },
    { body: { metadataVersionToSign: -1 } },
    { body: { metadataVersionToSign: 1.5 } },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId, body }) => {
      const token = generateToken(authRole.REVIEWER_ROLE);
      const res = await makeRequest(
        token,
        purposeId,
        body as bffApi.RiskAnalysisSignSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
