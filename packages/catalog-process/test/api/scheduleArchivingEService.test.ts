/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockDescriptor,
  getMockEService,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import {
  eServiceNotFound,
  eserviceWithoutValidDescriptors,
  gracePeriodDaysLowerThanDescriptor,
  notValidEServiceState,
} from "../../src/model/domain/errors.js";
import { api, catalogService } from "../vitest.api.setup.js";

describe("API /eservices/${eServiceId}/scheduleArchive authorization test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const apiEservice = catalogApi.EService.parse(
    eServiceToApiEService(mockEService)
  );

  const mockEserviceWithMetadata = getMockWithMetadata(mockEService);

  const archivingReasonSeed: catalogApi.EServiceArchivingSeed = {
    archivingReason: "No longer needed",
    gracePeriodDays: 60,
  };

  catalogService.scheduleEServiceArchiving = vi
    .fn()
    .mockResolvedValue(mockEserviceWithMetadata);

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    body: catalogApi.EServiceArchivingSeed = archivingReasonSeed
  ) =>
    request(api)
      .post(`/eservices/${eServiceId}/scheduleArchive`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockEService.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEservice);
      expect(res.headers["x-metadata-version"]).toBe(
        mockEserviceWithMetadata.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: eserviceWithoutValidDescriptors(mockEService.id),
      expectedStatus: 400,
    },
    {
      error: gracePeriodDaysLowerThanDescriptor(
        mockEService.id,
        mockEService.descriptors[0].id,
        new Date(),
        new Date()
      ),
      expectedStatus: 400,
    },
    {
      error: eServiceNotFound(mockEService.id),
      expectedStatus: 404,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: notValidEServiceState(mockEService.id),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.scheduleEServiceArchiving = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEService.id],
    [{ archivingReason: "Some reason", gracePeriodDays: 60 }, "invalidId"],
    [{ archivingReason: 1, gracePeriodDays: 60 }, mockEService.id],
    [{ archivingReason: "too short", gracePeriodDays: 60 }, mockEService.id],
    [{ archivingReason: "Some reason" }, mockEService.id],
    [{ archivingReason: "Some reason", gracePeriodDays: -1 }, mockEService.id],
    [{ archivingReason: "Some reason", gracePeriodDays: 0 }, mockEService.id],
    [{ archivingReason: "Some reason", gracePeriodDays: 1 }, mockEService.id],
    [{ archivingReason: "Some reason", gracePeriodDays: 29 }, mockEService.id],
  ])(
    "Should return 400 if passed invalid params: %s",
    async (body, eServiceId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        body as catalogApi.EServiceArchivingSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
