import {
  CatalogTopicConfig,
  KafkaConsumerConfig,
  KafkaProducerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const CatalogOutboundWriterConfig = KafkaConsumerConfig.and(KafkaProducerConfig)
  .and(CatalogTopicConfig)
  .and(
    z.object({
      CATALOG_OUTBOUND_TOPIC: z.string(),
    })
  )
  .transform((c) => ({
    ...c,
    catalogOutboundTopic: c.CATALOG_OUTBOUND_TOPIC,
  }));

type CatalogOutboundWriterConfig = z.infer<
  typeof CatalogOutboundWriterConfig
>;

export const config: CatalogOutboundWriterConfig =
  CatalogOutboundWriterConfig.parse(process.env);
