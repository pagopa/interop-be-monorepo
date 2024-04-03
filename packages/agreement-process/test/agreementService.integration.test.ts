/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { fail } from "assert";
import {
  AgreementCollection,
  EServiceCollection,
  FileManager,
  ReadModelRepository,
  TenantCollection,
  initDB,
  initFileManager,
  logger,
} from "pagopa-interop-commons";
import {
  buildAgreement,
  buildCertifiedTenantAttribute,
  buildDeclaredTenantAttribute,
  buildDescriptorPublished,
  buildEService,
  buildEServiceAttribute,
  buildTenant,
  expectPastTimestamp,
  getRandomAuthData,
  randomArrayItem,
  StoredEvent,
  TEST_MONGO_DB_PORT,
  TEST_POSTGRES_DB_PORT,
  mongoDBContainer,
  postgreSQLContainer,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementAddedV1,
  AgreementAttribute,
  AgreementId,
  AgreementV1,
  AttributeId,
  Descriptor,
  DescriptorId,
  EService,
  EServiceAttribute,
  EServiceId,
  Tenant,
  TenantAttribute,
  TenantId,
  agreementState,
  descriptorState,
  generateId,
  protobufDecoder,
  unsafeBrandId,
} from "pagopa-interop-models";
import { IDatabase } from "pg-promise";
import { StartedTestContainer } from "testcontainers";
import {
  afterAll,
  afterEach,
  beforeEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import { v4 as uuidv4 } from "uuid";
import {
  agreementAlreadyExists,
  agreementNotFound,
  descriptorNotInExpectedState,
  eServiceNotFound,
  missingCertifiedAttributesError,
  notLatestEServiceDescriptor,
  tenantIdNotFound,
} from "../src/model/domain/errors.js";
import { toAgreementStateV1 } from "../src/model/domain/toEvent.js";
import { ApiAgreementPayload } from "../src/model/types.js";
import {
  AgreementService,
  agreementServiceBuilder,
} from "../src/services/agreementService.js";
import { agreementQueryBuilder } from "../src/services/readmodel/agreementQuery.js";
import { attributeQueryBuilder } from "../src/services/readmodel/attributeQuery.js";
import { eserviceQueryBuilder } from "../src/services/readmodel/eserviceQuery.js";
import { readModelServiceBuilder } from "../src/services/readmodel/readModelService.js";
import { tenantQueryBuilder } from "../src/services/readmodel/tenantQuery.js";
import { config } from "../src/utilities/config.js";
import { agreementCreationConflictingStates } from "../src/model/domain/validators.js";
import {
  CompactEService,
  CompactOrganization,
} from "../src/model/domain/models.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readLastAgreementEvent,
} from "./utils.js";

let agreements: AgreementCollection;
let eservices: EServiceCollection;
let tenants: TenantCollection;
let readModelService;
let agreementService: AgreementService;
let postgresDB: IDatabase<unknown>;
let startedPostgreSqlContainer: StartedTestContainer;
let startedMongodbContainer: StartedTestContainer;
let fileManager: FileManager;

/**
 * Executes the generic agreement expectation for agreement creation process,
 * and return the created AgreementV1 object to be used for further checks.
 *
 * @param agreementId - The ID of the agreement.
 * @param expectedEserviceId - The expected e-service ID of the agreement.
 * @param expectedDescriptorId - The expected descriptor ID of the agreement.
 * @param expectedProducerId - The expected producer ID of the agreement.
 * @param expectedConsumerId - The expected consumer ID of the agreement.
 * @returns A Promise that resolves return the created AgreementV1 object.
 */
const expectedAgreementCreation = async (
  agreementId: AgreementId | undefined,
  expectedEserviceId: EServiceId,
  expectedDescriptorId: DescriptorId,
  expectedProducerId: TenantId,
  expectedConsumerId: TenantId
): Promise<AgreementV1> => {
  expect(agreementId).toBeDefined();
  if (!agreementId) {
    fail("Unhandled error: returned agreementId is undefined");
  }

  const actualAgreementData: StoredEvent | undefined =
    await readLastAgreementEvent(agreementId, postgresDB);

  if (!actualAgreementData) {
    fail("Creation fails: agreement not found in event-store");
  }

  expect(actualAgreementData).toMatchObject({
    type: "AgreementAdded",
    event_version: 1,
    version: "0",
    stream_id: agreementId,
  });

  const actualAgreement: AgreementV1 | undefined = protobufDecoder(
    AgreementAddedV1
  ).parse(actualAgreementData.data)?.agreement;

  if (!actualAgreement) {
    fail("impossible to decode AgreementAddedV1 data");
  }

  expect(actualAgreement.contract).toBeUndefined();
  expect(actualAgreement).property("createdAt").satisfy(expectPastTimestamp);

  expect(actualAgreement).toMatchObject({
    id: agreementId,
    eserviceId: expectedEserviceId,
    descriptorId: expectedDescriptorId,
    producerId: expectedProducerId,
    consumerId: expectedConsumerId,
    state: toAgreementStateV1(agreementState.draft),
    verifiedAttributes: [],
    certifiedAttributes: [],
    declaredAttributes: [],
    consumerDocuments: [],
    stamps: {},
    createdAt: expect.any(BigInt),
  });

  return actualAgreement;
};

beforeAll(async () => {
  startedPostgreSqlContainer = await postgreSQLContainer(config).start();
  startedMongodbContainer = await mongoDBContainer(config).start();

  config.eventStoreDbPort = startedPostgreSqlContainer.getMappedPort(
    TEST_POSTGRES_DB_PORT
  );
  config.readModelDbPort =
    startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);

  const readModelRepository = ReadModelRepository.init(config);
  agreements = readModelRepository.agreements;
  eservices = readModelRepository.eservices;
  tenants = readModelRepository.tenants;

  readModelService = readModelServiceBuilder(readModelRepository);
  const eserviceQuery = eserviceQueryBuilder(readModelService);
  const agreementQuery = agreementQueryBuilder(readModelService);
  const tenantQuery = tenantQueryBuilder(readModelService);
  const attributeQuery = attributeQueryBuilder(readModelService);

  postgresDB = initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  });

  if (!postgresDB) {
    logger.error("postgresDB is undefined!!");
  }

  // TODO: Setup MinIO test container when testing functionalities that require file storage
  fileManager = initFileManager(config);
  agreementService = agreementServiceBuilder(
    postgresDB,
    agreementQuery,
    tenantQuery,
    eserviceQuery,
    attributeQuery,
    fileManager
  );
});

afterEach(async () => {
  await agreements.deleteMany({});
  await eservices.deleteMany({});
  await tenants.deleteMany({});

  await postgresDB.none("TRUNCATE TABLE agreement.events RESTART IDENTITY");
  await postgresDB.none("TRUNCATE TABLE catalog.events RESTART IDENTITY");
});

afterAll(async () => {
  await startedPostgreSqlContainer.stop();
  await startedMongodbContainer.stop();
});

describe("Agreement service", () => {
  describe("create agreement", () => {
    it("should succeed when EService Producer and Agreement Consumer are the same, even on unmet attributes", async () => {
      const authData = getRandomAuthData();
      const eserviceId = generateId<EServiceId>();
      const descriptorId = generateId<DescriptorId>();
      const attributeId = generateId<AttributeId>();

      const descriptor = buildDescriptorPublished(descriptorId, [
        [buildEServiceAttribute(attributeId)],
      ]);
      const eservice = buildEService(eserviceId, authData.organizationId, [
        descriptor,
      ]);
      const tenant = buildTenant(authData.organizationId);

      await addOneEService(eservice, eservices);
      await addOneTenant(tenant, tenants);

      const agreementData: ApiAgreementPayload = {
        eserviceId,
        descriptorId,
      };
      const createdAgreementId = await agreementService.createAgreement(
        agreementData,
        authData,
        uuidv4()
      );

      await expectedAgreementCreation(
        unsafeBrandId<AgreementId>(createdAgreementId),
        eserviceId,
        descriptorId,
        authData.organizationId,
        tenant.id
      );
    });

    it("should succeed when EService producer and Agreement consumer are different Tenants, and the consumer has all Descriptor certified Attributes not revoked", async () => {
      const authData = getRandomAuthData();
      const eserviceProducer: Tenant = buildTenant();

      const certifiedDescriptorAttribute1: EServiceAttribute =
        buildEServiceAttribute();
      const certifiedDescriptorAttribute2: EServiceAttribute =
        buildEServiceAttribute();

      const descriptor = buildDescriptorPublished(generateId<DescriptorId>(), [
        [certifiedDescriptorAttribute1],
        [certifiedDescriptorAttribute2],
      ]);

      const certifiedTenantAttribute1: TenantAttribute = {
        ...buildCertifiedTenantAttribute(certifiedDescriptorAttribute1.id),
        revocationTimestamp: undefined,
      };

      const certifiedTenantAttribute2: TenantAttribute = {
        ...buildCertifiedTenantAttribute(certifiedDescriptorAttribute2.id),
        revocationTimestamp: undefined,
      };

      const consumer = buildTenant(authData.organizationId, [
        buildDeclaredTenantAttribute(),
        certifiedTenantAttribute1,
        certifiedTenantAttribute2,
      ]);

      const eservice = buildEService(
        generateId<EServiceId>(),
        eserviceProducer.id,
        [descriptor]
      );

      await addOneTenant(eserviceProducer, tenants);
      await addOneTenant(consumer, tenants);
      await addOneEService(eservice, eservices);

      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      };

      const createdAgreementId = await agreementService.createAgreement(
        apiAgreementPayload,
        authData,
        uuidv4()
      );

      await expectedAgreementCreation(
        unsafeBrandId<AgreementId>(createdAgreementId),
        eservice.id,
        descriptor.id,
        eserviceProducer.id,
        consumer.id
      );
    });

    it("should succeed when EService producer and Agreement consumer are different Tenants, and the Descriptor has no certified Attributes", async () => {
      const eserviceProducer: Tenant = buildTenant();
      const consumer: Tenant = buildTenant();

      // Descriptor has no certified attributes - no requirements for the consumer
      const descriptor = buildDescriptorPublished();

      const eservice = buildEService(
        generateId<EServiceId>(),
        eserviceProducer.id,
        [descriptor]
      );

      await addOneTenant(eserviceProducer, tenants);
      await addOneTenant(consumer, tenants);
      await addOneEService(eservice, eservices);

      const authData = getRandomAuthData(consumer.id); // different from eserviceProducer
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      };

      const createdAgreementId = await agreementService.createAgreement(
        apiAgreementPayload,
        authData,
        uuidv4()
      );

      await expectedAgreementCreation(
        unsafeBrandId<AgreementId>(createdAgreementId),
        eservice.id,
        descriptor.id,
        eserviceProducer.id,
        consumer.id
      );
    });

    it("should succeed when EService's latest Descriptors are draft, and the latest non-draft Descriptor is published", async () => {
      const tenant: Tenant = buildTenant();

      const descriptor0: Descriptor = buildDescriptorPublished();
      const descriptor1: Descriptor = {
        ...buildDescriptorPublished(),
        version: "1",
        state: descriptorState.draft,
      };

      const descriptor2: Descriptor = {
        ...buildDescriptorPublished(),
        version: "2",
        state: descriptorState.draft,
      };

      const eservice = buildEService(generateId<EServiceId>(), tenant.id, [
        descriptor0,
        descriptor1,
        descriptor2,
      ]);

      await addOneTenant(tenant, tenants);
      await addOneEService(eservice, eservices);

      const authData = getRandomAuthData(tenant.id);
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: descriptor0.id,
      };

      const createdAgreementId = await agreementService.createAgreement(
        apiAgreementPayload,
        authData,
        uuidv4()
      );

      await expectedAgreementCreation(
        unsafeBrandId<AgreementId>(createdAgreementId),
        eservice.id,
        descriptor0.id,
        tenant.id,
        tenant.id
      );
    });

    it("should succeed when Agreements in non-conflicting states exist for the same EService and consumer", async () => {
      const tenant: Tenant = buildTenant();
      const descriptor: Descriptor = buildDescriptorPublished();

      const eservice = buildEService(generateId<EServiceId>(), tenant.id, [
        descriptor,
      ]);

      const otherAgreement = buildAgreement(
        eservice.id,
        tenant.id,
        randomArrayItem(
          Object.values(agreementState).filter(
            (state) => !agreementCreationConflictingStates.includes(state)
          )
        )
      );

      await addOneTenant(tenant, tenants);
      await addOneEService(eservice, eservices);
      await addOneAgreement(otherAgreement, postgresDB, agreements);

      const authData = getRandomAuthData(tenant.id);
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      };

      const createdAgreementId = await agreementService.createAgreement(
        apiAgreementPayload,
        authData,
        uuidv4()
      );

      await expectedAgreementCreation(
        unsafeBrandId<AgreementId>(createdAgreementId),
        eservice.id,
        descriptor.id,
        tenant.id,
        tenant.id
      );
    });

    it("should throw an eServiceNotFound error when the EService does not exist", async () => {
      const authData = getRandomAuthData();
      const eserviceId = generateId<EServiceId>();
      const descriptorId = generateId<DescriptorId>();

      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId,
        descriptorId,
      };

      await expect(
        agreementService.createAgreement(
          apiAgreementPayload,
          authData,
          uuidv4()
        )
      ).rejects.toThrowError(
        eServiceNotFound(unsafeBrandId(apiAgreementPayload.eserviceId))
      );
    });

    it("should throw a notLatestEServiceDescriptor error when the EService has no Descriptor", async () => {
      const authData = getRandomAuthData();
      const eserviceId = generateId<EServiceId>();

      const eservice = buildEService(eserviceId, authData.organizationId, []);

      await addOneEService(eservice, eservices);

      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId,
        descriptorId: generateId<DescriptorId>(),
      };

      await expect(
        agreementService.createAgreement(
          apiAgreementPayload,
          authData,
          uuidv4()
        )
      ).rejects.toThrowError(
        notLatestEServiceDescriptor(
          unsafeBrandId(apiAgreementPayload.descriptorId)
        )
      );
    });

    it("should throw a notLatestEServiceDescriptor error when the EService Descriptor is not the latest non-draft Descriptor", async () => {
      const authData = getRandomAuthData();
      const eserviceId = generateId<EServiceId>();
      const notDraftDescriptorStates = Object.values(descriptorState).filter(
        (state) => state !== descriptorState.draft
      );

      const descriptor0: Descriptor = {
        ...buildDescriptorPublished(),
        version: "0",
        state: randomArrayItem(notDraftDescriptorStates),
      };
      const descriptor1: Descriptor = {
        ...buildDescriptorPublished(),
        version: "1",
        state: randomArrayItem(notDraftDescriptorStates),
      };

      const eservice = buildEService(eserviceId, authData.organizationId, [
        descriptor0,
        descriptor1,
      ]);

      await addOneEService(eservice, eservices);
      await addOneTenant(buildTenant(authData.organizationId), tenants);

      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId,
        descriptorId: descriptor0.id,
      };

      await expect(
        agreementService.createAgreement(
          apiAgreementPayload,
          authData,
          uuidv4()
        )
      ).rejects.toThrowError(
        notLatestEServiceDescriptor(
          unsafeBrandId(apiAgreementPayload.descriptorId)
        )
      );
    });

    it("should throw a descriptorNotInExpectedState error when the EService's latest non-draft Descriptor is not published", async () => {
      const authData = getRandomAuthData();
      const eserviceId = generateId<EServiceId>();

      const descriptor: Descriptor = {
        ...buildDescriptorPublished(),
        version: "0",
        state: randomArrayItem(
          Object.values(descriptorState).filter(
            (state) =>
              state !== descriptorState.published &&
              state !== descriptorState.draft
          )
        ),
      };

      const eservice = buildEService(eserviceId, authData.organizationId, [
        descriptor,
      ]);

      await addOneEService(eservice, eservices);
      await addOneTenant(buildTenant(authData.organizationId), tenants);

      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId,
        descriptorId: descriptor.id,
      };

      await expect(
        agreementService.createAgreement(
          apiAgreementPayload,
          authData,
          uuidv4()
        )
      ).rejects.toThrowError(
        descriptorNotInExpectedState(eservice.id, descriptor.id, [
          descriptorState.published,
        ])
      );
    });

    it("should throw an agreementAlreadyExists error when an Agreement in a conflicting state already exists for the same EService and consumer", async () => {
      const consumer: Tenant = buildTenant();
      const descriptor: Descriptor = buildDescriptorPublished();

      const eservice = buildEService(generateId<EServiceId>(), consumer.id, [
        descriptor,
      ]);

      const conflictingAgreement = {
        ...buildAgreement(
          eservice.id,
          consumer.id,
          randomArrayItem(agreementCreationConflictingStates)
        ),
      };

      await addOneTenant(consumer, tenants);
      await addOneEService(eservice, eservices);
      await addOneAgreement(conflictingAgreement, postgresDB, agreements);

      const authData = getRandomAuthData(consumer.id);
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      };

      await expect(
        agreementService.createAgreement(
          apiAgreementPayload,
          authData,
          uuidv4()
        )
      ).rejects.toThrowError(agreementAlreadyExists(consumer.id, eservice.id));
    });

    it("should throw a tenantIdNotFound error when the consumer Tenant does not exist", async () => {
      const consumer: Tenant = buildTenant();
      const descriptor: Descriptor = buildDescriptorPublished();

      const eservice = buildEService(
        generateId<EServiceId>(),
        generateId<TenantId>(),
        [descriptor]
      );

      await addOneEService(eservice, eservices);

      const authData = getRandomAuthData(consumer.id);
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      };

      await expect(() =>
        agreementService.createAgreement(
          apiAgreementPayload,
          authData,
          uuidv4()
        )
      ).rejects.toThrowError(tenantIdNotFound(consumer.id));
    });

    it("should throw a missingCertifiedAttributesError error when the EService producer and Agreement consumer are different Tenants, and the consumer is missing a Descriptor certified Attribute", async () => {
      const eserviceProducer: Tenant = buildTenant();

      // Descriptor has two certified attributes
      const certifiedDescriptorAttribute1: EServiceAttribute =
        buildEServiceAttribute();
      const certifiedDescriptorAttribute2: EServiceAttribute =
        buildEServiceAttribute();

      const descriptor = {
        ...buildDescriptorPublished(generateId<DescriptorId>(), [
          [certifiedDescriptorAttribute1],
          [certifiedDescriptorAttribute2],
        ]),
      };

      // In this case, the consumer is missing one of the two certified attributes
      const certifiedTenantAttribute1: TenantAttribute =
        buildCertifiedTenantAttribute(certifiedDescriptorAttribute1.id);

      const consumer = {
        ...buildTenant(),
        attributes: [certifiedTenantAttribute1],
      };

      const eservice = buildEService(
        generateId<EServiceId>(),
        eserviceProducer.id,
        [descriptor]
      );

      await addOneTenant(eserviceProducer, tenants);
      await addOneTenant(consumer, tenants);
      await addOneEService(eservice, eservices);

      const authData = getRandomAuthData(consumer.id);
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      };

      await expect(
        agreementService.createAgreement(
          apiAgreementPayload,
          authData,
          uuidv4()
        )
      ).rejects.toThrowError(
        missingCertifiedAttributesError(descriptor.id, consumer.id)
      );
    });

    it("should throw a missingCertifiedAttributesError error when the EService producer and Agreement consumer are different Tenants, and the consumer has a Descriptor certified Attribute revoked", async () => {
      const eserviceProducer: Tenant = buildTenant();

      // Descriptor has two certified attributes
      const certifiedDescriptorAttribute1: EServiceAttribute =
        buildEServiceAttribute();
      const certifiedDescriptorAttribute2: EServiceAttribute =
        buildEServiceAttribute();

      const descriptor: Descriptor = buildDescriptorPublished(
        generateId<DescriptorId>(),
        [[certifiedDescriptorAttribute1], [certifiedDescriptorAttribute2]]
      );

      const eservice = buildEService(
        generateId<EServiceId>(),
        eserviceProducer.id,
        [descriptor]
      );

      // In this case, the consumer has one of the two certified attributes revoked
      const certifiedTenantAttribute1: TenantAttribute = {
        ...buildCertifiedTenantAttribute(certifiedDescriptorAttribute1.id),
        revocationTimestamp: new Date(),
        assignmentTimestamp: new Date(),
      };
      const certifiedTenantAttribute2: TenantAttribute = {
        ...buildCertifiedTenantAttribute(certifiedDescriptorAttribute2.id),
        revocationTimestamp: undefined,
        assignmentTimestamp: new Date(),
      };

      const consumer = {
        ...buildTenant(),
        attributes: [certifiedTenantAttribute1, certifiedTenantAttribute2],
      };

      await addOneTenant(eserviceProducer, tenants);
      await addOneTenant(consumer, tenants);
      await addOneEService(eservice, eservices);

      const authData = getRandomAuthData(consumer.id);
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      };

      await expect(
        agreementService.createAgreement(
          apiAgreementPayload,
          authData,
          uuidv4()
        )
      ).rejects.toThrowError(
        missingCertifiedAttributesError(descriptor.id, consumer.id)
      );
    });
  });
  describe("get agreements", () => {
    let tenant1: Tenant;
    let tenant2: Tenant;
    let tenant3: Tenant;
    let descriptor1: Descriptor;
    let descriptor2: Descriptor;
    let descriptor3: Descriptor;
    let descriptor4: Descriptor;
    let descriptor5: Descriptor;
    let eservice1: EService;
    let eservice2: EService;
    let eservice3: EService;
    let attribute1: AgreementAttribute;
    let attribute2: AgreementAttribute;
    let attribute3: AgreementAttribute;
    let attribute4: AgreementAttribute;
    let agreement1: Agreement;
    let agreement2: Agreement;
    let agreement3: Agreement;
    let agreement4: Agreement;
    let agreement5: Agreement;
    let agreement6: Agreement;

    beforeEach(async () => {
      tenant1 = buildTenant();
      tenant2 = buildTenant();
      tenant3 = buildTenant();

      descriptor1 = {
        ...buildDescriptorPublished(),
        state: descriptorState.suspended,
        publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      };
      descriptor2 = {
        ...buildDescriptorPublished(),
        publishedAt: new Date(),
      };
      descriptor3 = {
        ...buildDescriptorPublished(),
        publishedAt: new Date(Date.now()),
      };
      descriptor4 = {
        ...buildDescriptorPublished(),
        publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      };
      descriptor5 = {
        ...buildDescriptorPublished(),
      };
      eservice1 = {
        ...buildEService(generateId<EServiceId>(), tenant1.id, [
          descriptor1,
          descriptor2,
          // descriptor2 is the latest - agreements for descriptor1 are upgradeable
        ]),
        name: "EService1", // Adding name because results are sorted by esevice name
      };
      eservice2 = {
        ...buildEService(generateId<EServiceId>(), tenant2.id, [
          descriptor3,
          descriptor4,
          // descriptor4 is not the latest - agreements for descriptor3 are not upgradeable
        ]),
        name: "EService2", // Adding name because results are sorted by esevice name
      };
      eservice3 = {
        ...buildEService(generateId<EServiceId>(), tenant3.id, [descriptor5]),
        name: "EService3", // Adding name because results are sorted by esevice name
      };

      await addOneTenant(tenant1, tenants);
      await addOneTenant(tenant2, tenants);
      await addOneTenant(tenant3, tenants);
      await addOneEService(eservice1, eservices);
      await addOneEService(eservice2, eservices);
      await addOneEService(eservice3, eservices);

      attribute1 = { id: generateId() };
      attribute2 = { id: generateId() };
      attribute3 = { id: generateId() };
      attribute4 = { id: generateId() };
      agreement1 = {
        ...buildAgreement(eservice1.id, tenant1.id, agreementState.draft),
        descriptorId: eservice1.descriptors[0].id,
        producerId: eservice1.producerId,
        certifiedAttributes: [attribute1, attribute2],
        declaredAttributes: [attribute3],
      };

      agreement2 = {
        ...buildAgreement(eservice1.id, tenant2.id, agreementState.active),
        descriptorId: eservice1.descriptors[1].id,
        producerId: eservice1.producerId,
        declaredAttributes: [attribute3],
        verifiedAttributes: [attribute4],
      };

      agreement3 = {
        ...buildAgreement(eservice2.id, tenant1.id, agreementState.pending),
        descriptorId: eservice2.descriptors[0].id,
        producerId: eservice2.producerId,
      };

      agreement4 = {
        ...buildAgreement(
          eservice2.id,
          tenant2.id,
          agreementState.missingCertifiedAttributes
        ),
        // upgradeable agreement based on descriptors, but not in an upgradeable state
        descriptorId: eservice2.descriptors[1].id,
        producerId: eservice2.producerId,
      };

      agreement5 = {
        ...buildAgreement(eservice3.id, tenant1.id, agreementState.archived),
        descriptorId: eservice3.descriptors[0].id,
        producerId: eservice3.producerId,
      };

      agreement6 = {
        ...buildAgreement(eservice3.id, tenant3.id, agreementState.rejected),
        descriptorId: eservice3.descriptors[0].id,
        producerId: eservice3.producerId,
      };

      await addOneAgreement(agreement1, postgresDB, agreements);
      await addOneAgreement(agreement2, postgresDB, agreements);
      await addOneAgreement(agreement3, postgresDB, agreements);
      await addOneAgreement(agreement4, postgresDB, agreements);
      await addOneAgreement(agreement5, postgresDB, agreements);
      await addOneAgreement(agreement6, postgresDB, agreements);
    });

    it("should get all agreements if no filters are provided", async () => {
      const allAgreements = await agreementService.getAgreements({}, 10, 0);
      expect(allAgreements).toEqual({
        totalCount: 6,
        results: expect.arrayContaining([
          agreement1,
          agreement2,
          agreement3,
          agreement4,
          agreement5,
          agreement6,
        ]),
      });
    });

    it("should get agreements with filters: producerId", async () => {
      const agreements1 = await agreementService.getAgreements(
        {
          producerId: eservice1.producerId,
        },
        10,
        0
      );
      expect(agreements1).toEqual({
        totalCount: 2,
        results: expect.arrayContaining([agreement1, agreement2]),
      });

      const agreements2 = await agreementService.getAgreements(
        {
          producerId: [eservice1.producerId, eservice2.producerId],
        },
        10,
        0
      );

      expect(agreements2).toEqual({
        totalCount: 4,
        results: expect.arrayContaining([
          agreement1,
          agreement2,
          agreement3,
          agreement4,
        ]),
      });
    });

    it("should get agreements with filters: consumerId", async () => {
      const agreements1 = await agreementService.getAgreements(
        {
          consumerId: tenant1.id,
        },
        10,
        0
      );
      expect(agreements1).toEqual({
        totalCount: 3,
        results: expect.arrayContaining([agreement1, agreement3, agreement5]),
      });

      const agreements2 = await agreementService.getAgreements(
        {
          consumerId: [tenant1.id, tenant2.id],
        },
        10,
        0
      );
      expect(agreements2).toEqual({
        totalCount: 5,
        results: expect.arrayContaining([
          agreement1,
          agreement2,
          agreement3,
          agreement4,
          agreement5,
        ]),
      });
    });

    it("should get agreements with filters: eserviceId", async () => {
      const agreements1 = await agreementService.getAgreements(
        {
          eserviceId: eservice1.id,
        },
        10,
        0
      );
      expect(agreements1).toEqual({
        totalCount: 2,
        results: expect.arrayContaining([agreement1, agreement2]),
      });

      const agreements2 = await agreementService.getAgreements(
        {
          eserviceId: [eservice1.id, eservice2.id],
        },
        10,
        0
      );
      expect(agreements2).toEqual({
        totalCount: 4,
        results: expect.arrayContaining([
          agreement1,
          agreement2,
          agreement3,
          agreement4,
        ]),
      });
    });

    it("should get agreements with filters: descriptorId", async () => {
      const agreements1 = await agreementService.getAgreements(
        {
          descriptorId: descriptor1.id,
        },
        10,
        0
      );
      expect(agreements1).toEqual({
        totalCount: 1,
        results: expect.arrayContaining([agreement1]),
      });

      const agreements2 = await agreementService.getAgreements(
        {
          descriptorId: [descriptor1.id, descriptor3.id, descriptor5.id],
        },
        10,
        0
      );
      expect(agreements2).toEqual({
        totalCount: 4,
        results: expect.arrayContaining([
          agreement1,
          agreement3,
          agreement5,
          agreement6,
        ]),
      });
    });

    it("should get agreements with filters: attributeId", async () => {
      const agreements1 = await agreementService.getAgreements(
        {
          attributeId: attribute2.id,
        },
        10,
        0
      );
      expect(agreements1).toEqual({
        totalCount: 1,
        results: expect.arrayContaining([agreement1]),
      });

      const agreements2 = await agreementService.getAgreements(
        {
          attributeId: attribute3.id,
        },
        10,
        0
      );
      expect(agreements2).toEqual({
        totalCount: 2,
        results: expect.arrayContaining([agreement1, agreement2]),
      });

      const agreements3 = await agreementService.getAgreements(
        {
          attributeId: [attribute1.id, attribute3.id, attribute4.id],
        },
        10,
        0
      );
      expect(agreements3).toEqual({
        totalCount: 2,
        results: expect.arrayContaining([agreement1, agreement2]),
      });
    });
    it("should get agreements with filters: state", async () => {
      const agreements = await agreementService.getAgreements(
        {
          agreementStates: [agreementState.active, agreementState.pending],
        },
        10,
        0
      );
      expect(agreements).toEqual({
        totalCount: 2,
        results: expect.arrayContaining([agreement2, agreement3]),
      });
    });
    it("should get agreements with filters: showOnlyUpgradeable", async () => {
      const agreements = await agreementService.getAgreements(
        {
          showOnlyUpgradeable: true,
        },
        10,
        0
      );
      expect(agreements).toEqual({
        totalCount: 1,
        results: expect.arrayContaining([
          agreement1,
          // also agreement4 has a latest descriptor to upgrade to,
          // but it is not in an upgradeable state
        ]),
      });
    });

    it("should get agreements with filters: producerId, consumerId, eserviceId", async () => {
      const agreements = await agreementService.getAgreements(
        {
          producerId: [eservice1.producerId, eservice2.producerId],
          consumerId: tenant1.id,
          eserviceId: [eservice1.id, eservice2.id],
        },
        10,
        0
      );
      expect(agreements).toEqual({
        totalCount: 2,
        results: expect.arrayContaining([agreement1, agreement3]),
      });
    });

    it("should get agreements with filters: producerId, consumerId, eserviceId, descriptorId", async () => {
      const agreements = await agreementService.getAgreements(
        {
          producerId: [eservice1.producerId, eservice2.producerId],
          consumerId: tenant1.id,
          eserviceId: [eservice1.id, eservice2.id],
          descriptorId: [descriptor1.id],
        },
        10,
        0
      );
      expect(agreements).toEqual({
        totalCount: 1,
        results: expect.arrayContaining([agreement1]),
      });
    });

    it("should get agreements with filters: attributeId, state", async () => {
      const agreements = await agreementService.getAgreements(
        {
          attributeId: attribute3.id,
          agreementStates: [agreementState.active],
        },
        10,
        0
      );
      expect(agreements).toEqual({
        totalCount: 1,
        results: expect.arrayContaining([agreement2]),
      });
    });

    it("should get agreements with filters: showOnlyUpgradeable, state, descriptorId", async () => {
      const agreements1 = await agreementService.getAgreements(
        {
          showOnlyUpgradeable: true,
          agreementStates: [agreementState.draft],
          descriptorId: descriptor1.id,
        },
        10,
        0
      );
      expect(agreements1).toEqual({
        totalCount: 1,
        results: expect.arrayContaining([agreement1]),
      });

      const agreements2 = await agreementService.getAgreements(
        {
          showOnlyUpgradeable: true,
          agreementStates: [agreementState.suspended],
          descriptorId: descriptor1.id,
        },
        10,
        0
      );
      expect(agreements2).toEqual({
        totalCount: 0,
        results: [],
      });
    });

    it("should get agreements with limit", async () => {
      const agreements = await agreementService.getAgreements(
        {
          eserviceId: eservice1.id,
        },
        1,
        0
      );
      expect(agreements).toEqual({
        totalCount: 2,
        results: expect.arrayContaining([agreement1]),
      });
    });

    it("should get agreements with offset and limit", async () => {
      const agreements = await agreementService.getAgreements(
        {
          eserviceId: [eservice1.id, eservice2.id],
        },
        2,
        1
      );
      expect(agreements).toEqual({
        totalCount: 4,
        results: expect.arrayContaining([agreement2, agreement3]),
      });
    });
  });
  describe("get agreement", () => {
    it("should get an agreement", async () => {
      const agreement: Agreement = buildAgreement();
      await addOneAgreement(agreement, postgresDB, agreements);
      await addOneAgreement(buildAgreement(), postgresDB, agreements);

      const result = await agreementService.getAgreementById(agreement.id);
      expect(result).toEqual(agreement);
    });

    it("should throw an agreementNotFound error when the agreement does not exist", async () => {
      const agreementId = generateId<AgreementId>();

      await addOneAgreement(buildAgreement(), postgresDB, agreements);

      await expect(
        agreementService.getAgreementById(agreementId)
      ).rejects.toThrowError(agreementNotFound(agreementId));
    });
  });
  describe("get agreement consumers / producers", () => {
    let tenant1: Tenant;
    let tenant2: Tenant;
    let tenant3: Tenant;
    let tenant4: Tenant;
    let tenant5: Tenant;
    let tenant6: Tenant;

    const toCompactOrganization = (tenant: Tenant): CompactOrganization => ({
      id: tenant.id,
      name: tenant.name,
    });

    beforeEach(async () => {
      tenant1 = { ...buildTenant(), name: "Tenant 1 Foo" };
      tenant2 = { ...buildTenant(), name: "Tenant 2 Bar" };
      tenant3 = { ...buildTenant(), name: "Tenant 3 FooBar" };
      tenant4 = { ...buildTenant(), name: "Tenant 4 Baz" };
      tenant5 = { ...buildTenant(), name: "Tenant 5 BazBar" };
      tenant6 = { ...buildTenant(), name: "Tenant 6 BazFoo" };

      await addOneTenant(tenant1, tenants);
      await addOneTenant(tenant2, tenants);
      await addOneTenant(tenant3, tenants);
      await addOneTenant(tenant4, tenants);
      await addOneTenant(tenant5, tenants);
      await addOneTenant(tenant6, tenants);

      const agreement1 = {
        ...buildAgreement(),
        producerId: tenant1.id,
        consumerId: tenant2.id,
      };

      const agreement2 = {
        ...buildAgreement(),
        producerId: tenant1.id,
        consumerId: tenant3.id,
      };

      const agreement3 = {
        ...buildAgreement(),
        producerId: tenant2.id,
        consumerId: tenant4.id,
      };

      const agreement4 = {
        ...buildAgreement(),
        producerId: tenant2.id,
        consumerId: tenant5.id,
      };

      const agreement5 = {
        ...buildAgreement(),
        producerId: tenant3.id,
        consumerId: tenant6.id,
      };

      await addOneAgreement(agreement1, postgresDB, agreements);
      await addOneAgreement(agreement2, postgresDB, agreements);
      await addOneAgreement(agreement3, postgresDB, agreements);
      await addOneAgreement(agreement4, postgresDB, agreements);
      await addOneAgreement(agreement5, postgresDB, agreements);
    });
    describe("get agreement consumers", () => {
      it("should get all agreement consumers", async () => {
        const consumers = await agreementService.getAgreementConsumers(
          undefined,
          10,
          0
        );

        expect(consumers).toEqual({
          totalCount: 5,
          results: expect.arrayContaining(
            [tenant2, tenant3, tenant4, tenant5, tenant6].map(
              toCompactOrganization
            )
          ),
        });
      });
      it("should get agreement consumers filtered by name", async () => {
        const consumers = await agreementService.getAgreementConsumers(
          "Foo",
          10,
          0
        );

        expect(consumers).toEqual({
          totalCount: 2,
          results: expect.arrayContaining(
            [tenant3, tenant6].map(toCompactOrganization)
          ),
        });
      });
      it("should get agreeement consumers with limit", async () => {
        const consumers = await agreementService.getAgreementConsumers(
          undefined,
          2,
          0
        );

        expect(consumers).toEqual({
          totalCount: 5,
          results: expect.arrayContaining(
            [tenant2, tenant3].map(toCompactOrganization)
          ),
        });
      });
      it("should get agreement consumers with offset and limit", async () => {
        const consumers = await agreementService.getAgreementConsumers(
          undefined,
          2,
          1
        );

        expect(consumers).toEqual({
          totalCount: 5,
          results: expect.arrayContaining(
            [tenant3, tenant4].map(toCompactOrganization)
          ),
        });
      });
      it("should get agreement consumers with offset, limit, and name filter", async () => {
        const consumers = await agreementService.getAgreementConsumers(
          "Foo",
          1,
          1
        );

        expect(consumers).toEqual({
          totalCount: 2,
          results: expect.arrayContaining([tenant6].map(toCompactOrganization)),
        });
      });
    });
    describe("get agreement producers", () => {
      it("should get all agreement producers", async () => {
        const producers = await agreementService.getAgreementProducers(
          undefined,
          10,
          0
        );

        expect(producers).toEqual({
          totalCount: 3,
          results: expect.arrayContaining(
            [tenant1, tenant2, tenant3].map(toCompactOrganization)
          ),
        });
      });
      it("should get agreement producers filtered by name", async () => {
        const producers = await agreementService.getAgreementProducers(
          "Bar",
          10,
          0
        );

        expect(producers).toEqual({
          totalCount: 2,
          results: expect.arrayContaining(
            [tenant2, tenant3].map(toCompactOrganization)
          ),
        });
      });
      it("should get agreeement producers with limit", async () => {
        const producers = await agreementService.getAgreementProducers(
          undefined,
          2,
          0
        );

        expect(producers).toEqual({
          totalCount: 3,
          results: expect.arrayContaining(
            [tenant1, tenant2].map(toCompactOrganization)
          ),
        });
      });
      it("should get agreement producers with offset and limit", async () => {
        const producers = await agreementService.getAgreementProducers(
          undefined,
          2,
          1
        );

        expect(producers).toEqual({
          totalCount: 3,
          results: expect.arrayContaining(
            [tenant2, tenant3].map(toCompactOrganization)
          ),
        });
      });
      it("should get agreement producers with offset, limit, and name filter", async () => {
        const producers = await agreementService.getAgreementProducers(
          "Bar",
          1,
          1
        );

        expect(producers).toEqual({
          totalCount: 2,
          results: expect.arrayContaining([tenant3].map(toCompactOrganization)),
        });
      });
    });
  });
  describe("get agreement eservices", () => {
    let eservice1: EService;
    let eservice2: EService;
    let eservice3: EService;

    let tenant1: Tenant;
    let tenant2: Tenant;
    let tenant3: Tenant;

    const toCompactEService = (eservice: EService): CompactEService => ({
      id: eservice.id,
      name: eservice.name,
    });

    beforeEach(async () => {
      tenant1 = buildTenant();
      tenant2 = buildTenant();
      tenant3 = buildTenant();

      eservice1 = {
        ...buildEService(generateId<EServiceId>(), tenant1.id),
        name: "EService 1 Foo",
      };
      eservice2 = {
        ...buildEService(generateId<EServiceId>(), tenant2.id),
        name: "EService 2 Bar",
      };
      eservice3 = {
        ...buildEService(generateId<EServiceId>(), tenant3.id),
        name: "EService 3 FooBar",
      };

      await addOneTenant(tenant1, tenants);
      await addOneTenant(tenant2, tenants);
      await addOneTenant(tenant3, tenants);
      await addOneEService(eservice1, eservices);
      await addOneEService(eservice2, eservices);
      await addOneEService(eservice3, eservices);

      const agreement1 = {
        ...buildAgreement(eservice1.id),
        producerId: eservice1.producerId,
        consumerId: tenant2.id,
      };
      const agreement2 = {
        ...buildAgreement(eservice2.id),
        producerId: eservice2.producerId,
        consumerId: tenant3.id,
      };

      const agreement3 = {
        ...buildAgreement(eservice3.id),
        producerId: eservice3.producerId,
        consumerId: tenant1.id,
      };

      await addOneAgreement(agreement1, postgresDB, agreements);
      await addOneAgreement(agreement2, postgresDB, agreements);
      await addOneAgreement(agreement3, postgresDB, agreements);
    });

    it("should get all agreement eservices", async () => {
      const eservices = await agreementService.getAgreementEServices(
        undefined,
        [],
        [],
        10,
        0
      );

      expect(eservices.totalCount).toEqual(3);
      expect(eservices.results).toEqual(
        expect.arrayContaining(
          [eservice1, eservice2, eservice3].map(toCompactEService)
        )
      );
    });

    it("should get agreement eservices filtered by name", async () => {
      const eservices = await agreementService.getAgreementEServices(
        "Foo",
        [],
        [],
        10,
        0
      );
      expect(eservices.totalCount).toEqual(2);
      expect(eservices.results).toEqual(
        expect.arrayContaining([eservice1, eservice3].map(toCompactEService))
      );
    });

    it("should get agreement eservices filtered by consumerId", async () => {
      const eservices = await agreementService.getAgreementEServices(
        undefined,
        [tenant2.id, tenant3.id],
        [],
        10,
        0
      );
      expect(eservices.totalCount).toEqual(2);
      expect(eservices.results).toEqual(
        expect.arrayContaining([eservice1, eservice2].map(toCompactEService))
      );
    });

    it("should get agreement eservices filtered by producerId", async () => {
      const eservices = await agreementService.getAgreementEServices(
        undefined,
        [],
        [tenant1.id, tenant2.id],
        10,
        0
      );
      expect(eservices.totalCount).toEqual(2);
      expect(eservices.results).toEqual(
        expect.arrayContaining([eservice1, eservice2].map(toCompactEService))
      );
    });

    it("should get agreement eservices with filters: name, consumerId, producerId", async () => {
      const eservices = await agreementService.getAgreementEServices(
        "Foo",
        [tenant2.id],
        [tenant1.id],
        10,
        0
      );
      expect(eservices.totalCount).toEqual(1);
      expect(eservices.results).toEqual(
        expect.arrayContaining([eservice1].map(toCompactEService))
      );
    });

    it("should get agreement eservices with limit", async () => {
      const eservices = await agreementService.getAgreementEServices(
        undefined,
        [],
        [],
        2,
        0
      );
      expect(eservices.totalCount).toEqual(3);
      expect(eservices.results.length).toEqual(2);
      expect(eservices.results).toEqual(
        expect.arrayContaining([eservice1, eservice2].map(toCompactEService))
      );
    });

    it("should get agreement eservices with offset and limit", async () => {
      const eservices = await agreementService.getAgreementEServices(
        undefined,
        [],
        [],
        2,
        1
      );
      expect(eservices.totalCount).toEqual(3);
      expect(eservices.results.length).toEqual(2);
      expect(eservices.results).toEqual(
        expect.arrayContaining([eservice2, eservice3].map(toCompactEService))
      );
    });

    it("should get no agreement eservices in case of no filters match", async () => {
      const eservices = await agreementService.getAgreementEServices(
        "Baz",
        [],
        [],
        10,
        0
      );
      expect(eservices.totalCount).toEqual(0);
      expect(eservices.results).toEqual([]);
    });
  });
});
