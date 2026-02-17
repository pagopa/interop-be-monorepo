/* eslint-disable functional/immutable-data */
vi.mock("pagopa-interop-api-clients", () => ({
  notificationConfigApi: {
    createTenantDefaultNotificationConfig: vi.fn(),
    deleteTenantNotificationConfig: vi.fn(),
  },
}));

import { logger } from "pagopa-interop-commons";
import {
  getMockTenant,
  getMockTenantNotificationConfig,
  toTenantV1,
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
  TenantEventEnvelopeV1,
  TenantEventV1,
  TenantV1,
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
      ...getMockTenantNotificationConfig(),
      createdAt: new Date().toJSON(),
      updatedAt: undefined,
    };

  const loggerInstance = logger({
    serviceName: "notification-tenant-lifecycle-consumer",
    correlationId,
  });

  const toTenantEventEnvelopeV1 = (
    event: TenantEventV1
  ): TenantEventEnvelopeV1 => ({
    ...event,
    sequence_num: 1,
    stream_id: "stream-id",
    version: 1,
    correlation_id: correlationId,
    log_date: new Date(),
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
    vi.mocked(
      notificationConfigApi.createTenantDefaultNotificationConfig
    ).mockResolvedValue({
      data: mockTenantNotificationConfig,
      error: undefined,
      request: new Request("http://test"),
      response: new Response(),
    });
    vi.mocked(
      notificationConfigApi.deleteTenantNotificationConfig
    ).mockResolvedValue({
      data: undefined,
      error: undefined,
      request: new Request("http://test"),
      response: new Response(),
    });
    vi.clearAllMocks();
  });

  describe("handleMessageV1", () => {
    it("Should call the createTenantDefaultNotificationConfig route on a TenantCreated event", async () => {
      const tenant: TenantV1 = toTenantV1(getMockTenant());
      const message = toTenantEventEnvelopeV1({
        type: "TenantCreated",
        data: { tenant },
        event_version: 1,
      });
      await notificationTenantLifecycleConsumerService.handleMessageV1(
        message,
        correlationId,
        loggerInstance
      );
      expect(refreshableToken.get).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { tenantId: tenant.id },
          headers: expectedHeaders,
          client: interopBeClients.notificationConfigProcess.client,
        })
      );
    });

    it("Should call the deleteTenantNotificationConfig route on a TenantDeleted event", async () => {
      const tenantId = generateId();
      const message = toTenantEventEnvelopeV1({
        type: "TenantDeleted",
        data: { tenantId },
        event_version: 1,
      });
      await notificationTenantLifecycleConsumerService.handleMessageV1(
        message,
        correlationId,
        loggerInstance
      );
      expect(refreshableToken.get).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.deleteTenantNotificationConfig
      ).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.deleteTenantNotificationConfig
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { tenantId },
          headers: expectedHeaders,
          client: interopBeClients.notificationConfigProcess.client,
        })
      );
    });

    it("Should throw missingKafkaMessageDataError when the tenant is missing in a TenantCreated event", async () => {
      const message = toTenantEventEnvelopeV1({
        type: "TenantCreated",
        data: {},
        event_version: 1,
      });
      await expect(
        notificationTenantLifecycleConsumerService.handleMessageV1(
          message,
          correlationId,
          loggerInstance
        )
      ).rejects.toThrow(
        missingKafkaMessageDataError("tenant", "TenantOnboarded")
      );
      expect(refreshableToken.get).not.toHaveBeenCalled();
      expect(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).not.toHaveBeenCalled();
    });

    it("Should ignore 409 errors when calling the createTenantDefaultNotificationConfig route", async () => {
      vi.mocked(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).mockResolvedValue({
        data: undefined,
        error: {
          status: 409,
          title: "Conflict",
          type: "about:blank",
        },
        request: new Request("http://test"),
        response: new Response(),
      });
      const tenant: TenantV1 = toTenantV1(getMockTenant());
      const message = toTenantEventEnvelopeV1({
        type: "TenantCreated",
        data: { tenant },
        event_version: 1,
      });
      await notificationTenantLifecycleConsumerService.handleMessageV1(
        message,
        correlationId,
        loggerInstance
      );
      expect(refreshableToken.get).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { tenantId: tenant.id },
          headers: expectedHeaders,
          client: interopBeClients.notificationConfigProcess.client,
        })
      );
    });

    it("Should not ignore other errors when calling the createTenantDefaultNotificationConfig route", async () => {
      vi.mocked(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).mockResolvedValue({
        data: undefined,
        error: {
          status: 500,
          title: "Internal Server Error",
          type: "about:blank",
        },
        request: new Request("http://test"),
        response: new Response(),
      });
      const tenant: TenantV1 = toTenantV1(getMockTenant());
      const message = toTenantEventEnvelopeV1({
        type: "TenantCreated",
        data: { tenant },
        event_version: 1,
      });
      await expect(
        notificationTenantLifecycleConsumerService.handleMessageV1(
          message,
          correlationId,
          loggerInstance
        )
      ).rejects.toThrow();
      expect(refreshableToken.get).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { tenantId: tenant.id },
          headers: expectedHeaders,
          client: interopBeClients.notificationConfigProcess.client,
        })
      );
    });

    it("Should not ignore 404 errors when calling the deleteTenantNotificationConfig route", async () => {
      vi.mocked(
        notificationConfigApi.deleteTenantNotificationConfig
      ).mockResolvedValue({
        data: undefined,
        error: {
          status: 404,
          title: "Not Found",
          type: "about:blank",
        },
        request: new Request("http://test"),
        response: new Response(),
      });
      const tenantId = generateId();
      const message = toTenantEventEnvelopeV1({
        type: "TenantDeleted",
        data: { tenantId },
        event_version: 1,
      });
      await expect(
        notificationTenantLifecycleConsumerService.handleMessageV1(
          message,
          correlationId,
          loggerInstance
        )
      ).rejects.toThrow();
      expect(refreshableToken.get).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.deleteTenantNotificationConfig
      ).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.deleteTenantNotificationConfig
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { tenantId },
          headers: expectedHeaders,
          client: interopBeClients.notificationConfigProcess.client,
        })
      );
    });

    it("Should not ignore other errors when calling the deleteTenantNotificationConfig route", async () => {
      vi.mocked(
        notificationConfigApi.deleteTenantNotificationConfig
      ).mockResolvedValue({
        data: undefined,
        error: {
          status: 500,
          title: "Internal Server Error",
          type: "about:blank",
        },
        request: new Request("http://test"),
        response: new Response(),
      });
      const tenantId = generateId();
      const message = toTenantEventEnvelopeV1({
        type: "TenantDeleted",
        data: { tenantId },
        event_version: 1,
      });
      await expect(
        notificationTenantLifecycleConsumerService.handleMessageV1(
          message,
          correlationId,
          loggerInstance
        )
      ).rejects.toThrow();
      expect(refreshableToken.get).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.deleteTenantNotificationConfig
      ).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.deleteTenantNotificationConfig
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { tenantId },
          headers: expectedHeaders,
          client: interopBeClients.notificationConfigProcess.client,
        })
      );
    });

    it.each([
      "TenantUpdated",
      "SelfcareMappingCreated",
      "SelfcareMappingDeleted",
      "TenantMailAdded",
      "TenantMailDeleted",
    ] as const)("Should ignore the event %s", async (eventType) => {
      const message = toTenantEventEnvelopeV1({
        type: eventType,
        data: {} as never,
        event_version: 1,
      });
      await notificationTenantLifecycleConsumerService.handleMessageV1(
        message,
        correlationId,
        loggerInstance
      );
      expect(refreshableToken.get).not.toHaveBeenCalled();
      expect(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).not.toHaveBeenCalled();
    });
  });

  describe("handleMessageV2", () => {
    it("Should call the createTenantDefaultNotificationConfig route on a TenantOnboarded event", async () => {
      const tenant: TenantV2 = toTenantV2(getMockTenant());
      const message = toTenantEventEnvelopeV2({
        type: "TenantOnboarded",
        data: { tenant },
        event_version: 2,
      });
      await notificationTenantLifecycleConsumerService.handleMessageV2(
        message,
        correlationId,
        loggerInstance
      );
      expect(refreshableToken.get).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { tenantId: tenant.id },
          headers: expectedHeaders,
          client: interopBeClients.notificationConfigProcess.client,
        })
      );
    });

    it("Should call the deleteTenantNotificationConfig route on a MaintenanceTenantDeleted event", async () => {
      const tenantId = generateId();
      const message = toTenantEventEnvelopeV2({
        type: "MaintenanceTenantDeleted",
        data: { tenantId },
        event_version: 2,
      });
      await notificationTenantLifecycleConsumerService.handleMessageV2(
        message,
        correlationId,
        loggerInstance
      );
      expect(refreshableToken.get).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.deleteTenantNotificationConfig
      ).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.deleteTenantNotificationConfig
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { tenantId },
          headers: expectedHeaders,
          client: interopBeClients.notificationConfigProcess.client,
        })
      );
    });

    it("Should throw missingKafkaMessageDataError when the tenant is missing in a TenantOnboarded event", async () => {
      const message = toTenantEventEnvelopeV2({
        type: "TenantOnboarded",
        data: {},
        event_version: 2,
      });
      await expect(
        notificationTenantLifecycleConsumerService.handleMessageV2(
          message,
          correlationId,
          loggerInstance
        )
      ).rejects.toThrow(
        missingKafkaMessageDataError("tenant", "TenantOnboarded")
      );
      expect(refreshableToken.get).not.toHaveBeenCalled();
      expect(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).not.toHaveBeenCalled();
    });

    it("Should ignore 409 errors when calling the createTenantDefaultNotificationConfig route", async () => {
      vi.mocked(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).mockResolvedValue({
        data: undefined,
        error: {
          status: 409,
          title: "Conflict",
          type: "about:blank",
        },
        request: new Request("http://test"),
        response: new Response(),
      });
      const tenant: TenantV2 = toTenantV2(getMockTenant());
      const message = toTenantEventEnvelopeV2({
        type: "TenantOnboarded",
        data: { tenant },
        event_version: 2,
      });
      await notificationTenantLifecycleConsumerService.handleMessageV2(
        message,
        correlationId,
        loggerInstance
      );
      expect(refreshableToken.get).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { tenantId: tenant.id },
          headers: expectedHeaders,
          client: interopBeClients.notificationConfigProcess.client,
        })
      );
    });

    it("Should not ignore other errors when calling the createTenantDefaultNotificationConfig route", async () => {
      vi.mocked(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).mockResolvedValue({
        data: undefined,
        error: {
          status: 500,
          title: "Internal Server Error",
          type: "about:blank",
        },
        request: new Request("http://test"),
        response: new Response(),
      });
      const tenant: TenantV2 = toTenantV2(getMockTenant());
      const message = toTenantEventEnvelopeV2({
        type: "TenantOnboarded",
        data: { tenant },
        event_version: 2,
      });
      await expect(
        notificationTenantLifecycleConsumerService.handleMessageV2(
          message,
          correlationId,
          loggerInstance
        )
      ).rejects.toThrow();
      expect(refreshableToken.get).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { tenantId: tenant.id },
          headers: expectedHeaders,
          client: interopBeClients.notificationConfigProcess.client,
        })
      );
    });

    it("Should not ignore 404 errors when calling the deleteTenantNotificationConfig route", async () => {
      vi.mocked(
        notificationConfigApi.deleteTenantNotificationConfig
      ).mockResolvedValue({
        data: undefined,
        error: {
          status: 404,
          title: "Not Found",
          type: "about:blank",
        },
        request: new Request("http://test"),
        response: new Response(),
      });
      const tenantId = generateId();
      const message = toTenantEventEnvelopeV2({
        type: "MaintenanceTenantDeleted",
        data: { tenantId },
        event_version: 2,
      });
      await expect(
        notificationTenantLifecycleConsumerService.handleMessageV2(
          message,
          correlationId,
          loggerInstance
        )
      ).rejects.toThrow();
      expect(refreshableToken.get).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.deleteTenantNotificationConfig
      ).toHaveBeenCalledOnce();
      expect(
        notificationConfigApi.deleteTenantNotificationConfig
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { tenantId },
          headers: expectedHeaders,
          client: interopBeClients.notificationConfigProcess.client,
        })
      );
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
      await notificationTenantLifecycleConsumerService.handleMessageV2(
        message,
        correlationId,
        loggerInstance
      );
      expect(refreshableToken.get).not.toHaveBeenCalled();
      expect(
        notificationConfigApi.createTenantDefaultNotificationConfig
      ).not.toHaveBeenCalled();
    });
  });
});
