/* eslint-disable @typescript-eslint/no-explicit-any */
import { addDays } from "date-fns";
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
  formatEServiceEntityId,
  schedulableEventType,
  scheduledNotificationChannel,
} from "pagopa-interop-scheduled-notification-db-models";
import { handleEserviceArchivingScheduledReminderInApp } from "../../src/handlers/eservices/handleEserviceArchivingScheduledReminderInApp.js";

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
  serverDescriptionUrls: [],
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
    scope: archivingScope.eservice,
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
  eventType: schedulableEventType.eserviceArchivingScheduled,
  entityId,
  correlationId: generateId(),
  sendAt: new Date(),
  sentAt: null,
  skippedAt: null,
  attempts: 0,
  lastError: null,
  createdAt: new Date(),
});

describe("handleEserviceArchivingScheduledReminderInApp", () => {
  it("returns no notifications when the eservice is missing from the readmodel", async () => {
    const eserviceId = generateId<EServiceId>();
    const row = buildRow(formatEServiceEntityId(eserviceId));
    const readModelService = {
      getEServiceById: vi.fn().mockResolvedValue(undefined),
    } as any;
    const result = await handleEserviceArchivingScheduledReminderInApp(
      row,
      readModelService,
      genericLogger
    );
    expect(result).toEqual([]);
  });

  it("returns no notifications when no descriptor has scope=EService", async () => {
    const descriptor = makeDescriptor({
      archivingSchedule: {
        archivableOn: addDays(new Date(), 7),
        startedAt: new Date(),
        scope: archivingScope.descriptor,
      },
    });
    const eservice = makeEservice({ descriptors: [descriptor] });
    const readModelService = {
      getEServiceById: vi.fn().mockResolvedValue(eservice),
    } as any;
    const result = await handleEserviceArchivingScheduledReminderInApp(
      buildRow(formatEServiceEntityId(eservice.id)),
      readModelService,
      genericLogger
    );
    expect(result).toEqual([]);
  });

  it("notifies producer + all consumers across all eservice-scope descriptors with copy that does NOT cite a specific version", async () => {
    const descriptorA = makeDescriptor();
    const descriptorB = makeDescriptor();
    const eservice = makeEservice({
      descriptors: [descriptorA, descriptorB],
    });
    const consumerA = generateId<TenantId>();
    const consumerB = generateId<TenantId>();
    const producerUserId = generateId<UserId>();
    const consumerAUserId = generateId<UserId>();
    const consumerBUserId = generateId<UserId>();

    const readModelService = {
      notificationTypeBlocklist: [],
      getEServiceById: vi.fn().mockResolvedValue(eservice),
      getTenantById: vi.fn().mockResolvedValue({ name: "producer-tenant" }),
      getAgreementsByEserviceId: vi.fn().mockResolvedValue([
        {
          consumerId: consumerA,
          eserviceId: eservice.id,
          descriptorId: descriptorA.id,
        },
        {
          consumerId: consumerB,
          eserviceId: eservice.id,
          descriptorId: descriptorB.id,
        },
      ]),
      getTenantUsersWithNotificationEnabled: vi
        .fn()
        .mockImplementation(
          async (tenantIds: TenantId[], notifType: string) => {
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
              return tenantIds.map((tenantId) => ({
                userId:
                  tenantId === consumerA ? consumerAUserId : consumerBUserId,
                tenantId,
                userRoles: ["admin"],
              }));
            }
            return [];
          }
        ),
    } as any;

    const result = await handleEserviceArchivingScheduledReminderInApp(
      buildRow(formatEServiceEntityId(eservice.id)),
      readModelService,
      genericLogger
    );

    expect(result).toHaveLength(3); // 1 producer + 2 consumers
    const producer = result.find(
      (n) => n.notificationType === "eserviceStateChangedToProducer"
    );
    const consumers = result.filter(
      (n) => n.notificationType === "eserviceStateChangedToConsumer"
    );
    expect(producer?.userId).toBe(producerUserId);
    expect(producer?.entityId).toBe(eservice.id);
    expect(producer?.body).toContain("sarà archiviato");
    expect(producer?.body).not.toMatch(/versione\s+\d/);
    expect(consumers).toHaveLength(2);
    expect(consumers.every((c) => c.body.includes("producer-tenant"))).toBe(
      false
    );
    expect(consumers.every((c) => !/versione\s+\d/.test(c.body))).toBe(true);
  });
});
