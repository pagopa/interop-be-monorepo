import { z } from "zod";
import {
  CommonConfig,
  ReadModelDbConfig,
  EventStoreConfig,
} from "pagopa-interop-commons";

const AgreementProcessConfig =
  CommonConfig.and(EventStoreConfig).and(ReadModelDbConfig);
export type AgreementProcessConfig = z.infer<typeof AgreementProcessConfig>;

export const config: AgreementProcessConfig = {
  ...AgreementProcessConfig.parse(process.env),
};
