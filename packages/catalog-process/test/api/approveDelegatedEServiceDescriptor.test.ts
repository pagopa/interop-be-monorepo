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
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "pagopa-interop-commons-test";
import { api, catalogService } from "../vitest.api.setup.js";
import {
  eServiceDescriptorNotFound,
  eServiceNotFound,
} from "../../src/model/domain/errors.js";

describe("API /eservices/:eServiceId/descriptors/:descriptorId/approve authorization test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    interface: getMockDocument(),
    state: descriptorState.waitingForApproval,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  catalogService.approveDelegatedEServiceDescriptor = vi
    .fn()
    .mockResolvedValue({});

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId
  ) =>
    request(api)
      .post(`/eservices/${eServiceId}/descriptors/${descriptorId}/approve`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 200 for user with role admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockEService.id, descriptor.id);

    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
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
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.approveDelegatedEServiceDescriptor = vi
        .fn()
        .mockRejectedValue(error);

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
