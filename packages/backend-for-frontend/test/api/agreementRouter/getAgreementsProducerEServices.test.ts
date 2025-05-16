/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, clients } from "../../vitest.api.setup.js";
import {
  getMockAgreementApiCompactEService,
  getMockApiCompactEServiceLight,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /producers/agreements/eservices", () => {
  const mockCompactEService1 = getMockAgreementApiCompactEService();
  const mockCompactEService2 = getMockAgreementApiCompactEService();
  const mockCompactEService3 = getMockAgreementApiCompactEService();
  const mockCompactEServiceLight1 = getMockApiCompactEServiceLight(
    mockCompactEService1.id
  );
  const mockCompactEServiceLight2 = getMockApiCompactEServiceLight(
    mockCompactEService2.id
  );
  const mockCompactEServiceLight3 = getMockApiCompactEServiceLight(
    mockCompactEService3.id
  );

  const mockCompactEServices = {
    results: [mockCompactEService1, mockCompactEService2, mockCompactEService3],
    totalCount: 3,
  };

  const mockCompactEServicesLight = {
    results: [
      mockCompactEServiceLight1,
      mockCompactEServiceLight2,
      mockCompactEServiceLight3,
    ],
    pagination: {
      offset: 0,
      limit: 10,
      totalCount: 3,
    },
  };

  const apiCompactEServicesLight = bffApi.CompactEServicesLight.parse(
    mockCompactEServicesLight
  );

  const makeRequest = async (token: string, limit: unknown = 10) =>
    request(api)
      .get(`${appBasePath}/producers/agreements/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({ offset: 0, limit })
      .send();

  beforeEach(() => {
    clients.agreementProcessClient.getAgreementsEServices = vi
      .fn()
      .mockResolvedValue(mockCompactEServices);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiCompactEServicesLight);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
