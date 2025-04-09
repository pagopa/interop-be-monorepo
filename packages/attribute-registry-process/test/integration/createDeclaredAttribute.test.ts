/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockContext,
  decodeProtobufPayload,
  getMockAuthData,
  getMockAttribute,
} from "pagopa-interop-commons-test";
import {
  AttributeAddedV1,
  Attribute,
  attributeKind,
  toAttributeV1,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  originNotCompliant,
  attributeDuplicateByName,
} from "../../src/model/domain/errors.js";
import {
  attributeRegistryService,
  readLastAttributeEvent,
  addOneAttribute,
} from "../integrationUtils.js";
describe("declared attribute creation", () => {
  const mockAttribute = getMockAttribute();
  it("should write on event-store for the creation of a declared attribute", async () => {
    const attribute = await attributeRegistryService.createDeclaredAttribute(
      {
        name: mockAttribute.name,
        description: mockAttribute.description,
      },
      getMockContext({})
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      creationTime: new Date(writtenPayload.attribute!.creationTime),
    };

    expect(writtenPayload.attribute).toEqual(toAttributeV1(expectedAttribute));
    expect(writtenPayload.attribute).toEqual(toAttributeV1(attribute));
  });
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
});
