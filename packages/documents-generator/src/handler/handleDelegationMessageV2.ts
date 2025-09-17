/* eslint-disable functional/immutable-data */
import {
  DelegationEventEnvelopeV2,
  fromDelegationV2,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { FileManager, Logger, PDFGenerator } from "pagopa-interop-commons";
import { contractBuilder } from "../service/delegation/delegationContractBuilder.js";
import { config } from "../config/config.js";
import { ReadModelService } from "../service/readModelService.js";
import {
  retrieveTenantById,
  retrieveEserviceById,
} from "../service/delegation/delegationService.js";

export async function handleDelegationMessageV2(
  decodedMessage: DelegationEventEnvelopeV2,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager,
  readModelService: ReadModelService,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with(
      {
        type: P.union(
          "ProducerDelegationApproved",
          "ConsumerDelegationApproved"
        ),
      },
      async (msg): Promise<void> => {
        if (!msg.data.delegation) {
          return;
        }
        const delegation = fromDelegationV2(msg.data.delegation);
        const [delegator, delegate, eservice] = await Promise.all([
          retrieveTenantById(readModelService, delegation.delegatorId),
          retrieveTenantById(readModelService, delegation.delegateId),
          retrieveEserviceById(readModelService, delegation.eserviceId),
        ]);

        if (!delegator || !delegate || !eservice) {
          throw new Error("Missing data to create activation contract.");
        }
        await contractBuilder.createActivationContract({
          delegation,
          delegator,
          delegate,
          eservice,
          pdfGenerator,
          fileManager,
          config,
          logger,
        });

        logger.info(`Delegation event ${msg.type} handled successfully`);
      }
    )
    .with(
      {
        type: P.union("ConsumerDelegationRevoked", "ProducerDelegationRevoked"),
      },
      async (msg): Promise<void> => {
        if (!msg.data.delegation) {
          throw new Error("Delegation data can't be missing on event");
        }
        const delegation = fromDelegationV2(msg.data.delegation);
        const [delegator, delegate, eservice] = await Promise.all([
          retrieveTenantById(readModelService, delegation.delegatorId),
          retrieveTenantById(readModelService, delegation.delegateId),
          retrieveEserviceById(readModelService, delegation.eserviceId),
        ]);

        if (!delegator || !delegate || !eservice) {
          throw new Error("Missing data to create revocation contract.");
        }
        await contractBuilder.createRevocationContract({
          delegation,
          delegator,
          delegate,
          eservice,
          pdfGenerator,
          fileManager,
          config,
          logger,
        });
        logger.info(`Delegation event ${msg.type} handled successfully`);
      }
    )
    .with(
      {
        type: P.union(
          "ConsumerDelegationRejected",
          "ConsumerDelegationSubmitted",
          "ProducerDelegationRejected",
          "ProducerDelegationSubmitted"
        ),
      },
      () => {
        logger.info(
          `No document generation needed for ${decodedMessage.type} message`
        );
      }
    )
    .exhaustive();
}
