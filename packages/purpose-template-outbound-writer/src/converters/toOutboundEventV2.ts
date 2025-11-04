import {
  PurposeEventEnvelopeV2,
  PurposeVersionV2,
  PurposeV2,
  PurposeVersionStampsV2,
  PurposeVersionStampV2,
} from "pagopa-interop-models";
import {
  PurposeTemplateEvent as OutboundPurposeTemplateEvent,
  PurposeTemplateVersionV2 as OutboundPurposeTemplateVersionV2,
  PurposeTemplateV2 as OutboundPurposeTemplateV2,
  PurposeTemplateVersionStampsV2 as OutboundPurposeTemplateVersionStampsV2,
  PurposeTemplateVersionStampV2 as OutboundPurposeTemplateVersionStampV2,
} from "@pagopa/interop-outbound-models";
import { match } from "ts-pattern";
import { Exact } from "pagopa-interop-commons";

function toOutboundPurposeTemplateVersionStampV2(
  stamp: PurposeVersionStampV2
): Exact<OutboundPurposeTemplateVersionStampV2, PurposeVersionStampV2> {
  return {
    ...stamp,
    who: undefined,
  };
}

function toOutboundPurposeTemplateVersionStampsV2(
  stamps: PurposeVersionStampsV2
): Exact<OutboundPurposeTemplateVersionStampsV2, PurposeVersionStampsV2> {
  return {
    creation:
      stamps.creation &&
      toOutboundPurposeTemplateVersionStampV2(stamps.creation),
  };
}

function toOutboundPurposeTemplateVersionV2(
  purposeVersion: PurposeVersionV2
): Exact<OutboundPurposeTemplateVersionV2, PurposeVersionV2> {
  return {
    ...purposeVersion,
    riskAnalysis: undefined,
    stamps:
      purposeVersion.stamps &&
      toOutboundPurposeTemplateVersionStampsV2(purposeVersion.stamps),
  };
}

function toOutboundPurposeTemplateV2(
  purpose: PurposeV2
): Exact<OutboundPurposeTemplateV2, PurposeV2> {
  return {
    ...purpose,
    versions: purpose.versions.map(toOutboundPurposeTemplateVersionV2),
    riskAnalysisForm: undefined,
    purposeTemplateId: undefined,
  };
}

export function toOutboundEventV2(
  message: PurposeEventEnvelopeV2
): OutboundPurposeTemplateEvent {
  return match(message)
    .returnType<OutboundPurposeTemplateEvent>()
    .with(
      { type: "PurposeTemplateAdded" },
      { type: "PurposeTemplateDraftUpdated" },
      { type: "PurposeTemplateDraftDeleted" },
      { type: "PurposeTemplatePublished" },
      { type: "PurposeTemplateUnsuspended" },
      { type: "PurposeTemplateSuspended" },
      { type: "PurposeTemplateArchived" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          purposeTemplate:
            msg.data.purposeTemplate &&
            toOutboundPurposeTemplateV2(msg.data.purposeTemplate),
        },
        stream_id: msg.stream_id,
        streamVersion: msg.version,
        timestamp: new Date(),
      })
    )
    .with(
      { type: "PurposeTemplateAnnotationDocumentDeleted" },
      { type: "PurposeTemplateAnnotationDocumentAdded" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          purposeTemplate:
            msg.data.purposeTemplate &&
            toOutboundPurposeTemplateV2(msg.data.purposeTemplate),
          documentId: msg.data.documentId,
        },
        stream_id: msg.stream_id,
        streamVersion: msg.version,
        timestamp: new Date(),
      })
    )
    .with({ type: "PurposeTemplateEServiceLinked" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        purposeTemplate:
          msg.data.purposeTemplate &&
          toOutboundPurposeTemplateV2(msg.data.purposeTemplate),
        eservice: msg.data.eservice && toOutboundEserviceV2(msg.data.eservice),
        descriptorId: msg.data.descriptorId,
        createdAt: msg.data.createdAt,
      },
      stream_id: msg.stream_id,
      streamVersion: msg.version,
      timestamp: new Date(),
    }))
    .with({ type: "PurposeTemplateEServiceUnlinked" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        purposeTemplate:
          msg.data.purposeTemplate &&
          toOutboundPurposeTemplateV2(msg.data.purposeTemplate),
        eservice: msg.data.eservice && toOutboundEserviceV2(msg.data.eservice),
        descriptorId: msg.data.descriptorId,
      },
      stream_id: msg.stream_id,
      streamVersion: msg.version,
      timestamp: new Date(),
    }))
    .exhaustive();
}
