/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { catalogApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken, getMockEService } from "pagopa-interop-commons-test";
import {
  DescriptorId,
  EService,
  EServiceId,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import {
  eServiceDescriptorNotFound,
  eServiceNotFound,
} from "../../src/model/domain/errors.js";
import { api, catalogService } from "../vitest.api.setup.js";

describe("API /internal/eservices/{eServiceId}/delegatedArchivingRequests/archive authorization test", () => {
  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [],
  };

  const mockSeed: catalogApi.InternalDeleteDelegatedArchivingRequestSeed = {};

  catalogService.internalDeleteDelegatedArchivingRequest = vi
    .fn()
    .mockResolvedValue(undefined);

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    body: catalogApi.InternalDeleteDelegatedArchivingRequestSeed = mockSeed
  ) =>
    request(api)
      .post(
        `/internal/eservices/${eServiceId}/delegatedArchivingRequests/archive`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, mockEService.id);

    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id);

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
      error: eServiceDescriptorNotFound(
        mockEService.id,
        generateId<DescriptorId>()
      ),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.internalDeleteDelegatedArchivingRequest = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token, mockEService.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{ ...mockSeed, descriptorId: "not-a-uuid" }, mockEService.id],
    [mockSeed, "invalidId"],
  ])(
    "Should return 400 if passed invalid params: %s",
    async (body, eServiceId) => {
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        body as catalogApi.InternalDeleteDelegatedArchivingRequestSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
