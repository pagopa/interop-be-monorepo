import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  messageDecoderSupplier,
  kafkaConsumerConfig,
  logger,
} from "pagopa-interop-commons";

const config = kafkaConsumerConfig();

async function processMessage({
  topic,
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  try {
    const messageDecoder = messageDecoderSupplier(topic);
    const decodedMessage = messageDecoder(message);

    // TODO : update authorization to AuthjorizationManagement service

    logger.info(
      `Authorization updated after "${JSON.stringify(
        decodedMessage.type
      )}" event`
    );
  } catch (e) {
    logger.error(
      `Error during message handling. Partition number: ${partition}. Offset: ${message.offset}, ${e}`
    );
  }
}

await runConsumer(config, processMessage).catch(logger.error);
