import { TenantId } from "pagopa-interop-models";
import { Logger } from "../logging/index.js";

export type RateLimiterStatus = {
  limitReached: boolean;
  maxRequests: number;
  rateInterval: number;
  remainingRequests: number;
};

export type RateLimiter = {
  rateLimitByOrganization: (
    organizationId: TenantId,
    logger: Logger
  ) => Promise<RateLimiterStatus>;
  getCountByOrganization: (organizationId: TenantId) => Promise<number>;
  getBurstCountByOrganization: (organizationId: TenantId) => Promise<number>;
};
