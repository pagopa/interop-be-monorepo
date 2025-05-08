/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Descriptor,
  descriptorState,
  EService,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { api, catalogService } from "../vitest.api.setup.js";
import {
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "../mockUtils.js";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
} from "../../src/model/domain/errors.js";

describe("API /eservices/{eServiceId}/descriptors/{descriptorId}/archive authorization test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    interface: getMockDocument(),
    state: descriptorState.suspended,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  catalogService.archiveDescriptor = vi.fn().mockResolvedValue({});

  const makeRequest = async (
    token: string,
    eServiceId: string,
    descriptorId: string
  ) =>
    request(api)
      .post(`/eservices/${eServiceId}/descriptors/${descriptorId}/archive`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 200 for user with role internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, mockEService.id, descriptor.id);

    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id, descriptor.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 for eserviceNotFound", async () => {
    catalogService.archiveDescriptor = vi
      .fn()
      .mockRejectedValue(eServiceNotFound(mockEService.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockEService.id, descriptor.id);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for eServiceDescriptorNotFound", async () => {
    catalogService.archiveDescriptor = vi
      .fn()
      .mockRejectedValue(
        eServiceDescriptorNotFound(mockEService.id, descriptor.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockEService.id, descriptor.id);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for operationForbidden", async () => {
    catalogService.archiveDescriptor = vi
      .fn()
      .mockRejectedValue(operationForbidden);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockEService.id, descriptor.id);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid", "invalid");
    expect(res.status).toBe(400);
  });
});
