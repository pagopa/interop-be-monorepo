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
} from "pagopa-interop-models";
import {
  generateToken,
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import {
  eServiceDescriptorNotFound,
  eServiceNotFound,
} from "../../src/model/domain/errors.js";

describe("API /internal/templates/eservices/{eServiceId}/descriptors/{descriptorId}/voucherLifespan/update authorization test", () => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  catalogService.internalUpdateTemplateInstanceDescriptorVoucherLifespan = vi
    .fn()
    .mockResolvedValue({});

  const mockEServiceDescriptorVoucherLifespanUpdateSeed: catalogApi.EServiceDescriptorVoucherLifespanUpdateSeed =
    {
      voucherLifespan: 1000,
    };

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId,
    body: catalogApi.EServiceDescriptorVoucherLifespanUpdateSeed = mockEServiceDescriptorVoucherLifespanUpdateSeed
  ) =>
    request(api)
      .post(
        `/internal/templates/eservices/${eServiceId}/descriptors/${descriptorId}/voucherLifespan/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role internal", async () => {
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
      error: eServiceNotFound(mockEService.id),
      expectedStatus: 404,
    },
    {
      error: eServiceDescriptorNotFound(mockEService.id, descriptor.id),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.internalUpdateTemplateInstanceDescriptorVoucherLifespan =
        vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token, mockEService.id, descriptor.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEService.id, descriptor.id],
    [{ voucherLifespan: "" }, mockEService.id, descriptor.id],
    [
      { ...mockEServiceDescriptorVoucherLifespanUpdateSeed },
      "invalidId",
      descriptor.id,
    ],
    [
      { ...mockEServiceDescriptorVoucherLifespanUpdateSeed },
      mockEService.id,
      "invalidId",
    ],
  ])(
    "Should return 400 if passed invalid params: %s (eServiceId: %s, descriptorId: %s)",
    async (body, eServiceId, descriptorId) => {
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        descriptorId as DescriptorId,
        body as catalogApi.EServiceDescriptorVoucherLifespanUpdateSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
