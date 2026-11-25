/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import {
  DescriptorId,
  EServiceId,
  generateId,
  ListResult,
  operationForbidden,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { archivingRowToApiMonitoringArchivingRow } from "../../src/model/domain/apiConverter.js";
import { eServiceNotFound } from "../../src/model/domain/errors.js";
import { ArchivingRow } from "../../src/model/domain/models.js";
import { api, catalogService } from "../vitest.api.setup.js";

describe("API GET /producers/eservices/{eserviceId}/monitoring/archiving", () => {
  const eserviceId = generateId<EServiceId>();
  const archivingRow: ArchivingRow = {
    eserviceId,
    eserviceName: "Anagrafe",
    descriptorId: generateId<DescriptorId>(),
    version: "2",
    consumersCount: 3,
    archivableOn: new Date(),
  };
  const mockResult: ListResult<ArchivingRow> = {
    results: [archivingRow],
    totalCount: 1,
  };
  const apiResponse: catalogApi.MonitoringArchiving = {
    results: [archivingRowToApiMonitoringArchivingRow(archivingRow)],
    pagination: { offset: 0, limit: 10, totalCount: 1 },
  };

  beforeEach(() => {
    catalogService.getProducerEServiceMonitoringArchiving = vi
      .fn()
      .mockResolvedValue(mockResult);
  });

  const makeRequest = async (
    token: string,
    id: string = eserviceId,
    query: Record<string, unknown> = { offset: 0, limit: 10 }
  ) =>
    request(api)
      .get(`/producers/eservices/${id}/monitoring/archiving`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query)
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
      expect(res.body).toEqual(apiResponse);
      expect(
        catalogService.getProducerEServiceMonitoringArchiving
      ).toHaveBeenCalledWith(
        eserviceId,
        { offset: 0, limit: 10 },
        expect.anything()
      );
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
      catalogService.getProducerEServiceMonitoringArchiving = vi
        .fn()
        .mockRejectedValue(error);
      const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{ offset: 0, limit: 10 }, "invalid"],
    [{}, eserviceId],
    [{ offset: 0 }, eserviceId],
    [{ limit: 10 }, eserviceId],
    [{ offset: -1, limit: 10 }, eserviceId],
    [{ offset: 0, limit: 0 }, eserviceId],
    [{ offset: 0, limit: 51 }, eserviceId],
  ])(
    "Should return 400 if passed invalid params: %s (eserviceId: %s)",
    async (query, id) => {
      const res = await makeRequest(
        generateToken(authRole.ADMIN_ROLE),
        id,
        query
      );
      expect(res.status).toBe(400);
    }
  );
});
