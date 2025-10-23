/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/no-identical-functions */
import {
  getMockAttribute,
  getMockContext,
  getMockTenant,
  getMockTenantMail,
} from "pagopa-interop-commons-test";
import {
  Attribute,
  AttributeId,
  CorrelationId,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  Tenant,
  tenantAttributeType,
  TenantId,
  TenantNotificationConfigId,
  toTenantV2,
  unsafeBrandId,
  VerifiedTenantAttribute,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { match } from "ts-pattern";
import { handleTenantVerifiedAttributeAssigned } from "../src/handlers/tenants/handleTenantVerifiedAttributeAssigned.js";
import { attributeNotFound } from "../src/models/errors.js";
import {
  addOneAttribute,
  addOneTenant,
  addOneUser,
  getMockUser,
  readModelService,
  templateService,
  userService,
} from "./utils.js";

describe("handleTenantVerifiedAttributeAssigned", async () => {
  const targetTenantId = generateId<TenantId>();
  const verifierTenantId = generateId<TenantId>();
  const attributeId = generateId<AttributeId>();

  const attribute: Attribute = getMockAttribute("Verified", attributeId);
  const tenantAttribute: VerifiedTenantAttribute = {
    assignmentTimestamp: new Date(),
    type: tenantAttributeType.VERIFIED,
    id: attributeId,
    verifiedBy: [
      {
        id: verifierTenantId,
        verificationDate: new Date(),
      },
    ],
    revokedBy: [],
  };

  const targetTenant: Tenant = {
    ...getMockTenant(targetTenantId),
    name: "Target Tenant",
    mails: [getMockTenantMail()],
    attributes: [tenantAttribute],
  };
  const verifierTenant = {
    ...getMockTenant(verifierTenantId),
    name: "Verifier Tenant",
  };
  const users = [getMockUser(targetTenantId), getMockUser(targetTenantId)];

  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneTenant(verifierTenant);
    await addOneTenant(targetTenant);
    await addOneAttribute(attribute);
    for (const user of users) {
      await addOneUser(user);
    }
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: targetTenantId,
        enabled: true,
        createAt: new Date(),
      });
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockImplementation((tenantIds: TenantId[], _: NotificationType) =>
        users
          .filter((user) =>
            tenantIds.includes(unsafeBrandId<TenantId>(user.tenantId))
          )
          .map((user) => ({ userId: user.id, tenantId: user.tenantId }))
      );
  });

  it("should throw missingKafkaMessageDataError when tenant is undefined", async () => {
    await expect(() =>
      handleTenantVerifiedAttributeAssigned({
        tenantV2Msg: undefined,
        attributeId: generateId(),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("tenant", "TenantVerifiedAttributeAssigned")
    );
  });

  it("should throw attributeNotFound when attribute is not found", async () => {
    const unknownAttributeId = generateId<AttributeId>();

    await expect(() =>
      handleTenantVerifiedAttributeAssigned({
        tenantV2Msg: toTenantV2(targetTenant),
        attributeId: unknownAttributeId,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(attributeNotFound(unknownAttributeId));
  });

  it("should generate no messages when tenant doesn't contain the attribute from the event", async () => {
    const tenantWithNoAttributes: Tenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
      attributes: [],
    };
    await addOneTenant(tenantWithNoAttributes);

    const messages = await handleTenantVerifiedAttributeAssigned({
      tenantV2Msg: toTenantV2(tenantWithNoAttributes),
      attributeId,
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(0);
  });

  it("should generate no messages when tenant attribute has no associated verification", async () => {
    const unverifiedAttribute: VerifiedTenantAttribute = {
      id: attributeId,
      assignmentTimestamp: new Date(),
      type: tenantAttributeType.VERIFIED,
      verifiedBy: [],
      revokedBy: [],
    };

    const tenantWithNoAttributes: Tenant = {
      ...getMockTenant(),
      mails: [getMockTenantMail()],
      attributes: [unverifiedAttribute],
    };
    await addOneTenant(tenantWithNoAttributes);

    const messages = await handleTenantVerifiedAttributeAssigned({
      tenantV2Msg: toTenantV2(tenantWithNoAttributes),
      attributeId,
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(0);
  });

  it("should generate one message per user of the tenant that is assigned the attribute", async () => {
    const messages = await handleTenantVerifiedAttributeAssigned({
      tenantV2Msg: toTenantV2(targetTenant),
      attributeId,
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(2);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[0].id
      )
    ).toBe(true);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[1].id
      )
    ).toBe(true);
  });

  it("should not generate a message if the user disabled this email notification", async () => {
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([
        { userId: users[0].id, tenantId: users[0].tenantId },
      ]);

    const messages = await handleTenantVerifiedAttributeAssigned({
      tenantV2Msg: toTenantV2(targetTenant),
      attributeId,
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(1);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[0].id
      )
    ).toBe(true);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[1].id
      )
    ).toBe(false);
  });

  it("should generate a complete and correct message", async () => {
    const messages = await handleTenantVerifiedAttributeAssigned({
      tenantV2Msg: toTenantV2(targetTenant),
      attributeId,
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toBe(2);
    messages.forEach((message) => {
      expect(message.email.body).toContain("<!-- Footer -->");
      expect(message.email.body).toContain("<!-- Title & Main Message -->");
      expect(message.email.body).toContain(
        `Hai ricevuto un nuovo attributo verificato`
      );
      match(message.type)
        .with("User", () => {
          expect(message.email.body).toContain("{{ recipientName }}");
          expect(message.email.body).toContain(verifierTenant.name);
        })
        .with("Tenant", () => {
          expect(message.email.body).toContain(targetTenant.name);
          expect(message.email.body).toContain(verifierTenant.name);
        })
        .exhaustive();
      expect(message.email.body).toContain(attribute.name);
    });
  });
});
