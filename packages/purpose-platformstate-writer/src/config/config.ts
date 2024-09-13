import {
  PlatformStateWriterConfig,
  PurposeTopicConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const PurposePlatformStateWriterConfig =
  PlatformStateWriterConfig.and(PurposeTopicConfig);

export type PurposePlatformStateWriterConfig = z.infer<
  typeof PurposePlatformStateWriterConfig
>;

export const config: PurposePlatformStateWriterConfig =
  PurposePlatformStateWriterConfig.parse(process.env);
