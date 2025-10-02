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
  TenantId,
  TenantNotificationConfigId,
  toTenantV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleTenantCertifiedAttributeRevoked } from "../src/handlers/tenants/handleTenantCertifiedAttributeRevoked.js";
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

describe("handleTenantCertifiedAttributeRevoked", async () => {
  const targetTenantId = generateId<TenantId>();
  const certifierTenantId = generateId<TenantId>();
  const certifierId = generateId();
  const attributeId = generateId<AttributeId>();

  const attribute: Attribute = {
    ...getMockAttribute("Certified", attributeId),
    origin: certifierId,
  };

  const targetTenant: Tenant = {
    ...getMockTenant(targetTenantId),
    mails: [getMockTenantMail()],
  };
  const certifierTenant: Tenant = {
    ...getMockTenant(certifierTenantId),
    features: [
      {
        type: "PersistentCertifier",
        certifierId,
      },
    ],
  };
  const users = [getMockUser(targetTenantId), getMockUser(targetTenantId)];

  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneTenant(targetTenant);
    await addOneTenant(certifierTenant);
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
      handleTenantCertifiedAttributeRevoked({
        tenantV2Msg: undefined,
        attributeId: generateId(),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("tenant", "TenantCertifiedAttributeRevoked")
    );
  });

  it("should throw attributeNotFound when attribute is not found", async () => {
    const unknownAttributeId = generateId<AttributeId>();

    await expect(() =>
      handleTenantCertifiedAttributeRevoked({
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

  it("should generate no messages when attribute has no origin", async () => {
    const attributeWithNoOrigin: Attribute = getMockAttribute("Certified");
    await addOneAttribute(attributeWithNoOrigin);

    const messages = await handleTenantCertifiedAttributeRevoked({
      tenantV2Msg: toTenantV2(targetTenant),
      attributeId: attributeWithNoOrigin.id,
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(0);
  });

  it("should generate one message per user of the tenant that is assigned the attribute", async () => {
    const messages = await handleTenantCertifiedAttributeRevoked({
      tenantV2Msg: toTenantV2(targetTenant),
      attributeId,
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(2);
    expect(messages.some((message) => message.address === users[0].email)).toBe(
      true
    );
    expect(messages.some((message) => message.address === users[1].email)).toBe(
      true
    );
  });

  it("should not generate a message if the user disabled this email notification", async () => {
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([
        { userId: users[0].id, tenantId: users[0].tenantId },
      ]);

    const messages = await handleTenantCertifiedAttributeRevoked({
      tenantV2Msg: toTenantV2(targetTenant),
      attributeId,
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(1);
    expect(messages.some((message) => message.address === users[0].email)).toBe(
      true
    );
    expect(messages.some((message) => message.address === users[1].email)).toBe(
      false
    );
  });

  it("should generate a complete and correct message", async () => {
    const messages = await handleTenantCertifiedAttributeRevoked({
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
        `Un tuo attributo certificato è stato revocato`
      );
      expect(message.email.body).toContain(certifierTenant.name);
      expect(message.email.body).toContain(targetTenant.name);
      expect(message.email.body).toContain(attribute.name);
    });
  });
});
