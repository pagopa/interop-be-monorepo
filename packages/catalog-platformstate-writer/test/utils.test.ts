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
  ConditionalCheckFailedException,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  getMockTokenStatesClientPurposeEntry,
  buildDynamoDBTables,
  deleteDynamoDBTables,
} from "pagopa-interop-commons-test";
import {
  deleteCatalogEntry,
  descriptorStateToItemState,
  readCatalogEntry,
  readTokenStateEntriesByEserviceIdAndDescriptorId,
  updateDescriptorStateInPlatformStatesEntry,
  updateDescriptorStateInTokenGenerationStatesTable,
  writeCatalogEntry,
} from "../src/utils.js";
import {
  config,
  readAllTokenStateItems,
  writeTokenStateEntry,
} from "./utils.js";

describe("utils tests", async () => {
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
        descriptorAudience: "pagopa.it",
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
        descriptorAudience: "pagopa.it",
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
        descriptorAudience: "pagopa.it",
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
        descriptorAudience: "pagopa.it",
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
        descriptorAudience: "pagopa.it",
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
      const retrievedTokenStateEntries =
        await readTokenStateEntriesByEserviceIdAndDescriptorId(
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
      const result = await readTokenStateEntriesByEserviceIdAndDescriptorId(
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
      const tokenStateEntry1: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
        descriptorState: itemState.inactive,
        descriptorAudience: "pagopa.it",
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStateEntry(tokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
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

    it("should return entries if they exist (with pagination)", async () => {
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });

      const tokenEntriesLength = 2000;

      const writtenEntries: TokenGenerationStatesClientPurposeEntry[] = [];
      // eslint-disable-next-line functional/no-let
      for (let i = 0; i < tokenEntriesLength; i++) {
        const tokenStateEntryPK = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const tokenStateEntry: TokenGenerationStatesClientPurposeEntry = {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK),
          descriptorState: itemState.inactive,
          descriptorAudience: "pagopa.it",
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStateEntry(tokenStateEntry, dynamoDBClient);
        // eslint-disable-next-line functional/immutable-data
        writtenEntries.push(tokenStateEntry);
      }
      vi.spyOn(dynamoDBClient, "send");
      const tokenEntries =
        await readTokenStateEntriesByEserviceIdAndDescriptorId(
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
      const tokenStateEntries = await readAllTokenStateItems(dynamoDBClient);
      expect(tokenStateEntries).toEqual([]);
      expect(
        updateDescriptorStateInTokenGenerationStatesTable(
          eserviceId_descriptorId,
          itemState.inactive,
          dynamoDBClient
        )
      ).resolves.not.toThrowError();
      const tokenStateEntriesAfterUpdate = await readAllTokenStateItems(
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
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          descriptorState: itemState.inactive,
          descriptorAudience: "pagopa.it",
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
          descriptorAudience: "pagopa.it",
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);
      await updateDescriptorStateInTokenGenerationStatesTable(
        eserviceId_descriptorId,
        itemState.active,
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
