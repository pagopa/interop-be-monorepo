/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/no-identical-functions */
import {
  getMockContext,
  getMockDescriptorPublished,
  getMockEService,
  getMockEServiceTemplate,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  CorrelationId,
  EService,
  EServiceId,
  EServiceTemplate,
  EServiceTemplateId,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  TenantId,
  TenantNotificationConfigId,
  toEServiceTemplateV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { match } from "ts-pattern";
import { handleEServiceTemplateNameUpdated } from "../src/handlers/eserviceTemplates/handleEserviceTemplateNameUpdated.js";
import {
  addOneEService,
  addOneEServiceTemplate,
  addOneTenant,
  addOneUser,
  getMockUser,
  readModelService,
  templateService,
  userService,
} from "./utils.js";

describe("handleEServiceTemplateNameUpdated", async () => {
  const oldName = "Old name";
  const creatorId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const instantiatorId = generateId<TenantId>();
  const eserviceTemplateId = generateId<EServiceTemplateId>();

  const eserviceTemplate: EServiceTemplate = {
    ...getMockEServiceTemplate(eserviceTemplateId),
    creatorId,
  };
  const eservice: EService = {
    ...getMockEService(eserviceId),
    templateId: eserviceTemplateId,
    producerId: instantiatorId,
    descriptors: [getMockDescriptorPublished()],
  };

  const creatorTenant = getMockTenant(creatorId);
  const instantiatorTenant = getMockTenant(instantiatorId);
  const users = [getMockUser(instantiatorId), getMockUser(instantiatorId)];

  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneEServiceTemplate(eserviceTemplate);
    await addOneEService(eservice);
    await addOneTenant(instantiatorTenant);
    await addOneTenant(creatorTenant);
    for (const user of users) {
      await addOneUser(user);
    }
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: instantiatorTenant.id,
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

  it("should throw missingKafkaMessageDataError when eserviceTemplate is undefined", async () => {
    await expect(() =>
      handleEServiceTemplateNameUpdated({
        eserviceTemplateV2Msg: undefined,
        oldName,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eserviceTemplate",
        "EServiceTemplateNameUpdated"
      )
    );
  });

  it("should generate one message per user of the instantiator", async () => {
    const messages = await handleEServiceTemplateNameUpdated({
      eserviceTemplateV2Msg: toEServiceTemplateV2(eserviceTemplate),
      oldName,
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

    const messages = await handleEServiceTemplateNameUpdated({
      eserviceTemplateV2Msg: toEServiceTemplateV2(eserviceTemplate),
      oldName,
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
    const messages = await handleEServiceTemplateNameUpdated({
      eserviceTemplateV2Msg: toEServiceTemplateV2(eserviceTemplate),
      oldName,
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
        `Aggiornamento nome del template &quot;${oldName}&quot;`
      );
      expect(message.email.body).toContain(oldName);
      match(message.type)
        .with("User", () => {
          expect(message.email.body).toContain("{{ recipientName }}");
        })
        .with("Tenant", () => {
          expect(message.email.body).toContain(instantiatorTenant.name);
        })
        .exhaustive();
      expect(message.email.body).toContain(eserviceTemplate.name);
    });
  });
});
