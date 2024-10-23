import { fail } from "assert";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockAgreement,
  getMockClient,
  getMockDescriptor,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
  writeCatalogEntry,
  writePlatformAgreementEntry,
  writePlatformPurposeEntry,
  getMockTokenStatesClientPurposeEntry,
  writeTokenStateEntry,
  getMockKey,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  agreementState,
  Client,
  ClientId,
  Descriptor,
  descriptorState,
  EService,
  generateId,
  itemState,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makeGSIPKKid,
  makePlatformStatesAgreementPK,
  makePlatformStatesClientPK,
  makePlatformStatesEServiceDescriptorPK,
  makePlatformStatesPurposePK,
  makeTokenGenerationStatesClientKidPurposePK,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesPurposeEntry,
  Purpose,
  purposeVersionState,
  TokenGenerationStatesClientPurposeEntry,
  TokenGenerationStatesGenericEntry,
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
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { genericLogger } from "pagopa-interop-commons";
import {
  clientKindToTokenGenerationStatesClientKind,
  compareReadModelAgreementsWithPlatformStates,
  compareReadModelClientsWithPlatformStates,
  compareReadModelEServicesWithPlatformStates,
  compareReadModelPurposesWithPlatformStates,
  compareTokenGenerationReadModel,
  countAgreementDifferences,
  countCatalogDifferences,
  countClientDifferences,
  countPurposeDifferences,
} from "../src/utils/utils.js";
import {
  addOneAgreement,
  addOneClient,
  addOneEService,
  addOnePurpose,
  config,
  readModelRepository,
  writeClientEntry,
} from "./utils.js";

describe("Token Generation Read Model Checker Verifier tests", () => {
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

  describe("purpose", () => {
    it("same states", async () => {
      const purpose1 = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose1);

      const purpose2 = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose2);

      // platform-states
      // TODO: should missing platform-states entry be an error or skipped?
      const purposeEntryPrimaryKey1 = makePlatformStatesPurposePK(purpose1.id);
      const platformPurposeEntry1: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey1,
        state: itemState.active,
        purposeVersionId: purpose1.versions[0].id,
        purposeEserviceId: purpose1.eserviceId,
        purposeConsumerId: purpose1.consumerId,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(platformPurposeEntry1, dynamoDBClient);

      const purposeEntryPrimaryKey2 = makePlatformStatesPurposePK(purpose2.id);
      const platformPurposeEntry2: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey2,
        state: itemState.active,
        purposeVersionId: purpose2.versions[0].id,
        purposeEserviceId: purpose2.eserviceId,
        purposeConsumerId: purpose2.consumerId,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(platformPurposeEntry2, dynamoDBClient);

      // token-generation-states
      const clientId = generateId<ClientId>();
      const tokenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId,
        kid: `kid ${Math.random()}`,
        purposeId: purpose1.id,
      });
      const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK),
        GSIPK_purposeId: purpose1.id,
        purposeState: itemState.active,
        purposeVersionId: purpose1.versions[0].id,
        consumerId: purpose1.consumerId,
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId,
          purposeId: purpose1.id,
        }),
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const purposeDifferences =
        await compareReadModelPurposesWithPlatformStates({
          platformStatesEntries: [platformPurposeEntry1, platformPurposeEntry2],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          readModel: readModelRepository,
        });
      expect(purposeDifferences).toHaveLength(0);

      expect(
        countPurposeDifferences(purposeDifferences, genericLogger)
      ).toEqual(0);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).resolves.not.toThrowError();
    });

    it("wrong states", async () => {
      const purpose1 = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose1);

      const purpose2 = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose2);

      // platform-states
      // TODO: should missing platform-states entry be an error or skipped?
      const purposeEntryPrimaryKey1 = makePlatformStatesPurposePK(purpose1.id);
      const platformPurposeEntry1: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey1,
        state: itemState.active,
        purposeVersionId: purpose1.versions[0].id,
        purposeEserviceId: purpose1.eserviceId,
        purposeConsumerId: purpose1.consumerId,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(platformPurposeEntry1, dynamoDBClient);

      const purposeEntryPrimaryKey2 = makePlatformStatesPurposePK(purpose2.id);
      const platformPurposeEntry2: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey2,
        state: itemState.active,
        purposeVersionId: generateId(),
        purposeEserviceId: generateId(),
        purposeConsumerId: generateId(),
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(platformPurposeEntry2, dynamoDBClient);

      // token-generation-states
      const clientId = generateId<ClientId>();
      const tokenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId,
        kid: `kid ${Math.random()}`,
        purposeId: purpose1.id,
      });
      const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK),
        GSIPK_purposeId: purpose1.id,
        purposeState: itemState.inactive,
        purposeVersionId: purpose1.versions[0].id,
        consumerId: purpose1.consumerId,
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId,
          purposeId: purpose1.id,
        }),
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const purposeDifferences =
        await compareReadModelPurposesWithPlatformStates({
          platformStatesEntries: [platformPurposeEntry1, platformPurposeEntry2],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          readModel: readModelRepository,
        });
      const expectedPurposeDifferences: Array<
        [
          PlatformStatesPurposeEntry | undefined,
          TokenGenerationStatesClientPurposeEntry[],
          Purpose | undefined
        ]
      > = [
        [platformPurposeEntry1, [tokenStatesEntry], purpose1],
        [platformPurposeEntry2, [], purpose2],
      ];
      expect(purposeDifferences).toHaveLength(2);
      expect(purposeDifferences).toEqual(
        expect.arrayContaining(expectedPurposeDifferences)
      );

      expect(
        countPurposeDifferences(purposeDifferences, genericLogger)
      ).toEqual(2);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).rejects.toThrowError();
    });

    it("missing platform-states entry should pass", async () => {
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose);

      const purposeDifferences =
        await compareReadModelPurposesWithPlatformStates({
          platformStatesEntries: [],
          tokenGenerationStatesEntries: [],
          readModel: readModelRepository,
        });
      expect(purposeDifferences).toHaveLength(0);

      expect(
        countPurposeDifferences(purposeDifferences, genericLogger)
      ).toEqual(0);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).resolves.not.toThrowError();
    });

    it("read model purpose missing", async () => {
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);

      // platform-states
      const purposeEntryPrimaryKey = makePlatformStatesPurposePK(purpose.id);
      const platformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPrimaryKey,
        state: itemState.active,
        purposeVersionId: purpose.versions[0].id,
        purposeEserviceId: purpose.eserviceId,
        purposeConsumerId: purpose.consumerId,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(platformPurposeEntry, dynamoDBClient);

      // token-generation-states
      const tokenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: purpose.id,
      });
      const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK),
        GSIPK_purposeId: purpose.id,
        purposeState: itemState.active,
        purposeVersionId: purpose.versions[0].id,
        consumerId: purpose.consumerId,
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const purposeDifferences =
        await compareReadModelPurposesWithPlatformStates({
          platformStatesEntries: [platformPurposeEntry],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          readModel: readModelRepository,
        });
      const expectedPurposeDifferences: Array<
        [
          PlatformStatesPurposeEntry | undefined,
          TokenGenerationStatesClientPurposeEntry[],
          Purpose | undefined
        ]
      > = [[platformPurposeEntry, [tokenStatesEntry], undefined]];
      expect(purposeDifferences).toHaveLength(1);
      expect(purposeDifferences).toEqual(expectedPurposeDifferences);

      expect(
        countPurposeDifferences(purposeDifferences, genericLogger)
      ).toEqual(1);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).rejects.toThrowError();
    });

    it.skip("platform-states entry missing with read model purpose not archived", async () => {
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose);

      const purposeDifferences =
        await compareReadModelPurposesWithPlatformStates({
          platformStatesEntries: [],
          tokenGenerationStatesEntries: [],
          readModel: readModelRepository,
        });
      const expectedPurposeDifferences: Array<
        [
          PlatformStatesPurposeEntry | undefined,
          TokenGenerationStatesClientPurposeEntry[],
          Purpose | undefined
        ]
      > = [[undefined, [], purpose]];
      expect(purposeDifferences).toHaveLength(1);
      expect(purposeDifferences).toEqual(expectedPurposeDifferences);

      expect(
        countPurposeDifferences(purposeDifferences, genericLogger)
      ).toEqual(1);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).rejects.toThrowError();
    });

    it("platform-states entry missing with read model purpose archived", async () => {
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.archived),
      ]);
      await addOnePurpose(purpose);

      const purposeDifferences =
        await compareReadModelPurposesWithPlatformStates({
          platformStatesEntries: [],
          tokenGenerationStatesEntries: [],
          readModel: readModelRepository,
        });
      expect(purposeDifferences).toHaveLength(0);

      expect(
        countPurposeDifferences(purposeDifferences, genericLogger)
      ).toEqual(0);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).resolves.not.toThrowError();
    });
  });

  describe("agreement", () => {
    it("same states", async () => {
      const agreement1: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      await addOneAgreement(agreement1);

      const agreement2: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      await addOneAgreement(agreement2);

      // platform-states
      const agreementEntryPrimaryKey1 = makePlatformStatesAgreementPK(
        agreement1.id
      );
      const platformAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: agreementEntryPrimaryKey1,
        state: itemState.active,
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: agreement1.consumerId,
          eserviceId: agreement1.eserviceId,
        }),
        GSISK_agreementTimestamp:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          agreement1.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement1.descriptorId,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry1,
        dynamoDBClient
      );

      const agreementEntryPrimaryKey2 = makePlatformStatesAgreementPK(
        agreement2.id
      );
      const platformAgreementEntry2: PlatformStatesAgreementEntry = {
        PK: agreementEntryPrimaryKey2,
        state: itemState.active,
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: agreement2.consumerId,
          eserviceId: agreement2.eserviceId,
        }),
        GSISK_agreementTimestamp:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          agreement2.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement2.descriptorId,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry2,
        dynamoDBClient
      );

      // token-generation-states
      const tokenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement1.consumerId,
        eserviceId: agreement1.eserviceId,
      });
      const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK),
        consumerId: agreement1.consumerId,
        agreementId: agreement1.id,
        agreementState: itemState.active,
        GSIPK_consumerId_eserviceId,
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const agreementDifferences =
        await compareReadModelAgreementsWithPlatformStates({
          platformStatesEntries: [
            platformAgreementEntry1,
            platformAgreementEntry2,
          ],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          readModel: readModelRepository,
        });
      expect(agreementDifferences).toHaveLength(0);

      expect(
        countAgreementDifferences(agreementDifferences, genericLogger)
      ).toEqual(0);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).resolves.not.toThrowError();
    });

    it("wrong states", async () => {
      const agreement1: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      await addOneAgreement(agreement1);

      const agreement2: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      await addOneAgreement(agreement2);

      // platform-states
      const agreementEntryPrimaryKey1 = makePlatformStatesAgreementPK(
        agreement1.id
      );
      const platformAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: agreementEntryPrimaryKey1,
        state: itemState.active,
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: agreement1.consumerId,
          eserviceId: agreement1.eserviceId,
        }),
        GSISK_agreementTimestamp:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          agreement1.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement1.descriptorId,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry1,
        dynamoDBClient
      );

      const agreementEntryPrimaryKey2 = makePlatformStatesAgreementPK(
        agreement2.id
      );
      const platformAgreementEntry2: PlatformStatesAgreementEntry = {
        PK: agreementEntryPrimaryKey2,
        state: itemState.active,
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: generateId(),
          eserviceId: generateId(),
        }),
        GSISK_agreementTimestamp:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          agreement2.stamps.activation!.when.toISOString(),
        agreementDescriptorId: generateId(),
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformAgreementEntry(
        platformAgreementEntry2,
        dynamoDBClient
      );

      // token-generation-states
      const tokenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement1.consumerId,
        eserviceId: agreement1.eserviceId,
      });
      const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK),
        consumerId: agreement1.consumerId,
        agreementId: agreement1.id,
        agreementState: itemState.inactive,
        GSIPK_consumerId_eserviceId,
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const agreementDifferences =
        await compareReadModelAgreementsWithPlatformStates({
          platformStatesEntries: [
            platformAgreementEntry1,
            platformAgreementEntry2,
          ],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          readModel: readModelRepository,
        });
      const expectedAgreementDifferences: Array<
        [
          PlatformStatesAgreementEntry | undefined,
          TokenGenerationStatesClientPurposeEntry[],
          Agreement | undefined
        ]
      > = [
        [platformAgreementEntry1, [tokenStatesEntry], agreement1],
        [platformAgreementEntry2, [], agreement2],
      ];
      expect(agreementDifferences).toHaveLength(2);
      expect(agreementDifferences).toEqual(
        expect.arrayContaining(expectedAgreementDifferences)
      );

      expect(
        countAgreementDifferences(agreementDifferences, genericLogger)
      ).toEqual(2);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).rejects.toThrowError();
    });

    it("missing platform-states entry should pass", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      await addOneAgreement(agreement);

      const agreementDifferences =
        await compareReadModelAgreementsWithPlatformStates({
          platformStatesEntries: [],
          tokenGenerationStatesEntries: [],
          readModel: readModelRepository,
        });
      expect(agreementDifferences).toHaveLength(0);

      expect(
        countAgreementDifferences(agreementDifferences, genericLogger)
      ).toEqual(0);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).resolves.not.toThrowError();
    });

    it("read model agreement missing", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };

      // platform-states
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        agreement.id
      );
      const platformAgreementEntry: PlatformStatesAgreementEntry = {
        PK: agreementEntryPrimaryKey,
        state: itemState.active,
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: agreement.consumerId,
          eserviceId: agreement.eserviceId,
        }),
        GSISK_agreementTimestamp:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          agreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement.descriptorId,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformAgreementEntry(platformAgreementEntry, dynamoDBClient);

      const agreementDifferences =
        await compareReadModelAgreementsWithPlatformStates({
          platformStatesEntries: [platformAgreementEntry],
          tokenGenerationStatesEntries: [],
          readModel: readModelRepository,
        });
      const expectedAgreementDifferences: Array<
        [
          PlatformStatesAgreementEntry | undefined,
          TokenGenerationStatesClientPurposeEntry[],
          Agreement | undefined
        ]
      > = [[platformAgreementEntry, [], undefined]];
      expect(agreementDifferences).toHaveLength(1);
      expect(agreementDifferences).toEqual(expectedAgreementDifferences);

      expect(
        countAgreementDifferences(agreementDifferences, genericLogger)
      ).toEqual(1);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).rejects.toThrowError();
    });

    it.skip("platform-states entry missing with read model agreement not archived", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      await addOneAgreement(agreement);

      const agreementDifferences =
        await compareReadModelAgreementsWithPlatformStates({
          platformStatesEntries: [],
          tokenGenerationStatesEntries: [],
          readModel: readModelRepository,
        });
      const expectedAgreementDifferences: Array<
        [
          PlatformStatesAgreementEntry | undefined,
          TokenGenerationStatesClientPurposeEntry[],
          Agreement | undefined
        ]
      > = [[undefined, [], agreement]];
      expect(agreementDifferences).toHaveLength(1);
      expect(agreementDifferences).toEqual(expectedAgreementDifferences);

      expect(
        countAgreementDifferences(agreementDifferences, genericLogger)
      ).toEqual(1);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).rejects.toThrowError();
    });

    it("platform-states entry missing with read model purpose archived", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.archived,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      await addOneAgreement(agreement);

      const agreementDifferences =
        await compareReadModelAgreementsWithPlatformStates({
          platformStatesEntries: [],
          tokenGenerationStatesEntries: [],
          readModel: readModelRepository,
        });
      expect(agreementDifferences).toHaveLength(0);

      expect(
        countAgreementDifferences(agreementDifferences, genericLogger)
      ).toEqual(0);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).resolves.not.toThrowError();
    });
  });

  describe("catalog", () => {
    it("same states", async () => {
      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice1 = {
        ...getMockEService(),
        descriptors: [descriptor1],
      };
      await addOneEService(eservice1);

      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice2 = {
        ...getMockEService(),
        descriptors: [descriptor2],
      };
      await addOneEService(eservice2);

      // platform-states
      const catalogEntryPrimaryKey1 = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice1.id,
        descriptorId: eservice1.descriptors[0].id,
      });
      const platformCatalogEntry1: PlatformStatesCatalogEntry = {
        PK: catalogEntryPrimaryKey1,
        state: itemState.active,
        descriptorAudience: descriptor1.audience,
        descriptorVoucherLifespan: descriptor1.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(platformCatalogEntry1, dynamoDBClient);

      const catalogEntryPrimaryKey2 = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice2.id,
        descriptorId: eservice2.descriptors[0].id,
      });
      const platformCatalogEntry2: PlatformStatesCatalogEntry = {
        PK: catalogEntryPrimaryKey2,
        state: itemState.active,
        descriptorAudience: descriptor2.audience,
        descriptorVoucherLifespan: descriptor2.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(platformCatalogEntry2, dynamoDBClient);

      // token-generation-states
      const tokenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK),
        // TODO: where's this
        // consumerId: descriptor.
        descriptorState: itemState.active,
        descriptorAudience: descriptor1.audience,
        GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice1.id,
          descriptorId: descriptor1.id,
        }),
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const catalogDifferences =
        await compareReadModelEServicesWithPlatformStates({
          platformStatesEntries: [platformCatalogEntry1, platformCatalogEntry2],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          readModel: readModelRepository,
        });
      expect(catalogDifferences).toHaveLength(0);

      expect(
        countCatalogDifferences(catalogDifferences, genericLogger)
      ).toEqual(0);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).resolves.not.toThrowError();
    });

    it("wrong states", async () => {
      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice1 = {
        ...getMockEService(),
        descriptors: [descriptor1],
      };
      await addOneEService(eservice1);

      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice2 = {
        ...getMockEService(),
        descriptors: [descriptor2],
      };
      await addOneEService(eservice2);

      // platform-states
      const catalogEntryPrimaryKey1 = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice1.id,
        descriptorId: eservice1.descriptors[0].id,
      });
      const platformCatalogEntry1: PlatformStatesCatalogEntry = {
        PK: catalogEntryPrimaryKey1,
        state: itemState.active,
        descriptorAudience: descriptor1.audience,
        descriptorVoucherLifespan: descriptor1.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(platformCatalogEntry1, dynamoDBClient);

      const catalogEntryPrimaryKey2 = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice2.id,
        descriptorId: eservice2.descriptors[0].id,
      });
      const platformCatalogEntry2: PlatformStatesCatalogEntry = {
        PK: catalogEntryPrimaryKey2,
        state: itemState.inactive,
        descriptorAudience: ["wrong-audience"],
        descriptorVoucherLifespan: 1,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(platformCatalogEntry2, dynamoDBClient);

      // token-generation-states
      const tokenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK),
        // TODO: where's this
        // consumerId: descriptor.
        descriptorState: itemState.inactive,
        descriptorAudience: ["wrong-audience-2"],
        GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice1.id,
          descriptorId: eservice1.descriptors[0].id,
        }),
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const catalogDifferences =
        await compareReadModelEServicesWithPlatformStates({
          platformStatesEntries: [platformCatalogEntry1, platformCatalogEntry2],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          readModel: readModelRepository,
        });
      const expectedCatalogDifferences: Array<
        [
          PlatformStatesCatalogEntry | undefined,
          TokenGenerationStatesClientPurposeEntry[],
          EService | undefined
        ]
      > = [
        [platformCatalogEntry1, [tokenStatesEntry], eservice1],
        [platformCatalogEntry2, [], eservice2],
      ];
      expect(catalogDifferences).toHaveLength(2);
      expect(catalogDifferences).toEqual(
        expect.arrayContaining(expectedCatalogDifferences)
      );

      expect(
        countCatalogDifferences(catalogDifferences, genericLogger)
      ).toEqual(2);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).rejects.toThrowError();
    });

    it("missing platform-states entry should pass", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      const catalogDifferences =
        await compareReadModelEServicesWithPlatformStates({
          platformStatesEntries: [],
          tokenGenerationStatesEntries: [],
          readModel: readModelRepository,
        });
      expect(catalogDifferences).toHaveLength(0);

      expect(
        countCatalogDifferences(catalogDifferences, genericLogger)
      ).toEqual(0);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).resolves.not.toThrowError();
    });

    it("read model eservice missing", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice = {
        ...getMockEService(),
        descriptors: [descriptor],
      };

      // platform-states
      const catalogEntryPrimaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      });
      const platformCatalogEntry: PlatformStatesCatalogEntry = {
        PK: catalogEntryPrimaryKey,
        state: itemState.active,
        descriptorAudience: descriptor.audience,
        descriptorVoucherLifespan: descriptor.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(platformCatalogEntry, dynamoDBClient);

      const catalogDifferences =
        await compareReadModelEServicesWithPlatformStates({
          platformStatesEntries: [platformCatalogEntry],
          tokenGenerationStatesEntries: [],
          readModel: readModelRepository,
        });
      const expectedAgreementDifferences: Array<
        [
          PlatformStatesCatalogEntry | undefined,
          TokenGenerationStatesClientPurposeEntry[],
          EService | undefined
        ]
      > = [[platformCatalogEntry, [], undefined]];
      expect(catalogDifferences).toHaveLength(1);
      expect(catalogDifferences).toEqual(expectedAgreementDifferences);

      expect(
        countCatalogDifferences(catalogDifferences, genericLogger)
      ).toEqual(1);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).rejects.toThrowError();
    });

    it.skip("platform-states entry missing with read model descriptor not archived", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      const catalogDifferences =
        await compareReadModelEServicesWithPlatformStates({
          platformStatesEntries: [],
          tokenGenerationStatesEntries: [],
          readModel: readModelRepository,
        });
      const expectedAgreementDifferences: Array<
        [
          PlatformStatesCatalogEntry | undefined,
          TokenGenerationStatesClientPurposeEntry[],
          EService | undefined
        ]
      > = [[undefined, [], eservice]];
      expect(catalogDifferences).toHaveLength(1);
      expect(catalogDifferences).toEqual(expectedAgreementDifferences);

      expect(
        countCatalogDifferences(catalogDifferences, genericLogger)
      ).toEqual(1);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).rejects.toThrowError();
    });

    it("platform-states entry missing with read model descriptor archived", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.archived,
        audience: ["pagopa.it"],
      };
      const eservice = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      const catalogDifferences =
        await compareReadModelEServicesWithPlatformStates({
          platformStatesEntries: [],
          tokenGenerationStatesEntries: [],
          readModel: readModelRepository,
        });
      expect(catalogDifferences).toHaveLength(0);

      expect(
        countCatalogDifferences(catalogDifferences, genericLogger)
      ).toEqual(0);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).resolves.not.toThrowError();
    });
  });

  describe("client", () => {
    it("same states", async () => {
      const purpose1 = getMockPurpose();
      const client1: Client = {
        ...getMockClient(),
        purposes: [purpose1.id, generateId()],
        consumerId: purpose1.consumerId,
        keys: [getMockKey()],
      };
      await addOneClient(client1);

      const purpose2 = getMockPurpose();
      const client2: Client = {
        ...getMockClient(),
        purposes: [purpose2.id, generateId()],
        consumerId: purpose2.consumerId,
        keys: [getMockKey()],
      };
      await addOneClient(client2);

      // platform-states
      const catalogEntryPrimaryKey1 = makePlatformStatesClientPK(client1.id);
      const platformClientEntry1: PlatformStatesClientEntry = {
        PK: catalogEntryPrimaryKey1,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client1.kind),
        clientConsumerId: client1.consumerId,
        clientPurposesIds: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeClientEntry(platformClientEntry1, dynamoDBClient);

      const catalogEntryPrimaryKey2 = makePlatformStatesClientPK(client2.id);
      const platformClientEntry2: PlatformStatesClientEntry = {
        PK: catalogEntryPrimaryKey2,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client2.kind),
        clientConsumerId: client2.consumerId,
        clientPurposesIds: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeClientEntry(platformClientEntry2, dynamoDBClient);

      // token-generation-states
      const tokenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client1.id,
        kid: client1.keys[0].kid,
        purposeId: purpose1.id,
      });
      const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK),
        consumerId: purpose1.consumerId,
        GSIPK_clientId: client1.id,
        GSIPK_kid: makeGSIPKKid(client1.keys[0].kid),
        clientKind: platformClientEntry1.clientKind,
        publicKey: client1.keys[0].encodedPem,
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId: client1.id,
          purposeId: purpose1.id,
        }),
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const clientDifferences = await compareReadModelClientsWithPlatformStates(
        {
          platformStatesEntries: [platformClientEntry1, platformClientEntry2],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          readModel: readModelRepository,
        }
      );
      expect(clientDifferences).toHaveLength(0);

      expect(countClientDifferences(clientDifferences, genericLogger)).toEqual(
        0
      );

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).resolves.not.toThrowError();
    });

    it("wrong states", async () => {
      const purpose1 = getMockPurpose();
      const client1: Client = {
        ...getMockClient(),
        purposes: [purpose1.id, generateId()],
        consumerId: purpose1.consumerId,
        keys: [getMockKey()],
      };
      await addOneClient(client1);

      const purpose2 = getMockPurpose();
      const client2: Client = {
        ...getMockClient(),
        purposes: [purpose2.id, generateId()],
        consumerId: purpose2.consumerId,
        keys: [getMockKey()],
      };
      await addOneClient(client2);

      // platform-states
      const catalogEntryPrimaryKey1 = makePlatformStatesClientPK(client1.id);
      const platformClientEntry1: PlatformStatesClientEntry = {
        PK: catalogEntryPrimaryKey1,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client1.kind),
        clientConsumerId: generateId(),
        clientPurposesIds: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeClientEntry(platformClientEntry1, dynamoDBClient);

      const catalogEntryPrimaryKey2 = makePlatformStatesClientPK(client2.id);
      const platformClientEntry2: PlatformStatesClientEntry = {
        PK: catalogEntryPrimaryKey2,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client2.kind),
        clientConsumerId: generateId(),
        clientPurposesIds: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeClientEntry(platformClientEntry2, dynamoDBClient);

      // token-generation-states
      const tokenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client1.id,
        kid: client1.keys[0].kid,
        purposeId: purpose1.id,
      });
      const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK),
        consumerId: generateId(),
        GSIPK_clientId: client1.id,
        GSIPK_kid: makeGSIPKKid(client1.keys[0].kid),
        clientKind: platformClientEntry1.clientKind,
        publicKey: client1.keys[0].encodedPem,
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId: generateId(),
          purposeId: generateId(),
        }),
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const clientDifferences = await compareReadModelClientsWithPlatformStates(
        {
          platformStatesEntries: [platformClientEntry1, platformClientEntry2],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          readModel: readModelRepository,
        }
      );
      const expectedClientDifferences: Array<
        [
          PlatformStatesClientEntry | undefined,
          TokenGenerationStatesGenericEntry[],
          Client | undefined
        ]
      > = [
        [platformClientEntry1, [tokenStatesEntry], client1],
        [platformClientEntry2, [], client2],
      ];
      expect(clientDifferences).toHaveLength(2);
      expect(clientDifferences).toEqual(
        expect.arrayContaining(expectedClientDifferences)
      );

      expect(countClientDifferences(clientDifferences, genericLogger)).toEqual(
        2
      );

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).rejects.toThrowError();
    });

    it("read model eservice missing", async () => {
      const client = {
        ...getMockClient(),
        purposes: [getMockPurpose().id],
      };

      const catalogEntryPrimaryKey = makePlatformStatesClientPK(client.id);
      const platformClientEntry: PlatformStatesClientEntry = {
        PK: catalogEntryPrimaryKey,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        clientPurposesIds: client.purposes,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeClientEntry(platformClientEntry, dynamoDBClient);

      const clientDifferences = await compareReadModelClientsWithPlatformStates(
        {
          platformStatesEntries: [platformClientEntry],
          tokenGenerationStatesEntries: [],
          readModel: readModelRepository,
        }
      );
      const expectedClientDifferences: Array<
        [
          PlatformStatesClientEntry | undefined,
          TokenGenerationStatesClientPurposeEntry[],
          EService | undefined
        ]
      > = [[platformClientEntry, [], undefined]];
      expect(clientDifferences).toHaveLength(1);
      expect(clientDifferences).toEqual(expectedClientDifferences);

      expect(countClientDifferences(clientDifferences, genericLogger)).toEqual(
        1
      );

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).rejects.toThrowError();
    });

    // TODO: how to tell if a client is deleted or not
    it.skip("platform-states entry missing with read model eservice not archived", async () => {
      const client = {
        ...getMockClient(),
        purposes: [getMockPurpose().id],
      };
      await addOneClient(client);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).rejects.toThrowError();
    });

    it.skip("platform-states entry missing with read model purpose archived", async () => {
      const client = {
        ...getMockClient(),
        purposes: [getMockPurpose().id],
      };
      await addOneClient(client);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).resolves.not.toThrowError();
    });
  });
});

/*
readmodel YES and token readmodel NO -> only if archived -> skip or not -> it could be because of an unprocessed event
readmodel NO and token readmodel YES -> impossible
readmodel YES and token readmodel YES -> same states -> OK
-> different states -> NOT OK
*/
