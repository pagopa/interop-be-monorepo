import {
  AgreementTopicConfig,
  PlatformStateWriterConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const AgreementPlatformStateWriterConfig =
  PlatformStateWriterConfig.and(AgreementTopicConfig);

type AgreementPlatformStateWriterConfig = z.infer<
  typeof AgreementPlatformStateWriterConfig
>;

export const config: AgreementPlatformStateWriterConfig =
  AgreementPlatformStateWriterConfig.parse(process.env);
