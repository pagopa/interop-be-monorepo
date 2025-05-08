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
  eServiceTemplateNotFound,
  eServiceTemplateVersionNotFound,
  eserviceTemplateDocumentNotFound,
  notValidEServiceTemplateVersionState,
} from "../../src/model/domain/errors.js";

describe("API DELETE /templates/:templateId/versions/:templateVersionId/documents/:documentId", () => {
  const templateId = generateId<EServiceTemplateId>();
  const templateVersionId = generateId<EServiceTemplateVersionId>();
  const documentId = generateId<EServiceDocumentId>();

  const makeRequest = async (
    token: string,
    tempId: string = templateId,
    tempVersionId: string = templateVersionId,
    docId: string = documentId
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

  it("Should return 404 for eserviceTemplateNotFound", async () => {
    eserviceTemplateService.deleteDocument = vi
      .fn()
      .mockRejectedValue(eServiceTemplateNotFound(templateId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(`EService Template ${templateId} not found`);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for eserviceTemplateVersionNotFound", async () => {
    eserviceTemplateService.deleteDocument = vi
      .fn()
      .mockRejectedValue(
        eServiceTemplateVersionNotFound(templateId, templateVersionId)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `EService Template ${templateId} version ${templateVersionId} not found`
    );
    expect(res.status).toBe(404);
  });

  it("Should return 404 for eserviceTemplateDocumentNotFound", async () => {
    eserviceTemplateService.deleteDocument = vi
      .fn()
      .mockRejectedValue(
        eserviceTemplateDocumentNotFound(
          templateId,
          templateVersionId,
          documentId
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `Document ${documentId} not found in version ${templateVersionId} of template ${templateId}`
    );
    expect(res.status).toBe(404);
  });

  it("Should return 403 for operationForbidden", async () => {
    eserviceTemplateService.deleteDocument = vi
      .fn()
      .mockRejectedValue(operationForbidden);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe("Insufficient privileges");
    expect(res.status).toBe(403);
  });

  it("Should return 400 for notValidEServiceTemplateVersionState", async () => {
    eserviceTemplateService.deleteDocument = vi
      .fn()
      .mockRejectedValue(
        notValidEServiceTemplateVersionState(
          templateVersionId,
          eserviceTemplateVersionState.draft
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `EService template version ${templateVersionId} has a not valid status for this operation ${eserviceTemplateVersionState.draft}`
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed a not compliat query param", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "111");
    expect(res.status).toBe(400);
  });
});
