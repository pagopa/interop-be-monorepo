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
  makeGSIPKClientIdKid,
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
  clientKindToTokenGenerationStatesClientKind,
  compareReadModelAgreementsWithPlatformStates,
  compareReadModelClientsAndTokenGenStates,
  compareReadModelEServicesWithPlatformStates,
  compareReadModelPurposesWithPlatformStates,
  compareTokenGenerationReadModel,
} from "../src/utils/utils.js";
import {
  addOneAgreement,
  addOneClient,
  addOneEService,
  addOnePurpose,
  dynamoDBClient,
  readModelService,
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

      const agreementEntryPK = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const platformStatesAgreementEntry: PlatformStatesAgreementEntry = {
        PK: agreementEntryPK,
        state: itemState.active,
        agreementId: agreement.id,
        agreementTimestamp:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          agreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: generateId(),
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

      const expectedDifferencesLength = 5;
      const differencesCount = await compareTokenGenerationReadModel(
        dynamoDBClient,
        readModelService,
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
          platformStatesPurposeById: new Map([
            [purpose1.id, platformStatesPurposeEntry1],
            [purpose2.id, platformStatesPurposeEntry2],
          ]),
          purposesById: new Map([
            [purpose1.id, purpose1],
            [purpose2.id, purpose2],
          ]),
          logger: genericLogger,
        });
      expect(purposeDifferences).toEqual(expectedDifferencesLength);
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
          platformStatesPurposeById: new Map([
            [purpose1.id, platformStatesPurposeEntry1],
            [purpose2.id, platformStatesPurposeEntry2],
          ]),
          purposesById: new Map([
            [purpose1.id, purpose1],
            [purpose2.id, purpose2],
          ]),
          logger: genericLogger,
        });
      expect(purposeDifferences).toEqual(expectedDifferencesLength);
    });

    it("should detect differences when there's a platform-states purpose entry and the purpose is archived", async () => {
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.archived),
      ]);
      await addOnePurpose(purpose);

      // platform-states
      const purposeEntryPK = makePlatformStatesPurposePK(purpose.id);
      const platformStatesPurposeEntry: PlatformStatesPurposeEntry = {
        PK: purposeEntryPK,
        state: itemState.inactive,
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
          platformStatesPurposeById: new Map([
            [purpose.id, platformStatesPurposeEntry],
          ]),
          purposesById: new Map([[purpose.id, purpose]]),
          logger: genericLogger,
        });
      expect(purposeDifferences).toEqual(expectedDifferencesLength);
    });

    it("should detect differences when the platform-states entry is missing and the purpose is not archived", async () => {
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose);

      const expectedDifferencesLength = 1;
      const purposeDifferences =
        await compareReadModelPurposesWithPlatformStates({
          platformStatesPurposeById: new Map(),
          purposesById: new Map([[purpose.id, purpose]]),
          logger: genericLogger,
        });
      expect(purposeDifferences).toEqual(expectedDifferencesLength);
    });

    it("should not detect differences when the platform-states entry is missing and the purpose is archived", async () => {
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.archived),
      ]);
      await addOnePurpose(purpose);

      const expectedDifferencesLength = 0;
      const purposeDifferences =
        await compareReadModelPurposesWithPlatformStates({
          platformStatesPurposeById: new Map(),
          purposesById: new Map([[purpose.id, purpose]]),
          logger: genericLogger,
        });
      expect(purposeDifferences).toEqual(expectedDifferencesLength);
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
          platformStatesPurposeById: new Map([
            [purpose.id, platformStatesPurposeEntry],
          ]),
          purposesById: new Map(),
          logger: genericLogger,
        });
      expect(purposeDifferences).toEqual(expectedDifferencesLength);
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
      const agreementEntryPK1 = makePlatformStatesAgreementPK({
        consumerId: agreement1.consumerId,
        eserviceId: agreement1.eserviceId,
      });
      const platformStatesAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: agreementEntryPK1,
        state: itemState.active,
        agreementId: agreement1.id,
        agreementTimestamp:
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

      const agreementEntryPK2 = makePlatformStatesAgreementPK({
        consumerId: agreement2.consumerId,
        eserviceId: agreement2.eserviceId,
      });
      const platformStatesAgreementEntry2: PlatformStatesAgreementEntry = {
        PK: agreementEntryPK2,
        state: itemState.active,
        agreementId: agreement2.id,
        agreementTimestamp:
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
          platformStatesAgreementById: new Map([
            [agreement1.id, platformStatesAgreementEntry1],
            [agreement2.id, platformStatesAgreementEntry2],
          ]),
          agreementsById: new Map([
            [agreement1.id, agreement1],
            [agreement2.id, agreement2],
          ]),
          logger: genericLogger,
        });
      expect(agreementDifferences).toEqual(expectedDifferencesLength);
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
      const agreementEntryPK1 = makePlatformStatesAgreementPK({
        consumerId: agreement1.consumerId,
        eserviceId: agreement1.eserviceId,
      });
      const platformStatesAgreementEntry1: PlatformStatesAgreementEntry = {
        PK: agreementEntryPK1,
        state: itemState.active,
        agreementId: agreement1.id,
        agreementTimestamp:
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

      const agreementEntryPK2 = makePlatformStatesAgreementPK({
        consumerId: agreement2.consumerId,
        eserviceId: agreement2.eserviceId,
      });
      const platformStatesAgreementEntry2: PlatformStatesAgreementEntry = {
        PK: agreementEntryPK2,
        state: itemState.active,
        agreementId: agreement2.id,
        agreementTimestamp:
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
          platformStatesAgreementById: new Map([
            [agreement1.id, platformStatesAgreementEntry1],
            [agreement2.id, platformStatesAgreementEntry2],
          ]),
          agreementsById: new Map([
            [agreement1.id, agreement1],
            [agreement2.id, agreement2],
          ]),
          logger: genericLogger,
        });
      expect(agreementDifferences).toEqual(expectedDifferencesLength);
    });

    it("should not detect differences when there's a platform-states agreement entry and the agreement is archived", async () => {
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

      // platform-states
      const agreementEntryPK = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const platformStatesAgreementEntry: PlatformStatesAgreementEntry = {
        PK: agreementEntryPK,
        state: itemState.inactive,
        agreementId: agreement.id,
        agreementTimestamp:
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

      const expectedDifferencesLength = 0;
      const agreementDifferences =
        await compareReadModelAgreementsWithPlatformStates({
          platformStatesAgreementById: new Map([
            [agreement.id, platformStatesAgreementEntry],
          ]),
          agreementsById: new Map([[agreement.id, agreement]]),
          logger: genericLogger,
        });
      expect(agreementDifferences).toEqual(expectedDifferencesLength);
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
          platformStatesAgreementById: new Map(),
          agreementsById: new Map([[agreement.id, agreement]]),
          logger: genericLogger,
        });
      expect(agreementDifferences).toEqual(expectedDifferencesLength);
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
          platformStatesAgreementById: new Map(),
          agreementsById: new Map([[agreement.id, agreement]]),
          logger: genericLogger,
        });
      expect(agreementDifferences).toEqual(expectedDifferencesLength);
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
      const agreementEntryPK = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const platformStatesAgreementEntry: PlatformStatesAgreementEntry = {
        PK: agreementEntryPK,
        state: itemState.active,
        agreementId: agreement.id,
        agreementTimestamp:
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
          platformStatesAgreementById: new Map([
            [agreement.id, platformStatesAgreementEntry],
          ]),
          agreementsById: new Map(),
          logger: genericLogger,
        });
      expect(agreementDifferences).toEqual(expectedDifferencesLength);
    });

    it("should not detect differences when the read model agreement is missing and the platform-states agreement state is inactive", async () => {
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
      const agreementEntryPK = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const platformStatesAgreementEntry: PlatformStatesAgreementEntry = {
        PK: agreementEntryPK,
        state: itemState.inactive,
        agreementId: agreement.id,
        agreementTimestamp:
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

      const expectedDifferencesLength = 0;
      const agreementDifferences =
        await compareReadModelAgreementsWithPlatformStates({
          platformStatesAgreementById: new Map([
            [agreement.id, platformStatesAgreementEntry],
          ]),
          agreementsById: new Map(),
          logger: genericLogger,
        });
      expect(agreementDifferences).toEqual(expectedDifferencesLength);
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
      const descriptor3: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.deprecated,
        audience: ["pagopa.it"],
      };

      const eservice1: EService = {
        ...getMockEService(),
        descriptors: [descriptor1],
      };
      const eservice2: EService = {
        ...getMockEService(),
        descriptors: [descriptor2, descriptor3],
      };
      await addOneEService(eservice1);
      await addOneEService(eservice2);

      // platform-states
      const catalogEntryPK1 = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice1.id,
        descriptorId: descriptor1.id,
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
        descriptorId: descriptor2.id,
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

      const catalogEntryPK3 = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice2.id,
        descriptorId: descriptor3.id,
      });
      const platformStatesCatalogEntry3: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK3,
        state: itemState.active,
        descriptorAudience: descriptor3.audience,
        descriptorVoucherLifespan: descriptor3.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(
        platformStatesCatalogEntry3,
        dynamoDBClient
      );

      const expectedDifferencesLength = 0;
      const catalogDifferences =
        await compareReadModelEServicesWithPlatformStates({
          platformStatesEServiceById: new Map([
            [
              eservice1.id,
              new Map([[descriptor1.id, platformStatesCatalogEntry1]]),
            ],
            [
              eservice2.id,
              new Map([
                [descriptor2.id, platformStatesCatalogEntry2],
                [descriptor3.id, platformStatesCatalogEntry3],
              ]),
            ],
          ]),
          eservicesById: new Map([
            [eservice1.id, eservice1],
            [eservice2.id, eservice2],
          ]),
          logger: genericLogger,
        });
      expect(catalogDifferences).toEqual(expectedDifferencesLength);
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
          platformStatesEServiceById: new Map([
            [
              eservice1.id,
              new Map([[descriptor1.id, platformStatesCatalogEntry1]]),
            ],
            [
              eservice2.id,
              new Map([[descriptor2.id, platformStatesCatalogEntry2]]),
            ],
          ]),
          eservicesById: new Map([
            [eservice1.id, eservice1],
            [eservice2.id, eservice2],
          ]),
          logger: genericLogger,
        });
      expect(catalogDifferences).toEqual(expectedDifferencesLength);
    });

    it("should detect differences when there's a platform-states catalog entry and the descriptor is not published, deprecated or suspended", async () => {
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

      // platform-states
      const catalogEntryPK = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      });
      const platformStatesCatalogEntry: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK,
        state: itemState.inactive,
        descriptorAudience: descriptor.audience,
        descriptorVoucherLifespan: descriptor.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(
        platformStatesCatalogEntry,
        dynamoDBClient
      );

      const expectedDifferencesLength = 1;
      const catalogDifferences =
        await compareReadModelEServicesWithPlatformStates({
          platformStatesEServiceById: new Map([
            [
              eservice.id,
              new Map([[descriptor.id, platformStatesCatalogEntry]]),
            ],
          ]),
          eservicesById: new Map([[eservice.id, eservice]]),
          logger: genericLogger,
        });
      expect(catalogDifferences).toEqual(expectedDifferencesLength);
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
          platformStatesEServiceById: new Map(),
          eservicesById: new Map([[eservice.id, eservice]]),
          logger: genericLogger,
        });
      expect(catalogDifferences).toEqual(expectedDifferencesLength);
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

      const expectedDifferencesLength = 0;
      const catalogDifferences =
        await compareReadModelEServicesWithPlatformStates({
          platformStatesEServiceById: new Map(),
          eservicesById: new Map([[eservice.id, eservice]]),
          logger: genericLogger,
        });
      expect(catalogDifferences).toEqual(expectedDifferencesLength);
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

      const expectedDifferencesLength = 1;
      const catalogDifferences =
        await compareReadModelEServicesWithPlatformStates({
          platformStatesEServiceById: new Map([
            [
              eservice.id,
              new Map([[descriptor.id, platformStatesCatalogEntry]]),
            ],
          ]),
          eservicesById: new Map(),
          logger: genericLogger,
        });
      expect(catalogDifferences).toEqual(expectedDifferencesLength);
    });
  });

  // The script doesn't compare the platform-states table with the read model for clients
  describe("clients", () => {
    it("should not detect differences when the client states are correct", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      const eservicesById = new Map([[eservice.id, eservice]]);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice.id,
      };
      const purposesById = new Map([[purpose.id, purpose]]);
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
      const agreementsByConsumerIdEserviceId = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose.consumerId,
            eserviceId: eservice.id,
          }),
          [agreement],
        ],
      ]);
      await addOneAgreement(agreement);

      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id],
        consumerId: purpose.consumerId,
        keys: [getMockKey()],
      };
      const clientsById = new Map([[client.id, client]]);
      await addOneClient(client);

      // token-generation-states
      const tokenGenStatesClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: client.keys[0].kid,
          purposeId: purpose.id,
        });
      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          PK: tokenGenStatesClientKidPurposePK,
          consumerId: client.consumerId,
          GSIPK_clientId: client.id,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: client.keys[0].kid,
          }),
          clientKind: clientKindTokenGenStates.consumer,
          publicKey: client.keys[0].encodedPem,
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose.id,
          }),
          GSIPK_purposeId: purpose.id,
          purposeState: itemState.active,
          purposeVersionId: purpose.versions[0].id,
          agreementId: agreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId: agreement.consumerId,
            eserviceId: agreement.eserviceId,
          }),
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: eservice.descriptors[0].id,
          }),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          updatedAt: new Date().toISOString(),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      const expectedDifferencesLength = 0;
      const clientDifferences = await compareReadModelClientsAndTokenGenStates({
        tokenGenStatesByClient: new Map([
          [client.id, [tokenGenStatesConsumerClient]],
        ]),
        clientsById,
        purposesById,
        eservicesById,
        agreementsByConsumerIdEserviceId,
        logger: genericLogger,
      });
      expect(clientDifferences).toEqual(expectedDifferencesLength);
    });

    it("should detect differences when the token-generation-states entries length is wrong", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      const eservicesById = new Map([[eservice.id, eservice]]);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice.id,
      };
      const purposesById = new Map([[purpose.id, purpose]]);
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
      const agreementsByConsumerIdEserviceId = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose.consumerId,
            eserviceId: eservice.id,
          }),
          [agreement],
        ],
      ]);
      await addOneAgreement(agreement);

      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id],
        consumerId: purpose.consumerId,
        keys: [getMockKey(), getMockKey()],
      };
      const clientsById = new Map([[client.id, client]]);
      await addOneClient(client);

      // token-generation-states
      const tokenGenStatesClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: client.keys[0].kid,
          purposeId: purpose.id,
        });
      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          PK: tokenGenStatesClientKidPurposePK,
          consumerId: client.consumerId,
          GSIPK_clientId: client.id,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: client.keys[0].kid,
          }),
          clientKind: clientKindTokenGenStates.consumer,
          publicKey: client.keys[0].encodedPem,
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose.id,
          }),
          GSIPK_purposeId: purpose.id,
          purposeState: itemState.active,
          purposeVersionId: purpose.versions[0].id,
          agreementId: agreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId: agreement.consumerId,
            eserviceId: agreement.eserviceId,
          }),
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: eservice.descriptors[0].id,
          }),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          updatedAt: new Date().toISOString(),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      const expectedDifferencesLength = 1;
      const clientDifferences = await compareReadModelClientsAndTokenGenStates({
        tokenGenStatesByClient: new Map([
          [client.id, [tokenGenStatesConsumerClient]],
        ]),
        clientsById,
        purposesById,
        eservicesById,
        agreementsByConsumerIdEserviceId,
        logger: genericLogger,
      });
      expect(clientDifferences).toEqual(expectedDifferencesLength);
    });

    it("should detect differences if the token-generation-states entry is incomplete", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      const eservicesById = new Map([[eservice.id, eservice]]);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice.id,
      };
      const purposesById = new Map([[purpose.id, purpose]]);
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
      const agreementsByConsumerIdEserviceId = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose.consumerId,
            eserviceId: eservice.id,
          }),
          [agreement],
        ],
      ]);
      await addOneAgreement(agreement);

      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id],
        consumerId: purpose.consumerId,
        keys: [getMockKey()],
      };
      const clientsById = new Map([[client.id, client]]);

      await addOneClient(client);

      // token-generation-states
      const tokenGenStatesClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: client.keys[0].kid,
          purposeId: purpose.id,
        });
      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          PK: tokenGenStatesClientKidPurposePK,
          consumerId: client.consumerId,
          GSIPK_clientId: client.id,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: client.keys[0].kid,
          }),
          clientKind: clientKindTokenGenStates.consumer,
          publicKey: client.keys[0].encodedPem,
          updatedAt: new Date().toISOString(),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      const expectedDifferencesLength = 1;
      const clientDifferences = await compareReadModelClientsAndTokenGenStates({
        tokenGenStatesByClient: new Map([
          [client.id, [tokenGenStatesConsumerClient]],
        ]),
        clientsById,
        purposesById,
        eservicesById,
        agreementsByConsumerIdEserviceId,
        logger: genericLogger,
      });
      expect(clientDifferences).toEqual(expectedDifferencesLength);
    });

    it("should not detect differences if the purpose state in the token-generation-states is inactive and the purpose is missing in the read model", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      const eservicesById = new Map([[eservice.id, eservice]]);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...getMockPurpose([
          getMockPurposeVersion(purposeVersionState.waitingForApproval),
        ]),
        eserviceId: eservice.id,
      };
      const purposesById = new Map();

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
      const agreementsByConsumerIdEserviceId = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose.consumerId,
            eserviceId: eservice.id,
          }),
          [agreement],
        ],
      ]);
      await addOneAgreement(agreement);

      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id],
        consumerId: purpose.consumerId,
        keys: [getMockKey()],
      };
      const clientsById = new Map([[client.id, client]]);
      await addOneClient(client);

      // token-generation-states
      const tokenGenStatesClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: client.keys[0].kid,
          purposeId: purpose.id,
        });
      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          PK: tokenGenStatesClientKidPurposePK,
          consumerId: client.consumerId,
          GSIPK_clientId: client.id,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: client.keys[0].kid,
          }),
          clientKind: clientKindTokenGenStates.consumer,
          publicKey: client.keys[0].encodedPem,
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose.id,
          }),
          GSIPK_purposeId: purpose.id,
          purposeState: itemState.inactive,
          purposeVersionId: purpose.versions[0].id,
          agreementId: agreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId: agreement.consumerId,
            eserviceId: agreement.eserviceId,
          }),
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: eservice.descriptors[0].id,
          }),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          updatedAt: new Date().toISOString(),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      const expectedDifferencesLength = 0;
      const clientDifferences = await compareReadModelClientsAndTokenGenStates({
        tokenGenStatesByClient: new Map([
          [client.id, [tokenGenStatesConsumerClient]],
        ]),
        clientsById,
        purposesById,
        eservicesById,
        agreementsByConsumerIdEserviceId,
        logger: genericLogger,
      });
      expect(clientDifferences).toEqual(expectedDifferencesLength);
    });

    it("should detect differences if the purpose state in the token-generation-state entry is active and the purpose is missing in the read model", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      const eservicesById = new Map([[eservice.id, eservice]]);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice.id,
      };
      const purposesById = new Map();

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
      const agreementsByConsumerIdEserviceId = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose.consumerId,
            eserviceId: eservice.id,
          }),
          [agreement],
        ],
      ]);
      await addOneAgreement(agreement);

      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id],
        consumerId: purpose.consumerId,
        keys: [getMockKey()],
      };
      const clientsById = new Map([[client.id, client]]);
      await addOneClient(client);

      // token-generation-states
      const tokenGenStatesClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: client.keys[0].kid,
          purposeId: purpose.id,
        });
      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          PK: tokenGenStatesClientKidPurposePK,
          consumerId: client.consumerId,
          GSIPK_clientId: client.id,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: client.keys[0].kid,
          }),
          clientKind: clientKindTokenGenStates.consumer,
          publicKey: client.keys[0].encodedPem,
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId: purpose.id,
          }),
          GSIPK_purposeId: purpose.id,
          purposeState: itemState.active,
          purposeVersionId: purpose.versions[0].id,
          agreementId: agreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId: agreement.consumerId,
            eserviceId: agreement.eserviceId,
          }),
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: eservice.descriptors[0].id,
          }),
          descriptorState: itemState.active,
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          updatedAt: new Date().toISOString(),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      const expectedDifferencesLength = 1;
      const clientDifferences = await compareReadModelClientsAndTokenGenStates({
        tokenGenStatesByClient: new Map([
          [client.id, [tokenGenStatesConsumerClient]],
        ]),
        clientsById,
        purposesById,
        eservicesById,
        agreementsByConsumerIdEserviceId,
        logger: genericLogger,
      });
      expect(clientDifferences).toEqual(expectedDifferencesLength);
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
      const eservicesById = new Map([[eservice.id, eservice]]);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice.id,
      };
      const purposesById = new Map([[purpose.id, purpose]]);
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
      const agreementsByConsumerIdEserviceId = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose.consumerId,
            eserviceId: eservice.id,
          }),
          [agreement],
        ],
      ]);
      await addOneAgreement(agreement);

      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id],
        consumerId: purpose.consumerId,
        keys: [getMockKey()],
      };
      const clientsById = new Map([[client.id, client]]);

      await addOneClient(client);

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
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: client.keys[0].kid,
          }),
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
        tokenGenStatesByClient: new Map([
          [client.id, [tokenGenStatesConsumerClient]],
        ]),
        clientsById,
        purposesById,
        eservicesById,
        agreementsByConsumerIdEserviceId,
        logger: genericLogger,
      });
      expect(clientDifferences).toEqual(expectedDifferencesLength);
    });

    it("should detect differences if the token-generation-states entry has a CLIENTKIDPURPOSE PK but should have a CLIENTKID PK", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      const eservicesById = new Map([[eservice.id, eservice]]);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice.id,
      };
      const purposesById = new Map([[purpose.id, purpose]]);
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
      const agreementsByConsumerIdEserviceId = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose.consumerId,
            eserviceId: eservice.id,
          }),
          [agreement],
        ],
      ]);
      await addOneAgreement(agreement);

      const client: Client = {
        ...getMockClient(),
        purposes: [],
        consumerId: purpose.consumerId,
        keys: [getMockKey()],
      };
      const clientsById = new Map([[client.id, client]]);

      await addOneClient(client);

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
          consumerId: client.consumerId,
          GSIPK_clientId: client.id,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: client.keys[0].kid,
          }),
          clientKind: clientKindTokenGenStates.consumer,
          publicKey: client.keys[0].encodedPem,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      const expectedDifferencesLength = 1;
      const clientDifferences = await compareReadModelClientsAndTokenGenStates({
        tokenGenStatesByClient: new Map([
          [client.id, [tokenGenStatesConsumerClient]],
        ]),
        clientsById,
        purposesById,
        eservicesById,
        agreementsByConsumerIdEserviceId,
        logger: genericLogger,
      });
      expect(clientDifferences).toEqual(expectedDifferencesLength);
    });

    it("should detect differences if the token-generation-states has entries but should have zero", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      const eservicesById = new Map([[eservice.id, eservice]]);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice.id,
      };
      const purposesById = new Map([[purpose.id, purpose]]);
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
      const agreementsByConsumerIdEserviceId = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose.consumerId,
            eserviceId: eservice.id,
          }),
          [agreement],
        ],
      ]);
      await addOneAgreement(agreement);

      const client: Client = {
        ...getMockClient(),
        purposes: [],
        consumerId: purpose.consumerId,
        keys: [],
      };
      const clientsById = new Map([[client.id, client]]);

      await addOneClient(client);

      // token-generation-states
      const mockKey = getMockKey();
      const tokenGenStatesClientKidPurposePK =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: mockKey.kid,
          purposeId: purpose.id,
        });
      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(
            tokenGenStatesClientKidPurposePK
          ),
          consumerId: client.consumerId,
          GSIPK_clientId: client.id,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: mockKey.kid,
          }),
          clientKind: clientKindTokenGenStates.consumer,
          publicKey: mockKey.encodedPem,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );

      const expectedDifferencesLength = 1;
      const clientDifferences = await compareReadModelClientsAndTokenGenStates({
        tokenGenStatesByClient: new Map([
          [client.id, [tokenGenStatesConsumerClient]],
        ]),
        clientsById,
        purposesById,
        eservicesById,
        agreementsByConsumerIdEserviceId,
        logger: genericLogger,
      });
      expect(clientDifferences).toEqual(expectedDifferencesLength);
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
      const eservicesById = new Map([[eservice.id, eservice]]);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice.id,
      };
      const purposesById = new Map([[purpose.id, purpose]]);
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
      const agreementsByConsumerIdEserviceId = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose.consumerId,
            eserviceId: eservice.id,
          }),
          [agreement],
        ],
      ]);
      await addOneAgreement(agreement);

      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id],
        consumerId: purpose.consumerId,
        keys: [getMockKey()],
      };
      const clientsById = new Map([[client.id, client]]);

      await addOneClient(client);

      const expectedDifferencesLength = 1;
      const clientDifferences = await compareReadModelClientsAndTokenGenStates({
        tokenGenStatesByClient: new Map(),
        clientsById,
        purposesById,
        eservicesById,
        agreementsByConsumerIdEserviceId,
        logger: genericLogger,
      });
      expect(clientDifferences).toEqual(expectedDifferencesLength);
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
      const eservicesById = new Map([[eservice.id, eservice]]);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice.id,
      };
      const purposesById = new Map([[purpose.id, purpose]]);
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
      const agreementsByConsumerIdEserviceId = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose.consumerId,
            eserviceId: eservice.id,
          }),
          [agreement],
        ],
      ]);
      await addOneAgreement(agreement);

      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id, generateId()],
        consumerId: purpose.consumerId,
      };
      const clientsById = new Map([[client.id, client]]);
      await addOneClient(client);

      const expectedDifferencesLength = 0;
      const clientDifferences = await compareReadModelClientsAndTokenGenStates({
        tokenGenStatesByClient: new Map(),
        clientsById,
        purposesById,
        eservicesById,
        agreementsByConsumerIdEserviceId,
        logger: genericLogger,
      });
      expect(clientDifferences).toEqual(expectedDifferencesLength);
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
      const eservicesById = new Map([[eservice.id, eservice]]);
      await addOneEService(eservice);

      const purpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
        eserviceId: eservice.id,
      };
      const purposesById = new Map([[purpose.id, purpose]]);
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
      const agreementsByConsumerIdEserviceId = new Map([
        [
          makeGSIPKConsumerIdEServiceId({
            consumerId: purpose.consumerId,
            eserviceId: eservice.id,
          }),
          [agreement],
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
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: client.keys[0].kid,
          }),
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
        tokenGenStatesByClient: new Map([
          [client.id, [tokenGenStatesConsumerClient]],
        ]),
        clientsById: new Map(),
        purposesById,
        eservicesById,
        agreementsByConsumerIdEserviceId,
        logger: genericLogger,
      });
      expect(clientDifferences).toEqual(expectedDifferencesLength);
    });
  });
});
