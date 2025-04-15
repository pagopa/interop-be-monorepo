/* eslint-disable @typescript-eslint/no-floating-promises */
import { randomUUID } from "crypto";
import {
  getTenantOneCertifierFeature,
  decodeProtobufPayload,
  getMockAttribute,
  getMockContextInternal,
} from "pagopa-interop-commons-test";
import {
  Tenant,
  AttributeAddedV1,
  Attribute,
  attributeKind,
  toAttributeV1,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { attributeDuplicateByNameAndCode } from "../../src/model/domain/errors.js";
import {
  addOneTenant,
  attributeRegistryService,
  readLastAttributeEvent,
  addOneAttribute,
} from "../integrationUtils.js";
import { getMockTenant } from "../mockUtils.js";

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
      attributeRegistryService.internalCreateCertifiedAttribute(
        {
          name: attribute.name.toLowerCase(),
          code: attribute.code.toLowerCase(),
          origin: getTenantOneCertifierFeature(tenant).certifierId,
          description: attribute.description,
        },
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      attributeDuplicateByNameAndCode(
        attribute.name.toLowerCase(),
        attribute.code.toLowerCase()
      )
    );
  });
});
