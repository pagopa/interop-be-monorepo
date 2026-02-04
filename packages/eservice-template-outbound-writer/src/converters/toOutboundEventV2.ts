import {
  EServiceDocumentV2,
  EServiceTemplateEventEnvelopeV2,
  EServiceTemplateV2,
  EServiceTemplateVersionV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { Exact } from "pagopa-interop-commons";
import {
  EServiceTemplateEvent as OutboundEServiceTemplateEvent,
  EServiceTemplateV2 as OutboundEServiceTemplateV2,
  EServiceTemplateVersionV2 as OutboundEServiceTemplateVersionV2,
  EServiceDocumentV2 as OutboundEServiceDocumentV2,
} from "@pagopa/interop-outbound-models";

function toOuboundEServiceDocumentV2(
  document: EServiceDocumentV2
): Exact<OutboundEServiceDocumentV2, EServiceDocumentV2> {
  return {
    ...document,
    path: undefined,
  };
}

function toOutboundEServiceTemplateVersionV2(
  template: EServiceTemplateVersionV2
): Exact<OutboundEServiceTemplateVersionV2, EServiceTemplateVersionV2> {
  // @ts-ignore () TODO Update @pagopa/interop-outbound-models to support dailyCalls
  return {
    ...template,
    docs: template.docs.map(toOuboundEServiceDocumentV2),
    interface:
      template.interface && toOuboundEServiceDocumentV2(template.interface),
  };
}

function toOutboundEServiceTemplateV2(
  template: EServiceTemplateV2
): Exact<OutboundEServiceTemplateV2, EServiceTemplateV2> {
  return {
    ...template,
    versions: template.versions.map(toOutboundEServiceTemplateVersionV2),
    riskAnalysis: undefined,
  };
}

export function toOutboundEventV2(
  message: EServiceTemplateEventEnvelopeV2
): OutboundEServiceTemplateEvent | undefined {
  return match(message)
    .returnType<OutboundEServiceTemplateEvent | undefined>()
    .with(
      { type: "EServiceTemplateAdded" },
      { type: "EServiceTemplateDraftUpdated" },
      { type: "EServiceTemplateNameUpdated" },
      { type: "EServiceTemplateDeleted" },
      { type: "EServiceTemplateIntendedTargetUpdated" },
      { type: "EServiceTemplateDescriptionUpdated" },
      { type: "EServiceTemplatePersonalDataFlagUpdatedAfterPublication" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          eserviceTemplate:
            msg.data.eserviceTemplate &&
            toOutboundEServiceTemplateV2(msg.data.eserviceTemplate),
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .with(
      { type: "EServiceTemplateDraftVersionUpdated" },
      { type: "EServiceTemplateDraftVersionDeleted" },
      { type: "EServiceTemplateVersionPublished" },
      { type: "EServiceTemplateVersionQuotasUpdated" },
      { type: "EServiceTemplateVersionAdded" },
      { type: "EServiceTemplateVersionSuspended" },
      { type: "EServiceTemplateVersionActivated" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          eserviceTemplate:
            msg.data.eserviceTemplate &&
            toOutboundEServiceTemplateV2(msg.data.eserviceTemplate),
          eserviceTemplateVersionId: msg.data.eserviceTemplateVersionId,
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .with(
      { type: "EServiceTemplateVersionDocumentAdded" },
      { type: "EServiceTemplateVersionDocumentDeleted" },
      { type: "EServiceTemplateVersionDocumentUpdated" },
      { type: "EServiceTemplateVersionInterfaceAdded" },
      { type: "EServiceTemplateVersionInterfaceDeleted" },
      { type: "EServiceTemplateVersionInterfaceUpdated" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          eserviceTemplate:
            msg.data.eserviceTemplate &&
            toOutboundEServiceTemplateV2(msg.data.eserviceTemplate),
          eserviceTemplateVersionId: msg.data.eserviceTemplateVersionId,
          documentId: msg.data.documentId,
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .with({ type: "EServiceTemplateVersionAttributesUpdated" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        eserviceTemplate:
          msg.data.eserviceTemplate &&
          toOutboundEServiceTemplateV2(msg.data.eserviceTemplate),
        eserviceTemplateVersionId: msg.data.eserviceTemplateVersionId,
        attributeIds: msg.data.attributeIds,
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))
    .with(
      { type: "EServiceTemplateRiskAnalysisAdded" },
      { type: "EServiceTemplateRiskAnalysisDeleted" },
      { type: "EServiceTemplateRiskAnalysisUpdated" },
      () => undefined
    )
    .exhaustive();
}
