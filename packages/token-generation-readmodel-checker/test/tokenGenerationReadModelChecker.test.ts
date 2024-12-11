import { genericLogger } from "pagopa-interop-commons";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockAgreement,
  getMockClient,
  getMockDescriptor,
  getMockEService,
  getMockKey,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTokenGenStatesConsumerClient,
  writePlatformAgreementEntry,
  writePlatformCatalogEntry,
  writePlatformPurposeEntry,
  writeTokenGenStatesConsumerClient,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  agreementState,
  Client,
  clientKindTokenGenStates,
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
  AgreementDifferencesResult,
  CatalogDifferencesResult,
  ClientDifferencesResult,
  ComparisonAgreement,
  ComparisonClient,
  ComparisonEService,
  ComparisonPlatformStatesAgreementEntry,
  ComparisonPlatformStatesCatalogEntry,
  ComparisonPlatformStatesClientEntry,
  ComparisonPlatformStatesPurposeEntry,
  ComparisonPurpose,
  ComparisonTokenGenStatesGenericClient,
  PurposeDifferencesResult,
} from "../src/models/types.js";
import {
  agreementStateToItemState,
  clientKindToTokenGenerationStatesClientKind,
  compareReadModelAgreementsWithPlatformStates,
  compareReadModelClientsAndTokenGenStates,
  compareReadModelEServicesWithPlatformStates,
  compareReadModelPurposesWithPlatformStates,
  compareTokenGenerationReadModel,
  descriptorStateToItemState,
  getPurposeStateFromPurposeVersions,
} from "../src/utils/utils.js";
import {
  addOneAgreement,
  addOneClient,
  addOneEService,
  addOnePurpose,
  dynamoDBClient,
  writePlatformStatesClientEntry,
} from "./utils.js";

describe("Token Generation Read Model Checker tests", () => {
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

      // purpose
      const purpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice.id,
      };
      await addOnePurpose(purpose);

      // agreement
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        consumerId: purpose.consumerId,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      await addOneAgreement(agreement);

      // client
      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id, generateId()],
        consumerId: purpose.consumerId,
        keys: [getMockKey()],
      };
      await addOneClient(client);

      // platform-states
      const purposeEntryPK = makePlatformStatesPurposePK(purpose.id);
      const platformStatesPurposeEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPK,
        state: itemState.active,
        purposeVersionId: purpose.versions[0].id,
        purposeEserviceId: purpose.eserviceId,
        purposeConsumerId: generateId(),
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(
        platformStatesPurposeEntry,
        dynamoDBClient
      );

      const agreementEntryPK = makePlatformStatesAgreementPK(agreement.id);
      const platformStatesAgreementEntry: PlatformStatesAgreementEntry = {
        PK: agreementEntryPK,
        state: itemState.active,
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: agreement.consumerId,
          eserviceId: generateId(),
        }),
        GSISK_agreementTimestamp:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          agreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement.descriptorId,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformAgreementEntry(
        platformStatesAgreementEntry,
        dynamoDBClient
      );

      const catalogEntryPK = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      });
      const platformStatesCatalogEntry: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK,
        state: itemState.active,
        descriptorAudience: ["wrong-audience"],
        descriptorVoucherLifespan: descriptor.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(
        platformStatesCatalogEntry,
        dynamoDBClient
      );

      const clientEntryPK = makePlatformStatesClientPK(client.id);
      const platformStatesClientEntry: PlatformStatesClientEntry = {
        PK: clientEntryPK,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        clientPurposesIds: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformStatesClientEntry(
        platformStatesClientEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: `kid ${Math.random()}`,
          purposeId: purpose.id,
        });
      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(
            tokenGenStatesClientKidPurposePK
          ),
          GSIPK_purposeId: purpose.id,
          purposeState: itemState.inactive,
          purposeVersionId: purpose.versions[0].id,
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId: agreement.consumerId,
            eserviceId: agreement.eserviceId,
          }),

          consumerId: agreement.consumerId,
          agreementId: agreement.id,
          agreementState: itemState.inactive,

          descriptorState: itemState.inactive,
          descriptorAudience: ["wrong-audience-2"],
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: eservice.descriptors[0].id,
          }),

          clientKind: clientKindTokenGenStates.consumer,
          publicKey: client.keys[0].encodedPem,
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: generateId(),
            purposeId: generateId(),
          }),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      const expectedDifferencesLength = 4;
      const differencesCount = await compareTokenGenerationReadModel(
        dynamoDBClient,
        genericLogger
      );

      expect(differencesCount).toEqual(expectedDifferencesLength);
    });
  });

  describe("purposes", () => {
    it("should not detect differences when the purpose platform-states entries are correct", async () => {
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
      const platformStatesPurposeEntry1: PlatformStatesPurposeEntry = {
        PK: purposeEntryPK1,
        state: itemState.active,
        purposeVersionId: purpose1.versions[0].id,
        purposeEserviceId: purpose1.eserviceId,
        purposeConsumerId: purpose1.consumerId,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(
        platformStatesPurposeEntry1,
        dynamoDBClient
      );

      const purposeEntryPK2 = makePlatformStatesPurposePK(purpose2.id);
      const platformStatesPurposeEntry2: PlatformStatesPurposeEntry = {
        PK: purposeEntryPK2,
        state: itemState.active,
        purposeVersionId: purpose2.versions[0].id,
        purposeEserviceId: purpose2.eserviceId,
        purposeConsumerId: purpose2.consumerId,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(
        platformStatesPurposeEntry2,
        dynamoDBClient
      );

      const expectedDifferencesLength = 0;
      const purposeDifferences =
        await compareReadModelPurposesWithPlatformStates({
          platformStatesPurposeMap: new Map([
            [purpose1.id, platformStatesPurposeEntry1],
            [purpose2.id, platformStatesPurposeEntry2],
          ]),
          purposesMap: new Map([
            [purpose1.id, purpose1],
            [purpose2.id, purpose2],
          ]),
          logger: genericLogger,
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
      const platformStatesPurposeEntry1: PlatformStatesPurposeEntry = {
        PK: purposeEntryPK1,
        state: itemState.inactive,
        purposeVersionId: purpose1.versions[0].id,
        purposeEserviceId: purpose1.eserviceId,
        purposeConsumerId: purpose1.consumerId,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(
        platformStatesPurposeEntry1,
        dynamoDBClient
      );

      const purposeEntryPK2 = makePlatformStatesPurposePK(purpose2.id);
      const platformStatesPurposeEntry2: PlatformStatesPurposeEntry = {
        PK: purposeEntryPK2,
        state: itemState.active,
        purposeVersionId: generateId(),
        purposeEserviceId: generateId(),
        purposeConsumerId: generateId(),
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(
        platformStatesPurposeEntry2,
        dynamoDBClient
      );

      const expectedDifferencesLength = 2;
      const purposeDifferences =
        await compareReadModelPurposesWithPlatformStates({
          platformStatesPurposeMap: new Map([
            [purpose1.id, platformStatesPurposeEntry1],
            [purpose2.id, platformStatesPurposeEntry2],
          ]),
          purposesMap: new Map([
            [purpose1.id, purpose1],
            [purpose2.id, purpose2],
          ]),
          logger: genericLogger,
        });
      const expectedPurposeDifferences: PurposeDifferencesResult = [
        [
          ComparisonPlatformStatesPurposeEntry.parse(
            platformStatesPurposeEntry1
          ),
          ComparisonPurpose.parse(purpose1),
        ],
        [
          ComparisonPlatformStatesPurposeEntry.parse(
            platformStatesPurposeEntry2
          ),
          ComparisonPurpose.parse(purpose2),
        ],
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
        await compareReadModelPurposesWithPlatformStates({
          platformStatesPurposeMap: new Map(),
          purposesMap: new Map([[purpose.id, purpose]]),
          logger: genericLogger,
        });
      const expectedPurposeDifferences: PurposeDifferencesResult = [
        [undefined, ComparisonPurpose.parse(purpose)],
      ];
      expect(purposeDifferences).toHaveLength(expectedDifferencesLength);
      expect(purposeDifferences).toEqual(expectedPurposeDifferences);
    });

    it("should not detect differences when the platform-states entry is missing and the purpose is archived", async () => {
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.archived),
      ]);
      await addOnePurpose(purpose);

      const expectedDifferencesLength = 0;
      const purposeDifferences =
        await compareReadModelPurposesWithPlatformStates({
          platformStatesPurposeMap: new Map(),
          purposesMap: new Map([[purpose.id, purpose]]),
          logger: genericLogger,
        });
      expect(purposeDifferences).toHaveLength(expectedDifferencesLength);
    });

    it("should detect differences when the read model purpose is missing", async () => {
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);

      // platform-states
      const purposeEntryPK = makePlatformStatesPurposePK(purpose.id);
      const platformStatesPurposeEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPK,
        state: itemState.active,
        purposeVersionId: purpose.versions[0].id,
        purposeEserviceId: purpose.eserviceId,
        purposeConsumerId: purpose.consumerId,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(
        platformStatesPurposeEntry,
        dynamoDBClient
      );

      const expectedDifferencesLength = 1;
      const purposeDifferences =
        await compareReadModelPurposesWithPlatformStates({
          platformStatesPurposeMap: new Map([
            [purpose.id, platformStatesPurposeEntry],
          ]),
          purposesMap: new Map(),
          logger: genericLogger,
        });
      const expectedPurposeDifferences: PurposeDifferencesResult = [
        [
          ComparisonPlatformStatesPurposeEntry.parse(
            platformStatesPurposeEntry
          ),
          undefined,
        ],
      ];
      expect(purposeDifferences).toHaveLength(expectedDifferencesLength);
      expect(purposeDifferences).toEqual(expectedPurposeDifferences);
    });
  });

  describe("agreements", () => {
    it("should not detect differences when the agreement platform-states entries are correct", async () => {
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
      const platformStatesAgreementEntry1: PlatformStatesAgreementEntry = {
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
        platformStatesAgreementEntry1,
        dynamoDBClient
      );

      const agreementEntryPK2 = makePlatformStatesAgreementPK(agreement2.id);
      const platformStatesAgreementEntry2: PlatformStatesAgreementEntry = {
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
        platformStatesAgreementEntry2,
        dynamoDBClient
      );

      const expectedDifferencesLength = 0;
      const agreementDifferences =
        await compareReadModelAgreementsWithPlatformStates({
          platformStatesAgreementMap: new Map([
            [agreement1.id, platformStatesAgreementEntry1],
            [agreement2.id, platformStatesAgreementEntry2],
          ]),
          agreementsMap: new Map([
            [agreement1.id, agreement1],
            [agreement2.id, agreement2],
          ]),
          logger: genericLogger,
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
      const platformStatesAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: agreementEntryPK1,
        state: itemState.active,
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: agreement1.consumerId,
          eserviceId: agreement1.eserviceId,
        }),
        GSISK_agreementTimestamp:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          agreement1.stamps.activation!.when.toISOString(),
        agreementDescriptorId: generateId(),
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformAgreementEntry(
        platformStatesAgreementEntry1,
        dynamoDBClient
      );

      const agreementEntryPK2 = makePlatformStatesAgreementPK(agreement2.id);
      const platformStatesAgreementEntry2: PlatformStatesAgreementEntry = {
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
        platformStatesAgreementEntry2,
        dynamoDBClient
      );

      const expectedDifferencesLength = 2;
      const agreementDifferences =
        await compareReadModelAgreementsWithPlatformStates({
          platformStatesAgreementMap: new Map([
            [agreement1.id, platformStatesAgreementEntry1],
            [agreement2.id, platformStatesAgreementEntry2],
          ]),
          agreementsMap: new Map([
            [agreement1.id, agreement1],
            [agreement2.id, agreement2],
          ]),
          logger: genericLogger,
        });
      const expectedAgreementDifferences: AgreementDifferencesResult = [
        [
          ComparisonPlatformStatesAgreementEntry.parse(
            platformStatesAgreementEntry1
          ),
          ComparisonAgreement.parse(agreement1),
        ],
        [
          ComparisonPlatformStatesAgreementEntry.parse(
            platformStatesAgreementEntry2
          ),
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
        await compareReadModelAgreementsWithPlatformStates({
          platformStatesAgreementMap: new Map(),
          agreementsMap: new Map([[agreement.id, agreement]]),
          logger: genericLogger,
        });
      const expectedAgreementDifferences: AgreementDifferencesResult = [
        [undefined, ComparisonAgreement.parse(agreement)],
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
        await compareReadModelAgreementsWithPlatformStates({
          platformStatesAgreementMap: new Map(),
          agreementsMap: new Map([[agreement.id, agreement]]),
          logger: genericLogger,
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
      const platformStatesAgreementEntry: PlatformStatesAgreementEntry = {
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
      await writePlatformAgreementEntry(
        platformStatesAgreementEntry,
        dynamoDBClient
      );

      const expectedDifferencesLength = 1;
      const agreementDifferences =
        await compareReadModelAgreementsWithPlatformStates({
          platformStatesAgreementMap: new Map([
            [agreement.id, platformStatesAgreementEntry],
          ]),
          agreementsMap: new Map(),
          logger: genericLogger,
        });
      const expectedAgreementDifferences: AgreementDifferencesResult = [
        [
          ComparisonPlatformStatesAgreementEntry.parse(
            platformStatesAgreementEntry
          ),
          undefined,
        ],
      ];
      expect(agreementDifferences).toHaveLength(expectedDifferencesLength);
      expect(agreementDifferences).toEqual(expectedAgreementDifferences);
    });
  });

  describe("eservices", () => {
    it("should not detect differences when the catalog platform-states entries are correct", async () => {
      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };

      const eservice1: EService = {
        ...getMockEService(),
        descriptors: [descriptor1],
      };
      const eservice2: EService = {
        ...getMockEService(),
        descriptors: [descriptor2],
      };
      await addOneEService(eservice1);
      await addOneEService(eservice2);

      // platform-states
      const catalogEntryPK1 = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice1.id,
        descriptorId: eservice1.descriptors[0].id,
      });
      const platformStatesCatalogEntry1: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK1,
        state: itemState.active,
        descriptorAudience: descriptor1.audience,
        descriptorVoucherLifespan: descriptor1.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(
        platformStatesCatalogEntry1,
        dynamoDBClient
      );

      const catalogEntryPK2 = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice2.id,
        descriptorId: eservice2.descriptors[0].id,
      });
      const platformStatesCatalogEntry2: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK2,
        state: itemState.active,
        descriptorAudience: descriptor2.audience,
        descriptorVoucherLifespan: descriptor2.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(
        platformStatesCatalogEntry2,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(
            tokenGenStatesClientKidPurposePK
          ),
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
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      const expectedDifferencesLength = 0;
      const catalogDifferences =
        await compareReadModelEServicesWithPlatformStates({
          platformStatesEServiceMap: new Map([
            [eservice1.id, platformStatesCatalogEntry1],
            [eservice2.id, platformStatesCatalogEntry2],
          ]),
          eservicesMap: new Map([
            [eservice1.id, eservice1],
            [eservice2.id, eservice2],
          ]),
          logger: genericLogger,
        });
      expect(catalogDifferences).toHaveLength(expectedDifferencesLength);
    });

    it("should detect differences for wrong eservice states", async () => {
      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };

      const eservice1: EService = {
        ...getMockEService(),
        descriptors: [descriptor1],
      };
      const eservice2: EService = {
        ...getMockEService(),
        descriptors: [descriptor2],
      };
      await addOneEService(eservice1);
      await addOneEService(eservice2);

      // platform-states
      const catalogEntryPK1 = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice1.id,
        descriptorId: eservice1.descriptors[0].id,
      });
      const platformStatesCatalogEntry1: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK1,
        state: itemState.inactive,
        descriptorAudience: descriptor1.audience,
        descriptorVoucherLifespan: descriptor1.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(
        platformStatesCatalogEntry1,
        dynamoDBClient
      );

      const catalogEntryPK2 = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice2.id,
        descriptorId: eservice2.descriptors[0].id,
      });
      const platformStatesCatalogEntry2: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK2,
        state: itemState.inactive,
        descriptorAudience: ["wrong-audience"],
        descriptorVoucherLifespan: 1,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(
        platformStatesCatalogEntry2,
        dynamoDBClient
      );

      const expectedDifferencesLength = 2;
      const catalogDifferences =
        await compareReadModelEServicesWithPlatformStates({
          platformStatesEServiceMap: new Map([
            [eservice1.id, platformStatesCatalogEntry1],
            [eservice2.id, platformStatesCatalogEntry2],
          ]),
          eservicesMap: new Map([
            [eservice1.id, eservice1],
            [eservice2.id, eservice2],
          ]),
          logger: genericLogger,
        });
      const expectedCatalogDifferences: CatalogDifferencesResult = [
        [
          ComparisonPlatformStatesCatalogEntry.parse(
            platformStatesCatalogEntry1
          ),
          ComparisonEService.parse(eservice1),
        ],
        [
          ComparisonPlatformStatesCatalogEntry.parse(
            platformStatesCatalogEntry2
          ),
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
        await compareReadModelEServicesWithPlatformStates({
          platformStatesEServiceMap: new Map(),
          eservicesMap: new Map([[eservice.id, eservice]]),
          logger: genericLogger,
        });
      const expectedCatalogDifferences: CatalogDifferencesResult = [
        [undefined, ComparisonEService.parse(eservice)],
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
      const tokenGenStatesClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(
            tokenGenStatesClientKidPurposePK
          ),
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
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      const expectedDifferencesLength = 0;
      const catalogDifferences =
        await compareReadModelEServicesWithPlatformStates({
          platformStatesEServiceMap: new Map(),
          eservicesMap: new Map([[eservice.id, eservice]]),
          logger: genericLogger,
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
      const platformStatesCatalogEntry: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK,
        state: itemState.active,
        descriptorAudience: descriptor.audience,
        descriptorVoucherLifespan: descriptor.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(
        platformStatesCatalogEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(
            tokenGenStatesClientKidPurposePK
          ),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: descriptor.id,
          }),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      const expectedDifferencesLength = 1;
      const catalogDifferences =
        await compareReadModelEServicesWithPlatformStates({
          platformStatesEServiceMap: new Map([
            [eservice.id, platformStatesCatalogEntry],
          ]),
          eservicesMap: new Map(),
          logger: genericLogger,
        });
      const expectedAgreementDifferences: CatalogDifferencesResult = [
        [
          ComparisonPlatformStatesCatalogEntry.parse(
            platformStatesCatalogEntry
          ),
          undefined,
        ],
      ];
      expect(catalogDifferences).toHaveLength(expectedDifferencesLength);
      expect(catalogDifferences).toEqual(expectedAgreementDifferences);
    });
  });

  describe("clients", () => {
    it("should not detect differences when the client platform-states entries are correct", async () => {
      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["test.pagopa.it"],
      };
      const eservice1: EService = {
        ...getMockEService(),
        descriptors: [descriptor1],
      };
      const eservice2: EService = {
        ...getMockEService(),
        descriptors: [descriptor2],
      };
      const eserviceIdDescriptorIdMap = new Map([
        [
          makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice1.id,
            descriptorId: descriptor1.id,
          }),
          eservice1,
        ],
        [
          makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice2.id,
            descriptorId: descriptor2.id,
          }),
          eservice2,
        ],
      ]);
      await addOneEService(eservice1);
      await addOneEService(eservice2);

      const purpose1: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice1.id,
      };
      const purpose2: Purpose = {
        ...getMockPurpose([
          getMockPurposeVersion(purposeVersionState.archived),
        ]),
        eserviceId: eservice2.id,
      };
      const purposesMap = new Map([
        [purpose1.id, purpose1],
        [purpose2.id, purpose2],
      ]);
      await addOnePurpose(purpose1);
      await addOnePurpose(purpose2);

      const agreement1: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        consumerId: purpose1.consumerId,
        eserviceId: eservice1.id,
        descriptorId: descriptor1.id,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const agreement2: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        consumerId: purpose2.consumerId,
        eserviceId: eservice2.id,
        descriptorId: descriptor2.id,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const consumerIdEserviceIdMap = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose1.consumerId,
            eserviceId: eservice1.id,
          }),
          agreement1,
        ],
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose2.consumerId,
            eserviceId: eservice2.id,
          }),
          agreement2,
        ],
      ]);
      await addOneAgreement(agreement1);
      await addOneAgreement(agreement2);

      const client1: Client = {
        ...getMockClient(),
        purposes: [purpose1.id],
        consumerId: purpose1.consumerId,
        keys: [getMockKey()],
      };
      const client2: Client = {
        ...getMockClient(),
        purposes: [],
        consumerId: purpose2.consumerId,
        keys: [getMockKey()],
      };
      const clientsMap = new Map([
        [client1.id, client1],
        [client2.id, client2],
      ]);
      await addOneClient(client1);
      await addOneClient(client2);

      // platform-states
      const clientEntryPK1 = makePlatformStatesClientPK(client1.id);
      const platformStatesClientEntry1: PlatformStatesClientEntry = {
        PK: clientEntryPK1,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client1.kind),
        clientConsumerId: client1.consumerId,
        clientPurposesIds: client1.purposes,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformStatesClientEntry(
        platformStatesClientEntry1,
        dynamoDBClient
      );

      const clientEntryPK2 = makePlatformStatesClientPK(client2.id);
      const platformStatesClientEntry2: PlatformStatesClientEntry = {
        PK: clientEntryPK2,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client2.kind),
        clientConsumerId: client2.consumerId,
        clientPurposesIds: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformStatesClientEntry(
        platformStatesClientEntry2,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesClientKidPurposePK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client1.id,
          kid: client1.keys[0].kid,
          purposeId: purpose1.id,
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(
            tokenGenStatesClientKidPurposePK1
          ),
          consumerId: purpose1.consumerId,
          clientKind: clientKindTokenGenStates.consumer,
          publicKey: client1.keys[0].encodedPem,
          GSIPK_clientId: client1.id,
          GSIPK_kid: makeGSIPKKid(client1.keys[0].kid),
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client1.id,
            purposeId: purpose1.id,
          }),
          GSIPK_purposeId: purpose1.id,
          purposeState: getPurposeStateFromPurposeVersions(purpose1.versions),
          purposeVersionId: purpose1.versions[0].id,
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId: purpose1.consumerId,
            eserviceId: eservice1.id,
          }),
          agreementId: agreement1.id,
          agreementState: agreementStateToItemState(agreement1.state),
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice1.id,
            descriptorId: descriptor1.id,
          }),
          descriptorState: descriptorStateToItemState(descriptor1.state),
          descriptorAudience: descriptor1.audience,
          descriptorVoucherLifespan: descriptor1.voucherLifespan,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client2.id,
        kid: client2.keys[0].kid,
      });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesClientKidPK),
          consumerId: purpose2.consumerId,
          GSIPK_clientId: client2.id,
          GSIPK_kid: makeGSIPKKid(client2.keys[0].kid),
          clientKind: clientKindTokenGenStates.consumer,
          publicKey: client2.keys[0].encodedPem,
          GSIPK_consumerId_eserviceId: undefined,
          agreementId: undefined,
          agreementState: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorState: undefined,
          descriptorVoucherLifespan: undefined,
          GSIPK_purposeId: undefined,
          purposeState: undefined,
          purposeVersionId: undefined,
          GSIPK_clientId_purposeId: undefined,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      const expectedDifferencesLength = 0;
      const clientDifferences = await compareReadModelClientsAndTokenGenStates({
        platformStatesClientMap: new Map([
          [client1.id, platformStatesClientEntry1],
          [client2.id, platformStatesClientEntry2],
        ]),
        tokenGenStatesMaps: new Map([
          [client1.id, [tokenGenStatesConsumerClient1]],
          [client2.id, [tokenGenStatesConsumerClient2]],
        ]),
        clientsMap,
        purposesMap,
        consumerIdEserviceIdMap,
        eserviceIdDescriptorIdMap,
        logger: genericLogger,
      });
      expect(clientDifferences).toHaveLength(expectedDifferencesLength);
    });

    it("should detect differences when the client states are not correct", async () => {
      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["test.pagopa.it"],
      };
      const eservice1: EService = {
        ...getMockEService(),
        descriptors: [descriptor1],
      };
      const eservice2: EService = {
        ...getMockEService(),
        descriptors: [descriptor2],
      };
      const eserviceIdDescriptorIdMap = new Map([
        [
          makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice1.id,
            descriptorId: descriptor1.id,
          }),
          eservice1,
        ],
        [
          makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice2.id,
            descriptorId: descriptor2.id,
          }),
          eservice2,
        ],
      ]);
      await addOneEService(eservice1);
      await addOneEService(eservice2);

      const purpose1: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice1.id,
      };
      const purpose2: Purpose = {
        ...getMockPurpose([
          getMockPurposeVersion(purposeVersionState.archived),
        ]),
        eserviceId: eservice2.id,
      };
      const purposesMap = new Map([
        [purpose1.id, purpose1],
        [purpose2.id, purpose2],
      ]);
      await addOnePurpose(purpose1);
      await addOnePurpose(purpose2);

      const agreement1: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        consumerId: purpose1.consumerId,
        eserviceId: eservice1.id,
        descriptorId: descriptor1.id,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const agreement2: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        consumerId: purpose2.consumerId,
        eserviceId: eservice2.id,
        descriptorId: descriptor2.id,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const consumerIdEserviceIdMap = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose1.consumerId,
            eserviceId: eservice1.id,
          }),
          agreement1,
        ],
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose2.consumerId,
            eserviceId: eservice2.id,
          }),
          agreement2,
        ],
      ]);
      await addOneAgreement(agreement1);
      await addOneAgreement(agreement2);

      const client1: Client = {
        ...getMockClient(),
        purposes: [purpose1.id],
        consumerId: purpose1.consumerId,
        keys: [getMockKey()],
      };
      const client2: Client = {
        ...getMockClient(),
        purposes: [purpose2.id, generateId()],
        consumerId: purpose2.consumerId,
        keys: [getMockKey()],
      };
      const clientsMap = new Map([
        [client1.id, client1],
        [client2.id, client2],
      ]);
      await addOneClient(client1);
      await addOneClient(client2);

      // platform-states
      const clientEntryPK1 = makePlatformStatesClientPK(client1.id);
      const platformStatesClientEntry1: PlatformStatesClientEntry = {
        PK: clientEntryPK1,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client1.kind),
        clientConsumerId: client1.consumerId,
        clientPurposesIds: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformStatesClientEntry(
        platformStatesClientEntry1,
        dynamoDBClient
      );

      const clientEntryPK2 = makePlatformStatesClientPK(client2.id);
      const platformStatesClientEntry2: PlatformStatesClientEntry = {
        PK: clientEntryPK2,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client2.kind),
        clientConsumerId: generateId(),
        clientPurposesIds: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformStatesClientEntry(
        platformStatesClientEntry2,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client1.id,
          kid: client1.keys[0].kid,
          purposeId: purpose1.id,
        });
      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(
            tokenGenStatesClientKidPurposePK
          ),
          consumerId: generateId(),
          GSIPK_clientId: client1.id,
          GSIPK_kid: makeGSIPKKid(client1.keys[0].kid),
          clientKind: clientKindTokenGenStates.consumer,
          publicKey: client1.keys[0].encodedPem,
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: generateId(),
            purposeId: generateId(),
          }),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      const expectedDifferencesLength = 2;
      const clientDifferences = await compareReadModelClientsAndTokenGenStates({
        platformStatesClientMap: new Map([
          [client1.id, platformStatesClientEntry1],
          [client2.id, platformStatesClientEntry2],
        ]),
        tokenGenStatesMaps: new Map([
          [client1.id, [tokenGenStatesConsumerClient]],
        ]),
        clientsMap,
        purposesMap,
        consumerIdEserviceIdMap,
        eserviceIdDescriptorIdMap,
        logger: genericLogger,
      });
      const expectedClientDifferences: ClientDifferencesResult = [
        [
          undefined,
          [
            ComparisonTokenGenStatesGenericClient.parse(
              tokenGenStatesConsumerClient
            ),
          ],
          ComparisonClient.parse(client1),
        ],
        [
          ComparisonPlatformStatesClientEntry.parse(platformStatesClientEntry2),
          undefined,
          ComparisonClient.parse(client2),
        ],
      ];
      expect(clientDifferences).toHaveLength(expectedDifferencesLength);
      expect(clientDifferences).toEqual(
        expect.arrayContaining(expectedClientDifferences)
      );
    });

    it("should detect differences if the token-generation-states entry has a CLIENTKID PK but should have a CLIENTKIDPURPOSE PK", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      const eserviceIdDescriptorIdMap = new Map([
        [
          makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: descriptor.id,
          }),
          eservice,
        ],
      ]);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice.id,
      };
      const purposesMap = new Map([[purpose.id, purpose]]);
      await addOnePurpose(purpose);

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        consumerId: purpose.consumerId,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const consumerIdEserviceIdMap = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose.consumerId,
            eserviceId: eservice.id,
          }),
          agreement,
        ],
      ]);
      await addOneAgreement(agreement);

      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id],
        consumerId: purpose.consumerId,
        keys: [getMockKey()],
      };
      const clientsMap = new Map([[client.id, client]]);

      await addOneClient(client);

      // platform-states
      const clientEntryPK = makePlatformStatesClientPK(client.id);
      const platformStatesClientEntry: PlatformStatesClientEntry = {
        PK: clientEntryPK,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        clientPurposesIds: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformStatesClientEntry(
        platformStatesClientEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesClientKidPK = makeTokenGenerationStatesClientKidPK({
        clientId: client.id,
        kid: client.keys[0].kid,
      });
      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesClientKidPK),
          consumerId: client.consumerId,
          GSIPK_clientId: client.id,
          GSIPK_kid: makeGSIPKKid(client.keys[0].kid),
          clientKind: clientKindTokenGenStates.consumer,
          publicKey: client.keys[0].encodedPem,
          GSIPK_consumerId_eserviceId: undefined,
          agreementId: undefined,
          agreementState: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorState: undefined,
          descriptorVoucherLifespan: undefined,
          GSIPK_purposeId: undefined,
          purposeState: undefined,
          purposeVersionId: undefined,
          GSIPK_clientId_purposeId: undefined,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      const expectedDifferencesLength = 1;
      const clientDifferences = await compareReadModelClientsAndTokenGenStates({
        platformStatesClientMap: new Map([
          [client.id, platformStatesClientEntry],
        ]),
        tokenGenStatesMaps: new Map([
          [client.id, [tokenGenStatesConsumerClient]],
        ]),
        clientsMap,
        purposesMap,
        consumerIdEserviceIdMap,
        eserviceIdDescriptorIdMap,
        logger: genericLogger,
      });
      const expectedClientDifferences: ClientDifferencesResult = [
        [
          undefined,
          [
            ComparisonTokenGenStatesGenericClient.parse(
              tokenGenStatesConsumerClient
            ),
          ],
          ComparisonClient.parse(client),
        ],
      ];
      expect(clientDifferences).toHaveLength(expectedDifferencesLength);
      expect(clientDifferences).toEqual(
        expect.arrayContaining(expectedClientDifferences)
      );
    });

    it("should detect differences when the platform-states entry is missing", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      const eserviceIdDescriptorIdMap = new Map([
        [
          makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: descriptor.id,
          }),
          eservice,
        ],
      ]);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice.id,
      };
      const purposesMap = new Map([[purpose.id, purpose]]);
      await addOnePurpose(purpose);

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        consumerId: purpose.consumerId,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const consumerIdEserviceIdMap = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose.consumerId,
            eserviceId: eservice.id,
          }),
          agreement,
        ],
      ]);
      await addOneAgreement(agreement);

      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id],
        consumerId: purpose.consumerId,
        keys: [getMockKey()],
      };
      const clientsMap = new Map([[client.id, client]]);
      await addOneClient(client);

      const expectedDifferencesLength = 1;
      const clientDifferences = await compareReadModelClientsAndTokenGenStates({
        platformStatesClientMap: new Map(),
        tokenGenStatesMaps: new Map(),
        clientsMap,
        purposesMap,
        consumerIdEserviceIdMap,
        eserviceIdDescriptorIdMap,
        logger: genericLogger,
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
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      const eserviceIdDescriptorIdMap = new Map([
        [
          makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: descriptor.id,
          }),
          eservice,
        ],
      ]);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice.id,
      };
      const purposesMap = new Map([[purpose.id, purpose]]);
      await addOnePurpose(purpose);

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        consumerId: purpose.consumerId,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const consumerIdEserviceIdMap = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose.consumerId,
            eserviceId: eservice.id,
          }),
          agreement,
        ],
      ]);
      await addOneAgreement(agreement);

      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id],
        consumerId: purpose.consumerId,
        keys: [getMockKey()],
      };
      const clientsMap = new Map([[client.id, client]]);

      await addOneClient(client);

      // platform-states
      const clientEntryPK = makePlatformStatesClientPK(client.id);
      const platformStatesClientEntry: PlatformStatesClientEntry = {
        PK: clientEntryPK,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        clientPurposesIds: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformStatesClientEntry(
        platformStatesClientEntry,
        dynamoDBClient
      );

      const expectedDifferencesLength = 1;
      const clientDifferences = await compareReadModelClientsAndTokenGenStates({
        platformStatesClientMap: new Map([
          [client.id, platformStatesClientEntry],
        ]),
        tokenGenStatesMaps: new Map(),
        clientsMap,
        purposesMap,
        consumerIdEserviceIdMap,
        eserviceIdDescriptorIdMap,
        logger: genericLogger,
      });
      const expectedClientDifferences: ClientDifferencesResult = [
        [undefined, undefined, ComparisonClient.parse(client)],
      ];
      expect(clientDifferences).toHaveLength(expectedDifferencesLength);
      expect(clientDifferences).toEqual(
        expect.arrayContaining(expectedClientDifferences)
      );
    });

    it("should not detect differences when the token-generation-states entries are missing if the client has no keys", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      const eserviceIdDescriptorIdMap = new Map([
        [
          makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: descriptor.id,
          }),
          eservice,
        ],
      ]);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice.id,
      };
      const purposesMap = new Map([[purpose.id, purpose]]);
      await addOnePurpose(purpose);

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        consumerId: purpose.consumerId,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const consumerIdEserviceIdMap = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose.consumerId,
            eserviceId: eservice.id,
          }),
          agreement,
        ],
      ]);
      await addOneAgreement(agreement);

      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id, generateId()],
        consumerId: purpose.consumerId,
      };
      const clientsMap = new Map([[client.id, client]]);
      await addOneClient(client);

      // platform-states
      const clientEntryPK = makePlatformStatesClientPK(client.id);
      const platformStatesClientEntry: PlatformStatesClientEntry = {
        PK: clientEntryPK,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        clientPurposesIds: client.purposes,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformStatesClientEntry(
        platformStatesClientEntry,
        dynamoDBClient
      );

      const expectedDifferencesLength = 0;
      const clientDifferences = await compareReadModelClientsAndTokenGenStates({
        platformStatesClientMap: new Map([
          [client.id, platformStatesClientEntry],
        ]),
        tokenGenStatesMaps: new Map(),
        clientsMap,
        purposesMap,
        consumerIdEserviceIdMap,
        eserviceIdDescriptorIdMap,
        logger: genericLogger,
      });
      expect(clientDifferences).toHaveLength(expectedDifferencesLength);
    });

    it("should detect differences when the read model client is missing", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      const eserviceIdDescriptorIdMap = new Map([
        [
          makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: descriptor.id,
          }),
          eservice,
        ],
      ]);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice.id,
      };
      const purposesMap = new Map([[purpose.id, purpose]]);
      await addOnePurpose(purpose);

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        consumerId: purpose.consumerId,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const consumerIdEserviceIdMap = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose.consumerId,
            eserviceId: eservice.id,
          }),
          agreement,
        ],
      ]);
      await addOneAgreement(agreement);

      const client: Client = {
        ...getMockClient(),
        consumerId: purpose.consumerId,
        purposes: [purpose.id],
        keys: [getMockKey()],
      };

      const clientEntryPK = makePlatformStatesClientPK(client.id);
      const platformStatesClientEntry: PlatformStatesClientEntry = {
        PK: clientEntryPK,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        clientPurposesIds: client.purposes,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformStatesClientEntry(
        platformStatesClientEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: client.keys[0].kid,
          purposeId: purpose.id,
        });
      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(
            tokenGenStatesClientKidPurposePK
          ),
          consumerId: purpose.consumerId,
          GSIPK_clientId: client.id,
          GSIPK_kid: makeGSIPKKid(client.keys[0].kid),
          clientKind: clientKindTokenGenStates.consumer,
          publicKey: client.keys[0].encodedPem,
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose.id,
          }),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      const expectedDifferencesLength = 1;
      const clientDifferences = await compareReadModelClientsAndTokenGenStates({
        platformStatesClientMap: new Map([
          [client.id, platformStatesClientEntry],
        ]),
        tokenGenStatesMaps: new Map([
          [client.id, [tokenGenStatesConsumerClient]],
        ]),
        clientsMap: new Map(),
        purposesMap,
        consumerIdEserviceIdMap,
        eserviceIdDescriptorIdMap,
        logger: genericLogger,
      });
      const expectedClientDifferences: ClientDifferencesResult = [
        [
          ComparisonPlatformStatesClientEntry.parse(platformStatesClientEntry),
          [
            ComparisonTokenGenStatesGenericClient.parse(
              tokenGenStatesConsumerClient
            ),
          ],
          undefined,
        ],
      ];
      expect(clientDifferences).toHaveLength(expectedDifferencesLength);
      expect(clientDifferences).toEqual(expectedClientDifferences);
    });
  });
});
