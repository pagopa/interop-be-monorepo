/* eslint-disable @typescript-eslint/no-explicit-any */
import { addDays } from "date-fns";
import { genericLogger } from "pagopa-interop-commons";
import {
  DescriptorId,
  EServiceId,
  TenantId,
  UserId,
  generateId,
  Descriptor,
  EService,
  archivingScope,
  descriptorState,
  GracePeriodDays,
  gracePeriodDays,
} from "pagopa-interop-models";
import {
  ScheduledNotificationRow,
  formatEServiceIdDescriptorId,
  schedulableEventType,
  scheduledNotificationChannel,
} from "pagopa-interop-scheduled-notification-db-models";
import { describe, it, expect, vi } from "vitest";

import { handleEserviceDescriptorArchivingScheduledReminderInApp } from "../../src/handlers/eservices/handleEserviceDescriptorArchivingScheduledReminderInApp.js";

const makeDescriptor = (
  overrides: Partial<Descriptor> = {},
  gracePeriodDaysValue: GracePeriodDays = 30
): Descriptor => ({
  id: generateId<DescriptorId>(),
  version: "1",
  description: undefined,
  interface: undefined,
  docs: [],
  state: descriptorState.archiving,
  audience: [],
  voucherLifespan: 3600,
  dailyCallsPerConsumer: 100,
  dailyCallsTotal: 1000,
  agreementApprovalPolicy: undefined,
  createdAt: new Date(),
  serverUrls: [],
  serverUrlsDescriptions: [],
  attributes: { certified: [], declared: [], verified: [] },
  publishedAt: undefined,
  suspendedAt: undefined,
  deprecatedAt: undefined,
  archivedAt: undefined,
  rejectionReasons: undefined,
  templateVersionRef: undefined,
  archivingSchedule: {
    archivableOn: addDays(new Date(), 7),
    startedAt: new Date(),
    scope: archivingScope.descriptor,
    gracePeriodDays: gracePeriodDaysValue,
  },
  ...overrides,
});

const makeEservice = (overrides: Partial<EService> = {}): EService => ({
  id: generateId<EServiceId>(),
  producerId: generateId<TenantId>(),
  name: "test-eservice",
  description: "desc",
  technology: "Rest",
  descriptors: [],
  createdAt: new Date(),
  riskAnalysis: [],
  mode: "Deliver",
  isClientAccessDelegable: undefined,
  templateId: undefined,
  isSignalHubEnabled: undefined,
  isConsumerDelegable: undefined,
  ...overrides,
});

const buildRow = (entityId: string): ScheduledNotificationRow => ({
  id: generateId(),
  channel: scheduledNotificationChannel.inApp,
  eventType: schedulableEventType.eserviceDescriptorArchivingScheduled,
  entityId,
  correlationId: generateId(),
  sendAt: new Date(),
  sentAt: null,
  skippedAt: null,
  attempts: 0,
  lastError: null,
  createdAt: new Date(),
});

describe("handleEserviceDescriptorArchivingScheduledReminderInApp", () => {
  it("returns no notifications when the eservice is missing from the readmodel", async () => {
    const row = buildRow(
      formatEServiceIdDescriptorId(
        generateId<EServiceId>(),
        generateId<DescriptorId>()
      )
    );
    const readModelService = {
      getEServiceById: vi.fn().mockResolvedValue(undefined),
    } as any;
    const result =
      await handleEserviceDescriptorArchivingScheduledReminderInApp(
        row,
        readModelService,
        genericLogger
      );
    expect(result).toEqual([]);
  });

  it("returns no notifications when the descriptor is missing", async () => {
    const descriptor = makeDescriptor();
    const otherDescriptorId = generateId<DescriptorId>();
    const eservice = makeEservice({ descriptors: [descriptor] });
    const row = buildRow(
      formatEServiceIdDescriptorId(eservice.id, otherDescriptorId)
    );
    const readModelService = {
      getEServiceById: vi.fn().mockResolvedValue(eservice),
    } as any;
    const result =
      await handleEserviceDescriptorArchivingScheduledReminderInApp(
        row,
        readModelService,
        genericLogger
      );
    expect(result).toEqual([]);
  });

  it.each([...gracePeriodDays])(
    "returns one producer + one consumer notification for an active agreement (gracePeriodDays: %d)",
    async (gracePeriodDaysValue: GracePeriodDays) => {
      const descriptor = makeDescriptor({}, gracePeriodDaysValue);
      const eservice = makeEservice({ descriptors: [descriptor] });
      const consumerId = generateId<TenantId>();
      const producerUserId = generateId<UserId>();
      const consumerUserId = generateId<UserId>();

      const readModelService = {
        notificationTypeBlocklist: [],
        getEServiceById: vi.fn().mockResolvedValue(eservice),
        getTenantById: vi.fn().mockResolvedValue({ name: "producer-tenant" }),
        getAgreementsByEserviceId: vi.fn().mockResolvedValue([
          {
            consumerId,
            eserviceId: eservice.id,
            descriptorId: descriptor.id,
          },
        ]),
        getTenantUsersWithNotificationEnabled: vi
          .fn()
          .mockImplementation(
            async (_tenantIds: TenantId[], notifType: string) => {
              if (notifType === "eserviceStateChangedToProducer") {
                return [
                  {
                    userId: producerUserId,
                    tenantId: eservice.producerId,
                    userRoles: ["admin"],
                  },
                ];
              }
              if (notifType === "eserviceStateChangedToConsumer") {
                return [
                  {
                    userId: consumerUserId,
                    tenantId: consumerId,
                    userRoles: ["admin"],
                  },
                ];
              }
              return [];
            }
          ),
      } as any;

      const result =
        await handleEserviceDescriptorArchivingScheduledReminderInApp(
          buildRow(formatEServiceIdDescriptorId(eservice.id, descriptor.id)),
          readModelService,
          genericLogger
        );

      expect(result).toHaveLength(2);
      const producer = result.find(
        (n) => n.notificationType === "eserviceStateChangedToProducer"
      );
      const consumer = result.find(
        (n) => n.notificationType === "eserviceStateChangedToConsumer"
      );
      expect(producer?.userId).toBe(producerUserId);
      expect(producer?.tenantId).toBe(eservice.producerId);
      expect(producer?.body).toContain("sarà archiviata");
      expect(consumer?.userId).toBe(consumerUserId);
      expect(consumer?.tenantId).toBe(consumerId);
    }
  );
});
