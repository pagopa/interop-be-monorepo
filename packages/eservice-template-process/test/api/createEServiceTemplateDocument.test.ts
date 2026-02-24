/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  eserviceTemplateVersionState,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import {
  checksumDuplicate,
  documentPrettyNameDuplicate,
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  interfaceAlreadyExists,
  notValidEServiceTemplateVersionState,
} from "../../src/model/domain/errors.js";
import { buildDocumentSeed } from "../mockUtils.js";
import { documentToApiDocument } from "../../src/model/domain/apiConverter.js";

describe("API POST /templates/:templateId/versions/:templateVersionId/documents", () => {
  const document = getMockDocument();
  const mockEserviceTemplate: EServiceTemplate = {
    ...getMockEServiceTemplate(),
    versions: [{ ...getMockEServiceTemplateVersion(), docs: [document] }],
  };

  const mockSeed: eserviceTemplateApi.CreateEServiceTemplateVersionDocumentSeed =
    buildDocumentSeed();
  const interfaceName = "interfaceName";
  const documentName = "documentName";

  const apiDocument = eserviceTemplateApi.EServiceDoc.parse(
    documentToApiDocument(document)
  );

  const serviceResponse = getMockWithMetadata(document);

  const makeRequest = async (
    token: string,
    seed: eserviceTemplateApi.CreateEServiceTemplateVersionDocumentSeed = mockSeed,
    templateId: EServiceTemplateId = mockEserviceTemplate.id,
    templateVersionId: EServiceTemplateVersionId = mockEserviceTemplate
      .versions[0].id
  ) =>
    request(api)
      .post(`/templates/${templateId}/versions/${templateVersionId}/documents`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(seed);

  beforeEach(() => {
    eserviceTemplateService.createEServiceTemplateDocument = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
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
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: eserviceTemplateNotFound(mockEserviceTemplate.id),
      expectedStatus: 404,
    },
    {
      error: eserviceTemplateVersionNotFound(
        mockEserviceTemplate.id,
        mockEserviceTemplate.versions[0].id
      ),
      expectedStatus: 404,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: interfaceAlreadyExists(interfaceName),
      expectedStatus: 400,
    },
    {
      error: documentPrettyNameDuplicate(
        documentName,
        mockEserviceTemplate.versions[0].id
      ),
      expectedStatus: 409,
    },
    {
      error: checksumDuplicate(
        mockEserviceTemplate.id,
        mockEserviceTemplate.versions[0].id
      ),
      expectedStatus: 409,
    },
    {
      error: notValidEServiceTemplateVersionState(
        mockEserviceTemplate.versions[0].id,
        eserviceTemplateVersionState.published
      ),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.createEServiceTemplateDocument = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {
      body: mockSeed,
      templateId: "invalidId",
      templateVersionId: mockEserviceTemplate.versions[0].id,
    },
    {
      body: mockSeed,
      templateId: mockEserviceTemplate.id,
      templateVersionId: "invalidId",
    },
    {
      body: { ...mockSeed, prettyName: 1 },
      templateId: mockEserviceTemplate.id,
      templateVersionId: mockEserviceTemplate.versions[0].id,
    },
    {
      body: { ...mockSeed, kind: "NOT_VALID" },
      templateId: mockEserviceTemplate.id,
      templateVersionId: mockEserviceTemplate.versions[0].id,
    },
  ])(
    "Should return 400 if passed invalid body: %s",
    async ({ body, templateId, templateVersionId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        body as eserviceTemplateApi.CreateEServiceTemplateVersionDocumentSeed,
        templateId as EServiceTemplateId,
        templateVersionId as EServiceTemplateVersionId
      );

      expect(res.status).toBe(400);
    }
  );
});
