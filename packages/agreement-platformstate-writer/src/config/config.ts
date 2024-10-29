import {
  AgreementTopicConfig,
  PlatformStateWriterConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const AgreementPlatformStateWriterConfig =
  PlatformStateWriterConfig.and(AgreementTopicConfig);

export type AgreementPlatformStateWriterConfig = z.infer<
  typeof AgreementPlatformStateWriterConfig
>;

export const config: AgreementPlatformStateWriterConfig =
  AgreementPlatformStateWriterConfig.parse(process.env);
