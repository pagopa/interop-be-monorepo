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
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import {
  eServiceTemplateNotFound,
  eServiceTemplateVersionNotFound,
  eserviceTemplateDocumentNotFound,
} from "../../src/model/domain/errors.js";

describe("API GET /templates/:templateId/versions/:templateVersionId/documents/:documentId", () => {
  const mockEserviceTemplate = getMockEServiceTemplate();
  const doc = getMockDocument();

  const makeRequest = async (
    token: string,
    templateId: string = mockEserviceTemplate.id,
    templateVersionId: string = mockEserviceTemplate.versions[0].id,
    documentId: string = doc.id
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

  it("Should return 404 for eserviceTemplateNotFound", async () => {
    eserviceTemplateService.getEServiceTemplateDocument = vi
      .fn()
      .mockRejectedValue(eServiceTemplateNotFound(mockEserviceTemplate.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `EService Template ${mockEserviceTemplate.id} not found`
    );
    expect(res.status).toBe(404);
  });

  it("Should return 404 for eserviceTemplateVersionNotFound", async () => {
    eserviceTemplateService.getEServiceTemplateDocument = vi
      .fn()
      .mockRejectedValue(
        eServiceTemplateVersionNotFound(
          mockEserviceTemplate.id,
          mockEserviceTemplate.versions[0].id
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `EService Template ${mockEserviceTemplate.id} version ${mockEserviceTemplate.versions[0].id} not found`
    );
    expect(res.status).toBe(404);
  });

  it("Should return 404 for eserviceTemplateDocumentNotFound", async () => {
    eserviceTemplateService.getEServiceTemplateDocument = vi
      .fn()
      .mockRejectedValue(
        eserviceTemplateDocumentNotFound(
          mockEserviceTemplate.id,
          mockEserviceTemplate.versions[0].id,
          doc.id
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `Document ${doc.id} not found in version ${mockEserviceTemplate.versions[0].id} of template ${mockEserviceTemplate.id}`
    );
    expect(res.status).toBe(404);
  });

  it("Should return 403 for operationForbidden", async () => {
    eserviceTemplateService.getEServiceTemplateDocument = vi
      .fn()
      .mockRejectedValue(operationForbidden);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe("Insufficient privileges");
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed a not compliat query param", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "111");
    expect(res.status).toBe(400);
  });
});
