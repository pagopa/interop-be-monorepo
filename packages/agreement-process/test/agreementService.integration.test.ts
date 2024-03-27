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

  expect(actualAgreementData).toBeDefined();
  expect(actualAgreementData.type).toBe("AgreementAdded");
  expect(actualAgreementData.event_version).toBe(1);
  expect(actualAgreementData.version).toBe("0");
  expect(actualAgreementData.stream_id).toEqual(agreementId);

  const actualAgreement: AgreementV1 | undefined = protobufDecoder(
    AgreementAddedV1
  ).parse(actualAgreementData.data)?.agreement;

  if (!actualAgreement) {
    fail("impossible to decode AgreementAddedV1 data");
  }

  expect(actualAgreement).toBeDefined();
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
          randomArrayItem(
            Object.values(agreementState).filter(
              (state) => !agreementCreationConflictingStates.includes(state)
            )
          )
        ),
        state: randomArrayItem(agreementCreationConflictingStates),
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

      descriptor1 = buildDescriptorPublished();
      descriptor2 = buildDescriptorPublished();
      descriptor3 = buildDescriptorPublished();
      eservice1 = buildEService(generateId<EServiceId>(), tenant1.id, [
        descriptor1,
        descriptor2,
      ]);
      eservice2 = buildEService(generateId<EServiceId>(), tenant2.id, [
        descriptor3,
      ]);
      eservice3 = buildEService(generateId<EServiceId>(), tenant3.id, []);

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
        descriptorId: eservice2.descriptors[0].id,
        producerId: eservice2.producerId,
      };

      agreement5 = {
        ...buildAgreement(eservice3.id, tenant1.id, agreementState.archived),
        producerId: eservice3.producerId,
      };

      agreement6 = {
        ...buildAgreement(eservice3.id, tenant3.id, agreementState.rejected),
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
      expect(allAgreements.totalCount).toEqual(6);
      expect(allAgreements.results).toEqual(
        expect.arrayContaining([
          agreement1,
          agreement2,
          agreement3,
          agreement4,
          agreement5,
          agreement6,
        ])
      );
    });

    it("should get agreements with filters: producerId", async () => {
      const agreements1 = await agreementService.getAgreements(
        {
          producerId: eservice1.producerId,
        },
        10,
        0
      );
      expect(agreements1.totalCount).toEqual(2);
      expect(agreements1.results).toEqual(
        expect.arrayContaining([agreement1, agreement2])
      );

      const agreements2 = await agreementService.getAgreements(
        {
          producerId: [eservice1.producerId, eservice2.producerId],
        },
        10,
        0
      );
      expect(agreements2.totalCount).toEqual(4);
      expect(agreements2.results).toEqual(
        expect.arrayContaining([agreement1, agreement2, agreement3, agreement4])
      );
    });

    it("should get agreements with filters: consumerId", async () => {
      const agreements1 = await agreementService.getAgreements(
        {
          consumerId: tenant1.id,
        },
        10,
        0
      );
      expect(agreements1.totalCount).toEqual(3);
      expect(agreements1.results).toEqual(
        expect.arrayContaining([agreement1, agreement3, agreement5])
      );

      const agreements2 = await agreementService.getAgreements(
        {
          consumerId: [tenant1.id, tenant2.id],
        },
        10,
        0
      );
      expect(agreements2.totalCount).toEqual(5);
      expect(agreements2.results).toEqual(
        expect.arrayContaining([
          agreement1,
          agreement2,
          agreement3,
          agreement4,
          agreement5,
        ])
      );
    });

    it("should get agreements with filters: eserviceId", async () => {
      const agreements1 = await agreementService.getAgreements(
        {
          eserviceId: eservice1.id,
        },
        10,
        0
      );
      expect(agreements1.totalCount).toEqual(2);
      expect(agreements1.results).toEqual(
        expect.arrayContaining([agreement1, agreement2])
      );

      const agreements2 = await agreementService.getAgreements(
        {
          eserviceId: [eservice1.id, eservice2.id],
        },
        10,
        0
      );
      expect(agreements2.totalCount).toEqual(4);
      expect(agreements2.results).toEqual(
        expect.arrayContaining([agreement1, agreement2, agreement3, agreement4])
      );
    });

    it("should get agreements with filters: descriptorId", async () => {
      const agreements1 = await agreementService.getAgreements(
        {
          descriptorId: descriptor1.id,
        },
        10,
        0
      );
      expect(agreements1.totalCount).toEqual(1);
      expect(agreements1.results).toEqual(expect.arrayContaining([agreement1]));

      const agreements2 = await agreementService.getAgreements(
        {
          descriptorId: [descriptor1.id, descriptor3.id],
        },
        10,
        0
      );
      expect(agreements2.totalCount).toEqual(3);
      expect(agreements2.results).toEqual(
        expect.arrayContaining([agreement1, agreement3, agreement4])
      );
    });

    it("should get agreements with filters: attributeId", async () => {
      const agreements1 = await agreementService.getAgreements(
        {
          attributeId: attribute2.id,
        },
        10,
        0
      );
      expect(agreements1.totalCount).toEqual(1);
      expect(agreements1.results).toEqual(expect.arrayContaining([agreement1]));

      const agreements2 = await agreementService.getAgreements(
        {
          attributeId: attribute3.id,
        },
        10,
        0
      );
      expect(agreements2.totalCount).toEqual(2);
      expect(agreements2.results).toEqual(
        expect.arrayContaining([agreement1, agreement2])
      );

      const agreements3 = await agreementService.getAgreements(
        {
          attributeId: [attribute1.id, attribute3.id, attribute4.id],
        },
        10,
        0
      );
      expect(agreements3.totalCount).toEqual(2);
      expect(agreements3.results).toEqual(
        expect.arrayContaining([agreement1, agreement2])
      );
    });
    it("should get agreements with filters: state", async () => {
      const agreements1 = await agreementService.getAgreements(
        {
          agreementStates: [agreementState.active, agreementState.pending],
        },
        10,
        0
      );
      expect(agreements1.totalCount).toEqual(2);
      expect(agreements1.results).toEqual(
        expect.arrayContaining([agreement2, agreement3])
      );
    });
  });
  // TODO test missing showOnlyUpdgradable filter
  // TODO test combinations of filters
});
