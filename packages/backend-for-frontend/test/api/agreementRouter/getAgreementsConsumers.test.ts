/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, clients } from "../../vitest.api.setup.js";
import { getMockAgreementApiCompactOrganization } from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toBffCompactOrganization } from "../../../src/api/agreementApiConverter.js";

describe("API GET /agreements/filter/consumers", () => {
  const mockCompactOrganization1 = getMockAgreementApiCompactOrganization();
  const mockCompactOrganization2 = getMockAgreementApiCompactOrganization();
  const mockCompactOrganization3 = getMockAgreementApiCompactOrganization();
  const mockApiCompactOrganization1 = toBffCompactOrganization(
    mockCompactOrganization1
  );
  const mockApiCompactOrganization2 = toBffCompactOrganization(
    mockCompactOrganization2
  );
  const mockApiCompactOrganization3 = toBffCompactOrganization(
    mockCompactOrganization3
  );

  const mockCompactOrganizations = {
    results: [
      mockCompactOrganization1,
      mockCompactOrganization2,
      mockCompactOrganization3,
    ],
    totalCount: 3,
  };

  const mockApiCompactOrganizations = {
    results: [
      mockApiCompactOrganization1,
      mockApiCompactOrganization2,
      mockApiCompactOrganization3,
    ],
    pagination: {
      offset: 0,
      limit: 10,
      totalCount: 3,
    },
  };

  const makeRequest = async (token: string, limit: unknown = 10) =>
    request(api)
      .get(`${appBasePath}/agreements/filter/consumers`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({ offset: 0, limit })
      .send();

  beforeEach(() => {
    clients.agreementProcessClient.getAgreementsConsumers = vi
      .fn()
      .mockResolvedValue(mockCompactOrganizations);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCompactOrganizations);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
