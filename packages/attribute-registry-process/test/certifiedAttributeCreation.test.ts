/* eslint-disable @typescript-eslint/no-floating-promises */
import { randomUUID } from "crypto";
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockAuthData,
  decodeProtobufPayload,
  getMockAttribute,
  getMockTenant,
} from "pagopa-interop-commons-test/index.js";
import {
  Tenant,
  generateId,
  AttributeAddedV1,
  Attribute,
  attributeKind,
  toAttributeV1,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  attributeDuplicate,
  OrganizationIsNotACertifier,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneTenant,
  attributeRegistryService,
  readLastAttributeEvent,
  addOneAttribute,
} from "./utils.js";

describe("certified attribute creation", () => {
  const mockAttribute = getMockAttribute();
  const mockTenant = getMockTenant();
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

    const attribute = await attributeRegistryService.createCertifiedAttribute(
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
    expect(writtenPayload.attribute).toEqual(toAttributeV1(expectedAttribute));
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
          certifierId: randomUUID(),
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
          correlationId: generateId(),
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
          correlationId: generateId(),
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
          correlationId: generateId(),
          serviceName: "",
        }
      )
    ).rejects.toThrowError(tenantNotFound(mockTenant.id));
  });
});
