/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { services, api } from "../../vitest.api.setup.js";
import { getMockApiAgreementListEntry } from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { agreementDescriptorNotFound } from "../../../src/model/errors.js";

describe("API GET /consumers/agreements", () => {
  const mockAgreement1 = getMockApiAgreementListEntry();
  const mockAgreement2 = getMockApiAgreementListEntry();
  const mockAgreement3 = getMockApiAgreementListEntry();

  const mockAgreements = {
    results: [mockAgreement1, mockAgreement2, mockAgreement3],
    pagination: {
      offset: 0,
      limit: 10,
      totalCount: 3,
    },
  };

  const apiAgreements = bffApi.Agreements.parse(mockAgreements);

  services.agreementService.getConsumerAgreements = vi
    .fn()
    .mockResolvedValue(mockAgreements);

  const makeRequest = async (token: string, limit: unknown = 10) =>
    request(api)
      .get(`${appBasePath}/consumers/agreements`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({ offset: 0, limit })
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiAgreements);
  });

  it("Should return 500 for agreementDescriptorNotFound", async () => {
    services.agreementService.getConsumerAgreements = vi
      .fn()
      .mockRejectedValue(agreementDescriptorNotFound(mockAgreement1.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(500);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
