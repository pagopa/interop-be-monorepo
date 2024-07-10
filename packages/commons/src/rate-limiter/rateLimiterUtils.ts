import { OutgoingHttpHeaders } from "http2";
import { RateLimiterStatus } from "./rateLimiterModel.js";

export const rateLimiterHeadersFromStatus = (
  rateLimiterStatus: RateLimiterStatus
): OutgoingHttpHeaders => ({
  "X-RateLimit-Limit": rateLimiterStatus.maxRequests,
  "X-RateLimit-Interval": rateLimiterStatus.rateInterval,
  "X-RateLimit-Remaining": rateLimiterStatus.remainingRequests,
});
