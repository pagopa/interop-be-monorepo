import {
  fromPurposeV2,
  PurposeEventEnvelopeV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { M2MEventWriterServiceSQL } from "../services/m2mEventWriterServiceSQL.js";
import {
  assertPurposeEServiceExists,
  assertPurposeExistsInEvent,
} from "../services/validators.js";
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

  const eservice = await readModelService.getEServiceById(purpose.eserviceId);
  assertPurposeEServiceExists(eservice, purpose.eserviceId, purpose.id);

  return (
    match(decodedMessage)
      /**
       * Handling events related to the main Purpose resource (no versionId).
       */
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
      /**
       * Handling events related to the Purpose Versions (with versionId).
       */
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
            "RiskAnalysisSignedDocumentGenerated"
          ),
        },
        async (event) => {
          logger.info(
            `Creating Purpose M2M Event - type ${event.type}, purposeId ${purpose.id}, versionId ${event.data.versionId}`
          );

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
      .with(
        {
          /**
           * We avoid exposing the unsigned document generation.
           * The user will only be able to see only the signed one.
           */
          type: P.union("RiskAnalysisDocumentGenerated"),
        },
        () => Promise.resolve(void 0)
      )
      .exhaustive()
  );
}
