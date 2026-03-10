import { describe, it, expect, vi } from "vitest";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import {
  AuthRole,
  authRole,
  calculateIntegrityRest02DigestFromBody,
  IntegrityRest02SignedHeaders,
} from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockDownloadedDocument } from "../../mockUtils.js";
import {
  testExpectedMultipartResponse,
  testMultipartResponseParser,
} from "../../multipartTestUtils.js";
import { api, mockAgreementService } from "../../vitest.api.setup.js";
import { agreementContractNotFound } from "../../../src/model/errors.js";

function decodeJwtPayload(token: string): { [k: string]: unknown } {
  const [, payload] = token.split(".");

  if (!payload) {
    throw new Error("Invalid JWT structure");
  }

  const decoded = Buffer.from(payload, "base64url").toString("utf8");

  return JSON.parse(decoded);
}

describe("GET /agreements/:agreementId/contract router test", () => {
  const mockDownloadedDoc = getMockDownloadedDocument();

  const makeRequest = async (token: string, agreementId: string) =>
    request(api)
      .get(`${appBasePath}/agreements/${agreementId}/contract`)
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
      mockAgreementService.downloadAgreementConsumerContract = vi
        .fn()
        .mockResolvedValue(mockDownloadedDoc);

      const token = generateToken(role);
      const res = await makeRequest(token, generateId());

      expect(res.status).toBe(200);
      await testExpectedMultipartResponse(mockDownloadedDoc, res);
      // Test Integrity Rest 02 headers
      expect(res.headers).toHaveProperty("digest");
      expect(res.headers).toHaveProperty("agid-jwt-signature");
      const digest = res.headers.digest;
      const calcDigest = calculateIntegrityRest02DigestFromBody({
        body: res.text,
      });
      expect(digest).toBe(`SHA-256=${calcDigest}`);
      const signedHeadersRaw = decodeJwtPayload(
        res.headers["agid-jwt-signature"]
      ).signed_headers;
      const signedHeadersParse =
        IntegrityRest02SignedHeaders.safeParse(signedHeadersRaw);
      expect(signedHeadersParse.success).toBe(true);
      const signedHeaders = signedHeadersParse.data;
      expect(signedHeaders).toHaveLength(2);
      expect(signedHeaders).toContainEqual({ digest: `SHA-256=${calcDigest}` });
      expect(signedHeaders).toContainEqual({
        "content-type": res.headers["content-type"],
      });
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId());
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid agreement id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidId");

    expect(res.status).toBe(400);
  });

  it("Should return 404 if the agreement contract is not found", async () => {
    mockAgreementService.downloadAgreementConsumerContract = vi
      .fn()
      .mockRejectedValue(agreementContractNotFound(generateId()));

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId());

    expect(res.status).toBe(404);
  });
});
