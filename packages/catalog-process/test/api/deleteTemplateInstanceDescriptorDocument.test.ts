/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockDescriptor,
  getMockEService,
  getMockDocument,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  DescriptorId,
  descriptorState,
  Document,
  EService,
  EServiceDocumentId,
  EServiceId,
  generateId,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import {
  eServiceDescriptorNotFound,
  eServiceNotFound,
} from "../../src/model/domain/errors.js";
import { api, catalogService } from "../setup/apiSetup.js";

describe("API /internal/templates/eservices/{eServiceId}/descriptors/{descriptorId}/documents/{documentId}/update authorization test", () => {
  const document: Document = getMockDocument();

  const descriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
    docs: [document],
  };
  const eservice: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  catalogService.internalDeleteTemplateInstanceDescriptorDocument = vi
    .fn()
    .mockResolvedValue({});

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId,
    documentId: EServiceDocumentId
  ) =>
    request(api)
      .delete(
        `/internal/templates/eservices/${eServiceId}/descriptors/${descriptorId}/documents/${documentId}/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 204 for user with role Internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(
      token,
      eservice.id,
      descriptor.id,
      document.id
    );
    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      eservice.id,
      descriptor.id,
      document.id
    );
    expect(res.status).toBe(403);
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
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.internalDeleteTemplateInstanceDescriptorDocument = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(
        token,
        eservice.id,
        descriptor.id,
        document.id
      );

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    {
      eServiceId: "invalidId",
      descriptorId: descriptor.id,
      documentId: document.id,
    },
    {
      eServiceId: eservice.id,
      descriptorId: "invalidId",
      documentId: document.id,
    },
    {
      eServiceId: eservice.id,
      descriptorId: descriptor.id,
      documentId: "invalidId",
    },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ eServiceId, descriptorId, documentId }) => {
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        descriptorId as DescriptorId,
        documentId as EServiceDocumentId
      );

      expect(res.status).toBe(400);
    }
  );
});
