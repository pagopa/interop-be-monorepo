/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { agreementService, api } from "../../vitest.api.setup.js";
import { getMockApiCompactEServiceLight } from "../../mockUtils.js";

describe("API GET /producers/agreements/eservices", () => {
  const mockPayload = {
    offset: 0,
    limit: 10,
    requesterId: generateId(),
    eServiceName: "name",
  };
  const mockCompactEServiceLight1 = getMockApiCompactEServiceLight();
  const mockCompactEServiceLight2 = getMockApiCompactEServiceLight();
  const mockCompactEServiceLight3 = getMockApiCompactEServiceLight();

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

  // eslint-disable-next-line functional/immutable-data
  agreementService.getAgreementsProducerEServices = vi
    .fn()
    .mockResolvedValue(apiCompactEServicesLight);

  const makeRequest = async (token: string, payload: object = mockPayload) =>
    request(api)
      .get(`/producers/agreements/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(payload);

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiCompactEServicesLight);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {
      ...mockPayload,
      requesterId: "invalid",
    });
    expect(res.status).toBe(400);
  });
});
