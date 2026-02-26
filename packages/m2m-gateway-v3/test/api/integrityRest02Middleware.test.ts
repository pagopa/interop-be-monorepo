/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockedApiAttribute,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import {
  authRole,
  genericLogger,
  calculateIntegrityRest02DigestFromBody,
  IntegrityRest02SignedHeaders,
} from "pagopa-interop-commons";
import request from "supertest";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import {
  api,
  mockAttributeService,
  mockClientService,
} from "../vitest.api.setup.js";
import { appBasePath } from "../../src/config/appBasePath.js";
import { toM2MGatewayApiCertifiedAttribute } from "../../src/api/attributeApiConverter.js";

function decodeJwtPayload(token: string): { [k: string]: unknown } {
  const [, payload] = token.split(".");

  if (!payload) {
    throw new Error("Invalid JWT structure");
  }

  const decoded = Buffer.from(payload, "base64url").toString("utf8");

  return JSON.parse(decoded);
}

describe("integrityRest02Middleware", () => {
  const makeRequest = async (token: string) =>
    request(api)
      .get(`${appBasePath}/certifiedAttributes/${generateId()}`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send();
  // ^ using GET /certifiedAttributes/:attributeId as a dummy endpoint to test the middleware

  mockAttributeService.getCertifiedAttribute = vi.fn().mockResolvedValue(
    toM2MGatewayApiCertifiedAttribute({
      attribute: getMockedApiAttribute({
        kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
      }),
      logger: genericLogger,
    })
  );

  mockClientService.removeClientPurpose = vi.fn();

  it("Should correctly set digest and agid-jwt-signature headers", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(200);
    const digest = calculateIntegrityRest02DigestFromBody({ body: res.text });
    expect(res.headers).toHaveProperty("digest");
    expect(res.headers.digest).toBe(`SHA-256=${digest}`);
    expect(res.headers).toHaveProperty("agid-jwt-signature");
    const decoded = decodeJwtPayload(res.headers["agid-jwt-signature"]);
    const correlationId = res.headers["x-correlation-id"];
    expect(decoded).toHaveProperty("sub");
    expect(decoded.sub).toBe(correlationId);
    expect(decoded).toHaveProperty("signed_headers");

    const signedHeadersParse = IntegrityRest02SignedHeaders.safeParse(
      decoded.signed_headers
    );
    expect(signedHeadersParse.success).toBe(true);
    const signedHeaders = signedHeadersParse.data;
    expect(signedHeaders).toHaveLength(2);
    expect(signedHeaders).toContainEqual({ digest: `SHA-256=${digest}` });
    expect(signedHeaders).toContainEqual({
      "content-type": res.headers["content-type"],
    });
  });

  it("Should return same digest with the same body", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);
    const res2 = await makeRequest(token);
    expect(res2.status).toBe(200);
    expect(res2.headers.digest).toBe(res.headers.digest);
    expect(res.text).toBe(res2.text);
    const digest = calculateIntegrityRest02DigestFromBody({ body: res.text });
    expect(res.headers.digest).toBe(`SHA-256=${digest}`);
    expect(res2.headers.digest).toBe(`SHA-256=${digest}`);

    const decoded1 = decodeJwtPayload(res.headers["agid-jwt-signature"]);
    expect(decoded1).toHaveProperty("signed_headers");
    const decoded2 = decodeJwtPayload(res2.headers["agid-jwt-signature"]);
    expect(decoded2).toHaveProperty("signed_headers");
    const correlationId1 = res.headers["x-correlation-id"];
    const correlationId2 = res2.headers["x-correlation-id"];

    expect(decoded1.signed_headers).toEqual(decoded2.signed_headers);
    expect(decoded1.sub).toBe(correlationId1);
    expect(decoded2.sub).toBe(correlationId2);
    expect({
      ...decoded1,
      jti: undefined,
      exp: undefined,
      nbf: undefined,
      iat: undefined,
      sub: undefined,
    }).toStrictEqual({
      ...decoded2,
      jti: undefined,
      exp: undefined,
      nbf: undefined,
      iat: undefined,
      sub: undefined,
    });

    const signedHeadersParse1 = IntegrityRest02SignedHeaders.safeParse(
      decoded1.signed_headers
    );
    const signedHeadersParse2 = IntegrityRest02SignedHeaders.safeParse(
      decoded2.signed_headers
    );

    expect(signedHeadersParse1.success).toBe(true);
    expect(signedHeadersParse2.success).toBe(true);

    const signedHeaders1 = signedHeadersParse1.data;
    const signedHeaders2 = signedHeadersParse2.data;

    expect(signedHeaders1).toHaveLength(2);
    expect(signedHeaders2).toHaveLength(2);
    expect(signedHeaders1).toContainEqual({ digest: `SHA-256=${digest}` });
    expect(signedHeaders2).toContainEqual({ digest: `SHA-256=${digest}` });
    expect(signedHeaders1).toContainEqual({
      "content-type": res.headers["content-type"],
    });
    expect(signedHeaders2).toContainEqual({
      "content-type": res.headers["content-type"],
    });
  });

  it("Should return different digest with different body", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);
    mockAttributeService.getCertifiedAttribute = vi.fn().mockResolvedValue(
      toM2MGatewayApiCertifiedAttribute({
        attribute: getMockedApiAttribute({
          kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
        }),
        logger: genericLogger,
      })
    );
    const res2 = await makeRequest(token);
    expect(res2.status).toBe(200);
    expect(res2.headers.digest).not.toBe(res.headers.digest);
    expect(res.text).not.toBe(res2.text);
    const digest1 = calculateIntegrityRest02DigestFromBody({ body: res.text });
    const digest2 = calculateIntegrityRest02DigestFromBody({ body: res2.text });
    expect(digest1).not.toBe(digest2);
    expect(res.headers.digest).toBe(`SHA-256=${digest1}`);
    expect(res2.headers.digest).toBe(`SHA-256=${digest2}`);
  });

  it("Empty body, null and undefined should all be the same digest", async () => {
    const emptyStringDigest = calculateIntegrityRest02DigestFromBody({
      body: "",
    });
    const nullBodyDigest = calculateIntegrityRest02DigestFromBody({
      body: null,
    });
    const undefinedBodyDigest = calculateIntegrityRest02DigestFromBody({
      body: undefined,
    });
    const expectedDigest = "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=";

    expect(emptyStringDigest).toBe(expectedDigest);
    expect(nullBodyDigest).toBe(expectedDigest);
    expect(undefinedBodyDigest).toBe(expectedDigest);
  });

  it("should have a digest if there is a 400 error", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await request(api)
      .get(`${appBasePath}/certifiedAttributes/notAnUuuid`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send();
    const expectedDigest = calculateIntegrityRest02DigestFromBody({
      body: res.text,
    });
    expect(res.headers).toHaveProperty("digest");
    expect(res.headers.digest).toBe(`SHA-256=${expectedDigest}`);
  });

  it("should have a digest even if unauthorised", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.headers).toHaveProperty("digest");
    const expectedDigest = calculateIntegrityRest02DigestFromBody({
      body: res.text,
    });
    expect(res.headers.digest).toBe(`SHA-256=${expectedDigest}`);
  });
});
