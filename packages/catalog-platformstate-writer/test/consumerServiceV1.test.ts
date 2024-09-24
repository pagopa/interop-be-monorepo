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
  EServiceDescriptorUpdatedV1,
  EServiceEventEnvelope,
  PlatformStatesCatalogEntry,
  TokenGenerationStatesClientPurposeEntry,
  descriptorState,
  generateId,
  itemState,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  makeTokenGenerationStatesClientKidPurposePK,
} from "pagopa-interop-models";
import {
  toDescriptorV1,
  getMockDescriptor,
  getMockEService,
  getMockDocument,
  getMockTokenStatesClientPurposeEntry,
  buildDynamoDBTables,
  deleteDynamoDBTables,
} from "pagopa-interop-commons-test";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import {
  readCatalogEntry,
  readTokenStateEntriesByEserviceIdAndDescriptorId,
  writeCatalogEntry,
} from "../src/utils.js";
import { config, sleep, writeTokenStateEntry } from "./utils.js";

describe("V1 events", async () => {
  if (!config) {
    fail();
  }
  const dynamoDBClient = new DynamoDBClient({
    credentials: { accessKeyId: "key", secretAccessKey: "secret" },
    region: "eu-central-1",
    endpoint: `http://${config.tokenGenerationReadModelDbHost}:${config.tokenGenerationReadModelDbPort}`,
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

  describe("Events V1", async () => {
    it("EServiceDescriptorUpdated (draft -> published)", async () => {
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it"],
        interface: getMockDocument(),
        publishedAt: new Date(),
        state: descriptorState.published,
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [publishedDescriptor],
      };

      const payload: EServiceDescriptorUpdatedV1 = {
        eserviceId: eservice.id,
        eserviceDescriptor: toDescriptorV1(publishedDescriptor),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: eservice.id,
        version: 2,
        type: "EServiceDescriptorUpdated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, dynamoDBClient);
      await sleep(1000, mockDate);

      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: publishedDescriptor.id,
      });
      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      const expectedEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.active,
        descriptorAudience: publishedDescriptor.audience[0],
        descriptorVoucherLifespan: publishedDescriptor.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedEntry).toEqual(expectedEntry);
    });

    it("EServiceDescriptorUpdated (suspended -> published, version of the event is newer)", async () => {
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it"],
        interface: getMockDocument(),
        publishedAt: new Date(),
        suspendedAt: undefined,
        state: descriptorState.published,
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [publishedDescriptor],
      };

      const payload: EServiceDescriptorUpdatedV1 = {
        eserviceId: eservice.id,
        eserviceDescriptor: toDescriptorV1(publishedDescriptor),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: eservice.id,
        version: 2,
        type: "EServiceDescriptorUpdated",
        event_version: 1,
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
        descriptorVoucherLifespan: publishedDescriptor.voucherLifespan,
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

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience[0],
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      await handleMessageV1(message, dynamoDBClient);
      await sleep(1000, mockDate);

      const retrievedCatalogEntry = await readCatalogEntry(
        primaryKey,
        dynamoDBClient
      );
      const expectedCatalogEntry: PlatformStatesCatalogEntry = {
        ...previousStateEntry,
        state: itemState.active,
        version: 2,
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
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          expectedTokenStateEntry1,
          expectedTokenStateEntry2,
        ])
      );
    });

    it("EServiceDescriptorUpdated (published, no operation if version of the event is lower than existing entry)", async () => {
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it"],
        interface: getMockDocument(),
        state: descriptorState.published,
        publishedAt: new Date(),
        suspendedAt: new Date(),
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [publishedDescriptor],
      };

      const payload: EServiceDescriptorUpdatedV1 = {
        eserviceId: eservice.id,
        eserviceDescriptor: toDescriptorV1(publishedDescriptor),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: eservice.id,
        version: 1,
        type: "EServiceDescriptorUpdated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      const catalogPrimaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: publishedDescriptor.id,
      });
      const previousCatalogStateEntry: PlatformStatesCatalogEntry = {
        PK: catalogPrimaryKey,
        state: itemState.inactive,
        descriptorAudience: publishedDescriptor.audience[0],
        descriptorVoucherLifespan: publishedDescriptor.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(previousCatalogStateEntry, dynamoDBClient);

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
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience[0],
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
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience[0],
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      await handleMessageV1(message, dynamoDBClient);
      await sleep(1000, mockDate);

      const retrievedCatalogEntry = await readCatalogEntry(
        catalogPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedCatalogEntry).toEqual(previousCatalogStateEntry);

      // token-generation-states
      const retrievedTokenStateEntries =
        await readTokenStateEntriesByEserviceIdAndDescriptorId(
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

    describe("EServiceDescriptorUpdated (published -> suspended)", () => {
      it("should perform the update if msg.version >= existing version", async () => {
        const suspendedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          audience: ["pagopa.it"],
          interface: getMockDocument(),
          publishedAt: new Date(),
          suspendedAt: new Date(),
          state: descriptorState.suspended,
        };

        const eservice: EService = {
          ...getMockEService(),
          descriptors: [suspendedDescriptor],
        };

        const payload: EServiceDescriptorUpdatedV1 = {
          eserviceId: eservice.id,
          eserviceDescriptor: toDescriptorV1(suspendedDescriptor),
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 2,
          type: "EServiceDescriptorUpdated",
          event_version: 1,
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
        const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
          {
            ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
            descriptorState: itemState.active,
            descriptorAudience: suspendedDescriptor.audience[0],
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
            descriptorAudience: suspendedDescriptor.audience[0],
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);
        await handleMessageV1(message, dynamoDBClient);
        await sleep(1000, mockDate);

        const retrievedEntry = await readCatalogEntry(
          primaryKey,
          dynamoDBClient
        );
        const expectedEntry: PlatformStatesCatalogEntry = {
          ...previousStateEntry,
          state: itemState.inactive,
          version: 2,
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
        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            expectedTokenStateEntry1,
            expectedTokenStateEntry2,
          ])
        );
      });

      it("should do nothing if msg.version < existing version", async () => {
        const suspendedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          audience: ["pagopa.it"],
          interface: getMockDocument(),
          publishedAt: new Date(),
          suspendedAt: new Date(),
          state: descriptorState.suspended,
        };
        const eservice: EService = {
          ...getMockEService(),
          descriptors: [suspendedDescriptor],
        };

        const payload: EServiceDescriptorUpdatedV1 = {
          eserviceId: eservice.id,
          eserviceDescriptor: toDescriptorV1(suspendedDescriptor),
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 2,
          type: "EServiceDescriptorUpdated",
          event_version: 1,
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
          descriptorVoucherLifespan: suspendedDescriptor.voucherLifespan,
          version: 3,
          updatedAt: new Date().toISOString(),
        };
        await writeCatalogEntry(previousStateEntry, dynamoDBClient);
        await handleMessageV1(message, dynamoDBClient);
        await sleep(1000, mockDate);

        const retrievedEntry = await readCatalogEntry(
          primaryKey,
          dynamoDBClient
        );
        expect(retrievedEntry).toEqual(previousStateEntry);
      });

      it("should throw error if previous entry doesn't exist", async () => {
        const suspendedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          audience: ["pagopa.it"],
          interface: getMockDocument(),
          publishedAt: new Date(),
          suspendedAt: new Date(),
          state: descriptorState.suspended,
        };

        const eservice: EService = {
          ...getMockEService(),
          descriptors: [suspendedDescriptor],
        };

        const payload: EServiceDescriptorUpdatedV1 = {
          eserviceId: eservice.id,
          eserviceDescriptor: toDescriptorV1(suspendedDescriptor),
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 2,
          type: "EServiceDescriptorUpdated",
          event_version: 1,
          data: payload,
          log_date: new Date(),
        };
        expect(handleMessageV1(message, dynamoDBClient)).rejects.toThrowError();
      });
    });

    it("EServiceDescriptorUpdated (published -> archived)", async () => {
      const archivedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it"],
        interface: getMockDocument(),
        publishedAt: new Date(),
        archivedAt: new Date(),
        state: descriptorState.archived,
      };

      const eservice: EService = {
        ...getMockEService(),
        descriptors: [archivedDescriptor],
      };
      const payload: EServiceDescriptorUpdatedV1 = {
        eserviceId: eservice.id,
        eserviceDescriptor: toDescriptorV1(archivedDescriptor),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: eservice.id,
        version: 2,
        type: "EServiceDescriptorUpdated",
        event_version: 1,
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
        descriptorVoucherLifespan: archivedDescriptor.voucherLifespan,
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
        descriptorId: archivedDescriptor.id,
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          descriptorState: itemState.active,
          descriptorAudience: archivedDescriptor.audience[0],
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
          descriptorAudience: archivedDescriptor.audience[0],
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      await handleMessageV1(message, dynamoDBClient);
      await sleep(1000, mockDate);

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
  });
});
