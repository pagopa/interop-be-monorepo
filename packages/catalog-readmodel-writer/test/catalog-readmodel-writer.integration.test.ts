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
  EService,
  EServiceAddedV1,
  EServiceDeletedV1,
  EServiceDescriptorAddedV1,
  EServiceDescriptorUpdatedV1,
  EServiceDocumentAddedV1,
  EServiceDocumentDeletedV1,
  EServiceDocumentUpdatedV1,
  EServiceEventEnvelope,
  EServiceReadModel,
  EServiceRiskAnalysisAddedV1,
  EServiceRiskAnalysisDeletedV1,
  EServiceUpdatedV1,
  EServiceWithDescriptorsDeletedV1,
  EserviceAttributes,
  MovedAttributesFromEserviceToDescriptorsV1,
  descriptorState,
  eserviceMode,
  generateId,
  technology,
  toReadModelEService,
} from "pagopa-interop-models";
import { StartedTestContainer } from "testcontainers";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import { toDescriptorV1, toDocumentV1, toEServiceV1 } from "./converterV1.js";

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

    describe("EServiceAdded", () => {
      it("should create an eservice", async () => {
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
        };
        await handleMessageV1(message, eservices);

        const retrievedEservice = await eservices.findOne({
          "data.id": mockEService.id,
        });

        expect(retrievedEservice?.data).toEqual(
          toReadModelEService(mockEService)
        );
        expect(retrievedEservice?.metadata).toEqual({ version: 1 });
      });
    });

    describe("ClonedEServiceAdded", () => {
      it("should clone an eservice", async () => {
        await writeInReadmodel<EServiceReadModel>(
          toReadModelEService(mockEService),
          eservices,
          1
        );
        const payload: ClonedEServiceAddedV1 = {
          eservice: toEServiceV1(mockEService),
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: mockEService.id,
          version: 1,
          type: "ClonedEServiceAdded",
          event_version: 1,
          data: payload,
        };
        await handleMessageV1(message, eservices);

        const retrievedEservice = await eservices.findOne({
          "data.id": mockEService.id,
        });

        expect(retrievedEservice?.data).toEqual(
          toReadModelEService(mockEService)
        );
        expect(retrievedEservice?.metadata).toEqual({ version: 1 });
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
});

export const getMockEService = (): EService => ({
  id: generateId(),
  name: "eservice name",
  description: "eservice description",
  createdAt: new Date(),
  producerId: generateId(),
  technology: technology.rest,
  descriptors: [],
  attributes: undefined,
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
