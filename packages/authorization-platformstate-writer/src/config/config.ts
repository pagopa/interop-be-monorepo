import {
  AuthorizationTopicConfig,
  PlatformStateWriterConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const AuthorizationPlatformStateWriterConfig = PlatformStateWriterConfig.and(
  AuthorizationTopicConfig
);

type AuthorizationPlatformStateWriterConfig = z.infer<
  typeof AuthorizationPlatformStateWriterConfig
>;

export const config: AuthorizationPlatformStateWriterConfig =
  AuthorizationPlatformStateWriterConfig.parse(process.env);
