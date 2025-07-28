/* eslint-disable functional/immutable-data */
import { AxiosError, AxiosResponse } from "axios";
import { logger } from "pagopa-interop-commons";
import {
  getMockNotificationConfig,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  TenantEventEnvelopeV2,
  generateId,
  TenantEventV2,
  CorrelationId,
  missingKafkaMessageDataError,
  TenantV2,
  toTenantV2,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  interopBeClients,
  notificationTenantLifecycleConsumerService,
  refreshableToken,
} from "./utils.js";

describe("notificationTenantLifecycleProcessor", async () => {
  const correlationId = generateId<CorrelationId>();
  const mockToken = "mockToken";

  const expectedHeaders = {
    "X-Correlation-Id": correlationId,
    Authorization: `Bearer ${mockToken}`,
  };

  const mockTenantNotificationConfig: notificationConfigApi.TenantNotificationConfig =
    {
      id: generateId(),
      tenantId: generateId(),
      config: getMockNotificationConfig(),
      createdAt: new Date().toJSON(),
      updatedAt: undefined,
    };

  const loggerInstance = logger({
    serviceName: "notification-tenant-lifecycle-consumer",
    correlationId,
  });

  const toTenantEventEnvelopeV2 = (
    event: TenantEventV2
  ): TenantEventEnvelopeV2 => ({
    ...event,
    sequence_num: 1,
    stream_id: "stream-id",
    version: 2,
    correlation_id: correlationId,
    log_date: new Date(),
  });

  refreshableToken.get = vi.fn().mockResolvedValue({ serialized: mockToken });

  beforeEach(() => {
    interopBeClients.notificationConfigProcess.client.createTenantDefaultNotificationConfig =
      vi.fn().mockResolvedValue(mockTenantNotificationConfig);
    interopBeClients.notificationConfigProcess.client.deleteTenantNotificationConfig =
      vi.fn().mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  it("Should call the createTenantDefaultNotificationConfig route on a TenantOnboarded event", async () => {
    const tenant: TenantV2 = toTenantV2(getMockTenant());
    const message = toTenantEventEnvelopeV2({
      type: "TenantOnboarded",
      data: { tenant },
      event_version: 2,
    });
    await notificationTenantLifecycleConsumerService.handleMessage(
      message,
      correlationId,
      loggerInstance
    );
    expect(refreshableToken.get).toHaveBeenCalledOnce();
    expect(
      interopBeClients.notificationConfigProcess.client
        .createTenantDefaultNotificationConfig
    ).toHaveBeenCalledOnce();
    expect(
      interopBeClients.notificationConfigProcess.client
        .createTenantDefaultNotificationConfig
    ).toHaveBeenCalledWith(
      { tenantId: tenant.id },
      {
        headers: expectedHeaders,
      }
    );
  });

  it("Should call the deleteTenantNotificationConfig route on a MaintenanceTenantDeleted event", async () => {
    const tenantId = generateId();
    const message = toTenantEventEnvelopeV2({
      type: "MaintenanceTenantDeleted",
      data: { tenantId },
      event_version: 2,
    });
    await notificationTenantLifecycleConsumerService.handleMessage(
      message,
      correlationId,
      loggerInstance
    );
    expect(refreshableToken.get).toHaveBeenCalledOnce();
    expect(
      interopBeClients.notificationConfigProcess.client
        .deleteTenantNotificationConfig
    ).toHaveBeenCalledOnce();
    expect(
      interopBeClients.notificationConfigProcess.client
        .deleteTenantNotificationConfig
    ).toHaveBeenCalledWith(undefined, {
      params: { tenantId },
      headers: expectedHeaders,
    });
  });

  it("Should throw missingKafkaMessageDataError when the tenant is missing in a TenantOnboarded event", async () => {
    const message = toTenantEventEnvelopeV2({
      type: "TenantOnboarded",
      data: {},
      event_version: 2,
    });
    await expect(
      notificationTenantLifecycleConsumerService.handleMessage(
        message,
        correlationId,
        loggerInstance
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("tenant", "TenantOnboarded")
    );
    expect(refreshableToken.get).not.toHaveBeenCalled();
    expect(
      interopBeClients.notificationConfigProcess.client
        .createTenantDefaultNotificationConfig
    ).not.toHaveBeenCalled();
  });

  it("Should ignore 409 errors when calling the createTenantDefaultNotificationConfig route", async () => {
    interopBeClients.notificationConfigProcess.client.createTenantDefaultNotificationConfig =
      vi.fn().mockRejectedValue(
        new AxiosError("Conflict", "409", undefined, undefined, {
          status: 409,
          statusText: "Conflict",
        } as AxiosResponse)
      );
    const tenant: TenantV2 = toTenantV2(getMockTenant());
    const message = toTenantEventEnvelopeV2({
      type: "TenantOnboarded",
      data: { tenant },
      event_version: 2,
    });
    await notificationTenantLifecycleConsumerService.handleMessage(
      message,
      correlationId,
      loggerInstance
    );
    expect(refreshableToken.get).toHaveBeenCalledOnce();
    expect(
      interopBeClients.notificationConfigProcess.client
        .createTenantDefaultNotificationConfig
    ).toHaveBeenCalledOnce();
    expect(
      interopBeClients.notificationConfigProcess.client
        .createTenantDefaultNotificationConfig
    ).toHaveBeenCalledWith(
      { tenantId: tenant.id },
      {
        headers: expectedHeaders,
      }
    );
  });

  it("Should not ignore other errors when calling the createTenantDefaultNotificationConfig route", async () => {
    interopBeClients.notificationConfigProcess.client.createTenantDefaultNotificationConfig =
      vi.fn().mockRejectedValue(
        new AxiosError("Internal Server Error", "500", undefined, undefined, {
          status: 500,
          statusText: "Internal Server Error",
        } as AxiosResponse)
      );
    const tenant: TenantV2 = toTenantV2(getMockTenant());
    const message = toTenantEventEnvelopeV2({
      type: "TenantOnboarded",
      data: { tenant },
      event_version: 2,
    });
    await expect(
      notificationTenantLifecycleConsumerService.handleMessage(
        message,
        correlationId,
        loggerInstance
      )
    ).rejects.toThrow();
    expect(refreshableToken.get).toHaveBeenCalledOnce();
    expect(
      interopBeClients.notificationConfigProcess.client
        .createTenantDefaultNotificationConfig
    ).toHaveBeenCalledOnce();
    expect(
      interopBeClients.notificationConfigProcess.client
        .createTenantDefaultNotificationConfig
    ).toHaveBeenCalledWith(
      { tenantId: tenant.id },
      {
        headers: expectedHeaders,
      }
    );
  });

  it("Should ignore 404 errors when calling the deleteTenantNotificationConfig route", async () => {
    interopBeClients.notificationConfigProcess.client.deleteTenantNotificationConfig =
      vi.fn().mockRejectedValue(
        new AxiosError("Not Found", "404", undefined, undefined, {
          status: 404,
          statusText: "Not Found",
        } as AxiosResponse)
      );
    const tenantId = generateId();
    const message = toTenantEventEnvelopeV2({
      type: "MaintenanceTenantDeleted",
      data: { tenantId },
      event_version: 2,
    });
    await notificationTenantLifecycleConsumerService.handleMessage(
      message,
      correlationId,
      loggerInstance
    );
    expect(refreshableToken.get).toHaveBeenCalledOnce();
    expect(
      interopBeClients.notificationConfigProcess.client
        .deleteTenantNotificationConfig
    ).toHaveBeenCalledOnce();
    expect(
      interopBeClients.notificationConfigProcess.client
        .deleteTenantNotificationConfig
    ).toHaveBeenCalledWith(undefined, {
      params: { tenantId },
      headers: expectedHeaders,
    });
  });

  it("Should not ignore other errors when calling the deleteTenantNotificationConfig route", async () => {
    interopBeClients.notificationConfigProcess.client.deleteTenantNotificationConfig =
      vi.fn().mockRejectedValue(
        new AxiosError("Internal Server Error", "500", undefined, undefined, {
          status: 500,
          statusText: "Internal Server Error",
        } as AxiosResponse)
      );
    const tenantId = generateId();
    const message = toTenantEventEnvelopeV2({
      type: "MaintenanceTenantDeleted",
      data: { tenantId },
      event_version: 2,
    });
    await expect(
      notificationTenantLifecycleConsumerService.handleMessage(
        message,
        correlationId,
        loggerInstance
      )
    ).rejects.toThrow();
    expect(refreshableToken.get).toHaveBeenCalledOnce();
    expect(
      interopBeClients.notificationConfigProcess.client
        .deleteTenantNotificationConfig
    ).toHaveBeenCalledOnce();
    expect(
      interopBeClients.notificationConfigProcess.client
        .deleteTenantNotificationConfig
    ).toHaveBeenCalledWith(undefined, {
      params: { tenantId },
      headers: expectedHeaders,
    });
  });

  it.each([
    "TenantOnboardDetailsUpdated",
    "TenantCertifiedAttributeAssigned",
    "TenantCertifiedAttributeRevoked",
    "TenantDeclaredAttributeAssigned",
    "TenantDeclaredAttributeRevoked",
    "TenantVerifiedAttributeAssigned",
    "TenantVerifiedAttributeRevoked",
    "TenantVerifiedAttributeExpirationUpdated",
    "TenantVerifiedAttributeExtensionUpdated",
    "TenantMailAdded",
    "MaintenanceTenantPromotedToCertifier",
    "MaintenanceTenantUpdated",
    "TenantMailDeleted",
    "TenantKindUpdated",
    "TenantDelegatedProducerFeatureAdded",
    "TenantDelegatedProducerFeatureRemoved",
    "TenantDelegatedConsumerFeatureAdded",
    "TenantDelegatedConsumerFeatureRemoved",
  ] as const)("Should ignore the event %s", async (eventType) => {
    const message = toTenantEventEnvelopeV2({
      type: eventType,
      data: {} as never,
      event_version: 2,
    });
    await notificationTenantLifecycleConsumerService.handleMessage(
      message,
      correlationId,
      loggerInstance
    );
    expect(refreshableToken.get).not.toHaveBeenCalled();
    expect(
      interopBeClients.notificationConfigProcess.client
        .createTenantDefaultNotificationConfig
    ).not.toHaveBeenCalled();
  });
});
