/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import {
  EServiceId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { eServiceNotFound } from "../../src/model/domain/errors.js";
import { api, catalogService } from "../vitest.api.setup.js";

describe("API GET /producers/eservices/{eserviceId}/monitoring/agreements", () => {
  const eserviceId = generateId<EServiceId>();
  const mockResponse: catalogApi.ProducerEServiceMonitoringAgreements = {
    consumersByVersion: {
      total: 40,
      versions: [
        { descriptorId: generateId(), version: "4", consumersCount: 25 },
        { descriptorId: generateId(), version: "3", consumersCount: 10 },
      ],
      olderVersionsConsumersCount: 5,
      medianUpgradeDays: 12,
    },
    consumersByKind: { total: 40, pa: 30, gspScp: 6, private: 4 },
    pendingAgreements: 1,
  };

  beforeEach(() => {
    catalogService.getProducerEServiceMonitoringAgreements = vi
      .fn()
      .mockResolvedValue(mockResponse);
  });

  const makeRequest = async (token: string, id: string = eserviceId) =>
    request(api)
      .get(`/producers/eservices/${id}/monitoring/agreements`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.API_ROLE,
    authRole.VIEWER_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const res = await makeRequest(generateToken(role));
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResponse);
      expect(
        catalogService.getProducerEServiceMonitoringAgreements
      ).toHaveBeenCalledWith(eserviceId, expect.anything());
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const res = await makeRequest(generateToken(role));
    expect(res.status).toBe(403);
  });

  it.each([
    { error: eServiceNotFound(eserviceId), expectedStatus: 404 },
    { error: operationForbidden, expectedStatus: 403 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.getProducerEServiceMonitoringAgreements = vi
        .fn()
        .mockRejectedValue(error);
      const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid eserviceId", async () => {
    const res = await makeRequest(
      generateToken(authRole.ADMIN_ROLE),
      "invalid"
    );
    expect(res.status).toBe(400);
  });
});
