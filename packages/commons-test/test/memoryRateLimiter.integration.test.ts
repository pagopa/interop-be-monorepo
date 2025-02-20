/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, it } from "vitest";
import { generateId, TenantId } from "pagopa-interop-models";
import { genericLogger, initMemoryRateLimiter } from "pagopa-interop-commons";
import { sleep } from "../src/testUtils.js";
import { memoryRateLimiterConfig } from "./utils.js";

const memoryRateLimiter = await initMemoryRateLimiter({
  limiterGroup: "TEST",
  maxRequests: memoryRateLimiterConfig.rateLimiterMaxRequests,
  rateInterval: memoryRateLimiterConfig.rateLimiterRateInterval,
  burstPercentage: memoryRateLimiterConfig.rateLimiterBurstPercentage,
});
describe("Redis rate limiter tests", async () => {
  /*
  ---------- NOTE ------------------------------------
  Test rate limiter configuration defined in .env.test
  ----------------------------------------------------
  */

  it("should rate limit requests by organizationId", async () => {
    const organizationId: TenantId = generateId();

    expect(
      await memoryRateLimiter.rateLimitByOrganization(
        organizationId,
        genericLogger
      )
    ).toEqual({
      limitReached: false,
      maxRequests: 2,
      rateInterval: 1000,
      remainingRequests: 1,
    });

    expect(
      await memoryRateLimiter.rateLimitByOrganization(
        organizationId,
        genericLogger
      )
    ).toEqual({
      limitReached: false,
      maxRequests: 2,
      rateInterval: 1000,
      remainingRequests: 0,
    });

    // Burst rate limiter kicks in.
    // Burst percentage in config is 1.5, so we expect 3 requests to be allowed.

    expect(
      await memoryRateLimiter.rateLimitByOrganization(
        organizationId,
        genericLogger
      )
    ).toEqual({
      limitReached: false,
      maxRequests: 2,
      rateInterval: 1000,
      remainingRequests: 0,
    });

    expect(
      await memoryRateLimiter.rateLimitByOrganization(
        organizationId,
        genericLogger
      )
    ).toEqual({
      limitReached: false,
      maxRequests: 2,
      rateInterval: 1000,
      remainingRequests: 0,
    });

    expect(
      await memoryRateLimiter.rateLimitByOrganization(
        organizationId,
        genericLogger
      )
    ).toEqual({
      limitReached: false,
      maxRequests: 2,
      rateInterval: 1000,
      remainingRequests: 0,
    });

    // Limit reached
    expect(
      await memoryRateLimiter.rateLimitByOrganization(
        organizationId,
        genericLogger
      )
    ).toEqual({
      limitReached: true,
      maxRequests: 2,
      rateInterval: 1000,
      remainingRequests: 0,
    });
  });

  it("should reset requests count after rate interval", async () => {
    const organizationId: TenantId = generateId();

    expect(
      await memoryRateLimiter.rateLimitByOrganization(
        organizationId,
        genericLogger
      )
    ).toEqual({
      limitReached: false,
      maxRequests: 2,
      rateInterval: 1000,
      remainingRequests: 1,
    });

    await sleep(1000);

    expect(
      await memoryRateLimiter.rateLimitByOrganization(
        organizationId,
        genericLogger
      )
    ).toEqual({
      limitReached: false,
      maxRequests: 2,
      rateInterval: 1000,
      remainingRequests: 1,
    });
  });
});
