import {
  PurposeEventEnvelopeV2,
  PurposeVersionV2,
  PurposeV2,
  PurposeVersionStampsV2,
  PurposeVersionStampV2,
} from "pagopa-interop-models";
import {
  PurposeEvent as OutboundPurposeEvent,
  PurposeVersionV2 as OutboundPurposeVersionV2,
  PurposeV2 as OutboundPurposeV2,
  PurposeVersionStampsV2 as OutboundPurposeVersionStampsV2,
  PurposeVersionStampV2 as OutboundPurposeVersionStampV2,
} from "@pagopa/interop-outbound-models";
import { match } from "ts-pattern";
import { Exact } from "pagopa-interop-commons";

function toOutboundPurposeVersionStampV2(
  stamp: PurposeVersionStampV2
): Exact<OutboundPurposeVersionStampV2, PurposeVersionStampV2> {
  return {
    ...stamp,
    who: undefined,
  };
}

function toOutboundPurposeVersionStampsV2(
  stamps: PurposeVersionStampsV2
): Exact<OutboundPurposeVersionStampsV2, PurposeVersionStampsV2> {
  return {
    creation:
      stamps.creation && toOutboundPurposeVersionStampV2(stamps.creation),
  };
}

function toOutboundPurposeVersionV2(
  purposeVersion: PurposeVersionV2
): Exact<OutboundPurposeVersionV2, PurposeVersionV2> {
  return {
    ...purposeVersion,
    riskAnalysis: undefined,
    stamps:
      purposeVersion.stamps &&
      toOutboundPurposeVersionStampsV2(purposeVersion.stamps),
  };
}

function toOutboundPurposeV2(
  purpose: PurposeV2
): Exact<OutboundPurposeV2, PurposeV2> {
  return {
    ...purpose,
    versions: purpose.versions.map(toOutboundPurposeVersionV2),
    riskAnalysisForm: undefined,
  };
}

export function toOutboundEventV2(
  message: PurposeEventEnvelopeV2
): OutboundPurposeEvent {
  return match(message)
    .returnType<OutboundPurposeEvent>()
    .with(
      { type: "PurposeAdded" },
      { type: "DraftPurposeUpdated" },
      { type: "PurposeWaitingForApproval" },
      { type: "PurposeActivated" },
      { type: "DraftPurposeDeleted" },
      { type: "WaitingForApprovalPurposeDeleted" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          purpose: msg.data.purpose && toOutboundPurposeV2(msg.data.purpose),
        },
        stream_id: msg.stream_id,
        streamVersion: msg.version,
        timestamp: new Date(),
      })
    )
    .with(
      { type: "NewPurposeVersionActivated" },
      { type: "PurposeVersionActivated" },
      { type: "PurposeVersionUnsuspendedByProducer" },
      { type: "PurposeVersionUnsuspendedByConsumer" },
      { type: "PurposeVersionSuspendedByProducer" },
      { type: "PurposeVersionSuspendedByConsumer" },
      { type: "NewPurposeVersionWaitingForApproval" },
      { type: "PurposeVersionOverQuotaUnsuspended" },
      { type: "PurposeArchived" },
      { type: "WaitingForApprovalPurposeVersionDeleted" },
      { type: "PurposeVersionRejected" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          purpose: msg.data.purpose && toOutboundPurposeV2(msg.data.purpose),
          versionId: msg.data.versionId,
        },
        stream_id: msg.stream_id,
        streamVersion: msg.version,
        timestamp: new Date(),
      })
    )
    .with({ type: "PurposeCloned" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        sourcePurposeId: msg.data.sourcePurposeId,
        sourceVersionId: msg.data.sourceVersionId,
        purpose: msg.data.purpose && toOutboundPurposeV2(msg.data.purpose),
      },
      stream_id: msg.stream_id,
      streamVersion: msg.version,
      timestamp: new Date(),
    }))
    .with({ type: "PurposeDeletedByRevokedDelegation" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        purpose: msg.data.purpose && toOutboundPurposeV2(msg.data.purpose),
        delegationId: msg.data.delegationId,
      },
      stream_id: msg.stream_id,
      streamVersion: msg.version,
      timestamp: new Date(),
    }))
    .with({ type: "PurposeVersionArchivedByRevokedDelegation" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        purpose: msg.data.purpose && toOutboundPurposeV2(msg.data.purpose),
        versionId: msg.data.versionId,
        delegationId: msg.data.delegationId,
      },
      stream_id: msg.stream_id,
      streamVersion: msg.version,
      timestamp: new Date(),
    }))
    .exhaustive();
}
