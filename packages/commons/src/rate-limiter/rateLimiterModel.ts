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
  getCountByOrganization: (organizationId: TenantId) => Promise<string | null>;
  getBurstCountByOrganization: (
    organizationId: TenantId
  ) => Promise<string | null>;
};
