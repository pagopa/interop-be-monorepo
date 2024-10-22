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
} from "pagopa-interop-commons-test";
import {
  Agreement,
  agreementState,
  Descriptor,
  descriptorState,
  generateId,
  itemState,
  makeGSIPKConsumerIdEServiceId,
  makePlatformStatesAgreementPK,
  makePlatformStatesClientPK,
  makePlatformStatesEServiceDescriptorPK,
  makePlatformStatesPurposePK,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesPurposeEntry,
  purposeVersionState,
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
  main,
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

      await expect(main(dynamoDBClient)).resolves.not.toThrowError();
    });

    it("read model purpose missing", async () => {
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);

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

      await expect(main(dynamoDBClient)).rejects.toThrowError();
    });

    it("platform-states entry missing with read model purpose not archived", async () => {
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.active),
      ]);
      await addOnePurpose(purpose);

      await expect(main(dynamoDBClient)).rejects.toThrowError();
    });

    it("platform-states entry missing with read model purpose archived", async () => {
      const purpose = getMockPurpose([
        getMockPurposeVersion(purposeVersionState.archived),
      ]);
      await addOnePurpose(purpose);

      await expect(main(dynamoDBClient)).resolves.not.toThrowError();
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

      await expect(main(dynamoDBClient)).resolves.not.toThrowError();
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

      await expect(main(dynamoDBClient)).rejects.toThrowError();
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

      await expect(main(dynamoDBClient)).rejects.toThrowError();
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

      await expect(main(dynamoDBClient)).resolves.not.toThrowError();
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

      await expect(main(dynamoDBClient)).resolves.not.toThrowError();
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

      await expect(main(dynamoDBClient)).rejects.toThrowError();
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

      await expect(main(dynamoDBClient)).rejects.toThrowError();
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

      await expect(main(dynamoDBClient)).resolves.not.toThrowError();
    });
  });

  describe("client", () => {
    it("same states", async () => {
      const client = {
        ...getMockClient(),
        purposes: [getMockPurpose().id],
      };
      await addOneClient(client);

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

      await expect(main(dynamoDBClient)).resolves.not.toThrowError();
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

      await expect(main(dynamoDBClient)).rejects.toThrowError();
    });

    it.skip("platform-states entry missing with read model eservice not archived", async () => {
      const client = {
        ...getMockClient(),
        purposes: [getMockPurpose().id],
      };
      await addOneClient(client);

      await expect(main(dynamoDBClient)).rejects.toThrowError();
    });

    it.skip("platform-states entry missing with read model purpose archived", async () => {
      const client = {
        ...getMockClient(),
        purposes: [getMockPurpose().id],
      };
      await addOneClient(client);

      await expect(main(dynamoDBClient)).resolves.not.toThrowError();
    });
  });
});

/*
readmodel c'è e token readmodel no -> solo se archived
readmodel non c'è e token readmodel sì -> impossibile
readmodel c'è e token readmodel sì -> stati sono uguali -> OK
-> stati diversi -> NOT OK
*/
