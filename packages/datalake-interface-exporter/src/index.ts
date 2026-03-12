/* eslint-disable functional/immutable-data */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  decodeKafkaMessage,
  initFileManager,
  logger,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  EServiceEvent,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { config } from "./config/config.js";
import { exportInterfaceV1 } from "./interfaceExporterV1.js";
import { exportInterfaceV2 } from "./interfaceExporterV2.js";

const fileManager = initFileManager(config);

async function processMessage(payload: EachMessagePayload): Promise<void> {
  const decodedMsg = decodeKafkaMessage(payload.message, EServiceEvent);
  const correlationId: CorrelationId = decodedMsg.correlation_id
    ? unsafeBrandId(decodedMsg.correlation_id)
    : generateId();

  const loggerInstance = logger({
    serviceName: "datalake-interface-exporter",
    eventType: decodedMsg.type,
    eventVersion: decodedMsg.event_version,
    streamId: decodedMsg.stream_id,
    streamVersion: decodedMsg.version,
    correlationId,
  });

  await match(decodedMsg)
    .with({ event_version: 1 }, (msg) =>
      exportInterfaceV1(msg, payload, fileManager, loggerInstance)
    )
    .with({ event_version: 2 }, (msg) =>
      exportInterfaceV2(msg, payload, fileManager, loggerInstance)
    )
    .exhaustive();
}

await runConsumer(
  config,
  [config.catalogTopic],
  processMessage,
  "datalake-interface-exporter"
);
