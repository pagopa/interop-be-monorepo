import { KafkaMessage } from "kafkajs";
import { FileManager } from "pagopa-interop-commons";

export async function handleMessage(
  _message: KafkaMessage,
  _fileManager: FileManager
): Promise<void> {
  return Promise.resolve();
}
