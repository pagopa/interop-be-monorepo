import {
  AnalyticsSQLDbConfig,
  LoggerConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const KpiDomainsReadModelCheckerConfig =
  LoggerConfig.and(ReadModelSQLDbConfig).and(AnalyticsSQLDbConfig);

type KpiDomainsReadModelCheckerConfig = z.infer<
  typeof KpiDomainsReadModelCheckerConfig
>;

export const config: KpiDomainsReadModelCheckerConfig =
  KpiDomainsReadModelCheckerConfig.parse(process.env);
