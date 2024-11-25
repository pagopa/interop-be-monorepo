/* eslint-disable @typescript-eslint/no-floating-promises */
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
  Descriptor,
  EService,
  EServiceDescriptorActivatedV2,
  EServiceDescriptorArchivedV2,
  EServiceDescriptorPublishedV2,
  EServiceDescriptorQuotasUpdatedV2,
  EServiceDescriptorSuspendedV2,
  EServiceEventEnvelope,
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
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  getMockDescriptor,
  getMockEService,
  getMockDocument,
  getMockTokenStatesConsumerClient,
  buildDynamoDBTables,
  deleteDynamoDBTables,
  readTokenStatesEntriesByGSIPKEServiceIdDescriptorId,
  writeTokenStatesConsumerClient,
} from "pagopa-interop-commons-test";
import { readCatalogEntry, writeCatalogEntry } from "../src/utils.js";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import { config } from "./utils.js";

describe("integration tests V2 events", async () => {
  if (!config) {
    fail();
  }
  const dynamoDBClient = new DynamoDBClient({
    endpoint: `http://localhost:${config.tokenGenerationReadModelDbPort}`,
  });
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
      await writeCatalogEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: publishedDescriptor.id,
      });
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
        descriptorState: itemState.inactive,
        descriptorAudience: publishedDescriptor.audience,
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry1,
        dynamoDBClient
      );

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
        descriptorState: itemState.inactive,
        descriptorAudience: publishedDescriptor.audience,
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient);

      // platform-states
      const retrievedCatalogEntry = await readCatalogEntry(
        catalogEntryPrimaryKey,
        dynamoDBClient
      );

      expect(retrievedCatalogEntry).toEqual(previousStateEntry);

      // token-generation-states
      const retrievedTokenStateEntries =
        await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
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
      await writeCatalogEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: publishedDescriptor.id,
      });
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
        descriptorState: itemState.inactive,
        descriptorAudience: publishedDescriptor.audience,
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry1,
        dynamoDBClient
      );

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
        descriptorState: itemState.inactive,
        descriptorAudience: publishedDescriptor.audience,
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient);

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
      const retrievedTokenStateEntries =
        await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
          eserviceId_descriptorId,
          dynamoDBClient
        );
      const expectedTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...previousTokenStateEntry1,
        descriptorState: itemState.active,
        updatedAt: new Date().toISOString(),
      };
      const expectedTokenStateEntry2: TokenGenerationStatesConsumerClient = {
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
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: publishedDescriptor.id,
      });
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
        descriptorState: itemState.inactive,
        descriptorAudience: publishedDescriptor.audience,
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry1,
        dynamoDBClient
      );

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
        descriptorState: itemState.inactive,
        descriptorAudience: publishedDescriptor.audience,
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );

      expect(
        handleMessageV2(message, dynamoDBClient)
      ).resolves.not.toThrowError();

      // platform-states
      const retrievedCatalogEntry = await readCatalogEntry(
        catalogEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedCatalogEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenStateEntries =
        await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
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
      await writeCatalogEntry(previousStateEntry, dynamoDBClient);

      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: archivedDescriptor.id,
      });
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
        descriptorState: itemState.active,
        descriptorAudience: archivedDescriptor.audience,
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry1,
        dynamoDBClient
      );

      const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
        descriptorState: itemState.active,
        descriptorAudience: archivedDescriptor.audience,
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      expect(retrievedEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenStateEntries =
        await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
          eserviceId_descriptorId,
          dynamoDBClient
        );
      const expectedTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...previousTokenStateEntry1,
        descriptorState: itemState.inactive,
        updatedAt: new Date().toISOString(),
      };
      const expectedTokenStateEntry2: TokenGenerationStatesConsumerClient = {
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

        const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });

        const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
          ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStatesConsumerClient(
          previousTokenStateEntry1,
          dynamoDBClient
        );

        const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
          ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStatesConsumerClient(
          previousTokenStateEntry2,
          dynamoDBClient
        );

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
          descriptorAudience: publishedDescriptor.audience,
          descriptorVoucherLifespan: publishedDescriptor.voucherLifespan,
          version: 2,
          updatedAt: new Date().toISOString(),
        };
        expect(retrievedEntry).toEqual(expectedEntry);

        // token-generation-states
        const retrievedTokenStateEntries =
          await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
            eserviceId_descriptorId,
            dynamoDBClient
          );
        const expectedTokenStateEntry1: TokenGenerationStatesConsumerClient = {
          ...previousTokenStateEntry1,
          descriptorState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
        const expectedTokenStateEntry2: TokenGenerationStatesConsumerClient = {
          ...previousTokenStateEntry2,
          descriptorState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            expectedTokenStateEntry1,
            expectedTokenStateEntry2,
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
        await writeCatalogEntry(previousStateEntry, dynamoDBClient);

        const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });

        const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
          ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStatesConsumerClient(
          previousTokenStateEntry1,
          dynamoDBClient
        );

        const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
          ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStatesConsumerClient(
          previousTokenStateEntry2,
          dynamoDBClient
        );
        await handleMessageV2(message, dynamoDBClient);

        const retrievedEntry = await readCatalogEntry(
          primaryKey,
          dynamoDBClient
        );
        expect(retrievedEntry).toEqual(previousStateEntry);

        // token-generation-states
        const retrievedTokenStateEntries =
          await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
            eserviceId_descriptorId,
            dynamoDBClient
          );

        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            previousTokenStateEntry1,
            previousTokenStateEntry2,
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
        await writeCatalogEntry(previousStateEntry, dynamoDBClient);
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });
        const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
          ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStatesConsumerClient(
          previousTokenStateEntry1,
          dynamoDBClient
        );

        const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
          ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStatesConsumerClient(
          previousTokenStateEntry2,
          dynamoDBClient
        );

        await handleMessageV2(message, dynamoDBClient);

        // token-generation-states
        const retrievedTokenStateEntries =
          await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
            eserviceId_descriptorId,
            dynamoDBClient
          );
        const expectedTokenStateEntry1: TokenGenerationStatesConsumerClient = {
          ...previousTokenStateEntry1,
          descriptorState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
        const expectedTokenStateEntry2: TokenGenerationStatesConsumerClient = {
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
        const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
          ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
          descriptorState: itemState.active,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStatesConsumerClient(
          previousTokenStateEntry1,
          dynamoDBClient
        );

        const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
          ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
          descriptorState: itemState.active,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStatesConsumerClient(
          previousTokenStateEntry2,
          dynamoDBClient
        );

        await handleMessageV2(message, dynamoDBClient);

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
        const retrievedTokenStateEntries =
          await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
            eserviceId_descriptorId,
            dynamoDBClient
          );
        const expectedTokenStateEntry1: TokenGenerationStatesConsumerClient = {
          ...previousTokenStateEntry1,
          descriptorState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
        const expectedTokenStateEntry2: TokenGenerationStatesConsumerClient = {
          ...previousTokenStateEntry2,
          descriptorState: itemState.inactive,
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
      await writeCatalogEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: suspendedDescriptor.id,
      });
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
        descriptorState: itemState.active,
        descriptorAudience: suspendedDescriptor.audience,
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry1,
        dynamoDBClient
      );

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
        descriptorState: itemState.active,
        descriptorAudience: suspendedDescriptor.audience,
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);

      expect(retrievedEntry).toEqual(previousStateEntry);

      // token-generation-states
      const retrievedTokenStateEntries =
        await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
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
      await writeCatalogEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: suspendedDescriptor.id,
      });
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
        descriptorState: itemState.active,
        descriptorAudience: suspendedDescriptor.audience,
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry1,
        dynamoDBClient
      );

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
        descriptorState: itemState.active,
        descriptorAudience: suspendedDescriptor.audience,
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      const expectedEntry: PlatformStatesCatalogEntry = {
        ...previousStateEntry,
        state: itemState.inactive,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedEntry).toEqual(expectedEntry);

      // token-generation-states
      const retrievedTokenStateEntries =
        await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
          eserviceId_descriptorId,
          dynamoDBClient
        );
      const expectedTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...previousTokenStateEntry1,
        descriptorState: itemState.inactive,
        updatedAt: new Date().toISOString(),
      };
      const expectedTokenStateEntry2: TokenGenerationStatesConsumerClient = {
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
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: suspendedDescriptor.id,
      });
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
        descriptorState: itemState.inactive,
        descriptorAudience: suspendedDescriptor.audience,
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry1,
        dynamoDBClient
      );

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
        descriptorState: itemState.inactive,
        descriptorAudience: suspendedDescriptor.audience,
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );

      expect(
        handleMessageV2(message, dynamoDBClient)
      ).resolves.not.toThrowError();

      // platform-states
      const retrievedCatalogEntry = await readCatalogEntry(
        catalogEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedCatalogEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenStateEntries =
        await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
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
      await writeCatalogEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      await handleMessageV2(message, dynamoDBClient);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);

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
      await writeCatalogEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      await handleMessageV2(message, dynamoDBClient);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      const expectedEntry: PlatformStatesCatalogEntry = {
        ...previousStateEntry,
        version: 3,
        descriptorVoucherLifespan: updatedDescriptor.voucherLifespan,
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
          descriptorVoucherLifespan: updatedDescriptor.voucherLifespan,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry2,
          descriptorVoucherLifespan: updatedDescriptor.voucherLifespan,
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
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      expect(
        handleMessageV2(message, dynamoDBClient)
      ).resolves.not.toThrowError();

      // platform-states
      const retrievedCatalogEntry = await readCatalogEntry(
        primaryKey,
        dynamoDBClient
      );
      expect(retrievedCatalogEntry).toBeUndefined();

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
  });
});
