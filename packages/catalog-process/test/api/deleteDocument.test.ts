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
  operationForbidden,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockDescriptor,
  getMockEService,
  getMockDocument,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import {
  eServiceDescriptorNotFound,
  eServiceDocumentNotFound,
  eServiceNotFound,
  notValidDescriptorState,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";

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

  const apiEService = catalogApi.EService.parse(
    eServiceToApiEService(eservice)
  );

  const serviceResponse = getMockWithMetadata(eservice);

  catalogService.deleteDocument = vi.fn().mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId,
    documentId: EServiceDocumentId
  ) =>
    request(api)
      .delete(
        `/eservices/${eServiceId}/descriptors/${descriptorId}/documents/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(
        token,
        eservice.id,
        descriptor.id,
        document.id
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEService);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
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
    {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      error: templateInstanceNotAllowed(eservice.id, eservice.templateId!),
      expectedStatus: 403,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: notValidDescriptorState(descriptor.id, descriptor.state),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.deleteDocument = vi.fn().mockRejectedValue(error);

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
      const token = generateToken(authRole.ADMIN_ROLE);
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
