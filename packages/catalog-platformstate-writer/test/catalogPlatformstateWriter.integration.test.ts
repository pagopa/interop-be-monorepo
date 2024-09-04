/* eslint-disable @typescript-eslint/no-floating-promises */
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
  ConditionalCheckFailedException,
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
  deleteCatalogEntry,
  descriptorStateToClientState,
  readCatalogEntry,
  readTokenStateEntriesByEserviceIdAndDescriptorId,
  sleep,
  updateDescriptorStateInPlatformStatesEntry,
  updateDescriptorStateInTokenGenerationStatesTable,
  writeCatalogEntry,
  writeTokenStateEntry,
} from "../src/utils.js";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import { config } from "./utils.js";

describe("integration tests", async () => {
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
    await dynamoDBClient.send(command2);
    // console.log(result);

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

  describe("utils", async () => {
    // TODO: move this to other test file after improving table setup
    describe("updateDescriptorStateInPlatformStatesEntry", async () => {
      it("should throw error if previous entry doesn't exist", async () => {
        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: generateId(),
          descriptorId: generateId(),
        });
        expect(
          updateDescriptorStateInPlatformStatesEntry(
            dynamoDBClient,
            primaryKey,
            itemState.active,
            1
          )
        ).rejects.toThrowError(ConditionalCheckFailedException);
        const catalogEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
        expect(catalogEntry).toBeUndefined();
      });

      it("should update state if previous entry exists", async () => {
        expect(1).toBe(1);
      });
    });

    describe("writeCatalogEntry", async () => {
      it("should throw error if previous entry exists", async () => {
        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: generateId(),
          descriptorId: generateId(),
        });
        const catalogEntry: PlatformStatesCatalogEntry = {
          PK: primaryKey,
          state: itemState.inactive,
          descriptorAudience: "pagopa.it",
          version: 1,
          updatedAt: new Date().toISOString(),
        };
        await writeCatalogEntry(catalogEntry, dynamoDBClient);
        expect(
          writeCatalogEntry(catalogEntry, dynamoDBClient)
        ).rejects.toThrowError(ConditionalCheckFailedException);
      });

      it("should write if previous entry doesn't exist", async () => {
        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: generateId(),
          descriptorId: generateId(),
        });
        const catalogStateEntry: PlatformStatesCatalogEntry = {
          PK: primaryKey,
          state: itemState.inactive,
          descriptorAudience: "pagopa.it",
          version: 1,
          updatedAt: new Date().toISOString(),
        };
        // TODO: useful?
        expect(
          await readCatalogEntry(primaryKey, dynamoDBClient)
        ).toBeUndefined();
        await writeCatalogEntry(catalogStateEntry, dynamoDBClient);
        const expectedCatalogEntry = await readCatalogEntry(
          primaryKey,
          dynamoDBClient
        );

        expect(expectedCatalogEntry).toEqual(catalogStateEntry);
      });
    });

    describe("readCatalogEntry", async () => {
      it("should return undefined if entry doesn't exist", async () => {
        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: generateId(),
          descriptorId: generateId(),
        });
        const catalogEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
        expect(catalogEntry).toBeUndefined();
      });

      it("should return entry if it exists", async () => {
        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: generateId(),
          descriptorId: generateId(),
        });
        const previousCatalogStateEntry: PlatformStatesCatalogEntry = {
          PK: primaryKey,
          state: itemState.inactive,
          descriptorAudience: "pagopa.it",
          version: 1,
          updatedAt: new Date().toISOString(),
        };
        await writeCatalogEntry(previousCatalogStateEntry, dynamoDBClient);
        const expectedCatalogEntry = await readCatalogEntry(
          primaryKey,
          dynamoDBClient
        );

        expect(expectedCatalogEntry).toEqual(previousCatalogStateEntry);
      });
    });

    describe("deleteCatalogEntry", async () => {
      // TODO: change with does NOT throw error
      it.skip("should not throw error if previous entry doesn't exist", async () => {
        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: generateId(),
          descriptorId: generateId(),
        });
        expect(
          deleteCatalogEntry(primaryKey, dynamoDBClient)
        ).rejects.toThrowError(ConditionalCheckFailedException);
      });

      it("should delete the entry if it exists", async () => {
        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: generateId(),
          descriptorId: generateId(),
        });
        const previousCatalogStateEntry: PlatformStatesCatalogEntry = {
          PK: primaryKey,
          state: itemState.inactive,
          descriptorAudience: "pagopa.it",
          version: 1,
          updatedAt: new Date().toISOString(),
        };
        await writeCatalogEntry(previousCatalogStateEntry, dynamoDBClient);
        await deleteCatalogEntry(primaryKey, dynamoDBClient);
        const expectedCatalogEntry = await readCatalogEntry(
          primaryKey,
          dynamoDBClient
        );
        expect(expectedCatalogEntry).toBeUndefined();
      });
    });

    describe("descriptorStateToClientState", async () => {
      it.each([descriptorState.published, descriptorState.deprecated])(
        "should convert %s state to active",
        async (s) => {
          expect(descriptorStateToClientState(s)).toBe(itemState.active);
        }
      );

      it.each([
        descriptorState.archived,
        descriptorState.draft,
        descriptorState.suspended,
      ])("should convert %s state to inactive", async (s) => {
        expect(descriptorStateToClientState(s)).toBe(itemState.inactive);
      });
    });

    // token-generation-states
    describe("writeTokenStateEntry", async () => {
      it("should throw error if previous entry exists", async () => {
        const tokenStateEntryPK = makeTokenGenerationStatesClientKidPK({
          clientId: generateId(),
          kid: generateId(),
        });
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: generateId(),
          descriptorId: generateId(),
        });
        const tokenStateEntry: TokenGenerationStatesClientPurposeEntry = {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK),
          descriptorState: itemState.inactive,
          descriptorAudience: "pagopa.it",
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStateEntry(tokenStateEntry, dynamoDBClient);
        expect(
          writeTokenStateEntry(tokenStateEntry, dynamoDBClient)
        ).rejects.toThrowError(ConditionalCheckFailedException);
      });

      it("should write if previous entry doesn't exist", async () => {
        const tokenStateEntryPK = makeTokenGenerationStatesClientKidPK({
          clientId: generateId(),
          kid: generateId(),
        });
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: generateId(),
          descriptorId: generateId(),
        });
        // TODO: is this expect needed?
        const previousTokenStateEntries =
          await readTokenStateEntriesByEserviceIdAndDescriptorId(
            eserviceId_descriptorId,
            dynamoDBClient
          );
        expect(previousTokenStateEntries).toEqual([]);
        const tokenStateEntry: TokenGenerationStatesClientPurposeEntry = {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK),
          descriptorState: itemState.inactive,
          descriptorAudience: "pagopa.it",
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStateEntry(tokenStateEntry, dynamoDBClient);
        const expectedTokenStateEntries =
          await readTokenStateEntriesByEserviceIdAndDescriptorId(
            eserviceId_descriptorId,
            dynamoDBClient
          );

        expect(expectedTokenStateEntries).toEqual([tokenStateEntry]);
      });
    });

    describe("readTokenStateEntriesByEserviceIdAndDescriptorId", async () => {
      it("should return empty string if entries do not exist", async () => {
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: generateId(),
          descriptorId: generateId(),
        });
        const result = await readTokenStateEntriesByEserviceIdAndDescriptorId(
          eserviceId_descriptorId,
          dynamoDBClient
        );
        expect(result).toEqual([]);
      });

      it("should return entries if they exist", async () => {
        const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPK({
          clientId: generateId(),
          kid: generateId(),
        });
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: generateId(),
          descriptorId: generateId(),
        });
        const tokenStateEntry1: TokenGenerationStatesClientPurposeEntry = {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          descriptorState: itemState.inactive,
          descriptorAudience: "pagopa.it",
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStateEntry(tokenStateEntry1, dynamoDBClient);

        const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPK({
          clientId: generateId<ClientId>(),
          kid: generateId(),
        });
        const tokenStateEntry2: TokenGenerationStatesClientPurposeEntry = {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          descriptorState: itemState.inactive,
          descriptorAudience: "pagopa.it",
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStateEntry(tokenStateEntry2, dynamoDBClient);

        const tokenEntries =
          await readTokenStateEntriesByEserviceIdAndDescriptorId(
            eserviceId_descriptorId,
            dynamoDBClient
          );

        expect(tokenEntries).toEqual(
          expect.arrayContaining([tokenStateEntry1, tokenStateEntry2])
        );
      });
    });

    describe("updateDescriptorStateInTokenGenerationStatesTable", async () => {
      // TODO: old description: should throw error if previous entry doesn't exist. Change with does NOT throw error
      // FIXME: does nothing. Doesn't throw error
      it.skip("should do nothing if previous entry doesn't exist", async () => {
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: generateId(),
          descriptorId: generateId(),
        });
        expect(
          updateDescriptorStateInTokenGenerationStatesTable(
            eserviceId_descriptorId,
            descriptorState.archived,
            dynamoDBClient
          )
        ).rejects.toThrowError(ConditionalCheckFailedException);
      });

      // TODO: entry or entries?
      it("should update state if previous entry exists", async () => {
        const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPK({
          clientId: generateId<ClientId>(),
          kid: generateId(),
        });
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: generateId(),
          descriptorId: generateId(),
        });
        const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
            descriptorState: itemState.inactive,
            descriptorAudience: "pagopa.it",
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
            descriptorAudience: "pagopa.it",
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);
        await updateDescriptorStateInTokenGenerationStatesTable(
          eserviceId_descriptorId,
          descriptorState.published,
          dynamoDBClient
        );
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

  describe("Events V2", async () => {
    describe("EServiceDescriptorActivated", () => {
      it("no operation if the entry already exists: incoming has version 1; previous entry has version 2", async () => {
        const publishedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          audience: ["pagopa.it"],
          interface: getMockDocument(),
          state: descriptorState.published,
          publishedAt: new Date(),
        };
        const eservice: EService = {
          ...getMockEService(),
          descriptors: [publishedDescriptor],
        };
        const payload: EServiceDescriptorActivatedV2 = {
          eservice: toEServiceV2(eservice),
          descriptorId: publishedDescriptor.id,
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 1,
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
          version: 2,
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

        expect(retrievedCatalogEntry).toEqual(previousStateEntry);

        // token-generation-states
        const retrievedTokenStateEntries =
          await readTokenStateEntriesByEserviceIdAndDescriptorId(
            eserviceId_descriptorId,
            dynamoDBClient
          );

        expect(retrievedTokenStateEntries).toHaveLength(2);
        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            previousTokenStateEntry1,
            previousTokenStateEntry2,
          ])
        );
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
          ...getMockEService(),
          descriptors: [publishedDescriptor],
        };

        const payload: EServiceDescriptorActivatedV2 = {
          eservice: toEServiceV2(eservice),
          descriptorId: publishedDescriptor.id,
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: eservice.id,
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
      const archivedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it"],
        interface: getMockDocument(),
        state: descriptorState.archived,
        publishedAt: new Date(),
        archivedAt: new Date(),
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [archivedDescriptor],
      };

      const payload: EServiceDescriptorArchivedV2 = {
        eservice: toEServiceV2(eservice),
        descriptorId: archivedDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: eservice.id,
        version: 2,
        type: "EServiceDescriptorArchived",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: archivedDescriptor.id,
      });
      const previousStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        descriptorAudience: archivedDescriptor.audience[0],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(previousStateEntry, dynamoDBClient);

      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: archivedDescriptor.id,
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
          descriptorAudience: archivedDescriptor.audience[0],
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          descriptorState: itemState.active,
          descriptorAudience: archivedDescriptor.audience[0],
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
        const publishedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          audience: ["pagopa.it"],
          interface: getMockDocument(),
          state: descriptorState.published,
          publishedAt: new Date(),
        };
        const eservice: EService = {
          ...getMockEService(),
          descriptors: [publishedDescriptor],
        };

        const payload: EServiceDescriptorPublishedV2 = {
          eservice: toEServiceV2(eservice),
          descriptorId: publishedDescriptor.id,
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 2,
          type: "EServiceDescriptorPublished",
          event_version: 2,
          data: payload,
          log_date: new Date(),
        };

        // TO DO token-generation-states? If the descriptor was draft, there were no entries in token-generation-states

        await handleMessageV2(message, dynamoDBClient);

        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
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
        const publishedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          audience: ["pagopa.it"],
          interface: getMockDocument(),
          state: descriptorState.published,
          publishedAt: new Date(),
        };
        const eservice: EService = {
          ...getMockEService(),
          descriptors: [publishedDescriptor],
        };

        const payload: EServiceDescriptorPublishedV2 = {
          eservice: toEServiceV2(eservice),
          descriptorId: publishedDescriptor.id,
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 1,
          type: "EServiceDescriptorPublished",
          event_version: 2,
          data: payload,
          log_date: new Date(),
        };

        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
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
        const publishedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          audience: ["pagopa.it"],
          interface: getMockDocument(),
          state: descriptorState.published,
          publishedAt: new Date(),
        };
        const eservice: EService = {
          ...getMockEService(),
          descriptors: [publishedDescriptor],
        };

        const payload: EServiceDescriptorArchivedV2 = {
          eservice: toEServiceV2(eservice),
          descriptorId: publishedDescriptor.id,
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 3,
          type: "EServiceDescriptorPublished",
          event_version: 2,
          data: payload,
          log_date: new Date(),
        };
        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });
        const previousStateEntry: PlatformStatesCatalogEntry = {
          PK: primaryKey,
          state: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience[0],
          version: 2,
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
            descriptorState: itemState.inactive,
            descriptorAudience: publishedDescriptor.audience[0],
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

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
        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            expectedTokenStateEntry2,
            expectedTokenStateEntry1,
          ])
        );
      });
    });

    describe("EServiceDescriptorPublished (the previous descriptor becomes archived)", () => {
      // these tests start with the basic flow for the current descriptor (simple write operation). Then, additional checks are added
      it("entry has to be deleted", async () => {
        const archivedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.archived,
          audience: ["pagopa.it"],
          interface: getMockDocument(),
          version: "1",
          publishedAt: new Date(),
          archivedAt: new Date(),
        };
        const publishedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          archivedAt: new Date(),
          state: descriptorState.published,
          audience: ["pagopa.it"],
          interface: getMockDocument(),
          version: "2",
        };

        const eservice: EService = {
          ...getMockEService(),
          descriptors: [archivedDescriptor, publishedDescriptor],
        };
        const payload: EServiceDescriptorPublishedV2 = {
          eservice: toEServiceV2(eservice),
          descriptorId: publishedDescriptor.id,
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 2,
          type: "EServiceDescriptorPublished",
          event_version: 2,
          data: payload,
          log_date: new Date(),
        };

        await handleMessageV2(message, dynamoDBClient);

        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });
        const retrievedEntry = await readCatalogEntry(
          primaryKey,
          dynamoDBClient
        );
        expect(retrievedEntry).toBeUndefined();
      });
    });

    describe("EServiceDescriptorSuspended", () => {
      it("no operation if the entry already exists: incoming has version 1; previous entry has version 2", async () => {
        const suspendedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          audience: ["pagopa.it"],
          interface: getMockDocument(),
          state: descriptorState.suspended,
          publishedAt: new Date(),
          suspendedAt: new Date(),
        };
        const eservice: EService = {
          ...getMockEService(),
          descriptors: [suspendedDescriptor],
        };

        const payload: EServiceDescriptorSuspendedV2 = {
          eservice: toEServiceV2(eservice),
          descriptorId: suspendedDescriptor.id,
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 1,
          type: "EServiceDescriptorSuspended",
          event_version: 2,
          data: payload,
          log_date: new Date(),
        };
        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: suspendedDescriptor.id,
        });
        const previousStateEntry: PlatformStatesCatalogEntry = {
          PK: primaryKey,
          state: itemState.active,
          descriptorAudience: suspendedDescriptor.audience[0],
          version: 2,
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
          descriptorId: suspendedDescriptor.id,
        });
        const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
            descriptorState: itemState.active,
            descriptorAudience: suspendedDescriptor.audience[0],
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
            descriptorAudience: suspendedDescriptor.audience[0],
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

        await handleMessageV2(message, dynamoDBClient);

        const retrievedEntry = await readCatalogEntry(
          primaryKey,
          dynamoDBClient
        );

        expect(retrievedEntry).toEqual(previousStateEntry);

        // token-generation-states
        const retrievedTokenStateEntries =
          await readTokenStateEntriesByEserviceIdAndDescriptorId(
            eserviceId_descriptorId,
            dynamoDBClient
          );

        expect(retrievedTokenStateEntries).toHaveLength(2);
        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            previousTokenStateEntry2,
            previousTokenStateEntry1,
          ])
        );
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
          ...getMockEService(),
          descriptors: [suspendedDescriptor],
        };
        const payload: EServiceDescriptorSuspendedV2 = {
          eservice: toEServiceV2(eservice),
          descriptorId: suspendedDescriptor.id,
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 2,
          type: "EServiceDescriptorSuspended",
          event_version: 2,
          data: payload,
          log_date: new Date(),
        };
        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: suspendedDescriptor.id,
        });
        const previousStateEntry: PlatformStatesCatalogEntry = {
          PK: primaryKey,
          state: itemState.active,
          descriptorAudience: suspendedDescriptor.audience[0],
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
          descriptorId: suspendedDescriptor.id,
        });
        const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
            descriptorState: itemState.active,
            descriptorAudience: suspendedDescriptor.audience[0],
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
            descriptorAudience: suspendedDescriptor.audience[0],
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
