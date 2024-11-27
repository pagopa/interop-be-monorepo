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
  getMockTokenStatesClientEntry,
  writeTokenStateClientEntry,
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
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesPurposeEntry,
  Purpose,
  purposeVersionState,
  TenantId,
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientPurposeEntry,
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
  compareReadModelAgreementsWithTokenGenReadModel,
  compareReadModelClientsWithTokenGenReadModel,
  compareReadModelEServicesWithTokenGenReadModel,
  compareReadModelPurposesWithTokenGenReadModel,
  compareTokenGenerationReadModel,
} from "../src/utils/utils.js";
import {
  AgreementDifferencesResult,
  ComparisonPlatformStatesAgreementEntry,
  ComparisonPlatformStatesPurposeEntry,
  ComparisonAgreement,
  ComparisonPurpose,
  ComparisonTokenStatesAgreementEntry,
  ComparisonTokenStatesPurposeEntry,
  PurposeDifferencesResult,
  CatalogDifferencesResult,
  ComparisonPlatformStatesCatalogEntry,
  ComparisonEService,
  ComparisonTokenStatesCatalogEntry,
  ClientDifferencesResult,
  ComparisonTokenStatesClientEntry,
  ComparisonClient,
  ComparisonPlatformStatesClientEntry,
} from "../src/models/types.js";
import {
  addOneAgreement,
  addOneClient,
  addOneEService,
  addOnePurpose,
  config,
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

  describe("all collections", () => {
    it("should detect differences for all collections when the Token Generation Read Model states are wrong", async () => {
      // catalog
      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice1: EService = {
        ...getMockEService(),
        descriptors: [descriptor1],
      };
      await addOneEService(eservice1);

      // purpose
      const purpose1 = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose1);

      // agreement
      const agreement1: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        consumerId: purpose1.consumerId,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      await addOneAgreement(agreement1);

      // client
      const client1: Client = {
        ...getMockClient(),
        purposes: [purpose1.id, generateId()],
        consumerId: purpose1.consumerId,
        keys: [getMockKey()],
      };
      await addOneClient(client1);

      // platform-states
      const purposeEntryPK1 = makePlatformStatesPurposePK(purpose1.id);
      const platformPurposeEntry1: PlatformStatesPurposeEntry = {
        PK: purposeEntryPK1,
        state: itemState.active,
        purposeVersionId: purpose1.versions[0].id,
        purposeEserviceId: purpose1.eserviceId,
        purposeConsumerId: purpose1.consumerId,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(platformPurposeEntry1, dynamoDBClient);

      const agreementEntryPK1 = makePlatformStatesAgreementPK(agreement1.id);
      const platformAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: agreementEntryPK1,
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

      const catalogEntryPK1 = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice1.id,
        descriptorId: eservice1.descriptors[0].id,
      });
      const platformCatalogEntry1: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK1,
        state: itemState.active,
        descriptorAudience: descriptor1.audience,
        descriptorVoucherLifespan: descriptor1.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(platformCatalogEntry1, dynamoDBClient);

      const clientEntryPK1 = makePlatformStatesClientPK(client1.id);
      const platformClientEntry1: PlatformStatesClientEntry = {
        PK: clientEntryPK1,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client1.kind),
        clientConsumerId: generateId(),
        clientPurposesIds: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeClientEntry(platformClientEntry1, dynamoDBClient);

      // token-generation-states
      const tokenStatesPurposeEntryPK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client1.id,
          kid: `kid ${Math.random()}`,
          purposeId: purpose1.id,
        });
      const tokenStatesPurposeEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesPurposeEntryPK),
        GSIPK_purposeId: purpose1.id,
        purposeState: itemState.inactive,
        purposeVersionId: purpose1.versions[0].id,
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: agreement1.consumerId,
          eserviceId: agreement1.eserviceId,
        }),

        consumerId: agreement1.consumerId,
        agreementId: agreement1.id,
        agreementState: itemState.inactive,

        descriptorState: itemState.inactive,
        descriptorAudience: ["wrong-audience-2"],
        GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice1.id,
          descriptorId: eservice1.descriptors[0].id,
        }),

        clientKind: platformClientEntry1.clientKind,
        publicKey: client1.keys[0].encodedPem,
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId: generateId(),
          purposeId: generateId(),
        }),
      };
      await writeTokenStateEntry(tokenStatesPurposeEntry, dynamoDBClient);

      const expectedDifferencesLength = 4;
      const differencesCount = await compareTokenGenerationReadModel(
        dynamoDBClient,
        genericLogger
      );

      expect(differencesCount).toEqual(expectedDifferencesLength);
    });
  });

  describe("purposes", () => {
    it("should detect no differences", async () => {
      const purpose1 = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose1);

      const purpose2 = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose2);

      // platform-states
      const purposeEntryPK1 = makePlatformStatesPurposePK(purpose1.id);
      const platformPurposeEntry1: PlatformStatesPurposeEntry = {
        PK: purposeEntryPK1,
        state: itemState.active,
        purposeVersionId: purpose1.versions[0].id,
        purposeEserviceId: purpose1.eserviceId,
        purposeConsumerId: purpose1.consumerId,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(platformPurposeEntry1, dynamoDBClient);

      const purposeEntryPK2 = makePlatformStatesPurposePK(purpose2.id);
      const platformPurposeEntry2: PlatformStatesPurposeEntry = {
        PK: purposeEntryPK2,
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
      const tokenStatesEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId,
        kid: `kid ${Math.random()}`,
        purposeId: purpose1.id,
      });
      const tokenStatesEntry1: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK1),
        GSIPK_purposeId: purpose1.id,
        purposeState: itemState.active,
        purposeVersionId: purpose1.versions[0].id,
        consumerId: purpose1.consumerId,
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId,
          purposeId: purpose1.id,
        }),
      };
      await writeTokenStateEntry(tokenStatesEntry1, dynamoDBClient);

      const tokenStatesEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId,
        kid: `kid ${Math.random()}`,
        purposeId: purpose2.id,
      });
      const tokenStatesEntry2: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK2),
        GSIPK_purposeId: purpose2.id,
        purposeState: itemState.active,
        purposeVersionId: purpose2.versions[0].id,
        consumerId: purpose2.consumerId,
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId,
          purposeId: purpose2.id,
        }),
      };
      await writeTokenStateEntry(tokenStatesEntry2, dynamoDBClient);

      const expectedDifferencesLength = 0;
      const purposeDifferences =
        await compareReadModelPurposesWithTokenGenReadModel({
          platformStatesEntries: [platformPurposeEntry1, platformPurposeEntry2],
          tokenGenerationStatesEntries: [tokenStatesEntry1, tokenStatesEntry2],
          purposes: [purpose1, purpose2],
        });
      expect(purposeDifferences).toHaveLength(expectedDifferencesLength);
    });

    it("should detect differences for wrong purpose states", async () => {
      const purpose1 = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose1);

      const purpose2 = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose2);

      // platform-states
      const purposeEntryPK1 = makePlatformStatesPurposePK(purpose1.id);
      const platformPurposeEntry1: PlatformStatesPurposeEntry = {
        PK: purposeEntryPK1,
        state: itemState.active,
        purposeVersionId: purpose1.versions[0].id,
        purposeEserviceId: purpose1.eserviceId,
        purposeConsumerId: purpose1.consumerId,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(platformPurposeEntry1, dynamoDBClient);

      const purposeEntryPK2 = makePlatformStatesPurposePK(purpose2.id);
      const platformPurposeEntry2: PlatformStatesPurposeEntry = {
        PK: purposeEntryPK2,
        state: itemState.active,
        purposeVersionId: purpose2.versions[0].id,
        purposeEserviceId: purpose2.eserviceId,
        purposeConsumerId: purpose2.consumerId,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(platformPurposeEntry2, dynamoDBClient);

      // token-generation-states
      const clientId1 = generateId<ClientId>();
      const tokenStatesEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: clientId1,
        kid: `kid ${Math.random()}`,
        purposeId: purpose1.id,
      });
      const correctTokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK1),
        GSIPK_purposeId: purpose1.id,
        purposeState: itemState.active,
        purposeVersionId: purpose1.versions[0].id,
        consumerId: purpose1.consumerId,
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId: clientId1,
          purposeId: purpose1.id,
        }),
      };
      await writeTokenStateEntry(correctTokenStatesEntry, dynamoDBClient);

      const clientId2 = generateId<ClientId>();
      const tokenStatesEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: clientId2,
        kid: `kid ${Math.random()}`,
        purposeId: purpose1.id,
      });
      const wrongTokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK2),
        GSIPK_purposeId: purpose1.id,
        purposeState: itemState.inactive,
        purposeVersionId: purpose1.versions[0].id,
        consumerId: purpose1.consumerId,
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId: clientId2,
          purposeId: purpose1.id,
        }),
      };
      await writeTokenStateEntry(wrongTokenStatesEntry, dynamoDBClient);

      const expectedDifferencesLength = 2;
      const purposeDifferences =
        await compareReadModelPurposesWithTokenGenReadModel({
          platformStatesEntries: [platformPurposeEntry1, platformPurposeEntry2],
          tokenGenerationStatesEntries: [
            correctTokenStatesEntry,
            wrongTokenStatesEntry,
          ],
          purposes: [purpose1, purpose2],
        });
      const expectedPurposeDifferences: PurposeDifferencesResult = [
        [
          undefined,
          [ComparisonTokenStatesPurposeEntry.parse(wrongTokenStatesEntry)],
          ComparisonPurpose.parse(purpose1),
        ],
        [undefined, undefined, ComparisonPurpose.parse(purpose2)],
      ];
      expect(purposeDifferences).toHaveLength(expectedDifferencesLength);
      expect(purposeDifferences).toEqual(
        expect.arrayContaining(expectedPurposeDifferences)
      );
    });

    it("should detect differences when the platform-states entry is missing and the purpose is not archived", async () => {
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose);

      const expectedDifferencesLength = 1;
      const purposeDifferences =
        await compareReadModelPurposesWithTokenGenReadModel({
          platformStatesEntries: [],
          tokenGenerationStatesEntries: [],
          purposes: [purpose],
        });
      const expectedPurposeDifferences: PurposeDifferencesResult = [
        [undefined, undefined, ComparisonPurpose.parse(purpose)],
      ];
      expect(purposeDifferences).toHaveLength(expectedDifferencesLength);
      expect(purposeDifferences).toEqual(expectedPurposeDifferences);
    });

    it("should not detect differences when the platform-states entry is missing and the purpose is archived", async () => {
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.archived),
      ]);
      await addOnePurpose(purpose);

      // token-generation-states
      const clientId = generateId<ClientId>();
      const tokenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId,
        kid: `kid ${Math.random()}`,
        purposeId: purpose.id,
      });
      const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK),
        GSIPK_purposeId: purpose.id,
        purposeState: itemState.inactive,
        purposeVersionId: purpose.versions[0].id,
        consumerId: purpose.consumerId,
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId,
          purposeId: purpose.id,
        }),
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const expectedDifferencesLength = 0;
      const purposeDifferences =
        await compareReadModelPurposesWithTokenGenReadModel({
          platformStatesEntries: [],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          purposes: [purpose],
        });
      expect(purposeDifferences).toHaveLength(expectedDifferencesLength);
    });

    it("should detect differences when the read model purpose is missing", async () => {
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);

      // platform-states
      const purposeEntryPK = makePlatformStatesPurposePK(purpose.id);
      const platformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPK,
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

      const expectedDifferencesLength = 1;
      const purposeDifferences =
        await compareReadModelPurposesWithTokenGenReadModel({
          platformStatesEntries: [platformPurposeEntry],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          purposes: [],
        });
      const expectedPurposeDifferences: PurposeDifferencesResult = [
        [
          ComparisonPlatformStatesPurposeEntry.parse(platformPurposeEntry),
          [ComparisonTokenStatesPurposeEntry.parse(tokenStatesEntry)],
          undefined,
        ],
      ];
      expect(purposeDifferences).toHaveLength(expectedDifferencesLength);
      expect(purposeDifferences).toEqual(expectedPurposeDifferences);
    });
  });

  describe("agreements", () => {
    it("should detect no differences", async () => {
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
      const agreementEntryPK1 = makePlatformStatesAgreementPK(agreement1.id);
      const platformAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: agreementEntryPK1,
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

      const agreementEntryPK2 = makePlatformStatesAgreementPK(agreement2.id);
      const platformAgreementEntry2: PlatformStatesAgreementEntry = {
        PK: agreementEntryPK2,
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
      const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: agreement1.eserviceId,
        descriptorId: agreement1.descriptorId,
      });
      const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK),
        consumerId: agreement1.consumerId,
        agreementId: agreement1.id,
        agreementState: itemState.active,
        GSIPK_consumerId_eserviceId,
        GSIPK_eserviceId_descriptorId,
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const expectedDifferencesLength = 0;
      const agreementDifferences =
        await compareReadModelAgreementsWithTokenGenReadModel({
          platformStatesEntries: [
            platformAgreementEntry1,
            platformAgreementEntry2,
          ],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          agreements: [agreement1, agreement2],
        });
      expect(agreementDifferences).toHaveLength(expectedDifferencesLength);
    });

    it("should detect differences for wrong agreement states", async () => {
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
      const agreementEntryPK1 = makePlatformStatesAgreementPK(agreement1.id);
      const platformAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: agreementEntryPK1,
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

      const agreementEntryPK2 = makePlatformStatesAgreementPK(agreement2.id);
      const platformAgreementEntry2: PlatformStatesAgreementEntry = {
        PK: agreementEntryPK2,
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

      const expectedDifferencesLength = 2;
      const agreementDifferences =
        await compareReadModelAgreementsWithTokenGenReadModel({
          platformStatesEntries: [
            platformAgreementEntry1,
            platformAgreementEntry2,
          ],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          agreements: [agreement1, agreement2],
        });
      const expectedAgreementDifferences: AgreementDifferencesResult = [
        [
          undefined,
          [ComparisonTokenStatesAgreementEntry.parse(tokenStatesEntry)],
          ComparisonAgreement.parse(agreement1),
        ],
        [
          ComparisonPlatformStatesAgreementEntry.parse(platformAgreementEntry2),
          undefined,
          ComparisonAgreement.parse(agreement2),
        ],
      ];
      expect(agreementDifferences).toHaveLength(expectedDifferencesLength);
      expect(agreementDifferences).toEqual(
        expect.arrayContaining(expectedAgreementDifferences)
      );
    });

    it("should detect differences when the platform-states entry is missing and the agreement is not archived", async () => {
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

      const expectedDifferencesLength = 1;
      const agreementDifferences =
        await compareReadModelAgreementsWithTokenGenReadModel({
          platformStatesEntries: [],
          tokenGenerationStatesEntries: [],
          agreements: [agreement],
        });
      const expectedAgreementDifferences: AgreementDifferencesResult = [
        [undefined, undefined, ComparisonAgreement.parse(agreement)],
      ];
      expect(agreementDifferences).toHaveLength(expectedDifferencesLength);
      expect(agreementDifferences).toEqual(expectedAgreementDifferences);
    });

    it("should not detect differences when the platform-states entry is missing and the agreement is archived", async () => {
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

      const expectedDifferencesLength = 0;
      const agreementDifferences =
        await compareReadModelAgreementsWithTokenGenReadModel({
          platformStatesEntries: [],
          tokenGenerationStatesEntries: [],
          agreements: [agreement],
        });
      expect(agreementDifferences).toHaveLength(expectedDifferencesLength);
    });

    it("should detect differences when the read model agreement is missing", async () => {
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
      const agreementEntryPK = makePlatformStatesAgreementPK(agreement.id);
      const platformAgreementEntry: PlatformStatesAgreementEntry = {
        PK: agreementEntryPK,
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

      // token-generation-states
      const tokenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
      });
      const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK),
        consumerId: agreement.consumerId,
        agreementId: agreement.id,
        agreementState: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSIPK_eserviceId_descriptorId,
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const expectedDifferencesLength = 1;
      const agreementDifferences =
        await compareReadModelAgreementsWithTokenGenReadModel({
          platformStatesEntries: [],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          agreements: [],
        });
      const expectedAgreementDifferences: AgreementDifferencesResult = [
        [
          undefined,
          [ComparisonTokenStatesAgreementEntry.parse(tokenStatesEntry)],
          undefined,
        ],
      ];
      expect(agreementDifferences).toHaveLength(expectedDifferencesLength);
      expect(agreementDifferences).toEqual(expectedAgreementDifferences);
    });
  });

  describe("eservices", () => {
    it("should detect no differences", async () => {
      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice1: EService = {
        ...getMockEService(),
        descriptors: [descriptor1],
      };
      await addOneEService(eservice1);

      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice2: EService = {
        ...getMockEService(),
        descriptors: [descriptor2],
      };
      await addOneEService(eservice2);

      // platform-states
      const catalogEntryPK1 = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice1.id,
        descriptorId: eservice1.descriptors[0].id,
      });
      const platformCatalogEntry1: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK1,
        state: itemState.active,
        descriptorAudience: descriptor1.audience,
        descriptorVoucherLifespan: descriptor1.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(platformCatalogEntry1, dynamoDBClient);

      const catalogEntryPK2 = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice2.id,
        descriptorId: eservice2.descriptors[0].id,
      });
      const platformCatalogEntry2: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK2,
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
        descriptorState: itemState.active,
        descriptorAudience: descriptor1.audience,
        GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice1.id,
          descriptorId: descriptor1.id,
        }),
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: generateId(),
          eserviceId: eservice1.id,
        }),
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const expectedDifferencesLength = 0;
      const catalogDifferences =
        await compareReadModelEServicesWithTokenGenReadModel({
          platformStatesEntries: [platformCatalogEntry1, platformCatalogEntry2],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          eservices: [eservice1, eservice2],
        });
      expect(catalogDifferences).toHaveLength(expectedDifferencesLength);
    });

    it("should detect differences for wrong eservice states", async () => {
      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice1: EService = {
        ...getMockEService(),
        descriptors: [descriptor1],
      };
      await addOneEService(eservice1);

      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice2: EService = {
        ...getMockEService(),
        descriptors: [descriptor2],
      };
      await addOneEService(eservice2);

      // platform-states
      const catalogEntryPK1 = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice1.id,
        descriptorId: eservice1.descriptors[0].id,
      });
      const platformCatalogEntry1: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK1,
        state: itemState.active,
        descriptorAudience: descriptor1.audience,
        descriptorVoucherLifespan: descriptor1.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(platformCatalogEntry1, dynamoDBClient);

      const catalogEntryPK2 = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice2.id,
        descriptorId: eservice2.descriptors[0].id,
      });
      const platformCatalogEntry2: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK2,
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
        descriptorState: itemState.inactive,
        descriptorAudience: ["wrong-audience-2"],
        GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice1.id,
          descriptorId: eservice1.descriptors[0].id,
        }),
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: generateId(),
          eserviceId: eservice1.id,
        }),
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const expectedDifferencesLength = 2;
      const catalogDifferences =
        await compareReadModelEServicesWithTokenGenReadModel({
          platformStatesEntries: [platformCatalogEntry1, platformCatalogEntry2],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          eservices: [eservice1, eservice2],
        });
      const expectedCatalogDifferences: CatalogDifferencesResult = [
        [
          undefined,
          [ComparisonTokenStatesCatalogEntry.parse(tokenStatesEntry)],
          ComparisonEService.parse(eservice1),
        ],
        [
          ComparisonPlatformStatesCatalogEntry.parse(platformCatalogEntry2),
          undefined,
          ComparisonEService.parse(eservice2),
        ],
      ];
      expect(catalogDifferences).toHaveLength(expectedDifferencesLength);
      expect(catalogDifferences).toEqual(
        expect.arrayContaining(expectedCatalogDifferences)
      );
    });

    it("should detect differences when the platform-states entry is missing and the descriptor is not archived", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      const expectedDifferencesLength = 1;
      const catalogDifferences =
        await compareReadModelEServicesWithTokenGenReadModel({
          platformStatesEntries: [],
          tokenGenerationStatesEntries: [],
          eservices: [eservice],
        });
      const expectedCatalogDifferences: CatalogDifferencesResult = [
        [undefined, undefined, ComparisonEService.parse(eservice)],
      ];
      expect(catalogDifferences).toHaveLength(expectedDifferencesLength);
      expect(catalogDifferences).toEqual(expectedCatalogDifferences);
    });

    it("should not detect differences when the platform-states entry is missing and the descriptor is archived", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.archived,
        audience: ["pagopa.it"],
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      // token-generation-states
      const tokenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK),
        descriptorState: itemState.inactive,
        descriptorAudience: descriptor.audience,
        GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
        }),
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: generateId(),
          eserviceId: eservice.id,
        }),
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const expectedDifferencesLength = 0;
      const catalogDifferences =
        await compareReadModelEServicesWithTokenGenReadModel({
          platformStatesEntries: [],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          eservices: [eservice],
        });
      expect(catalogDifferences).toHaveLength(expectedDifferencesLength);
    });

    it("should detect differences when the read model eservice is missing", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };

      // platform-states
      const catalogEntryPK = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      });
      const platformCatalogEntry: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK,
        state: itemState.active,
        descriptorAudience: descriptor.audience,
        descriptorVoucherLifespan: descriptor.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(platformCatalogEntry, dynamoDBClient);

      // token-generation-states
      const tokenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK),
        descriptorState: itemState.active,
        descriptorAudience: descriptor.audience,
        GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
        }),
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const expectedDifferencesLength = 1;
      const catalogDifferences =
        await compareReadModelEServicesWithTokenGenReadModel({
          platformStatesEntries: [platformCatalogEntry],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          eservices: [],
        });
      const expectedAgreementDifferences: CatalogDifferencesResult = [
        [
          ComparisonPlatformStatesCatalogEntry.parse(platformCatalogEntry),
          [ComparisonTokenStatesCatalogEntry.parse(tokenStatesEntry)],
          undefined,
        ],
      ];
      expect(catalogDifferences).toHaveLength(expectedDifferencesLength);
      expect(catalogDifferences).toEqual(expectedAgreementDifferences);
    });
  });

  describe("clients", () => {
    it("should detect no differences when the client states are correct", async () => {
      const purpose1 = getMockPurpose();
      const client1: Client = {
        ...getMockClient(),
        purposes: [purpose1.id],
        consumerId: purpose1.consumerId,
        keys: [getMockKey()],
      };
      await addOneClient(client1);

      const purpose2 = getMockPurpose();
      const client2: Client = {
        ...getMockClient(),
        purposes: [purpose2.id],
        consumerId: purpose2.consumerId,
        keys: [getMockKey()],
      };
      await addOneClient(client2);

      // platform-states
      const clientEntryPK1 = makePlatformStatesClientPK(client1.id);
      const platformClientEntry1: PlatformStatesClientEntry = {
        PK: clientEntryPK1,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client1.kind),
        clientConsumerId: client1.consumerId,
        clientPurposesIds: client1.purposes,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeClientEntry(platformClientEntry1, dynamoDBClient);

      const clientEntryPK2 = makePlatformStatesClientPK(client2.id);
      const platformClientEntry2: PlatformStatesClientEntry = {
        PK: clientEntryPK2,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client2.kind),
        clientConsumerId: client2.consumerId,
        clientPurposesIds: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeClientEntry(platformClientEntry2, dynamoDBClient);

      // token-generation-states
      const tokenStatesEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client1.id,
        kid: client1.keys[0].kid,
        purposeId: purpose1.id,
      });
      const tokenStatesEntry1: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK1),
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
      await writeTokenStateEntry(tokenStatesEntry1, dynamoDBClient);

      const tokenStatesEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client2.id,
        kid: client2.keys[0].kid,
        purposeId: purpose2.id,
      });
      const tokenStatesEntry2: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK2),
        consumerId: purpose2.consumerId,
        GSIPK_clientId: client2.id,
        GSIPK_kid: makeGSIPKKid(client2.keys[0].kid),
        clientKind: platformClientEntry2.clientKind,
        publicKey: client2.keys[0].encodedPem,
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId: client2.id,
          purposeId: purpose2.id,
        }),
      };
      await writeTokenStateEntry(tokenStatesEntry2, dynamoDBClient);

      const expectedDifferencesLength = 0;
      const clientDifferences =
        await compareReadModelClientsWithTokenGenReadModel({
          platformStatesEntries: [platformClientEntry1, platformClientEntry2],
          tokenGenerationStatesEntries: [tokenStatesEntry1, tokenStatesEntry2],
          clients: [client1, client2],
        });
      expect(clientDifferences).toHaveLength(expectedDifferencesLength);
    });

    it("should detect differences when the client states are not correct", async () => {
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
      const clientEntryPK1 = makePlatformStatesClientPK(client1.id);
      const platformClientEntry1: PlatformStatesClientEntry = {
        PK: clientEntryPK1,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client1.kind),
        clientConsumerId: client1.consumerId,
        clientPurposesIds: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeClientEntry(platformClientEntry1, dynamoDBClient);

      const clientEntryPK2 = makePlatformStatesClientPK(client2.id);
      const platformClientEntry2: PlatformStatesClientEntry = {
        PK: clientEntryPK2,
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

      const expectedDifferencesLength = 2;
      const clientDifferences =
        await compareReadModelClientsWithTokenGenReadModel({
          platformStatesEntries: [platformClientEntry1, platformClientEntry2],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          clients: [client1, client2],
        });
      const expectedClientDifferences: ClientDifferencesResult = [
        [
          undefined,
          [ComparisonTokenStatesClientEntry.parse(tokenStatesEntry)],
          ComparisonClient.parse(client1),
        ],
        [
          ComparisonPlatformStatesClientEntry.parse(platformClientEntry2),
          undefined,
          ComparisonClient.parse(client2),
        ],
      ];
      expect(clientDifferences).toHaveLength(expectedDifferencesLength);
      expect(clientDifferences).toEqual(
        expect.arrayContaining(expectedClientDifferences)
      );
    });

    it("should detect no differences when the client states are correct", async () => {
      const consumerId = generateId<TenantId>();
      const purpose1: Purpose = {
        ...getMockPurpose(),
        consumerId,
      };
      const purpose2: Purpose = {
        ...getMockPurpose(),
        consumerId,
      };
      const client: Client = {
        ...getMockClient(),
        purposes: [purpose1.id, purpose2.id],
        consumerId: purpose1.consumerId,
        keys: [getMockKey()],
      };
      await addOneClient(client);

      // platform-states
      const clientEntryPK1 = makePlatformStatesClientPK(client.id);
      const platformClientEntry: PlatformStatesClientEntry = {
        PK: clientEntryPK1,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        clientPurposesIds: client.purposes,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeClientEntry(platformClientEntry, dynamoDBClient);

      // token-generation-states
      const tokenStatesEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: client.keys[0].kid,
        purposeId: purpose1.id,
      });
      const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK1),
        consumerId: purpose1.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_kid: makeGSIPKKid(client.keys[0].kid),
        clientKind: platformClientEntry.clientKind,
        publicKey: client.keys[0].encodedPem,
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId: client.id,
          purposeId: purpose1.id,
        }),
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const tokenStatesEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: "client.keys[0].kid",
        purposeId: generateId(),
      });
      const tokenStatesEntry2: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK2),
        consumerId: generateId(),
        GSIPK_clientId: generateId(),
        GSIPK_kid: makeGSIPKKid(client.keys[0].kid),
        clientKind: platformClientEntry.clientKind,
        publicKey: client.keys[0].encodedPem,
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId: generateId(),
          purposeId: generateId(),
        }),
      };
      await writeTokenStateEntry(tokenStatesEntry2, dynamoDBClient);

      const expectedDifferencesLength = 1;
      const clientDifferences =
        await compareReadModelClientsWithTokenGenReadModel({
          platformStatesEntries: [platformClientEntry],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          clients: [client],
        });
      expect(clientDifferences).toHaveLength(expectedDifferencesLength);
    });

    it("should detect differences if the token entry is client kid but should be client kid purpose", async () => {
      const purpose = getMockPurpose();
      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id],
        consumerId: purpose.consumerId,
        keys: [getMockKey()],
      };
      await addOneClient(client);

      // platform-states
      const clientEntryPK = makePlatformStatesClientPK(client.id);
      const platformClientEntry: PlatformStatesClientEntry = {
        PK: clientEntryPK,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        clientPurposesIds: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeClientEntry(platformClientEntry, dynamoDBClient);

      // token-generation-states
      const tokenStatesEntryPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: client.keys[0].kid,
      });
      const tokenStatesEntry: TokenGenerationStatesClientEntry = {
        ...getMockTokenStatesClientEntry(tokenStatesEntryPK),
        consumerId: client.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_kid: makeGSIPKKid(client.keys[0].kid),
        clientKind: platformClientEntry.clientKind,
        publicKey: client.keys[0].encodedPem,
      };
      await writeTokenStateClientEntry(tokenStatesEntry, dynamoDBClient);

      const expectedDifferencesLength = 1;
      const clientDifferences =
        await compareReadModelClientsWithTokenGenReadModel({
          platformStatesEntries: [platformClientEntry],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          clients: [client],
        });
      const expectedClientDifferences: ClientDifferencesResult = [
        [
          undefined,
          [ComparisonTokenStatesClientEntry.parse(tokenStatesEntry)],
          ComparisonClient.parse(client),
        ],
      ];
      expect(clientDifferences).toHaveLength(expectedDifferencesLength);
      expect(clientDifferences).toEqual(
        expect.arrayContaining(expectedClientDifferences)
      );
    });

    it("should detect differences when a client has wrong purpose ids", async () => {
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
      const clientEntryPK1 = makePlatformStatesClientPK(client1.id);
      const platformClientEntry1: PlatformStatesClientEntry = {
        PK: clientEntryPK1,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client1.kind),
        clientConsumerId: client1.consumerId,
        clientPurposesIds: [generateId()],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeClientEntry(platformClientEntry1, dynamoDBClient);

      const clientEntryPK2 = makePlatformStatesClientPK(client2.id);
      const platformClientEntry2: PlatformStatesClientEntry = {
        PK: clientEntryPK2,
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

      const expectedDifferencesLength = 2;
      const clientDifferences =
        await compareReadModelClientsWithTokenGenReadModel({
          platformStatesEntries: [platformClientEntry1, platformClientEntry2],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          clients: [client1, client2],
        });
      const expectedClientDifferences: ClientDifferencesResult = [
        [
          ComparisonPlatformStatesClientEntry.parse(platformClientEntry1),
          [ComparisonTokenStatesClientEntry.parse(tokenStatesEntry)],
          ComparisonClient.parse(client1),
        ],
        [
          ComparisonPlatformStatesClientEntry.parse(platformClientEntry2),
          undefined,
          ComparisonClient.parse(client2),
        ],
      ];
      expect(clientDifferences).toHaveLength(expectedDifferencesLength);
      expect(clientDifferences).toEqual(
        expect.arrayContaining(expectedClientDifferences)
      );
    });

    it("should detect differences when the platform-states entry is missing", async () => {
      const purpose = getMockPurpose();
      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id, generateId()],
        consumerId: purpose.consumerId,
        keys: [getMockKey()],
      };
      await addOneClient(client);

      const expectedDifferencesLength = 1;
      const clientDifferences =
        await compareReadModelClientsWithTokenGenReadModel({
          platformStatesEntries: [],
          tokenGenerationStatesEntries: [],
          clients: [client],
        });
      const expectedClientDifferences: ClientDifferencesResult = [
        [undefined, undefined, ComparisonClient.parse(client)],
      ];
      expect(clientDifferences).toHaveLength(expectedDifferencesLength);
      expect(clientDifferences).toEqual(
        expect.arrayContaining(expectedClientDifferences)
      );
    });

    it("should detect differences when the token-generation-states entries are missing if the client has keys", async () => {
      const purpose = getMockPurpose();
      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id],
        consumerId: purpose.consumerId,
        keys: [getMockKey()],
      };
      await addOneClient(client);

      // platform-states
      const clientEntryPK = makePlatformStatesClientPK(client.id);
      const platformClientEntry: PlatformStatesClientEntry = {
        PK: clientEntryPK,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        clientPurposesIds: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeClientEntry(platformClientEntry, dynamoDBClient);

      const expectedDifferencesLength = 1;
      const clientDifferences =
        await compareReadModelClientsWithTokenGenReadModel({
          platformStatesEntries: [platformClientEntry],
          tokenGenerationStatesEntries: [],
          clients: [client],
        });
      const expectedClientDifferences: ClientDifferencesResult = [
        [undefined, undefined, ComparisonClient.parse(client)],
      ];
      expect(clientDifferences).toHaveLength(expectedDifferencesLength);
      expect(clientDifferences).toEqual(
        expect.arrayContaining(expectedClientDifferences)
      );
    });

    it("should detect no differences when the token-generation-states entries are missing if the client has no keys", async () => {
      const purpose = getMockPurpose();
      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id, generateId()],
        consumerId: purpose.consumerId,
      };
      await addOneClient(client);

      // platform-states
      const clientEntryPK = makePlatformStatesClientPK(client.id);
      const platformClientEntry: PlatformStatesClientEntry = {
        PK: clientEntryPK,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        clientPurposesIds: client.purposes,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeClientEntry(platformClientEntry, dynamoDBClient);

      const expectedDifferencesLength = 0;
      const clientDifferences =
        await compareReadModelClientsWithTokenGenReadModel({
          platformStatesEntries: [platformClientEntry],
          tokenGenerationStatesEntries: [],
          clients: [client],
        });
      expect(clientDifferences).toHaveLength(expectedDifferencesLength);
    });

    it("should detect differences when the client has no purpose and the number of records in token-generation-states is not equal to the number of keys in the client", async () => {
      const client: Client = {
        ...getMockClient(),
        purposes: [],
        keys: [getMockKey()],
      };
      await addOneClient(client);

      // platform-states
      const clientEntryPK = makePlatformStatesClientPK(client.id);
      const platformClientEntry: PlatformStatesClientEntry = {
        PK: clientEntryPK,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        clientPurposesIds: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeClientEntry(platformClientEntry, dynamoDBClient);

      const expectedDifferencesLength = 1;
      const clientDifferences =
        await compareReadModelClientsWithTokenGenReadModel({
          platformStatesEntries: [platformClientEntry],
          tokenGenerationStatesEntries: [],
          clients: [client],
        });
      const expectedClientDifferences: ClientDifferencesResult = [
        [undefined, undefined, ComparisonClient.parse(client)],
      ];
      expect(clientDifferences).toHaveLength(expectedDifferencesLength);
      expect(clientDifferences).toEqual(
        expect.arrayContaining(expectedClientDifferences)
      );
    });

    it("should detect differences when the read model client is missing", async () => {
      const purpose = getMockPurpose();
      const client: Client = {
        ...getMockClient(),
        consumerId: purpose.consumerId,
        purposes: [purpose.id],
        keys: [getMockKey()],
      };

      const clientEntryPK = makePlatformStatesClientPK(client.id);
      const platformClientEntry: PlatformStatesClientEntry = {
        PK: clientEntryPK,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        clientPurposesIds: client.purposes,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeClientEntry(platformClientEntry, dynamoDBClient);

      // token-generation-states
      const tokenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: client.keys[0].kid,
        purposeId: purpose.id,
      });
      const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK),
        consumerId: purpose.consumerId,
        GSIPK_clientId: client.id,
        GSIPK_kid: makeGSIPKKid(client.keys[0].kid),
        clientKind: platformClientEntry.clientKind,
        publicKey: client.keys[0].encodedPem,
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId: client.id,
          purposeId: purpose.id,
        }),
      };
      await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);

      const expectedDifferencesLength = 1;
      const clientDifferences =
        await compareReadModelClientsWithTokenGenReadModel({
          platformStatesEntries: [platformClientEntry],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          clients: [],
        });
      const expectedClientDifferences: ClientDifferencesResult = [
        [
          ComparisonPlatformStatesClientEntry.parse(platformClientEntry),
          [ComparisonTokenStatesClientEntry.parse(tokenStatesEntry)],
          undefined,
        ],
      ];
      expect(clientDifferences).toHaveLength(expectedDifferencesLength);
      expect(clientDifferences).toEqual(expectedClientDifferences);
    });
  });
});
