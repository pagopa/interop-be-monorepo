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
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import {
  eserviceTemplateDocumentNotFound,
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  notValidEServiceTemplateVersionState,
} from "../../src/model/domain/errors.js";

describe("API DELETE /templates/:templateId/versions/:templateVersionId/documents/:documentId", () => {
  const templateId = generateId<EServiceTemplateId>();
  const templateVersionId = generateId<EServiceTemplateVersionId>();
  const documentId = generateId<EServiceDocumentId>();

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

  beforeEach(() => {
    eserviceTemplateService.deleteDocument = vi
      .fn()
      .mockResolvedValue(undefined);
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
