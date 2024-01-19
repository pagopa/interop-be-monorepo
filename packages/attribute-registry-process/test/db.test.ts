/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable functional/no-let */
import { beforeAll, afterEach, describe, expect, it, beforeEach } from "vitest";
import { GenericContainer } from "testcontainers";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import {
  AttributeCollection,
  ReadModelRepository,
  TenantCollection,
  initDB,
} from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { IDatabase } from "pg-promise";
import {
  Attribute,
  AttributeAddedV1,
  Tenant,
  attributeKind,
} from "pagopa-interop-models";
import { config } from "../src/utilities/config.js";
import {
  AttributeRegistryService,
  attributeRegistryServiceBuilder,
} from "../src/services/attributeRegistryService.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readModelService.js";
import {
  OrganizationIsNotACertifier,
  attributeDuplicate,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import { toAttributeV1 } from "../src/model/domain/toEvent.js";
import {
  addOneAttribute,
  addOneTenant,
  decodeProtobufPayload,
  getMockAttribute,
  getMockTenant,
  getMockAuthData,
  readLastEventByStreamId,
} from "./utils.js";

const mockAttribute = getMockAttribute();
const mockTenant = getMockTenant();

describe("database test", () => {
  let attributes: AttributeCollection;
  let tenants: TenantCollection;
  let readModelService: ReadModelService;
  let attributeRegistryService: AttributeRegistryService;
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
    const readModelRepository = ReadModelRepository.init(config);
    ({ attributes, tenants } = readModelRepository);
    readModelService = readModelServiceBuilder(readModelRepository);

    postgresDB = initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: postgreSqlContainer.getMappedPort(5432),
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    });

    attributeRegistryService = attributeRegistryServiceBuilder(
      postgresDB,
      readModelService
    );
  });

  afterEach(async () => {
    await attributes.deleteMany({});
    await tenants.deleteMany({});
    await postgresDB.none("TRUNCATE TABLE attribute.events RESTART IDENTITY");
  });

  describe("attributeRegistryService", () => {
    describe("declared attribute creation", () => {
      it("should write on event-store for the creation of a declared attribute", async () => {
        const id = await attributeRegistryService.createDeclaredAttribute(
          {
            name: mockAttribute.name,
            description: mockAttribute.description,
          },
          getMockAuthData()
        );
        expect(id).toBeDefined();

        const writtenEvent = await readLastEventByStreamId(id, postgresDB);
        expect(writtenEvent.stream_id).toBe(id);
        expect(writtenEvent.version).toBe("0");
        expect(writtenEvent.type).toBe("AttributeAdded");
        const writtenPayload = decodeProtobufPayload({
          messageType: AttributeAddedV1,
          payload: writtenEvent.data,
        });

        const attribute: Attribute = {
          ...mockAttribute,
          id,
          kind: attributeKind.declared,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          creationTime: new Date(writtenPayload.attribute!.creationTime),
        };

        expect(writtenPayload.attribute).toEqual(toAttributeV1(attribute));
      });
      it("should not write on event-store if the attribute already exists", async () => {
        const attribute = {
          ...mockAttribute,
          kind: attributeKind.declared,
        };
        await addOneAttribute(attribute, postgresDB, attributes);
        expect(
          attributeRegistryService.createDeclaredAttribute(
            {
              name: attribute.name,
              description: attribute.description,
            },
            getMockAuthData()
          )
        ).rejects.toThrowError(attributeDuplicate(attribute.name));
      });
    });
    describe("verified attribute creation", () => {
      it("should write on event-store for the creation of a verified attribute", async () => {
        const id = await attributeRegistryService.createVerifiedAttribute(
          {
            name: mockAttribute.name,
            description: mockAttribute.description,
          },
          getMockAuthData()
        );
        expect(id).toBeDefined();

        const writtenEvent = await readLastEventByStreamId(id, postgresDB);
        expect(writtenEvent.stream_id).toBe(id);
        expect(writtenEvent.version).toBe("0");
        expect(writtenEvent.type).toBe("AttributeAdded");

        const writtenPayload = decodeProtobufPayload({
          messageType: AttributeAddedV1,
          payload: writtenEvent.data,
        });

        const attribute: Attribute = {
          ...mockAttribute,
          id,
          kind: attributeKind.verified,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          creationTime: new Date(writtenPayload.attribute!.creationTime),
        };

        expect(writtenPayload.attribute).toEqual(toAttributeV1(attribute));
      });
      it("should not write on event-store if the attribute already exists", async () => {
        const attribute = {
          ...mockAttribute,
          kind: attributeKind.verified,
        };
        await addOneAttribute(attribute, postgresDB, attributes);
        expect(
          attributeRegistryService.createVerifiedAttribute(
            {
              name: attribute.name,
              description: attribute.description,
            },
            getMockAuthData()
          )
        ).rejects.toThrowError(attributeDuplicate(attribute.name));
      });
    });
    describe("certified attribute creation", () => {
      it("should write on event-store for the creation of a certified attribute", async () => {
        const tenant: Tenant = {
          ...mockTenant,
          features: [
            {
              type: "Certifier",
              certifierId: uuidv4(),
            },
          ],
        };

        await addOneTenant(tenant, tenants);

        const id = await attributeRegistryService.createCertifiedAttribute(
          {
            name: mockAttribute.name,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            code: mockAttribute.code!,
            description: mockAttribute.description,
          },
          getMockAuthData(tenant.id)
        );
        expect(id).toBeDefined();

        const writtenEvent = await readLastEventByStreamId(id, postgresDB);
        expect(writtenEvent.stream_id).toBe(id);
        expect(writtenEvent.version).toBe("0");
        expect(writtenEvent.type).toBe("AttributeAdded");
        const writtenPayload = decodeProtobufPayload({
          messageType: AttributeAddedV1,
          payload: writtenEvent.data,
        });

        const attribute: Attribute = {
          ...mockAttribute,
          id,
          kind: attributeKind.certified,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          creationTime: new Date(writtenPayload.attribute!.creationTime),
          origin: tenant.features[0].certifierId,
        };
        expect(writtenPayload.attribute).toEqual(toAttributeV1(attribute));
      });
      it("should throw attributeDuplicate if the attribute already exists", async () => {
        const attribute = {
          ...mockAttribute,
          code: "123456",
        };

        const tenant: Tenant = {
          ...mockTenant,
          features: [
            {
              type: "Certifier",
              certifierId: uuidv4(),
            },
          ],
        };

        await addOneTenant(tenant, tenants);
        await addOneAttribute(attribute, postgresDB, attributes);
        expect(
          attributeRegistryService.createCertifiedAttribute(
            {
              name: attribute.name,
              code: attribute.code,
              description: attribute.description,
            },
            getMockAuthData(tenant.id)
          )
        ).rejects.toThrowError(attributeDuplicate(attribute.name));
      });
      it("should throw OrganizationIsNotACertifier if the organization is not a certifier", async () => {
        await addOneTenant(mockTenant, tenants);
        await addOneAttribute(mockAttribute, postgresDB, attributes);
        expect(
          attributeRegistryService.createCertifiedAttribute(
            {
              name: mockAttribute.name,
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              code: mockAttribute.code!,
              description: mockAttribute.description,
            },
            getMockAuthData(mockTenant.id)
          )
        ).rejects.toThrowError(OrganizationIsNotACertifier(mockTenant.id));
      });
      it("should throw tenantNotFound if the certifier is not found", async () => {
        await addOneAttribute(mockAttribute, postgresDB, attributes);
        expect(
          attributeRegistryService.createCertifiedAttribute(
            {
              name: mockAttribute.name,
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              code: mockAttribute.code!,
              description: mockAttribute.description,
            },
            getMockAuthData(mockTenant.id)
          )
        ).rejects.toThrowError(tenantNotFound(mockTenant.id));
      });
    });
    describe("certified attribute internal creation", () => {
      it("should write on event-store for the internal creation of a certified attribute", async () => {
        const tenant: Tenant = {
          ...mockTenant,
          features: [
            {
              type: "Certifier",
              certifierId: uuidv4(),
            },
          ],
        };

        await addOneTenant(tenant, tenants);

        const id =
          await attributeRegistryService.createInternalCertifiedAttribute({
            name: mockAttribute.name,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            code: mockAttribute.code!,
            origin: tenant.features[0].certifierId,
            description: mockAttribute.description,
          });
        expect(id).toBeDefined();

        const writtenEvent = await readLastEventByStreamId(id, postgresDB);
        expect(writtenEvent.stream_id).toBe(id);
        expect(writtenEvent.version).toBe("0");
        expect(writtenEvent.type).toBe("AttributeAdded");
        const writtenPayload = decodeProtobufPayload({
          messageType: AttributeAddedV1,
          payload: writtenEvent.data,
        });

        const attribute: Attribute = {
          ...mockAttribute,
          id,
          kind: attributeKind.certified,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          creationTime: new Date(writtenPayload.attribute!.creationTime),
          origin: tenant.features[0].certifierId,
        };
        expect(writtenPayload.attribute).toEqual(toAttributeV1(attribute));
      });
      it("should throw attributeDuplicate if the attribute already exists", async () => {
        const attribute = {
          ...mockAttribute,
          code: "123456",
        };

        const tenant: Tenant = {
          ...mockTenant,
          features: [
            {
              type: "Certifier",
              certifierId: uuidv4(),
            },
          ],
        };

        await addOneTenant(tenant, tenants);
        await addOneAttribute(attribute, postgresDB, attributes);
        expect(
          attributeRegistryService.createInternalCertifiedAttribute({
            name: attribute.name,
            code: attribute.code,
            origin: tenant.features[0].certifierId,
            description: attribute.description,
          })
        ).rejects.toThrowError(attributeDuplicate(attribute.name));
      });
    });

    describe("readModelService", () => {
      let attribute1: Attribute;
      let attribute2: Attribute;
      let attribute3: Attribute;
      let attribute4: Attribute;
      let attribute5: Attribute;
      let attribute6: Attribute;
      let attribute7: Attribute;

      beforeEach(async () => {
        attribute1 = {
          ...mockAttribute,
          id: uuidv4(),
          name: "attribute 001 test",
          kind: attributeKind.certified,
          origin: "IPA",
          code: "12345A",
        };
        await addOneAttribute(attribute1, postgresDB, attributes);

        attribute2 = {
          ...mockAttribute,
          id: uuidv4(),
          name: "attribute 002 test",
          kind: attributeKind.certified,
          origin: "IPA",
          code: "12345B",
        };
        await addOneAttribute(attribute2, postgresDB, attributes);

        attribute3 = {
          ...mockAttribute,
          id: uuidv4(),
          name: "attribute 003 test",
          kind: attributeKind.certified,
          origin: "IPA",
          code: "12345C",
        };
        await addOneAttribute(attribute3, postgresDB, attributes);

        attribute4 = {
          ...mockAttribute,
          id: uuidv4(),
          name: "attribute 004",
          kind: attributeKind.declared,
        };
        await addOneAttribute(attribute4, postgresDB, attributes);

        attribute5 = {
          ...mockAttribute,
          id: uuidv4(),
          name: "attribute 005",
          kind: attributeKind.declared,
        };
        await addOneAttribute(attribute5, postgresDB, attributes);

        attribute6 = {
          ...mockAttribute,
          id: uuidv4(),
          name: "attribute 006",
          kind: attributeKind.verified,
        };
        await addOneAttribute(attribute6, postgresDB, attributes);

        attribute7 = {
          ...mockAttribute,
          id: uuidv4(),
          name: "attribute 007",
          kind: attributeKind.verified,
        };
        await addOneAttribute(attribute7, postgresDB, attributes);
      });

      describe("getAttributesByIds", () => {
        it("should get the attributes if they exist", async () => {
          const result = await readModelService.getAttributesByIds({
            ids: [attribute1.id, attribute2.id, attribute3.id],
            offset: 0,
            limit: 50,
          });

          expect(result.totalCount).toBe(3);
          expect(result.results).toEqual([attribute1, attribute2, attribute3]);
        });
        it("should not get the attributes if they don't exist", async () => {
          const result = await readModelService.getAttributesByIds({
            ids: [uuidv4(), uuidv4()],
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(0);
          expect(result.results).toEqual([]);
        });
        it("should not get any attributes if the requested ids list is empty", async () => {
          const result = await readModelService.getAttributesByIds({
            ids: [],
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(0);
          expect(result.results).toEqual([]);
        });
      });
      describe("getAttributesByKindsNameOrigin", () => {
        it("should get the attributes if they exist (parameters: kinds, name, origin)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin({
            kinds: [attributeKind.certified],
            name: "test",
            origin: "IPA",
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(3);
          expect(result.results).toEqual([attribute1, attribute2, attribute3]);
        });
        it("should get the attributes if they exist (parameters: kinds only)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin({
            kinds: [attributeKind.declared],
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(2);
          expect(result.results).toEqual([attribute4, attribute5]);
        });
        it("should get the attributes if they exist (parameters: name only)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin({
            kinds: [],
            name: "test",
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(3);
          expect(result.results).toEqual([attribute1, attribute2, attribute3]);
        });
        it("should get the attributes if they exist (parameters: origin only)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin({
            kinds: [],
            origin: "IPA",
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(3);
          expect(result.results).toEqual([attribute1, attribute2, attribute3]);
        });
        it("should get all the attributes if no parameter is passed", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin({
            kinds: [],
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(7);
          expect(result.results).toEqual([
            attribute1,
            attribute2,
            attribute3,
            attribute4,
            attribute5,
            attribute6,
            attribute7,
          ]);
        });
        it("should not get the attributes if they don't exist", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin({
            kinds: [],
            name: "latest attribute",
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(0);
          expect(result.results).toEqual([]);
        });
      });
      describe("getAttributeById", () => {
        it("should get the attribute if it exists", async () => {
          const attribute = await readModelService.getAttributeById(
            attribute1.id
          );
          expect(attribute?.data).toEqual(attribute1);
        });
        it("should not get the attribute if it doesn't exist", async () => {
          const attribute = await readModelService.getAttributeById(uuidv4());
          expect(attribute).toBeUndefined();
        });
      });
      describe("getAttributeByName", () => {
        it("should get the attribute if it exists", async () => {
          const attribute = await readModelService.getAttributeByName(
            attribute1.name
          );
          expect(attribute?.data).toEqual(attribute1);
        });
        it("should not get the attribute if it doesn't exist", async () => {
          const attribute = await readModelService.getAttributeByName(
            "not-existing"
          );
          expect(attribute).toBeUndefined();
        });
      });
      describe("getAttributeByOriginAndCode", () => {
        it("should get the attribute if it exists", async () => {
          const attribute = await readModelService.getAttributeByOriginAndCode({
            origin: "IPA",
            code: "12345A",
          });
          expect(attribute?.data).toEqual(attribute1);
        });
        it("should not get the attribute if it doesn't exist", async () => {
          const attribute = await readModelService.getAttributeByOriginAndCode({
            origin: "IPA",
            code: "12345D",
          });
          expect(attribute).toBeUndefined();
        });
      });
    });
  });
});
