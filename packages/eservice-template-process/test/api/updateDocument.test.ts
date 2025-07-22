/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceDocumentId,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  eserviceTemplateVersionState,
  generateId,
  operationForbidden,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import {
  documentPrettyNameDuplicate,
  eserviceTemplateDocumentNotFound,
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  notValidEServiceTemplateVersionState,
} from "../../src/model/domain/errors.js";

describe("API POST /templates/:templateId/versions/:templateVersionId/documents/:documentId/update", () => {
  const mockEserviceTemplate = getMockEServiceTemplate();
  const docId = generateId<EServiceDocumentId>();
  const mockSeed: eserviceTemplateApi.UpdateEServiceTemplateVersionDocumentSeed =
    { prettyName: "prettyName" };
  const documentName = "documentName";

  const makeRequest = async (
    token: string,
    seed: eserviceTemplateApi.UpdateEServiceTemplateVersionDocumentSeed = mockSeed,
    templateId: EServiceTemplateId = mockEserviceTemplate.id,
    templateVersionId: EServiceTemplateVersionId = mockEserviceTemplate
      .versions[0].id,
    documentId: EServiceDocumentId = docId
  ) =>
    request(api)
      .post(
        `/templates/${templateId}/versions/${templateVersionId}/documents/${documentId}/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(seed);

  beforeEach(() => {
    eserviceTemplateService.updateDocument = vi
      .fn()
      .mockResolvedValue(mockEserviceTemplate);
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(204);
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
      error: eserviceTemplateVersionNotFound(
        mockEserviceTemplate.id,
        mockEserviceTemplate.versions[0].id
      ),
      expectedStatus: 404,
    },
    {
      error: eserviceTemplateDocumentNotFound(
        mockEserviceTemplate.id,
        mockEserviceTemplate.versions[0].id,
        docId
      ),
      expectedStatus: 404,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: notValidEServiceTemplateVersionState(
        mockEserviceTemplate.versions[0].id,
        eserviceTemplateVersionState.draft
      ),
      expectedStatus: 400,
    },
    {
      error: documentPrettyNameDuplicate(
        documentName,
        mockEserviceTemplate.versions[0].id
      ),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.updateDocument = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {
      templateId: "invalidId",
      templateVersionId: mockEserviceTemplate.versions[0].id,
      documentId: docId,
      seed: mockSeed,
    },
    {
      templateId: mockEserviceTemplate.id,
      templateVersionId: "invalidId",
      documentId: docId,
      seed: mockSeed,
    },
    {
      templateId: mockEserviceTemplate.id,
      templateVersionId: mockEserviceTemplate.versions[0].id,
      documentId: "invalidId",
      seed: mockSeed,
    },
    {
      templateId: mockEserviceTemplate.id,
      templateVersionId: mockEserviceTemplate.versions[0].id,
      documentId: "invalidId",
      seed: {},
    },
    {
      templateId: mockEserviceTemplate.id,
      templateVersionId: mockEserviceTemplate.versions[0].id,
      documentId: "invalidId",
      seed: { prettyName: 1 },
    },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ templateId, templateVersionId, documentId, seed }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        seed as eserviceTemplateApi.UpdateEServiceTemplateVersionDocumentSeed,
        templateId as EServiceTemplateId,
        templateVersionId as EServiceTemplateVersionId,
        documentId as EServiceDocumentId
      );

      expect(res.status).toBe(400);
    }
  );
});
