import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  decodeKafkaMessage,
  InteropTokenGenerator,
  logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import {
  fromTenantV2,
  missingKafkaMessageDataError,
  TenantEvent,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { v4 as uuidv4 } from "uuid";
import { agreementApi } from "pagopa-interop-api-clients";
import { config } from "./config/config.js";

const agreementProcessClient = agreementApi.createAgreementApiClient(
  config.agreementProcessUrl
);

const refreshableToken = new RefreshableInteropToken(
  new InteropTokenGenerator(config)
);
await refreshableToken.init();

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMsg = decodeKafkaMessage(message, TenantEvent);
  const correlationId = decodedMsg.correlation_id || uuidv4();

  const loggerInstance = logger({
    serviceName: "compute-agreements-consumer",
    eventType: decodedMsg.type,
    eventVersion: decodedMsg.event_version,
    streamId: decodedMsg.stream_id,
    correlationId,
  });

  await match(decodedMsg)
    .with(
      {
        event_version: 2,
        type: "TenantCertifiedAttributeRevoked",
      },
      {
        event_version: 2,
        type: "TenantCertifiedAttributeAssigned",
      },
      {
        event_version: 2,
        type: "TenantDeclaredAttributeAssigned",
      },
      {
        event_version: 2,
        type: "TenantDeclaredAttributeRevoked",
      },
      {
        event_version: 2,
        type: "TenantVerifiedAttributeAssigned",
      },
      {
        event_version: 2,
        type: "TenantVerifiedAttributeRevoked",
      },
      async ({ data: { tenant, attributeId } }) => {
        if (tenant) {
          loggerInstance.info(
            `Processing ${decodedMsg.type} message - Partition number: ${partition} - Offset: ${message.offset}`
          );
          const token = (await refreshableToken.get()).serialized;

          await agreementProcessClient.computeAgreementsByAttribute(
            {
              attributeId: unsafeBrandId(attributeId),
              consumer: fromTenantV2(tenant),
            },
            {
              headers: {
                "X-Correlation-Id": correlationId,
                Authorization: `Bearer ${token}`,
              },
            }
          );
        } else {
          throw missingKafkaMessageDataError("tenant", decodedMsg.type);
        }
      }
    )
    .otherwise(() => undefined);
}

await runConsumer(config, [config.tenantTopic], processMessage);
