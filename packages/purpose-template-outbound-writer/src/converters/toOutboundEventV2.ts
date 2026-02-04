import {
  EServiceDescriptorV2,
  EServiceDocumentV2,
  EServiceTemplateVersionRefV2,
  EServiceV2,
  PurposeTemplateEventEnvelopeV2,
  PurposeTemplateV2,
  TemplateInstanceInterfaceMetadataV2,
} from "pagopa-interop-models";
import {
  PurposeTemplateEvent as OutboundPurposeTemplateEvent,
  PurposeTemplateV2 as OutboundPurposeTemplateV2,
  EServiceV2 as OutboundEServiceV2,
  EServiceDescriptorV2 as OutboundEServiceDescriptorV2,
  EServiceDocumentV2 as OutboundEServiceDocumentV2,
  EServiceTemplateVersionRefV2 as OutboundEServiceTemplateVersionRefV2,
  TemplateInstanceInterfaceMetadataV2 as OutboundTemplateInstanceInterfaceMetadataV2,
} from "@pagopa/interop-outbound-models";
import { match } from "ts-pattern";
import { Exact } from "pagopa-interop-commons";

function toOutboundEServiceDocumentV2(
  document: EServiceDocumentV2
): Exact<OutboundEServiceDocumentV2, EServiceDocumentV2> {
  return {
    ...document,
    path: undefined,
  };
}

function toOutboundTemplateInstanceInterfaceMetadataV2(
  interfaceMetadata: TemplateInstanceInterfaceMetadataV2
): Exact<
  OutboundTemplateInstanceInterfaceMetadataV2,
  TemplateInstanceInterfaceMetadataV2
> {
  return {
    contactEmail: interfaceMetadata.contactEmail,
    contactName: interfaceMetadata.contactName,
    contactUrl: interfaceMetadata.contactUrl,
    termsAndConditionsUrl: interfaceMetadata.termsAndConditionsUrl,
  };
}

function toOutboundEServiceTemplateVersionRefV2(
  templateVersionRef: EServiceTemplateVersionRefV2
): Exact<OutboundEServiceTemplateVersionRefV2, EServiceTemplateVersionRefV2> {
  return {
    id: templateVersionRef.id,
    interfaceMetadata:
      templateVersionRef.interfaceMetadata &&
      toOutboundTemplateInstanceInterfaceMetadataV2(
        templateVersionRef.interfaceMetadata
      ),
  };
}

function toOutboundDescriptorV2(
  descriptor: EServiceDescriptorV2
): Exact<OutboundEServiceDescriptorV2, EServiceDescriptorV2> {
  // @ts-ignore () TODO Update @pagopa/interop-outbound-models to support dailyCalls
  return {
    ...descriptor,
    interface:
      descriptor.interface &&
      toOutboundEServiceDocumentV2(descriptor.interface),
    docs: descriptor.docs.map(toOutboundEServiceDocumentV2),
    templateVersionRef:
      descriptor.templateVersionRef &&
      toOutboundEServiceTemplateVersionRefV2(descriptor.templateVersionRef),
  };
}

function toOutboundEServiceV2(
  eservice: EServiceV2
): Exact<OutboundEServiceV2, EServiceV2> {
  return {
    ...eservice,
    riskAnalysis: undefined,
    descriptors: eservice.descriptors.map(toOutboundDescriptorV2),
    templateId: eservice.templateId,
  };
}

function toOutboundPurposeTemplateV2(
  purpose: PurposeTemplateV2
): Exact<OutboundPurposeTemplateV2, PurposeTemplateV2> {
  return {
    id: purpose.id,
    targetDescription: purpose.targetDescription,
    targetTenantKind: purpose.targetTenantKind,
    creatorId: purpose.creatorId,
    state: purpose.state,
    createdAt: purpose.createdAt,
    updatedAt: purpose.updatedAt,
    purposeTitle: purpose.purposeTitle,
    purposeDescription: purpose.purposeDescription,
    purposeIsFreeOfCharge: purpose.purposeIsFreeOfCharge,
    purposeFreeOfChargeReason: purpose.purposeFreeOfChargeReason,
    purposeDailyCalls: purpose.purposeDailyCalls,
    handlesPersonalData: purpose.handlesPersonalData,
  };
}

export function toOutboundEventV2(
  message: PurposeTemplateEventEnvelopeV2
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
      { type: "RiskAnalysisTemplateDocumentGenerated" },
      { type: "RiskAnalysisTemplateSignedDocumentGenerated" },
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
        timestamp: new Date().toISOString(),
      })
    )
    .with({ type: "PurposeTemplateAnnotationDocumentUpdated" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        purposeTemplate:
          msg.data.purposeTemplate &&
          toOutboundPurposeTemplateV2(msg.data.purposeTemplate),
        documentId: msg.data.documentId,
        answerId: msg.data.answerId,
      },
      stream_id: msg.stream_id,
      timestamp: new Date().toISOString(),
    }))

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
        timestamp: new Date().toISOString(),
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
        eservice: msg.data.eservice && toOutboundEServiceV2(msg.data.eservice),
        descriptorId: msg.data.descriptorId,
        createdAt: msg.data.createdAt,
      },
      stream_id: msg.stream_id,
      timestamp: new Date().toISOString(),
    }))
    .with({ type: "PurposeTemplateEServiceUnlinked" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        purposeTemplate:
          msg.data.purposeTemplate &&
          toOutboundPurposeTemplateV2(msg.data.purposeTemplate),
        eservice: msg.data.eservice && toOutboundEServiceV2(msg.data.eservice),
        descriptorId: msg.data.descriptorId,
      },
      stream_id: msg.stream_id,
      timestamp: new Date().toISOString(),
    }))
    .exhaustive();
}
