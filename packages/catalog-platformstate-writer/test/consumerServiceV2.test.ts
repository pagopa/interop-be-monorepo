/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
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
  Descriptor,
  EService,
  EServiceDescriptorActivatedV2,
  EServiceDescriptorArchivedV2,
  EServiceDescriptorPublishedV2,
  EServiceDescriptorQuotasUpdatedByTemplateUpdateV2,
  EServiceDescriptorQuotasUpdatedV2,
  EServiceDescriptorSuspendedV2,
  EServiceEventEnvelope,
  EServiceTemplateId,
  PlatformStatesCatalogEntry,
  TokenGenerationStatesConsumerClient,
  descriptorState,
  generateId,
  itemState,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  makeTokenGenerationStatesClientKidPurposePK,
  toEServiceV2,
} from "pagopa-interop-models";
import {
  getMockDescriptor,
  getMockEService,
  getMockDocument,
  getMockTokenGenStatesConsumerClient,
  buildDynamoDBTables,
  deleteDynamoDBTables,
  readAllTokenGenStatesItems,
  writeTokenGenStatesConsumerClient,
  writePlatformCatalogEntry,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { readCatalogEntry } from "../src/utils.js";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import { dynamoDBClient } from "./utils.js";

describe("integration tests V2 events", async () => {
  beforeEach(async () => {
    await buildDynamoDBTables(dynamoDBClient);
  });
  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
  });
  const mockDate = new Date();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  describe("EServiceDescriptorActivated", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it/test1", "pagopa.it/test2"],
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
        descriptorAudience: publishedDescriptor.audience,
        descriptorVoucherLifespan: publishedDescriptor.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: publishedDescriptor.id,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedCatalogEntry = await readCatalogEntry(
        catalogEntryPrimaryKey,
        dynamoDBClient
      );

      expect(retrievedCatalogEntry).toEqual(previousStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient2,
          tokenGenStatesConsumerClient1,
        ])
      );
    });
    it("should update the entry if the incoming version is more recent than existing table entry", async () => {
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it/test1", "pagopa.it/test2"],
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
        version: 3,
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
        descriptorAudience: publishedDescriptor.audience,
        descriptorVoucherLifespan: publishedDescriptor.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: publishedDescriptor.id,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedCatalogEntry = await readCatalogEntry(
        catalogEntryPrimaryKey,
        dynamoDBClient
      );
      const expectedCatalogEntry: PlatformStatesCatalogEntry = {
        ...previousStateEntry,
        state: itemState.active,
        version: 3,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedCatalogEntry).toEqual(expectedCatalogEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          descriptorState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          descriptorState: itemState.active,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient2,
          expectedTokenGenStatesConsumeClient1,
        ])
      );
    });
    it("should do no operation if the table entry doesn't exist", async () => {
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it/test1", "pagopa.it/test2"],
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

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: publishedDescriptor.id,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      expect(
        handleMessageV2(message, dynamoDBClient, genericLogger)
      ).resolves.not.toThrowError();

      // platform-states
      const retrievedCatalogEntry = await readCatalogEntry(
        catalogEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedCatalogEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient2,
          tokenGenStatesConsumerClient1,
        ])
      );
    });
  });

  describe("EServiceDescriptorArchived", () => {
    it("should delete the entry from platform states and update token generation states", async () => {
      const archivedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it/test1", "pagopa.it/test2"],
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
        descriptorAudience: archivedDescriptor.audience,
        descriptorVoucherLifespan: archivedDescriptor.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousStateEntry, dynamoDBClient);

      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: archivedDescriptor.id,
      });
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          descriptorState: itemState.active,
          descriptorAudience: archivedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          descriptorState: itemState.active,
          descriptorAudience: archivedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      expect(retrievedEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          descriptorState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          descriptorState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });

    it("should do nothing if the descriptor is not the latest", async () => {
      const archivedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.archived,
        publishedAt: new Date(),
        archivedAt: new Date(),
      };
      const newerDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        version: (Number(archivedDescriptor.version) + 1).toString(),
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [archivedDescriptor, newerDescriptor],
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

      const platformsStatesCatalogEntryPK =
        makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: newerDescriptor.id,
        });
      const platformStatesCatalogEntry: PlatformStatesCatalogEntry = {
        PK: platformsStatesCatalogEntryPK,
        state: itemState.inactive,
        descriptorAudience: newerDescriptor.audience,
        descriptorVoucherLifespan: newerDescriptor.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(
        platformStatesCatalogEntry,
        dynamoDBClient
      );

      const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: newerDescriptor.id,
      });
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          descriptorState: itemState.active,
          descriptorAudience: newerDescriptor.audience,
          GSIPK_eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          descriptorState: itemState.active,
          descriptorAudience: newerDescriptor.audience,
          GSIPK_eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      const oldGSIPKEServiceIdDescriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: archivedDescriptor.id,
      });

      // Mocking the query to get the token-generation-states records using the old GSIPK_eserviceId_descriptorId
      const mockDynamoDBClient = {
        send: vi.fn().mockImplementation((command) => {
          if (command instanceof QueryCommand) {
            return Promise.resolve({
              Items: [
                {
                  PK: {
                    S: tokenGenStatesConsumerClient1.PK,
                  },
                  GSIPK_eserviceId_descriptorId: {
                    S: oldGSIPKEServiceIdDescriptorId,
                  },
                },
                {
                  PK: {
                    S: tokenGenStatesConsumerClient2.PK,
                  },
                  GSIPK_eserviceId_descriptorId: {
                    S: oldGSIPKEServiceIdDescriptorId,
                  },
                },
              ],
              LastEvaluatedKey: undefined,
            });
          }

          return dynamoDBClient.send(command);
        }),
      };

      await handleMessageV2(
        message,
        mockDynamoDBClient as unknown as DynamoDBClient,
        genericLogger
      );

      const retrievedPlatformStatesCatalogEntry = await readCatalogEntry(
        platformsStatesCatalogEntryPK,
        dynamoDBClient
      );
      expect(retrievedPlatformStatesCatalogEntry).toEqual(
        platformStatesCatalogEntry
      );

      const archivedPlatformStatesCatalogPK =
        makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: archivedDescriptor.id,
        });
      const retrievedArchivedEntry = await readCatalogEntry(
        archivedPlatformStatesCatalogPK,
        dynamoDBClient
      );
      expect(retrievedArchivedEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });
  });

  describe("EServiceDescriptorPublished", () => {
    describe("the eservice has 1 descriptor", () => {
      it("should add the entry if it doesn't exist", async () => {
        const publishedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          audience: ["pagopa.it/test1", "pagopa.it/test2"],
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

        const tokenGenStatesEntryPK1 =
          makeTokenGenerationStatesClientKidPurposePK({
            clientId: generateId(),
            kid: `kid ${Math.random()}`,
            purposeId: generateId(),
          });
        const tokenGenStatesEntryPK2 =
          makeTokenGenerationStatesClientKidPurposePK({
            clientId: generateId(),
            kid: `kid ${Math.random()}`,
            purposeId: generateId(),
          });
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });

        const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
          {
            ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
            descriptorState: itemState.inactive,
            descriptorAudience: publishedDescriptor.audience,
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenGenStatesConsumerClient(
          tokenGenStatesConsumerClient1,
          dynamoDBClient
        );

        const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
          {
            ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
            descriptorState: itemState.inactive,
            descriptorAudience: publishedDescriptor.audience,
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenGenStatesConsumerClient(
          tokenGenStatesConsumerClient2,
          dynamoDBClient
        );

        await handleMessageV2(message, dynamoDBClient, genericLogger);

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
          descriptorAudience: publishedDescriptor.audience,
          descriptorVoucherLifespan: publishedDescriptor.voucherLifespan,
          version: 2,
          updatedAt: new Date().toISOString(),
        };
        expect(retrievedEntry).toEqual(expectedEntry);

        // token-generation-states
        const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
          dynamoDBClient
        );
        const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
          {
            ...tokenGenStatesConsumerClient1,
            descriptorState: itemState.active,
            updatedAt: new Date().toISOString(),
          };
        const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
          {
            ...tokenGenStatesConsumerClient2,
            descriptorState: itemState.active,
            updatedAt: new Date().toISOString(),
          };
        expect(retrievedTokenGenStatesEntries).toEqual(
          expect.arrayContaining([
            expectedTokenGenStatesConsumeClient1,
            expectedTokenGenStatesConsumeClient2,
          ])
        );
      });

      it("should do no operation if the existing table entry is more recent", async () => {
        const publishedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          audience: ["pagopa.it/test1", "pagopa.it/test2"],
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
          descriptorAudience: publishedDescriptor.audience,
          descriptorVoucherLifespan: publishedDescriptor.voucherLifespan,
          version: 2,
          updatedAt: new Date().toISOString(),
        };
        await writePlatformCatalogEntry(previousStateEntry, dynamoDBClient);

        const tokenGenStatesEntryPK1 =
          makeTokenGenerationStatesClientKidPurposePK({
            clientId: generateId(),
            kid: `kid ${Math.random()}`,
            purposeId: generateId(),
          });
        const tokenGenStatesEntryPK2 =
          makeTokenGenerationStatesClientKidPurposePK({
            clientId: generateId(),
            kid: `kid ${Math.random()}`,
            purposeId: generateId(),
          });
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });

        const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
          {
            ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
            descriptorState: itemState.inactive,
            descriptorAudience: publishedDescriptor.audience,
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenGenStatesConsumerClient(
          tokenGenStatesConsumerClient1,
          dynamoDBClient
        );

        const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
          {
            ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
            descriptorState: itemState.inactive,
            descriptorAudience: publishedDescriptor.audience,
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenGenStatesConsumerClient(
          tokenGenStatesConsumerClient2,
          dynamoDBClient
        );
        await handleMessageV2(message, dynamoDBClient, genericLogger);

        const retrievedEntry = await readCatalogEntry(
          primaryKey,
          dynamoDBClient
        );
        expect(retrievedEntry).toEqual(previousStateEntry);

        // token-generation-states
        const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
          dynamoDBClient
        );

        expect(retrievedTokenGenStatesEntries).toEqual(
          expect.arrayContaining([
            tokenGenStatesConsumerClient1,
            tokenGenStatesConsumerClient2,
          ])
        );
      });
      it("should update the entry if incoming version is more recent than existing table entry", async () => {
        const publishedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          audience: ["pagopa.it/test1", "pagopa.it/test2"],
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
          descriptorAudience: publishedDescriptor.audience,
          descriptorVoucherLifespan: publishedDescriptor.voucherLifespan,
          version: 2,
          updatedAt: new Date().toISOString(),
        };
        await writePlatformCatalogEntry(previousStateEntry, dynamoDBClient);
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });
        const tokenGenStatesEntryPK1 =
          makeTokenGenerationStatesClientKidPurposePK({
            clientId: generateId(),
            kid: `kid ${Math.random()}`,
            purposeId: generateId(),
          });
        const tokenGenStatesEntryPK2 =
          makeTokenGenerationStatesClientKidPurposePK({
            clientId: generateId(),
            kid: `kid ${Math.random()}`,
            purposeId: generateId(),
          });
        const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
          {
            ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
            descriptorState: itemState.inactive,
            descriptorAudience: publishedDescriptor.audience,
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenGenStatesConsumerClient(
          tokenGenStatesConsumerClient1,
          dynamoDBClient
        );

        const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
          {
            ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
            descriptorState: itemState.inactive,
            descriptorAudience: publishedDescriptor.audience,
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenGenStatesConsumerClient(
          tokenGenStatesConsumerClient2,
          dynamoDBClient
        );

        await handleMessageV2(message, dynamoDBClient, genericLogger);

        // token-generation-states
        const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
          dynamoDBClient
        );
        const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
          {
            ...tokenGenStatesConsumerClient1,
            descriptorState: itemState.active,
            updatedAt: new Date().toISOString(),
          };
        const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
          {
            ...tokenGenStatesConsumerClient2,
            descriptorState: itemState.active,
            updatedAt: new Date().toISOString(),
          };
        expect(retrievedTokenGenStatesEntries).toEqual(
          expect.arrayContaining([
            expectedTokenGenStatesConsumeClient2,
            expectedTokenGenStatesConsumeClient1,
          ])
        );
      });
    });

    describe("the previous descriptor becomes archived", () => {
      // these tests start with the basic flow for the current descriptor (simple write operation). Then, additional checks are added
      it("should delete the entry in platform states and update the entries in token generation states", async () => {
        const archivedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.archived,
          audience: ["pagopa.it/test1", "pagopa.it/test2"],
          interface: getMockDocument(),
          version: "1",
          publishedAt: new Date(),
          archivedAt: new Date(),
        };
        const publishedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          archivedAt: new Date(),
          state: descriptorState.published,
          audience: ["pagopa.it/test1", "pagopa.it/test2"],
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

        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: archivedDescriptor.id,
        });
        const tokenGenStatesEntryPK1 =
          makeTokenGenerationStatesClientKidPurposePK({
            clientId: generateId(),
            kid: `kid ${Math.random()}`,
            purposeId: generateId(),
          });
        const tokenGenStatesEntryPK2 =
          makeTokenGenerationStatesClientKidPurposePK({
            clientId: generateId(),
            kid: `kid ${Math.random()}`,
            purposeId: generateId(),
          });
        const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
          {
            ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
            descriptorState: itemState.active,
            descriptorAudience: publishedDescriptor.audience,
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenGenStatesConsumerClient(
          tokenGenStatesConsumerClient1,
          dynamoDBClient
        );

        const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
          {
            ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
            descriptorState: itemState.active,
            descriptorAudience: publishedDescriptor.audience,
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenGenStatesConsumerClient(
          tokenGenStatesConsumerClient2,
          dynamoDBClient
        );

        await handleMessageV2(message, dynamoDBClient, genericLogger);

        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: archivedDescriptor.id,
        });
        const retrievedEntry = await readCatalogEntry(
          primaryKey,
          dynamoDBClient
        );
        expect(retrievedEntry).toBeUndefined();

        // token-generation-states
        const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
          dynamoDBClient
        );
        const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
          {
            ...tokenGenStatesConsumerClient1,
            descriptorState: itemState.inactive,
            updatedAt: new Date().toISOString(),
          };
        const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
          {
            ...tokenGenStatesConsumerClient2,
            descriptorState: itemState.inactive,
            updatedAt: new Date().toISOString(),
          };
        expect(retrievedTokenGenStatesEntries).toEqual(
          expect.arrayContaining([
            expectedTokenGenStatesConsumeClient2,
            expectedTokenGenStatesConsumeClient1,
          ])
        );
      });
    });
  });

  describe("EServiceDescriptorSuspended", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
      const suspendedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it/test1", "pagopa.it/test2"],
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
        descriptorAudience: suspendedDescriptor.audience,
        descriptorVoucherLifespan: suspendedDescriptor.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: suspendedDescriptor.id,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          descriptorState: itemState.active,
          descriptorAudience: suspendedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          descriptorState: itemState.active,
          descriptorAudience: suspendedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);

      expect(retrievedEntry).toEqual(previousStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient2,
          tokenGenStatesConsumerClient1,
        ])
      );
    });
    it("should update the entry if the incoming version is more recent than existing table entry", async () => {
      const suspendedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it/test1", "pagopa.it/test2"],
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
        descriptorAudience: suspendedDescriptor.audience,
        descriptorVoucherLifespan: suspendedDescriptor.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: suspendedDescriptor.id,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          descriptorState: itemState.active,
          descriptorAudience: suspendedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          descriptorState: itemState.active,
          descriptorAudience: suspendedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      const expectedEntry: PlatformStatesCatalogEntry = {
        ...previousStateEntry,
        state: itemState.inactive,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedEntry).toEqual(expectedEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          descriptorState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          descriptorState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient2,
          expectedTokenGenStatesConsumeClient1,
        ])
      );
    });
    it("should do no operation if entry doesn't exist", async () => {
      const suspendedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it/test1", "pagopa.it/test2"],
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
      const catalogEntryPrimaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: suspendedDescriptor.id,
      });

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: suspendedDescriptor.id,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          descriptorState: itemState.inactive,
          descriptorAudience: suspendedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          descriptorState: itemState.inactive,
          descriptorAudience: suspendedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      expect(
        handleMessageV2(message, dynamoDBClient, genericLogger)
      ).resolves.not.toThrowError();

      // platform-states
      const retrievedCatalogEntry = await readCatalogEntry(
        catalogEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedCatalogEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });
  });

  describe("EServiceDescriptorQuotasUpdated", () => {
    it("should do no operation if the existing version is more recent", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it/test1", "pagopa.it/test2"],
        interface: getMockDocument(),
        state: descriptorState.suspended,
        publishedAt: new Date(),
        suspendedAt: new Date(),
        voucherLifespan: 60,
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };

      const updatedDescriptor: Descriptor = {
        ...descriptor,
        voucherLifespan: 120,
      };

      const updatedEService: EService = {
        ...eservice,
        descriptors: [updatedDescriptor],
      };

      const payload: EServiceDescriptorQuotasUpdatedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: updatedDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: eservice.id,
        version: 1,
        type: "EServiceDescriptorQuotasUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: updatedDescriptor.id,
      });
      const previousStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.active,
        descriptorAudience: updatedDescriptor.audience,
        descriptorVoucherLifespan: descriptor.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);

      expect(retrievedEntry).toEqual(previousStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient2,
          tokenGenStatesConsumerClient1,
        ])
      );
    });
    it("should update the entry if the incoming version is more recent than the existing table entry", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it/test1", "pagopa.it/test2"],
        interface: getMockDocument(),
        state: descriptorState.suspended,
        publishedAt: new Date(),
        suspendedAt: new Date(),
        voucherLifespan: 60,
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };

      const updatedDescriptor: Descriptor = {
        ...descriptor,
        voucherLifespan: 120,
      };

      const updatedEService: EService = {
        ...eservice,
        descriptors: [updatedDescriptor],
      };

      const payload: EServiceDescriptorQuotasUpdatedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: updatedDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: eservice.id,
        version: 3,
        type: "EServiceDescriptorQuotasUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: updatedDescriptor.id,
      });
      const previousStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.active,
        descriptorAudience: updatedDescriptor.audience,
        descriptorVoucherLifespan: descriptor.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      const expectedEntry: PlatformStatesCatalogEntry = {
        ...previousStateEntry,
        version: 3,
        descriptorVoucherLifespan: updatedDescriptor.voucherLifespan,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedEntry).toEqual(expectedEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          descriptorVoucherLifespan: updatedDescriptor.voucherLifespan,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          descriptorVoucherLifespan: updatedDescriptor.voucherLifespan,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient2,
          expectedTokenGenStatesConsumeClient1,
        ])
      );
    });
    it("should do no operation if entry doesn't exist", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it/test1", "pagopa.it/test2"],
        interface: getMockDocument(),
        state: descriptorState.suspended,
        publishedAt: new Date(),
        suspendedAt: new Date(),
        voucherLifespan: 60,
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };

      const updatedDescriptor: Descriptor = {
        ...descriptor,
        voucherLifespan: 120,
      };

      const updatedEService: EService = {
        ...eservice,
        descriptors: [updatedDescriptor],
      };

      const payload: EServiceDescriptorQuotasUpdatedV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: updatedDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: eservice.id,
        version: 3,
        type: "EServiceDescriptorQuotasUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: updatedDescriptor.id,
      });

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      expect(
        handleMessageV2(message, dynamoDBClient, genericLogger)
      ).resolves.not.toThrowError();

      // platform-states
      const retrievedCatalogEntry = await readCatalogEntry(
        primaryKey,
        dynamoDBClient
      );
      expect(retrievedCatalogEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });
  });

  describe("EServiceDescriptorQuotasUpdatedByTemplateUpdate", () => {
    it("should do no operation if the existing version is more recent", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it/test1", "pagopa.it/test2"],
        interface: getMockDocument(),
        state: descriptorState.suspended,
        publishedAt: new Date(),
        suspendedAt: new Date(),
        voucherLifespan: 60,
        templateVersionRef: { id: generateId() },
      };
      const eservice: EService = {
        ...getMockEService(),
        templateId: generateId<EServiceTemplateId>(),
        descriptors: [descriptor],
      };

      const updatedDescriptor: Descriptor = {
        ...descriptor,
        voucherLifespan: 120,
      };

      const updatedEService: EService = {
        ...eservice,
        descriptors: [updatedDescriptor],
      };

      const payload: EServiceDescriptorQuotasUpdatedByTemplateUpdateV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: updatedDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: eservice.id,
        version: 1,
        type: "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: updatedDescriptor.id,
      });
      const previousStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.active,
        descriptorAudience: updatedDescriptor.audience,
        descriptorVoucherLifespan: descriptor.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);

      expect(retrievedEntry).toEqual(previousStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient2,
          tokenGenStatesConsumerClient1,
        ])
      );
    });
    it("should update the entry if the incoming version is more recent than the existing table entry", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it/test1", "pagopa.it/test2"],
        interface: getMockDocument(),
        state: descriptorState.suspended,
        publishedAt: new Date(),
        suspendedAt: new Date(),
        voucherLifespan: 60,
        templateVersionRef: { id: generateId() },
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
        templateId: generateId<EServiceTemplateId>(),
      };

      const updatedDescriptor: Descriptor = {
        ...descriptor,
        voucherLifespan: 120,
      };

      const updatedEService: EService = {
        ...eservice,
        descriptors: [updatedDescriptor],
      };

      const payload: EServiceDescriptorQuotasUpdatedByTemplateUpdateV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: updatedDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: eservice.id,
        version: 3,
        type: "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: updatedDescriptor.id,
      });
      const previousStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.active,
        descriptorAudience: updatedDescriptor.audience,
        descriptorVoucherLifespan: descriptor.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      const expectedEntry: PlatformStatesCatalogEntry = {
        ...previousStateEntry,
        version: 3,
        descriptorVoucherLifespan: updatedDescriptor.voucherLifespan,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedEntry).toEqual(expectedEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          descriptorVoucherLifespan: updatedDescriptor.voucherLifespan,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          descriptorVoucherLifespan: updatedDescriptor.voucherLifespan,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient2,
          expectedTokenGenStatesConsumeClient1,
        ])
      );
    });
    it("should do no operation if entry doesn't exist", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it/test1", "pagopa.it/test2"],
        interface: getMockDocument(),
        state: descriptorState.suspended,
        publishedAt: new Date(),
        suspendedAt: new Date(),
        voucherLifespan: 60,
        templateVersionRef: { id: generateId() },
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
        templateId: generateId<EServiceTemplateId>(),
      };

      const updatedDescriptor: Descriptor = {
        ...descriptor,
        voucherLifespan: 120,
      };

      const updatedEService: EService = {
        ...eservice,
        descriptors: [updatedDescriptor],
      };

      const payload: EServiceDescriptorQuotasUpdatedByTemplateUpdateV2 = {
        eservice: toEServiceV2(updatedEService),
        descriptorId: updatedDescriptor.id,
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: eservice.id,
        version: 3,
        type: "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: updatedDescriptor.id,
      });

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      expect(
        handleMessageV2(message, dynamoDBClient, genericLogger)
      ).resolves.not.toThrowError();

      // platform-states
      const retrievedCatalogEntry = await readCatalogEntry(
        primaryKey,
        dynamoDBClient
      );
      expect(retrievedCatalogEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });
  });
});
