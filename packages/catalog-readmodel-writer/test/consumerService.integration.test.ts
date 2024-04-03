/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { afterEach, afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  EServiceCollection,
  ReadModelRepository,
  readModelWriterConfig,
} from "pagopa-interop-commons";
import {
  getMockValidRiskAnalysis,
  mongoDBContainer,
  writeInReadmodel,
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
  EServiceReadModel,
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
  toDescriptorV1,
  toDocumentV1,
  toEServiceV1,
  toReadModelEService,
} from "pagopa-interop-models";
import { StartedTestContainer } from "testcontainers";
import { format } from "date-fns";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import { handleMessageV2 } from "../src/consumerServiceV2.js";

describe("database test", async () => {
  let eservices: EServiceCollection;
  let startedMongoDBContainer: StartedTestContainer;

  const config = readModelWriterConfig();

  beforeAll(async () => {
    startedMongoDBContainer = await mongoDBContainer(config).start();

    config.readModelDbPort = startedMongoDBContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    eservices = readModelRepository.eservices;
  });

  afterEach(async () => {
    await eservices.deleteMany({});
  });

  afterAll(async () => {
    await startedMongoDBContainer.stop();
  });

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
      await handleMessageV1(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: toReadModelEService(mockEService),
        metadata: { version: 1 },
      });
    });

    it("ClonedEServiceAdded", async () => {
      await writeInReadmodel<EServiceReadModel>(
        toReadModelEService(mockEService),
        eservices,
        1
      );

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
      await handleMessageV1(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": clonedEService.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: toReadModelEService(clonedEService),
        metadata: { version: 1 },
      });
    });

    it("EServiceUpdated", async () => {
      await writeInReadmodel<EServiceReadModel>(
        toReadModelEService(mockEService),
        eservices,
        1
      );

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
      await handleMessageV1(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: toReadModelEService(updatedEService),
        metadata: { version: 2 },
      });
    });

    it("EServiceRiskAnalysisAdded", async () => {
      await writeInReadmodel<EServiceReadModel>(
        toReadModelEService(mockEService),
        eservices,
        1
      );

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
      await handleMessageV1(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: toReadModelEService(updatedEService),
        metadata: { version: 2 },
      });
    });

    it("MovedAttributesFromEserviceToDescriptors", async () => {
      const attributes: EserviceAttributes = {
        certified: [
          [
            {
              id: generateId<AttributeId>(),
              explicitAttributeVerification: false,
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);
      const updatedDescriptor = {
        ...descriptor,
        attributes,
      };
      const updatedEService: EService = {
        ...mockEService,
        attributes: undefined,
        descriptors: [updatedDescriptor],
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
      await handleMessageV1(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(updatedEService)
      );
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV1(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: toReadModelEService(updatedEService),
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV1(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(updatedEService)
      );
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceDeleted", async () => {
      await writeInReadmodel(toReadModelEService(mockEService), eservices, 1);

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
      await handleMessageV1(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

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
        await writeInReadmodel(toReadModelEService(eservice), eservices, 1);
        const updatedEService: EService = {
          ...eservice,
          descriptors: [{ ...draftDescriptor, interface: descriptorInterface }],
        };
        const payload: EServiceDocumentAddedV1 = {
          eserviceId: eservice.id,
          descriptorId: draftDescriptor.id,
          serverUrls: ["pagopa.it"],
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
        await handleMessageV1(message, eservices);

        const retrievedEservice = await eservices.findOne({
          "data.id": mockEService.id,
        });

        expect(retrievedEservice?.data).toEqual(
          toReadModelEService(updatedEService)
        );
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
        await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
        await handleMessageV1(message, eservices);

        const retrievedEservice = await eservices.findOne({
          "data.id": mockEService.id,
        });

        expect(retrievedEservice?.data).toEqual(
          toReadModelEService(updatedEService)
        );
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
        await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
        await handleMessageV1(message, eservices);

        const retrievedEservice = await eservices.findOne({
          "data.id": mockEService.id,
        });

        expect(retrievedEservice?.data).toEqual(
          toReadModelEService(updatedEService)
        );
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
        await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
        await handleMessageV1(message, eservices);

        const retrievedEservice = await eservices.findOne({
          "data.id": mockEService.id,
        });

        expect(retrievedEservice?.data).toEqual(
          toReadModelEService(updatedEService)
        );
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV1(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(updatedEService)
      );
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV1(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(updatedEService)
      );
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceRiskAnalysisDeleted", async () => {
      const riskAnalysis = getMockValidRiskAnalysis("PA");
      const eservice: EService = {
        ...mockEService,
        riskAnalysis: [riskAnalysis],
      };

      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV1(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: toReadModelEService(updatedEService),
        metadata: { version: 2 },
      });
    });
  });

  describe("Events V2", async () => {
    const mockEService = getMockEService();
    it("EServiceDeleted", async () => {
      await writeInReadmodel(toReadModelEService(mockEService), eservices, 1);

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: toReadModelEService(mockEService),
        metadata: { version: 1 },
      });
    });

    it("DraftEServiceUpdated", async () => {
      await writeInReadmodel<EServiceReadModel>(
        toReadModelEService(mockEService),
        eservices,
        1
      );

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: toReadModelEService(updatedEService),
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
      await writeInReadmodel<EServiceReadModel>(
        toReadModelEService(sourceEService),
        eservices,
        1
      );

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": clonedEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(clonedEService)
      );
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(updatedEService)
      );
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: toReadModelEService(updatedEService),
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(updatedEService)
      );
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(updatedEService)
      );
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(updatedEService)
      );
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(updatedEService)
      );
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(updatedEService)
      );
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(updatedEService)
      );
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);
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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(updatedEService)
      );
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(updatedEService)
      );
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(updatedEService)
      );
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(updatedEService)
      );
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(updatedEService)
      );
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
      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice?.data).toEqual(
        toReadModelEService(updatedEService)
      );
      expect(retrievedEservice?.metadata).toEqual({ version: 2 });
    });

    it("EServiceRiskAnalysisAdded", async () => {
      await writeInReadmodel<EServiceReadModel>(
        toReadModelEService(mockEService),
        eservices,
        1
      );

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: toReadModelEService(updatedEService),
        metadata: { version: 2 },
      });
    });

    it("EServiceRiskAnalysisUpdated", async () => {
      const mockRiskAnalysis = getMockValidRiskAnalysis("PA");
      const eservice: EService = {
        ...mockEService,
        riskAnalysis: [mockRiskAnalysis],
      };
      await writeInReadmodel<EServiceReadModel>(
        toReadModelEService(eservice),
        eservices,
        1
      );

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: toReadModelEService(updatedEService),
        metadata: { version: 2 },
      });
    });

    it("EServiceRiskAnalysisDeleted", async () => {
      const riskAnalysis = getMockValidRiskAnalysis("PA");
      const eservice: EService = {
        ...mockEService,
        riskAnalysis: [riskAnalysis],
      };

      await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV2(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": mockEService.id,
      });

      expect(retrievedEservice).toMatchObject({
        data: toReadModelEService(updatedEService),
        metadata: { version: 2 },
      });
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

export const getMockDocument = (): Document => ({
  name: "fileName",
  path: "filePath",
  id: generateId(),
  prettyName: "prettyName",
  contentType: "json",
  checksum: "checksum",
  uploadDate: new Date(),
});
