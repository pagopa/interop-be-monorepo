import { format } from "util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AttributeId,
  ClonedEServiceAddedV1,
  Descriptor,
  Document,
  EService,
  EServiceAddedV1,
  EServiceDeletedV1,
  EServiceDescriptorActivatedV2,
  EServiceDescriptorAddedV1,
  EServiceDescriptorArchivedV2,
  EServiceDescriptorPublishedV2,
  EServiceDescriptorSuspendedV2,
  EServiceDescriptorUpdatedV1,
  EServiceDocumentAddedV1,
  EServiceDocumentDeletedV1,
  EServiceDocumentUpdatedV1,
  EServiceEventEnvelope,
  EServiceRiskAnalysisAddedV1,
  EServiceRiskAnalysisDeletedV1,
  EServiceUpdatedV1,
  EServiceWithDescriptorsDeletedV1,
  EserviceAttributes,
  ItemState,
  MovedAttributesFromEserviceToDescriptorsV1,
  PlatformStatesCatalogEntry,
  descriptorState,
  generateId,
  toEServiceV2,
} from "pagopa-interop-models";
import * as dynamodb from "@aws-sdk/client-dynamodb";
import {
  toEServiceV1,
  getMockValidRiskAnalysis,
  toDocumentV1,
  toDescriptorV1,
  getMockDescriptor,
  getMockEService,
  getMockDocument,
} from "pagopa-interop-commons-test";
import { readCatalogEntry, writeCatalogEntry } from "../src/utils.js";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import { handleMessageV2 } from "../src/consumerServiceV2.js";

import { config } from "./utils.js";

describe("database test", async () => {
  const dynamoDBClient = new dynamodb.DynamoDB({
    credentials: { accessKeyId: "key", secretAccessKey: "secret" },
    region: "eu-central-1",
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    endpoint: `http://${config!.tokenGenerationReadModelDbHost}:${
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      config!.tokenGenerationReadModelDbPort
    }`,
  });
  beforeAll(async () => {
    const platformTableDefinition: dynamodb.CreateTableInput = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      TableName: config!.tokenGenerationReadModelTableNamePlatform,
      AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    };
    await dynamoDBClient.createTable(platformTableDefinition);

    const tokenGenerationTableDefinition: dynamodb.CreateTableInput = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      TableName: config!.tokenGenerationReadModelTableNameTokenGeneration,
      AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    };
    await dynamoDBClient.createTable(tokenGenerationTableDefinition);

    // const tablesResult = await dynamoDBClient.listTables();
    // console.log(tablesResult.TableNames);
  });
  afterAll(async () => {
    const tableToDelete1: dynamodb.DeleteTableInput = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      TableName: config!.tokenGenerationReadModelTableNamePlatform,
    };
    const tableToDelete2: dynamodb.DeleteTableInput = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      TableName: config!.tokenGenerationReadModelTableNameTokenGeneration,
    };
    await dynamoDBClient.deleteTable(tableToDelete1);
    await dynamoDBClient.deleteTable(tableToDelete2);
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
      await handleMessageV1(message, dynamoDBClient);

      // TO DO
      expect(1).toBe(1);
    });

    it("ClonedEServiceAdded", async () => {
      // await writeInReadmodel<EServiceReadModel>(
      //   toReadModelEService(mockEService),
      //   eservices,
      //   1
      // );

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
      await handleMessageV1(message, dynamoDBClient);

      // TO DO
      expect(1).toBe(1);
    });

    it("EServiceUpdated", async () => {
      // await writeInReadmodel<EServiceReadModel>(
      //   toReadModelEService(mockEService),
      //   eservices,
      //   1
      // );

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
      await handleMessageV1(message, dynamoDBClient);

      // TO DO
      expect(1).toBe(1);
    });

    it("EServiceRiskAnalysisAdded", async () => {
      // await writeInReadmodel<EServiceReadModel>(
      //   toReadModelEService(mockEService),
      //   eservices,
      //   1
      // );

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
      await handleMessageV1(message, dynamoDBClient);

      // TO DO
      expect(1).toBe(1);
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
      // const eservice: EService = {
      //   ...mockEService,
      //   attributes,
      //   descriptors: [descriptor],
      // };
      // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);
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
      await handleMessageV1(message, dynamoDBClient);

      // TO DO
      expect(1).toBe(1);
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
      // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV1(message, dynamoDBClient);

      // TO DO
      expect(1).toBe(1);
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
      // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

      const updatedDocument: Document = {
        ...document,
        prettyName: "updated pretty name",
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
      await handleMessageV1(message, dynamoDBClient);

      // TO DO
      expect(1).toBe(1);
    });

    it("EServiceDeleted", async () => {
      // await writeInReadmodel(toReadModelEService(mockEService), eservices, 1);

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
      await handleMessageV1(message, dynamoDBClient);

      // TO DO
      expect(1).toBe(1);
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
        // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
        await handleMessageV1(message, dynamoDBClient);

        // TO DO
        expect(1).toBe(1);
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
        // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
        await handleMessageV1(message, dynamoDBClient);

        // TO DO
        expect(1).toBe(1);
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
        // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
        await handleMessageV1(message, dynamoDBClient);

        // TO DO
        expect(1).toBe(1);
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
        // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
        await handleMessageV1(message, dynamoDBClient);

        // TO DO
        expect(1).toBe(1);
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
      // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV1(message, dynamoDBClient);

      // TO DO
      expect(1).toBe(1);
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
      // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

      const publishedDescriptor: Descriptor = {
        ...draftDescriptor,
        publishedAt: new Date(),
        state: descriptorState.published,
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
      await handleMessageV1(message, dynamoDBClient);

      // TO DO
      expect(1).toBe(1);
    });

    it("EServiceRiskAnalysisDeleted", async () => {
      const riskAnalysis = getMockValidRiskAnalysis("PA");
      // const eservice: EService = {
      //   ...mockEService,
      //   riskAnalysis: [riskAnalysis],
      // };

      // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV1(message, dynamoDBClient);

      // TO DO
      expect(1).toBe(1);
    });
  });

  describe("Events V2", async () => {
    const mockEService = getMockEService();
    it("EServiceDescriptorActivated", async () => {
      const suspendedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it"],
        interface: getMockDocument(),
        state: descriptorState.suspended,
        publishedAt: new Date(),
        suspendedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [suspendedDescriptor],
      };
      // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      const primaryKey = `ESERVICEDESCRIPTOR#${updatedEService.id}#${publishedDescriptor.id}`;
      const previousStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: ItemState.Enum.INACTIVE,
        descriptorAudience: publishedDescriptor.audience[0],
      };
      await writeCatalogEntry(previousStateEntry, dynamoDBClient);
      await handleMessageV2(message, dynamoDBClient);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      const expectedEntry: PlatformStatesCatalogEntry = {
        ...previousStateEntry,
        state: ItemState.Enum.ACTIVE,
      };
      expect(retrievedEntry).toEqual(expectedEntry);
    });

    it("EServiceDescriptorArchived", async () => {
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it"],
        interface: getMockDocument(),
        state: descriptorState.published,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [publishedDescriptor],
      };
      // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      const primaryKey = `ESERVICEDESCRIPTOR#${updatedEService.id}#${publishedDescriptor.id}`;
      const previousStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: ItemState.Enum.INACTIVE,
        descriptorAudience: publishedDescriptor.audience[0],
      };
      await writeCatalogEntry(previousStateEntry, dynamoDBClient);
      await handleMessageV2(message, dynamoDBClient);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      expect(retrievedEntry).toBeUndefined();
    });

    it("EServiceDescriptorPublished", async () => {
      const draftDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it"],
        interface: getMockDocument(),
        state: descriptorState.draft,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [draftDescriptor],
      };
      // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      await handleMessageV2(message, dynamoDBClient);

      const primaryKey = `ESERVICEDESCRIPTOR#${updatedEService.id}#${publishedDescriptor.id}`;
      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      const expectedEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: ItemState.Enum.ACTIVE,
        descriptorAudience: publishedDescriptor.audience[0],
      };
      expect(retrievedEntry).toEqual(expectedEntry);
    });

    it("EServiceDescriptorSuspended", async () => {
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it"],
        interface: getMockDocument(),
        state: descriptorState.published,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [publishedDescriptor],
      };
      // await writeInReadmodel(toReadModelEService(eservice), eservices, 1);

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
      const primaryKey = `ESERVICEDESCRIPTOR#${updatedEService.id}#${publishedDescriptor.id}`;
      const previousStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: ItemState.Enum.ACTIVE,
        descriptorAudience: publishedDescriptor.audience[0],
      };
      await writeCatalogEntry(previousStateEntry, dynamoDBClient);
      await handleMessageV2(message, dynamoDBClient);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      const expectedEntry: PlatformStatesCatalogEntry = {
        ...previousStateEntry,
        state: ItemState.Enum.INACTIVE,
      };
      expect(retrievedEntry).toEqual(expectedEntry);
    });
  });
});
