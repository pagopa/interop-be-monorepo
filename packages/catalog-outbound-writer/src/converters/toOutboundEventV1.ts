import {
  EServiceEventEnvelopeV1,
  EServiceV1,
  EServiceDescriptorV1,
  EServiceDocumentV1,
} from "pagopa-interop-models";
import {
  EServiceEvent as OutboundEServiceEvent,
  EServiceV1 as OutboundEServiceV1,
  EServiceDescriptorV1 as OutboundEServiceDescriptorV1,
  EServiceDocumentV1 as OutboundEServiceDocumentV1,
} from "@pagopa/interop-outbound-models";
import { match } from "ts-pattern";
import { Exact } from "../utils.js";

function toOuboundEServiceDocumentV1(
  document: EServiceDocumentV1
): Exact<OutboundEServiceDocumentV1, EServiceDocumentV1> {
  return {
    ...document,
    path: undefined,
  };
}

function toOutboundDescriptorV1(
  descriptor: EServiceDescriptorV1
): Exact<OutboundEServiceDescriptorV1, EServiceDescriptorV1> {
  return {
    ...descriptor,
    interface:
      descriptor.interface && toOuboundEServiceDocumentV1(descriptor.interface),
    docs: descriptor.docs.map(toOuboundEServiceDocumentV1),
  };
}

function toOutboundEServiceV1(
  eservice: EServiceV1
): Exact<OutboundEServiceV1, EServiceV1> {
  return {
    ...eservice,
    riskAnalysis: undefined,
    descriptors: eservice.descriptors.map(toOutboundDescriptorV1),
  };
}

export function toOutboundEventV1(
  message: EServiceEventEnvelopeV1
): OutboundEServiceEvent | undefined {
  return match(message)
    .returnType<OutboundEServiceEvent | undefined>()
    .with(
      { type: "EServiceAdded" },
      { type: "ClonedEServiceAdded" },
      { type: "EServiceUpdated" },
      { type: "MovedAttributesFromEserviceToDescriptors" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          eservice:
            msg.data.eservice && toOutboundEServiceV1(msg.data.eservice),
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .with({ type: "EServiceWithDescriptorsDeleted" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        descriptorId: msg.data.descriptorId,
        eservice: msg.data.eservice && toOutboundEServiceV1(msg.data.eservice),
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))
    .with({ type: "EServiceDocumentUpdated" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        eserviceId: msg.data.eserviceId,
        descriptorId: msg.data.descriptorId,
        documentId: msg.data.documentId,
        updatedDocument:
          msg.data.updatedDocument &&
          toOuboundEServiceDocumentV1(msg.data.updatedDocument),
        serverUrls: msg.data.serverUrls,
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))
    .with({ type: "EServiceDeleted" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        eserviceId: msg.data.eserviceId,
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))
    .with({ type: "EServiceDocumentAdded" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        eserviceId: msg.data.eserviceId,
        descriptorId: msg.data.descriptorId,
        document:
          msg.data.document && toOuboundEServiceDocumentV1(msg.data.document),
        isInterface: msg.data.isInterface,
        serverUrls: msg.data.serverUrls,
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))
    .with({ type: "EServiceDocumentDeleted" }, (msg) => ({
      event_version: msg.event_version,
      type: msg.type,
      version: msg.version,
      data: {
        eserviceId: msg.data.eserviceId,
        descriptorId: msg.data.descriptorId,
        documentId: msg.data.documentId,
      },
      stream_id: msg.stream_id,
      timestamp: new Date(),
    }))
    .with(
      { type: "EServiceDescriptorAdded" },
      { type: "EServiceDescriptorUpdated" },
      (msg) => ({
        event_version: msg.event_version,
        type: msg.type,
        version: msg.version,
        data: {
          eserviceId: msg.data.eserviceId,
          eserviceDescriptor:
            msg.data.eserviceDescriptor &&
            toOutboundDescriptorV1(msg.data.eserviceDescriptor),
        },
        stream_id: msg.stream_id,
        timestamp: new Date(),
      })
    )
    .with(
      { type: "EServiceRiskAnalysisAdded" },
      { type: "EServiceRiskAnalysisDeleted" },
      { type: "EServiceRiskAnalysisUpdated" },
      () => undefined
    )
    .exhaustive();
}
