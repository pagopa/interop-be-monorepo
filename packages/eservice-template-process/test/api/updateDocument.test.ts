/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceDocumentId,
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
  eServiceTemplateNotFound,
  eServiceTemplateVersionNotFound,
  eserviceTemplateDocumentNotFound,
  notValidEServiceTemplateVersionState,
} from "../../src/model/domain/errors.js";

describe("API POST /templates/:templateId/versions/:templateVersionId/documents/:documentId/update", () => {
  const mockEserviceTemplate = getMockEServiceTemplate();
  const docId = generateId<EServiceDocumentId>();
  const mockSeed: eserviceTemplateApi.UpdateEServiceTemplateVersionDocumentSeed =
    { prettyName: "prettyName" };

  const makeRequest = async (
    token: string,
    seed: eserviceTemplateApi.UpdateEServiceTemplateVersionDocumentSeed = mockSeed,
    templateId: string = mockEserviceTemplate.id,
    templateVersionId: string = mockEserviceTemplate.versions[0].id,
    documentId: string = docId
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

  it("Should return 404 for eserviceTemplateNotFound", async () => {
    eserviceTemplateService.updateDocument = vi
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
    eserviceTemplateService.updateDocument = vi
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
    eserviceTemplateService.updateDocument = vi
      .fn()
      .mockRejectedValue(
        eserviceTemplateDocumentNotFound(
          mockEserviceTemplate.id,
          mockEserviceTemplate.versions[0].id,
          docId
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `Document ${docId} not found in version ${mockEserviceTemplate.versions[0].id} of template ${mockEserviceTemplate.id}`
    );
    expect(res.status).toBe(404);
  });

  it("Should return 403 for operationForbidden", async () => {
    eserviceTemplateService.updateDocument = vi
      .fn()
      .mockRejectedValue(operationForbidden);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe("Insufficient privileges");
    expect(res.status).toBe(403);
  });

  it("Should return 400 for notValidEServiceTemplateVersionState", async () => {
    eserviceTemplateService.updateDocument = vi
      .fn()
      .mockRejectedValue(
        notValidEServiceTemplateVersionState(
          mockEserviceTemplate.versions[0].id,
          eserviceTemplateVersionState.draft
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `EService template version ${mockEserviceTemplate.versions[0].id} has a not valid status for this operation ${eserviceTemplateVersionState.draft}`
    );
    expect(res.status).toBe(400);
  });

  it("Should return 409 for documentPrettyNameDuplicate", async () => {
    const documentName = "documentName";
    eserviceTemplateService.updateDocument = vi
      .fn()
      .mockRejectedValue(
        documentPrettyNameDuplicate(
          documentName,
          mockEserviceTemplate.versions[0].id
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `A document with prettyName ${documentName} already exists in version ${mockEserviceTemplate.versions[0].id}`
    );
    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed a not compliat query param", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockSeed, "111");
    expect(res.status).toBe(400);
  });
});
