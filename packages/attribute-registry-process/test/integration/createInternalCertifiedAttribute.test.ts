/* eslint-disable @typescript-eslint/no-floating-promises */
import { randomUUID } from "crypto";
import {
  getTenantOneCertifierFeature,
  decodeProtobufPayload,
  getMockAttribute,
  getMockContextInternal,
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
import { attributeDuplicateByCodeOriginOrName } from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  attributeRegistryService,
  readLastAttributeEvent,
  addOneAttribute,
} from "../integrationUtils.js";

describe("certified attribute internal creation", () => {
  const mockTenant = getMockTenant();
  const mockAttribute = getMockAttribute();
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
      await attributeRegistryService.internalCreateCertifiedAttribute(
        {
          name: mockAttribute.name,
          code: "code",
          origin: getTenantOneCertifierFeature(tenant).certifierId,
          description: mockAttribute.description,
        },
        getMockContextInternal({})
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
  it("should write 2 attribute with different name and origin but same code, case insensitive", async () => {
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

    await addOneTenant(tenant);
    await addOneTenant(tenant2);
    await addOneAttribute({
      ...mockAttribute,
      code: attributeCode,
      origin: getTenantOneCertifierFeature(tenant).certifierId,
    });

    expect(
      attributeRegistryService.internalCreateCertifiedAttribute(
        {
          name: attributeName,
          code: attributeCode.toLocaleUpperCase(),
          description: mockAttribute.description,
          origin: getTenantOneCertifierFeature(tenant2).certifierId,
        },
        getMockContextInternal({})
      )
    ).toBeDefined();
  });
  it("should throw attributeDuplicate if an attribute with the same name OR code and origin already exists, case insensitive", async () => {
    const attribute = {
      ...mockAttribute,
      code: "123456ab",
    };
    const attribute2 = {
      ...attribute,
      name: `${mockAttribute.name}-test`,
      code: "123456cd",
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
    await addOneAttribute({
      ...attribute,
      name: attribute.name.toUpperCase(),
      code: attribute.code.toUpperCase(),
      origin: getTenantOneCertifierFeature(tenant).certifierId,
    });
    expect(
      attributeRegistryService.internalCreateCertifiedAttribute(
        {
          name: attribute.name,
          code: attribute2.code,
          description: attribute.description,
          origin: getTenantOneCertifierFeature(tenant).certifierId,
        },
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      attributeDuplicateByCodeOriginOrName(
        attribute.name,
        attribute2.code,
        getTenantOneCertifierFeature(tenant).certifierId
      )
    );
    expect(
      attributeRegistryService.internalCreateCertifiedAttribute(
        {
          name: attribute2.name,
          code: attribute.code,
          description: attribute.description,
          origin: getTenantOneCertifierFeature(tenant).certifierId,
        },
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      attributeDuplicateByCodeOriginOrName(
        attribute2.name,
        attribute.code,
        getTenantOneCertifierFeature(tenant).certifierId
      )
    );
  });
});
