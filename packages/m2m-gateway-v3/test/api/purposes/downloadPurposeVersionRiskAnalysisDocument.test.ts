import { describe, it, expect, vi } from "vitest";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  purposeVersionDocumentNotFound,
  purposeVersionNotFound,
} from "../../../src/model/errors.js";
import { getMockDownloadedDocument } from "../../mockUtils.js";
import {
  testExpectedMultipartResponse,
  testMultipartResponseParser,
} from "../../multipartTestUtils.js";

describe("GET /purposes/:purposeId/versions/:versionId/document router test", () => {
  const mockDownloadedDocument = getMockDownloadedDocument();

  const makeRequest = async (
    token: string,
    purposeId: string,
    versionId: string
  ) =>
    request(api)
      .get(
        `${appBasePath}/purposes/${purposeId}/versions/${versionId}/riskAnalysisDocument`
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
      mockPurposeService.downloadPurposeVersionRiskAnalysisDocument = vi
        .fn()
        .mockResolvedValue(mockDownloadedDocument);

      const token = generateToken(role);
      const res = await makeRequest(token, generateId(), generateId());

      expect(res.status).toBe(200);
      await testExpectedMultipartResponse(mockDownloadedDocument, res);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), generateId());
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidId", generateId());

    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid version id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), "invalidId");

    expect(res.status).toBe(400);
  });

  it.each([
    purposeVersionNotFound(generateId(), generateId()),
    purposeVersionDocumentNotFound(generateId(), generateId()),
  ])("Should return 404 in case of $code error", async (error) => {
    mockPurposeService.downloadPurposeVersionRiskAnalysisDocument = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), generateId());

    expect(res.status).toBe(404);
  });
});
