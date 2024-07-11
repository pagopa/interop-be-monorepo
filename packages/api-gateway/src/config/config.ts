import { z } from "zod";
import { CommonHTTPServiceConfig } from "pagopa-interop-commons";

const ApiGatewayConfig = CommonHTTPServiceConfig;
export type ApiGatewayConfig = z.infer<typeof ApiGatewayConfig>;

export const config: ApiGatewayConfig = ApiGatewayConfig.parse(process.env);
