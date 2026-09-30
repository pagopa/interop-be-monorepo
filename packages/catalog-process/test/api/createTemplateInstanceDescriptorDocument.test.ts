/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { catalogApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockDescriptor,
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
  eServiceDescriptorNotFound,
  eServiceNotFound,
} from "../../src/model/domain/errors.js";
import { buildDocumentSeed } from "../mockUtils.js";
import { api, catalogService } from "../vitest.api.setup.js";

describe("API /internal/templates/eservices/{eServiceId}/descriptors/{descriptorId}/documents/update authorization test", () => {
  const mockDescriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
    serverUrls: [],
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [mockDescriptor],
  };

  const documentSeed = buildDocumentSeed();

  catalogService.internalCreateTemplateInstanceDescriptorDocument = vi
    .fn()
    .mockResolvedValue({});

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId,
    body: catalogApi.CreateEServiceDescriptorDocumentSeed = documentSeed
  ) =>
    request(api)
      .post(
        `/internal/templates/eservices/${eServiceId}/descriptors/${descriptorId}/documents/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, mockEService.id, mockDescriptor.id);

    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id, mockDescriptor.id);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: eServiceDescriptorNotFound(mockEService.id, mockDescriptor.id),
      expectedStatus: 404,
    },
    {
      error: eServiceNotFound(mockEService.id),
      expectedStatus: 404,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.internalCreateTemplateInstanceDescriptorDocument = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token, mockEService.id, mockDescriptor.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEService.id, mockDescriptor.id],
    [{ ...documentSeed, contentType: 123 }, mockEService.id, mockDescriptor.id],
    [
      { ...documentSeed, serverUrls: "notAnArray" },
      mockEService.id,
      mockDescriptor.id,
    ],
    [
      { ...documentSeed, documentId: undefined },
      mockEService.id,
      mockDescriptor.id,
    ],
    [{ ...documentSeed }, "invalidId", mockDescriptor.id],
    [{ ...documentSeed }, mockEService.id, "invalidId"],
  ])(
    "Should return 400 if passed invalid document params: %s (eServiceId: %s, descriptorId: %s)",
    async (body, eServiceId, descriptorId) => {
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        descriptorId as DescriptorId,
        body as catalogApi.CreateEServiceDescriptorDocumentSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
