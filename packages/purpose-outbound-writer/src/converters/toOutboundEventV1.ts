import {
  PurposeEventEnvelopeV1,
  PurposeVersionV1,
  PurposeV1,
} from "pagopa-interop-models";
import {
  PurposeEvent as OutboundPurposeEvent,
  PurposeVersionV1 as OutboundPurposeVersionV1,
  PurposeV1 as OutboundPurposeV1,
} from "@pagopa/interop-outbound-models";
import { match } from "ts-pattern";
import { Exact } from "../utils.js";

function toOutboundPurposeVersionV1(
  purposeVersion: PurposeVersionV1
): Exact<OutboundPurposeVersionV1, PurposeVersionV1> {
  return {
    ...purposeVersion,
    riskAnalysis: undefined,
  };
}

function toOutboundPurposeV1(
  purpose: PurposeV1
): Exact<OutboundPurposeV1, PurposeV1> {
  return {
    ...purpose,
    versions: purpose.versions.map(toOutboundPurposeVersionV1),
    riskAnalysisForm: undefined,
  };
}

export function toOutboundEventV1(
  message: PurposeEventEnvelopeV1
): OutboundPurposeEvent {
  return match(message)
    .returnType<OutboundPurposeEvent>()
    .with(
      { type: "PurposeCreated" },
      { type: "PurposeUpdated" },
      { type: "PurposeVersionActivated" },
      { type: "PurposeVersionSuspended" },
      { type: "PurposeVersionArchived" },
      { type: "PurposeVersionWaitedForApproval" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          purpose: msg.data.purpose && toOutboundPurposeV1(msg.data.purpose),
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .with(
      { type: "PurposeVersionCreated" },
      { type: "PurposeVersionUpdated" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          purposeId: msg.data.purposeId,
          version:
            msg.data.version && toOutboundPurposeVersionV1(msg.data.version),
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .with({ type: "PurposeVersionRejected" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        purpose: msg.data.purpose && toOutboundPurposeV1(msg.data.purpose),
        versionId: msg.data.versionId,
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))
    .with({ type: "PurposeDeleted" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        purposeId: msg.data.purposeId,
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))
    .with({ type: "PurposeVersionDeleted" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        purposeId: msg.data.purposeId,
        versionId: msg.data.versionId,
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))

    .exhaustive();
}
