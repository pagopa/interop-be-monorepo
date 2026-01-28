import { describe, expect, it } from "vitest";
import {
  getMockValidRiskAnalysis,
  toEServiceV1,
  toDocumentV1,
  toDescriptorV1,
  getMockDocument,
} from "pagopa-interop-commons-test";
import {
  AttributeId,
  ClonedEServiceAddedV1,
  Descriptor,
  Document,
  DraftEServiceUpdatedV2,
  EService,
  EServiceAddedV1,
  EServiceAddedV2,
  EServiceClonedV2,
  EServiceDeletedV1,
  EServiceDeletedV2,
  EServiceDescriptorActivatedV2,
  EServiceDescriptorAddedV1,
  EServiceDescriptorAddedV2,
  EServiceDescriptorArchivedV2,
  EServiceDescriptorDocumentAddedV2,
  EServiceDescriptorDocumentDeletedV2,
  EServiceDescriptorDocumentUpdatedV2,
  EServiceDescriptorInterfaceAddedV2,
  EServiceDescriptorInterfaceDeletedV2,
  EServiceDescriptorInterfaceUpdatedV2,
  EServiceDescriptorPublishedV2,
  EServiceDescriptorQuotasUpdatedV2,
  EServiceDescriptorSuspendedV2,
  EServiceDescriptorUpdatedV1,
  EServiceDocumentAddedV1,
  EServiceDocumentDeletedV1,
  EServiceDocumentUpdatedV1,
  EServiceDraftDescriptorDeletedV2,
  EServiceDraftDescriptorUpdatedV2,
  EServiceEventEnvelope,
  EServiceNameUpdatedV2,
  EServicePersonalDataFlagUpdatedAfterPublicationV2,
  EServiceRiskAnalysisAddedV1,
  EServiceRiskAnalysisAddedV2,
  EServiceRiskAnalysisDeletedV1,
  EServiceRiskAnalysisDeletedV2,
  EServiceUpdatedV1,
  EServiceWithDescriptorsDeletedV1,
  EserviceAttributes,
  MovedAttributesFromEserviceToDescriptorsV1,
  RiskAnalysis,
  descriptorState,
  eserviceMode,
  generateId,
  technology,
  toEServiceV2,
} from "pagopa-interop-models";
import { format } from "date-fns";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import { catalogReadModelService, catalogWriterService } from "./utils.js";

describe("database test", async () => {
  describe("Events V1", async () => {
    const mockEService = getMockEService();

    it("EServiceAdded", async () => {
      const payload: EServiceAddedV1 = {
        eservice: toEServiceV1(mockEService),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 1,
        type: "EServiceAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, catalogWriterService);

      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice).toMatchObject({
        data: mockEService,
        metadata: { version: 1 },
      });
    });

    it("ClonedEServiceAdded", async () => {
      await catalogWriterService.upsertEService(mockEService, 1);

      const date = new Date();
      const clonedEService: EService = {
        ...mockEService,
        id: generateId(),
        createdAt: new Date(),
        name: `${mockEService.name} - clone - ${format(
          date,
          "dd/MM/yyyy HH:mm:ss"
        )}`,
      };

      const payload: ClonedEServiceAddedV1 = {
        eservice: toEServiceV1(clonedEService),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: clonedEService.id,
        version: 1,
        type: "ClonedEServiceAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, catalogWriterService);

      const retrievedEservice = await catalogReadModelService.getEServiceById(
        clonedEService.id
      );
      expect(retrievedEservice).toMatchObject({
        data: clonedEService,
        metadata: { version: 1 },
      });
    });

    it("EServiceUpdated", async () => {
      await catalogWriterService.upsertEService(mockEService, 1);
      const updatedEService: EService = {
        ...mockEService,
        description: "updated description",
      };
      const payload: EServiceUpdatedV1 = {
        eservice: toEServiceV1(updatedEService),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceUpdated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, catalogWriterService);

      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice).toMatchObject({
        data: updatedEService,
        metadata: { version: 2 },
      });
    });

    it("EServiceRiskAnalysisAdded", async () => {
      await catalogWriterService.upsertEService(mockEService, 1);
      const mockRiskAnalysis = getMockValidRiskAnalysis("PA");
      const updatedEService: EService = {
        ...mockEService,
        riskAnalysis: [...mockEService.riskAnalysis, mockRiskAnalysis],
      };
      const payload: EServiceRiskAnalysisAddedV1 = {
        eservice: toEServiceV1(updatedEService),
        riskAnalysisId: mockRiskAnalysis.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceRiskAnalysisAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, catalogWriterService);

      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice).toMatchObject({
        data: updatedEService,
        metadata: { version: 2 },
      });
    });

    it("MovedAttributesFromEserviceToDescriptors", async () => {
      const attributes: EserviceAttributes = {
        certified: [
          [
            {
              id: generateId<AttributeId>(),
            },
          ],
        ],
        declared: [],
        verified: [],
      };
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.draft,
        attributes,
      };
      const eservice: EService = {
        ...mockEService,
        attributes,
        descriptors: [descriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);
      const expectedDescriptor = {
        ...descriptor,
        attributes,
      };
      const updatedEService: EService = {
        ...mockEService,
        attributes: undefined,
        descriptors: [expectedDescriptor],
      };
      const payload: MovedAttributesFromEserviceToDescriptorsV1 = {
        eservice: toEServiceV1(updatedEService),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "MovedAttributesFromEserviceToDescriptors",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, catalogWriterService);

      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceWithDescriptorsDeleted", async () => {
      const draftDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.draft,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [draftDescriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const updatedEService: EService = {
        ...eservice,
        descriptors: [],
      };
      const payload: EServiceWithDescriptorsDeletedV1 = {
        eservice: toEServiceV1(updatedEService),
        descriptorId: draftDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceWithDescriptorsDeleted",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, catalogWriterService);

      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice).toMatchObject({
        data: updatedEService,
        metadata: { version: 2 },
      });
    });

    it("EServiceDocumentUpdated", async () => {
      const document = getMockDocument();
      const draftDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.draft,
        docs: [document],
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [draftDescriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const updatedDocument: Document = {
        ...document,
        prettyName: "updated pretty name",
      };
      const updatedEService: EService = {
        ...eservice,
        descriptors: [{ ...draftDescriptor, docs: [updatedDocument] }],
      };
      const payload: EServiceDocumentUpdatedV1 = {
        eserviceId: eservice.id,
        descriptorId: draftDescriptor.id,
        documentId: document.id,
        serverUrls: [],
        updatedDocument: toDocumentV1(updatedDocument),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDocumentUpdated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, catalogWriterService);

      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceDeleted", async () => {
      await catalogWriterService.upsertEService(mockEService, 1);

      const payload: EServiceDeletedV1 = {
        eserviceId: mockEService.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDeleted",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, catalogWriterService);

      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toBeUndefined();
    });

    describe("EServiceDocumentAdded", () => {
      it("interface", async () => {
        const descriptorInterface = getMockDocument();
        const draftDescriptor: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.draft,
          docs: [],
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [draftDescriptor],
        };
        await catalogWriterService.upsertEService(eservice, 1);

        const updatedServerUrls = ["updated.pagopa.it"];
        const updatedEService: EService = {
          ...eservice,
          descriptors: [
            {
              ...draftDescriptor,
              interface: descriptorInterface,
              serverUrls: updatedServerUrls,
            },
          ],
        };
        const payload: EServiceDocumentAddedV1 = {
          eserviceId: eservice.id,
          descriptorId: draftDescriptor.id,
          serverUrls: updatedServerUrls,
          document: toDocumentV1(descriptorInterface),
          isInterface: true,
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: mockEService.id,
          version: 2,
          type: "EServiceDocumentAdded",
          event_version: 1,
          data: payload,
          log_date: new Date(),
        };
        await handleMessageV1(message, catalogWriterService);

        const retrievedEservice = await catalogReadModelService.getEServiceById(
          mockEService.id
        );

        expect(retrievedEservice?.data).toEqual(updatedEService);
        expect(retrievedEservice?.metadata).toEqual({ version: 2 });
      });

      it("document", async () => {
        const document = getMockDocument();
        const draftDescriptor: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.draft,
          docs: [],
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [draftDescriptor],
        };
        await catalogWriterService.upsertEService(eservice, 1);

        const updatedEService: EService = {
          ...eservice,
          descriptors: [{ ...draftDescriptor, docs: [document] }],
        };
        const payload: EServiceDocumentAddedV1 = {
          eserviceId: eservice.id,
          descriptorId: draftDescriptor.id,
          serverUrls: [],
          document: toDocumentV1(document),
          isInterface: false,
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: mockEService.id,
          version: 2,
          type: "EServiceDocumentAdded",
          event_version: 1,
          data: payload,
          log_date: new Date(),
        };
        await handleMessageV1(message, catalogWriterService);

        const retrievedEservice = await catalogReadModelService.getEServiceById(
          mockEService.id
        );

        expect(retrievedEservice?.data).toEqual(updatedEService);
        expect(retrievedEservice?.metadata).toEqual({ version: 2 });
      });
    });

    describe("EServiceDocumentDeleted", () => {
      it("interface", async () => {
        const descriptorInterface = getMockDocument();
        const draftDescriptor: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.draft,
          interface: descriptorInterface,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [draftDescriptor],
        };
        await catalogWriterService.upsertEService(eservice, 1);

        const updatedEService: EService = {
          ...eservice,
          descriptors: [
            { ...draftDescriptor, serverUrls: [], interface: undefined },
          ],
        };
        const payload: EServiceDocumentDeletedV1 = {
          eserviceId: eservice.id,
          descriptorId: draftDescriptor.id,
          documentId: descriptorInterface.id,
        };

        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: mockEService.id,
          version: 2,
          type: "EServiceDocumentDeleted",
          event_version: 1,
          data: payload,
          log_date: new Date(),
        };
        await handleMessageV1(message, catalogWriterService);

        const retrievedEservice = await catalogReadModelService.getEServiceById(
          mockEService.id
        );

        expect(retrievedEservice?.data).toEqual(updatedEService);
        expect(retrievedEservice?.metadata).toEqual({ version: 2 });
      });

      it("document", async () => {
        const document = getMockDocument();
        const draftDescriptor: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.draft,
          docs: [document],
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [draftDescriptor],
        };
        await catalogWriterService.upsertEService(eservice, 1);

        const updatedEService: EService = {
          ...eservice,
          descriptors: [{ ...draftDescriptor, docs: [] }],
        };
        const payload: EServiceDocumentDeletedV1 = {
          eserviceId: eservice.id,
          descriptorId: draftDescriptor.id,
          documentId: document.id,
        };

        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: mockEService.id,
          version: 2,
          type: "EServiceDocumentDeleted",
          event_version: 1,
          data: payload,
          log_date: new Date(),
        };
        await handleMessageV1(message, catalogWriterService);

        const retrievedEservice = await catalogReadModelService.getEServiceById(
          mockEService.id
        );

        expect(retrievedEservice?.data).toEqual(updatedEService);
        expect(retrievedEservice?.metadata).toEqual({ version: 2 });
      });
    });

    it("EServiceDescriptorAdded", async () => {
      const draftDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.draft,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const updatedEService: EService = {
        ...eservice,
        descriptors: [draftDescriptor],
      };
      const payload: EServiceDescriptorAddedV1 = {
        eserviceId: eservice.id,
        eserviceDescriptor: toDescriptorV1(draftDescriptor),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorAdded",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, catalogWriterService);

      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceDescriptorUpdated", async () => {
      const draftDescriptor: Descriptor = {
        ...getMockDescriptor(),
        interface: getMockDocument(),
        state: descriptorState.draft,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [draftDescriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const publishedDescriptor: Descriptor = {
        ...draftDescriptor,
        publishedAt: new Date(),
        state: descriptorState.published,
      };
      const updatedEService: EService = {
        ...eservice,
        descriptors: [publishedDescriptor],
      };
      const payload: EServiceDescriptorUpdatedV1 = {
        eserviceId: eservice.id,
        eserviceDescriptor: toDescriptorV1(publishedDescriptor),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorUpdated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, catalogWriterService);

      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceRiskAnalysisDeleted", async () => {
      const riskAnalysis = getMockValidRiskAnalysis("PA");
      const eservice: EService = {
        ...mockEService,
        riskAnalysis: [riskAnalysis],
      };

      await catalogWriterService.upsertEService(eservice, 1);

      const updatedEService: EService = {
        ...mockEService,
        riskAnalysis: [],
      };
      const payload: EServiceRiskAnalysisDeletedV1 = {
        eservice: toEServiceV1(updatedEService),
        riskAnalysisId: riskAnalysis.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceRiskAnalysisDeleted",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, catalogWriterService);

      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice).toMatchObject({
        data: updatedEService,
        metadata: { version: 2 },
      });
    });
  });

  describe("Events V2", async () => {
    const mockEService = getMockEService();
    it("EServiceDeleted", async () => {
      await catalogWriterService.upsertEService(mockEService, 1);

      const payload: EServiceDeletedV2 = {
        eserviceId: mockEService.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toBeUndefined();
    });

    it("EServiceAdded", async () => {
      const payload: EServiceAddedV2 = {
        eservice: toEServiceV2(mockEService),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 1,
        type: "EServiceAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice).toMatchObject({
        data: mockEService,
        metadata: { version: 1 },
      });
    });

    it("DraftEServiceUpdated", async () => {
      await catalogWriterService.upsertEService(mockEService, 1);
      const updatedEService: EService = {
        ...mockEService,
        description: "updated description",
      };
      const payload: DraftEServiceUpdatedV2 = {
        eservice: toEServiceV2(updatedEService),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "DraftEServiceUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice).toMatchObject({
        data: updatedEService,
        metadata: { version: 2 },
      });
    });

    it("EServiceCloned", async () => {
      const sourceDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        publishedAt: new Date(),
        interface: getMockDocument(),
      };
      const sourceEService: EService = {
        ...mockEService,
        descriptors: [sourceDescriptor],
      };

      await catalogWriterService.upsertEService(sourceEService, 1);

      const date = new Date();
      const clonedEService: EService = {
        ...sourceEService,
        id: generateId(),
        createdAt: new Date(),
        name: `${mockEService.name} - clone - ${format(
          date,
          "dd/MM/yyyy HH:mm:ss"
        )}`,
        descriptors: [
          {
            ...sourceDescriptor,
            id: generateId(),
            interface: {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              ...sourceDescriptor.interface!,
              id: generateId(),
            },
            publishedAt: undefined,
            state: descriptorState.draft,
          },
        ],
      };

      const payload: EServiceClonedV2 = {
        sourceEservice: toEServiceV2(sourceEService),
        sourceDescriptorId: sourceDescriptor.id,
        eservice: toEServiceV2(clonedEService),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: clonedEService.id,
        version: 1,
        type: "EServiceCloned",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        clonedEService.id
      );

      expect(retrievedEservice?.data).toEqual(clonedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 1 });
    });

    it("EServiceDescriptorAdded", async () => {
      const draftDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.draft,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const updatedEService: EService = {
        ...eservice,
        descriptors: [draftDescriptor],
      };
      const payload: EServiceDescriptorAddedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: draftDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceDraftDescriptorDeleted", async () => {
      const draftDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.draft,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [draftDescriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const updatedEService: EService = {
        ...eservice,
        descriptors: [],
      };
      const payload: EServiceDraftDescriptorDeletedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: draftDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDraftDescriptorDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice).toMatchObject({
        data: updatedEService,
        metadata: { version: 2 },
      });
    });

    it("EServiceDraftDescriptorUpdated", async () => {
      const draftDescriptor: Descriptor = {
        ...getMockDescriptor(),
        interface: getMockDocument(),
        state: descriptorState.draft,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [draftDescriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const updatedDraftDescriptor: Descriptor = {
        ...draftDescriptor,
        description: "updated description",
      };
      const updatedEService: EService = {
        ...eservice,
        descriptors: [updatedDraftDescriptor],
      };
      const payload: EServiceDraftDescriptorUpdatedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: updatedDraftDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDraftDescriptorUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceDescriptorQuotasUpdated", async () => {
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        interface: getMockDocument(),
        state: descriptorState.published,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [publishedDescriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const updatedPublishedDescriptor: Descriptor = {
        ...publishedDescriptor,
        dailyCallsTotal: publishedDescriptor.dailyCallsTotal + 1000,
      };
      const updatedEService: EService = {
        ...eservice,
        descriptors: [updatedPublishedDescriptor],
      };
      const payload: EServiceDescriptorQuotasUpdatedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: updatedPublishedDescriptor.id,
      };

      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorQuotasUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceDescriptorActivated", async () => {
      const suspendedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        interface: getMockDocument(),
        state: descriptorState.suspended,
        publishedAt: new Date(),
        suspendedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [suspendedDescriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const publishedDescriptor: Descriptor = {
        ...suspendedDescriptor,
        publishedAt: new Date(),
        suspendedAt: new Date(),
        state: descriptorState.published,
      };
      const updatedEService: EService = {
        ...eservice,
        descriptors: [publishedDescriptor],
      };
      const payload: EServiceDescriptorActivatedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: publishedDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorActivated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceDescriptorArchived", async () => {
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        interface: getMockDocument(),
        state: descriptorState.published,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [publishedDescriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const archivedDescriptor: Descriptor = {
        ...publishedDescriptor,
        archivedAt: new Date(),
        state: descriptorState.archived,
      };
      const updatedEService: EService = {
        ...eservice,
        descriptors: [archivedDescriptor],
      };
      const payload: EServiceDescriptorArchivedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: archivedDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorArchived",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceDescriptorPublished", async () => {
      const draftDescriptor: Descriptor = {
        ...getMockDescriptor(),
        interface: getMockDocument(),
        state: descriptorState.draft,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [draftDescriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const publishedDescriptor: Descriptor = {
        ...draftDescriptor,
        publishedAt: new Date(),
        state: descriptorState.published,
      };
      const updatedEService: EService = {
        ...eservice,
        descriptors: [publishedDescriptor],
      };
      const payload: EServiceDescriptorPublishedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: publishedDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorPublished",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceDescriptorSuspended", async () => {
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        interface: getMockDocument(),
        state: descriptorState.published,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [publishedDescriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const suspendedDescriptor: Descriptor = {
        ...publishedDescriptor,
        suspendedAt: new Date(),
        state: descriptorState.suspended,
      };
      const updatedEService: EService = {
        ...eservice,
        descriptors: [suspendedDescriptor],
      };
      const payload: EServiceDescriptorSuspendedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: suspendedDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorSuspended",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceDescriptorInterfaceAdded", async () => {
      const descriptorInterface = getMockDocument();
      const draftDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.draft,
        docs: [],
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [draftDescriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);
      const updatedEService: EService = {
        ...eservice,
        descriptors: [{ ...draftDescriptor, interface: descriptorInterface }],
      };
      const payload: EServiceDescriptorInterfaceAddedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: draftDescriptor.id,
        documentId: descriptorInterface.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorInterfaceAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceDescriptorDocumentAdded", async () => {
      const document = getMockDocument();
      const draftDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.draft,
        docs: [],
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [draftDescriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const updatedEService: EService = {
        ...eservice,
        descriptors: [{ ...draftDescriptor, docs: [document] }],
      };
      const payload: EServiceDescriptorDocumentAddedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: draftDescriptor.id,
        documentId: document.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorDocumentAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceDescriptorInterfaceUpdated", async () => {
      const descriptorInterface = getMockDocument();
      const draftDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.draft,
        interface: descriptorInterface,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [draftDescriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const updatedInterface: Document = {
        ...descriptorInterface,
        prettyName: "updated pretty name",
      };
      const updatedEService: EService = {
        ...eservice,
        descriptors: [{ ...draftDescriptor, interface: updatedInterface }],
      };
      const payload: EServiceDescriptorInterfaceUpdatedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: draftDescriptor.id,
        documentId: updatedInterface.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorInterfaceUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceDescriptorDocumentUpdated", async () => {
      const document = getMockDocument();
      const draftDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.draft,
        docs: [document],
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [draftDescriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const updatedDocument: Document = {
        ...document,
        prettyName: "updated pretty name",
      };
      const updatedEService: EService = {
        ...eservice,
        descriptors: [{ ...draftDescriptor, docs: [updatedDocument] }],
      };
      const payload: EServiceDescriptorDocumentUpdatedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: draftDescriptor.id,
        documentId: document.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorDocumentUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceDescriptorInterfaceDeleted", async () => {
      const descriptorInterface = getMockDocument();
      const draftDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.draft,
        interface: descriptorInterface,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [draftDescriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const updatedEService: EService = {
        ...eservice,
        descriptors: [
          { ...draftDescriptor, serverUrls: [], interface: undefined },
        ],
      };
      const payload: EServiceDescriptorInterfaceDeletedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: draftDescriptor.id,
        documentId: descriptorInterface.id,
      };

      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorInterfaceDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceDescriptorDocumentDeleted", async () => {
      const document = getMockDocument();
      const draftDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.draft,
        docs: [document],
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [draftDescriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const updatedEService: EService = {
        ...eservice,
        descriptors: [{ ...draftDescriptor, docs: [] }],
      };
      const payload: EServiceDescriptorDocumentDeletedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: draftDescriptor.id,
        documentId: document.id,
      };

      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceDescriptorDocumentDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceRiskAnalysisAdded", async () => {
      await catalogWriterService.upsertEService(mockEService, 1);
      const mockRiskAnalysis = getMockValidRiskAnalysis("PA");
      const updatedEService: EService = {
        ...mockEService,
        riskAnalysis: [mockRiskAnalysis],
      };
      const payload: EServiceRiskAnalysisAddedV2 = {
        eservice: toEServiceV2(updatedEService),
        riskAnalysisId: mockRiskAnalysis.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceRiskAnalysisAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice).toMatchObject({
        data: updatedEService,
        metadata: { version: 2 },
      });
    });

    it("EServiceRiskAnalysisUpdated", async () => {
      const mockRiskAnalysis = getMockValidRiskAnalysis("PA");
      const eservice: EService = {
        ...mockEService,
        riskAnalysis: [mockRiskAnalysis],
      };
      await catalogWriterService.upsertEService(eservice, 1);

      const updatedRiskAnalysis: RiskAnalysis = {
        ...mockRiskAnalysis,
        riskAnalysisForm: {
          ...mockRiskAnalysis.riskAnalysisForm,
          singleAnswers: mockRiskAnalysis.riskAnalysisForm.singleAnswers.map(
            (singleAnswer) => ({
              ...singleAnswer,
              value:
                singleAnswer.key === "purpose" ? "OTHER" : singleAnswer.value,
            })
          ),
        },
      };
      const updatedEService: EService = {
        ...eservice,
        riskAnalysis: [updatedRiskAnalysis],
      };
      const payload: EServiceRiskAnalysisAddedV2 = {
        eservice: toEServiceV2(updatedEService),
        riskAnalysisId: mockRiskAnalysis.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceRiskAnalysisUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice).toMatchObject({
        data: updatedEService,
        metadata: { version: 2 },
      });
    });

    it("EServiceRiskAnalysisDeleted", async () => {
      const riskAnalysis = getMockValidRiskAnalysis("PA");
      const eservice: EService = {
        ...mockEService,
        riskAnalysis: [riskAnalysis],
      };

      await catalogWriterService.upsertEService(eservice, 1);

      const updatedEService: EService = {
        ...mockEService,
        riskAnalysis: [],
      };
      const payload: EServiceRiskAnalysisDeletedV2 = {
        eservice: toEServiceV2(updatedEService),
        riskAnalysisId: riskAnalysis.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceRiskAnalysisDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice).toMatchObject({
        data: updatedEService,
        metadata: { version: 2 },
      });
    });

    it("EServiceNameUpdated", async () => {
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        interface: getMockDocument(),
        state: descriptorState.published,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        name: "previousName",
        descriptors: [publishedDescriptor],
      };
      await catalogWriterService.upsertEService(eservice, 1);
      const updatedEService: EService = {
        ...eservice,
        name: "newName",
      };
      const payload: EServiceNameUpdatedV2 = {
        eservice: toEServiceV2(updatedEService),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceNameUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );
      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceSignalHubEnabled", async () => {
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        interface: getMockDocument(),
        state: descriptorState.published,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [publishedDescriptor],
        isSignalHubEnabled: true,
      };
      await catalogWriterService.upsertEService(eservice, 1);
      const updatedEService: EService = {
        ...eservice,
        isSignalHubEnabled: true,
      };
      const payload: EServiceNameUpdatedV2 = {
        eservice: toEServiceV2(updatedEService),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceSignalHubEnabled",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );
      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceSignalHubDisabled", async () => {
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        interface: getMockDocument(),
        state: descriptorState.published,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [publishedDescriptor],
        isSignalHubEnabled: false,
      };
      await catalogWriterService.upsertEService(eservice, 1);
      const updatedEService: EService = {
        ...eservice,
        isSignalHubEnabled: false,
      };
      const payload: EServiceNameUpdatedV2 = {
        eservice: toEServiceV2(updatedEService),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServiceSignalHubDisabled",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );
      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServicePersonalDataFlagUpdatedAfterPublication", async () => {
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        interface: getMockDocument(),
        state: descriptorState.published,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [publishedDescriptor],
      };
      await catalogWriterService.upsertEService(mockEService, 1);
      const updatedEService: EService = {
        ...eservice,
        personalData: true,
      };
      const payload: EServicePersonalDataFlagUpdatedAfterPublicationV2 = {
        eservice: toEServiceV2(updatedEService),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: mockEService.id,
        version: 2,
        type: "EServicePersonalDataFlagUpdatedAfterPublication",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, catalogWriterService);
      const retrievedEservice = await catalogReadModelService.getEServiceById(
        mockEService.id
      );

      expect(retrievedEservice?.data).toEqual(updatedEService);
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });
  });
});

export const getMockEService = (): EService => ({
  id: generateId(),
  name: "eservice name",
  description: "eservice description",
  createdAt: new Date(),
  producerId: generateId(),
  technology: technology.rest,
  descriptors: [],
  mode: eserviceMode.deliver,
  riskAnalysis: [],
});

export const getMockDescriptor = (): Descriptor => ({
  id: generateId(),
  version: "1",
  docs: [],
  state: descriptorState.draft,
  audience: [],
  voucherLifespan: 60,
  dailyCallsPerConsumer: 10,
  dailyCallsTotal: 1000,
  createdAt: new Date(),
  serverUrls: ["pagopa.it"],
  agreementApprovalPolicy: "Automatic",
  attributes: {
    certified: [],
    verified: [],
    declared: [],
  },
});
