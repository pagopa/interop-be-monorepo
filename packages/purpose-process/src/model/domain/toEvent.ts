import { CreateEvent } from "pagopa-interop-commons";
import {
  Purpose,
  PurposeEvent,
  PurposeVersionId,
  toPurposeV2,
} from "pagopa-interop-models";

export const toCreateEventWaitingForApprovalPurposeVersionDeleted = ({
  purpose,
  version,
  versionId,
  correlationId,
}: {
  purpose: Purpose;
  version: number;
  versionId: PurposeVersionId;
  correlationId: string;
}): CreateEvent<PurposeEvent> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "WaitingForApprovalPurposeVersionDeleted",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose), versionId },
  },
  correlationId,
});

export const toCreateEvenPurposeVersionRejected = ({
  purpose,
  version,
  versionId,
  correlationId,
}: {
  purpose: Purpose;
  version: number;
  versionId: PurposeVersionId;
  correlationId: string;
}): CreateEvent<PurposeEvent> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "PurposeVersionRejected",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose), versionId },
  },
  correlationId,
});

export const toCreateEventDraftPurposeUpdated = ({
  purpose,
  version,
  correlationId,
}: {
  purpose: Purpose;
  version: number;
  correlationId: string;
}): CreateEvent<PurposeEvent> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "DraftPurposeUpdated",
    event_version: 2,
    data: {
      purpose: toPurposeV2(purpose),
    },
  },
  correlationId,
});
