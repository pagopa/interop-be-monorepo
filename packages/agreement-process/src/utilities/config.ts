import { z } from "zod";
import {
  config as commonsConfig,
  Config as CommonConfig,
  HTTPServerConfig,
} from "pagopa-interop-commons";

const LocalConfig = z.object({}).transform(() => ({}));

const Config = LocalConfig.and(HTTPServerConfig);
export type Config = z.infer<typeof Config>;

export const config: Config & CommonConfig = {
  ...commonsConfig,
  ...Config.parse(process.env),
};
