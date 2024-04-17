/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-floating-promises */

import { fail } from "assert";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  AgreementCollection,
  AttributeCollection,
  EServiceCollection,
  ReadModelRepository,
  TenantCollection,
  initDB,
} from "pagopa-interop-commons";
import {
  StoredEvent,
  TEST_MONGO_DB_PORT,
  TEST_POSTGRES_DB_PORT,
  eventStoreSchema,
  mongoDBContainer,
  postgreSQLContainer,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import { IDatabase } from "pg-promise";
import {
  Attribute,
  Descriptor,
  EService,
  Tenant,
  TenantCertifiedAttributeAssignedV2,
  TenantCertifiedAttributeV2,
  TenantDeclaredAttributeAssignedV2,
  TenantDeclaredAttributeV2,
  TenantId,
  TenantOnboardDetailsUpdatedV2,
  TenantOnboardedV2,
  TenantVerifiedAttributeAssignedV2,
  TenantVerifiedAttributeExpirationUpdatedV2,
  TenantVerifiedAttributeExtensionUpdatedV2,
  TenantVerifiedAttributeV2,
  descriptorState,
  fromTenantKindV2,
  generateId,
  operationForbidden,
  protobufDecoder,
  tenantAttributeType,
  tenantKind,
  toTenantV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { StartedTestContainer } from "testcontainers";
import { config } from "../src/utilities/config.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readModelService.js";
import {
  TenantService,
  tenantServiceBuilder,
} from "../src/services/tenantService.js";
import { UpdateVerifiedTenantAttributeSeed } from "../src/model/domain/models.js";
import {
  expirationDateCannotBeInThePast,
  organizationNotFoundInVerifiers,
  selfcareIdConflict,
  tenantNotFound,
  verifiedAttributeNotFoundInTenant,
  expirationDateNotFoundInVerifier,
  attributeNotFound,
  tenantIsNotACertifier,
  certifiedAttributeOriginIsNotCompliantWithCertifier,
  certifiedAttributeAlreadyAssigned,
  attributeVerificationNotAllowed,
  verifiedAttributeSelfVerification,
} from "../src/model/domain/errors.js";
import {
  ApiSelfcareTenantSeed,
  ApiCertifiedTenantAttributeSeed,
  ApiDeclaredTenantAttributeSeed,
  ApiVerifiedTenantAttributeSeed,
} from "../src/model/types.js";
import { getTenantKind } from "../src/services/validators.js";
import {
  addOneAgreement,
  addOneAttribute,
  addOneEService,
  addOneTenant,
  currentDate,
  getMockAgreement,
  getMockAuthData,
  getMockCertifiedTenantAttribute,
  getMockDescriptor,
  getMockEService,
  getMockRevokedBy,
  getMockTenant,
  getMockVerifiedBy,
  getMockVerifiedTenantAttribute,
} from "./utils.js";

describe("Integration tests", () => {
  let tenants: TenantCollection;
  let agreements: AgreementCollection;
  let eservices: EServiceCollection;
  let attributes: AttributeCollection;
  let readModelService: ReadModelService;
  let tenantService: TenantService;
  let postgresDB: IDatabase<unknown>;
  let startedPostgreSqlContainer: StartedTestContainer;
  let startedMongodbContainer: StartedTestContainer;

  beforeAll(async () => {
    startedPostgreSqlContainer = await postgreSQLContainer(config).start();
    startedMongodbContainer = await mongoDBContainer(config).start();

    config.eventStoreDbPort = startedPostgreSqlContainer.getMappedPort(
      TEST_POSTGRES_DB_PORT
    );
    config.readModelDbPort =
      startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);
    ({ tenants, agreements, eservices, attributes } =
      ReadModelRepository.init(config));

    readModelService = readModelServiceBuilder(config);
    postgresDB = initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: config.eventStoreDbPort,
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
  const mockRevokedBy = getMockRevokedBy();
  const mockVerifiedTenantAttribute = getMockVerifiedTenantAttribute();
  const mockCertifiedTenantAttribute = getMockCertifiedTenantAttribute();

  afterEach(async () => {
    await tenants.deleteMany({});
    await agreements.deleteMany({});
    await eservices.deleteMany({});
    await attributes.deleteMany({});
    await postgresDB.none("TRUNCATE TABLE tenant.events RESTART IDENTITY");
  });

  afterAll(async () => {
    await startedPostgreSqlContainer.stop();
    await startedMongodbContainer.stop();
  });

  // eslint-disable-next-line sonarjs/cognitive-complexity
  describe("tenantService", () => {
    describe("selfcareUpsertTenant", async () => {
      const correlationId = generateId();
      const tenantSeed = {
        externalId: {
          origin: "IPA",
          value: "123456",
        },
        name: "A tenant",
        selfcareId: generateId(),
      };

      it("Should update the tenant if it exists", async () => {
        await addOneTenant(mockTenant, postgresDB, tenants);
        const kind = tenantKind.PA;
        const selfcareId = mockTenant.selfcareId!;
        const tenantSeed: ApiSelfcareTenantSeed = {
          externalId: {
            origin: mockTenant.externalId.origin,
            value: mockTenant.externalId.value,
          },
          name: "A tenant",
          selfcareId,
        };
        const mockAuthData = getMockAuthData(mockTenant.id);
        await tenantService.selfcareUpsertTenant({
          tenantSeed,
          authData: mockAuthData,
          correlationId,
        });

        const writtenEvent: StoredEvent | undefined =
          await readLastEventByStreamId(
            mockTenant.id,
            eventStoreSchema.tenant,
            postgresDB
          );
        if (!writtenEvent) {
          fail("Update failed: tenant not found in event-store");
        }
        expect(writtenEvent).toMatchObject({
          stream_id: mockTenant.id,
          version: "1",
          type: "TenantOnboardDetailsUpdated",
        });
        const writtenPayload: TenantOnboardDetailsUpdatedV2 | undefined =
          protobufDecoder(TenantOnboardDetailsUpdatedV2).parse(
            writtenEvent?.data
          );

        const updatedTenant: Tenant = {
          ...mockTenant,
          selfcareId,
          kind,
          updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
        };

        expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      });
      it("Should create a tenant by the upsert if it does not exist", async () => {
        const mockAuthData = getMockAuthData();
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
          correlationId,
        });
        expect(id).toBeDefined();
        const writtenEvent: StoredEvent | undefined =
          await readLastEventByStreamId(
            id,
            eventStoreSchema.tenant,
            postgresDB
          );
        if (!writtenEvent) {
          fail("Creation failed: tenant not found in event-store");
        }
        expect(writtenEvent).toMatchObject({
          stream_id: id,
          version: "0",
          type: "TenantOnboarded",
        });
        const writtenPayload: TenantOnboardedV2 | undefined = protobufDecoder(
          TenantOnboardedV2
        ).parse(writtenEvent.data);
        const expectedTenant: Tenant = {
          ...mockTenant,
          externalId: tenantSeed.externalId,
          id: unsafeBrandId(id),
          kind: getTenantKind([], tenantSeed.externalId),
          selfcareId: tenantSeed.selfcareId,
          createdAt: new Date(Number(writtenPayload.tenant?.createdAt)),
        };

        expect(writtenPayload.tenant).toEqual(toTenantV2(expectedTenant));
      });
      it("Should throw operation forbidden if role isn't internal", async () => {
        await addOneTenant(mockTenant, postgresDB, tenants);
        const mockAuthData = getMockAuthData(generateId<TenantId>());

        expect(
          tenantService.selfcareUpsertTenant({
            tenantSeed,
            authData: mockAuthData,
            correlationId,
          })
        ).rejects.toThrowError(operationForbidden);
      });
      it("Should throw selfcareIdConflict error if the given and existing selfcareId differs", async () => {
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
            correlationId,
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
      const correlationId = generateId();
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
          correlationId,
        });
        const writtenEvent: StoredEvent | undefined =
          await readLastEventByStreamId(
            tenant.id,
            eventStoreSchema.tenant,
            postgresDB
          );
        if (!writtenEvent) {
          fail("Creation fails: tenant not found in event-store");
        }
        expect(writtenEvent).toBeDefined();
        expect(writtenEvent.stream_id).toBe(tenant.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe(
          "TenantVerifiedAttributeExpirationUpdated"
        );
        const writtenPayload:
          | TenantVerifiedAttributeExpirationUpdatedV2
          | undefined = protobufDecoder(
          TenantVerifiedAttributeExpirationUpdatedV2
        ).parse(writtenEvent.data);

        if (!writtenPayload) {
          fail(
            "impossible to decode TenantVerifiedAttributeExpirationUpdatedV2 data"
          );
        }

        const updatedTenant: Tenant = {
          ...tenant,
          updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
        };

        expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      });
      it("Should throw tenantNotFound when tenant doesn't exist", async () => {
        expect(
          tenantService.updateTenantVerifiedAttribute({
            verifierId,
            tenantId: tenant.id,
            attributeId,
            updateVerifiedTenantAttributeSeed,
            correlationId,
          })
        ).rejects.toThrowError(tenantNotFound(tenant.id));
      });

      it("Should throw expirationDateCannotBeInThePast when expiration date is in the past", async () => {
        const expirationDateinPast = new Date(
          currentDate.setDate(currentDate.getDate() - 3)
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
            correlationId,
          })
        ).rejects.toThrowError(
          expirationDateCannotBeInThePast(expirationDateinPast)
        );
      });
      it("Should throw verifiedAttributeNotFoundInTenant when the attribute is not verified", async () => {
        const updatedCertifiedTenant: Tenant = {
          ...mockTenant,
          attributes: [{ ...mockCertifiedTenantAttribute }],
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
            correlationId,
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
            correlationId,
          })
        ).rejects.toThrowError(
          organizationNotFoundInVerifiers(verifierId, tenant.id, attributeId)
        );
      });
    });
    describe("updateVerifiedAttributeExtensionDate", async () => {
      const correlationId = generateId();
      const expirationDate = new Date(
        currentDate.setDate(currentDate.getDate() + 1)
      );

      const tenant: Tenant = {
        ...mockTenant,
        attributes: [
          {
            ...mockVerifiedTenantAttribute,
            verifiedBy: [
              {
                ...mockVerifiedBy,
                extensionDate: currentDate,
                expirationDate,
              },
            ],
          },
        ],
        name: "A Tenant",
      };
      const attributeId = tenant.attributes.map((a) => a.id)[0];
      const verifierId = mockVerifiedBy.id;
      it("Should update the extensionDate", async () => {
        const extensionDate = new Date(
          currentDate.getTime() +
            (expirationDate.getTime() -
              mockVerifiedBy.verificationDate.getTime())
        );

        await addOneTenant(tenant, postgresDB, tenants);
        await tenantService.updateVerifiedAttributeExtensionDate(
          tenant.id,
          attributeId,
          verifierId,
          correlationId
        );
        const writtenEvent: StoredEvent | undefined =
          await readLastEventByStreamId(
            tenant.id,
            eventStoreSchema.tenant,
            postgresDB
          );
        if (!writtenEvent) {
          fail("Creation fails: tenant not found in event-store");
        }
        expect(writtenEvent.stream_id).toBe(tenant.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe(
          "TenantVerifiedAttributeExtensionUpdated"
        );
        const writtenPayload:
          | TenantVerifiedAttributeExtensionUpdatedV2
          | undefined = protobufDecoder(
          TenantVerifiedAttributeExtensionUpdatedV2
        ).parse(writtenEvent.data);

        const updatedTenant: Tenant = {
          ...tenant,
          attributes: [
            {
              ...mockVerifiedTenantAttribute,
              verifiedBy: [
                {
                  ...mockVerifiedBy,
                  extensionDate,
                  expirationDate,
                },
              ],
            },
          ],
          updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
        };
        expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      });
      it("Should throw tenantNotFound when tenant doesn't exist", async () => {
        const correlationId = generateId();
        expect(
          tenantService.updateVerifiedAttributeExtensionDate(
            tenant.id,
            attributeId,
            verifierId,
            correlationId
          )
        ).rejects.toThrowError(tenantNotFound(tenant.id));
      });

      it("Should throw expirationDateNotFoundInVerifier", async () => {
        const expirationDate = undefined;

        const updatedTenantWithoutExpirationDate: Tenant = {
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
          name: "A updatedTenant",
        };
        const attributeId = updatedTenantWithoutExpirationDate.attributes.map(
          (a) => a.id
        )[0];
        await addOneTenant(
          updatedTenantWithoutExpirationDate,
          postgresDB,
          tenants
        );
        const correlationId = generateId();
        expect(
          tenantService.updateVerifiedAttributeExtensionDate(
            updatedTenantWithoutExpirationDate.id,
            attributeId,
            verifierId,
            correlationId
          )
        ).rejects.toThrowError(
          expirationDateNotFoundInVerifier(
            verifierId,
            attributeId,
            updatedTenantWithoutExpirationDate.id
          )
        );
      });
      it("Should throw verifiedAttributeNotFoundInTenant when the attribute is not verified", async () => {
        await addOneTenant(mockTenant, postgresDB, tenants);
        const correlationId = generateId();
        expect(
          tenantService.updateVerifiedAttributeExtensionDate(
            tenant.id,
            attributeId,
            verifierId,
            correlationId
          )
        ).rejects.toThrowError(
          verifiedAttributeNotFoundInTenant(mockTenant.id, attributeId)
        );
      });
      it("Should throw organizationNotFoundInVerifiers when the organization is not verified", async () => {
        await addOneTenant(tenant, postgresDB, tenants);
        const verifierId = generateId();
        const correlationId = generateId();
        expect(
          tenantService.updateVerifiedAttributeExtensionDate(
            tenant.id,
            attributeId,
            verifierId,
            correlationId
          )
        ).rejects.toThrowError(
          organizationNotFoundInVerifiers(verifierId, tenant.id, attributeId)
        );
      });
    });
    describe("internalAssignCertifiedAttribute", async () => {
      const correlationId = generateId();
      const requesterTenant: Tenant = {
        ...mockTenant,
        features: [
          {
            type: "PersistentCertifier",
            certifierId: generateId(),
          },
        ],
        updatedAt: currentDate,
        name: "A requesterTenant",
        externalId: {
          origin: generateId(),
          value: "1234567",
        },
      };
      const attribute: Attribute = {
        name: "an Attribute",
        id: unsafeBrandId(requesterTenant.id),
        kind: "Certified",
        description: "an attribute",
        creationTime: new Date(),
        code: "123456",
        origin: requesterTenant.externalId.origin,
      };

      it("Should add the certified attribute if certifiedTenantAttribute doesn't exist", async () => {
        await addOneAttribute(attribute, attributes);
        await addOneTenant(requesterTenant, postgresDB, tenants);
        await tenantService.internalAssignCertifiedAttribute(
          requesterTenant.externalId.origin,
          requesterTenant.externalId.value,
          attribute.origin!,
          attribute.code!,
          correlationId
        );
        const writtenEvent: StoredEvent | undefined =
          await readLastEventByStreamId(
            requesterTenant.id,
            eventStoreSchema.tenant,
            postgresDB
          );
        if (!writtenEvent) {
          fail("Update failed: tenant not found in event-store");
        }
        expect(writtenEvent).toMatchObject({
          stream_id: requesterTenant.id,
          version: "1",
          type: "TenantCertifiedAttributeAssigned",
        });
        const writtenPayload = protobufDecoder(
          TenantCertifiedAttributeAssignedV2
        ).parse(writtenEvent?.data);

        const updatedTenant: Tenant = {
          ...requesterTenant,
          attributes: [
            {
              id: unsafeBrandId(attribute.id),
              type: "PersistentCertifiedAttribute",
              assignmentTimestamp: new Date(
                Number(
                  (
                    writtenPayload.tenant!.attributes[0].sealedValue as {
                      oneofKind: "certifiedAttribute";
                      certifiedAttribute: TenantCertifiedAttributeV2;
                    }
                  ).certifiedAttribute.assignmentTimestamp
                )
              ),
            },
          ],
          kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
          updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
        };
        expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      });
      it("Should add the certified attribute if certifiedTenantAttribute exist", async () => {
        const tenantWithCertifiedAttribute: Tenant = {
          ...requesterTenant,
          attributes: [
            {
              ...mockCertifiedTenantAttribute,
              id: unsafeBrandId(attribute.id),
              revocationTimestamp: new Date(),
            },
          ],
        };

        await addOneAttribute(attribute, attributes);
        await addOneTenant(tenantWithCertifiedAttribute, postgresDB, tenants);
        await tenantService.internalAssignCertifiedAttribute(
          tenantWithCertifiedAttribute.externalId.origin,
          tenantWithCertifiedAttribute.externalId.value,
          attribute.origin!,
          attribute.code!,
          correlationId
        );
        const writtenEvent: StoredEvent | undefined =
          await readLastEventByStreamId(
            tenantWithCertifiedAttribute.id,
            eventStoreSchema.tenant,
            postgresDB
          );
        if (!writtenEvent) {
          fail("Update failed: tenant not found in event-store");
        }
        expect(writtenEvent).toMatchObject({
          stream_id: tenantWithCertifiedAttribute.id,
          version: "1",
          type: "TenantCertifiedAttributeAssigned",
        });
        const writtenPayload = protobufDecoder(
          TenantCertifiedAttributeAssignedV2
        ).parse(writtenEvent?.data);

        const updatedTenant: Tenant = {
          ...tenantWithCertifiedAttribute,
          attributes: [
            {
              id: unsafeBrandId(attribute.id),
              type: "PersistentCertifiedAttribute",
              assignmentTimestamp: new Date(
                Number(
                  (
                    writtenPayload.tenant!.attributes[0].sealedValue as {
                      oneofKind: "certifiedAttribute";
                      certifiedAttribute: TenantCertifiedAttributeV2;
                    }
                  ).certifiedAttribute.assignmentTimestamp
                )
              ),
            },
          ],
          kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
          updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
        };
        expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      });
      it("Should throw tenant not found", async () => {
        await addOneAttribute(attribute, attributes);
        expect(
          tenantService.internalAssignCertifiedAttribute(
            requesterTenant.externalId.origin,
            requesterTenant.externalId.value,
            attribute.origin!,
            attribute.code!,
            correlationId
          )
        ).rejects.toThrowError(
          tenantNotFound(unsafeBrandId(requesterTenant.externalId.origin))
        );
      });
      it("Should throw attribute not found", async () => {
        await addOneTenant(requesterTenant, postgresDB, tenants);

        expect(
          tenantService.internalAssignCertifiedAttribute(
            requesterTenant.externalId.origin,
            requesterTenant.externalId.value,
            attribute.origin!,
            attribute.code!,
            correlationId
          )
        ).rejects.toThrowError(
          attributeNotFound(unsafeBrandId(attribute.origin!))
        );
      });
      it("Should throw certifiedAttributeAlreadyAssigned", async () => {
        const tenantAlreadyAssigned: Tenant = {
          ...requesterTenant,
          attributes: [
            {
              id: attribute.id,
              type: "PersistentCertifiedAttribute",
              assignmentTimestamp: new Date(),
            },
          ],
        };
        await addOneAttribute(attribute, attributes);
        await addOneTenant(tenantAlreadyAssigned, postgresDB, tenants);
        expect(
          tenantService.internalAssignCertifiedAttribute(
            tenantAlreadyAssigned.externalId.origin,
            tenantAlreadyAssigned.externalId.value,
            attribute.origin!,
            attribute.code!,
            correlationId
          )
        ).rejects.toThrowError(
          certifiedAttributeAlreadyAssigned(
            unsafeBrandId(attribute.id),
            unsafeBrandId(tenantAlreadyAssigned.id)
          )
        );
      });
    });
    describe("addCertifiedAttribute", async () => {
      const tenantAttributeSeed: ApiCertifiedTenantAttributeSeed = {
        id: generateId(),
      };
      const correlationId = generateId();
      const requesterTenant: Tenant = {
        ...mockTenant,
        features: [
          {
            type: "PersistentCertifier",
            certifierId: generateId(),
          },
        ],
        updatedAt: currentDate,
        name: "A requesterTenant",
      };
      const attribute: Attribute = {
        name: "an Attribute",
        id: unsafeBrandId(tenantAttributeSeed.id),
        kind: "Certified",
        description: "an attribute",
        creationTime: new Date(),
        code: "123456",
        origin: requesterTenant.features[0].certifierId,
      };

      const targetTenant: Tenant = { ...mockTenant, id: generateId() };
      const mockAuthData = getMockAuthData(requesterTenant.id);

      it("Should add the certified attribute if certifiedTenantAttribute doesn't exist", async () => {
        await addOneAttribute(attribute, attributes);
        await addOneTenant(targetTenant, postgresDB, tenants);
        await addOneTenant(requesterTenant, postgresDB, tenants);
        await tenantService.addCertifiedAttribute(targetTenant.id, {
          tenantAttributeSeed,
          authData: mockAuthData,
          correlationId,
        });
        const writtenEvent: StoredEvent | undefined =
          await readLastEventByStreamId(
            targetTenant.id,
            eventStoreSchema.tenant,
            postgresDB
          );
        if (!writtenEvent) {
          fail("Update failed: tenant not found in event-store");
        }
        expect(writtenEvent).toMatchObject({
          stream_id: targetTenant.id,
          version: "1",
          type: "TenantCertifiedAttributeAssigned",
        });
        const writtenPayload = protobufDecoder(
          TenantCertifiedAttributeAssignedV2
        ).parse(writtenEvent?.data);

        const updatedTenant: Tenant = {
          ...targetTenant,
          attributes: [
            {
              id: unsafeBrandId(tenantAttributeSeed.id),
              type: "PersistentCertifiedAttribute",
              assignmentTimestamp: new Date(
                Number(
                  (
                    writtenPayload.tenant!.attributes[0].sealedValue as {
                      oneofKind: "certifiedAttribute";
                      certifiedAttribute: TenantCertifiedAttributeV2;
                    }
                  ).certifiedAttribute.assignmentTimestamp
                )
              ),
            },
          ],
          kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
          updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
        };
        expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      });
      it("Should add the certified attribute if certifiedTenantAttribute exist", async () => {
        const tenantWithCertifiedAttribute: Tenant = {
          ...targetTenant,
          attributes: [
            {
              ...mockCertifiedTenantAttribute,
              id: unsafeBrandId(tenantAttributeSeed.id),
              revocationTimestamp: new Date(),
            },
          ],
        };

        await addOneAttribute(attribute, attributes);
        await addOneTenant(tenantWithCertifiedAttribute, postgresDB, tenants);
        await addOneTenant(requesterTenant, postgresDB, tenants);
        await tenantService.addCertifiedAttribute(
          tenantWithCertifiedAttribute.id,
          {
            tenantAttributeSeed,
            authData: mockAuthData,
            correlationId,
          }
        );
        const writtenEvent: StoredEvent | undefined =
          await readLastEventByStreamId(
            tenantWithCertifiedAttribute.id,
            eventStoreSchema.tenant,
            postgresDB
          );
        if (!writtenEvent) {
          fail("Update failed: tenant not found in event-store");
        }
        expect(writtenEvent).toMatchObject({
          stream_id: tenantWithCertifiedAttribute.id,
          version: "1",
          type: "TenantCertifiedAttributeAssigned",
        });
        const writtenPayload = protobufDecoder(
          TenantCertifiedAttributeAssignedV2
        ).parse(writtenEvent?.data);

        const updatedTenant: Tenant = {
          ...tenantWithCertifiedAttribute,
          attributes: [
            {
              id: unsafeBrandId(tenantAttributeSeed.id),
              type: "PersistentCertifiedAttribute",
              assignmentTimestamp: new Date(
                Number(
                  (
                    writtenPayload.tenant!.attributes[0].sealedValue as {
                      oneofKind: "certifiedAttribute";
                      certifiedAttribute: TenantCertifiedAttributeV2;
                    }
                  ).certifiedAttribute.assignmentTimestamp
                )
              ),
            },
          ],
          kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
          updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
        };
        expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      });
      it("Should throw tenant not found", async () => {
        await addOneAttribute(attribute, attributes);
        expect(
          tenantService.addCertifiedAttribute(targetTenant.id, {
            tenantAttributeSeed,
            authData: mockAuthData,
            correlationId,
          })
        ).rejects.toThrowError(tenantNotFound(requesterTenant.id));
      });
      it("Should throw attribute not found", async () => {
        await addOneTenant(targetTenant, postgresDB, tenants);
        await addOneTenant(requesterTenant, postgresDB, tenants);

        expect(
          tenantService.addCertifiedAttribute(targetTenant.id, {
            tenantAttributeSeed,
            authData: mockAuthData,
            correlationId,
          })
        ).rejects.toThrowError(attributeNotFound(attribute.id));
      });
      it("Should throw tenant is not a certifier", async () => {
        const requesterTenant: Tenant = {
          ...mockTenant,
          updatedAt: currentDate,
          name: "A requesterTenant",
        };
        await addOneAttribute(attribute, attributes);
        await addOneTenant(targetTenant, postgresDB, tenants);
        await addOneTenant(requesterTenant, postgresDB, tenants);

        expect(
          tenantService.addCertifiedAttribute(targetTenant.id, {
            tenantAttributeSeed,
            authData: mockAuthData,
            correlationId,
          })
        ).rejects.toThrowError(tenantIsNotACertifier(requesterTenant.id));
      });
      it("Should throw certifiedAttributeOriginIsNotCompliantWithCertifier", async () => {
        const notCompliantOriginAttribute: Attribute = {
          ...attribute,
          origin: generateId(),
        };
        await addOneAttribute(notCompliantOriginAttribute, attributes);
        await addOneTenant(targetTenant, postgresDB, tenants);
        await addOneTenant(requesterTenant, postgresDB, tenants);

        expect(
          tenantService.addCertifiedAttribute(targetTenant.id, {
            tenantAttributeSeed,
            authData: mockAuthData,
            correlationId,
          })
        ).rejects.toThrowError(
          certifiedAttributeOriginIsNotCompliantWithCertifier(
            notCompliantOriginAttribute.origin!,
            requesterTenant.id,
            targetTenant.id,
            requesterTenant.features[0].certifierId
          )
        );
      });
      it("Should throw certifiedAttributeAlreadyAssigned", async () => {
        const tenantAlreadyAssigned: Tenant = {
          ...targetTenant,
          attributes: [
            {
              id: attribute.id,
              type: "PersistentCertifiedAttribute",
              assignmentTimestamp: new Date(),
            },
          ],
        };
        await addOneAttribute(attribute, attributes);
        await addOneTenant(tenantAlreadyAssigned, postgresDB, tenants);
        await addOneTenant(requesterTenant, postgresDB, tenants);
        expect(
          tenantService.addCertifiedAttribute(tenantAlreadyAssigned.id, {
            tenantAttributeSeed,
            authData: mockAuthData,
            correlationId,
          })
        ).rejects.toThrowError(
          certifiedAttributeAlreadyAssigned(attribute.id, requesterTenant.id)
        );
      });
    });
    describe("addDeclaredAttribute", async () => {
      const tenantAttributeSeed: ApiDeclaredTenantAttributeSeed = {
        id: generateId(),
      };
      const correlationId = generateId();
      const requesterTenant: Tenant = {
        ...mockTenant,
        attributes: [
          {
            id: unsafeBrandId(tenantAttributeSeed.id),
            type: "PersistentDeclaredAttribute",
            assignmentTimestamp: new Date(),
          },
        ],
        updatedAt: currentDate,
        name: "A requesterTenant",
      };

      const mockAuthData = getMockAuthData(requesterTenant.id);

      it("Should add the declared attribute if declared Tenant Attribute doesn't exist", async () => {
        const tenantWithoutDeclaredAttribute: Tenant = {
          ...requesterTenant,
          attributes: [],
        };
        await addOneTenant(tenantWithoutDeclaredAttribute, postgresDB, tenants);
        await tenantService.addDeclaredAttribute({
          tenantAttributeSeed,
          authData: mockAuthData,
          correlationId,
        });
        const writtenEvent: StoredEvent | undefined =
          await readLastEventByStreamId(
            tenantWithoutDeclaredAttribute.id,
            eventStoreSchema.tenant,
            postgresDB
          );
        if (!writtenEvent) {
          fail("Update failed: tenant not found in event-store");
        }
        expect(writtenEvent).toMatchObject({
          stream_id: tenantWithoutDeclaredAttribute.id,
          version: "1",
          type: "TenantDeclaredAttributeAssigned",
        });
        const writtenPayload = protobufDecoder(
          TenantDeclaredAttributeAssignedV2
        ).parse(writtenEvent?.data);

        const updatedTenant: Tenant = {
          ...tenantWithoutDeclaredAttribute,
          attributes: [
            {
              id: unsafeBrandId(tenantAttributeSeed.id),
              type: "PersistentDeclaredAttribute",
              assignmentTimestamp: new Date(
                Number(
                  (
                    writtenPayload.tenant!.attributes[0].sealedValue as {
                      oneofKind: "declaredAttribute";
                      declaredAttribute: TenantDeclaredAttributeV2;
                    }
                  ).declaredAttribute.assignmentTimestamp
                )
              ),
            },
          ],
          kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
          updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
        };
        expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      });
      it("Should add the declared attribute if declared Tenant Attribute exist", async () => {
        await addOneTenant(requesterTenant, postgresDB, tenants);
        await tenantService.addDeclaredAttribute({
          tenantAttributeSeed,
          authData: mockAuthData,
          correlationId,
        });
        const writtenEvent: StoredEvent | undefined =
          await readLastEventByStreamId(
            requesterTenant.id,
            eventStoreSchema.tenant,
            postgresDB
          );
        if (!writtenEvent) {
          fail("Update failed: tenant not found in event-store");
        }
        expect(writtenEvent).toMatchObject({
          stream_id: requesterTenant.id,
          version: "1",
          type: "TenantDeclaredAttributeAssigned",
        });

        const writtenPayload = protobufDecoder(
          TenantDeclaredAttributeAssignedV2
        ).parse(writtenEvent?.data);

        const updatedTenant: Tenant = {
          ...requesterTenant,
          attributes: [
            {
              id: unsafeBrandId(tenantAttributeSeed.id),
              type: "PersistentDeclaredAttribute",
              assignmentTimestamp: new Date(
                Number(
                  (
                    writtenPayload.tenant!.attributes[0].sealedValue as {
                      oneofKind: "declaredAttribute";
                      declaredAttribute: TenantDeclaredAttributeV2;
                    }
                  ).declaredAttribute.assignmentTimestamp
                )
              ),
            },
          ],
          kind: fromTenantKindV2(writtenPayload.tenant!.kind!),
          updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
        };
        expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      });
      it("Should throw tenant not found", async () => {
        expect(
          tenantService.addDeclaredAttribute({
            tenantAttributeSeed,
            authData: mockAuthData,
            correlationId,
          })
        ).rejects.toThrowError(tenantNotFound(requesterTenant.id));
      });
      it("Should throw AttributeNotFound", async () => {
        const notDeclaredAttributeTenant: Tenant = {
          ...requesterTenant,
          attributes: [
            {
              id: unsafeBrandId(tenantAttributeSeed.id),
              type: "PersistentCertifiedAttribute",
              assignmentTimestamp: new Date(),
            },
          ],
        };
        await addOneTenant(notDeclaredAttributeTenant, postgresDB, tenants);
        const authData = getMockAuthData(notDeclaredAttributeTenant.id);

        expect(
          tenantService.addDeclaredAttribute({
            tenantAttributeSeed,
            authData,
            correlationId,
          })
        ).rejects.toThrowError(
          attributeNotFound(unsafeBrandId(tenantAttributeSeed.id))
        );
      });
    });
    describe("verifyVerifiedAttribute", async () => {
      const tenantAttributeSeed: ApiVerifiedTenantAttributeSeed = {
        id: generateId(),
      };
      const correlationId = generateId();
      const limit = 50;
      const offset = 0;
      const targetTenant: Tenant = { ...mockTenant, id: generateId() };

      const requesterTenant: Tenant = {
        ...mockTenant,
        id: generateId(),
        name: "A requesterTenant",
      };

      const descriptor1: Descriptor = {
        ...mockDescriptor,
        state: descriptorState.published,
        attributes: {
          verified: [
            [
              {
                id: unsafeBrandId(tenantAttributeSeed.id),
                explicitAttributeVerification: false,
              },
            ],
          ],
          declared: [],
          certified: [],
        },
      };

      const eService1: EService = {
        ...mockEService,
        producerId: requesterTenant.id,
        id: generateId(),
        name: "A",
        descriptors: [descriptor1],
      };

      const agreementEservice1 = getMockAgreement({
        eserviceId: eService1.id,
        descriptorId: descriptor1.id,
        producerId: eService1.producerId,
        consumerId: targetTenant.id,
      });

      const mockAuthData = getMockAuthData(requesterTenant.id);

      it("Should verify the VerifiedAttribute if verifiedTenantAttribute doesn't exist", async () => {
        await addOneTenant(targetTenant, postgresDB, tenants);
        await addOneTenant(requesterTenant, postgresDB, tenants);
        await addOneEService(eService1, eservices);
        await addOneAgreement(agreementEservice1, agreements);
        await tenantService.verifyVerifiedAttribute({
          tenantId: targetTenant.id,
          tenantAttributeSeed,
          authData: mockAuthData,
          limit,
          offset,
          correlationId,
        });

        const writtenEvent: StoredEvent | undefined =
          await readLastEventByStreamId(
            targetTenant.id,
            eventStoreSchema.tenant,
            postgresDB
          );
        if (!writtenEvent) {
          fail("Update failed: tenant not found in event-store");
        }
        expect(writtenEvent).toMatchObject({
          stream_id: targetTenant.id,
          version: "1",
          type: "TenantVerifiedAttributeAssigned",
        });
        const writtenPayload = protobufDecoder(
          TenantVerifiedAttributeAssignedV2
        ).parse(writtenEvent?.data);

        const updatedTenant: Tenant = {
          ...targetTenant,
          attributes: [
            {
              id: unsafeBrandId(tenantAttributeSeed.id),
              type: tenantAttributeType.VERIFIED,
              assignmentTimestamp: new Date(
                Number(
                  (
                    writtenPayload.tenant!.attributes[0].sealedValue as {
                      oneofKind: "verifiedAttribute";
                      verifiedAttribute: TenantVerifiedAttributeV2;
                    }
                  ).verifiedAttribute.assignmentTimestamp
                )
              ),
              verifiedBy: [
                {
                  id: mockAuthData.organizationId,
                  verificationDate: new Date(
                    Number(
                      (
                        writtenPayload.tenant!.attributes[0].sealedValue as {
                          oneofKind: "verifiedAttribute";
                          verifiedAttribute: TenantVerifiedAttributeV2;
                        }
                      ).verifiedAttribute.verifiedBy[0].verificationDate
                    )
                  ),
                  expirationDate: tenantAttributeSeed.expirationDate
                    ? new Date(tenantAttributeSeed.expirationDate)
                    : undefined,
                  extensionDate: tenantAttributeSeed.expirationDate
                    ? new Date(tenantAttributeSeed.expirationDate)
                    : undefined,
                },
              ],
              revokedBy: [],
            },
          ],
          updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
        };
        expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      });
      it("Should verify the VerifiedAttribute if verifiedTenantAttribute exist", async () => {
        const tenantWithVerifiedAttribute: Tenant = {
          ...targetTenant,
          attributes: [
            {
              ...mockVerifiedTenantAttribute,
              id: unsafeBrandId(tenantAttributeSeed.id),
              verifiedBy: [
                {
                  ...mockVerifiedBy,
                },
              ],
              revokedBy: [{ ...mockRevokedBy }],
            },
          ],
        };

        await addOneTenant(tenantWithVerifiedAttribute, postgresDB, tenants);
        await addOneTenant(requesterTenant, postgresDB, tenants);
        await addOneEService(eService1, eservices);
        await addOneAgreement(agreementEservice1, agreements);

        await tenantService.verifyVerifiedAttribute({
          tenantId: tenantWithVerifiedAttribute.id,
          tenantAttributeSeed,
          authData: mockAuthData,
          limit,
          offset,
          correlationId,
        });

        const writtenEvent: StoredEvent | undefined =
          await readLastEventByStreamId(
            tenantWithVerifiedAttribute.id,
            eventStoreSchema.tenant,
            postgresDB
          );
        if (!writtenEvent) {
          fail("Update failed: tenant not found in event-store");
        }
        expect(writtenEvent).toMatchObject({
          stream_id: tenantWithVerifiedAttribute.id,
          version: "1",
          type: "TenantVerifiedAttributeAssigned",
        });
        const writtenPayload = protobufDecoder(
          TenantVerifiedAttributeAssignedV2
        ).parse(writtenEvent?.data);

        const updatedTenant: Tenant = {
          ...tenantWithVerifiedAttribute,
          attributes: [
            ...tenantWithVerifiedAttribute.attributes,
            {
              id: unsafeBrandId(tenantAttributeSeed.id),
              type: tenantAttributeType.VERIFIED,
              assignmentTimestamp: new Date(
                Number(
                  (
                    writtenPayload.tenant!.attributes[0].sealedValue as {
                      oneofKind: "verifiedAttribute";
                      verifiedAttribute: TenantVerifiedAttributeV2;
                    }
                  ).verifiedAttribute.assignmentTimestamp
                )
              ),
              verifiedBy: [
                {
                  ...mockVerifiedBy,
                },
                {
                  ...mockVerifiedBy,
                  id: requesterTenant.id,
                  verificationDate: new Date(
                    Number(
                      (
                        writtenPayload.tenant!.attributes[1].sealedValue as {
                          oneofKind: "verifiedAttribute";
                          verifiedAttribute: TenantVerifiedAttributeV2;
                        }
                      ).verifiedAttribute.verifiedBy[1].verificationDate
                    )
                  ),
                },
              ],
              revokedBy: [
                {
                  ...mockRevokedBy,
                },
              ],
            },
          ],
          updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
        };
        expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
      });
      it("Should throw tenant not found", async () => {
        expect(
          tenantService.verifyVerifiedAttribute({
            tenantId: targetTenant.id,
            tenantAttributeSeed,
            authData: mockAuthData,
            limit,
            offset,
            correlationId,
          })
        ).rejects.toThrowError(tenantNotFound(targetTenant.id));
      });
      it("Should throw attributeVerificationNotAllowed", async () => {
        const descriptorAttributeVerificationNotAllowed: Descriptor = {
          ...descriptor1,
          attributes: {
            verified: [
              [
                {
                  id: generateId(),
                  explicitAttributeVerification: false,
                },
              ],
            ],
            declared: [],
            certified: [],
          },
        };

        const eServiceWithNotAllowedDescriptor: EService = {
          ...eService1,
          descriptors: [descriptorAttributeVerificationNotAllowed],
        };

        const agreementEserviceWithNotAllowedDescriptor = getMockAgreement({
          ...agreementEservice1,
          eserviceId: eServiceWithNotAllowedDescriptor.id,
          descriptorId: descriptorAttributeVerificationNotAllowed.id,
        });

        await addOneTenant(targetTenant, postgresDB, tenants);
        await addOneTenant(requesterTenant, postgresDB, tenants);
        await addOneEService(eServiceWithNotAllowedDescriptor, eservices);
        await addOneAgreement(
          agreementEserviceWithNotAllowedDescriptor,
          agreements
        );

        expect(
          tenantService.verifyVerifiedAttribute({
            tenantId: targetTenant.id,
            tenantAttributeSeed,
            authData: mockAuthData,
            limit,
            offset,
            correlationId,
          })
        ).rejects.toThrowError(
          attributeVerificationNotAllowed(
            targetTenant.id,
            unsafeBrandId(tenantAttributeSeed.id)
          )
        );
      });
      it("Should throw verifiedAttributeSelfVerification", async () => {
        await addOneTenant(targetTenant, postgresDB, tenants);
        await addOneTenant(requesterTenant, postgresDB, tenants);
        await addOneEService(eService1, eservices);
        await addOneAgreement(agreementEservice1, agreements);

        expect(
          tenantService.verifyVerifiedAttribute({
            tenantId: targetTenant.id,
            tenantAttributeSeed,
            authData: { ...mockAuthData, organizationId: targetTenant.id },
            limit,
            offset,
            correlationId,
          })
        ).rejects.toThrowError(verifiedAttributeSelfVerification());
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
    const tenant4: Tenant = {
      ...mockTenant,
      id: generateId(),
      name: "A tenant4",
    };
    const tenant5: Tenant = {
      ...mockTenant,
      id: generateId(),
      name: "A tenant5",
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
    describe("getTenants", () => {
      it("should get all the tenants with no filter", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);
        await addOneTenant(tenant2, postgresDB, tenants);
        await addOneTenant(tenant3, postgresDB, tenants);

        const tenantsByName = await readModelService.getTenantsByName({
          name: undefined,
          offset: 0,
          limit: 50,
        });
        expect(tenantsByName.totalCount).toBe(3);
        expect(tenantsByName.results).toEqual([tenant1, tenant2, tenant3]);
      });
      it("should get tenants by name", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);

        await addOneTenant(tenant2, postgresDB, tenants);

        const tenantsByName = await readModelService.getTenantsByName({
          name: "A tenant1",
          offset: 0,
          limit: 50,
        });
        expect(tenantsByName.totalCount).toBe(1);
        expect(tenantsByName.results).toEqual([tenant1]);
      });
      it("should not get tenants if there are not any tenants", async () => {
        const tenantsByName = await readModelService.getTenantsByName({
          name: undefined,
          offset: 0,
          limit: 50,
        });
        expect(tenantsByName.totalCount).toBe(0);
        expect(tenantsByName.results).toEqual([]);
      });
      it("should not get tenants if the name does not match", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);

        await addOneTenant(tenant2, postgresDB, tenants);

        const tenantsByName = await readModelService.getTenantsByName({
          name: "A tenant6",
          offset: 0,
          limit: 50,
        });
        expect(tenantsByName.totalCount).toBe(0);
        expect(tenantsByName.results).toEqual([]);
      });
      it("Should get a maximun number of tenants based on a specified limit", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);
        await addOneTenant(tenant2, postgresDB, tenants);
        await addOneTenant(tenant3, postgresDB, tenants);
        await addOneTenant(tenant4, postgresDB, tenants);
        await addOneTenant(tenant5, postgresDB, tenants);
        const tenantsByName = await readModelService.getTenantsByName({
          name: undefined,
          offset: 0,
          limit: 4,
        });
        expect(tenantsByName.results.length).toBe(4);
      });
      it("Should get a maximun number of tenants based on a specified limit and offset", async () => {
        await addOneTenant(tenant1, postgresDB, tenants);
        await addOneTenant(tenant2, postgresDB, tenants);
        await addOneTenant(tenant3, postgresDB, tenants);
        await addOneTenant(tenant4, postgresDB, tenants);
        await addOneTenant(tenant5, postgresDB, tenants);
        const tenantsByName = await readModelService.getTenantsByName({
          name: undefined,
          offset: 2,
          limit: 4,
        });
        expect(tenantsByName.results.length).toBe(3);
      });
    });
    describe("getTenantById", () => {
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
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          tenant1.selfcareId!
        );
        expect(tenantBySelfcareId?.data).toEqual(tenant1);
      });
      it("should not get the tenant by selfcareId if it isn't in DB", async () => {
        const tenantBySelfcareId = await readModelService.getTenantBySelfcareId(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          tenant1.selfcareId!
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
