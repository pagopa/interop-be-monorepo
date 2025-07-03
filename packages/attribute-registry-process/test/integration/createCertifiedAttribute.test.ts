/* eslint-disable @typescript-eslint/no-floating-promises */
import { randomUUID } from "crypto";
import {
  getMockContext,
  getMockAuthData,
  decodeProtobufPayload,
  getTenantOneCertifierFeature,
  getMockAttribute,
  getMockTenant,
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
  attributeDuplicateByCodeOriginOrName,
  tenantIsNotACertifier,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  attributeRegistryService,
  readLastAttributeEvent,
  addOneAttribute,
} from "../integrationUtils.js";

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

    const createAttributeResponse =
      await attributeRegistryService.createCertifiedAttribute(
        {
          name: mockAttribute.name,
          code: "code",
          description: mockAttribute.description,
        },
        getMockContext({ authData: getMockAuthData(tenant.id) })
      );

    const writtenEvent = await readLastAttributeEvent(
      createAttributeResponse.data.id
    );
    expect(writtenEvent).toMatchObject({
      stream_id: createAttributeResponse.data.id,
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
      id: createAttributeResponse.data.id,
      code: "code",
      kind: attributeKind.certified,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      creationTime: new Date(writtenPayload.attribute!.creationTime),
      origin: getTenantOneCertifierFeature(tenant).certifierId,
    };
    expect(writtenPayload.attribute).toEqual(toAttributeV1(expectedAttribute));
    expect(createAttributeResponse).toEqual({
      data: expectedAttribute,
      metadata: { version: 0 },
    });
  });
  it("should write 2 attribute with different name and origin but same code", async () => {
    const attributeCode = "123456ab";
    const attributeName = `${mockAttribute.name}-test`;
    const mockTenant2 = getMockTenant();

    const tenant: Tenant = {
      ...mockTenant,
      features: [
        {
          type: "PersistentCertifier",
          certifierId: randomUUID(),
        },
      ],
    };
    const tenant2: Tenant = {
      ...mockTenant2,
      features: [
        {
          type: "PersistentCertifier",
          certifierId: randomUUID(),
        },
      ],
    };
    const expectedAttribute: Attribute = {
      ...mockAttribute,
      code: attributeCode,
      name: attributeName,
      id: expect.any(String),
      kind: attributeKind.certified,
      creationTime: expect.any(Date),
      origin: getTenantOneCertifierFeature(tenant2).certifierId,
    };
    await addOneTenant(tenant);
    await addOneTenant(tenant2);
    await addOneAttribute({
      ...mockAttribute,
      code: attributeCode,
      origin: getTenantOneCertifierFeature(tenant).certifierId,
    });
    const createdAttribute =
      await attributeRegistryService.createCertifiedAttribute(
        {
          name: attributeName,
          code: attributeCode,
          description: mockAttribute.description,
        },
        getMockContext({ authData: getMockAuthData(tenant2.id) })
      );
    expect(createdAttribute).toMatchObject({
      data: expectedAttribute,
      metadata: { version: 0 },
    });
  });
  it("should throw attributeDuplicate if an attribute with the same name OR code and origin already exists, case insensitive", async () => {
    const attribute = {
      ...mockAttribute,
      code: "123456ab",
    };
    const attributeName = `${mockAttribute.name}-test`;
    const attributeCode = "123456cd";

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
    await addOneAttribute({
      ...attribute,
      name: attribute.name.toUpperCase(),
      code: attribute.code.toUpperCase(),
      origin: getTenantOneCertifierFeature(tenant).certifierId,
    });
    expect(
      attributeRegistryService.createCertifiedAttribute(
        {
          name: attribute.name,
          code: attributeCode,
          description: attribute.description,
        },
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      attributeDuplicateByCodeOriginOrName(
        attribute.name,
        attributeCode,
        getTenantOneCertifierFeature(tenant).certifierId
      )
    );
    expect(
      attributeRegistryService.createCertifiedAttribute(
        {
          name: attributeName,
          code: attribute.code,
          description: attribute.description,
        },
        getMockContext({ authData: getMockAuthData(tenant.id) })
      )
    ).rejects.toThrowError(
      attributeDuplicateByCodeOriginOrName(
        attributeName,
        attribute.code,
        getTenantOneCertifierFeature(tenant).certifierId
      )
    );
  });
  it("should throw tenantIsNotACertifier if the organization is not a certifier", async () => {
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
    ).rejects.toThrowError(tenantIsNotACertifier(mockTenant.id));
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
