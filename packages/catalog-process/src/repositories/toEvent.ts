import { v4 as uuidv4 } from "uuid";
import { EService, Document, Descriptor } from "pagopa-interop-models";
import { WithMetadata } from "../model/domain/models.js";
import { CreateEvent } from "./EventRepository.js";

export const toCreateEventEServiceAdded = (eService: EService): CreateEvent => {
  const streamId = uuidv4();
  return {
    streamId,
    version: 0,
    event: {
      type: "EServiceAdded",
      data: {
        eService,
      },
    },
  };
};

export const toCreateEventClonedEServiceAdded = (
  eService: EService
): CreateEvent => {
  const streamId = uuidv4();
  return {
    streamId,
    version: 0,
    event: {
      type: "ClonedEServiceAdded",
      data: {
        eService,
      },
    },
  };
};

export const toCreateEventEServiceDocumentItemAdded = (
  streamId: string,
  version: number,
  descriptorId: string,
  {
    newDocument,
    isInterface,
    serverUrls,
  }: { newDocument: Document; isInterface: boolean; serverUrls: string[] }
): CreateEvent => ({
  streamId,
  version,
  event: {
    type: "EServiceDocumentAdded",
    data: {
      eServiceId: streamId,
      descriptorId,
      document: newDocument,
      isInterface,
      serverUrls,
    },
  },
});

export const toCreateEventEServiceDescriptorAdded = (
  streamId: string,
  version: number,
  newDescriptor: Descriptor
): CreateEvent => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorAdded",
    data: {
      eServiceId: streamId,
      eServiceDescriptor: newDescriptor,
    },
  },
});

export const toCreateEventEServiceUpdated = (
  streamId: string,
  version: number,
  updatedEService: EService
): CreateEvent => ({
  streamId,
  version,
  event: {
    type: "EServiceUpdated",
    data: {
      eService: updatedEService,
    },
  },
});

export const toCreateEventEServiceDocumentUpdated = ({
  streamId,
  version,
  descriptorId,
  documentId,
  updatedDocument,
  serverUrls,
}: {
  streamId: string;
  version: number;
  descriptorId: string;
  documentId: string;
  updatedDocument: Document;
  serverUrls: string[];
}): CreateEvent => ({
  streamId,
  version,
  event: {
    type: "EServiceDocumentUpdated",
    data: {
      eServiceId: streamId,
      descriptorId,
      documentId,
      updatedDocument,
      serverUrls,
    },
  },
});

export const toCreateEventEServiceDescriptorUpdated = (
  streamId: string,
  version: number,
  descriptor: Descriptor
): CreateEvent => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorUpdated",
    data: {
      eServiceId: streamId,
      eServiceDescriptor: descriptor,
    },
  },
});

export const toCreateEventEServiceDeleted = (
  streamId: string,
  version: number
): CreateEvent => ({
  streamId,
  version,
  event: {
    type: "EServiceDeleted",
    data: {
      eServiceId: streamId,
    },
  },
});

export const toCreateEventEServiceDocumentDeleted = (
  streamId: string,
  version: number,
  descriptorId: string,
  documentId: string
): CreateEvent => ({
  streamId,
  version,
  event: {
    type: "EServiceDocumentDeleted",
    data: {
      eServiceId: streamId,
      descriptorId,
      documentId,
    },
  },
});

export const toCreateEventEServiceWithDescriptorsDeleted = (
  eService: WithMetadata<EService>,
  descriptorId: string
): CreateEvent => ({
  streamId: eService.data.id,
  version: eService.metadata.version,
  event: {
    type: "EServiceWithDescriptorsDeleted",
    data: {
      eService: eService.data,
      descriptorId,
    },
  },
});
