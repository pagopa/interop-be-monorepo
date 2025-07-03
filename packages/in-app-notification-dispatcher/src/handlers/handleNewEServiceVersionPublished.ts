import { EServiceV2, fromEServiceV2 } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelService } from "../services/readModelService.js";
import { retrieveTenant } from "./handlerCommons.js";

export default async function handleNewEServiceVersionPublished(
  eserviceV2Msg: EServiceV2,
  logger: Logger,
  readModelService: ReadModelService
): Promise<void> {
  logger.info(`New descriptor published for eservice ${eserviceV2Msg.id}`);

  const eservice = fromEServiceV2(eserviceV2Msg);
  const [agreements] = await Promise.all([
    readModelService.getAgreementsByEserviceId(eservice.id),
  ]);

  if (agreements && agreements.length > 0) {
    const consumers = await Promise.all(
      agreements.map((consumer) =>
        retrieveTenant(consumer.consumerId, readModelService)
      )
    );
    logger.info(consumers);
  }
}
