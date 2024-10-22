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
  purposeVersionState,
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
import {
  clientKindToTokenGenerationStatesClientKind,
  compareTokenGenerationReadModel,
} from "../src/utils/utils.js";
import {
  addOneAgreement,
  addOneClient,
  addOneEService,
  addOnePurpose,
  config,
  writeClientEntry,
} from "./utils.js";

describe("sample", () => {
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
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose);

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
      const clientId = generateId<ClientId>();
      const tokenStateEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId,
        kid: `kid ${Math.random()}`,
        purposeId: purpose.id,
      });
      const tokenStateEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK),
        GSIPK_purposeId: purpose.id,
        purposeState: itemState.active,
        purposeVersionId: purpose.versions[0].id,
        consumerId: purpose.consumerId,
        GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
          clientId,
          purposeId: purpose.id,
        }),
      };
      await writeTokenStateEntry(tokenStateEntry, dynamoDBClient);

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
      const tokenStateEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: purpose.id,
      });
      const tokenStateEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK),
        GSIPK_purposeId: purpose.id,
        purposeState: itemState.active,
        purposeVersionId: purpose.versions[0].id,
        consumerId: purpose.consumerId,
      };
      await writeTokenStateEntry(tokenStateEntry, dynamoDBClient);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).rejects.toThrowError();
    });

    it("platform-states entry missing with read model purpose not archived", async () => {
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).rejects.toThrowError();
    });

    it("platform-states entry missing with read model purpose archived", async () => {
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.archived),
      ]);
      await addOnePurpose(purpose);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).resolves.not.toThrowError();
    });
  });

  describe("agreement", () => {
    it("same states", async () => {
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

      // token-generation-states
      const tokenStateEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const tokenStateEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK),
        consumerId: agreement.consumerId,
        agreementId: agreement.id,
        agreementState: itemState.active,
        GSIPK_consumerId_eserviceId,
      };
      await writeTokenStateEntry(tokenStateEntry, dynamoDBClient);

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

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).rejects.toThrowError();
    });

    it("platform-states entry missing with read model agreement not archived", async () => {
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

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).resolves.not.toThrowError();
    });
  });

  describe("catalog", () => {
    it("same states", async () => {
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

      // token-generation-states
      const tokenStateEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const tokenStateEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK),
        // TODO: where's this
        // consumerId: descriptor.
        descriptorState: itemState.active,
        descriptorAudience: descriptor.audience,
        GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
        }),
      };
      await writeTokenStateEntry(tokenStateEntry, dynamoDBClient);

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

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).rejects.toThrowError();
    });

    it("platform-states entry missing with read model descriptor not archived", async () => {
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

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).resolves.not.toThrowError();
    });
  });

  describe("client", () => {
    it("same states", async () => {
      const purpose = getMockPurpose();
      const client: Client = {
        ...getMockClient(),
        purposes: [purpose.id, generateId()],
        consumerId: purpose.consumerId,
        keys: [getMockKey()],
      };
      await addOneClient(client);

      // platform-states
      const catalogEntryPrimaryKey = makePlatformStatesClientPK(client.id);
      const platformClientEntry: PlatformStatesClientEntry = {
        PK: catalogEntryPrimaryKey,
        state: itemState.active,
        clientKind: clientKindToTokenGenerationStatesClientKind(client.kind),
        clientConsumerId: client.consumerId,
        clientPurposesIds: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeClientEntry(platformClientEntry, dynamoDBClient);

      // token-generation-states
      const tokenStateEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: client.id,
        kid: client.keys[0].kid,
        purposeId: purpose.id,
      });
      const tokenStateEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK),
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
      await writeTokenStateEntry(tokenStateEntry, dynamoDBClient);

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).resolves.not.toThrowError();
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

      await expect(
        compareTokenGenerationReadModel(dynamoDBClient)
      ).rejects.toThrowError();
    });

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
readmodel c'è e token readmodel no -> solo se archived
readmodel non c'è e token readmodel sì -> impossibile
readmodel c'è e token readmodel sì -> stati sono uguali -> OK
-> stati diversi -> NOT OK
*/
