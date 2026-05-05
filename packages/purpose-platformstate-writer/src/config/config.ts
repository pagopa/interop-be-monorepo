import {
  PlatformStateWriterConfig,
  PurposeTopicConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PurposePlatformStateWriterConfig =
  PlatformStateWriterConfig.and(PurposeTopicConfig);

type PurposePlatformStateWriterConfig = z.infer<
  typeof PurposePlatformStateWriterConfig
>;

export const config: PurposePlatformStateWriterConfig =
  PurposePlatformStateWriterConfig.parse(process.env);
