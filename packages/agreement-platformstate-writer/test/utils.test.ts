/* eslint-disable @typescript-eslint/no-floating-promises */
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockPlatformStatesAgreementEntry,
  getMockTokenGenStatesConsumerClient,
  readAllPlatformStatesItems,
  readAllTokenGenStatesItems,
  writePlatformAgreementEntry,
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
import { genericLogger } from "pagopa-interop-commons";
import {
  updateAgreementStateInPlatformStatesEntry,
  readAgreementEntry,
  agreementStateToItemState,
  updateAgreementStateOnTokenGenStates,
  updateAgreementStateAndDescriptorInfoOnTokenGenStates,
  isLatestAgreement,
  upsertPlatformStatesAgreementEntry,
  updateAgreementStateInPlatformStatesV1,
  updateAgreementStateInTokenGenStatesV1,
} from "../src/utils.js";
import { dynamoDBClient } from "./utils.js";

describe("utils", async () => {
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
      const primaryKey = makePlatformStatesAgreementPK({
        consumerId: generateId<TenantId>(),
        eserviceId: generateId<EServiceId>(),
      });
      expect(
        updateAgreementStateInPlatformStatesEntry(
          dynamoDBClient,
          primaryKey,
          itemState.active,
          1,
          genericLogger
        )
      ).rejects.toThrowError(ConditionalCheckFailedException);
      const agreementEntry = await readAgreementEntry(
        primaryKey,
        dynamoDBClient
      );
      expect(agreementEntry).toBeUndefined();
    });

    it("should update state if previous entry exists", async () => {
      const primaryKey = makePlatformStatesAgreementPK({
        consumerId: generateId<TenantId>(),
        eserviceId: generateId<EServiceId>(),
      });
      const previousAgreementStateEntry = getMockPlatformStatesAgreementEntry(
        primaryKey,
        generateId<AgreementId>()
      );
      expect(
        await readAgreementEntry(primaryKey, dynamoDBClient)
      ).toBeUndefined();
      await writePlatformAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient
      );
      await updateAgreementStateInPlatformStatesEntry(
        dynamoDBClient,
        primaryKey,
        itemState.active,
        2,
        genericLogger
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

  describe("upsertPlatformStatesAgreementEntry", async () => {
    it("should insert the entry if it doesn't exist", async () => {
      const primaryKey = makePlatformStatesAgreementPK({
        consumerId: generateId<TenantId>(),
        eserviceId: generateId<EServiceId>(),
      });
      const agreementStateEntry = getMockPlatformStatesAgreementEntry(
        primaryKey,
        generateId<AgreementId>()
      );
      expect(
        await readAgreementEntry(primaryKey, dynamoDBClient)
      ).toBeUndefined();

      await upsertPlatformStatesAgreementEntry(
        agreementStateEntry,
        dynamoDBClient,
        genericLogger
      );
      expect(
        writePlatformAgreementEntry(agreementStateEntry, dynamoDBClient)
      ).rejects.toThrowError(ConditionalCheckFailedException);
    });

    it("should update the entry if it exists", async () => {
      const primaryKey = makePlatformStatesAgreementPK({
        consumerId: generateId<TenantId>(),
        eserviceId: generateId<EServiceId>(),
      });
      const previousPlatformStatesAgreement: PlatformStatesAgreementEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        version: 1,
        updatedAt: new Date().toISOString(),
        agreementId: generateId<AgreementId>(),
        agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: generateId<DescriptorId>(),
        producerId: generateId(),
      };
      await writePlatformAgreementEntry(
        previousPlatformStatesAgreement,
        dynamoDBClient
      );

      const updatedPlatformStatesAgreement: PlatformStatesAgreementEntry = {
        PK: primaryKey,
        state: itemState.active,
        version: 2,
        updatedAt: new Date().toISOString(),
        agreementId: generateId<AgreementId>(),
        agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: generateId<DescriptorId>(),
        producerId: generateId(),
      };
      await upsertPlatformStatesAgreementEntry(
        updatedPlatformStatesAgreement,
        dynamoDBClient,
        genericLogger
      );

      const retrievedAgreementEntry = await readAgreementEntry(
        primaryKey,
        dynamoDBClient
      );
      expect(retrievedAgreementEntry).toEqual(updatedPlatformStatesAgreement);
    });
  });

  describe("readAgreementEntry", async () => {
    it("should return undefined if the entry doesn't exist", async () => {
      const primaryKey = makePlatformStatesAgreementPK({
        consumerId: generateId<TenantId>(),
        eserviceId: generateId<EServiceId>(),
      });
      const agreementEntry = await readAgreementEntry(
        primaryKey,
        dynamoDBClient
      );
      expect(agreementEntry).toBeUndefined();
    });

    it("should return entry if it exists", async () => {
      const primaryKey = makePlatformStatesAgreementPK({
        consumerId: generateId<TenantId>(),
        eserviceId: generateId<EServiceId>(),
      });
      const agreementStateEntry: PlatformStatesAgreementEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        version: 1,
        updatedAt: new Date().toISOString(),
        agreementId: generateId<AgreementId>(),
        agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: generateId<DescriptorId>(),
        producerId: generateId(),
      };
      await writePlatformAgreementEntry(agreementStateEntry, dynamoDBClient);
      const retrievedEntry = await readAgreementEntry(
        primaryKey,
        dynamoDBClient
      );

      expect(retrievedEntry).toEqual(agreementStateEntry);
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
          logger: genericLogger,
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
        logger: genericLogger,
      });
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });
  });

  describe("updateAgreementStateAndDescriptorInfoOnTokenGenStates", async () => {
    it("should do nothing if previous entry doesn't exist", async () => {
      const eserviceId = generateId<EServiceId>();
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId,
      });

      const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId,
        descriptorId: generateId(),
      });

      const pkCatalogEntry = makePlatformStatesEServiceDescriptorPK({
        eserviceId,
        descriptorId: generateId(),
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
          agreementId: generateId(),
          agreementState: agreementState.archived,
          producerId: generateId(),
          dynamoDBClient,
          GSIPK_eserviceId_descriptorId,
          catalogEntry,
          logger: genericLogger,
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
      const producerId = generateId<TenantId>();
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId,
      });

      const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId,
        descriptorId: generateId(),
      });

      const pkCatalogEntry = makePlatformStatesEServiceDescriptorPK({
        eserviceId,
        descriptorId: generateId(),
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
        producerId,
        dynamoDBClient,
        GSIPK_eserviceId_descriptorId,
        catalogEntry,
        logger: genericLogger,
      });
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          GSIPK_eserviceId_descriptorId,
          agreementId,
          agreementState: itemState.active,
          producerId,
          updatedAt: new Date().toISOString(),
          descriptorState: catalogEntry.state,
          descriptorAudience: catalogEntry.descriptorAudience,
          descriptorVoucherLifespan: catalogEntry.descriptorVoucherLifespan,
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          GSIPK_eserviceId_descriptorId,
          agreementId,
          agreementState: itemState.active,
          producerId,
          updatedAt: new Date().toISOString(),
          descriptorState: catalogEntry.state,
          descriptorAudience: catalogEntry.descriptorAudience,
          descriptorVoucherLifespan: catalogEntry.descriptorVoucherLifespan,
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient2,
          expectedTokenGenStatesConsumeClient1,
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

      const platformStatesAgreementPK = makePlatformStatesAgreementPK({
        consumerId,
        eserviceId,
      });

      const platformStatesAgreement1: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementPK,
          agreementId1
        ),
        agreementTimestamp: now.toISOString(),
      };

      const platformStatesAgreement2: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementPK,
          agreementId2
        ),
        agreementTimestamp: threeHoursAgo.toISOString(),
      };

      expect(
        isLatestAgreement(
          platformStatesAgreement2,
          platformStatesAgreement1.agreementTimestamp
        )
      ).toEqual(true);

      expect(
        isLatestAgreement(
          platformStatesAgreement1,
          platformStatesAgreement2.agreementTimestamp
        )
      ).toEqual(false);
    });

    it("should return true if there are no other agreements", async () => {
      const agreementTimestamp = new Date().toISOString();
      expect(isLatestAgreement(undefined, agreementTimestamp)).toEqual(true);
    });
  });

  describe("updateAgreementStateInPlatformStatesV1", async () => {
    it("should update agreement state in platform-states by agreement id", async () => {
      const platformStatesAgreementPK1 = makePlatformStatesAgreementPK({
        consumerId: generateId<TenantId>(),
        eserviceId: generateId<EServiceId>(),
      });
      const platformStatesAgreement1: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementPK1,
          generateId<AgreementId>()
        ),
        PK: platformStatesAgreementPK1,
        state: itemState.active,
      };
      await writePlatformAgreementEntry(
        platformStatesAgreement1,
        dynamoDBClient
      );

      const platformStatesAgreementPK2 = makePlatformStatesAgreementPK({
        consumerId: generateId<TenantId>(),
        eserviceId: generateId<EServiceId>(),
      });
      const platformStatesAgreement2 = getMockPlatformStatesAgreementEntry(
        platformStatesAgreementPK2,
        generateId<AgreementId>()
      );
      await writePlatformAgreementEntry(
        platformStatesAgreement2,
        dynamoDBClient
      );

      await updateAgreementStateInPlatformStatesV1(
        platformStatesAgreement1.agreementId,
        itemState.inactive,
        2,
        dynamoDBClient,
        genericLogger
      );

      const retrievedPlatformStatesEntries = await readAllPlatformStatesItems(
        dynamoDBClient
      );
      const expectedPlatformStatesAgreement: PlatformStatesAgreementEntry = {
        ...platformStatesAgreement1,
        state: itemState.inactive,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntries).toEqual(
        expect.arrayContaining([
          expectedPlatformStatesAgreement,
          platformStatesAgreement2,
        ])
      );
    });
  });

  describe("updateAgreementStateInTokenGenStatesV1", async () => {
    it("should update agreement state in token-generation-states by agreement id", async () => {
      const agreementId = generateId<AgreementId>();

      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementId,
          agreementState: itemState.active,
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
      const tokenGenStatesConsumerClient2 = getMockTokenGenStatesConsumerClient(
        tokenGenStatesEntryPK2
      );
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await updateAgreementStateInTokenGenStatesV1(
        agreementId,
        itemState.inactive,
        dynamoDBClient,
        genericLogger
      );

      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          agreementState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });
  });
});
