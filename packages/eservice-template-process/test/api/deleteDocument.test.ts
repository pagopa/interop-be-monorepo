/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  Document,
  EServiceDocumentId,
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
  eserviceTemplateDocumentNotFound,
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  notValidEServiceTemplateVersionState,
} from "../../src/model/domain/errors.js";
import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";

describe("API DELETE /templates/:templateId/versions/:templateVersionId/documents/:documentId", () => {
  const templateId = generateId<EServiceTemplateId>();
  const templateVersionId = generateId<EServiceTemplateVersionId>();
  const documentId = generateId<EServiceDocumentId>();

  const document: Document = getMockDocument();

  const mockVersion = {
    ...getMockEServiceTemplateVersion(),
    docs: [document],
  };

  const eserviceTemplate: EServiceTemplate = {
    ...getMockEServiceTemplate(),
    versions: [mockVersion],
  };

  const apiEServiceTemplate = eserviceTemplateApi.EServiceTemplate.parse(
    eserviceTemplateToApiEServiceTemplate(eserviceTemplate)
  );

  const serviceResponse = getMockWithMetadata(eserviceTemplate);

  eserviceTemplateService.deleteDocument = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    tempId: EServiceTemplateId = templateId,
    tempVersionId: EServiceTemplateVersionId = templateVersionId,
    docId: EServiceDocumentId = documentId
  ) =>
    request(api)
      .delete(
        `/templates/${tempId}/versions/${tempVersionId}/documents/${docId}`
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
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEServiceTemplate);
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
      error: eserviceTemplateNotFound(templateId),
      expectedStatus: 404,
    },
    {
      error: eserviceTemplateVersionNotFound(templateId, templateVersionId),
      expectedStatus: 404,
    },
    {
      error: eserviceTemplateDocumentNotFound(
        templateId,
        templateVersionId,
        documentId
      ),
      expectedStatus: 404,
    },
    {
      error: notValidEServiceTemplateVersionState(
        templateVersionId,
        eserviceTemplateVersionState.draft
      ),
      expectedStatus: 400,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.deleteDocument = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {
      templateId: "invalidId",
      templateVersionId,
    },
    {
      templateId,
      templateVersionId: "invalidId",
    },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ templateId, templateVersionId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        templateId as EServiceTemplateId,
        templateVersionId as EServiceTemplateVersionId
      );

      expect(res.status).toBe(400);
    }
  );
});
