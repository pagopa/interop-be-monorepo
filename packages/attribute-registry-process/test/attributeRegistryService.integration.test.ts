/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockAttribute,
  getMockAuthData,
  getTenantOneCertifierFeature,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  Attribute,
  AttributeAddedV1,
  Tenant,
  attributeKind,
  generateId,
  toAttributeV1,
} from "pagopa-interop-models";
import {
  OrganizationIsNotACertifier,
  attributeDuplicateByName,
  attributeDuplicateByNameAndCode,
  originNotCompliant,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneTenant,
  readLastAttributeEvent,
  attributeRegistryService,
  getMockTenant,
} from "./utils.js";

const mockAttribute = getMockAttribute();
const mockTenant = getMockTenant();

describe("database test", () => {
  describe("attributeRegistryService", () => {
    describe("declared attribute creation", () => {
      it("should write on event-store for the creation of a declared attribute", async () => {
        const attribute =
          await attributeRegistryService.createDeclaredAttribute(
            {
              name: mockAttribute.name,
              description: mockAttribute.description,
            },
            {
              authData: getMockAuthData(),
              correlationId: generateId(),
              logger: genericLogger,
              serviceName: "",
              requestTimestamp: Date.now(),
            }
          );
        expect(attribute).toBeDefined();

        const writtenEvent = await readLastAttributeEvent(attribute.id);
        expect(writtenEvent).toMatchObject({
          stream_id: attribute.id,
          version: "0",
          type: "AttributeAdded",
          event_version: 1,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: AttributeAddedV1,
          payload: writtenEvent.data,
        });

        const expectedAttribute: Attribute = {
          ...mockAttribute,
          id: attribute.id,
          kind: attributeKind.declared,
          creationTime: new Date(writtenPayload.attribute!.creationTime),
        };

        expect(writtenPayload.attribute).toEqual(
          toAttributeV1(expectedAttribute)
        );
        expect(writtenPayload.attribute).toEqual(toAttributeV1(attribute));
      });
      it("should throw originNotCompliant if the requester externalId origin is not allowed", async () => {
        expect(
          attributeRegistryService.createDeclaredAttribute(
            {
              name: mockAttribute.name,
              description: mockAttribute.description,
            },
            {
              authData: {
                ...getMockAuthData(),
                externalId: {
                  value: "123456",
                  origin: "not-allowed-origin",
                },
              },
              logger: genericLogger,
              correlationId: generateId(),
              serviceName: "",
              requestTimestamp: Date.now(),
            }
          )
        ).rejects.toThrowError(originNotCompliant("not-allowed-origin"));
      });
      it("should throw attributeDuplicate if an attribute with the same name already exists, case insensitive", async () => {
        const attribute = {
          ...mockAttribute,
          name: mockAttribute.name.toUpperCase(),
          kind: attributeKind.declared,
        };
        await addOneAttribute(attribute);
        expect(
          attributeRegistryService.createDeclaredAttribute(
            {
              name: attribute.name.toLowerCase(),
              description: attribute.description,
            },
            {
              authData: getMockAuthData(),
              correlationId: generateId(),
              logger: genericLogger,
              serviceName: "",
              requestTimestamp: Date.now(),
            }
          )
        ).rejects.toThrowError(
          attributeDuplicateByName(attribute.name.toLowerCase())
        );
      });
    });
    describe("verified attribute creation", () => {
      it("should write on event-store for the creation of a verified attribute", async () => {
        const attribute =
          await attributeRegistryService.createVerifiedAttribute(
            {
              name: mockAttribute.name,
              description: mockAttribute.description,
            },
            {
              authData: getMockAuthData(),
              logger: genericLogger,
              correlationId: generateId(),
              serviceName: "",
              requestTimestamp: Date.now(),
            }
          );
        expect(attribute).toBeDefined();

        const writtenEvent = await readLastAttributeEvent(attribute.id);
        expect(writtenEvent).toMatchObject({
          stream_id: attribute.id,
          version: "0",
          type: "AttributeAdded",
          event_version: 1,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: AttributeAddedV1,
          payload: writtenEvent.data,
        });

        const expectedAttribute: Attribute = {
          ...mockAttribute,
          id: attribute.id,
          kind: attributeKind.verified,
          creationTime: new Date(writtenPayload.attribute!.creationTime),
        };

        expect(writtenPayload.attribute).toEqual(
          toAttributeV1(expectedAttribute)
        );
        expect(writtenPayload.attribute).toEqual(toAttributeV1(attribute));
      });
      it("should throw originNotCompliant if the requester externalId origin is not allowed", async () => {
        expect(
          attributeRegistryService.createVerifiedAttribute(
            {
              name: mockAttribute.name,
              description: mockAttribute.description,
            },
            {
              authData: {
                ...getMockAuthData(),
                externalId: {
                  value: "123456",
                  origin: "not-allowed-origin",
                },
              },
              logger: genericLogger,
              correlationId: generateId(),
              serviceName: "",
              requestTimestamp: Date.now(),
            }
          )
        ).rejects.toThrowError(originNotCompliant("not-allowed-origin"));
      });
      it("should throw attributeDuplicate if an attribute with the same name already exists, case insensitive", async () => {
        const attribute = {
          ...mockAttribute,
          name: mockAttribute.name.toUpperCase(),
          kind: attributeKind.verified,
        };
        await addOneAttribute(attribute);
        expect(
          attributeRegistryService.createVerifiedAttribute(
            {
              name: attribute.name.toLowerCase(),
              description: attribute.description,
            },
            {
              authData: getMockAuthData(),
              logger: genericLogger,
              correlationId: generateId(),
              serviceName: "",
              requestTimestamp: Date.now(),
            }
          )
        ).rejects.toThrowError(
          attributeDuplicateByName(attribute.name.toLowerCase())
        );
      });
    });
    describe("certified attribute creation", () => {
      it("should write on event-store for the creation of a certified attribute", async () => {
        const tenant: Tenant = {
          ...mockTenant,
          features: [
            {
              type: "PersistentCertifier",
              certifierId: randomUUID(),
            },
          ],
        };

        await addOneTenant(tenant);

        const attribute =
          await attributeRegistryService.createCertifiedAttribute(
            {
              name: mockAttribute.name,
              code: "code",
              description: mockAttribute.description,
            },
            {
              authData: getMockAuthData(tenant.id),
              logger: genericLogger,
              correlationId: generateId(),
              serviceName: "",
              requestTimestamp: Date.now(),
            }
          );
        expect(attribute).toBeDefined();

        const writtenEvent = await readLastAttributeEvent(attribute.id);
        expect(writtenEvent).toMatchObject({
          stream_id: attribute.id,
          version: "0",
          type: "AttributeAdded",
          event_version: 1,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: AttributeAddedV1,
          payload: writtenEvent.data,
        });

        const expectedAttribute: Attribute = {
          ...mockAttribute,
          id: attribute.id,
          code: "code",
          kind: attributeKind.certified,
          creationTime: new Date(writtenPayload.attribute!.creationTime),
          origin: getTenantOneCertifierFeature(tenant).certifierId,
        };
        expect(writtenPayload.attribute).toEqual(
          toAttributeV1(expectedAttribute)
        );
        expect(writtenPayload.attribute).toEqual(toAttributeV1(attribute));
      });
      it("should throw attributeDuplicate if an attribute with the same name and code already exists, case insensitive", async () => {
        const attribute = {
          ...mockAttribute,
          name: mockAttribute.name.toUpperCase(),
          code: "123456AB",
        };

        const tenant: Tenant = {
          ...mockTenant,
          features: [
            {
              type: "PersistentCertifier",
              certifierId: randomUUID(),
            },
          ],
        };

        await addOneTenant(tenant);
        await addOneAttribute(attribute);
        expect(
          attributeRegistryService.createCertifiedAttribute(
            {
              name: attribute.name.toLowerCase(),
              code: attribute.code.toLowerCase(),
              description: attribute.description,
            },
            {
              authData: getMockAuthData(tenant.id),
              logger: genericLogger,
              correlationId: generateId(),
              serviceName: "",
              requestTimestamp: Date.now(),
            }
          )
        ).rejects.toThrowError(
          attributeDuplicateByNameAndCode(
            attribute.name.toLowerCase(),
            attribute.code.toLowerCase()
          )
        );
      });
      it("should throw OrganizationIsNotACertifier if the organization is not a certifier", async () => {
        await addOneTenant(mockTenant);
        await addOneAttribute(mockAttribute);
        expect(
          attributeRegistryService.createCertifiedAttribute(
            {
              name: mockAttribute.name,
              code: "code",
              description: mockAttribute.description,
            },
            {
              authData: getMockAuthData(mockTenant.id),
              logger: genericLogger,
              correlationId: generateId(),
              serviceName: "",
              requestTimestamp: Date.now(),
            }
          )
        ).rejects.toThrowError(OrganizationIsNotACertifier(mockTenant.id));
      });
      it("should throw tenantNotFound if the certifier is not found", async () => {
        await addOneAttribute(mockAttribute);
        expect(
          attributeRegistryService.createCertifiedAttribute(
            {
              name: mockAttribute.name,
              code: "code",
              description: mockAttribute.description,
            },
            {
              authData: getMockAuthData(mockTenant.id),
              logger: genericLogger,
              correlationId: generateId(),
              serviceName: "",
              requestTimestamp: Date.now(),
            }
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
              type: "PersistentCertifier",
              certifierId: randomUUID(),
            },
          ],
        };

        await addOneTenant(tenant);

        const attribute =
          await attributeRegistryService.createInternalCertifiedAttribute(
            {
              name: mockAttribute.name,
              code: "code",
              origin: getTenantOneCertifierFeature(tenant).certifierId,
              description: mockAttribute.description,
            },
            {
              authData: getMockAuthData(),
              logger: genericLogger,
              correlationId: generateId(),
              serviceName: "",
              requestTimestamp: Date.now(),
            }
          );
        expect(attribute).toBeDefined();

        const writtenEvent = await readLastAttributeEvent(attribute.id);
        expect(writtenEvent).toMatchObject({
          stream_id: attribute.id,
          version: "0",
          type: "AttributeAdded",
          event_version: 1,
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: AttributeAddedV1,
          payload: writtenEvent.data,
        });

        const expectedAttribute: Attribute = {
          ...mockAttribute,
          id: attribute.id,
          code: "code",
          kind: attributeKind.certified,
          creationTime: new Date(writtenPayload.attribute!.creationTime),
          origin: getTenantOneCertifierFeature(tenant).certifierId,
        };
        expect(writtenPayload.attribute).toEqual(
          toAttributeV1(expectedAttribute)
        );
        expect(writtenPayload.attribute).toEqual(toAttributeV1(attribute));
      });
      it("should throw attributeDuplicate if an attribute with the same name and code already exists, case insensitive", async () => {
        // This test is the same as the previous one, but with a different method
        const attribute = {
          ...mockAttribute,
          name: mockAttribute.name.toUpperCase(),
          code: "123456AB",
        };

        const tenant: Tenant = {
          ...mockTenant,
          features: [
            {
              type: "PersistentCertifier",
              certifierId: randomUUID(),
            },
          ],
        };

        await addOneTenant(tenant);
        await addOneAttribute(attribute);
        expect(
          attributeRegistryService.createInternalCertifiedAttribute(
            {
              name: attribute.name.toLowerCase(),
              code: attribute.code.toLowerCase(),
              origin: getTenantOneCertifierFeature(tenant).certifierId,
              description: attribute.description,
            },
            {
              authData: getMockAuthData(),
              logger: genericLogger,
              correlationId: generateId(),
              serviceName: "",
              requestTimestamp: Date.now(),
            }
          )
        ).rejects.toThrowError(
          attributeDuplicateByNameAndCode(
            attribute.name.toLowerCase(),
            attribute.code.toLowerCase()
          )
        );
      });
    });
  });
});
