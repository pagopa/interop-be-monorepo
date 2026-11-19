import { genericLogger } from "pagopa-interop-commons";
import { getMockTenant, toTenantV1 } from "pagopa-interop-commons-test";
import {
  genericInternalError,
  toTenantV2,
  toTenantV3,
  TenantEventEnvelopeV2,
  TenantEventEnvelopeV1,
  TenantEventEnvelopeV3,
  TenantEventV1,
  TenantEventV3,
  TenantM2MEvent,
  TenantM2MEventType,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleTenantEvent } from "../src/handlers/handleTenantEvent.js";
import {
  getMockEventEnvelopeCommons,
  retrieveAllTenantM2MEvents,
  retrieveLastTenantM2MEvent,
  testM2mEventWriterService,
} from "./utils.js";

describe("handleTenantEvent test", async () => {
  const tenant = getMockTenant();
  vi.spyOn(testM2mEventWriterService, "insertTenantM2MEvent");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(TenantM2MEventType.options)(
    "should write the %s M2M event",
    async (eventType: TenantM2MEvent["eventType"]) => {
      const message: TenantEventEnvelopeV2 = {
        ...getMockEventEnvelopeCommons(),
        stream_id: tenant.id,
        type: eventType,
        data: {
          tenant: toTenantV2(tenant),
        },
      } as TenantEventEnvelopeV2;

      const eventTimestamp = new Date();

      const expectedM2MEvent = {
        id: expect.any(String),
        eventType,
        eventTimestamp,
        resourceVersion: message.version,
        tenantId: tenant.id,
      };

      await handleTenantEvent(
        message,
        eventTimestamp,
        genericLogger,
        testM2mEventWriterService
      );

      expect(
        testM2mEventWriterService.insertTenantM2MEvent
      ).toHaveBeenCalledTimes(1);
      const actualM2MEvent = await retrieveLastTenantM2MEvent();
      expect(actualM2MEvent).toEqual(expectedM2MEvent);
    }
  );

  it("should ignore the MaintenanceTenantRemoteIdDeleted event", async () => {
    const message: TenantEventEnvelopeV2 = {
      ...getMockEventEnvelopeCommons(),
      stream_id: tenant.id,
      type: "MaintenanceTenantRemoteIdDeleted",
      event_version: 2,
      data: {
        tenant: toTenantV2(tenant),
      },
    };
    const eventTimestamp = new Date();

    await handleTenantEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService
    );

    expect(
      testM2mEventWriterService.insertTenantM2MEvent
    ).not.toHaveBeenCalled();
  });

  it.each(TenantEventV1.options.map((o) => o.shape.type.value))(
    "should ignore tenant %s v1 event",
    async (eventType: TenantEventV1["type"]) => {
      const tenant = getMockTenant();

      const message = {
        ...getMockEventEnvelopeCommons(),
        stream_id: tenant.id,
        type: eventType,
        event_version: 1,
        data: {
          tenant: toTenantV1(tenant),
        },
      } as TenantEventEnvelopeV1;

      const eventTimestamp = new Date();

      await handleTenantEvent(
        message,
        eventTimestamp,
        genericLogger,
        testM2mEventWriterService
      );

      expect(
        testM2mEventWriterService.insertTenantM2MEvent
      ).not.toHaveBeenCalled();
    }
  );

  it.each(TenantEventV3.options.map((o) => o.shape.type.value))(
    "should reject tenant %s v3 event until V3 is supported",
    async (eventType: TenantEventV3["type"]) => {
      const message = {
        ...getMockEventEnvelopeCommons(),
        stream_id: tenant.id,
        type: eventType,
        event_version: 3,
        data: {
          tenant: toTenantV3(tenant),
        },
      } as TenantEventEnvelopeV3;

      await expect(
        handleTenantEvent(
          message,
          new Date(),
          genericLogger,
          testM2mEventWriterService
        )
      ).rejects.toThrowError(
        genericInternalError(`Tenant event V3 not supported yet: ${eventType}`)
      );

      expect(
        testM2mEventWriterService.insertTenantM2MEvent
      ).not.toHaveBeenCalled();
    }
  );

  it("should not write the event if the same resource version is already present", async () => {
    const message = {
      ...getMockEventEnvelopeCommons(),
      stream_id: tenant.id,
      type: "TenantOnboarded",
      data: {
        tenant: toTenantV2(tenant),
      },
    } as TenantEventEnvelopeV2;

    const eventTimestamp = new Date();

    // Insert the event for the first time
    await handleTenantEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService
    );

    // Try to insert the same event again: should be skipped
    await handleTenantEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService
    );

    // Try to insert one with a further resource version: should be inserted
    await handleTenantEvent(
      { ...message, version: message.version + 1 },
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService
    );

    expect(
      testM2mEventWriterService.insertTenantM2MEvent
    ).toHaveBeenCalledTimes(3);

    expect(await retrieveAllTenantM2MEvents({ limit: 10 })).toHaveLength(2);
  });
});
