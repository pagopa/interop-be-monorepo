import { match } from "ts-pattern";
import { z } from "zod";
import {
  ClonedEServiceAddedV1,
  EServiceAddedV1,
  EServiceDeletedV1,
  EServiceDescriptorAddedV1,
  EServiceDescriptorUpdatedV1,
  EServiceDocumentAddedV1,
  EServiceDocumentDeletedV1,
  EServiceDocumentUpdatedV1,
  EServiceRiskAnalysisAddedV1,
  EServiceRiskAnalysisDeletedV1,
  EServiceRiskAnalysisUpdatedV1,
  EServiceUpdatedV1,
  EServiceWithDescriptorsDeletedV1,
  MovedAttributesFromEserviceToDescriptorsV1,
} from "../gen/v1/eservice/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";
import { EventEnvelope } from "../events/events.js";
import {
  DraftEServiceUpdatedV2,
  EServiceAddedV2,
  EServiceClonedV2,
  EServiceDeletedV2,
  EServiceDescriptorActivatedV2,
  EServiceDescriptorAddedV2,
  EServiceDescriptorArchivedV2,
  EServiceDescriptorDocumentAddedV2,
  EServiceDescriptorDocumentDeletedV2,
  EServiceDescriptorDocumentUpdatedV2,
  EServiceDescriptorInterfaceAddedV2,
  EServiceDescriptorInterfaceDeletedV2,
  EServiceDescriptorInterfaceUpdatedV2,
  EServiceDescriptorPublishedV2,
  EServiceDescriptorSuspendedV2,
  EServiceDraftDescriptorDeletedV2,
  EServiceDraftDescriptorUpdatedV2,
  EServiceRiskAnalysisAddedV2,
  EServiceDescriptorQuotasUpdatedV2,
  EServiceRiskAnalysisUpdatedV2,
  EServiceRiskAnalysisDeletedV2,
  EServiceDescriptionUpdatedV2,
  EServiceIsConsumerDelegableEnabledV2,
  EServiceIsConsumerDelegableDisabledV2,
  EServiceIsClientAccessDelegableEnabledV2,
  EServiceIsClientAccessDelegableDisabledV2,
  EServiceDescriptorSubmittedByDelegateV2,
  EServiceDescriptorApprovedByDelegatorV2,
  EServiceDescriptorRejectedByDelegatorV2,
  EServiceDescriptorAttributesUpdatedV2,
  EServiceNameUpdatedV2,
  EServiceNameUpdatedByTemplateUpdateV2,
  EServiceDescriptionUpdatedByTemplateUpdateV2,
  EServiceDescriptorQuotasUpdatedByTemplateUpdateV2,
  EServiceDescriptorAttributesUpdatedByTemplateUpdateV2,
  EServiceDescriptorDocumentAddedByTemplateUpdateV2,
  EServiceDescriptorDocumentUpdatedByTemplateUpdateV2,
  EServiceDescriptorDocumentDeletedByTemplateUpdateV2,
  EServiceDescriptorAgreementApprovalPolicyUpdatedV2,
  EServiceSignalHubEnabledV2,
  EServiceSignalHubDisabledV2,
  EServicePersonalDataFlagUpdatedAfterPublicationV2,
  EServicePersonalDataFlagUpdatedByTemplateUpdateV2,
} from "../gen/v2/eservice/events.js";

export function catalogEventToBinaryData(event: EServiceEvent): Uint8Array {
  return match(event)
    .with({ event_version: 1 }, catalogEventToBinaryDataV1)
    .with({ event_version: 2 }, catalogEventToBinaryDataV2)
    .exhaustive();
}

export function catalogEventToBinaryDataV1(event: EServiceEventV1): Uint8Array {
  return match(event)
    .with({ type: "EServiceAdded" }, ({ data }) =>
      EServiceAddedV1.toBinary(data)
    )
    .with({ type: "ClonedEServiceAdded" }, ({ data }) =>
      ClonedEServiceAddedV1.toBinary(data)
    )
    .with({ type: "EServiceUpdated" }, ({ data }) =>
      EServiceUpdatedV1.toBinary(data)
    )
    .with({ type: "EServiceWithDescriptorsDeleted" }, ({ data }) =>
      EServiceWithDescriptorsDeletedV1.toBinary(data)
    )
    .with({ type: "EServiceDocumentUpdated" }, ({ data }) =>
      EServiceDocumentUpdatedV1.toBinary(data)
    )
    .with({ type: "EServiceDeleted" }, ({ data }) =>
      EServiceDeletedV1.toBinary(data)
    )
    .with({ type: "EServiceDocumentAdded" }, ({ data }) =>
      EServiceDocumentAddedV1.toBinary(data)
    )
    .with({ type: "EServiceDocumentDeleted" }, ({ data }) =>
      EServiceDocumentDeletedV1.toBinary(data)
    )
    .with({ type: "EServiceDescriptorAdded" }, ({ data }) =>
      EServiceDescriptorAddedV1.toBinary(data)
    )
    .with({ type: "EServiceDescriptorUpdated" }, ({ data }) =>
      EServiceDescriptorUpdatedV1.toBinary(data)
    )
    .with({ type: "MovedAttributesFromEserviceToDescriptors" }, ({ data }) =>
      MovedAttributesFromEserviceToDescriptorsV1.toBinary(data)
    )
    .with({ type: "EServiceRiskAnalysisAdded" }, ({ data }) =>
      EServiceRiskAnalysisAddedV1.toBinary(data)
    )
    .with({ type: "EServiceRiskAnalysisUpdated" }, ({ data }) =>
      EServiceRiskAnalysisUpdatedV1.toBinary(data)
    )
    .with({ type: "EServiceRiskAnalysisDeleted" }, ({ data }) =>
      EServiceRiskAnalysisDeletedV1.toBinary(data)
    )
    .exhaustive();
}

export function catalogEventToBinaryDataV2(event: EServiceEventV2): Uint8Array {
  return match(event)
    .with({ type: "EServiceAdded" }, ({ data }) =>
      EServiceAddedV2.toBinary(data)
    )
    .with({ type: "DraftEServiceUpdated" }, ({ data }) =>
      DraftEServiceUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceDeleted" }, ({ data }) =>
      EServiceDeletedV2.toBinary(data)
    )
    .with({ type: "EServiceCloned" }, ({ data }) =>
      EServiceClonedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorAdded" }, ({ data }) =>
      EServiceDescriptorAddedV2.toBinary(data)
    )
    .with({ type: "EServiceDraftDescriptorUpdated" }, ({ data }) =>
      EServiceDraftDescriptorUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorQuotasUpdated" }, ({ data }) =>
      EServiceDescriptorQuotasUpdatedV2.toBinary(data)
    )
    .with(
      { type: "EServiceDescriptorAgreementApprovalPolicyUpdated" },
      ({ data }) =>
        EServiceDescriptorAgreementApprovalPolicyUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorActivated" }, ({ data }) =>
      EServiceDescriptorActivatedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorArchived" }, ({ data }) =>
      EServiceDescriptorArchivedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorPublished" }, ({ data }) =>
      EServiceDescriptorPublishedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorSuspended" }, ({ data }) =>
      EServiceDescriptorSuspendedV2.toBinary(data)
    )
    .with({ type: "EServiceDraftDescriptorDeleted" }, ({ data }) =>
      EServiceDraftDescriptorDeletedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorInterfaceAdded" }, ({ data }) =>
      EServiceDescriptorInterfaceAddedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorDocumentAdded" }, ({ data }) =>
      EServiceDescriptorDocumentAddedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorInterfaceUpdated" }, ({ data }) =>
      EServiceDescriptorInterfaceUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorDocumentUpdated" }, ({ data }) =>
      EServiceDescriptorDocumentUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorInterfaceDeleted" }, ({ data }) =>
      EServiceDescriptorInterfaceDeletedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorDocumentDeleted" }, ({ data }) =>
      EServiceDescriptorDocumentDeletedV2.toBinary(data)
    )
    .with({ type: "EServiceRiskAnalysisAdded" }, ({ data }) =>
      EServiceRiskAnalysisAddedV2.toBinary(data)
    )
    .with({ type: "EServiceRiskAnalysisUpdated" }, ({ data }) =>
      EServiceRiskAnalysisUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceRiskAnalysisDeleted" }, ({ data }) =>
      EServiceRiskAnalysisDeletedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptionUpdated" }, ({ data }) =>
      EServiceDescriptionUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorSubmittedByDelegate" }, ({ data }) =>
      EServiceDescriptorSubmittedByDelegateV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorApprovedByDelegator" }, ({ data }) =>
      EServiceDescriptorApprovedByDelegatorV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorRejectedByDelegator" }, ({ data }) =>
      EServiceDescriptorRejectedByDelegatorV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptorAttributesUpdated" }, ({ data }) =>
      EServiceDescriptorAttributesUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceIsConsumerDelegableEnabled" }, ({ data }) =>
      EServiceIsConsumerDelegableEnabledV2.toBinary(data)
    )
    .with({ type: "EServiceIsConsumerDelegableDisabled" }, ({ data }) =>
      EServiceIsConsumerDelegableDisabledV2.toBinary(data)
    )
    .with({ type: "EServiceIsClientAccessDelegableEnabled" }, ({ data }) =>
      EServiceIsClientAccessDelegableEnabledV2.toBinary(data)
    )
    .with({ type: "EServiceIsClientAccessDelegableDisabled" }, ({ data }) =>
      EServiceIsClientAccessDelegableDisabledV2.toBinary(data)
    )
    .with({ type: "EServiceNameUpdated" }, ({ data }) =>
      EServiceNameUpdatedV2.toBinary(data)
    )
    .with({ type: "EServiceNameUpdatedByTemplateUpdate" }, ({ data }) =>
      EServiceNameUpdatedByTemplateUpdateV2.toBinary(data)
    )
    .with({ type: "EServiceDescriptionUpdatedByTemplateUpdate" }, ({ data }) =>
      EServiceDescriptionUpdatedByTemplateUpdateV2.toBinary(data)
    )
    .with(
      { type: "EServiceDescriptorQuotasUpdatedByTemplateUpdate" },
      ({ data }) =>
        EServiceDescriptorQuotasUpdatedByTemplateUpdateV2.toBinary(data)
    )
    .with(
      { type: "EServiceDescriptorAttributesUpdatedByTemplateUpdate" },
      ({ data }) =>
        EServiceDescriptorAttributesUpdatedByTemplateUpdateV2.toBinary(data)
    )
    .with(
      { type: "EServiceDescriptorDocumentAddedByTemplateUpdate" },
      ({ data }) =>
        EServiceDescriptorDocumentAddedByTemplateUpdateV2.toBinary(data)
    )
    .with(
      { type: "EServiceDescriptorDocumentUpdatedByTemplateUpdate" },
      ({ data }) =>
        EServiceDescriptorDocumentUpdatedByTemplateUpdateV2.toBinary(data)
    )
    .with(
      { type: "EServiceDescriptorDocumentDeletedByTemplateUpdate" },
      ({ data }) =>
        EServiceDescriptorDocumentDeletedByTemplateUpdateV2.toBinary(data)
    )
    .with({ type: "EServiceSignalHubEnabled" }, ({ data }) =>
      EServiceSignalHubEnabledV2.toBinary(data)
    )
    .with({ type: "EServiceSignalHubDisabled" }, ({ data }) =>
      EServiceSignalHubDisabledV2.toBinary(data)
    )
    .with(
      { type: "EServicePersonalDataFlagUpdatedAfterPublication" },
      ({ data }) =>
        EServicePersonalDataFlagUpdatedAfterPublicationV2.toBinary(data)
    )
    .with(
      { type: "EServicePersonalDataFlagUpdatedByTemplateUpdate" },
      ({ data }) =>
        EServicePersonalDataFlagUpdatedByTemplateUpdateV2.toBinary(data)
    )
    .exhaustive();
}

export const EServiceEventV1 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceAdded"),
    data: protobufDecoder(EServiceAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("ClonedEServiceAdded"),
    data: protobufDecoder(ClonedEServiceAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceUpdated"),
    data: protobufDecoder(EServiceUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceWithDescriptorsDeleted"),
    data: protobufDecoder(EServiceWithDescriptorsDeletedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceDocumentUpdated"),
    data: protobufDecoder(EServiceDocumentUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceDeleted"),
    data: protobufDecoder(EServiceDeletedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceDocumentAdded"),
    data: protobufDecoder(EServiceDocumentAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceDocumentDeleted"),
    data: protobufDecoder(EServiceDocumentDeletedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceDescriptorAdded"),
    data: protobufDecoder(EServiceDescriptorAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceDescriptorUpdated"),
    data: protobufDecoder(EServiceDescriptorUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("MovedAttributesFromEserviceToDescriptors"),
    data: protobufDecoder(MovedAttributesFromEserviceToDescriptorsV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceRiskAnalysisAdded"),
    data: protobufDecoder(EServiceRiskAnalysisAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceRiskAnalysisUpdated"),
    data: protobufDecoder(EServiceRiskAnalysisUpdatedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("EServiceRiskAnalysisDeleted"),
    data: protobufDecoder(EServiceRiskAnalysisDeletedV1),
  }),
]);
export type EServiceEventV1 = z.infer<typeof EServiceEventV1>;

export const EServiceEventV2 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceAdded"),
    data: protobufDecoder(EServiceAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("DraftEServiceUpdated"),
    data: protobufDecoder(DraftEServiceUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDeleted"),
    data: protobufDecoder(EServiceDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceCloned"),
    data: protobufDecoder(EServiceClonedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorAdded"),
    data: protobufDecoder(EServiceDescriptorAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDraftDescriptorUpdated"),
    data: protobufDecoder(EServiceDraftDescriptorUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorQuotasUpdated"),
    data: protobufDecoder(EServiceDescriptorQuotasUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorAgreementApprovalPolicyUpdated"),
    data: protobufDecoder(EServiceDescriptorQuotasUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorActivated"),
    data: protobufDecoder(EServiceDescriptorActivatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorArchived"),
    data: protobufDecoder(EServiceDescriptorArchivedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorPublished"),
    data: protobufDecoder(EServiceDescriptorPublishedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorSuspended"),
    data: protobufDecoder(EServiceDescriptorSuspendedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDraftDescriptorDeleted"),
    data: protobufDecoder(EServiceDraftDescriptorDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorInterfaceAdded"),
    data: protobufDecoder(EServiceDescriptorInterfaceAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorDocumentAdded"),
    data: protobufDecoder(EServiceDescriptorDocumentAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorInterfaceUpdated"),
    data: protobufDecoder(EServiceDescriptorInterfaceUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorDocumentUpdated"),
    data: protobufDecoder(EServiceDescriptorDocumentUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorInterfaceDeleted"),
    data: protobufDecoder(EServiceDescriptorInterfaceDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorDocumentDeleted"),
    data: protobufDecoder(EServiceDescriptorDocumentDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceRiskAnalysisAdded"),
    data: protobufDecoder(EServiceRiskAnalysisAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceRiskAnalysisUpdated"),
    data: protobufDecoder(EServiceRiskAnalysisUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceRiskAnalysisDeleted"),
    data: protobufDecoder(EServiceRiskAnalysisDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptionUpdated"),
    data: protobufDecoder(EServiceDescriptionUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorSubmittedByDelegate"),
    data: protobufDecoder(EServiceDescriptorSubmittedByDelegateV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorApprovedByDelegator"),
    data: protobufDecoder(EServiceDescriptorApprovedByDelegatorV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorRejectedByDelegator"),
    data: protobufDecoder(EServiceDescriptorRejectedByDelegatorV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorAttributesUpdated"),
    data: protobufDecoder(EServiceDescriptorAttributesUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceIsConsumerDelegableEnabled"),
    data: protobufDecoder(EServiceIsConsumerDelegableEnabledV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceIsConsumerDelegableDisabled"),
    data: protobufDecoder(EServiceIsConsumerDelegableDisabledV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceIsClientAccessDelegableEnabled"),
    data: protobufDecoder(EServiceIsClientAccessDelegableEnabledV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceIsClientAccessDelegableDisabled"),
    data: protobufDecoder(EServiceIsClientAccessDelegableDisabledV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceNameUpdated"),
    data: protobufDecoder(EServiceNameUpdatedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceNameUpdatedByTemplateUpdate"),
    data: protobufDecoder(EServiceNameUpdatedByTemplateUpdateV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptionUpdatedByTemplateUpdate"),
    data: protobufDecoder(EServiceDescriptionUpdatedByTemplateUpdateV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorQuotasUpdatedByTemplateUpdate"),
    data: protobufDecoder(EServiceDescriptorQuotasUpdatedByTemplateUpdateV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorAttributesUpdatedByTemplateUpdate"),
    data: protobufDecoder(
      EServiceDescriptorAttributesUpdatedByTemplateUpdateV2
    ),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorDocumentAddedByTemplateUpdate"),
    data: protobufDecoder(EServiceDescriptorDocumentAddedByTemplateUpdateV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorDocumentUpdatedByTemplateUpdate"),
    data: protobufDecoder(EServiceDescriptorDocumentUpdatedByTemplateUpdateV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceDescriptorDocumentDeletedByTemplateUpdate"),
    data: protobufDecoder(EServiceDescriptorDocumentDeletedByTemplateUpdateV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceSignalHubEnabled"),
    data: protobufDecoder(EServiceSignalHubEnabledV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServiceSignalHubDisabled"),
    data: protobufDecoder(EServiceSignalHubDisabledV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServicePersonalDataFlagUpdatedAfterPublication"),
    data: protobufDecoder(EServicePersonalDataFlagUpdatedAfterPublicationV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("EServicePersonalDataFlagUpdatedByTemplateUpdate"),
    data: protobufDecoder(EServicePersonalDataFlagUpdatedByTemplateUpdateV2),
  }),
]);
export type EServiceEventV2 = z.infer<typeof EServiceEventV2>;

const eventV1 = z
  .object({
    event_version: z.literal(1),
  })
  .passthrough();
const eventV2 = z
  .object({
    event_version: z.literal(2),
  })
  .passthrough();

export const EServiceEvent = z
  .discriminatedUnion("event_version", [eventV1, eventV2])
  .transform((obj, ctx) => {
    const res = match(obj)
      .with({ event_version: 1 }, () => EServiceEventV1.safeParse(obj))
      .with({ event_version: 2 }, () => EServiceEventV2.safeParse(obj))
      .exhaustive();

    if (!res.success) {
      res.error.issues.forEach(ctx.addIssue);
      return z.NEVER;
    }
    return res.data;
  });

export type EServiceEvent = z.infer<typeof EServiceEvent>;

export const EServiceEventEnvelopeV1 = EventEnvelope(EServiceEventV1);
export type EServiceEventEnvelopeV1 = z.infer<typeof EServiceEventEnvelopeV1>;

export const EServiceEventEnvelopeV2 = EventEnvelope(EServiceEventV2);
export type EServiceEventEnvelopeV2 = z.infer<typeof EServiceEventEnvelopeV2>;

export const EServiceEventEnvelope = EventEnvelope(EServiceEvent);
export type EServiceEventEnvelope = z.infer<typeof EServiceEventEnvelope>;
