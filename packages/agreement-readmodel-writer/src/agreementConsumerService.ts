import { match } from "ts-pattern";
import {
  logger,
  consumerConfig,
  ReadModelRepository,
} from "pagopa-interop-commons";
import { EventEnvelope } from "./model/models.js";
import { fromAgreementV1, fromDocumentV1 } from "./model/converter.js";

const { agreements } = ReadModelRepository.init(consumerConfig());

export async function handleMessage(message: EventEnvelope): Promise<void> {
  logger.info(message);
  await match(message)
    .with({ type: "AgreementAdded" }, async (msg) => {
      await agreements.updateOne(
        {
          "data.id": msg.stream_id,
        },
        {
          $setOnInsert: {
            data: msg.data.agreement
              ? fromAgreementV1(msg.data.agreement)
              : undefined,
            metadata: {
              version: msg.version,
            },
          },
        },
        { upsert: true }
      );
    })
    .with({ type: "AgreementDeleted" }, async (msg) => {
      await agreements.deleteOne({
        "data.id": msg.stream_id,
        "metadata.version": { $lt: msg.version },
      });
    })
    .with({ type: "AgreementUpdated" }, async (msg) => {
      await agreements.updateOne(
        {
          "data.id": msg.stream_id,
          "metadata.version": { $lt: msg.version },
        },
        {
          $set: {
            data: msg.data.agreement
              ? fromAgreementV1(msg.data.agreement)
              : undefined,
            metadata: {
              version: msg.version,
            },
          },
        }
      );
    })
    .with({ type: "AgreementConsumerDocumentAdded" }, async (msg) => {
      await agreements.updateOne(
        {
          "data.id": msg.stream_id,
          "metadata.version": { $lt: msg.version },
        },
        {
          $push: {
            "data.consumerDocuments": msg.data.document
              ? fromDocumentV1(msg.data.document)
              : undefined,
          },
          $set: {
            metadata: {
              version: msg.version,
            },
          },
        }
      );
    })
    .with({ type: "AgreementContractAdded" }, async (msg) => {
      await agreements.updateOne(
        {
          "data.id": msg.stream_id,
          "metadata.version": { $lt: msg.version },
        },
        {
          $set: {
            "data.contract": msg.data.contract
              ? fromDocumentV1(msg.data.contract)
              : undefined,
            metadata: {
              version: msg.version,
            },
          },
        }
      );
    })
    .exhaustive();
}
