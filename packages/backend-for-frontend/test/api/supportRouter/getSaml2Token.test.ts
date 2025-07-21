import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { bffApi } from "pagopa-interop-api-clients";
import { generateId, TenantId } from "pagopa-interop-models";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiGoogleSAMLPayload } from "../../mockUtils.js";

describe("API POST /session/saml2/tokens", () => {
  const mockGoogleSAMLPayload = getMockBffApiGoogleSAMLPayload();
  const mockJwt = "mockJwt";
  const saml2 = `${mockGoogleSAMLPayload.SAMLResponse}&jwt=${mockJwt}`;

  const mockSAMLTokenRequestBody: bffApi.SAMLTokenRequest = {
    tenantId: generateId<TenantId>(),
    saml2,
  };
  const mockSessionToken: bffApi.SessionToken = {
    session_token: `eyJhbGciOiJSUzI1NiIsInVzZSI6InNpZyIsInR5cCI6ImF0K2p3dCIsImtpZCI6IjQxZTNhOGU5LTU5ODItNGE2ZC1iNTMxLTg1MDc3NGJmZDk2MSJ9.eyJqdGkiOiI5NTgzYjQ1Ni1lYjA3LTQ2ZjUtOTIyMC02ZDA1NTQ5NTA5NjciLCJpc3MiOiJkZXYuaW50ZXJvcC5wYWdvcGEuaXQiLCJhdWQiOiJkZXYuaW50ZXJvcC5wYWdvcGEuaXQvdWkiLCJpYXQiOjE3NTE5MDMyMTMsIm5iZiI6MTc1MTkwMzIxMywiZXhwIjoxNzUxOTg5NjEzLCJ1aWQiOiI1ZDcxN2I5Ny01MzA4LTQ5YTUtODY4Mi0xODc2NjMyNzhmMjQiLCJvcmdhbml6YXRpb24iOnsiaWQiOiIxOTYyZDIxYy1jNzAxLTQ4MDUtOTNmNi01M2E4Nzc4OTg3NTYiLCJuYW1lIjoiUGFnb1BBIFMucC5BLiIsInJvbGVzIjpbeyJwYXJ0eVJvbGUiOiJERUxFR0FURSIsInJvbGUiOiJhZG1pbiJ9XSwiZmlzY2FsX2NvZGUiOiIxNTM3NjM3MTAwOSIsImlwYUNvZGUiOiI1TjJUUjU1NyJ9LCJuYW1lIjoiU2lzdGkiLCJmYW1pbHlfbmFtZSI6Ik1hdHRpYSIsImVtYWlsIjoibXJAbXIuaXQiLCJ1c2VyLXJvbGVzIjoiYWRtaW4iLCJvcmdhbml6YXRpb25JZCI6IjY5ZTI4NjVlLTY1YWItNGU0OC1hNjM4LTIwMzdhOWVlMmVlNyIsInNlbGZjYXJlSWQiOiIxOTYyZDIxYy1jNzAxLTQ4MDUtOTNmNi01M2E4Nzc4OTg3NTYiLCJleHRlcm5hbElkIjp7Im9yaWdpbiI6IklQQSIsInZhbHVlIjoiNU4yVFI1NTcifX0.ASYxVNH8rf3ux3Ov5hl_Kk4sKiuhMMXkvpf8dDbJYds9kOUhaaqhvlK5eLwXPitwL1wARt5067Xi0LRF66NygzChY3CAaV46Pz2JaG7tssjAEd22NcTGv7InSTDbXYhm2VMh47JuYKLfFjARV1DsfSgNCXI9B9xxOf9igahL-qjj1Q_A0dF3RnYhnsG0WDRwE76C_JAm0bEsk7msNpmPXtQMylfHcjjDJdysc5SbrmiWgEcdqiaqL3fKuz8xx4CvGVDWDHqpSJh6E0M-UP-d1N4o0Q3USPvu1FZLAqvSK69dlYFMFzWqCTzu6ARejN-beNqU4NGjMKVYoaqhyIt6tQ`,
  };

  beforeEach(() => {
    services.authorizationServiceForSupport.getSaml2Token = vi
      .fn()
      .mockResolvedValue(mockSessionToken);
  });

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const makeRequest = async (
    token: string,
    body: bffApi.SAMLTokenRequest = mockSAMLTokenRequestBody
  ) =>
    request(api)
      .post(`${appBasePath}/session/saml2/tokens`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 and the session token for valid SAML request", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockSessionToken);
  });

  it.each([
    { body: {} },
    { body: { ...mockSAMLTokenRequestBody, extraField: 1 } },
    { body: { ...mockSAMLTokenRequestBody, tenantId: "invalid" } },
    { body: { ...mockSAMLTokenRequestBody, saml2: 123 } },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body as bffApi.SAMLTokenRequest);
    expect(res.status).toBe(400);
  });
});
