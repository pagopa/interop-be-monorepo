/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId, operationForbidden } from "pagopa-interop-models";
import {
  generateToken,
  getMockDocument,
  getMockEServiceTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import {
  EServiceDocumentId,
  EServiceTemplateId,
  EServiceTemplateVersionId,
} from "pagopa-interop-models";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import {
  eserviceTemplateDocumentNotFound,
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
} from "../../src/model/domain/errors.js";

describe("API GET /templates/:templateId/versions/:templateVersionId/documents/:documentId", () => {
  const mockEserviceTemplate = getMockEServiceTemplate();
  const doc = getMockDocument();

  const makeRequest = async (
    token: string,
    templateId: EServiceTemplateId = mockEserviceTemplate.id,
    templateVersionId: EServiceTemplateVersionId = mockEserviceTemplate
      .versions[0].id,
    documentId: EServiceDocumentId = doc.id
  ) =>
    request(api)
      .get(
        `/templates/${templateId}/versions/${templateVersionId}/documents/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  beforeEach(() => {
    eserviceTemplateService.getEServiceTemplateDocument = vi
      .fn()
      .mockResolvedValue(doc);
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.body).toEqual({
        ...doc,
        uploadDate: doc.uploadDate.toISOString(),
      });
      expect(res.status).toBe(200);
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
      error: eserviceTemplateDocumentNotFound(
        mockEserviceTemplate.id,
        mockEserviceTemplate.versions[0].id,
        doc.id
      ),
      expectedStatus: 404,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      eserviceTemplateService.getEServiceTemplateDocument = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {
      templateId: "invalidId",
      templateVersionId: mockEserviceTemplate.versions[0].id,
      documentId: doc.id,
    },
    {
      templateId: mockEserviceTemplate.id,
      templateVersionId: "invalidId",
      documentId: doc.id,
    },
    {
      templateId: mockEserviceTemplate.id,
      templateVersionId: mockEserviceTemplate.versions[0].id,
      documentId: "invalidId",
    },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ templateId, templateVersionId, documentId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        templateId as EServiceTemplateId,
        templateVersionId as EServiceTemplateVersionId,
        documentId as EServiceDocumentId
      );

      expect(res.status).toBe(400);
    }
  );
});
