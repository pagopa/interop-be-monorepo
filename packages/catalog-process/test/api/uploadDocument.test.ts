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
  operationForbidden,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import { buildInterfaceSeed } from "../mockUtils.js";
import { documentToApiDocument } from "../../src/model/domain/apiConverter.js";
import {
  checksumDuplicate,
  documentPrettyNameDuplicate,
  eServiceDescriptorNotFound,
  eServiceNotFound,
  interfaceAlreadyExists,
  notValidDescriptorState,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";

describe("API /eservices/{eServiceId}/descriptors/{descriptorId}/documents authorization test", () => {
  const document = getMockDocument();

  const descriptor: Descriptor = {
    ...getMockDescriptor(),
    docs: [document],
    state: descriptorState.archived,
  };

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [descriptor],
  };

  const apiDocument = catalogApi.EServiceDoc.parse(
    documentToApiDocument(document)
  );

  const serviceResponse = getMockWithMetadata(document);

  catalogService.uploadDocument = vi.fn().mockResolvedValue(serviceResponse);

  const mockCreateEServiceDescriptorDocumentSeed: catalogApi.CreateEServiceDescriptorDocumentSeed =
    buildInterfaceSeed();

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    descriptorId: DescriptorId,
    body: catalogApi.CreateEServiceDescriptorDocumentSeed = mockCreateEServiceDescriptorDocumentSeed
  ) =>
    request(api)
      .post(`/eservices/${eServiceId}/descriptors/${descriptorId}/documents`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockEService.id, descriptor.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiDocument);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id, descriptor.id);

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
      expectedStatus: 409,
    },
    {
      error: interfaceAlreadyExists(descriptor.id),
      expectedStatus: 409,
    },
    {
      error: checksumDuplicate(mockEService.id, descriptor.id),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.uploadDocument = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id, descriptor.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEService.id, descriptor.id],
    [
      { ...mockCreateEServiceDescriptorDocumentSeed, contentType: 123 },
      mockEService.id,
      descriptor.id,
    ],
    [
      { ...mockCreateEServiceDescriptorDocumentSeed, prettyName: null },
      mockEService.id,
      descriptor.id,
    ],
    [
      {
        ...mockCreateEServiceDescriptorDocumentSeed,
        serverUrls: "not-an-array",
      },
      mockEService.id,
      descriptor.id,
    ],
    [
      { ...mockCreateEServiceDescriptorDocumentSeed, documentId: 123 },
      mockEService.id,
      descriptor.id,
    ],
    [
      { ...mockCreateEServiceDescriptorDocumentSeed, kind: "INVALID_KIND" },
      mockEService.id,
      descriptor.id,
    ],
    [
      { ...mockCreateEServiceDescriptorDocumentSeed, filePath: 999 },
      mockEService.id,
      descriptor.id,
    ],
    [
      { ...mockCreateEServiceDescriptorDocumentSeed, fileName: false },
      mockEService.id,
      descriptor.id,
    ],
    [
      { ...mockCreateEServiceDescriptorDocumentSeed, checksum: undefined },
      mockEService.id,
      descriptor.id,
    ],
    [
      { ...mockCreateEServiceDescriptorDocumentSeed },
      "invalidId",
      descriptor.id,
    ],
    [
      { ...mockCreateEServiceDescriptorDocumentSeed },
      mockEService.id,
      "invalidId",
    ],
  ])(
    "Should return 400 if passed invalid document creation params: %s (eServiceId: %s, descriptorId: %s)",
    async (body, eServiceId, descriptorId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
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
