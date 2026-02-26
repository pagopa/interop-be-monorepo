import { describe, it, expect, vi } from "vitest";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("DELETE /eserviceTemplates/:templateId/versions/:versionId/documents/:documentId router test", () => {
  const templateId = generateId();
  const versionId = generateId();
  const documentId = generateId();

  const makeRequest = async (
    token: string,
    templateId: string,
    versionId: string,
    documentId: string
  ) =>
    request(api)
      .delete(
        `${appBasePath}/eserviceTemplates/${templateId}/versions/${versionId}/documents/${documentId}`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEServiceTemplateService.deleteEServiceTemplateVersionDocument = vi
        .fn()
        .mockResolvedValue(undefined);
      const token = generateToken(role);
      const res = await makeRequest(token, templateId, versionId, documentId);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
      expect(
        mockEServiceTemplateService.deleteEServiceTemplateVersionDocument
      ).toHaveBeenCalledWith(
        templateId,
        versionId,
        documentId,
        expect.any(Object)
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, templateId, versionId, documentId);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for incorrect value for eservice template id", async () => {
    mockEServiceTemplateService.deleteEServiceTemplateVersionDocument = vi
      .fn()
      .mockResolvedValue(undefined);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "INVALID ID", versionId, documentId);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for version id", async () => {
    mockEServiceTemplateService.deleteEServiceTemplateVersionDocument = vi
      .fn()
      .mockResolvedValue(undefined);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, templateId, "INVALID ID", documentId);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for document id", async () => {
    mockEServiceTemplateService.deleteEServiceTemplateVersionDocument = vi
      .fn()
      .mockResolvedValue(undefined);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, templateId, versionId, "INVALID ID");
    expect(res.status).toBe(400);
  });
});
