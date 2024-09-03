/* eslint-disable no-console */
import { fail } from "assert";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  ClientId,
  Descriptor,
  EService,
  EServiceDescriptorActivatedV2,
  EServiceDescriptorArchivedV2,
  EServiceDescriptorPublishedV2,
  EServiceDescriptorSuspendedV2,
  EServiceEventEnvelope,
  PlatformStatesCatalogEntry,
  TokenGenerationStatesClientPurposeEntry,
  descriptorState,
  generateId,
  itemState,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  makeTokenGenerationStatesClientKidPK,
  toEServiceV2,
} from "pagopa-interop-models";
import {
  CreateTableCommand,
  CreateTableInput,
  DeleteTableCommand,
  DeleteTableInput,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  getMockDescriptor,
  getMockEService,
  getMockDocument,
  getMockTokenStatesClientPurposeEntry,
} from "pagopa-interop-commons-test";
import {
  readCatalogEntry,
  readTokenStateEntriesByEserviceIdAndDescriptorId,
  sleep,
  writeCatalogEntry,
  writeTokenStateEntry,
} from "../src/utils.js";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import { config } from "./utils.js";

describe("database test", async () => {
  if (!config) {
    fail();
  }
  const dynamoDBClient = new DynamoDBClient({
    credentials: { accessKeyId: "key", secretAccessKey: "secret" },
    region: "eu-central-1",
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    endpoint: `http://${config.tokenGenerationReadModelDbHost}:${
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      config.tokenGenerationReadModelDbPort
    }`,
  });
  beforeEach(async () => {
    if (!config) {
      // to do: why is this needed?
      fail();
    }
    const platformTableDefinition: CreateTableInput = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      TableName: config.tokenGenerationReadModelTableNamePlatform,
      AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    };
    const command1 = new CreateTableCommand(platformTableDefinition);
    await dynamoDBClient.send(command1);

    const tokenGenerationTableDefinition: CreateTableInput = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "GSIPK_eserviceId_descriptorId", AttributeType: "S" },
      ],
      KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
      GlobalSecondaryIndexes: [
        {
          // TODO: change index name
          IndexName: "gsiIndex",
          KeySchema: [
            {
              AttributeName: "GSIPK_eserviceId_descriptorId",
              KeyType: "HASH",
            },
          ],
          Projection: {
            NonKeyAttributes: [],
            ProjectionType: "ALL",
          },
          // ProvisionedThroughput: {
          //   ReadCapacityUnits: 5,
          //   WriteCapacityUnits: 5,
          // },
        },
      ],
    };
    const command2 = new CreateTableCommand(tokenGenerationTableDefinition);
    const result = await dynamoDBClient.send(command2);
    console.log(result);

    // const tablesResult = await dynamoDBClient.listTables();
    // console.log(tablesResult.TableNames);
  });
  afterEach(async () => {
    if (!config) {
      fail();
    }
    const tableToDelete1: DeleteTableInput = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      TableName: config.tokenGenerationReadModelTableNamePlatform,
    };
    const tableToDelete2: DeleteTableInput = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
    };
    const command1 = new DeleteTableCommand(tableToDelete1);
    await dynamoDBClient.send(command1);
    const command2 = new DeleteTableCommand(tableToDelete2);
    await dynamoDBClient.send(command2);
  });
  const mockDate = new Date();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  describe("Events V2", async () => {
    const mockEService = getMockEService();
    describe("EServiceDescriptorActivated", () => {
      it("no operation if the entry already exists: incoming has version 1; previous entry has version 2", () => {
        expect(1).toBe(1);
      });
      it("entry has to be updated: incoming has version 3; previous entry has version 2", async () => {
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
        const catalogEntryPrimaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });
        const previousStateEntry: PlatformStatesCatalogEntry = {
          PK: catalogEntryPrimaryKey,
          state: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience[0],
          version: 1,
          updatedAt: new Date().toISOString(),
        };
        await writeCatalogEntry(previousStateEntry, dynamoDBClient);

        // token-generation-states
        const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPK({
          clientId: generateId<ClientId>(),
          kid: generateId(),
        });
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });
        const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
            descriptorState: itemState.inactive,
            descriptorAudience: publishedDescriptor.audience[0],
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

        const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPK({
          clientId: generateId<ClientId>(),
          kid: generateId(),
        });
        const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
            descriptorState: itemState.inactive,
            descriptorAudience: publishedDescriptor.audience[0],
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

        await sleep(1000, mockDate);
        await handleMessageV2(message, dynamoDBClient);

        // platform-states
        const retrievedCatalogEntry = await readCatalogEntry(
          catalogEntryPrimaryKey,
          dynamoDBClient
        );
        const expectedCatalogEntry: PlatformStatesCatalogEntry = {
          ...previousStateEntry,
          state: itemState.active,
          version: 2,
          updatedAt: new Date().toISOString(),
        };
        expect(retrievedCatalogEntry).toEqual(expectedCatalogEntry);

        // token-generation-states
        const retrievedTokenStateEntries =
          await readTokenStateEntriesByEserviceIdAndDescriptorId(
            eserviceId_descriptorId,
            dynamoDBClient
          );
        const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry1,
            descriptorState: itemState.active,
            updatedAt: new Date().toISOString(),
          };
        const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry2,
            descriptorState: itemState.active,
            updatedAt: new Date().toISOString(),
          };

        // TODO: this works, but arrayContaining must have the exact objects
        // expect.arrayContaining([expectedTokenStateEntry2, expectedTokenStateEntry2]) also passes the test
        expect(retrievedTokenStateEntries).toHaveLength(2);
        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            expectedTokenStateEntry2,
            expectedTokenStateEntry1,
          ])
        );
      });
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
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: updatedEService.id,
        descriptorId: publishedDescriptor.id,
      });
      const previousStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        descriptorAudience: publishedDescriptor.audience[0],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(previousStateEntry, dynamoDBClient);

      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: publishedDescriptor.id,
      });
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPK({
        clientId: generateId<ClientId>(),
        kid: generateId(),
      });
      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPK({
        clientId: generateId<ClientId>(),
        kid: generateId(),
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          descriptorState: itemState.active,
          descriptorAudience: publishedDescriptor.audience[0],
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          descriptorState: itemState.active,
          descriptorAudience: publishedDescriptor.audience[0],
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);
      await sleep(1000, mockDate);

      await handleMessageV2(message, dynamoDBClient);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      expect(retrievedEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenStateEntries =
        await readTokenStateEntriesByEserviceIdAndDescriptorId(
          eserviceId_descriptorId,
          dynamoDBClient
        );
      const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry1,
          descriptorState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry2,
          descriptorState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          expectedTokenStateEntry1,
          expectedTokenStateEntry2,
        ])
      );
    });

    describe("EServiceDescriptorPublished (the eservice has 1 descriptor)", () => {
      it("no previous entry", async () => {
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

        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: updatedEService.id,
          descriptorId: publishedDescriptor.id,
        });
        const retrievedEntry = await readCatalogEntry(
          primaryKey,
          dynamoDBClient
        );
        const expectedEntry: PlatformStatesCatalogEntry = {
          PK: primaryKey,
          state: itemState.active,
          descriptorAudience: publishedDescriptor.audience[0],
          version: 2,
          updatedAt: new Date().toISOString(),
        };
        expect(retrievedEntry).toEqual(expectedEntry);
      });

      // TODO: add test with incoming version 1 and previous entry version 1?
      it("no operation if the entry already exists. Incoming has version 1; previous entry has version 2", async () => {
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
          version: 1,
          type: "EServiceDescriptorPublished",
          event_version: 2,
          data: payload,
          log_date: new Date(),
        };

        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: updatedEService.id,
          descriptorId: publishedDescriptor.id,
        });
        const previousStateEntry: PlatformStatesCatalogEntry = {
          PK: primaryKey,
          state: itemState.active,
          descriptorAudience: publishedDescriptor.audience[0],
          version: 2,
          updatedAt: new Date().toISOString(),
        };
        await writeCatalogEntry(previousStateEntry, dynamoDBClient);
        await handleMessageV2(message, dynamoDBClient);

        const retrievedEntry = await readCatalogEntry(
          primaryKey,
          dynamoDBClient
        );
        expect(retrievedEntry).toEqual(previousStateEntry);
      });
      it("entry has to be updated: incoming has version 3; previous entry has version 2", async () => {
        expect(1).toBe(1);
      });
    });

    describe("EServiceDescriptorPublished (the previous descriptor becomes archived)", () => {
      // these tests start with the basic flow for the current descriptor (simple write operation). Then, additinal checks are added
      it("entry has to be deleted", () => {
        expect(1).toBe(1);
      });
    });

    describe("EServiceDescriptorSuspended", () => {
      it("no operation if the entry already exists: incoming has version 1; previous entry has version 2", () => {
        expect(1).toBe(1);
      });
      it("entry has to be updated: incoming has version 3; previous entry has version 2", async () => {
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
        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: updatedEService.id,
          descriptorId: publishedDescriptor.id,
        });
        const previousStateEntry: PlatformStatesCatalogEntry = {
          PK: primaryKey,
          state: itemState.active,
          descriptorAudience: publishedDescriptor.audience[0],
          version: 1,
          updatedAt: new Date().toISOString(),
        };
        await writeCatalogEntry(previousStateEntry, dynamoDBClient);

        // token-generation-states
        // TODO: replace last generateId() with kid
        const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPK({
          clientId: generateId<ClientId>(),
          kid: generateId(),
        });
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });
        const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
            descriptorState: itemState.active,
            descriptorAudience: publishedDescriptor.audience[0],
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

        const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPK({
          clientId: generateId<ClientId>(),
          kid: generateId(),
        });
        const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
            descriptorState: itemState.active,
            descriptorAudience: publishedDescriptor.audience[0],
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

        await handleMessageV2(message, dynamoDBClient);

        const retrievedEntry = await readCatalogEntry(
          primaryKey,
          dynamoDBClient
        );
        const expectedEntry: PlatformStatesCatalogEntry = {
          ...previousStateEntry,
          state: itemState.inactive,
          version: 2,
          updatedAt: new Date().toISOString(),
        };
        expect(retrievedEntry).toEqual(expectedEntry);

        // token-generation-states
        const retrievedTokenStateEntries =
          await readTokenStateEntriesByEserviceIdAndDescriptorId(
            eserviceId_descriptorId,
            dynamoDBClient
          );
        const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry1,
            descriptorState: itemState.inactive,
            updatedAt: new Date().toISOString(),
          };
        const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry2,
            descriptorState: itemState.inactive,
            updatedAt: new Date().toISOString(),
          };

        expect(retrievedTokenStateEntries).toHaveLength(2);
        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            expectedTokenStateEntry2,
            expectedTokenStateEntry1,
          ])
        );
      });
    });
  });
});
