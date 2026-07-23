/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { catalogApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  DescriptorId,
  descriptorState,
  EService,
  EServiceId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  descriptorAlreadyArchived,
} from "../../src/model/domain/errors.js";
import { api, catalogService } from "../setup/apiSetup.js";

describe("API /internal/eservices/{eServiceId}/descriptors/{descriptorId}/archive authorization test", () => {
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
    eServiceId: EServiceId,
    descriptorId: DescriptorId,
    body: catalogApi.ArchivingKindSeed = { kind: "AUTOMATIC" }
  ) =>
    request(api)
      .post(
        `/internal/eservices/${eServiceId}/descriptors/${descriptorId}/archive`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

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
      error: descriptorAlreadyArchived(descriptor.id),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.archiveDescriptor = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token, mockEService.id, descriptor.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEService.id, descriptor.id],
    [{ kind: "AUTOMATIC" }, "invalidId", descriptor.id],
    [{ kind: "AUTOMATIC" }, mockEService.id, "invalidId"],
    [{ kind: "INVALID_KIND" }, mockEService.id, descriptor.id],
  ])(
    "Should return 400 if passed invalid params: %s",
    async (body, eServiceId, descriptorId) => {
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        descriptorId as DescriptorId,
        body as catalogApi.ArchivingKindSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
