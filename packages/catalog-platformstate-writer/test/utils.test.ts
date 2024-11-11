/* eslint-disable @typescript-eslint/no-floating-promises */
import crypto from "crypto";
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
  PlatformStatesCatalogEntry,
  TokenGenerationStatesConsumerClient,
  descriptorState,
  generateId,
  itemState,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  makeTokenGenerationStatesClientKidPurposePK,
} from "pagopa-interop-models";
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  getMockTokenStatesConsumerClient,
  buildDynamoDBTables,
  deleteDynamoDBTables,
  readTokenStatesEntriesByGSIPKEServiceIdDescriptorId,
  readAllTokenStatesItems,
  writeTokenStatesConsumerClient,
} from "pagopa-interop-commons-test";
import {
  deleteCatalogEntry,
  descriptorStateToItemState,
  readCatalogEntry,
  updateDescriptorStateInPlatformStatesEntry,
  updateDescriptorStateInTokenGenerationStatesTable,
  writeCatalogEntry,
} from "../src/utils.js";
import { config } from "./utils.js";

describe("utils tests", async () => {
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
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const previousCatalogStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        descriptorVoucherLifespan: 60,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      expect(
        await readCatalogEntry(primaryKey, dynamoDBClient)
      ).toBeUndefined();
      await writeCatalogEntry(previousCatalogStateEntry, dynamoDBClient);
      await updateDescriptorStateInPlatformStatesEntry(
        dynamoDBClient,
        primaryKey,
        itemState.active,
        2
      );

      const result = await readCatalogEntry(primaryKey, dynamoDBClient);
      const expectedCatalogEntry: PlatformStatesCatalogEntry = {
        ...previousCatalogStateEntry,
        state: itemState.active,
        version: 2,
        updatedAt: new Date().toISOString(),
      };

      expect(result).toEqual(expectedCatalogEntry);
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
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        descriptorVoucherLifespan: 100,
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
        descriptorVoucherLifespan: 100,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      expect(
        await readCatalogEntry(primaryKey, dynamoDBClient)
      ).toBeUndefined();
      await writeCatalogEntry(catalogStateEntry, dynamoDBClient);
      const retrievedCatalogEntry = await readCatalogEntry(
        primaryKey,
        dynamoDBClient
      );

      expect(retrievedCatalogEntry).toEqual(catalogStateEntry);
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
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        descriptorVoucherLifespan: 100,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(previousCatalogStateEntry, dynamoDBClient);
      const retrievedCatalogEntry = await readCatalogEntry(
        primaryKey,
        dynamoDBClient
      );

      expect(retrievedCatalogEntry).toEqual(previousCatalogStateEntry);
    });
  });

  describe("deleteCatalogEntry", async () => {
    it("should not throw error if previous entry doesn't exist", async () => {
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      expect(
        deleteCatalogEntry(primaryKey, dynamoDBClient)
      ).resolves.not.toThrowError();
    });

    it("should delete the entry if it exists", async () => {
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const previousCatalogStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        descriptorVoucherLifespan: 100,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(previousCatalogStateEntry, dynamoDBClient);
      await deleteCatalogEntry(primaryKey, dynamoDBClient);
      const retrievedCatalogEntry = await readCatalogEntry(
        primaryKey,
        dynamoDBClient
      );
      expect(retrievedCatalogEntry).toBeUndefined();
    });
  });

  describe("descriptorStateToClientState", async () => {
    it.each([descriptorState.published, descriptorState.deprecated])(
      "should convert %s state to active",
      async (s) => {
        expect(descriptorStateToItemState(s)).toBe(itemState.active);
      }
    );

    it.each([
      descriptorState.archived,
      descriptorState.draft,
      descriptorState.suspended,
    ])("should convert %s state to inactive", async (s) => {
      expect(descriptorStateToItemState(s)).toBe(itemState.inactive);
    });
  });

  // token-generation-states
  describe("writeTokenStateEntry", async () => {
    it("should throw error if previous entry exists", async () => {
      const tokenStateEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const tokenStateEntry: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK),
        descriptorState: itemState.inactive,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(tokenStateEntry, dynamoDBClient);
      expect(
        writeTokenStatesConsumerClient(tokenStateEntry, dynamoDBClient)
      ).rejects.toThrowError(ConditionalCheckFailedException);
    });

    it("should write if previous entry doesn't exist", async () => {
      const tokenStateEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const previousTokenStateEntries =
        await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
          eserviceId_descriptorId,
          dynamoDBClient
        );
      expect(previousTokenStateEntries).toEqual([]);
      const tokenStateEntry: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK),
        descriptorState: itemState.inactive,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(tokenStateEntry, dynamoDBClient);
      const retrievedTokenStateEntries =
        await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
          eserviceId_descriptorId,
          dynamoDBClient
        );

      expect(retrievedTokenStateEntries).toEqual([tokenStateEntry]);
    });
  });

  describe("readTokenStateEntriesByEserviceIdAndDescriptorId", async () => {
    it("should return empty array if entries do not exist", async () => {
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const result = await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
        eserviceId_descriptorId,
        dynamoDBClient
      );
      expect(result).toEqual([]);
    });

    it("should return entries if they exist (no need for pagination)", async () => {
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const tokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
        descriptorState: itemState.inactive,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(tokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const tokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
        descriptorState: itemState.inactive,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(tokenStateEntry2, dynamoDBClient);

      const tokenEntries =
        await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
          eserviceId_descriptorId,
          dynamoDBClient
        );

      expect(tokenEntries).toEqual(
        expect.arrayContaining([tokenStateEntry1, tokenStateEntry2])
      );
    });

    it("should return entries if they exist (with pagination)", async () => {
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });

      const tokenEntriesLength = 10;

      const writtenEntries: TokenGenerationStatesConsumerClient[] = [];
      // eslint-disable-next-line functional/no-let
      for (let i = 0; i < tokenEntriesLength; i++) {
        const tokenStateEntryPK = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const tokenStateEntry: TokenGenerationStatesConsumerClient = {
          ...getMockTokenStatesConsumerClient(tokenStateEntryPK),
          descriptorState: itemState.inactive,
          descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          publicKey: crypto.randomBytes(100000).toString("hex"),
        };
        await writeTokenStatesConsumerClient(tokenStateEntry, dynamoDBClient);
        // eslint-disable-next-line functional/immutable-data
        writtenEntries.push(tokenStateEntry);
      }
      vi.spyOn(dynamoDBClient, "send");
      const tokenEntries =
        await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
          eserviceId_descriptorId,
          dynamoDBClient
        );

      expect(dynamoDBClient.send).toHaveBeenCalledTimes(2);
      expect(tokenEntries).toHaveLength(tokenEntriesLength);
      expect(tokenEntries).toEqual(expect.arrayContaining(writtenEntries));
    });
  });

  describe("updateDescriptorStateInTokenGenerationStatesTable", async () => {
    it("should do nothing if previous entry doesn't exist", async () => {
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const tokenStateEntries = await readAllTokenStatesItems(dynamoDBClient);
      expect(tokenStateEntries).toEqual([]);
      expect(
        updateDescriptorStateInTokenGenerationStatesTable(
          eserviceId_descriptorId,
          itemState.inactive,
          dynamoDBClient
        )
      ).resolves.not.toThrowError();
      const tokenStateEntriesAfterUpdate = await readAllTokenStatesItems(
        dynamoDBClient
      );
      expect(tokenStateEntriesAfterUpdate).toEqual([]);
    });

    it("should update state if previous entries exist", async () => {
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
        descriptorState: itemState.inactive,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
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
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );
      await updateDescriptorStateInTokenGenerationStatesTable(
        eserviceId_descriptorId,
        itemState.active,
        dynamoDBClient
      );
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
