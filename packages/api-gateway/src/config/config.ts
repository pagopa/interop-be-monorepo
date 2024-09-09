import { z } from "zod";
import {
  APIEndpoint,
  CommonHTTPServiceConfig,
  RedisRateLimiterConfig,
} from "pagopa-interop-commons";

export const AgreementProcessServerConfig = z
  .object({
    AGREEMENT_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    agreementProcessUrl: c.AGREEMENT_PROCESS_URL,
  }));
export type AgreementProcessServerConfig = z.infer<
  typeof AgreementProcessServerConfig
>;

const ApiGatewayConfig = CommonHTTPServiceConfig.and(
  RedisRateLimiterConfig
).and(AgreementProcessServerConfig);
export type ApiGatewayConfig = z.infer<typeof ApiGatewayConfig>;

export const config: ApiGatewayConfig = ApiGatewayConfig.parse(process.env);
