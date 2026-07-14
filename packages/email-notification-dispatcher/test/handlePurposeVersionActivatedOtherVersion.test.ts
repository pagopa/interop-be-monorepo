/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/no-identical-functions */
import {
  getMockContext,
  getMockDescriptorPublished,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
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
  PurposeVersion,
  PurposeVersionId,
  purposeVersionState,
  Tenant,
  TenantId,
  TenantNotificationConfigId,
  toPurposeV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handlePurposeVersionActivatedOtherVersion } from "../src/handlers/purposes/handlePurposeVersionActivatedOtherVersion.js";
import {
  addOneEService,
  addOnePurpose,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handlePurposeVersionActivatedOtherVersion", async () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();

  // The e-service descriptor per-consumer threshold is intentionally different
  // from the activated purpose version's dailyCalls: the email must report the
  // approved purpose version value, not the descriptor value.
  const eservice: EService = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    descriptors: [
      { ...getMockDescriptorPublished(), dailyCallsPerConsumer: 1 },
    ],
  };
  const producerTenant: Tenant = {
    ...getMockTenant(producerId),
    name: "Producer Tenant",
  };
  const consumerTenant: Tenant = {
    ...getMockTenant(consumerId),
    name: "Consumer Tenant",
  };
  const users = [getMockUser(consumerId), getMockUser(consumerId)];

  // Previous (archived) version with the original threshold, and the newly
  // activated version with the approved threshold.
  const previousVersion: PurposeVersion = {
    ...getMockPurposeVersion(purposeVersionState.archived),
    dailyCalls: 2,
  };
  const activatedVersion: PurposeVersion = {
    ...getMockPurposeVersion(purposeVersionState.active),
    dailyCalls: 4,
  };

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
            // Only consider ADMIN_ROLE since role restrictions are tested separately in getRecipientsForTenants.test.ts
            userRoles: [authRole.ADMIN_ROLE],
          }))
      );
  });

  const addPurposeWithVersions = async (): Promise<Purpose> => {
    const purpose: Purpose = {
      ...getMockPurpose([previousVersion, activatedVersion]),
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);
    return purpose;
  };

  it("should throw missingKafkaMessageDataError when purpose is undefined", async () => {
    await expect(() =>
      handlePurposeVersionActivatedOtherVersion({
        purposeV2Msg: undefined,
        purposeVersionId: activatedVersion.id,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeVersionActivated")
    );
  });

  it("should generate no messages when the purpose has a single version", async () => {
    const purpose: Purpose = {
      ...getMockPurpose([activatedVersion]),
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOnePurpose(purpose);

    const messages = await handlePurposeVersionActivatedOtherVersion({
      purposeV2Msg: toPurposeV2(purpose),
      purposeVersionId: activatedVersion.id,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(0);
  });

  it("should generate no messages when the activated version can't be found", async () => {
    const purpose = await addPurposeWithVersions();

    const messages = await handlePurposeVersionActivatedOtherVersion({
      purposeV2Msg: toPurposeV2(purpose),
      purposeVersionId: generateId<PurposeVersionId>(),
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(0);
  });

  it("should generate one message per user of the consumer", async () => {
    const purpose = await addPurposeWithVersions();

    const messages = await handlePurposeVersionActivatedOtherVersion({
      purposeV2Msg: toPurposeV2(purpose),
      purposeVersionId: activatedVersion.id,
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
          // Only consider ADMIN_ROLE since role restrictions are tested separately in getRecipientsForTenants.test.ts
          userRoles: [authRole.ADMIN_ROLE],
        },
      ]);

    const purpose = await addPurposeWithVersions();

    const messages = await handlePurposeVersionActivatedOtherVersion({
      purposeV2Msg: toPurposeV2(purpose),
      purposeVersionId: activatedVersion.id,
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

  it("should report the approved (activated) version dailyCalls, not the descriptor or the previous version", async () => {
    const purpose = await addPurposeWithVersions();

    const messages = await handlePurposeVersionActivatedOtherVersion({
      purposeV2Msg: toPurposeV2(purpose),
      purposeVersionId: activatedVersion.id,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toBe(2);
    messages.forEach((message) => {
      expect(message.email.body).toContain("<!-- Title & Main Message -->");
      expect(message.email.body).toContain("<!-- Footer -->");
      expect(message.email.body).toContain(
        `Richiesta di adeguamento piano di carico accettata per la finalità &quot;${purpose.title}&quot;`
      );
      // The approved threshold (activated version dailyCalls = 4) must appear,
      // not the descriptor dailyCallsPerConsumer (1) nor the previous version (2).
      expect(message.email.body).toContain(
        "<strong>4</strong> chiamate giornaliere"
      );
      expect(message.email.body).not.toContain(
        "<strong>1</strong> chiamate giornaliere"
      );
      expect(message.email.body).not.toContain(
        "<strong>2</strong> chiamate giornaliere"
      );
      expect(message.email.body).toContain(producerTenant.name);
      expect(message.email.body).toContain(eservice.name);
      expect(message.email.body).toContain(purpose.title);
    });
  });
});
