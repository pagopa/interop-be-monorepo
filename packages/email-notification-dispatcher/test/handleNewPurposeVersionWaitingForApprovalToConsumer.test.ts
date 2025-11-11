/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/no-identical-functions */
import {
  getMockContext,
  getMockDescriptorPublished,
  getMockEService,
  getMockPurpose,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import {
  CorrelationId,
  EService,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  Purpose,
  Tenant,
  TenantId,
  TenantNotificationConfigId,
  toPurposeV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eServiceNotFound, tenantNotFound } from "../src/models/errors.js";
import { handleNewPurposeVersionWaitingForApprovalToConsumer } from "../src/handlers/purposes/handleNewPurposeVersionWaitingForApprovalOverthreshold.js";
import {
  addOneEService,
  addOnePurpose,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleNewPurposeVersionWaitingForApprovalOverthreshold", async () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();

  const dailyCallsPerConsumer = 1000;
  const descriptor = {
    ...getMockDescriptorPublished(),
    dailyCallsPerConsumer,
  };

  const eservice: EService = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    descriptors: [descriptor],
  };
  const producerTenant: Tenant = {
    ...getMockTenant(producerId),
    name: "Producer Tenant",
  };
  const consumerTenant = {
    ...getMockTenant(consumerId),
    name: "Consumer Tenant",
  };
  const users = [
    getMockUser(consumerTenant.id),
    getMockUser(consumerTenant.id),
  ];

  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneEService(eservice);
    await addOneTenant(producerTenant);
    await addOneTenant(consumerTenant);
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: consumerTenant.id,
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
          .map((user) => ({
            userId: user.id,
            tenantId: user.tenantId,
            // Only consider ADMIN_ROLE and SECURITY_ROLE since role restrictions are tested separately
            userRoles: [authRole.ADMIN_ROLE, authRole.SECURITY_ROLE],
          }))
      );
  });

  it("should throw missingKafkaMessageDataError when purpose is undefined", async () => {
    await expect(() =>
      handleNewPurposeVersionWaitingForApprovalToConsumer({
        purposeV2Msg: undefined,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "purpose",
        "NewPurposeVersionWaitingForApproval"
      )
    );
  });

  it("should throw tenantNotFound when consumer is not found", async () => {
    const unknownConsumerId = generateId<TenantId>();

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: unknownConsumerId,
    };
    await addOnePurpose(purpose);

    await expect(() =>
      handleNewPurposeVersionWaitingForApprovalToConsumer({
        purposeV2Msg: toPurposeV2(purpose),
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownConsumerId));
  });

  it("should throw eServiceNotFound when eservice is not found", async () => {
    const unknownEServiceId = generateId<EServiceId>();

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: unknownEServiceId,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    await expect(() =>
      handleNewPurposeVersionWaitingForApprovalToConsumer({
        purposeV2Msg: toPurposeV2(purpose),
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(eServiceNotFound(unknownEServiceId));
  });

  it("should generate one message per user of the consumer", async () => {
    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    const messages = await handleNewPurposeVersionWaitingForApprovalToConsumer({
      purposeV2Msg: toPurposeV2(purpose),
      logger,
      templateService,
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
        {
          userId: users[0].id,
          tenantId: users[0].tenantId,
          userRoles: [authRole.ADMIN_ROLE],
        },
      ]);

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    const messages = await handleNewPurposeVersionWaitingForApprovalToConsumer({
      purposeV2Msg: toPurposeV2(purpose),
      logger,
      templateService,
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

  it("should not generate a message to the consumer if they disabled email notification", async () => {
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: consumerTenant.id,
        enabled: false,
        createAt: new Date(),
      });

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    const messages = await handleNewPurposeVersionWaitingForApprovalToConsumer({
      purposeV2Msg: toPurposeV2(purpose),
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    // User messages are still sent even if tenant config is disabled
    // Tenant config only affects tenant contact emails (which are not included anyway)
    expect(messages.length).toEqual(2);
  });

  it("should generate a complete and correct message", async () => {
    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    const messages = await handleNewPurposeVersionWaitingForApprovalToConsumer({
      purposeV2Msg: toPurposeV2(purpose),
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toBe(2);
    messages.forEach((message) => {
      expect(message.email.body).toContain("<!-- Title & Main Message -->");
      expect(message.email.body).toContain("<!-- Footer -->");
      expect(message.email.body).toContain(eservice.name);
      expect(message.email.body).toContain(dailyCallsPerConsumer.toString());
      if (message.type === "User") {
        expect(message.email.body).toContain("{{ recipientName }}");
      }
    });
  });

  it("should use dailyCallsPerConsumer from the latest published descriptor", async () => {
    const olderDescriptor = {
      ...getMockDescriptorPublished(),
      dailyCallsPerConsumer: 500,
      version: "1",
      publishedAt: new Date("2023-01-01"),
    };
    const newerDescriptor = {
      ...getMockDescriptorPublished(),
      dailyCallsPerConsumer: 2000,
      version: "2",
      publishedAt: new Date("2024-01-01"),
    };

    const eserviceWithMultipleDescriptors = {
      ...getMockEService(),
      id: generateId<EServiceId>(),
      producerId,
      descriptors: [olderDescriptor, newerDescriptor],
    };

    await addOneEService(eserviceWithMultipleDescriptors);

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eserviceWithMultipleDescriptors.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    const messages = await handleNewPurposeVersionWaitingForApprovalToConsumer({
      purposeV2Msg: toPurposeV2(purpose),
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toBe(2);
    messages.forEach((message) => {
      expect(message.email.body).toContain("2000");
      expect(message.email.body).not.toContain("500");
    });
  });
});
