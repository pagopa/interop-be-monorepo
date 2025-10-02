/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/no-identical-functions */
import {
  getMockContext,
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
  EServiceTemplateVersionId,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  TenantId,
  TenantNotificationConfigId,
  toEServiceTemplateV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantNotFound } from "../src/models/errors.js";
import { handleEServiceTemplateVersionPublished } from "../src/handlers/eserviceTemplates/handleEServiceTemplateVersionPublished.js";
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

describe("handleEServiceTemplateVersionPublished", async () => {
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
  };
  const eserviceTemplateVersionId = eserviceTemplate.versions[0].id;

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
      handleEServiceTemplateVersionPublished({
        eserviceTemplateV2Msg: undefined,
        eserviceTemplateVersionId,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eserviceTemplate",
        "EServiceTemplateVersionPublished"
      )
    );
  });

  it("should throw tenantNotFound when creator is not found", async () => {
    const unknownCreatorId = generateId<TenantId>();
    const eserviceTemplateUnknownCreator = {
      ...getMockEServiceTemplate(),
      creatorId: unknownCreatorId,
    };
    await addOneEServiceTemplate(eserviceTemplateUnknownCreator);

    await expect(() =>
      handleEServiceTemplateVersionPublished({
        eserviceTemplateV2Msg: toEServiceTemplateV2(
          eserviceTemplateUnknownCreator
        ),
        eserviceTemplateVersionId,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownCreatorId));
  });

  it("should generate no messages when eservice template version can't be found", async () => {
    const unknownEServiceTemplateVersionId =
      generateId<EServiceTemplateVersionId>();
    const eserviceTemplateUnknownVersions: EServiceTemplate = {
      ...getMockEServiceTemplate(eserviceTemplateId),
      creatorId,
    };
    await addOneEServiceTemplate(eserviceTemplateUnknownVersions);

    const messages = await handleEServiceTemplateVersionPublished({
      eserviceTemplateV2Msg: toEServiceTemplateV2(
        eserviceTemplateUnknownVersions
      ),
      eserviceTemplateVersionId: unknownEServiceTemplateVersionId,
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(0);
  });

  it("should generate one message per user of the instantiator", async () => {
    const messages = await handleEServiceTemplateVersionPublished({
      eserviceTemplateV2Msg: toEServiceTemplateV2(eserviceTemplate),
      eserviceTemplateVersionId,
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

    const messages = await handleEServiceTemplateVersionPublished({
      eserviceTemplateV2Msg: toEServiceTemplateV2(eserviceTemplate),
      eserviceTemplateVersionId,
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
    const messages = await handleEServiceTemplateVersionPublished({
      eserviceTemplateV2Msg: toEServiceTemplateV2(eserviceTemplate),
      eserviceTemplateVersionId,
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
        `Nuova versione del template &quot;${eserviceTemplate.name}&quot;`
      );
      expect(message.email.body).toContain(instantiatorTenant.name);
      expect(message.email.body).toContain(creatorTenant.name);
      expect(message.email.body).toContain(eserviceTemplate.name);
      expect(message.email.body).toContain(
        eserviceTemplate.versions[0].version
      );
    });
  });
});
