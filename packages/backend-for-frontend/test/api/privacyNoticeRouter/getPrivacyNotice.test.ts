/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiPrivacyNotice } from "../../mockUtils.js";
import {
  dynamoReadingError,
  privacyNoticeNotFound,
  privacyNoticeNotFoundInConfiguration,
} from "../../../src/model/errors.js";

describe("API GET /user/consent/{consentType} test", () => {
  const mockPrivacyNotice = getMockBffApiPrivacyNotice();
  const mockConsentType = mockPrivacyNotice.consentType;

  beforeEach(() => {
    services.privacyNoticeService.getPrivacyNotice = vi
      .fn()
      .mockResolvedValue(mockPrivacyNotice);
  });

  const makeRequest = async (
    token: string,
    consentType: bffApi.ConsentType = mockConsentType
  ) =>
    request(api)
      .get(`${appBasePath}/user/consent/${consentType}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockPrivacyNotice);
  });

  it.each([
    { error: privacyNoticeNotFound(mockConsentType), expectedStatus: 404 },
    {
      error: privacyNoticeNotFoundInConfiguration(mockConsentType),
      expectedStatus: 404,
    },
    { error: dynamoReadingError("error"), expectedStatus: 500 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.privacyNoticeService.getPrivacyNotice = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid consent type", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as bffApi.ConsentType);
    expect(res.status).toBe(400);
  });
});
