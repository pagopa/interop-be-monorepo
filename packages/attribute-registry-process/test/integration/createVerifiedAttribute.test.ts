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

describe("verified attribute creation", () => {
  const mockAttribute = getMockAttribute();
  it("should write on event-store for the creation of a verified attribute", async () => {
    const createVerifiedAttributeResponse =
      await attributeRegistryService.createVerifiedAttribute(
        {
          name: mockAttribute.name,
          description: mockAttribute.description,
        },
        getMockContext({})
      );

    const writtenEvent = await readLastAttributeEvent(
      createVerifiedAttributeResponse.data.id
    );
    expect(writtenEvent).toMatchObject({
      stream_id: createVerifiedAttributeResponse.data.id,
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
      id: createVerifiedAttributeResponse.data.id,
      kind: attributeKind.verified,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      creationTime: new Date(writtenPayload.attribute!.creationTime),
    };

    expect(writtenPayload.attribute).toEqual(toAttributeV1(expectedAttribute));
    expect(writtenPayload.attribute).toEqual(
      toAttributeV1(createVerifiedAttributeResponse.data)
    );
    expect(createVerifiedAttributeResponse).toEqual({
      data: expectedAttribute,
      metadata: {
        version: 0,
      },
    });
  });
  it("should throw originNotCompliant if the requester externalId origin is not allowed", async () => {
    expect(
      attributeRegistryService.createVerifiedAttribute(
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
      kind: attributeKind.verified,
    };
    await addOneAttribute(attribute);
    expect(
      attributeRegistryService.createVerifiedAttribute(
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
