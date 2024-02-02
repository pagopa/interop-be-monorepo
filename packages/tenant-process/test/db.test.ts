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
  const mockTenant = getMockTenant();

  afterEach(async () => {
    await tenants.deleteMany({});
    await agreements.deleteMany({});
    await eservices.deleteMany({});
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
    const tenant1: Tenant = {
      ...mockTenant,
      id: uuidv4(),
      name: "A tenant1",
    };
    const tenant2: Tenant = {
      ...mockTenant,
      id: uuidv4(),
      name: "A tenant2",
    };
    const tenant3: Tenant = {
      ...mockTenant,
      id: uuidv4(),
      name: "A tenant3",
    };
    describe("getConsumers", () => {
      it("should get the tenants consuming any of the eservices of a specific producerId", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1, eservices);

        const agreementEservice1 = getMockAgreement({
          eServiceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: eService1.producerId,
          consumerId: tenant1.id,
        });
        await addOneAgreement(agreementEservice1, agreements);

        await addOneTenant(tenant2, postgresDB, tenants);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2, eservices);

        const agreementEservice2 = getMockAgreement({
          eServiceId: eService2.id,
          descriptorId: descriptor2.id,
          producerId: eService2.producerId,
          consumerId: tenant2.id,
        });
        await addOneAgreement(agreementEservice2, agreements);

        await addOneTenant(tenant3, postgresDB, tenants);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "C",
          descriptors: [descriptor3],
          producerId: eService1.producerId,
        };
        await addOneEService(eService3, eservices);

        const agreementEservice3 = getMockAgreement({
          eServiceId: eService3.id,
          descriptorId: descriptor3.id,
          producerId: eService3.producerId,
          consumerId: tenant3.id,
        });
        await addOneAgreement(agreementEservice3, agreements);

        const consumers = await readModelService.getConsumers({
          consumerName: undefined,
          producerId: eService1.producerId,
          offset: 0,
          limit: 50,
        });
        expect(consumers.totalCount).toBe(3);
        expect(consumers.results).toEqual([tenant1, tenant2, tenant3]);
      });
      it("should get the tenants consuming any of the eservices of a specific name", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1, eservices);

        const agreementEservice1 = getMockAgreement({
          eServiceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: eService1.producerId,
          consumerId: tenant1.id,
        });
        await addOneAgreement(agreementEservice1, agreements);

        await addOneTenant(tenant2, postgresDB, tenants);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2, eservices);

        const agreementEservice2 = getMockAgreement({
          eServiceId: eService2.id,
          descriptorId: descriptor2.id,
          producerId: eService2.producerId,
          consumerId: tenant2.id,
        });
        await addOneAgreement(agreementEservice2, agreements);

        await addOneTenant(tenant3, postgresDB, tenants);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "C",
          descriptors: [descriptor3],
          producerId: eService1.producerId,
        };
        await addOneEService(eService3, eservices);

        const agreementEservice3 = getMockAgreement({
          eServiceId: eService3.id,
          descriptorId: descriptor3.id,
          producerId: eService3.producerId,
          consumerId: tenant3.id,
        });
        await addOneAgreement(agreementEservice3, agreements);

        const consumers = await readModelService.getConsumers({
          consumerName: tenant1.name,
          producerId: eService1.producerId,
          offset: 0,
          limit: 50,
        });
        expect(consumers.totalCount).toBe(1);
        expect(consumers.results).toEqual([tenant1]);
      });
      it("should not get any tenants, if no one is consuming any of the eservices of a specific producerId", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1, eservices);

        await addOneTenant(tenant2, postgresDB, tenants);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2, eservices);

        await addOneTenant(tenant3, postgresDB, tenants);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "C",
          descriptors: [descriptor3],
          producerId: eService1.producerId,
        };
        await addOneEService(eService3, eservices);

        const consumers = await readModelService.getConsumers({
          consumerName: undefined,
          producerId: eService1.producerId,
          offset: 0,
          limit: 50,
        });
        expect(consumers.totalCount).toBe(0);
        expect(consumers.results).toEqual([]);
      });
      it("should not get any tenants, if no one is consuming any of the eservices of a specific name", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1, eservices);

        await addOneTenant(tenant2, postgresDB, tenants);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2, eservices);

        await addOneTenant(tenant3, postgresDB, tenants);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "C",
          descriptors: [descriptor3],
          producerId: eService1.producerId,
        };
        await addOneEService(eService3, eservices);

        const consumers = await readModelService.getConsumers({
          consumerName: "A tenant4",
          producerId: eService1.producerId,
          offset: 0,
          limit: 50,
        });
        expect(consumers.totalCount).toBe(0);
        expect(consumers.results).toEqual([]);
      });
      it("Should get consumers (pagination: limit)", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1, eservices);

        const agreementEservice1 = getMockAgreement({
          eServiceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: eService1.producerId,
          consumerId: tenant1.id,
        });
        await addOneAgreement(agreementEservice1, agreements);

        await addOneTenant(tenant2, postgresDB, tenants);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2, eservices);

        const agreementEservice2 = getMockAgreement({
          eServiceId: eService2.id,
          descriptorId: descriptor2.id,
          producerId: eService2.producerId,
          consumerId: tenant2.id,
        });
        await addOneAgreement(agreementEservice2, agreements);

        await addOneTenant(tenant3, postgresDB, tenants);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "C",
          descriptors: [descriptor3],
          producerId: eService1.producerId,
        };
        await addOneEService(eService3, eservices);

        const agreementEservice3 = getMockAgreement({
          eServiceId: eService3.id,
          descriptorId: descriptor3.id,
          producerId: eService3.producerId,
          consumerId: tenant3.id,
        });
        await addOneAgreement(agreementEservice3, agreements);

        const tenantsByName = await readModelService.getConsumers({
          consumerName: undefined,
          producerId: eService1.producerId,
          offset: 0,
          limit: 2,
        });
        expect(tenantsByName.results.length).toBe(2);
      });
      it("Should get consumers (pagination: offset, limit)", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1, eservices);

        const agreementEservice1 = getMockAgreement({
          eServiceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: eService1.producerId,
          consumerId: tenant1.id,
        });
        await addOneAgreement(agreementEservice1, agreements);

        await addOneTenant(tenant2, postgresDB, tenants);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2, eservices);

        const agreementEservice2 = getMockAgreement({
          eServiceId: eService2.id,
          descriptorId: descriptor2.id,
          producerId: eService2.producerId,
          consumerId: tenant2.id,
        });
        await addOneAgreement(agreementEservice2, agreements);

        await addOneTenant(tenant3, postgresDB, tenants);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "C",
          descriptors: [descriptor3],
          producerId: eService1.producerId,
        };
        await addOneEService(eService3, eservices);

        const agreementEservice3 = getMockAgreement({
          eServiceId: eService3.id,
          descriptorId: descriptor3.id,
          producerId: eService3.producerId,
          consumerId: tenant3.id,
        });
        await addOneAgreement(agreementEservice3, agreements);

        const tenantsByName = await readModelService.getConsumers({
          consumerName: undefined,
          producerId: eService1.producerId,
          offset: 2,
          limit: 3,
        });
        expect(tenantsByName.results.length).toBe(1);
      });
    });
    describe("getProducers", () => {
      it("should get producers", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1, eservices);

        await addOneTenant(tenant2, postgresDB, tenants);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor2],
          producerId: tenant2.id,
        };
        await addOneEService(eService2, eservices);

        await addOneTenant(tenant3, postgresDB, tenants);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor3],
          producerId: tenant3.id,
        };
        await addOneEService(eService3, eservices);

        const producers = await readModelService.getProducers({
          producerName: undefined,
          offset: 0,
          limit: 50,
        });
        expect(producers.totalCount).toBe(3);
        expect(producers.results).toEqual([tenant1, tenant2, tenant3]);
      });
      it("should get producers by name", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1, eservices);

        await addOneTenant(tenant2, postgresDB, tenants);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor2],
          producerId: tenant2.id,
        };
        await addOneEService(eService2, eservices);

        const producers = await readModelService.getProducers({
          producerName: tenant1.name,
          offset: 0,
          limit: 50,
        });
        expect(producers.totalCount).toBe(1);
        expect(producers.results).toEqual([tenant1]);
      });
      it("should not get any tenants if no one matches the requested name", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1, eservices);

        await addOneTenant(tenant2, postgresDB, tenants);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor2],
          producerId: tenant2.id,
        };
        await addOneEService(eService2, eservices);

        const producers = await readModelService.getProducers({
          producerName: "A tenant6",
          offset: 0,
          limit: 50,
        });
        expect(producers.totalCount).toBe(0);
        expect(producers.results).toEqual([]);
      });
      it("should not get any tenants if no one is in DB", async () => {
        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1, eservices);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor2],
          producerId: tenant2.id,
        };
        await addOneEService(eService2, eservices);

        const producers = await readModelService.getProducers({
          producerName: "A tenant",
          offset: 0,
          limit: 50,
        });
        expect(producers.totalCount).toBe(0);
        expect(producers.results).toEqual([]);
      });
      it("Should get producers (pagination: limit)", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1, eservices);

        await addOneTenant(tenant2, postgresDB, tenants);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor2],
          producerId: tenant2.id,
        };
        await addOneEService(eService2, eservices);

        await addOneTenant(tenant3, postgresDB, tenants);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor3],
          producerId: tenant3.id,
        };
        await addOneEService(eService3, eservices);
        const tenantsByName = await readModelService.getProducers({
          producerName: undefined,
          offset: 0,
          limit: 3,
        });
        expect(tenantsByName.results.length).toBe(3);
      });
      it("Should get producers (pagination: offset, limit)", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
          producerId: tenant1.id,
        };
        await addOneEService(eService1, eservices);

        await addOneTenant(tenant2, postgresDB, tenants);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor2],
          producerId: tenant2.id,
        };
        await addOneEService(eService2, eservices);

        await addOneTenant(tenant3, postgresDB, tenants);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor3],
          producerId: tenant3.id,
        };
        await addOneEService(eService3, eservices);
        const tenantsByName = await readModelService.getProducers({
          producerName: undefined,
          offset: 2,
          limit: 3,
        });
        expect(tenantsByName.results.length).toBe(1);
      });
    });
    describe("getTenantById", () => {
      const consumerId1 = uuidv4();
      const consumerId2 = uuidv4();
      const consumerId3 = uuidv4();
      const mockTenant = getMockTenant();

      const tenant1: Tenant = {
        ...mockTenant,
        id: consumerId1,
        name: "A tenant1",
      };
      const tenant2: Tenant = {
        ...mockTenant,
        id: consumerId2,
        name: "A tenant2",
      };
      const tenant3: Tenant = {
        ...mockTenant,
        id: consumerId3,
        name: "A tenant3",
      };
      it("should get the tenant by ID", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);
        await addOneTenant(tenant2, postgresDB, tenants);
        await addOneTenant(tenant3, postgresDB, tenants);
        const tenantById = await readModelService.getTenantById(tenant1.id);
        expect(tenantById?.data).toEqual(tenant1);
      });
      it("should not get the tenant by ID if it isn't in DB", async () => {
        const tenantById = await readModelService.getTenantById(tenant1.id);
        expect(tenantById?.data.id).toBeUndefined();
      });
    });
    describe("getTenantBySelfcareId", () => {
      it("should get the tenant by selfcareId", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);
        await addOneTenant(tenant2, postgresDB, tenants);
        await addOneTenant(tenant3, postgresDB, tenants);
        const tenantBySelfcareId = await readModelService.getTenantBySelfcareId(
          selfcareId
        );
        expect(tenantBySelfcareId?.data).toEqual(tenant1);
      });
      it("should not get the tenant by selfcareId if it isn't in DB", async () => {
        const tenantBySelfcareId = await readModelService.getTenantBySelfcareId(
          selfcareId
        );
        expect(tenantBySelfcareId?.data.selfcareId).toBeUndefined();
      });
    });
    describe("getTenantByExternalId", () => {
      it("should get the tenant by externalId", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);
        await addOneTenant(tenant2, postgresDB, tenants);
        await addOneTenant(tenant3, postgresDB, tenants);
        const tenantByExternalId = await readModelService.getTenantByExternalId(
          { value: tenant1.externalId.value, origin: tenant1.externalId.origin }
        );
        expect(tenantByExternalId?.data).toEqual(tenant1);
      });
      it("should not get the tenant by externalId if it isn't in DB", async () => {
        const tenantByExternalId = await readModelService.getTenantByExternalId(
          { value: tenant1.externalId.value, origin: tenant1.externalId.origin }
        );
        expect(tenantByExternalId?.data.externalId).toBeUndefined();
      });
    });
  });
});
