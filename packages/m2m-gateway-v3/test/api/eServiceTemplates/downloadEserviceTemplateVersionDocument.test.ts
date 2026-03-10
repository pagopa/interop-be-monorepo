import { describe, it, expect, vi } from "vitest";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockDownloadedDocument } from "../../mockUtils.js";
import {
  testExpectedMultipartResponse,
  testMultipartResponseParser,
} from "../../multipartTestUtils.js";

describe("GET /eserviceTemplates/:templateId/versions/:versionId/documents/:documentId router test", () => {
  const mockDownloadedDoc = getMockDownloadedDocument();

  const makeRequest = async (
    token: string,
    templateId: string,
    versionId: string,
    documentId: string
  ) =>
    request(api)
      .get(
        `${appBasePath}/eserviceTemplates/${templateId}/versions/${versionId}/documents/${documentId}`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .buffer(true)
      .parse(testMultipartResponseParser);

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEServiceTemplateService.downloadEServiceTemplateVersionDocument = vi
        .fn()
        .mockResolvedValue(mockDownloadedDoc);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        generateId(),
        generateId(),
        generateId()
      );

      expect(res.status).toBe(200);
      await testExpectedMultipartResponse(mockDownloadedDoc, res);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      generateId()
    );
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid eservice template id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      "invalidId",
      generateId(),
      generateId()
    );

    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid version id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      "invalidId",
      generateId()
    );

    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid document id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      "invalidId"
    );

    expect(res.status).toBe(400);
  });
});
