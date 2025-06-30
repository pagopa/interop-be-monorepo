/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  generateId,
} from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  getMockBffApiUpdateEServiceDescriptorDocumentSeed,
  getMockCatalogApiEServiceDoc,
  toApiEServiceDoc,
} from "../../mockUtils.js";
import {
  eserviceDescriptorNotFound,
  eserviceRiskNotFound,
  invalidEServiceRequester,
} from "../../../src/model/errors.js";

describe("API POST /eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update", () => {
  const mockUpdateEServiceDescriptorDocumentSeed =
    getMockBffApiUpdateEServiceDescriptorDocumentSeed();
  const mockEServiceDoc = getMockCatalogApiEServiceDoc();
  const mockApiEServiceDoc = toApiEServiceDoc(mockEServiceDoc);

  beforeEach(() => {
    clients.catalogProcessClient.updateEServiceDocumentById = vi
      .fn()
      .mockResolvedValue(mockEServiceDoc);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId(),
    descriptorId: DescriptorId = generateId(),
    documentId: EServiceDocumentId = generateId(),
    body: bffApi.UpdateEServiceDescriptorDocumentSeed = mockUpdateEServiceDescriptorDocumentSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${eServiceId}/descriptors/${descriptorId}/documents/${documentId}/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiEServiceDoc);
  });

  it.each([
    {
      error: eserviceRiskNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
    {
      error: eserviceDescriptorNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
    {
      error: invalidEServiceRequester(generateId(), generateId()),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.catalogService.updateEServiceDocumentById = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { eServiceId: "invalid" as EServiceId },
    { descriptorId: "invalid" as DescriptorId },
    { documentId: "invalid" as EServiceDocumentId },
    { body: {} },
    { body: { ...mockUpdateEServiceDescriptorDocumentSeed, extraField: 1 } },
  ])(
    "Should return 400 if passed an invalid parameter",
    async ({ eServiceId, descriptorId, documentId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        descriptorId,
        documentId,
        body as bffApi.UpdateEServiceDescriptorDocumentSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
