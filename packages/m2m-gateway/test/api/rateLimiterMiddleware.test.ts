/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockedApiAttribute,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test";
import { authRole, genericLogger } from "pagopa-interop-commons";
import request from "supertest";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import {
  api,
  mockAttributeService,
  mockRateLimiter,
} from "../vitest.api.setup.js";
import { appBasePath } from "../../src/config/appBasePath.js";
import { toM2MGatewayApiCertifiedAttribute } from "../../src/api/attributeApiConverter.js";

/*
  Testing only the rateLimiterMiddleware, not the rate limiter itself,
  which is tested in packages/commons-test/test/redisRateLimiter.integration.test.ts
*/
describe("rateLimiterMiddleware", () => {
  const makeRequest = async (token: string) =>
    request(api)
      .get(`${appBasePath}/certifiedAttributes/${generateId()}`)
      .set("Authorization", `Bearer ${token}`)
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

  const mockRateLimitByOrganization = vi.fn();
  mockRateLimiter.rateLimitByOrganization = mockRateLimitByOrganization;

  it("Should correctly set rate limiter response headers when rate limit is not reached", async () => {
    mockRateLimitByOrganization.mockResolvedValueOnce({
      limitReached: false,
      maxRequests: 100,
      rateInterval: 1000,
      remainingRequests: 10,
    });

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(200);
    expect(mockRateLimitByOrganization).toHaveBeenCalledWith(
      mockTokenOrganizationId,
      expect.anything()
    );
    expect(res.headers["x-rate-limit-limit"]).toBe("100");
    expect(res.headers["x-rate-limit-interval"]).toBe("1000");
    expect(res.headers["x-rate-limit-remaining"]).toBe("10");
  });

  it("Should return 429 when rate limit is reached and still set rate limiter headers", async () => {
    mockRateLimitByOrganization.mockResolvedValueOnce({
      limitReached: true,
      maxRequests: 100,
      rateInterval: 1000,
      remainingRequests: 0,
    });

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(429);

    expect(res.headers["x-rate-limit-limit"]).toBe("100");
    expect(res.headers["x-rate-limit-interval"]).toBe("1000");
    expect(res.headers["x-rate-limit-remaining"]).toBe("0");
  });
});
