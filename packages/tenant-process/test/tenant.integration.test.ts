/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-floating-promises */

import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { GenericContainer } from "testcontainers";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import {
  AgreementCollection,
  AttributeCollection,
  EServiceCollection,
  ReadModelRepository,
  TenantCollection,
  initDB,
} from "pagopa-interop-commons";
import { IDatabase } from "pg-promise";
import {
  Attribute,
  Descriptor,
  EService,
  Tenant,
  TenantCreatedV1,
  TenantId,
  TenantUpdatedV1,
  descriptorState,
  generateId,
  operationForbidden,
  tenantKind,
  unsafeBrandId,
} from "pagopa-interop-models";
import { config } from "../src/utilities/config.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readModelService.js";
import {
  TenantService,
  tenantServiceBuilder,
} from "../src/services/tenantService.js";
import { toTenantV1 } from "../src/model/domain/toEvent.js";
import { UpdateVerifiedTenantAttributeSeed } from "../src/model/domain/models.js";
import {
  attributeNotFound,
  expirationDateCannotBeInThePast,
  organizationNotFoundInVerifiers,
  selfcareIdConflict,
  tenantDuplicate,
  tenantNotFound,
  verifiedAttributeNotFoundInTenant,
} from "../src/model/domain/errors.js";
import {
  ApiInternalTenantSeed,
  ApiM2MTenantSeed,
  ApiSelfcareTenantSeed,
} from "../src/model/types.js";
import { getTenantKind } from "../src/services/validators.js";
import {
  addOneAgreement,
  addOneAttribute,
  addOneEService,
  addOneTenant,
  currentDate,
  decodeProtobufPayload,
  getMockAgreement,
  getMockAuthData,
  getMockCertifiedTenantAttribute,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
  getMockVerifiedBy,
  getMockVerifiedTenantAttribute,
  readLastEventByStreamId,
} from "./utils.js";

describe("Integration tests", () => {
  let tenants: TenantCollection;
  let agreements: AgreementCollection;
  let eservices: EServiceCollection;
  let attributes: AttributeCollection;
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
    ({ tenants, agreements, eservices, attributes } =
      ReadModelRepository.init(config));
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
  const mockVerifiedBy = getMockVerifiedBy();
  const mockVerifiedTenantAttribute = getMockVerifiedTenantAttribute();
  const mockCertifiedTenantAttribute = getMockCertifiedTenantAttribute();

  afterEach(async () => {
    await tenants.deleteMany({});
    await agreements.deleteMany({});
    await eservices.deleteMany({});
    await postgresDB.none("TRUNCATE TABLE tenant.events RESTART IDENTITY");
  });

  describe("tenantService", () => {
    describe("createTenant", () => {
      it("Should create a tenant", async () => {
        const kind = tenantKind.PA;
        const selfcareId = generateId();
        const tenantSeed: ApiSelfcareTenantSeed = {
          externalId: {
            origin: "IPA",
            value: "123456",
          },
          name: "A tenant",
          selfcareId,
        };
        const id = await tenantService.createTenant(tenantSeed, [], kind);
        expect(id).toBeDefined();
        const writtenEvent = await readLastEventByStreamId(id, postgresDB);
        expect(writtenEvent.stream_id).toBe(id);
        expect(writtenEvent.version).toBe("0");
        expect(writtenEvent.type).toBe("TenantCreated");
        const writtenPayload = decodeProtobufPayload({
          messageType: TenantCreatedV1,
          payload: writtenEvent.data,
        });
        const tenant: Tenant = {
          ...mockTenant,
          id: unsafeBrandId(id),
          kind,
          selfcareId: undefined,
          createdAt: new Date(Number(writtenPayload.tenant?.createdAt)),
        };

        expect(writtenPayload.tenant).toEqual(toTenantV1(tenant));
      });
      it("Should create a tenant with attributes", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date());
        const kind = tenantKind.PA;
        const tenantSeed: ApiInternalTenantSeed | ApiM2MTenantSeed = {
          externalId: {
            origin: "IPA",
            value: "123456",
          },
          certifiedAttributes: [
            {
              origin: "API",
              code: "1234567",
            },
          ],
          name: "A tenant",
        };
        const attribute: Attribute = {
          name: "An Attribute",
          id: generateId(),
          kind: "Certified",
          description: "a Description",
          creationTime: new Date(),
          code: "1234567",
          origin: "API",
        };
        await addOneAttribute(attribute, attributes);
        const attributesExternalIds = {
          value: attribute.code!,
          origin: attribute.origin!,
        };
        const id = await tenantService.createTenant(
          tenantSeed,
          [attributesExternalIds],
          kind
        );
        expect(id).toBeDefined();
        const writtenEvent = await readLastEventByStreamId(id, postgresDB);
        expect(writtenEvent.stream_id).toBe(id);
        expect(writtenEvent.version).toBe("0");
        expect(writtenEvent.type).toBe("TenantCreated");
        const writtenPayload = decodeProtobufPayload({
          messageType: TenantCreatedV1,
          payload: writtenEvent.data,
        });
        const tenant: Tenant = {
          ...mockTenant,
          attributes: [
            {
              ...mockCertifiedTenantAttribute,
              id: attribute.id,
              assignmentTimestamp: new Date(),
            },
          ],
          id: unsafeBrandId(id),
          createdAt: new Date(Number(writtenPayload.tenant?.createdAt)),
          selfcareId: undefined,
          kind,
        };

        expect(writtenPayload.tenant).toEqual(toTenantV1(tenant));
        vi.useRealTimers();
      });
      it("Should throw a AttributeNotFound error when create a tenant with attribute", async () => {
        const kind = tenantKind.PA;

        const tenantSeed: ApiInternalTenantSeed | ApiM2MTenantSeed = {
          externalId: {
            origin: "IPA",
            value: "123456",
          },
          certifiedAttributes: [
            {
              origin: "API",
              code: "1234567",
            },
          ],
          name: "A tenant",
        };

        const attributesExternalIds = {
          value: "123",
          origin: "FakeOrigin",
        };
        expect(
          tenantService.createTenant(tenantSeed, [attributesExternalIds], kind)
        ).rejects.toThrowError(
          attributeNotFound(
            `${attributesExternalIds.origin}/${attributesExternalIds.value}`
          )
        );
      });
      it("Should throw a tenantDuplicate error", async () => {
        const kind = tenantKind.PA;
        const selfcareId = generateId();
        const attributeTenantSeed = {
          externalId: {
            origin: "IPA",
            value: "123456",
          },
          name: "A tenant",
          selfcareId,
        };
        await addOneTenant(mockTenant, postgresDB, tenants);
        expect(
          tenantService.createTenant(attributeTenantSeed, [], kind)
        ).rejects.toThrowError(tenantDuplicate(mockTenant.name));
      });
    });
    describe("updateTenant", async () => {
      const tenantSeed = {
        externalId: {
          origin: "IPA",
          value: "123456",
        },
        name: "A tenant",
        selfcareId: generateId(),
      };
      const tenant: Tenant = {
        ...mockTenant,
        selfcareId: undefined,
      };
      it("Should update the tenant", async () => {
        await addOneTenant(tenant, postgresDB, tenants);
        const kind = tenantKind.PA;
        const selfcareId = generateId();
        const tenantSeed: ApiSelfcareTenantSeed = {
          externalId: {
            origin: "IPA",
            value: "123456",
          },
          name: "A tenant",
          selfcareId,
        };
        const mockAuthData = getMockAuthData(tenant.id);

        await tenantService.selfcareUpsertTenant({
          tenantSeed,
          authData: mockAuthData,
        });

        const writtenEvent = await readLastEventByStreamId(
          mockTenant.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(tenant.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("TenantUpdated");
        const writtenPayload = decodeProtobufPayload({
          messageType: TenantUpdatedV1,
          payload: writtenEvent.data,
        });

        const updatedTenant: Tenant = {
          ...tenant,
          selfcareId,
          kind,
          updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
        };

        expect(writtenPayload.tenant).toEqual(toTenantV1(updatedTenant));
      });
      it("Should create a tenant by the upsert", async () => {
        const mockAuthData = getMockAuthData(mockTenant.id);
        const tenantSeed = {
          externalId: {
            origin: "Nothing",
            value: "0",
          },
          name: "A tenant",
          selfcareId: generateId(),
        };
        const id = await tenantService.selfcareUpsertTenant({
          tenantSeed,
          authData: mockAuthData,
        });
        expect(id).toBeDefined();
        const writtenEvent = await readLastEventByStreamId(id, postgresDB);
        expect(writtenEvent.stream_id).toBe(id);
        expect(writtenEvent.version).toBe("0");
        expect(writtenEvent.type).toBe("TenantCreated");
        const writtenPayload = decodeProtobufPayload({
          messageType: TenantCreatedV1,
          payload: writtenEvent.data,
        });
        const tenant: Tenant = {
          ...mockTenant,
          externalId: tenantSeed.externalId,
          id: unsafeBrandId(id),
          kind: getTenantKind([], tenantSeed.externalId),
          selfcareId: tenantSeed.selfcareId,
          createdAt: new Date(Number(writtenPayload.tenant?.createdAt)),
        };

        expect(writtenPayload.tenant).toEqual(toTenantV1(tenant));
      });
      it("Should throw operation forbidden", async () => {
        await addOneTenant(tenant, postgresDB, tenants);
        const mockAuthData = getMockAuthData(generateId<TenantId>());

        expect(
          tenantService.selfcareUpsertTenant({
            tenantSeed,
            authData: mockAuthData,
          })
        ).rejects.toThrowError(operationForbidden);
      });
      it("Should throw selfcareIdConflict error", async () => {
        const tenant: Tenant = {
          ...mockTenant,
          selfcareId: generateId(),
        };
        await addOneTenant(tenant, postgresDB, tenants);
        const newTenantSeed = {
          ...tenantSeed,
          selfcareId: generateId(),
        };
        const mockAuthData = getMockAuthData(tenant.id);
        expect(
          tenantService.selfcareUpsertTenant({
            tenantSeed: newTenantSeed,
            authData: mockAuthData,
          })
        ).rejects.toThrowError(
          selfcareIdConflict({
            tenantId: tenant.id,
            existingSelfcareId: tenant.selfcareId!,
            newSelfcareId: newTenantSeed.selfcareId,
          })
        );
      });
    });
    describe("updateTenantVerifiedAttribute", async () => {
      const expirationDate = new Date(
        currentDate.setDate(currentDate.getDate() + 1)
      );

      const updateVerifiedTenantAttributeSeed: UpdateVerifiedTenantAttributeSeed =
        {
          expirationDate: expirationDate.toISOString(),
        };

      const tenant: Tenant = {
        ...mockTenant,
        attributes: [
          {
            ...mockVerifiedTenantAttribute,
            verifiedBy: [
              {
                ...mockVerifiedBy,
                expirationDate,
              },
            ],
          },
        ],
        updatedAt: currentDate,
        name: "A tenant",
      };
      const attributeId = tenant.attributes.map((a) => a.id)[0];
      const verifierId = mockVerifiedBy.id;
      it("Should update the expirationDate", async () => {
        await addOneTenant(tenant, postgresDB, tenants);
        await tenantService.updateTenantVerifiedAttribute({
          verifierId,
          tenantId: tenant.id,
          attributeId,
          updateVerifiedTenantAttributeSeed,
        });
        const writtenEvent = await readLastEventByStreamId(
          tenant.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(tenant.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("TenantUpdated");
        const writtenPayload = decodeProtobufPayload({
          messageType: TenantUpdatedV1,
          payload: writtenEvent.data,
        });

        const updatedTenant: Tenant = {
          ...tenant,
          updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
        };

        expect(writtenPayload.tenant).toEqual(toTenantV1(updatedTenant));
      });
      it("Should throw tenantNotFound when tenant doesn't exist", async () => {
        expect(
          tenantService.updateTenantVerifiedAttribute({
            verifierId,
            tenantId: tenant.id,
            attributeId,
            updateVerifiedTenantAttributeSeed,
          })
        ).rejects.toThrowError(tenantNotFound(tenant.id));
      });

      it("Should throw expirationDateCannotBeInThePast when expiration date is in the past", async () => {
        const expirationDateinPast = new Date(
          currentDate.setDate(currentDate.getDate() - 1)
        );

        const updateVerifiedTenantAttributeSeed: UpdateVerifiedTenantAttributeSeed =
          {
            expirationDate: expirationDateinPast.toISOString(),
          };

        await addOneTenant(tenant, postgresDB, tenants);
        expect(
          tenantService.updateTenantVerifiedAttribute({
            verifierId,
            tenantId: tenant.id,
            attributeId,
            updateVerifiedTenantAttributeSeed,
          })
        ).rejects.toThrowError(
          expirationDateCannotBeInThePast(expirationDateinPast)
        );
      });
      it("Should throw verifiedAttributeNotFoundInTenant when the attribute is not verified", async () => {
        const updatedCertifiedTenant: Tenant = {
          ...mockTenant,
          attributes: [{ ...getMockCertifiedTenantAttribute() }],
          updatedAt: currentDate,
          name: "A updatedCertifiedTenant",
        };
        const attributeId = updatedCertifiedTenant.attributes.map(
          (a) => a.id
        )[0];
        await addOneTenant(updatedCertifiedTenant, postgresDB, tenants);
        expect(
          tenantService.updateTenantVerifiedAttribute({
            verifierId: generateId(),
            tenantId: updatedCertifiedTenant.id,
            attributeId,
            updateVerifiedTenantAttributeSeed,
          })
        ).rejects.toThrowError(
          verifiedAttributeNotFoundInTenant(
            updatedCertifiedTenant.id,
            attributeId
          )
        );
      });
      it("Should throw organizationNotFoundInVerifiers when the organization is not verified", async () => {
        await addOneTenant(tenant, postgresDB, tenants);
        const verifierId = generateId();
        expect(
          tenantService.updateTenantVerifiedAttribute({
            verifierId,
            tenantId: tenant.id,
            attributeId,
            updateVerifiedTenantAttributeSeed,
          })
        ).rejects.toThrowError(
          organizationNotFoundInVerifiers(verifierId, tenant.id, attributeId)
        );
      });
    });
  });
  describe("readModelService", () => {
    const tenant1: Tenant = {
      ...mockTenant,
      id: generateId(),
      name: "A tenant1",
    };
    const tenant2: Tenant = {
      ...mockTenant,
      id: generateId(),
      name: "A tenant2",
    };
    const tenant3: Tenant = {
      ...mockTenant,
      id: generateId(),
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
          id: generateId(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1, eservices);

        const agreementEservice1 = getMockAgreement({
          eserviceId: eService1.id,
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
          id: generateId(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2, eservices);

        const agreementEservice2 = getMockAgreement({
          eserviceId: eService2.id,
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
          id: generateId(),
          name: "C",
          descriptors: [descriptor3],
          producerId: eService1.producerId,
        };
        await addOneEService(eService3, eservices);

        const agreementEservice3 = getMockAgreement({
          eserviceId: eService3.id,
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
          id: generateId(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1, eservices);

        const agreementEservice1 = getMockAgreement({
          eserviceId: eService1.id,
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
          id: generateId(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2, eservices);

        const agreementEservice2 = getMockAgreement({
          eserviceId: eService2.id,
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
          id: generateId(),
          name: "C",
          descriptors: [descriptor3],
          producerId: eService1.producerId,
        };
        await addOneEService(eService3, eservices);

        const agreementEservice3 = getMockAgreement({
          eserviceId: eService3.id,
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1, eservices);

        const agreementEservice1 = getMockAgreement({
          eserviceId: eService1.id,
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
          id: generateId(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2, eservices);

        const agreementEservice2 = getMockAgreement({
          eserviceId: eService2.id,
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
          id: generateId(),
          name: "C",
          descriptors: [descriptor3],
          producerId: eService1.producerId,
        };
        await addOneEService(eService3, eservices);

        const agreementEservice3 = getMockAgreement({
          eserviceId: eService3.id,
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
          id: generateId(),
          name: "A",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1, eservices);

        const agreementEservice1 = getMockAgreement({
          eserviceId: eService1.id,
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
          id: generateId(),
          name: "B",
          descriptors: [descriptor2],
          producerId: eService1.producerId,
        };
        await addOneEService(eService2, eservices);

        const agreementEservice2 = getMockAgreement({
          eserviceId: eService2.id,
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
          id: generateId(),
          name: "C",
          descriptors: [descriptor3],
          producerId: eService1.producerId,
        };
        await addOneEService(eService3, eservices);

        const agreementEservice3 = getMockAgreement({
          eserviceId: eService3.id,
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
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
          id: generateId(),
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
      it("TO DO", () => {
        expect(2).toBe(2);
      });
    });
  });
});
