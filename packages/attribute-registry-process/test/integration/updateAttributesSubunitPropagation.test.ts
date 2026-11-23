import {
  getMockAttribute,
  getMockAuthData,
  getMockContext,
  getMockTenant,
  decodeProtobufPayload,
} from "pagopa-interop-commons-test";
import {
  Attribute,
  AttributeSubunitPropagationUpdatedV2,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Tenant,
  attributeKind,
  generateId,
  TenantId,
  toRegistryAttributeV2,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";

import { config } from "../../src/config/config.js";
import {
  attributeNotEligibleForSubunitPropagation,
  attributeSubunitPropagationSelectionNotValid,
  manualSubunitPropagationUpdateDisabled,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneTenant,
  attributeRegistryService,
  readLastAttributeEvent,
} from "../integrationUtils.js";

describe("updateAttributesSubunitPropagation", () => {
  const ipaCode = "ipa-code";
  const tenant: Tenant = {
    ...getMockTenant(),
    externalId: { origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER, value: ipaCode },
  };
  const getEligibleAttribute = (
    subunitPropagationEnabled?: boolean
  ): Attribute => ({
    ...getMockAttribute(attributeKind.certified),
    origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
    code: ipaCode,
    ...(subunitPropagationEnabled !== undefined
      ? { subunitPropagationEnabled }
      : {}),
  });
  const ctx = getMockContext({ authData: getMockAuthData(tenant.id) });

  it("should enable the propagation and write the event", async () => {
    const eligibleAttribute = getEligibleAttribute();
    await addOneTenant(tenant);
    await addOneAttribute(eligibleAttribute);

    await attributeRegistryService.updateAttributesSubunitPropagation(
      { attributeIds: [eligibleAttribute.id] },
      ctx
    );

    const event = await readLastAttributeEvent(eligibleAttribute.id);
    expect(event).toMatchObject({
      stream_id: eligibleAttribute.id,
      version: "1",
      type: "AttributeSubunitPropagationUpdated",
      event_version: 2,
    });
    const payload = decodeProtobufPayload({
      messageType: AttributeSubunitPropagationUpdatedV2,
      payload: event.data,
    });
    expect(payload.attribute).toEqual(
      toRegistryAttributeV2({
        ...eligibleAttribute,
        subunitPropagationEnabled: true,
      })
    );
  });

  it("should disable the propagation if the attribute is not in the selection", async () => {
    const eligibleAttribute = getEligibleAttribute(true);
    await addOneTenant(tenant);
    await addOneAttribute(eligibleAttribute);

    await attributeRegistryService.updateAttributesSubunitPropagation(
      { attributeIds: [] },
      ctx
    );

    const event = await readLastAttributeEvent(eligibleAttribute.id);
    expect(event.version).toBe("1");
    expect(
      decodeProtobufPayload({
        messageType: AttributeSubunitPropagationUpdatedV2,
        payload: event.data,
      }).attribute?.subunitPropagationEnabled
    ).toBe(false);
  });

  it("should not write any event if the selection matches the current state", async () => {
    const eligibleAttribute = getEligibleAttribute(true);
    await addOneTenant(tenant);
    await addOneAttribute(eligibleAttribute);

    await attributeRegistryService.updateAttributesSubunitPropagation(
      { attributeIds: [eligibleAttribute.id] },
      ctx
    );

    const event = await readLastAttributeEvent(eligibleAttribute.id);
    expect(event.version).toBe("0");
  });

  it("should throw attributeSubunitPropagationSelectionNotValid if the selection has duplicates or more than one attribute", async () => {
    const eligibleAttribute = getEligibleAttribute();
    await addOneTenant(tenant);
    await addOneAttribute(eligibleAttribute);

    await expect(
      attributeRegistryService.updateAttributesSubunitPropagation(
        { attributeIds: [eligibleAttribute.id, eligibleAttribute.id] },
        ctx
      )
    ).rejects.toThrowError(attributeSubunitPropagationSelectionNotValid());
    await expect(
      attributeRegistryService.updateAttributesSubunitPropagation(
        { attributeIds: [eligibleAttribute.id, generateId()] },
        ctx
      )
    ).rejects.toThrowError(attributeSubunitPropagationSelectionNotValid());
  });

  it.each([
    {
      description: "belongs to another tenant",
      attribute: { ...getEligibleAttribute(), code: "other-ipa-code" },
    },
  ])(
    "should throw attributeNotEligibleForSubunitPropagation if the attribute $description",
    async ({ attribute }) => {
      await addOneTenant(tenant);
      await addOneAttribute(getEligibleAttribute());
      await addOneAttribute(attribute);

      await expect(
        attributeRegistryService.updateAttributesSubunitPropagation(
          { attributeIds: [attribute.id] },
          ctx
        )
      ).rejects.toThrowError(
        attributeNotEligibleForSubunitPropagation(attribute.id, tenant.id)
      );
    }
  );

  it("should throw attributeNotEligibleForSubunitPropagation if the requester is a subunit", async () => {
    const subunit: Tenant = { ...tenant, subUnitType: "AOO" };
    const eligibleAttribute = getEligibleAttribute();
    await addOneTenant(subunit);
    await addOneAttribute(eligibleAttribute);

    await expect(
      attributeRegistryService.updateAttributesSubunitPropagation(
        { attributeIds: [eligibleAttribute.id] },
        ctx
      )
    ).rejects.toThrowError(
      attributeNotEligibleForSubunitPropagation(
        eligibleAttribute.id,
        subunit.id
      )
    );
  });

  it("should throw manualSubunitPropagationUpdateDisabled and write no event if the forced propagation feature flag is enabled", async () => {
    const eligibleAttribute = getEligibleAttribute();
    await addOneTenant(tenant);
    await addOneAttribute(eligibleAttribute);

    config.featureFlagAooUoAttributesForcedPropagation = true;
    try {
      await expect(
        attributeRegistryService.updateAttributesSubunitPropagation(
          { attributeIds: [eligibleAttribute.id] },
          ctx
        )
      ).rejects.toThrowError(manualSubunitPropagationUpdateDisabled());
    } finally {
      config.featureFlagAooUoAttributesForcedPropagation = false;
    }

    const event = await readLastAttributeEvent(eligibleAttribute.id);
    expect(event.version).toBe("0");
  });

  it("should throw tenantNotFound if the requester tenant does not exist", async () => {
    const unknownTenantId = generateId<TenantId>();
    await expect(
      attributeRegistryService.updateAttributesSubunitPropagation(
        { attributeIds: [] },
        getMockContext({ authData: getMockAuthData(unknownTenantId) })
      )
    ).rejects.toThrowError(tenantNotFound(unknownTenantId));
  });
});
