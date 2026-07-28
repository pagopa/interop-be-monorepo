/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockDescriptorArchiving,
  getMockEService,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import {
  eServiceToApiEService,
  descriptorToApiDescriptor,
} from "../../src/model/domain/apiConverter.js";
import {
  eServiceDescriptorNotFound,
  eServiceNotFound,
  notValidDescriptorState,
} from "../../src/model/domain/errors.js";
import { api, catalogService } from "../setup/apiSetup.js";

describe("API /eservices/${eServiceId}/descriptors/${descriptorId}/scheduleArchive authorization test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptorArchiving(),
    version: "1",
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const apiDescriptor = catalogApi.EServiceDescriptor.parse(
    descriptorToApiDescriptor(descriptor)
  );

  const mockApiEservice = eServiceToApiEService(mockEService);
  mockApiEservice.descriptors = [apiDescriptor];

  const mockEserviceWithMetadata = getMockWithMetadata(mockEService);

  catalogService.scheduleEServiceDescriptorArchiving = vi
    .fn()
    .mockResolvedValue(mockEserviceWithMetadata);

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId,
    body: catalogApi.GracePeriodDaysSeed
  ) =>
    request(api)
      .post(
        `/eservices/${eServiceId}/descriptors/${descriptorId}/scheduleArchive`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const gracePeriodDaysSeed: catalogApi.GracePeriodDaysSeed = {
    gracePeriodDays: 60,
  };

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockEService.id,
        descriptor.id,
        gracePeriodDaysSeed
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockApiEservice);
      expect(res.headers["x-metadata-version"]).toBe(
        mockEserviceWithMetadata.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      mockEService.id,
      descriptor.id,
      gracePeriodDaysSeed
    );

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: eServiceNotFound(mockEService.id),
      expectedStatus: 404,
    },
    {
      error: eServiceDescriptorNotFound(mockEService.id, descriptor.id),
      expectedStatus: 404,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: notValidDescriptorState(descriptor.id, descriptor.state),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.scheduleEServiceDescriptorArchiving = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockEService.id,
        descriptor.id,
        gracePeriodDaysSeed
      );

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    { eServiceId: "invalidId", descriptorId: descriptor.id },
    { eServiceId: mockEService.id, descriptorId: "invalidId" },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ eServiceId, descriptorId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        descriptorId as DescriptorId,
        gracePeriodDaysSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([0, -1, 1, 29, 31, 1066])(
    "Should return 400 if passed invalid gracePeriodDays: %s",
    async (gracePeriodDays) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id, descriptor.id, {
        gracePeriodDays,
      } as catalogApi.GracePeriodDaysSeed);

      expect(res.status).toBe(400);
    }
  );
});
