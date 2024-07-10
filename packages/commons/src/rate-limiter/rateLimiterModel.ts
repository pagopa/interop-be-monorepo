import { TenantId } from "pagopa-interop-models";
import { Logger } from "../logging/index.js";

export type RateLimiterStatus = {
  limitReached: boolean;
  maxRequests: number;
  rateInterval: number;
  remainingRequests?: number;
  msBeforeNext?: number;
};

export type RateLimiter = {
  rateLimitByOrganization: (
    organizationId: TenantId,
    logger: Logger
  ) => Promise<RateLimiterStatus>;
};
