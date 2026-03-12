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

describe("API /eservices/{eServiceId}/descriptors/{descriptorId} authorization test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.draft),
  };
  const eservice: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const serviceResponse = getMockWithMetadata(eservice);

  catalogService.deleteDraftDescriptor = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId
  ) =>
    request(api)
      .delete(`/eservices/${eServiceId}/descriptors/${descriptorId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, eservice.id, descriptor.id);
      expect(res.status).toBe(204);
      expect(res.headers["x-metadata-version"]).toEqual(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, eservice.id, descriptor.id);

    expect(res.status).toBe(403);
  });

  it("Should return 204 and not set metadata when the entire e-service is deleted", async () => {
    catalogService.deleteDraftDescriptor = vi.fn().mockResolvedValueOnce(
      undefined // when the entire e-service is deleted, the service returns undefined
    );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, eservice.id, descriptor.id);
    expect(res.status).toBe(204);
    expect(res.headers["x-metadata-version"]).toBeUndefined();
  });

  it.each([
    {
      error: eServiceNotFound(eservice.id),
      expectedStatus: 404,
    },
    {
      error: eServiceDescriptorNotFound(eservice.id, descriptor.id),
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
      catalogService.deleteDraftDescriptor = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eservice.id, descriptor.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    {
      eServiceId: "invalidId",
      descriptorId: descriptor.id,
    },
    {
      eServiceId: eservice.id,
      descriptorId: "invalidId",
    },
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
