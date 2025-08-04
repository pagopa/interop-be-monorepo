/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiGoogleSAMLPayload } from "../../mockUtils.js";
import { config } from "../../../src/config/config.js";

describe("API POST /support", () => {
  const mockGoogleSAMLPayload = getMockBffApiGoogleSAMLPayload();
  const mockJwt = "mockJwt";
  const mockUrl = `${config.samlCallbackUrl}#saml2=${mockGoogleSAMLPayload.SAMLResponse}&jwt=${mockJwt}`;

  beforeEach(() => {
    services.authorizationService.samlLoginCallback = vi
      .fn()
      .mockResolvedValue(mockJwt);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.GoogleSAMLPayload = mockGoogleSAMLPayload
  ) =>
    request(api)
      .post(`${appBasePath}/support`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 302 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(302);
    expect(res.headers.location).toEqual(mockUrl);
  });

  it("Should return 302 for internal error", async () => {
    services.authorizationService.samlLoginCallback = vi
      .fn()
      .mockRejectedValue(Error("Error message"));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(302);
    expect(res.headers.location).toEqual(config.samlCallbackErrorUrl);
  });

  it("Should return 400 if passed a invalid data", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {} as bffApi.GoogleSAMLPayload);
    expect(res.status).toBe(400);
  });
});
