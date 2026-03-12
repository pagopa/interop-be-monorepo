/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Descriptor,
  DescriptorId,
  descriptorState,
  EService,
  EServiceId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, catalogService } from "../vitest.api.setup.js";

import {
  eServiceDescriptorNotFound,
  eServiceNotFound,
  notValidDescriptorState,
} from "../../src/model/domain/errors.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";

describe("API /eservices/{eServiceId}/descriptors/{descriptorId}/activate authorization test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    interface: getMockDocument(),
    state: descriptorState.suspended,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const mockApiEservice = eServiceToApiEService(mockEService);

  const mockEserviceWithMetadata = getMockWithMetadata(mockEService);

  catalogService.activateDescriptor = vi
    .fn()
    .mockResolvedValue(mockEserviceWithMetadata);

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId
  ) =>
    request(api)
      .post(`/eservices/${eServiceId}/descriptors/${descriptorId}/activate`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockEService);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockEService.id, descriptor.id);
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
    const res = await makeRequest(token, mockEService.id, descriptor.id);

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
      error: notValidDescriptorState(descriptor.id, descriptorState.published),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.activateDescriptor = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id, descriptor.id);
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
        descriptorId as DescriptorId
      );

      expect(res.status).toBe(400);
    }
  );
});
