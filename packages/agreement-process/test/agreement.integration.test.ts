/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { fail } from "assert";
import {
  AgreementCollection,
  EServiceCollection,
  ReadModelRepository,
  StoredEvent,
  TenantCollection,
  eventStoreSchema,
  expectPastTimestamp,
  initDB,
  logger,
  readLastEventByStreamId,
  writeInReadmodel,
  getRandomAuthData,
  buildDescriptorPublished,
  buildEServiceAttribute,
  buildEService,
  buildTenant,
  buildDeclaredTenantAttribute,
  buildCertifiedTenantAttribute,
  buildAgreementWithValidCreationState,
} from "pagopa-interop-commons";
import {
  Agreement,
  AgreementAddedV1,
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
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

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
import { toAgreementStateV1 } from "../src/model/domain/toEvent.js";
import {
  startMongoDBContainer,
  startPostgresDBContainer,
  TEST_POSTGRES_DB_PORT,
  TETS_MONGO_DB_PORT,
} from "./containerTestUtils.js";

describe("AgreementService Integration Test", async () => {
  let agreements: AgreementCollection;
  let eservices: EServiceCollection;
  let tenants: TenantCollection;
  let readModelService;
  let agreementService: AgreementService;
  let postgresDB: IDatabase<unknown>;
  let postgreSqlContainer: StartedTestContainer;
  let mongodbContainer: StartedTestContainer;

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
      await readLastEventByStreamId(
        agreementId,
        eventStoreSchema.agreement,
        postgresDB
      );

    if (!actualAgreementData) {
      fail("Creation fails: agreement not found in event-store");
    }

    expect(actualAgreementData).toBeDefined();
    expect(actualAgreementData.type).toBe("AgreementAdded");
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
    postgreSqlContainer = await startPostgresDBContainer(config);
    mongodbContainer = await startMongoDBContainer(config);

    config.eventStoreDbPort = postgreSqlContainer.getMappedPort(
      TEST_POSTGRES_DB_PORT
    );
    config.readModelDbPort = mongodbContainer.getMappedPort(TETS_MONGO_DB_PORT);

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

    agreementService = agreementServiceBuilder(
      postgresDB,
      agreementQuery,
      tenantQuery,
      eserviceQuery,
      attributeQuery
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
    await postgreSqlContainer.stop();
    await mongodbContainer.stop();
  });

  describe("createAgreement (success cases)", () => {
    it("succeed when EService Producer and Agreement Consumer are the same, even on unmet attributes", async () => {
      const authData = getRandomAuthData();
      const eserviceId = generateId<EServiceId>();
      const descriptorId = generateId<DescriptorId>();
      const attributeId = generateId<AttributeId>();

      const descriptor = buildDescriptorPublished(descriptorId, [
        buildEServiceAttribute(attributeId),
      ]);
      const eservice = buildEService(
        eserviceId,
        unsafeBrandId<TenantId>(authData.userId),
        [descriptor]
      );
      const tenant = buildTenant(
        authData.organizationId,
        unsafeBrandId<TenantId>(authData.externalId.value),
        [
          {
            ...buildCertifiedTenantAttribute(attributeId),
            revocationTimestamp: undefined,
          },
        ]
      );

      await writeInReadmodel<EService>(eservice, eservices);
      await writeInReadmodel<Tenant>(tenant, tenants);

      const agreementData: ApiAgreementPayload = {
        eserviceId,
        descriptorId,
      };
      const createdAgreementId = await agreementService.createAgreement(
        agreementData,
        authData
      );

      await expectedAgreementCreation(
        unsafeBrandId<AgreementId>(createdAgreementId),
        eserviceId,
        descriptorId,
        unsafeBrandId(authData.userId),
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
        certifiedDescriptorAttribute1,
        certifiedDescriptorAttribute2,
      ]);

      const certifiedTenantAttribute1: TenantAttribute = {
        ...buildCertifiedTenantAttribute(certifiedDescriptorAttribute1.id),
        revocationTimestamp: undefined,
      };

      const certifiedTenantAttribute2: TenantAttribute = {
        ...buildCertifiedTenantAttribute(certifiedDescriptorAttribute2.id),
        revocationTimestamp: undefined,
      };

      const consumer = buildTenant(
        authData.organizationId,
        unsafeBrandId<TenantId>(authData.externalId.value),
        [
          buildDeclaredTenantAttribute(),
          certifiedTenantAttribute1,
          certifiedTenantAttribute2,
        ]
      );

      const eservice = buildEService(
        generateId<EServiceId>(),
        eserviceProducer.id,
        [descriptor]
      );

      await writeInReadmodel<Tenant>(eserviceProducer, tenants);
      await writeInReadmodel<Tenant>(consumer, tenants);
      await writeInReadmodel<EService>(eservice, eservices);

      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      };

      const createdAgreementId = await agreementService.createAgreement(
        apiAgreementPayload,
        authData
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

      await writeInReadmodel<Tenant>(eserviceProducer, tenants);
      await writeInReadmodel<Tenant>(consumer, tenants);
      await writeInReadmodel<EService>(eservice, eservices);

      const authData = getRandomAuthData(consumer.id); // different from eserviceProducer
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      };

      const createdAgreementId = await agreementService.createAgreement(
        apiAgreementPayload,
        authData
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

      await writeInReadmodel<Tenant>(tenant, tenants);
      await writeInReadmodel<EService>(eservice, eservices);

      const authData = getRandomAuthData(tenant.id);
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: descriptor0.id,
      };

      const createdAgreementId = await agreementService.createAgreement(
        apiAgreementPayload,
        authData
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

      const otherAgreement = buildAgreementWithValidCreationState(
        eservice.id,
        tenant.id
      );

      await writeInReadmodel<Tenant>(tenant, tenants);
      await writeInReadmodel<EService>(eservice, eservices);
      await writeInReadmodel<Agreement>(otherAgreement, agreements);

      const authData = getRandomAuthData(tenant.id);
      const apiAgreementPayload: ApiAgreementPayload = {
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      };

      const createdAgreementId = await agreementService.createAgreement(
        apiAgreementPayload,
        authData
      );

      await expectedAgreementCreation(
        unsafeBrandId<AgreementId>(createdAgreementId),
        eservice.id,
        descriptor.id,
        tenant.id,
        tenant.id
      );
    });
  });
});
