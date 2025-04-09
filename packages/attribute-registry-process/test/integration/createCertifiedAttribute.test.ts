/* eslint-disable @typescript-eslint/no-floating-promises */
import { randomUUID } from "crypto";
import {
  getMockContext,
  getMockAuthData,
  decodeProtobufPayload,
  getTenantOneCertifierFeature,
  getMockAttribute,
} from "pagopa-interop-commons-test";
import {
  Tenant,
  AttributeAddedV1,
  Attribute,
  attributeKind,
  toAttributeV1,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  attributeDuplicateByNameAndCode,
  OrganizationIsNotACertifier,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  attributeRegistryService,
  readLastAttributeEvent,
  addOneAttribute,
} from "../integrationUtils.js";
import { getMockTenant } from "../mockUtils.js";

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
      getMockContext({ authData: getMockAuthData(tenant.id) })
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      creationTime: new Date(writtenPayload.attribute!.creationTime),
      origin: getTenantOneCertifierFeature(tenant).certifierId,
    };
    expect(writtenPayload.attribute).toEqual(toAttributeV1(expectedAttribute));
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
        getMockContext({ authData: getMockAuthData(tenant.id) })
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
        getMockContext({ authData: getMockAuthData(mockTenant.id) })
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
        getMockContext({ authData: getMockAuthData(mockTenant.id) })
      )
    ).rejects.toThrowError(tenantNotFound(mockTenant.id));
  });
});
