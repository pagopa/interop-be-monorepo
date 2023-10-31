// import { match  } from "ts-pattern";
import {
  logger,
  // consumerConfig,
  // ReadModelRepository,
} from "pagopa-interop-commons";
import { EventEnvelope } from "./model/models.js";

// const { eservices } = ReadModelRepository.init(consumerConfig());

export async function handleMessage(message: EventEnvelope): Promise<void> {
  logger.info(message);
  // await match(message).exhaustive(); // TODO
}
