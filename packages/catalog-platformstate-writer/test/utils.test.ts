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
  getMockTokenGenStatesConsumerClient,
  buildDynamoDBTables,
  deleteDynamoDBTables,
  readTokenGenStatesEntriesByGSIPKEServiceIdDescriptorId,
  readAllTokenGenStatesItems,
  writeTokenGenStatesConsumerClient,
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
      const tokenGenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK(
        {
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        }
      );
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const tokenGenStatesEntry: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK),
        descriptorState: itemState.inactive,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesEntry,
        dynamoDBClient
      );
      expect(
        writeTokenGenStatesConsumerClient(tokenGenStatesEntry, dynamoDBClient)
      ).rejects.toThrowError(ConditionalCheckFailedException);
    });

    it("should write if previous entry doesn't exist", async () => {
      const tokenGenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK(
        {
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        }
      );
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const previousTokenStateEntries =
        await readTokenGenStatesEntriesByGSIPKEServiceIdDescriptorId(
          eserviceId_descriptorId,
          dynamoDBClient
        );
      expect(previousTokenStateEntries).toEqual([]);
      const tokenGenStatesEntry: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK),
        descriptorState: itemState.inactive,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesEntry,
        dynamoDBClient
      );
      const retrievedTokenGenStatesEntries =
        await readTokenGenStatesEntriesByGSIPKEServiceIdDescriptorId(
          eserviceId_descriptorId,
          dynamoDBClient
        );

      expect(retrievedTokenGenStatesEntries).toEqual([tokenGenStatesEntry]);
    });
  });

  describe("readTokenStateEntriesByEserviceIdAndDescriptorId", async () => {
    it("should return empty array if entries do not exist", async () => {
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const result =
        await readTokenGenStatesEntriesByGSIPKEServiceIdDescriptorId(
          eserviceId_descriptorId,
          dynamoDBClient
        );
      expect(result).toEqual([]);
    });

    it("should return entries if they exist (no need for pagination)", async () => {
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const tokenGenStatesEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
        descriptorState: itemState.inactive,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesEntry1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
        descriptorState: itemState.inactive,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesEntry2,
        dynamoDBClient
      );

      const tokenEntries =
        await readTokenGenStatesEntriesByGSIPKEServiceIdDescriptorId(
          eserviceId_descriptorId,
          dynamoDBClient
        );

      expect(tokenEntries).toEqual(
        expect.arrayContaining([tokenGenStatesEntry1, tokenGenStatesEntry2])
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
        const tokenGenStatesEntryPK =
          makeTokenGenerationStatesClientKidPurposePK({
            clientId: generateId(),
            kid: `kid ${Math.random()}`,
            purposeId: generateId(),
          });
        const tokenGenStatesEntry: TokenGenerationStatesConsumerClient = {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK),
          descriptorState: itemState.inactive,
          descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          publicKey: crypto.randomBytes(100000).toString("hex"),
        };
        await writeTokenGenStatesConsumerClient(
          tokenGenStatesEntry,
          dynamoDBClient
        );
        // eslint-disable-next-line functional/immutable-data
        writtenEntries.push(tokenGenStatesEntry);
      }
      vi.spyOn(dynamoDBClient, "send");
      const tokenEntries =
        await readTokenGenStatesEntriesByGSIPKEServiceIdDescriptorId(
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
      const tokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      expect(tokenGenStatesEntries).toEqual([]);
      expect(
        updateDescriptorStateInTokenGenerationStatesTable(
          eserviceId_descriptorId,
          itemState.inactive,
          dynamoDBClient
        )
      ).resolves.not.toThrowError();
      const tokenGenStatesEntriesAfterUpdate = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      expect(tokenGenStatesEntriesAfterUpdate).toEqual([]);
    });

    it("should update state if previous entries exist", async () => {
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          descriptorState: itemState.inactive,
          descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
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
          descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );
      await updateDescriptorStateInTokenGenerationStatesTable(
        eserviceId_descriptorId,
        itemState.active,
        dynamoDBClient
      );
      const retrievedTokenGenStatesEntries =
        await readTokenGenStatesEntriesByGSIPKEServiceIdDescriptorId(
          eserviceId_descriptorId,
          dynamoDBClient
        );
      const expectedTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...tokenGenStatesConsumerClient1,
        descriptorState: itemState.active,
        updatedAt: new Date().toISOString(),
      };
      const expectedTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...tokenGenStatesConsumerClient2,
        descriptorState: itemState.active,
        updatedAt: new Date().toISOString(),
      };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenStateEntry2,
          expectedTokenStateEntry1,
        ])
      );
    });
  });
});
