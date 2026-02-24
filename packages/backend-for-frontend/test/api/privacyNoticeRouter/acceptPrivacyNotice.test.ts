/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateMock } from "@anatine/zod-mock";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  dynamoReadingError,
  privacyNoticeNotFound,
  privacyNoticeNotFoundInConfiguration,
} from "../../../src/model/errors.js";

describe("API POST /user/consent/{consentType} test", () => {
  const defaultBody: bffApi.PrivacyNoticeSeed = {
    latestVersionId: generateId(),
  };
  const mockConsentType: bffApi.ConsentType = generateMock(bffApi.ConsentType);

  beforeEach(() => {
    services.privacyNoticeService.acceptPrivacyNotice = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    consentType: bffApi.ConsentType = mockConsentType,
    body: bffApi.PrivacyNoticeSeed = defaultBody
  ) =>
    request(api)
      .post(`${appBasePath}/user/consent/${consentType}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
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
      services.privacyNoticeService.acceptPrivacyNotice = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { consentType: "invalid" as bffApi.ConsentType },
    { body: {} },
    { body: { latestVersionId: "invalid" } },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ consentType, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        consentType,
        body as bffApi.PrivacyNoticeSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
