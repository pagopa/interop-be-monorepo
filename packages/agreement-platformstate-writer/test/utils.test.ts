/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import crypto from "crypto";
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockPlatformStatesAgreementEntry,
  getMockTokenGenStatesConsumerClient,
  readAllTokenGenStatesItems,
  readTokenGenStatesEntriesByGSIPKConsumerIdEServiceId,
  writeTokenGenStatesConsumerClient,
} from "pagopa-interop-commons-test";
import {
  makePlatformStatesAgreementPK,
  generateId,
  AgreementId,
  itemState,
  PlatformStatesAgreementEntry,
  makeGSIPKConsumerIdEServiceId,
  DescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  agreementState,
  makeTokenGenerationStatesClientKidPurposePK,
  makeGSIPKEServiceIdDescriptorId,
  EServiceId,
  PlatformStatesCatalogEntry,
  TenantId,
  TokenGenerationStatesConsumerClient,
} from "pagopa-interop-models";
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
  updateAgreementStateInPlatformStatesEntry,
  readAgreementEntry,
  writeAgreementEntry,
  deleteAgreementEntry,
  agreementStateToItemState,
  updateAgreementStateOnTokenGenStates,
  updateAgreementStateAndDescriptorInfoOnTokenGenStates,
  isLatestAgreement,
} from "../src/utils.js";
import { config } from "./utils.js";

describe("utils", async () => {
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
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  describe("updateAgreementStateInPlatformStatesEntry", async () => {
    it("should throw error if previous entry doesn't exist", async () => {
      const primaryKey = makePlatformStatesAgreementPK(
        generateId<AgreementId>()
      );
      expect(
        updateAgreementStateInPlatformStatesEntry(
          dynamoDBClient,
          primaryKey,
          itemState.active,
          1
        )
      ).rejects.toThrowError(ConditionalCheckFailedException);
      const agreementEntry = await readAgreementEntry(
        primaryKey,
        dynamoDBClient
      );
      expect(agreementEntry).toBeUndefined();
    });

    it("should update state if previous entry exists", async () => {
      const primaryKey = makePlatformStatesAgreementPK(
        generateId<AgreementId>()
      );
      const previousAgreementStateEntry =
        getMockPlatformStatesAgreementEntry(primaryKey);
      expect(
        await readAgreementEntry(primaryKey, dynamoDBClient)
      ).toBeUndefined();
      await writeAgreementEntry(previousAgreementStateEntry, dynamoDBClient);
      await updateAgreementStateInPlatformStatesEntry(
        dynamoDBClient,
        primaryKey,
        itemState.active,
        2
      );

      const result = await readAgreementEntry(primaryKey, dynamoDBClient);
      const expectedAgreementEntry: PlatformStatesAgreementEntry = {
        ...previousAgreementStateEntry,
        state: itemState.active,
        version: 2,
        updatedAt: new Date().toISOString(),
      };

      expect(result).toEqual(expectedAgreementEntry);
    });
  });

  describe("writeAgreementEntry", async () => {
    it("should throw error if previous entry exists", async () => {
      const primaryKey = makePlatformStatesAgreementPK(
        generateId<AgreementId>()
      );
      const agreementStateEntry =
        getMockPlatformStatesAgreementEntry(primaryKey);
      await writeAgreementEntry(agreementStateEntry, dynamoDBClient);
      expect(
        writeAgreementEntry(agreementStateEntry, dynamoDBClient)
      ).rejects.toThrowError(ConditionalCheckFailedException);
    });

    it("should write if previous entry doesn't exist", async () => {
      const primaryKey = makePlatformStatesAgreementPK(
        generateId<AgreementId>()
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const agreementStateEntry: PlatformStatesAgreementEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        version: 1,
        updatedAt: new Date().toISOString(),
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: generateId<DescriptorId>(),
      };

      await writeAgreementEntry(agreementStateEntry, dynamoDBClient);

      const retrievedAgreementEntry = await readAgreementEntry(
        primaryKey,
        dynamoDBClient
      );

      expect(retrievedAgreementEntry).toEqual(agreementStateEntry);
    });
  });

  describe("readAgreementEntry", async () => {
    it("should return undefined if entry doesn't exist", async () => {
      const primaryKey = makePlatformStatesAgreementPK(
        generateId<AgreementId>()
      );
      const agreementEntry = await readAgreementEntry(
        primaryKey,
        dynamoDBClient
      );
      expect(agreementEntry).toBeUndefined();
    });

    it("should return entry if it exists", async () => {
      const primaryKey = makePlatformStatesAgreementPK(
        generateId<AgreementId>()
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const agreementStateEntry: PlatformStatesAgreementEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        version: 1,
        updatedAt: new Date().toISOString(),
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: generateId<DescriptorId>(),
      };
      await writeAgreementEntry(agreementStateEntry, dynamoDBClient);
      const retrievedEntry = await readAgreementEntry(
        primaryKey,
        dynamoDBClient
      );

      expect(retrievedEntry).toEqual(agreementStateEntry);
    });
  });

  describe("deleteAgreementEntry", async () => {
    it("should not throw error if previous entry doesn't exist", async () => {
      const primaryKey = makePlatformStatesAgreementPK(
        generateId<AgreementId>()
      );
      expect(
        deleteAgreementEntry(primaryKey, dynamoDBClient)
      ).resolves.not.toThrowError();
    });

    it("should delete the entry if it exists", async () => {
      const primaryKey = makePlatformStatesAgreementPK(
        generateId<AgreementId>()
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const agreementStateEntry: PlatformStatesAgreementEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        version: 1,
        updatedAt: new Date().toISOString(),
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: generateId<DescriptorId>(),
      };
      await writeAgreementEntry(agreementStateEntry, dynamoDBClient);
      await deleteAgreementEntry(primaryKey, dynamoDBClient);
      const retrievedAgreementEntry = await readAgreementEntry(
        primaryKey,
        dynamoDBClient
      );
      expect(retrievedAgreementEntry).toBeUndefined();
    });
  });

  describe("agreementStateToItemState", async () => {
    it.each([agreementState.active])(
      "should convert %s state to active",
      async (s) => {
        expect(agreementStateToItemState(s)).toBe(itemState.active);
      }
    );

    it.each([agreementState.archived, agreementState.suspended])(
      "should convert %s state to inactive",
      async (s) => {
        expect(agreementStateToItemState(s)).toBe(itemState.inactive);
      }
    );
  });

  describe("readTokenGenStatesEntriesByGSIPKConsumerIdEServiceId", async () => {
    it("should return empty array if entries do not exist", async () => {
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const result = await readTokenGenStatesEntriesByGSIPKConsumerIdEServiceId(
        GSIPK_consumerId_eserviceId,
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
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const tokenGenStatesEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
        descriptorState: itemState.inactive,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        GSIPK_consumerId_eserviceId,
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
        GSIPK_consumerId_eserviceId,
      };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesEntry2,
        dynamoDBClient
      );

      const retrievedTokenGenStatesEntries =
        await readTokenGenStatesEntriesByGSIPKConsumerIdEServiceId(
          GSIPK_consumerId_eserviceId,
          dynamoDBClient
        );

      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([tokenGenStatesEntry1, tokenGenStatesEntry2])
      );
    });

    it("should return entries if they exist (with pagination)", async () => {
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });

      const tokenEntriesLength = 10;

      const writtenEntries = [];
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
          GSIPK_consumerId_eserviceId,
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
        await readTokenGenStatesEntriesByGSIPKConsumerIdEServiceId(
          GSIPK_consumerId_eserviceId,
          dynamoDBClient
        );

      expect(dynamoDBClient.send).toHaveBeenCalledTimes(2);
      expect(tokenEntries).toHaveLength(tokenEntriesLength);
      expect(tokenEntries).toEqual(expect.arrayContaining(writtenEntries));
    });
  });

  describe("updateAgreementStateOnTokenGenStates", async () => {
    it("should do nothing if previous entry doesn't exist", async () => {
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const tokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      expect(tokenGenStatesEntries).toEqual([]);
      expect(
        updateAgreementStateOnTokenGenStates({
          GSIPK_consumerId_eserviceId,
          agreementState: agreementState.archived,
          dynamoDBClient,
        })
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
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementState: itemState.inactive,
          descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
          GSIPK_consumerId_eserviceId,
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
          agreementState: itemState.inactive,
          descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );
      await updateAgreementStateOnTokenGenStates({
        GSIPK_consumerId_eserviceId,
        agreementState: agreementState.active,
        dynamoDBClient,
      });
      const retrievedTokenGenStatesEntries =
        await readTokenGenStatesEntriesByGSIPKConsumerIdEServiceId(
          GSIPK_consumerId_eserviceId,
          dynamoDBClient
        );
      const expectedTokenGenStatesEntry1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesEntry2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesEntry1,
          expectedTokenGenStatesEntry2,
        ])
      );
    });
  });

  describe("updateAgreementStateAndDescriptorInfoOnTokenGenStates", async () => {
    it("should do nothing if previous entry doesn't exist", async () => {
      const agreementId = generateId<AgreementId>();
      const eserviceId = generateId<EServiceId>();
      const descriptorId = generateId<DescriptorId>();
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId,
      });

      const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId,
        descriptorId: generateId<DescriptorId>(),
      });

      const pkCatalogEntry = makePlatformStatesEServiceDescriptorPK({
        eserviceId,
        descriptorId,
      });

      const catalogEntry: PlatformStatesCatalogEntry = {
        PK: pkCatalogEntry,
        state: itemState.active,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        descriptorVoucherLifespan: 60,
        version: 3,
        updatedAt: new Date().toISOString(),
      };

      const tokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      expect(tokenGenStatesEntries).toEqual([]);
      expect(
        updateAgreementStateAndDescriptorInfoOnTokenGenStates({
          GSIPK_consumerId_eserviceId,
          agreementId,
          agreementState: agreementState.archived,
          dynamoDBClient,
          GSIPK_eserviceId_descriptorId,
          catalogEntry,
        })
      ).resolves.not.toThrowError();
      const tokenGenStatesEntriesAfterUpdate = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      expect(tokenGenStatesEntriesAfterUpdate).toEqual([]);
    });

    it("should update state if previous entries exist", async () => {
      const agreementId = generateId<AgreementId>();
      const eserviceId = generateId<EServiceId>();
      const descriptorId = generateId<DescriptorId>();
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId,
      });

      const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId,
        descriptorId: generateId<DescriptorId>(),
      });

      const pkCatalogEntry = makePlatformStatesEServiceDescriptorPK({
        eserviceId,
        descriptorId,
      });

      const catalogEntry: PlatformStatesCatalogEntry = {
        PK: pkCatalogEntry,
        state: itemState.active,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        descriptorVoucherLifespan: 60,
        version: 3,
        updatedAt: new Date().toISOString(),
      };
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
          descriptorState: undefined,
          descriptorAudience: [],
          descriptorVoucherLifespan: undefined,
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
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
          descriptorState: undefined,
          descriptorAudience: [],
          descriptorVoucherLifespan: undefined,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );
      await updateAgreementStateAndDescriptorInfoOnTokenGenStates({
        GSIPK_consumerId_eserviceId,
        agreementId,
        agreementState: agreementState.active,
        dynamoDBClient,
        GSIPK_eserviceId_descriptorId,
        catalogEntry,
      });
      const retrievedTokenGenStatesEntries =
        await readTokenGenStatesEntriesByGSIPKConsumerIdEServiceId(
          GSIPK_consumerId_eserviceId,
          dynamoDBClient
        );
      const expectedTokenGenStatesEntry1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          GSIPK_eserviceId_descriptorId,
          agreementId,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
          descriptorState: catalogEntry.state,
          descriptorAudience: catalogEntry.descriptorAudience,
          descriptorVoucherLifespan: catalogEntry.descriptorVoucherLifespan,
        };
      const expectedTokenGenStatesEntry2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          GSIPK_eserviceId_descriptorId,
          agreementId,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
          descriptorState: catalogEntry.state,
          descriptorAudience: catalogEntry.descriptorAudience,
          descriptorVoucherLifespan: catalogEntry.descriptorVoucherLifespan,
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesEntry2,
          expectedTokenGenStatesEntry1,
        ])
      );
    });
  });

  describe("isLatestAgreement", () => {
    it("should return true if the agreement is the latest", async () => {
      const eserviceId = generateId<EServiceId>();
      const consumerId = generateId<TenantId>();
      const agreementId1 = generateId<AgreementId>();
      const agreementId2 = generateId<AgreementId>();
      const now = new Date();
      const threeHoursAgo = new Date();
      threeHoursAgo.setHours(threeHoursAgo.getHours() - 3);

      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const agreementPK1 = makePlatformStatesAgreementPK(agreementId1);
      const agreementPK2 = makePlatformStatesAgreementPK(agreementId2);

      const agreementEntry1: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          agreementPK1,
          GSIPK_consumerId_eserviceId
        ),
        GSISK_agreementTimestamp: now.toISOString(),
        state: itemState.active,
      };

      const agreementEntry2: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          agreementPK2,
          GSIPK_consumerId_eserviceId
        ),
        GSISK_agreementTimestamp: threeHoursAgo.toISOString(),
        state: itemState.inactive,
      };

      await writeAgreementEntry(agreementEntry1, dynamoDBClient);
      await writeAgreementEntry(agreementEntry2, dynamoDBClient);

      expect(
        await isLatestAgreement(
          GSIPK_consumerId_eserviceId,
          agreementId1,
          dynamoDBClient
        )
      ).toEqual(true);

      expect(
        await isLatestAgreement(
          GSIPK_consumerId_eserviceId,
          agreementId2,
          dynamoDBClient
        )
      ).toEqual(false);
    });

    it("should return true if there are no other agreements", async () => {
      const eserviceId = generateId<EServiceId>();
      const consumerId = generateId<TenantId>();
      const agreementId1 = generateId<AgreementId>();

      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      expect(
        await isLatestAgreement(
          GSIPK_consumerId_eserviceId,
          agreementId1,
          dynamoDBClient
        )
      ).toEqual(true);
    });
  });
});
