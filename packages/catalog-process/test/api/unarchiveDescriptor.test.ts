import { catalogApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import {
  getMockDescriptor,
  getMockEService,
  generateToken,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, vi, it, expect } from "vitest";

import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
} from "../../src/model/domain/errors.js";
import { api, catalogService } from "../vitest.api.setup.js";

describe("API /maintenance/eservices/{eServiceId}/descriptors/{descriptorId}/unarchive authorization and logic test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.archived,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  catalogService.unarchiveDescriptor = vi.fn().mockResolvedValue({});

  const makeRequest = async (
    token: string,
    eServiceId: string,
    descriptorId: string,
    body: catalogApi.ForceTargetState = {}
  ) =>
    request(api)
      .post(
        `/maintenance/eservices/${eServiceId}/descriptors/${descriptorId}/unarchive`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role maintenance", async () => {
    const token = generateToken(authRole.MAINTENANCE_ROLE);
    const res = await makeRequest(token, mockEService.id, descriptor.id);

    expect(res.status).toBe(204);
    expect(catalogService.unarchiveDescriptor).toHaveBeenCalledWith(
      mockEService.id,
      descriptor.id,
      {},
      expect.anything()
    );
  });

  it("Should return 204 when passing SUSPENDED as forceTargetState", async () => {
    const token = generateToken(authRole.MAINTENANCE_ROLE);
    const body: catalogApi.ForceTargetState = { forceTargetState: "SUSPENDED" };
    const res = await makeRequest(token, mockEService.id, descriptor.id, body);

    expect(res.status).toBe(204);
    expect(catalogService.unarchiveDescriptor).toHaveBeenCalledWith(
      mockEService.id,
      descriptor.id,
      body,
      expect.anything()
    );
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.MAINTENANCE_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id, descriptor.id);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: eServiceNotFound(mockEService.id),
      expectedStatus: 404,
    },
    {
      error: eServiceDescriptorNotFound(mockEService.id, descriptor.id),
      expectedStatus: 404,
    },
    {
      error: notValidDescriptorState(descriptor.id, descriptorState.archived),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.unarchiveDescriptor = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.MAINTENANCE_ROLE);
      const res = await makeRequest(token, mockEService.id, descriptor.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{ forceTargetState: "INVALID_STATE" }, mockEService.id, descriptor.id],
    [{}, "invalidId", descriptor.id],
    [{}, mockEService.id, "invalidId"],
  ])(
    "Should return 400 if passed invalid params: %s",
    async (body, eServiceId, descriptorId) => {
      const token = generateToken(authRole.MAINTENANCE_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        descriptorId,
        body as catalogApi.ForceTargetState
      );

      expect(res.status).toBe(400);
    }
  );
});
