/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, it } from "vitest";
import { generateId, TenantId } from "pagopa-interop-models";
import { delay, genericLogger } from "pagopa-interop-commons";
import { redisRateLimiter } from "./utils.js";

const waitCounterReset = async (
  attemptsLeft: number,
  delayMs: number,
  organizationId: TenantId
): Promise<void> => {
  const currentCount = await redisRateLimiter.getCountByOrganization(
    organizationId
  );

  if (currentCount === 0) {
    return Promise.resolve();
  }

  if (attemptsLeft <= 0) {
    return Promise.resolve();
  }

  await delay(delayMs);
  return waitCounterReset(attemptsLeft - 1, delayMs, organizationId);
};

describe("Redis rate limiter tests", () => {
  /*
  ---------- NOTE ------------------------------------
  Test rate limiter configuration defined in .env.test
  ----------------------------------------------------
  */

  it("should rate limit requests by organizationId", async () => {
    const organizationId: TenantId = generateId();

    expect(await redisRateLimiter.getCountByOrganization(organizationId)).toBe(
      0
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
      remainingRequests: 1,
    });

    expect(await redisRateLimiter.getCountByOrganization(organizationId)).toBe(
      1
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
      2
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
    ).toBe(1);

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
    ).toBe(2);

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
    ).toBe(3);

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

    expect(await redisRateLimiter.getCountByOrganization(organizationId)).toBe(
      0
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
      remainingRequests: 1,
    });

    expect(await redisRateLimiter.getCountByOrganization(organizationId)).toBe(
      1
    );

    await delay(3000);

    await waitCounterReset(5, 500, organizationId);

    const newResult = await redisRateLimiter.rateLimitByOrganization(
      organizationId,
      genericLogger
    );

    expect(newResult.limitReached).toBe(false);
    expect(newResult.maxRequests).toBe(2);
    expect(newResult.rateInterval).toBe(1000);

    const finalCount = await redisRateLimiter.getCountByOrganization(
      organizationId
    );
    expect(finalCount).toBeLessThanOrEqual(2);
  });
});
