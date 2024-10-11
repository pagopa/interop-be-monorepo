import { CommonHTTPServiceConfig } from "pagopa-interop-commons";
import { z } from "zod";

const AuthorizationServerConfig = CommonHTTPServiceConfig;

// TODO add config for dynamoDB and KMS

export type AuthorizationServerConfig = z.infer<
  typeof AuthorizationServerConfig
>;

export const config: AuthorizationServerConfig =
  AuthorizationServerConfig.parse(process.env);
