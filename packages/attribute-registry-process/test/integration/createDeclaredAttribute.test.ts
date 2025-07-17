/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockContext,
  decodeProtobufPayload,
  getMockAuthData,
  getMockAttribute,
  getMockTenant,
  getMockContextM2MAdmin,
} from "pagopa-interop-commons-test";
import {
  AttributeAddedV1,
  Attribute,
  attributeKind,
  toAttributeV1,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  originNotCompliant,
  attributeDuplicateByName,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import {
  attributeRegistryService,
  readLastAttributeEvent,
  addOneAttribute,
  addOneTenant,
} from "../integrationUtils.js";

describe("declared attribute creation", () => {
  const mockAttribute = getMockAttribute();
  const mockTenant = getMockTenant();

  it.each([
    {
      label: "UIAuthData",
      context: getMockContext({ authData: getMockAuthData(mockTenant.id) }),
    },
    {
      label: "M2MAdminAuthData",
      context: getMockContextM2MAdmin({ organizationId: mockTenant.id }),
    },
  ])(
    "should write on event-store for the creation of a declared attribute ($label)",
    async ({ context }) => {
      await addOneTenant(mockTenant);
      const createDeclaredAttributeResponse =
        await attributeRegistryService.createDeclaredAttribute(
          {
            name: mockAttribute.name,
            description: mockAttribute.description,
          },
          context
        );

      const writtenEvent = await readLastAttributeEvent(
        createDeclaredAttributeResponse.data.id
      );
      expect(writtenEvent).toMatchObject({
        stream_id: createDeclaredAttributeResponse.data.id,
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
        id: createDeclaredAttributeResponse.data.id,
        kind: attributeKind.declared,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        creationTime: new Date(writtenPayload.attribute!.creationTime),
      };

      expect(writtenPayload.attribute).toEqual(
        toAttributeV1(expectedAttribute)
      );
      expect(writtenPayload.attribute).toEqual(
        toAttributeV1(createDeclaredAttributeResponse.data)
      );
      expect(createDeclaredAttributeResponse).toEqual({
        data: expectedAttribute,
        metadata: {
          version: 0,
        },
      });
    }
  );
  it("should throw originNotCompliant if the requester externalId origin is not allowed", async () => {
    expect(
      attributeRegistryService.createDeclaredAttribute(
        {
          name: mockAttribute.name,
          description: mockAttribute.description,
        },
        getMockContext({
          authData: {
            ...getMockAuthData(),
            externalId: {
              value: "123456",
              origin: "not-allowed-origin",
            },
          },
        })
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
        getMockContext({})
      )
    ).rejects.toThrowError(
      attributeDuplicateByName(attribute.name.toLowerCase())
    );
  });
  it("should throw tenantNotFound if the m2m tenant is not found", async () => {
    const notExistingTenantId = generateId<TenantId>();
    expect(
      attributeRegistryService.createDeclaredAttribute(
        {
          name: mockAttribute.name,
          description: mockAttribute.description,
        },
        getMockContextM2MAdmin({ organizationId: notExistingTenantId })
      )
    ).rejects.toThrowError(tenantNotFound(notExistingTenantId));
  });
});
