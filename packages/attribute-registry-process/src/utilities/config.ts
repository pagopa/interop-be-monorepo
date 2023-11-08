import {
  CommonConfig,
  ReadModelDbConfig,
  EventStoreConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const AttributeRegistryConfig =
  CommonConfig.and(ReadModelDbConfig).and(EventStoreConfig);

export type AttributeRegistryConfig = z.infer<typeof AttributeRegistryConfig>;

export const config: AttributeRegistryConfig = {
  ...AttributeRegistryConfig.parse(process.env),
};
