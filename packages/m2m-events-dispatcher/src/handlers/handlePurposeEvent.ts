import { PurposeEventEnvelopeV2 } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { M2MEventServiceSQL } from "../services/m2mEventServiceSQL.js";

export async function handlePurposeEvent(
  decodedMessage: PurposeEventEnvelopeV2,
  _logger: Logger,
  _m2mEventService: M2MEventServiceSQL,
  _readModelService: ReadModelServiceSQL
): Promise<void> {
  return match(decodedMessage)
    .with(
      {
        type: P.union(
          "NewPurposeVersionWaitingForApproval",
          "PurposeWaitingForApproval",
          "PurposeVersionRejected",
          "PurposeVersionActivated",
          "DraftPurposeDeleted",
          "WaitingForApprovalPurposeDeleted",
          "PurposeAdded",
          "DraftPurposeUpdated",
          "PurposeActivated",
          "PurposeArchived",
          "PurposeVersionOverQuotaUnsuspended",
          "PurposeVersionSuspendedByConsumer",
          "PurposeVersionSuspendedByProducer",
          "PurposeVersionUnsuspendedByConsumer",
          "PurposeVersionUnsuspendedByProducer",
          "WaitingForApprovalPurposeVersionDeleted",
          "NewPurposeVersionActivated",
          "PurposeCloned",
          "PurposeDeletedByRevokedDelegation",
          "PurposeVersionArchivedByRevokedDelegation"
        ),
      },
      () => Promise.resolve(void 0)
    )
    .exhaustive();
}
