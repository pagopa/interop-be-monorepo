/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Descriptor,
  DescriptorId,
  descriptorState,
  EService,
  EServiceDocumentId,
  EServiceId,
  generateId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";

import {
  eServiceDescriptorNotFound,
  eServiceDocumentNotFound,
  eServiceNotFound,
} from "../../src/model/domain/errors.js";

describe("API /internal/templates/eservices/{eServiceId}/descriptors/{descriptorId}/documents/{documentId}/update authorization test", () => {
  const mockDocument = getMockDocument();

  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    interface: mockDocument,
    state: descriptorState.published,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  catalogService.innerUpdateTemplateInstanceDescriptorDocument = vi
    .fn()
    .mockResolvedValue({});

  const mockUpdateEServiceDescriptorDocumentSeed: catalogApi.UpdateEServiceDescriptorDocumentSeed =
    { prettyName: "updated prettyName" };

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId,
    documentId: EServiceDocumentId,
    body: catalogApi.UpdateEServiceDescriptorDocumentSeed = mockUpdateEServiceDescriptorDocumentSeed
  ) =>
    request(api)
      .post(
        `/internal/templates/eservices/${eServiceId}/descriptors/${descriptorId}/documents/${documentId}/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(
      token,
      mockEService.id,
      descriptor.id,
      mockDocument.id
    );
    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      mockEService.id,
      descriptor.id,
      mockDocument.id
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
      error: eServiceDocumentNotFound(
        mockEService.id,
        descriptor.id,
        mockDocument.id
      ),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.innerUpdateTemplateInstanceDescriptorDocument = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(
        token,
        mockEService.id,
        descriptor.id,
        mockDocument.id
      );

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEService.id, descriptor.id, mockDocument.id],
    [{ prettyName: 123 }, mockEService.id, descriptor.id, mockDocument.id],
    [
      { ...mockUpdateEServiceDescriptorDocumentSeed },
      "invalidId",
      descriptor.id,
      mockDocument.id,
    ],
    [
      { ...mockUpdateEServiceDescriptorDocumentSeed },
      mockEService.id,
      "invalidId",
      mockDocument.id,
    ],
    [
      { ...mockUpdateEServiceDescriptorDocumentSeed },
      mockEService.id,
      descriptor.id,
      "invalidId",
    ],
  ])(
    "Should return 400 if passed invalid params: %s (eServiceId: %s, descriptorId: %s, documentId: %s)",
    async (body, eServiceId, descriptorId, documentId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        descriptorId as DescriptorId,
        documentId as EServiceDocumentId,
        body as catalogApi.UpdateEServiceDescriptorDocumentSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
