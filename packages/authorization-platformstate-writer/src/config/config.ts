import {
  AuthorizationTopicConfig,
  PlatformStateWriterConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const AuthorizationPlatformStateWriterConfig =
  PlatformStateWriterConfig.and(AuthorizationTopicConfig);

export type AuthorizationPlatformStateWriterConfig = z.infer<
  typeof AuthorizationPlatformStateWriterConfig
>;

export const config: AuthorizationPlatformStateWriterConfig =
  AuthorizationPlatformStateWriterConfig.parse(process.env);
