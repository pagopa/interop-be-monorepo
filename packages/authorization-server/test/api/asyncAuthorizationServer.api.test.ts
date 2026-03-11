/* eslint-disable @typescript-eslint/explicit-function-return-type */
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientId, generateId } from "pagopa-interop-models";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import { api, asyncTokenService } from "../vitest.api.setup.js";
import {
  asyncClientAssertionClaimsValidationFailed,
  asyncRequestValidationFailed,
  asyncScopeNotYetImplemented,
  invalidAsyncScope,
} from "../../src/model/domain/errors.js";

describe("POST /authorization-server/token.oauth2.async", async () => {
  const clientId = generateId<ClientId>();

  const validRequestBody: authorizationServerApi.AsyncAccessTokenRequest = {
    client_id: "e58035ce-c753-4f72-b613-46f8a17b71cc",
    client_assertion: "valid-jws-token",
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    grant_type: "client_credentials",
  };

  const makeRequest = (
    body: authorizationServerApi.AsyncAccessTokenRequest = validRequestBody
  ) =>
    request(api)
      .post("/authorization-server/token.oauth2.async")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send(body);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Should invoke generateAsyncToken and not the standard generateToken flow", async () => {
    asyncTokenService.generateAsyncToken = vi
      .fn()
      .mockRejectedValue(asyncScopeNotYetImplemented("start_interaction"));

    const res = await makeRequest();

    expect(asyncTokenService.generateAsyncToken).toHaveBeenCalledOnce();
    expect(res.status).toBe(400);
  });

  it("Should return 400 for a bad formatted request body", async () => {
    const res = await request(api)
      .post("/authorization-server/token.oauth2.async")
      .set("Content-Type", "application/json")
      .send("wrong-formatted-json");

    expect(res.status).toBe(400);
  });

  it.each([
    {
      error: invalidAsyncScope("unknown_scope"),
      expectedStatus: 400,
    },
    {
      error: asyncScopeNotYetImplemented("start_interaction"),
      expectedStatus: 400,
    },
    {
      error: asyncRequestValidationFailed(clientId, "missing fields"),
      expectedStatus: 400,
    },
    {
      error: asyncClientAssertionClaimsValidationFailed(
        clientId,
        "invalid claims"
      ),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      asyncTokenService.generateAsyncToken = vi.fn().mockRejectedValue(error);
      const res = await makeRequest();
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should sanitize error response body for 400 errors", async () => {
    asyncTokenService.generateAsyncToken = vi
      .fn()
      .mockRejectedValue(invalidAsyncScope("unknown_scope"));

    const res = await makeRequest();

    expect(res.status).toBe(400);
    expect(res.body.errors[0].code).toBe("015-0008");
    expect(res.body.errors[0].detail).toBe(
      "Unable to generate a token for the given request"
    );
  });

  it("Should return 500 with sanitized error for unexpected errors", async () => {
    asyncTokenService.generateAsyncToken = vi
      .fn()
      .mockRejectedValue(new Error("unexpected error"));

    const res = await makeRequest();

    expect(res.status).toBe(500);
    expect(res.body.errors[0].code).toBe("015-0000");
  });

  it.each([
    {},
    { ...validRequestBody, client_id: "invalidId" },
    { ...validRequestBody, grant_type: "invalid-type" },
  ])("Should return 400 if passed invalid params: %s", async (body) => {
    const res = await makeRequest(
      body as authorizationServerApi.AsyncAccessTokenRequest
    );
    expect(res.status).toBe(400);
  });
});
