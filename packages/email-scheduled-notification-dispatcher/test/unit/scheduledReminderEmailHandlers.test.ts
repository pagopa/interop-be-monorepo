import { HtmlTemplateService, genericLogger } from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockDescriptorArchiving,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  CorrelationId,
  EService,
  EServiceId,
  NotificationType,
  Tenant,
  TenantId,
  UserId,
  UserRole,
  agreementState,
  archivingScope,
  generateId,
  userRole,
} from "pagopa-interop-models";
import {
  ScheduledNotificationRow,
  formatEServiceEntityId,
  formatEServiceIdDescriptorId,
  schedulableEventType,
  scheduledNotificationChannel,
} from "pagopa-interop-scheduled-notification-db-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleEserviceArchivingScheduledReminderEmail } from "../../src/handlers/eservices/handleEserviceArchivingScheduledReminderEmail.js";
import { handleEserviceDescriptorArchivingScheduledReminderEmail } from "../../src/handlers/eservices/handleEserviceDescriptorArchivingScheduledReminderEmail.js";
import { ReadModelServiceSQL } from "../../src/services/readModelServiceSQL.js";

vi.mock("pagopa-interop-notification-commons", async (importOriginal) => {
  const mod =
    await importOriginal<
      typeof import("pagopa-interop-notification-commons")
    >();
  return {
    ...mod,
    retrieveHTMLTemplate: vi.fn(async () => "email-template"),
  };
});

const correlationId = generateId<CorrelationId>();
const bffUrl = "https://selfcare.example.test/ui";

const templateService: HtmlTemplateService = {
  compileHtml: vi.fn((_template, context) => JSON.stringify(context)),
  registerPartial: vi.fn(),
};

const buildRow = (
  eventType: ScheduledNotificationRow["eventType"],
  entityId: string
): ScheduledNotificationRow => ({
  id: generateId(),
  channel: scheduledNotificationChannel.email,
  eventType,
  entityId,
  correlationId,
  sendAt: new Date(),
  sentAt: null,
  skippedAt: null,
  attempts: 0,
  lastError: null,
  createdAt: new Date(),
});

function buildReadModelService({
  eservice,
  producerTenant,
  consumerTenant,
  producerUserId,
  consumerUserId,
}: {
  eservice: EService;
  producerTenant: Tenant;
  consumerTenant: Tenant;
  producerUserId: UserId;
  consumerUserId: UserId;
}): ReadModelServiceSQL {
  const agreement = {
    ...getMockAgreement(eservice.id, consumerTenant.id, agreementState.active),
    descriptorId: eservice.descriptors[0].id,
  };

  return {
    notificationTypeBlocklist: [],
    getEServiceById: vi.fn(async () => eservice),
    getTenantById: vi.fn(async (tenantId: TenantId) =>
      tenantId === producerTenant.id ? producerTenant : undefined
    ),
    getTenantsByIds: vi.fn(async () => [consumerTenant]),
    getAgreementsByEserviceId: vi.fn(async () => [agreement]),
    getTenantUsersWithNotificationEnabled: vi.fn(
      async (
        _tenantIds: TenantId[],
        notificationType: NotificationType,
        _channel: "inApp" | "email"
      ): Promise<
        Array<{
          userId: UserId;
          tenantId: TenantId;
          userRoles: UserRole[];
        }>
      > =>
        notificationType === "eserviceStateChangedToProducer"
          ? [
              {
                userId: producerUserId,
                tenantId: producerTenant.id,
                userRoles: [userRole.ADMIN_ROLE],
              },
            ]
          : [
              {
                userId: consumerUserId,
                tenantId: consumerTenant.id,
                userRoles: [userRole.ADMIN_ROLE],
              },
            ]
    ),
    getActiveProducerDelegation: vi.fn(async () => undefined),
    getPurposeById: vi.fn(async () => undefined),
    getAttributeById: vi.fn(async () => undefined),
    getTenantByCertifierId: vi.fn(async () => undefined),
    getTenantNotificationConfigByTenantId: vi.fn(async () => undefined),
  };
}

function buildScenario(scope: "EService" | "Descriptor"): {
  eservice: EService;
  producerTenant: Tenant;
  consumerTenant: Tenant;
  producerUserId: UserId;
  consumerUserId: UserId;
  readModelService: ReadModelServiceSQL;
} {
  const baseDescriptor = getMockDescriptorArchiving();
  if (baseDescriptor.archivingSchedule === undefined) {
    throw new Error("Expected an archiving descriptor");
  }
  const descriptor = {
    ...baseDescriptor,
    archivingSchedule: {
      ...baseDescriptor.archivingSchedule,
      scope:
        scope === "EService"
          ? archivingScope.eservice
          : archivingScope.descriptor,
    },
  };
  const eservice = getMockEService(
    generateId<EServiceId>(),
    generateId<TenantId>(),
    [descriptor]
  );
  const producerTenant = getMockTenant(eservice.producerId);
  const consumerTenant = getMockTenant();
  const producerUserId = generateId<UserId>();
  const consumerUserId = generateId<UserId>();
  const readModelService = buildReadModelService({
    eservice,
    producerTenant,
    consumerTenant,
    producerUserId,
    consumerUserId,
  });

  return {
    eservice,
    producerTenant,
    consumerTenant,
    producerUserId,
    consumerUserId,
    readModelService,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("scheduled reminder email handlers", () => {
  it("notifies only the producer for an eservice reminder when an active agreement exists", async () => {
    const scenario = buildScenario("EService");

    const result = await handleEserviceArchivingScheduledReminderEmail(
      buildRow(
        schedulableEventType.eserviceArchivingScheduled,
        formatEServiceEntityId(scenario.eservice.id)
      ),
      {
        readModelService: scenario.readModelService,
        templateService,
        bffUrl,
        correlationId,
        log: genericLogger,
      }
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      tenantId: scenario.producerTenant.id,
      type: "User",
      userId: scenario.producerUserId,
      correlationId,
      email: {
        subject: `Promemoria: archiviazione dell'e-service "${scenario.eservice.name}"`,
      },
    });
    expect(
      scenario.readModelService.getAgreementsByEserviceId
    ).not.toHaveBeenCalled();
    expect(scenario.readModelService.getTenantsByIds).not.toHaveBeenCalled();
    expect(
      scenario.readModelService.getTenantUsersWithNotificationEnabled
    ).toHaveBeenCalledWith(
      [scenario.producerTenant.id],
      "eserviceStateChangedToProducer",
      "email"
    );
  });

  it("notifies only the producer for a descriptor reminder when an active agreement exists", async () => {
    const scenario = buildScenario("Descriptor");
    const descriptor = scenario.eservice.descriptors[0];

    const result =
      await handleEserviceDescriptorArchivingScheduledReminderEmail(
        buildRow(
          schedulableEventType.eserviceDescriptorArchivingScheduled,
          formatEServiceIdDescriptorId(scenario.eservice.id, descriptor.id)
        ),
        {
          readModelService: scenario.readModelService,
          templateService,
          bffUrl,
          correlationId,
          log: genericLogger,
        }
      );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      tenantId: scenario.producerTenant.id,
      type: "User",
      userId: scenario.producerUserId,
      correlationId,
      email: {
        subject: `Promemoria: archiviazione dell'e-service "${scenario.eservice.name}"`,
      },
    });
    expect(
      scenario.readModelService.getAgreementsByEserviceId
    ).not.toHaveBeenCalled();
    expect(scenario.readModelService.getTenantsByIds).not.toHaveBeenCalled();
    expect(
      scenario.readModelService.getTenantUsersWithNotificationEnabled
    ).toHaveBeenCalledWith(
      [scenario.producerTenant.id],
      "eserviceStateChangedToProducer",
      "email"
    );
  });
});
