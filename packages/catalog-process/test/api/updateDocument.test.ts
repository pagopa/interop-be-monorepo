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
  operationForbidden,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import { documentToApiDocument } from "../../src/model/domain/apiConverter.js";
import {
  documentPrettyNameDuplicate,
  eServiceNotFound,
  eServiceDescriptorNotFound,
  eServiceDocumentNotFound,
  templateInstanceNotAllowed,
  notValidDescriptorState,
} from "../../src/model/domain/errors.js";

describe("API /eservices/{eServiceId}/descriptors/{descriptorId}/documents/{documentId}/update authorization test", () => {
  const mockDocument = getMockDocument();

  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    docs: [mockDocument],
    state: descriptorState.archived,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const apiDocument = catalogApi.EServiceDoc.parse(
    documentToApiDocument(mockDocument)
  );

  catalogService.updateDocument = vi.fn().mockResolvedValue(mockDocument);

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
        `/eservices/${eServiceId}/descriptors/${descriptorId}/documents/${documentId}/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockEService.id,
        descriptor.id,
        mockDocument.id
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
      mockEService.id,
      descriptor.id,
      mockDocument.id
    );

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: documentPrettyNameDuplicate("pretty name", descriptor.id),
      expectedStatus: 409,
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
      error: eServiceDocumentNotFound(
        mockEService.id,
        descriptor.id,
        mockDocument.id
      ),
      expectedStatus: 404,
    },
    {
      error: templateInstanceNotAllowed(
        mockEService.id,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        mockEService.templateId!
      ),
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
      catalogService.updateDocument = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
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
    "Should return 400 if passed invalid params: %s (eserviceId: %s, descriptorId: %s, documentId: %s)",
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
