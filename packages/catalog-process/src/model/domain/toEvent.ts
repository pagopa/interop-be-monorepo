import { CreateEvent } from "pagopa-interop-commons";
import {
  EService,
  EServiceEvent,
  DescriptorId,
  EServiceDocumentId,
  RiskAnalysisId,
  toEServiceV2,
} from "pagopa-interop-models";

export const toCreateEventEServiceAdded = (
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId: eservice.id,
  version: 0,
  event: {
    type: "EServiceAdded",
    event_version: 2,
    data: { eservice: toEServiceV2(eservice) },
  },
});

export const toCreateEventClonedEServiceAdded = (
  sourceDescriptorId: DescriptorId,
  sourceEservice: EService,
  clonedEservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId: clonedEservice.id,
  version: 0,
  event: {
    type: "EServiceCloned",
    event_version: 2,
    data: {
      sourceDescriptorId,
      sourceEservice: toEServiceV2(sourceEservice),
      eservice: toEServiceV2(clonedEservice),
    },
  },
});

export const toCreateEventEServiceInterfaceAdded = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  }
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorInterfaceAdded",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDocumentAdded = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  }
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorDocumentAdded",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDescriptorAdded = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorAdded",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceUpdated = (
  streamId: string,
  version: number,
  updatedEService: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "DraftEServiceUpdated",
    event_version: 2,
    data: {
      eservice: toEServiceV2(updatedEService),
    },
  },
});

export const toCreateEventEServiceInterfaceUpdated = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  }
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorInterfaceUpdated",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDocumentUpdated = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  }
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorDocumentUpdated",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDraftDescriptorUpdated = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDraftDescriptorUpdated",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDescriptorQuotasUpdated = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorQuotasUpdated",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDescriptorActivated = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorActivated",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDescriptorArchived = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorArchived",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDescriptorPublished = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorPublished",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDescriptorSuspended = (
  streamId: string,
  version: number,
  descriptorId: DescriptorId,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorSuspended",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDeleted = (
  streamId: string,
  version: number,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDeleted",
    event_version: 2,
    data: {
      eserviceId: streamId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceInterfaceDeleted = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  }
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorInterfaceDeleted",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
});
export const toCreateEventEServiceDocumentDeleted = (
  streamId: string,
  version: number,
  {
    descriptorId,
    documentId,
    eservice,
  }: {
    descriptorId: DescriptorId;
    documentId: EServiceDocumentId;
    eservice: EService;
  }
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDescriptorDocumentDeleted",
    event_version: 2,
    data: {
      descriptorId,
      documentId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceDraftDescriptorDeleted = (
  streamId: string,
  version: number,
  eservice: EService,
  descriptorId: DescriptorId
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceDraftDescriptorDeleted",
    event_version: 2,
    data: {
      eservice: toEServiceV2(eservice),
      descriptorId,
    },
  },
});

export const toCreateEventEServiceRiskAnalysisAdded = (
  streamId: string,
  version: number,
  riskAnalysisId: RiskAnalysisId,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceRiskAnalysisAdded",
    event_version: 2,
    data: {
      riskAnalysisId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceRiskAnalysisUpdated = (
  streamId: string,
  version: number,
  riskAnalysisId: RiskAnalysisId,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceRiskAnalysisUpdated",
    event_version: 2,
    data: {
      riskAnalysisId,
      eservice: toEServiceV2(eservice),
    },
  },
});

export const toCreateEventEServiceRiskAnalysisDeleted = (
  streamId: string,
  version: number,
  riskAnalysisId: RiskAnalysisId,
  eservice: EService
): CreateEvent<EServiceEvent> => ({
  streamId,
  version,
  event: {
    type: "EServiceRiskAnalysisDeleted",
    event_version: 2,
    data: {
      riskAnalysisId,
      eservice: toEServiceV2(eservice),
    },
  },
});
