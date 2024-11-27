import crypto from "crypto";
import { fail } from "assert";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockAgreement,
  getMockClient,
  getMockDescriptor,
  getMockEService,
  getMockKey,
  getMockPlatformStatesClientEntry,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTokenStatesClientPurposeEntry,
  writeCatalogEntry,
  writeTokenStateEntry,
} from "pagopa-interop-commons-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  purposeVersionState,
  makePlatformStatesPurposePK,
  PlatformStatesPurposeEntry,
  itemState,
  ClientId,
  generateId,
  makeGSIPKClientIdPurposeId,
  makeTokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesClientPurposeEntry,
  Agreement,
  agreementState,
  makeGSIPKConsumerIdEServiceId,
  makePlatformStatesAgreementPK,
  PlatformStatesAgreementEntry,
  Descriptor,
  descriptorState,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  PlatformStatesCatalogEntry,
  Client,
  makeGSIPKKid,
  makePlatformStatesClientPK,
  PlatformStatesClientEntry,
  clientKindTokenStates,
  PurposeVersion,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  clientKindToTokenGenerationStatesClientKind,
  compareReadModelAgreementsWithTokenGenReadModel,
  compareReadModelClientsWithTokenGenReadModel,
  compareReadModelEServicesWithTokenGenReadModel,
  compareReadModelPurposesWithTokenGenReadModel,
  countAgreementDifferences,
  countCatalogDifferences,
  countClientDifferences,
  countPurposeDifferences,
  getLastEServiceDescriptor,
  getLastPurposeVersion,
} from "../src/utils/utils.js";
import {
  ComparisonPlatformStatesPurposeEntry,
  PurposeDifferencesResult,
  ComparisonPurpose,
  AgreementDifferencesResult,
  ComparisonPlatformStatesAgreementEntry,
  ComparisonTokenStatesAgreementEntry,
  ComparisonAgreement,
  CatalogDifferencesResult,
  ComparisonPlatformStatesCatalogEntry,
  ComparisonTokenStatesCatalogEntry,
  ComparisonEService,
  ClientDifferencesResult,
  ComparisonTokenStatesClientEntry,
  ComparisonClient,
  ComparisonPlatformStatesClientEntry,
} from "../src/models/types.js";
import { tokenGenerationReadModelServiceBuilder } from "../src/services/tokenGenerationReadModelService.js";
import {
  addOneAgreement,
  addOneClient,
  addOneEService,
  addOnePurpose,
  config,
  writeClientEntry,
} from "./utils.js";

describe("Token Generation Read Model Checker Verifier utils tests", () => {
  if (!config) {
    fail();
  }
  const dynamoDBClient = new DynamoDBClient({
    endpoint: `http://localhost:${config.tokenGenerationReadModelDbPort}`,
  });
  const tokenGenerationService =
    tokenGenerationReadModelServiceBuilder(dynamoDBClient);

  beforeEach(async () => {
    await buildDynamoDBTables(dynamoDBClient);
  });
  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
  });

  describe("purpose utils", () => {
    it("compareReadModelPurposesWithPlatformStates", async () => {
      const purpose1 = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose1);

      const purpose2 = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose2);

      // platform-states
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

      const differences = await compareReadModelPurposesWithTokenGenReadModel({
        platformStatesEntries: [platformPurposeEntry1, platformPurposeEntry2],
        tokenGenerationStatesEntries: [tokenStatesEntry],
        purposes: [purpose1, purpose2],
      });
      const expectedDifferences: PurposeDifferencesResult = [
        [
          ComparisonPlatformStatesPurposeEntry.parse(platformPurposeEntry2),
          undefined,
          ComparisonPurpose.parse(purpose2),
        ],
      ];

      expect(differences).toHaveLength(1);
      expect(differences).toEqual(expect.arrayContaining(expectedDifferences));
    });

    it("countPurposeDifferences", async () => {
      const purpose1 = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);

      const purpose2 = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);

      // platform-states
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

      expect(
        countPurposeDifferences(
          [
            [platformPurposeEntry1, [tokenStatesEntry], purpose1],
            [platformPurposeEntry2, [], purpose2],
          ],
          genericLogger
        )
      ).toEqual(2);
    });
  });

  describe("agreement utils", () => {
    it("compareReadModelAgreementsWithPlatformStates", async () => {
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

      const differences = await compareReadModelAgreementsWithTokenGenReadModel(
        {
          platformStatesEntries: [
            platformAgreementEntry1,
            platformAgreementEntry2,
          ],
          tokenGenerationStatesEntries: [tokenStatesEntry],
          agreements: [agreement1, agreement2],
        }
      );
      const expectedDifferences: AgreementDifferencesResult = [
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

      expect(differences).toHaveLength(2);
      expect(differences).toEqual(expect.arrayContaining(expectedDifferences));
    });

    it("countAgreementDifferences", async () => {
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

      expect(
        countAgreementDifferences(
          [
            [platformAgreementEntry1, [tokenStatesEntry], agreement1],
            [platformAgreementEntry2, [], agreement2],
          ],
          genericLogger
        )
      ).toEqual(2);
    });
  });

  describe("catalog utils", () => {
    it("compareReadModelEServicesWithPlatformStates", async () => {
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

      // token-generation-states
      const tokenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK),
        descriptorState: itemState.inactive,
        descriptorAudience: descriptor1.audience,
        GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice1.id,
          descriptorId: descriptor1.id,
        }),
      };

      const differences = await compareReadModelEServicesWithTokenGenReadModel({
        platformStatesEntries: [platformCatalogEntry1, platformCatalogEntry2],
        tokenGenerationStatesEntries: [tokenStatesEntry],
        eservices: [eservice1, eservice2],
      });
      const expectedDifferences: CatalogDifferencesResult = [
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
      expect(differences).toHaveLength(2);
      expect(differences).toEqual(expect.arrayContaining(expectedDifferences));
    });

    it("countCatalogDifferences", async () => {
      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice1 = {
        ...getMockEService(),
        descriptors: [descriptor1],
      };

      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        audience: ["pagopa.it"],
      };
      const eservice2 = {
        ...getMockEService(),
        descriptors: [descriptor2],
      };

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
      };

      expect(
        countCatalogDifferences(
          [
            [platformCatalogEntry1, [tokenStatesEntry], eservice1],
            [platformCatalogEntry2, [], eservice2],
          ],
          genericLogger
        )
      ).toEqual(2);
    });
  });

  describe("client utils", () => {
    it("compareReadModelClientsWithPlatformStates", async () => {
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
        clientKind: clientKindTokenStates.api,
        publicKey: client1.keys[0].encodedPem,
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId: client1.id,
          purposeId: purpose1.id,
        }),
      };

      const differences = await compareReadModelClientsWithTokenGenReadModel({
        platformStatesEntries: [platformClientEntry1, platformClientEntry2],
        tokenGenerationStatesEntries: [tokenStatesEntry],
        clients: [client1, client2],
      });
      const expectedDifferences: ClientDifferencesResult = [
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

      expect(differences).toHaveLength(2);
      expect(differences).toEqual(expect.arrayContaining(expectedDifferences));
    });

    it("countClientDifferences", async () => {
      const purpose1 = getMockPurpose();
      const client1: Client = {
        ...getMockClient(),
        purposes: [purpose1.id, generateId()],
        consumerId: purpose1.consumerId,
        keys: [getMockKey()],
      };

      const purpose2 = getMockPurpose();
      const client2: Client = {
        ...getMockClient(),
        purposes: [purpose2.id, generateId()],
        consumerId: purpose2.consumerId,
        keys: [getMockKey()],
      };

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

      expect(
        countClientDifferences(
          [
            [platformClientEntry1, [tokenStatesEntry], client1],
            [platformClientEntry2, [], client2],
          ],
          genericLogger
        )
      ).toEqual(2);
    });
  });

  describe("readAllTokenGenerationStatesItems", () => {
    it("no need for pagination", async () => {
      const tokenEntriesLength = 2;

      const tokenStatesEntry1 = getMockTokenStatesClientPurposeEntry();
      await writeTokenStateEntry(tokenStatesEntry1, dynamoDBClient);

      const tokenStatesEntry2: TokenGenerationStatesClientPurposeEntry =
        getMockTokenStatesClientPurposeEntry();
      await writeTokenStateEntry(tokenStatesEntry2, dynamoDBClient);

      vi.spyOn(dynamoDBClient, "send");
      const tokenEntries =
        await tokenGenerationService.readAllTokenGenerationStatesItems();

      expect(dynamoDBClient.send).toHaveBeenCalledTimes(1);
      expect(tokenEntries).toHaveLength(tokenEntriesLength);
      expect(tokenEntries).toEqual(
        expect.arrayContaining([tokenStatesEntry1, tokenStatesEntry2])
      );
    });

    it("with pagination", async () => {
      const tokenEntriesLength = 10;

      const writtenEntries: TokenGenerationStatesClientPurposeEntry[] = [];
      // eslint-disable-next-line functional/no-let
      for (let i = 0; i < tokenEntriesLength; i++) {
        const tokenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const tokenStatesEntry: TokenGenerationStatesClientPurposeEntry = {
          ...getMockTokenStatesClientPurposeEntry(tokenStatesEntryPK),
          publicKey: crypto.randomBytes(100000).toString("hex"),
        };
        await writeTokenStateEntry(tokenStatesEntry, dynamoDBClient);
        // eslint-disable-next-line functional/immutable-data
        writtenEntries.push(tokenStatesEntry);
      }
      vi.spyOn(dynamoDBClient, "send");
      const tokenEntries =
        await tokenGenerationService.readAllTokenGenerationStatesItems();

      expect(dynamoDBClient.send).toHaveBeenCalledTimes(2);
      expect(tokenEntries).toHaveLength(tokenEntriesLength);
      expect(tokenEntries).toEqual(expect.arrayContaining(writtenEntries));
    });
  });

  describe("readAllPlatformStatesItems", () => {
    it("no need for pagination", async () => {
      const platformStatesEntriesLength = 2;

      const platformStatesEntry1 = getMockPlatformStatesClientEntry();
      await writeClientEntry(platformStatesEntry1, dynamoDBClient);

      const platformStatesEntry2 = getMockPlatformStatesClientEntry();
      await writeClientEntry(platformStatesEntry2, dynamoDBClient);

      vi.spyOn(dynamoDBClient, "send");
      const platformStatesEntries =
        await tokenGenerationService.readAllPlatformStatesItems();

      expect(dynamoDBClient.send).toHaveBeenCalledTimes(1);
      expect(platformStatesEntries).toHaveLength(platformStatesEntriesLength);
      expect(platformStatesEntries).toEqual(
        expect.arrayContaining([platformStatesEntry1, platformStatesEntry2])
      );
    });

    it("with pagination", async () => {
      const platformStatesEntriesLength = 10;

      const writtenEntries: PlatformStatesCatalogEntry[] = [];
      // eslint-disable-next-line functional/no-let
      for (let i = 0; i < platformStatesEntriesLength; i++) {
        const platformStatesEntry: PlatformStatesCatalogEntry = {
          PK: makePlatformStatesEServiceDescriptorPK({
            eserviceId: generateId(),
            descriptorId: generateId(),
          }),
          state: itemState.active,
          descriptorAudience: [crypto.randomBytes(100000).toString("hex")],
          descriptorVoucherLifespan: 60,
          version: 1,
          updatedAt: new Date().toISOString(),
        };
        await writeCatalogEntry(platformStatesEntry, dynamoDBClient);
        // eslint-disable-next-line functional/immutable-data
        writtenEntries.push(platformStatesEntry);
      }
      vi.spyOn(dynamoDBClient, "send");
      const platformStatesEntries =
        await tokenGenerationService.readAllPlatformStatesItems();

      expect(dynamoDBClient.send).toHaveBeenCalledTimes(2);
      expect(platformStatesEntries).toHaveLength(platformStatesEntriesLength);
      expect(platformStatesEntries).toEqual(
        expect.arrayContaining(writtenEntries)
      );
    });
  });

  it("getLastPurposeVersion", () => {
    const date1 = new Date();
    const date2 = new Date();
    date2.setDate(date1.getDate() + 1);
    const purposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      createdAt: date1,
    };
    const purposeVersion2: PurposeVersion = {
      ...getMockPurposeVersion(),
      createdAt: date2,
    };

    expect(getLastPurposeVersion([purposeVersion1, purposeVersion2])).toEqual(
      purposeVersion2
    );
  });

  it("getLastEServiceDescriptor", () => {
    const date1 = new Date();
    const date2 = new Date();
    date2.setDate(date1.getDate() + 1);
    const descriptor1: Descriptor = {
      ...getMockDescriptor(),
      createdAt: date1,
    };
    const descriptor2: Descriptor = {
      ...getMockDescriptor(),
      createdAt: date2,
    };

    expect(getLastEServiceDescriptor([descriptor1, descriptor2])).toEqual(
      descriptor2
    );
  });
});
