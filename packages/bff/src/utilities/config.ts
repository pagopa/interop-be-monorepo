import { z } from "zod";
import { CommonHTTPServiceConfig } from "pagopa-interop-commons";

const BffProcessConfig = CommonHTTPServiceConfig;
export type BffProcessConfig = z.infer<typeof BffProcessConfig>;

export const config: BffProcessConfig = BffProcessConfig.parse(process.env);
