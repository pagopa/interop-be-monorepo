/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
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
import {
  generateToken,
  getMockDescriptor,
  getMockEService,
  getMockDocument,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import { documentToApiDocument } from "../../src/model/domain/apiConverter.js";
import {
  eServiceDescriptorNotFound,
  eServiceDocumentNotFound,
  eServiceNotFound,
} from "../../src/model/domain/errors.js";

describe("API /eservices/{eServiceId}/descriptors/{descriptorId}/documents/{documentId} authorization test", () => {
  const document: Document = getMockDocument();

  const descriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
    docs: [document],
  };
  const eservice: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const apiDocument = catalogApi.EServiceDoc.parse(
    documentToApiDocument(document)
  );

  catalogService.getDocumentById = vi.fn().mockResolvedValue(document);

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId,
    documentId: EServiceDocumentId
  ) =>
    request(api)
      .get(
        `/eservices/${eServiceId}/descriptors/${descriptorId}/documents/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(
        token,
        eservice.id,
        descriptor.id,
        document.id
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiDocument);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
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
    {
      error: eServiceDocumentNotFound(eservice.id, descriptor.id, document.id),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.getDocumentById = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eservice.id,
        descriptor.id,
        document.id
      );

      expect(res.status).toBe(expectedStatus);
    }
  );
});
