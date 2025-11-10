import {
  fromPurposeV2,
  PurposeEventEnvelopeV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { M2MEventWriterServiceSQL } from "../services/m2mEventWriterServiceSQL.js";
import { assertPurposeExistsInEvent } from "../services/validators.js";
import {
  createPurposeM2MEvent,
  createPurposeVersionM2MEvent,
} from "../services/event-builders/purposeM2MEventBuilder.js";
import { toPurposeM2MEventSQL } from "../models/purposeM2MEventAdapterSQL.js";

export async function handlePurposeEvent(
  decodedMessage: PurposeEventEnvelopeV2,
  eventTimestamp: Date,
  logger: Logger,
  m2mEventWriterService: M2MEventWriterServiceSQL,
  readModelService: ReadModelServiceSQL
): Promise<void> {
  assertPurposeExistsInEvent(decodedMessage);
  const purpose = fromPurposeV2(decodedMessage.data.purpose);

  return match(decodedMessage)
    .with(
      {
        type: P.union(
          "PurposeAdded",
          "DraftPurposeUpdated",
          "PurposeWaitingForApproval",
          "PurposeActivated",
          "DraftPurposeDeleted",
          "WaitingForApprovalPurposeDeleted",
          "PurposeCloned",
          "PurposeDeletedByRevokedDelegation"
        ),
      },
      async (event) => {
        logger.info(
          `Creating Purpose M2M Event - type ${event.type}, purposeId ${purpose.id}`
        );

        const eservice = await readModelService.getEServiceById(
          purpose.eserviceId
        );

        if (!eservice) {
          logger.warn(
            `Cannot find related purpose ${purpose.id} EService with id ${purpose.eserviceId}, skipping M2M event creation`
          );
          return;
        }

        const m2mEvent = createPurposeM2MEvent(
          purpose,
          eservice,
          event.version,
          event.type,
          eventTimestamp,
          await readModelService.getActiveDelegationsForAgreementOrPurpose(
            purpose
          )
        );

        await m2mEventWriterService.insertPurposeM2MEvent(
          toPurposeM2MEventSQL(m2mEvent)
        );
      }
    )
    .with(
      {
        type: P.union(
          "NewPurposeVersionWaitingForApproval",
          "PurposeVersionRejected",
          "PurposeVersionActivated",
          "PurposeArchived",
          "PurposeVersionOverQuotaUnsuspended",
          "PurposeVersionSuspendedByConsumer",
          "PurposeVersionSuspendedByProducer",
          "PurposeVersionUnsuspendedByConsumer",
          "PurposeVersionUnsuspendedByProducer",
          "WaitingForApprovalPurposeVersionDeleted",
          "NewPurposeVersionActivated",
          "PurposeVersionArchivedByRevokedDelegation",
          "RiskAnalysisDocumentGenerated",
          "RiskAnalysisSignedDocumentGenerated"
        ),
      },
      async (event) => {
        logger.info(
          `Creating Purpose M2M Event - type ${event.type}, purposeId ${purpose.id}, versionId ${event.data.versionId}`
        );

        const eservice = await readModelService.getEServiceById(
          purpose.eserviceId
        );

        if (!eservice) {
          logger.warn(
            `Cannot find related purpose ${purpose.id} EService with id ${purpose.eserviceId}, skipping M2M event creation`
          );
          return;
        }

        const m2mEvent = createPurposeVersionM2MEvent(
          purpose,
          unsafeBrandId(event.data.versionId),
          eservice,
          event.version,
          event.type,
          eventTimestamp,
          await readModelService.getActiveDelegationsForAgreementOrPurpose(
            purpose
          )
        );

        await m2mEventWriterService.insertPurposeM2MEvent(
          toPurposeM2MEventSQL(m2mEvent)
        );
      }
    )
    .exhaustive();
}
