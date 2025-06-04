/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  generateId,
  RiskAnalysisId,
  TenantId,
} from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
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
  const mockEServiceId = generateId<EServiceId>();
  const mockDescriptorId = generateId<DescriptorId>();
  const mockDocumentId = generateId<EServiceDocumentId>();
  const mockUpdateEServiceDescriptorDocumentSeed =
    getMockBffApiUpdateEServiceDescriptorDocumentSeed();
  const mockEServiceDoc = getMockCatalogApiEServiceDoc();
  const mockApiEServiceDoc = toApiEServiceDoc(mockEServiceDoc);

  const makeRequest = async (
    token: string,
    descriptorId: unknown = mockDescriptorId
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${mockEServiceId}/descriptors/${descriptorId}/documents/${mockDocumentId}/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockUpdateEServiceDescriptorDocumentSeed);

  beforeEach(() => {
    clients.catalogProcessClient.updateEServiceDocumentById = vi
      .fn()
      .mockResolvedValue(mockEServiceDoc);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiEServiceDoc);
  });

  it.each([
    {
      error: eserviceRiskNotFound(mockEServiceId, generateId<RiskAnalysisId>()),
      expectedStatus: 404,
    },
    {
      error: eserviceDescriptorNotFound(mockEServiceId, mockDescriptorId),
      expectedStatus: 404,
    },
    {
      error: invalidEServiceRequester(mockEServiceId, generateId<TenantId>()),
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

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
