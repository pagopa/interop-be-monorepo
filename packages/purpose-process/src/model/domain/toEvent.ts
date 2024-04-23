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

export const toCreateEventPurposeVersionRejected = ({
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

export const toCreateEventDraftPurposeDeleted = ({
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
    type: "DraftPurposeDeleted",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose) },
  },
  correlationId,
});

export const toCreateEventWaitingForApprovalPurposeDeleted = ({
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
    type: "WaitingForApprovalPurposeDeleted",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose) },
  },
  correlationId,
});

export const toCreateEventPurposeArchived = ({
  purpose,
  purposeVersionId,
  version,
  correlationId,
}: {
  purpose: Purpose;
  purposeVersionId: PurposeVersionId;
  version: number;
  correlationId: string;
}): CreateEvent<PurposeEvent> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "PurposeArchived",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose), versionId: purposeVersionId },
  },
  correlationId,
});

export const toCreateEventPurposeSuspendedByConsumer = ({
  purpose,
  purposeVersionId,
  version,
  correlationId,
}: {
  purpose: Purpose;
  purposeVersionId: PurposeVersionId;
  version: number;
  correlationId: string;
}): CreateEvent<PurposeEvent> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "PurposeVersionSuspendedByConsumer",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose), versionId: purposeVersionId },
  },
  correlationId,
});

export const toCreateEventPurposeSuspendedByProducer = ({
  purpose,
  purposeVersionId,
  version,
  correlationId,
}: {
  purpose: Purpose;
  purposeVersionId: PurposeVersionId;
  version: number;
  correlationId: string;
}): CreateEvent<PurposeEvent> => ({
  streamId: purpose.id,
  version,
  event: {
    type: "PurposeVersionSuspendedByProducer",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose), versionId: purposeVersionId },
  },
  correlationId,
});

export function toCreateEventPurposeAdded(
  purpose: Purpose,
  correlationId: string
): CreateEvent<PurposeEvent> {
  return {
    streamId: purpose.id,
    version: 0,
    event: {
      type: "PurposeAdded",
      event_version: 2,
      data: {
        purpose: toPurposeV2(purpose),
      },
    },
    correlationId,
  };
}
