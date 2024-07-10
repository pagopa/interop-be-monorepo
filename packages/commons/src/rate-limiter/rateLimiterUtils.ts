import { OutgoingHttpHeaders } from "http2";
import { RateLimiterStatus } from "./rateLimiterModel.js";

export const rateLimiterHeadersFromStatus = (
  rateLimiterStatus: RateLimiterStatus
): OutgoingHttpHeaders => ({
  "X-RateLimit-Limit": rateLimiterStatus.maxRequests,
  "X-RateLimit-Interval": rateLimiterStatus.rateInterval,
  "X-RateLimit-Remaining": rateLimiterStatus.remainingRequests,
});
// TODO why are these different from the ones in the openapi spec?
// The spec specifies the headers with a dash, Rate-Limit instead of RateLimit
// "X-Rate-Limit-Limit
// "X-Rate-Limit-Remaining"
// "X-Rate-Limit-Interval"
