import { OutgoingHttpHeaders } from "http2";
import { RateLimiterStatus } from "./rateLimiterModel.js";

export const rateLimiterHeadersFromStatus = (
  rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">
): OutgoingHttpHeaders => ({
  "X-Rate-Limit-Limit": rateLimiterStatus.maxRequests,
  "X-Rate-Limit-Interval": rateLimiterStatus.rateInterval,
  "X-Rate-Limit-Remaining": rateLimiterStatus.remainingRequests,
});
