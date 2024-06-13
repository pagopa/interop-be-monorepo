import { z } from "zod";
import { CommonHTTPServiceConfig } from "pagopa-interop-commons";
import { SelfCareConfig } from "pagopa-interop-selfcare-v2-client";

const BffProcessConfig = CommonHTTPServiceConfig.and(SelfCareConfig);

export type BffProcessConfig = z.infer<typeof BffProcessConfig>;

export const config: BffProcessConfig = BffProcessConfig.parse(process.env);
