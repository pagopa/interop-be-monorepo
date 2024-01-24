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
    describe("getConsumers", () => {
      const organizationProducerId = uuidv4();
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
          producerId: organizationProducerId,
        };
        await addOneEService(eService1, eservices);

        const agreementEservice1 = getMockAgreement({
          eServiceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: organizationProducerId,
          consumerId: consumerId1,
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
          producerId: organizationProducerId,
        };
        await addOneEService(eService2, eservices);

        const agreementEservice2 = getMockAgreement({
          eServiceId: eService2.id,
          descriptorId: descriptor2.id,
          producerId: organizationProducerId,
          consumerId: consumerId2,
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
          producerId: organizationProducerId,
        };
        await addOneEService(eService3, eservices);

        const agreementEservice3 = getMockAgreement({
          eServiceId: eService3.id,
          descriptorId: descriptor3.id,
          producerId: organizationProducerId,
          consumerId: consumerId3,
        });
        await addOneAgreement(agreementEservice3, agreements);

        const consumers = await readModelService.getConsumers({
          consumerName: undefined,
          producerId: organizationProducerId,
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
          producerId: organizationProducerId,
        };
        await addOneEService(eService1, eservices);

        const agreementEservice1 = getMockAgreement({
          eServiceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: organizationProducerId,
          consumerId: consumerId1,
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
          producerId: organizationProducerId,
        };
        await addOneEService(eService2, eservices);

        const agreementEservice2 = getMockAgreement({
          eServiceId: eService2.id,
          descriptorId: descriptor2.id,
          producerId: organizationProducerId,
          consumerId: consumerId2,
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
          producerId: organizationProducerId,
        };
        await addOneEService(eService3, eservices);

        const agreementEservice3 = getMockAgreement({
          eServiceId: eService3.id,
          descriptorId: descriptor3.id,
          producerId: organizationProducerId,
          consumerId: consumerId3,
        });
        await addOneAgreement(agreementEservice3, agreements);

        const consumers = await readModelService.getConsumers({
          consumerName: tenant1.name,
          producerId: organizationProducerId,
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
          producerId: organizationProducerId,
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
          producerId: organizationProducerId,
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
          producerId: organizationProducerId,
        };
        await addOneEService(eService3, eservices);

        const consumers = await readModelService.getConsumers({
          consumerName: undefined,
          producerId: organizationProducerId,
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
          producerId: organizationProducerId,
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
          producerId: organizationProducerId,
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
          producerId: organizationProducerId,
        };
        await addOneEService(eService3, eservices);

        const consumers = await readModelService.getConsumers({
          consumerName: "A tenant4",
          producerId: organizationProducerId,
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
          producerId: organizationProducerId,
        };
        await addOneEService(eService1, eservices);

        const agreementEservice1 = getMockAgreement({
          eServiceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: organizationProducerId,
          consumerId: consumerId1,
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
          producerId: organizationProducerId,
        };
        await addOneEService(eService2, eservices);

        const agreementEservice2 = getMockAgreement({
          eServiceId: eService2.id,
          descriptorId: descriptor2.id,
          producerId: organizationProducerId,
          consumerId: consumerId2,
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
          producerId: organizationProducerId,
        };
        await addOneEService(eService3, eservices);

        const agreementEservice3 = getMockAgreement({
          eServiceId: eService3.id,
          descriptorId: descriptor3.id,
          producerId: organizationProducerId,
          consumerId: consumerId3,
        });
        await addOneAgreement(agreementEservice3, agreements);

        const tenantsByName = await readModelService.getConsumers({
          consumerName: undefined,
          producerId: organizationProducerId,
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
          producerId: organizationProducerId,
        };
        await addOneEService(eService1, eservices);

        const agreementEservice1 = getMockAgreement({
          eServiceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: organizationProducerId,
          consumerId: consumerId1,
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
          producerId: organizationProducerId,
        };
        await addOneEService(eService2, eservices);

        const agreementEservice2 = getMockAgreement({
          eServiceId: eService2.id,
          descriptorId: descriptor2.id,
          producerId: organizationProducerId,
          consumerId: consumerId2,
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
          producerId: organizationProducerId,
        };
        await addOneEService(eService3, eservices);

        const agreementEservice3 = getMockAgreement({
          eServiceId: eService3.id,
          descriptorId: descriptor3.id,
          producerId: organizationProducerId,
          consumerId: consumerId3,
        });
        await addOneAgreement(agreementEservice3, agreements);

        const tenantsByName = await readModelService.getConsumers({
          consumerName: undefined,
          producerId: organizationProducerId,
          offset: 2,
          limit: 3,
        });
        expect(tenantsByName.results.length).toBe(1);
      });
    });
    describe("getProducers", () => {
      const organizationProducerId1 = uuidv4();
      const organizationProducerId2 = uuidv4();
      const organizationProducerId3 = uuidv4();
      const mockTenant = getMockTenant();

      const tenantProducer1: Tenant = {
        ...mockTenant,
        id: organizationProducerId1,
        name: "A tenantProducer1",
      };
      const tenantProducer2: Tenant = {
        ...mockTenant,
        id: organizationProducerId2,
        name: "A tenantProducer2",
      };
      const tenantProducer3: Tenant = {
        ...mockTenant,
        id: organizationProducerId3,
        name: "A tenantProducer3",
      };
      it("should get producers", async () => {
        await addOneTenant(tenantProducer1, postgresDB, tenants);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
          producerId: organizationProducerId1,
        };
        await addOneEService(eService1, eservices);

        await addOneTenant(tenantProducer2, postgresDB, tenants);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor2],
          producerId: organizationProducerId2,
        };
        await addOneEService(eService2, eservices);

        await addOneTenant(tenantProducer3, postgresDB, tenants);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor3],
          producerId: organizationProducerId3,
        };
        await addOneEService(eService3, eservices);

        const producers = await readModelService.getProducers({
          producerName: undefined,
          offset: 0,
          limit: 50,
        });
        expect(producers.totalCount).toBe(3);
        expect(producers.results).toEqual([
          tenantProducer1,
          tenantProducer2,
          tenantProducer3,
        ]);
      });
      it("should get producers by name", async () => {
        await addOneTenant(tenantProducer1, postgresDB, tenants);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
          producerId: organizationProducerId1,
        };
        await addOneEService(eService1, eservices);

        await addOneTenant(tenantProducer2, postgresDB, tenants);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor2],
          producerId: organizationProducerId2,
        };
        await addOneEService(eService2, eservices);

        const producers = await readModelService.getProducers({
          producerName: tenantProducer1.name,
          offset: 0,
          limit: 50,
        });
        expect(producers.totalCount).toBe(1);
        expect(producers.results).toEqual([tenantProducer1]);
      });
      it("should not get any tenants if no one matches the requested name", async () => {
        await addOneTenant(tenantProducer1, postgresDB, tenants);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
          producerId: organizationProducerId1,
        };
        await addOneEService(eService1, eservices);

        await addOneTenant(tenantProducer2, postgresDB, tenants);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor2],
          producerId: organizationProducerId2,
        };
        await addOneEService(eService2, eservices);

        const producers = await readModelService.getProducers({
          producerName: "A tenantProducer6",
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
          producerId: organizationProducerId1,
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
          producerId: organizationProducerId2,
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
        await addOneTenant(tenantProducer1, postgresDB, tenants);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
          producerId: organizationProducerId1,
        };
        await addOneEService(eService1, eservices);

        await addOneTenant(tenantProducer2, postgresDB, tenants);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor2],
          producerId: organizationProducerId2,
        };
        await addOneEService(eService2, eservices);

        await addOneTenant(tenantProducer3, postgresDB, tenants);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor3],
          producerId: organizationProducerId3,
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
        await addOneTenant(tenantProducer1, postgresDB, tenants);

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor1],
          producerId: organizationProducerId1,
        };
        await addOneEService(eService1, eservices);

        await addOneTenant(tenantProducer2, postgresDB, tenants);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor2],
          producerId: organizationProducerId2,
        };
        await addOneEService(eService2, eservices);

        await addOneTenant(tenantProducer3, postgresDB, tenants);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };

        const eService3: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "A",
          descriptors: [descriptor3],
          producerId: organizationProducerId3,
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
        expect(tenantById?.data.id).toEqual(tenant1.id);
      });
      it("should not get the tenant by ID", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);
        await addOneTenant(tenant2, postgresDB, tenants);
        await addOneTenant(tenant3, postgresDB, tenants);
        const tenantById = await readModelService.getTenantById(uuidv4());
        expect(tenantById?.data.id).toBeUndefined();
      });
      it("should not get the tenant by ID if it isn't in DB", async () => {
        const tenantById = await readModelService.getTenantById(tenant1.id);
        expect(tenantById?.data.id).toBeUndefined();
      });
    });
    describe("getTenantBySelfcareId", () => {
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
      const selfcareId =
        tenant1.selfcareId !== undefined ? tenant1.selfcareId : uuidv4();
      it("should get the tenant by selfcareId", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);
        await addOneTenant(tenant2, postgresDB, tenants);
        await addOneTenant(tenant3, postgresDB, tenants);
        const tenantBySelfcareId = await readModelService.getTenantBySelfcareId(
          selfcareId
        );
        expect(tenantBySelfcareId?.data.selfcareId).toEqual(tenant1.selfcareId);
      });
      it("should not get the tenant by selfcareId", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);
        await addOneTenant(tenant2, postgresDB, tenants);
        await addOneTenant(tenant3, postgresDB, tenants);
        const tenantBySelfcareId = await readModelService.getTenantBySelfcareId(
          uuidv4()
        );
        expect(tenantBySelfcareId?.data.selfcareId).toBeUndefined();
      });
      it("should not get the tenant by selfcareId if it isn't in DB", async () => {
        const tenantBySelfcareId = await readModelService.getTenantBySelfcareId(
          selfcareId
        );
        expect(tenantBySelfcareId?.data.selfcareId).toBeUndefined();
      });
    });
    describe("getTenantByExternalId", () => {
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
      it("should get the tenant by externalId", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);
        await addOneTenant(tenant2, postgresDB, tenants);
        await addOneTenant(tenant3, postgresDB, tenants);
        const tenantByExternalId = await readModelService.getTenantByExternalId(
          { value: tenant1.externalId.value, origin: tenant1.externalId.origin }
        );
        expect(tenantByExternalId?.data.externalId).toEqual(tenant1.externalId);
      });
      it("should not get the tenant by externalId", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);
        await addOneTenant(tenant2, postgresDB, tenants);
        await addOneTenant(tenant3, postgresDB, tenants);
        const tenantByExternalId = await readModelService.getTenantByExternalId(
          { value: "value", origin: "origin" }
        );
        expect(tenantByExternalId?.data.externalId).toBeUndefined();
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
