import {
  getMockAttribute,
  getMockContextInternal,
  decodeProtobufPayload,
} from "pagopa-interop-commons-test";
import {
  Attribute,
  AttributeSubunitPropagationUpdatedV1,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  attributeKind,
  generateId,
  toAttributeV1,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";

import { attributeNotFound } from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  attributeRegistryService,
  readLastAttributeEvent,
} from "../integrationUtils.js";

describe("internalEnableAttributeSubunitPropagation", () => {
  const getEligibleAttribute = (
    subunitPropagationEnabled?: boolean
  ): Attribute => ({
    ...getMockAttribute(attributeKind.certified),
    origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
    ...(subunitPropagationEnabled !== undefined
      ? { subunitPropagationEnabled }
      : {}),
  });

  it.each([undefined, false])(
    "should enable the propagation and write the event if it is %s",
    async (initialValue) => {
      const attribute = getEligibleAttribute(initialValue);
      await addOneAttribute(attribute);

      await attributeRegistryService.internalEnableAttributeSubunitPropagation(
        attribute.id,
        getMockContextInternal({})
      );

      const event = await readLastAttributeEvent(attribute.id);
      expect(event).toMatchObject({
        stream_id: attribute.id,
        version: "1",
        type: "AttributeSubunitPropagationUpdated",
        event_version: 1,
      });
      expect(
        decodeProtobufPayload({
          messageType: AttributeSubunitPropagationUpdatedV1,
          payload: event.data,
        }).attribute
      ).toEqual(
        toAttributeV1({ ...attribute, subunitPropagationEnabled: true })
      );
    }
  );

  it("should not write any event if the propagation is already enabled", async () => {
    const attribute = getEligibleAttribute(true);
    await addOneAttribute(attribute);

    await attributeRegistryService.internalEnableAttributeSubunitPropagation(
      attribute.id,
      getMockContextInternal({})
    );

    const event = await readLastAttributeEvent(attribute.id);
    expect(event.version).toBe("0");
  });

  it("should throw attributeNotFound if the attribute does not exist", async () => {
    const unknownId = generateId<Attribute["id"]>();

    await expect(
      attributeRegistryService.internalEnableAttributeSubunitPropagation(
        unknownId,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(attributeNotFound(unknownId));
  });
});
