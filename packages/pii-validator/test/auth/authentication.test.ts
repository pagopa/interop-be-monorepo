/* eslint-disable functional/immutable-data */
import { constants } from "http2";
import { exportJWK, generateKeyPair, KeyLike, SignJWT } from "jose";
import { APIEndpoint, authRole } from "pagopa-interop-commons";
import {
  createPayload,
  generateToken,
  JwksServer,
  startJwksServer,
} from "pagopa-interop-commons-test";
import { CorrelationId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { config } from "../../src/config/config.js";
import { DetectionService } from "../../src/services/detectionService.js";
import { logCapture } from "../logCapture.js";

const correlationId = generateId<CorrelationId>();
const audience = "dev.interop.pagopa.it/ui";
const fakeService: DetectionService = {
  detect: async () => ({
    detectedCategories: {
      EMAIL_ADDRESS: false,
      IT_FISCAL_CODE: false,
      IT_VAT_CODE: false,
      IBAN_CODE: false,
      CREDIT_CARD: false,
      PHONE_NUMBER: false,
      IT_IDENTITY_CARD: false,
      IT_DRIVER_LICENSE: false,
    },
  }),
};

let privateKey: KeyLike;
let jwksServer: JwksServer;
const previousWellKnownUrls = config.wellKnownUrls;
const previousAcceptedAudiences = config.acceptedAudiences;

const sign = async (payload: Record<string, unknown>): Promise<string> =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: "pii-validator-test-key" })
    .sign(privateKey);

beforeAll(async () => {
  const keyPair = await generateKeyPair("RS256");
  privateKey = keyPair.privateKey;
  const publicJwk = await exportJWK(keyPair.publicKey);
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  publicJwk.kid = "pii-validator-test-key";
  jwksServer = await startJwksServer(publicJwk);
  config.wellKnownUrls = [APIEndpoint.parse(jwksServer.url)];
  config.acceptedAudiences = [audience];
});

afterAll(async () => {
  config.wellKnownUrls = previousWellKnownUrls;
  config.acceptedAudiences = previousAcceptedAudiences;
  await jwksServer.close();
});

const postDetect = async (authorization?: string, path = "/detect") => {
  const api = await createApp(fakeService);
  const call = request(api)
    .post(path)
    .set("X-Correlation-Id", correlationId)
    .send({ text: "synthetic neutral text" });

  return authorization == null
    ? call
    : call.set("Authorization", authorization);
};

describe("POST /detect authentication boundary", () => {
  it("redacts query-string values when the bearer header is malformed", async () => {
    const sentinel = "QUERY_LOG_TEST_001";
    logCapture.entries.splice(0);

    const response = await postDetect(
      "Basic malformed",
      `/detect?probe=${sentinel}`
    );

    expect(response.status).toBe(constants.HTTP_STATUS_BAD_REQUEST);
    expect(response.headers["content-type"]).toMatch(
      /^application\/problem\+json\b/
    );
    expect(JSON.stringify(response.body)).not.toContain(sentinel);
    expect(logCapture.entries.join("\n")).not.toContain(sentinel);
  });

  it("returns 400 when the authorization header is missing", async () => {
    const response = await postDetect();

    expect(response.status).toBe(constants.HTTP_STATUS_BAD_REQUEST);
    expect(response.headers["content-type"]).toMatch(
      /^application\/problem\+json\b/
    );
  });

  it("returns 400 for malformed bearer syntax", async () => {
    const response = await postDetect("Basic malformed");

    expect(response.status).toBe(constants.HTTP_STATUS_BAD_REQUEST);
    expect(response.headers["content-type"]).toMatch(
      /^application\/problem\+json\b/
    );
  });

  it("returns 401 for a cryptographically unverifiable token", async () => {
    const response = await postDetect(
      `Bearer ${generateToken(authRole.INTERNAL_ROLE)}`
    );

    expect(response.status).toBe(constants.HTTP_STATUS_UNAUTHORIZED);
    expect(response.headers["content-type"]).toMatch(
      /^application\/problem\+json\b/
    );
  });

  it("returns 400 for a verified token with invalid Interop claims", async () => {
    const token = await sign({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      jti: generateId(),
      role: "unsupported-role",
      sub: "interop.testing",
    });
    const response = await postDetect(`Bearer ${token}`);

    expect(response.status).toBe(constants.HTTP_STATUS_BAD_REQUEST);
    expect(response.headers["content-type"]).toMatch(
      /^application\/problem\+json\b/
    );
  });

  it("allows a verified token with valid Interop claims", async () => {
    const token = await sign(
      createPayload(authRole.INTERNAL_ROLE) as unknown as Record<
        string,
        unknown
      >
    );
    const response = await postDetect(`Bearer ${token}`);

    expect(response.status).toBe(constants.HTTP_STATUS_OK);
  });
});
