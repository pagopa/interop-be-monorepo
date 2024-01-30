/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { fail } from "assert";
import {
  AgreementCollection,
  AuthData,
  EServiceCollection,
  ReadModelRepository,
  StoredEvent,
  TEST_POSTGRES_DB_PORT,
  TETS_MONGO_DB_PORT,
  TenantCollection,
  eventStoreSchema,
  expectPastTimestamp,
  initDB,
  logger,
  readLastEventByStreamId,
  startMongoDBContainer,
  startPostgresDBContainer,
  writeInReadmodel,
} from "pagopa-interop-commons";
import {
  AgreementAddedV1,
  AttributeId,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  Tenant,
  TenantAttribute,
  agreementState,
  descriptorState,
  generateId,
  protobufDecoder,
  tenantAttributeType,
  unsafeBrandId,
} from "pagopa-interop-models";
import { IDatabase } from "pg-promise";
import { StartedTestContainer } from "testcontainers";
import { v4 as uuidv4 } from "uuid";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { generateMock } from "@anatine/zod-mock";
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

const getRandomAuthData = (): AuthData => generateMock(AuthData);

describe("AgreementService Integration Test", async () => {
  let agreements: AgreementCollection;
  let eservices: EServiceCollection;
  let tenants: TenantCollection;
  let readModelService;
  let agreementService: AgreementService;
  let postgresDB: IDatabase<unknown>;
  let postgreSqlContainer: StartedTestContainer;
  let mongodbContainer: StartedTestContainer;

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
      const eserviceId = generateId<EServiceId>();
      const descriptorId = generateId<DescriptorId>();
      const authData = getRandomAuthData();

      const agreementData: ApiAgreementPayload = {
        eserviceId,
        descriptorId,
      };
      const attributeId = unsafeBrandId<AttributeId>(uuidv4());
      const descriptor: Descriptor = {
        ...generateMock(Descriptor),
        id: descriptorId,
        state: descriptorState.published,
        attributes: {
          certified: [
            [
              {
                id: attributeId,
                explicitAttributeVerification: true,
              },
            ],
          ],
          declared: [],
          verified: [],
        },
      };

      const eservice = {
        ...generateMock(EService),
        id: eserviceId,
        producerId: authData.userId,
        descriptors: [descriptor],
      };
      await writeInReadmodel<EService>(eservice, eservices);

      const tenant = {
        ...generateMock(Tenant),
        id: authData.organizationId,
        externalId: {
          value: authData.externalId.value,
          origin: "EXT",
        },
        attributes: [
          {
            ...generateMock(TenantAttribute),
            id: attributeId,
            type: tenantAttributeType.CERTIFIED,
            revocationTimestamp: undefined,
          },
        ],
      };
      await writeInReadmodel<Tenant>(tenant, tenants);

      const createdAgreementId = await agreementService.createAgreement(
        agreementData,
        authData
      );

      expect(createdAgreementId).toBeDefined();
      const actualAgreementData: StoredEvent | undefined =
        await readLastEventByStreamId(
          createdAgreementId,
          eventStoreSchema.agreement,
          postgresDB
        );

      if (!actualAgreementData) {
        fail("created Agreement not found in event-store");
      }

      expect(actualAgreementData).toBeDefined();
      expect(actualAgreementData.type).toBe("AgreementAdded");
      expect(actualAgreementData.version).toBe("0");
      expect(actualAgreementData.stream_id).toEqual(createdAgreementId);
      const actualAgreement = protobufDecoder(AgreementAddedV1).parse(
        actualAgreementData.data
      )?.agreement;

      if (!actualAgreement) {
        fail("impossible to decode AgreementAddedV1 data");
      }

      expect(actualAgreement).toBeDefined();
      expect(actualAgreement.contract).toBeUndefined();
      expect(actualAgreement).toMatchObject({
        id: actualAgreement.id,
        eserviceId,
        descriptorId,
        producerId: authData.userId,
        consumerId: tenant.id,
        state: toAgreementStateV1(agreementState.draft),
        verifiedAttributes: [],
        certifiedAttributes: [],
        declaredAttributes: [],
        consumerDocuments: [],
        stamps: {},
        createdAt: expect.any(BigInt),
      });

      expect(actualAgreement)
        .property("createdAt")
        .satisfy(expectPastTimestamp);
    });
  });
});
