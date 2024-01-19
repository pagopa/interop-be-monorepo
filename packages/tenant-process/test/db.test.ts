/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { GenericContainer } from "testcontainers";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import {
  AgreementCollection,
  EServiceCollection,
  ReadModelRepository,
  TenantCollection,
  initDB,
} from "pagopa-interop-commons";
import { IDatabase } from "pg-promise";
import {
  Descriptor,
  EService,
  Tenant,
  descriptorState,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { config } from "../src/utilities/config.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readModelService.js";
import {
  TenantService,
  tenantServiceBuilder,
} from "../src/services/tenantService.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  getMockAgreement,
  getMockAuthData,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "./utils.js";

describe("database test", async () => {
  let tenants: TenantCollection;
  let agreements: AgreementCollection;
  let eservices: EServiceCollection;
  let readModelService: ReadModelService;
  let tenantService: TenantService;
  let postgresDB: IDatabase<unknown>;
  beforeAll(async () => {
    const postgreSqlContainer = await new PostgreSqlContainer("postgres:14")
      .withUsername(config.eventStoreDbUsername)
      .withPassword(config.eventStoreDbPassword)
      .withDatabase(config.eventStoreDbName)
      .withCopyFilesToContainer([
        {
          source: "../../docker/event-store-init.sql",
          target: "/docker-entrypoint-initdb.d/01-init.sql",
        },
      ])
      .withExposedPorts(5432)
      .start();

    const mongodbContainer = await new GenericContainer("mongo:4.0.0")
      .withEnvironment({
        MONGO_INITDB_DATABASE: config.readModelDbName,
        MONGO_INITDB_ROOT_USERNAME: config.readModelDbUsername,
        MONGO_INITDB_ROOT_PASSWORD: config.readModelDbPassword,
      })
      .withExposedPorts(27017)
      .start();

    config.eventStoreDbPort = postgreSqlContainer.getMappedPort(5432);
    config.readModelDbPort = mongodbContainer.getMappedPort(27017);
    ({ tenants, agreements, eservices } = ReadModelRepository.init(config));
    readModelService = readModelServiceBuilder(config);
    postgresDB = initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: postgreSqlContainer.getMappedPort(5432),
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    });
    tenantService = tenantServiceBuilder(postgresDB, readModelService);
  });

  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();

  afterEach(async () => {
    await tenants.deleteMany({});
    await agreements.deleteMany({});
    await postgresDB.none("TRUNCATE TABLE tenant.events RESTART IDENTITY");
  });

  describe("tenantService", () => {
    describe("tenant creation", () => {
      it("TO DO", () => {
        expect(1).toBe(1);
      });
    });
  });
  describe("readModelService", () => {
    describe("getConsumers", () => {
      it("should get the tenants consuming any of the eservices of a specific producerId", async () => {
        const organizationId = uuidv4();
        const consumerId1 = uuidv4();
        const consumerId2 = uuidv4();
        const consumerId3 = uuidv4();

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
          producerId: organizationId,
        };
        await addOneEService(eService1, eservices);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "B",
          descriptors: [descriptor2],
          producerId: organizationId,
        };
        await addOneEService(eService2, eservices);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "C",
          descriptors: [descriptor3],
          producerId: organizationId,
        };

        await addOneEService(eService3, eservices);

        const mockTenant = getMockTenant();

        const tenantProducer: Tenant = {
          ...mockTenant,
          id: organizationId,
          name: "A tenantProducer",
        };
        await addOneTenant(tenantProducer, postgresDB, tenants); // postgresDB,?????

        const tenant1: Tenant = {
          ...mockTenant,
          id: consumerId1,
          name: "A tenant1",
        };
        await addOneTenant(tenant1, postgresDB, tenants); // postgresDB,?????

        const tenant2: Tenant = {
          ...mockTenant,
          id: consumerId2,
          name: "A tenant2",
        };
        await addOneTenant(tenant2, postgresDB, tenants);

        const tenant3: Tenant = {
          ...mockTenant,
          id: consumerId3,
          name: "A tenant3",
        };
        await addOneTenant(tenant3, postgresDB, tenants);

        // Erogatore
        // N eservices
        // Questi eservices devono avere un agreement in stato ACTIVE
        // io ho bisogno di tutti i fruitori, filtrati per il producerID dell'erogatore

        const agreementEservice1 = getMockAgreement({
          eServiceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: organizationId,
          consumerId: consumerId1,
        });

        await addOneAgreement(agreementEservice1, agreements);

        const agreementEservice2 = getMockAgreement({
          eServiceId: eService2.id,
          descriptorId: descriptor2.id,
          producerId: organizationId,
          consumerId: consumerId2,
        });
        await addOneAgreement(agreementEservice2, agreements);

        const agreementEservice3 = getMockAgreement({
          eServiceId: eService3.id,
          descriptorId: descriptor3.id,
          producerId: organizationId,
          consumerId: consumerId3,
        });
        await addOneAgreement(agreementEservice3, agreements);

        const result1 = await readModelService.getConsumers({
          consumerName: tenant1.name,
          producerId: organizationId,
          offset: 0,
          limit: 50,
        });
        expect(result1.totalCount).toBe(1);
      });
      it("should not get any tenants, if no one is consuming any of the eservices of a specific producerId", async () => {
        const organizationId = uuidv4();
        const consumerId1 = uuidv4();
        const consumerId2 = uuidv4();
        const consumerId3 = uuidv4();

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
          producerId: organizationId,
        };
        await addOneEService(eService1, eservices);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "B",
          descriptors: [descriptor2],
          producerId: organizationId,
        };
        await addOneEService(eService2, eservices);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "C",
          descriptors: [descriptor3],
          producerId: organizationId,
        };

        await addOneEService(eService3, eservices);

        const mockTenant = getMockTenant();

        const tenantProducer: Tenant = {
          ...mockTenant,
          id: organizationId,
          name: "A tenantProducer",
        };
        await addOneTenant(tenantProducer, postgresDB, tenants);

        const tenant1: Tenant = {
          ...mockTenant,
          id: consumerId1,
          name: "A tenant1",
        };
        await addOneTenant(tenant1, postgresDB, tenants);

        const tenant2: Tenant = {
          ...mockTenant,
          id: consumerId2,
          name: "A tenant2",
        };
        await addOneTenant(tenant2, postgresDB, tenants);

        const tenant3: Tenant = {
          ...mockTenant,
          id: consumerId3,
          name: "A tenant3",
        };
        await addOneTenant(tenant3, postgresDB, tenants);

        const result1 = await readModelService.getConsumers({
          consumerName: tenant1.name,
          producerId: organizationId,
          offset: 0,
          limit: 50,
        });
        expect(result1.totalCount).toBe(0);
      });
    });
    describe("getProducers", () => {
      it("should get producers by name", async () => {
        const organizationId = uuidv4();
        const consumerId1 = uuidv4();
        const consumerId2 = uuidv4();

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
          producerId: organizationId,
        };
        await addOneEService(eService1, eservices);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "B",
          descriptors: [descriptor2],
          producerId: organizationId,
        };
        await addOneEService(eService2, eservices);

        const mockTenant = getMockTenant();

        const tenantProducer: Tenant = {
          ...mockTenant,
          id: organizationId,
          name: "A tenantProducer",
        };
        await addOneTenant(tenantProducer, postgresDB, tenants); // postgresDB,?????

        const tenant1: Tenant = {
          ...mockTenant,
          id: consumerId1,
          name: "A tenant1",
        };
        await addOneTenant(tenant1, postgresDB, tenants); // postgresDB,?????

        const tenant2: Tenant = {
          ...mockTenant,
          id: consumerId2,
          name: "A tenant2",
        };
        await addOneTenant(tenant2, postgresDB, tenants);

        const agreementEservice1 = getMockAgreement({
          eServiceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: organizationId,
          consumerId: consumerId1,
        });

        await addOneAgreement(agreementEservice1, agreements);

        const agreementEservice2 = getMockAgreement({
          eServiceId: eService2.id,
          descriptorId: descriptor2.id,
          producerId: organizationId,
          consumerId: consumerId2,
        });
        await addOneAgreement(agreementEservice2, agreements);

        const result1 = await readModelService.getProducers({
          name: tenantProducer.name,
          offset: 0,
          limit: 50,
        });
        expect(result1.totalCount).toBe(1);
      });
      it("should not get any tenants if no one matches the requested name", async () => {
        const organizationId = uuidv4();
        const consumerId1 = uuidv4();
        const consumerId2 = uuidv4();

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
          producerId: organizationId,
        };
        await addOneEService(eService1, eservices);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "B",
          descriptors: [descriptor2],
          producerId: organizationId,
        };
        await addOneEService(eService2, eservices);

        const mockTenant = getMockTenant();

        const tenantProducer: Tenant = {
          ...mockTenant,
          id: organizationId,
          name: "A tenantProducer",
        };
        await addOneTenant(tenantProducer, postgresDB, tenants);

        const tenant1: Tenant = {
          ...mockTenant,
          id: consumerId1,
          name: "A tenant1",
        };
        await addOneTenant(tenant1, postgresDB, tenants);

        const tenant2: Tenant = {
          ...mockTenant,
          id: consumerId2,
          name: "A tenant2",
        };
        await addOneTenant(tenant2, postgresDB, tenants);

        const agreementEservice1 = getMockAgreement({
          eServiceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: organizationId,
          consumerId: consumerId1,
        });

        await addOneAgreement(agreementEservice1, agreements);

        const agreementEservice2 = getMockAgreement({
          eServiceId: eService2.id,
          descriptorId: descriptor2.id,
          producerId: organizationId,
          consumerId: consumerId2,
        });
        await addOneAgreement(agreementEservice2, agreements);

        const result1 = await readModelService.getProducers({
          name: tenant1.name,
          offset: 0,
          limit: 50,
        });
        expect(result1.totalCount).toBe(0);
      });
    });
    describe("getTenantById", () => {
      it("TO DO", () => {
        expect(2).toBe(2);
      });
    });
  });
});
