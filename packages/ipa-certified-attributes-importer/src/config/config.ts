import {
  APIEndpoint,
  LoggerConfig,
  ReadModelDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const IPACertifiedAttributesImporterConfig = LoggerConfig.and(
  ReadModelDbConfig
).and(
  z
    .object({
      INSTITUTIONS_URL: APIEndpoint,
      AOO_URL: APIEndpoint,
      UO_URL: APIEndpoint,
      INSTITUTIONS_CATEGORIES_URL: APIEndpoint,
      IPA_ORIGIN: z.string(),
    })
    .transform((c) => ({
      institutionsUrl: c.INSTITUTIONS_URL,
      aooUrl: c.AOO_URL,
      uoUrl: c.UO_URL,
      institutionsCategoriesUrl: c.INSTITUTIONS_CATEGORIES_URL,
      ipaOrigin: c.IPA_ORIGIN,
    }))
);

export type IPACertifiedAttributesImporterConfig = z.infer<
  typeof IPACertifiedAttributesImporterConfig
>;

export const config: IPACertifiedAttributesImporterConfig =
  IPACertifiedAttributesImporterConfig.parse(process.env);
