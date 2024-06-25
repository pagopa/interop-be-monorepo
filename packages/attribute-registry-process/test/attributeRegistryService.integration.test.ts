/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockAttribute,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import {
  Attribute,
  AttributeAddedV1,
  Tenant,
  attributeKind,
  toAttributeV1,
} from "pagopa-interop-models";
import { getMockAuthData } from "pagopa-interop-commons-test";
import {
  OrganizationIsNotACertifier,
  attributeDuplicate,
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
              correlationId: "",
              logger: genericLogger,
              serviceName: "",
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
              correlationId: "",
              serviceName: "",
            }
          )
        ).rejects.toThrowError(originNotCompliant("not-allowed-origin"));
      });
      it("should throw attributeDuplicate if an attribute with the same name already exists", async () => {
        const attribute = {
          ...mockAttribute,
          kind: attributeKind.declared,
        };
        await addOneAttribute(attribute);
        expect(
          attributeRegistryService.createDeclaredAttribute(
            {
              name: attribute.name,
              description: attribute.description,
            },
            {
              authData: getMockAuthData(),
              correlationId: "",
              logger: genericLogger,
              serviceName: "",
            }
          )
        ).rejects.toThrowError(attributeDuplicate(attribute.name));
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
              correlationId: "",
              serviceName: "",
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
              correlationId: "",
              serviceName: "",
            }
          )
        ).rejects.toThrowError(originNotCompliant("not-allowed-origin"));
      });
      it("should throw attributeDuplicate if an attribute with the same name already exists", async () => {
        const attribute = {
          ...mockAttribute,
          kind: attributeKind.verified,
        };
        await addOneAttribute(attribute);
        expect(
          attributeRegistryService.createVerifiedAttribute(
            {
              name: attribute.name,
              description: attribute.description,
            },
            {
              authData: getMockAuthData(),
              logger: genericLogger,
              correlationId: "",
              serviceName: "",
            }
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
              type: "PersistentCertifier",
              certifierId: uuidv4(),
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
              correlationId: "",
              serviceName: "",
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
          origin: tenant.features[0].certifierId,
        };
        expect(writtenPayload.attribute).toEqual(
          toAttributeV1(expectedAttribute)
        );
        expect(writtenPayload.attribute).toEqual(toAttributeV1(attribute));
      });
      it("should throw attributeDuplicate if an attribute with the same name and code already exists", async () => {
        const attribute = {
          ...mockAttribute,
          code: "123456",
        };

        const tenant: Tenant = {
          ...mockTenant,
          features: [
            {
              type: "PersistentCertifier",
              certifierId: uuidv4(),
            },
          ],
        };

        await addOneTenant(tenant);
        await addOneAttribute(attribute);
        expect(
          attributeRegistryService.createCertifiedAttribute(
            {
              name: attribute.name,
              code: attribute.code,
              description: attribute.description,
            },
            {
              authData: getMockAuthData(tenant.id),
              logger: genericLogger,
              correlationId: "",
              serviceName: "",
            }
          )
        ).rejects.toThrowError(attributeDuplicate(attribute.name));
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
              correlationId: "",
              serviceName: "",
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
              correlationId: "",
              serviceName: "",
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
              certifierId: uuidv4(),
            },
          ],
        };

        await addOneTenant(tenant);

        const attribute =
          await attributeRegistryService.createInternalCertifiedAttribute(
            {
              name: mockAttribute.name,
              code: "code",
              origin: tenant.features[0].certifierId,
              description: mockAttribute.description,
            },
            {
              authData: getMockAuthData(),
              logger: genericLogger,
              correlationId: "",
              serviceName: "",
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
          origin: tenant.features[0].certifierId,
        };
        expect(writtenPayload.attribute).toEqual(
          toAttributeV1(expectedAttribute)
        );
        expect(writtenPayload.attribute).toEqual(toAttributeV1(attribute));
      });
      it("should throw attributeDuplicate if an attribute with the same name and code already exists", async () => {
        const attribute = {
          ...mockAttribute,
          code: "123456",
        };

        const tenant: Tenant = {
          ...mockTenant,
          features: [
            {
              type: "PersistentCertifier",
              certifierId: uuidv4(),
            },
          ],
        };

        await addOneTenant(tenant);
        await addOneAttribute(attribute);
        expect(
          attributeRegistryService.createInternalCertifiedAttribute(
            {
              name: attribute.name,
              code: attribute.code,
              origin: tenant.features[0].certifierId,
              description: attribute.description,
            },
            {
              authData: getMockAuthData(),
              logger: genericLogger,
              correlationId: "",
              serviceName: "",
            }
          )
        ).rejects.toThrowError(attributeDuplicate(attribute.name));
      });
    });
  });
});
