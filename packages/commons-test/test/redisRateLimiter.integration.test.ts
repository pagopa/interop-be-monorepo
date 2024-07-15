/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, it } from "vitest";
import { generateId, TenantId } from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { sleep } from "../src/testUtils.js";
import { redisRateLimiter } from "./utils.js";

describe("Redis rate limiter tests", async () => {
  /*
  ---------- NOTE ------------------------------------
  Test rate limiter configuration defined in .env.test
  ----------------------------------------------------
  */

  it("should rate limit requests by organizationId", async () => {
    const organizationId: TenantId = generateId();

    expect(
      await redisRateLimiter.rateLimitByOrganization(
        organizationId,
        genericLogger
      )
    ).toEqual({
      limitReached: false,
      maxRequests: 2,
      rateInterval: 1000,
      remainingRequests: 1,
    });

    expect(await redisRateLimiter.getCountByOrganization(organizationId)).toBe(
      "1"
    );

    expect(
      await redisRateLimiter.rateLimitByOrganization(
        organizationId,
        genericLogger
      )
    ).toEqual({
      limitReached: false,
      maxRequests: 2,
      rateInterval: 1000,
      remainingRequests: 0,
    });

    expect(await redisRateLimiter.getCountByOrganization(organizationId)).toBe(
      "2"
    );

    // Burst rate limiter kicks in.
    // Burst percentage in config is 1.5, so we expect 3 requests to be allowed.

    expect(
      await redisRateLimiter.rateLimitByOrganization(
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
      await redisRateLimiter.getBurstCountByOrganization(organizationId)
    ).toBe("1");

    expect(
      await redisRateLimiter.rateLimitByOrganization(
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
      await redisRateLimiter.getBurstCountByOrganization(organizationId)
    ).toBe("2");

    expect(
      await redisRateLimiter.rateLimitByOrganization(
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
      await redisRateLimiter.getBurstCountByOrganization(organizationId)
    ).toBe("3");

    // Limit reached
    expect(
      await redisRateLimiter.rateLimitByOrganization(
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
      await redisRateLimiter.rateLimitByOrganization(
        organizationId,
        genericLogger
      )
    ).toEqual({
      limitReached: false,
      maxRequests: 2,
      rateInterval: 1000,
      remainingRequests: 1,
    });

    expect(await redisRateLimiter.getCountByOrganization(organizationId)).toBe(
      "1"
    );

    await sleep(1000);

    expect(
      await redisRateLimiter.rateLimitByOrganization(
        organizationId,
        genericLogger
      )
    ).toEqual({
      limitReached: false,
      maxRequests: 2,
      rateInterval: 1000,
      remainingRequests: 1,
    });

    expect(await redisRateLimiter.getCountByOrganization(organizationId)).toBe(
      "1"
    );
  });
});
