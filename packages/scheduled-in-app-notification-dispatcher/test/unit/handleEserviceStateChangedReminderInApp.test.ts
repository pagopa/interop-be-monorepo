/* eslint-disable @typescript-eslint/no-explicit-any */
import { addDays, addMinutes } from "date-fns";
import { describe, it, expect, vi } from "vitest";
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
} from "pagopa-interop-models";
import {
  ScheduledNotificationRow,
  formatEServiceIdDescriptorId,
  schedulableEventType,
  scheduledNotificationChannel,
} from "pagopa-interop-scheduled-notification-db-models";
import { handleEserviceStateChangedReminderInApp } from "../../src/handlers/eservices/handleEserviceStateChangedReminderInApp.js";

const makeDescriptor = (overrides: Partial<Descriptor> = {}): Descriptor => ({
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
  },
  ...overrides,
});

const makeEservice = (overrides: Partial<EService> = {}): EService => ({
  id: generateId<EServiceId>(),
  producerId: generateId<TenantId>(),
  name: "test-eservice",
  description: "desc",
  technology: "Rest",
  attributes: undefined,
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
  sendAt: new Date(),
  sentAt: null,
  attempts: 0,
  lastError: null,
  createdAt: new Date(),
});

describe("handleEserviceStateChangedReminderInApp", () => {
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
    const result = await handleEserviceStateChangedReminderInApp(
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
    const result = await handleEserviceStateChangedReminderInApp(
      row,
      readModelService,
      genericLogger
    );
    expect(result).toEqual([]);
  });

  it("returns one producer + one consumer notification for an active agreement", async () => {
    const descriptor = makeDescriptor();
    const eservice = makeEservice({ descriptors: [descriptor] });
    const consumerId = generateId<TenantId>();
    const producerUserId = generateId<UserId>();
    const consumerUserId = generateId<UserId>();

    const readModelService = {
      notificationTypeBlocklist: [],
      getEServiceById: vi.fn().mockResolvedValue(eservice),
      getTenantById: vi.fn().mockResolvedValue({ name: "producer-tenant" }),
      getAgreementsByEserviceId: vi
        .fn()
        .mockResolvedValue([{ consumerId, eserviceId: eservice.id }]),
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

    const result = await handleEserviceStateChangedReminderInApp(
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
    expect(producer?.body).toContain("verrà archiviata");
    expect(consumer?.userId).toBe(consumerUserId);
    expect(consumer?.tenantId).toBe(consumerId);
    expect(consumer?.body).toContain("producer-tenant");
  });

  it("clamps daysRemaining to 0 when archivableOn is in the past", async () => {
    const descriptor = makeDescriptor({
      archivingSchedule: {
        archivableOn: addMinutes(new Date(), -1),
        startedAt: new Date(),
        scope: archivingScope.descriptor,
      },
    });
    const eservice = makeEservice({ descriptors: [descriptor] });

    const readModelService = {
      notificationTypeBlocklist: [],
      getEServiceById: vi.fn().mockResolvedValue(eservice),
      getTenantById: vi.fn().mockResolvedValue({ name: "producer-tenant" }),
      getAgreementsByEserviceId: vi.fn().mockResolvedValue([]),
      getTenantUsersWithNotificationEnabled: vi.fn().mockResolvedValue([
        {
          userId: generateId<UserId>(),
          tenantId: eservice.producerId,
          userRoles: ["admin"],
        },
      ]),
    } as any;

    const result = await handleEserviceStateChangedReminderInApp(
      buildRow(formatEServiceIdDescriptorId(eservice.id, descriptor.id)),
      readModelService,
      genericLogger
    );
    expect(result).toHaveLength(1);
    // daysRemaining=0 → renders "fra 0 giorni" (we don't render "domani" for 0)
    expect(result[0].body).toContain("fra 0 giorni");
  });
});
