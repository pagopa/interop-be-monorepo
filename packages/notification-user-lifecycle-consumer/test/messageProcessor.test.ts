import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger } from "pagopa-interop-commons";
import {
  genericInternalError,
  TenantId,
  unsafeBrandId,
  generateId,
  CorrelationId,
  SelfcareId,
  UserId,
} from "pagopa-interop-models";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { RefreshableInteropToken } from "pagopa-interop-commons";
import { processUserEvent } from "../src/services/messageProcessor.js";
import { UsersEventPayload } from "../src/model/UsersEventPayload.js";
import { ReadModelServiceSQL } from "../src/services/readModelServiceSQL.js";

vi.mock("pagopa-interop-commons", async (importOriginal) => {
  const mod = await importOriginal<typeof import("pagopa-interop-commons")>();
  return { ...mod, delay: vi.fn() };
});

vi.mock("../src/config/config.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../src/config/config.js")>();
  return {
    ...mod,
    config: {
      ...mod.config,
      tenantLookupMaxRetries: 3,
      tenantLookupRetryDelayMs: 100,
    },
  };
});

// Mock the API clients module at the top level
vi.mock("pagopa-interop-api-clients", async () => {
  const actual = await vi.importActual("pagopa-interop-api-clients");
  return {
    ...actual,
    notificationConfigApi: {
      ...((actual as Record<string, unknown>).notificationConfigApi as Record<
        string,
        unknown
      >),
      ensureUserNotificationConfigExistsWithRoles: vi.fn(),
      removeUserNotificationConfigRole: vi.fn(),
    },
  };
});

describe("processUserEvent", () => {
  const mockReadModelServiceSQL: ReadModelServiceSQL = {
    getTenantIdBySelfcareId: vi.fn(),
  };

  // The client is now just a simple object passed to SDK functions
  const mockNotificationConfigProcessClient =
    {} as notificationConfigApi.NotificationConfigProcessClient;

  const mockInteropTokenGenerator: RefreshableInteropToken = {
    get: vi.fn(),
  } as unknown as RefreshableInteropToken;

  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as ReturnType<typeof logger>;

  const userId = unsafeBrandId<UserId>("123e4567-e89b-12d3-a456-426614174000");
  const institutionId = unsafeBrandId<SelfcareId>("inst-123");
  const tenantId = "tenant-123";
  const productRole = "admin";
  const apiProductRole = "ADMIN";
  const correlationId = generateId<CorrelationId>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(
      mockReadModelServiceSQL,
      "getTenantIdBySelfcareId"
    ).mockResolvedValue(unsafeBrandId<TenantId>(tenantId));

    vi.spyOn(mockInteropTokenGenerator, "get").mockResolvedValue({
      serialized: "mock-token",
      header: { alg: "HS256", use: "sig", typ: "JWT", kid: "mock-kid" },
      payload: {
        iss: "mock-iss",
        aud: ["mock-aud"],
        exp: 123456789,
        nbf: 123456789,
        iat: 123456789,
        jti: "mock-jti",
        sub: "mock-sub",
        role: "internal",
      },
    });

    // Mock SDK functions to return success by default
    vi.mocked(
      notificationConfigApi.ensureUserNotificationConfigExistsWithRoles
    ).mockResolvedValue({
      data: undefined,
      error: undefined,
      request: new Request("http://test"),
      response: new Response(),
    });

    vi.mocked(
      notificationConfigApi.removeUserNotificationConfigRole
    ).mockResolvedValue({
      data: undefined,
      error: undefined,
      request: new Request("http://test"),
      response: new Response(),
    });
  });

  const baseEvent = {
    id: "event-125",
    institutionId,
    productId: "prod-123",
    user: {
      userId,
      name: "John",
      familyName: "Doe",
      email: "john.doe@example.com",
      productRole: "admin" as const,
    },
  };

  it("should throw an error if tenant is not found after all retries", async () => {
    const addEvent: UsersEventPayload = {
      ...baseEvent,
      eventType: "add",
    };

    vi.spyOn(
      mockReadModelServiceSQL,
      "getTenantIdBySelfcareId"
    ).mockResolvedValue(undefined);

    await expect(
      processUserEvent(
        addEvent,
        mockReadModelServiceSQL,
        mockNotificationConfigProcessClient,
        mockInteropTokenGenerator,
        mockLogger,
        correlationId
      )
    ).rejects.toThrow(
      genericInternalError(`Tenant not found for selfcareId: ${institutionId}`)
    );

    expect(
      mockReadModelServiceSQL.getTenantIdBySelfcareId
    ).toHaveBeenCalledTimes(3);
  });

  it("should find tenant on retry after initial failures", async () => {
    const addEvent: UsersEventPayload = {
      ...baseEvent,
      eventType: "add",
    };

    vi.spyOn(mockReadModelServiceSQL, "getTenantIdBySelfcareId")
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(unsafeBrandId<TenantId>(tenantId));

    await processUserEvent(
      addEvent,
      mockReadModelServiceSQL,
      mockNotificationConfigProcessClient,
      mockInteropTokenGenerator,
      mockLogger,
      correlationId
    );

    expect(
      mockReadModelServiceSQL.getTenantIdBySelfcareId
    ).toHaveBeenCalledTimes(2);
    expect(
      notificationConfigApi.ensureUserNotificationConfigExistsWithRoles
    ).toHaveBeenCalled();
  });

  it.each(["add" as const, "update" as const])(
    "should call the ensureUserNotificationConfigExistsWithRoles process endpoint for '%s' events",
    async (eventType) => {
      const addEvent: UsersEventPayload = {
        ...baseEvent,
        eventType,
      };

      await processUserEvent(
        addEvent,
        mockReadModelServiceSQL,
        mockNotificationConfigProcessClient,
        mockInteropTokenGenerator,
        mockLogger,
        correlationId
      );

      expect(
        notificationConfigApi.ensureUserNotificationConfigExistsWithRoles
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            userId,
            tenantId: unsafeBrandId<TenantId>(tenantId),
            userRoles: [apiProductRole],
          },
          headers: {
            "X-Correlation-Id": correlationId,
            Authorization: `Bearer mock-token`,
          },
          client: mockNotificationConfigProcessClient,
        })
      );
    }
  );

  it.each(["add" as const, "update" as const])(
    "should throw an error if the client request for '%s' events responds with an error",
    async (eventType) => {
      const addEvent: UsersEventPayload = {
        ...baseEvent,
        eventType,
      };

      // Mock SDK function to return an error response
      vi.mocked(
        notificationConfigApi.ensureUserNotificationConfigExistsWithRoles
      ).mockResolvedValueOnce({
        data: undefined,
        error: {
          status: 500,
          title: "Internal Server Error",
          type: "about:blank",
        },
        request: new Request("http://test"),
        response: new Response(),
      });

      await expect(
        processUserEvent(
          addEvent,
          mockReadModelServiceSQL,
          mockNotificationConfigProcessClient,
          mockInteropTokenGenerator,
          mockLogger,
          correlationId
        )
      ).rejects.toThrow(
        genericInternalError(
          `Error in request to ensure a notification config exists for user ${userId} in tenant ${tenantId} with role ${productRole}. Reason: 500 - Internal Server Error`
        )
      );
    }
  );

  it("should call the removeUserNotificationConfigRole process endpoint for '%s' events", async () => {
    const addEvent: UsersEventPayload = {
      ...baseEvent,
      eventType: "delete",
    };

    await processUserEvent(
      addEvent,
      mockReadModelServiceSQL,
      mockNotificationConfigProcessClient,
      mockInteropTokenGenerator,
      mockLogger,
      correlationId
    );

    expect(
      notificationConfigApi.removeUserNotificationConfigRole
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        path: {
          userId,
          tenantId: unsafeBrandId<TenantId>(tenantId),
          userRole: apiProductRole,
        },
        headers: {
          "X-Correlation-Id": correlationId,
          Authorization: `Bearer mock-token`,
        },
        client: mockNotificationConfigProcessClient,
      })
    );
  });

  it("should throw an error if the client request for 'delete' events responds with a non-404 error", async () => {
    const deleteEvent: UsersEventPayload = {
      ...baseEvent,
      eventType: "delete",
    };

    // Mock SDK function to return a non-404 error response
    vi.mocked(
      notificationConfigApi.removeUserNotificationConfigRole
    ).mockResolvedValueOnce({
      data: undefined,
      error: {
        status: 500,
        title: "Internal Server Error",
        type: "about:blank",
      },
      request: new Request("http://test"),
      response: new Response(),
    });

    await expect(
      processUserEvent(
        deleteEvent,
        mockReadModelServiceSQL,
        mockNotificationConfigProcessClient,
        mockInteropTokenGenerator,
        mockLogger,
        correlationId
      )
    ).rejects.toThrow(
      genericInternalError(
        `Error removing role ${productRole} from notification config for user ${userId} in tenant ${tenantId}. Reason: 500 - Internal Server Error`
      )
    );
  });

  it("should not throw an error if the client request for 'delete' events responds with a 404 error", async () => {
    const deleteEvent: UsersEventPayload = {
      ...baseEvent,
      eventType: "delete",
    };

    // Mock SDK function to return a 404 error response
    vi.mocked(
      notificationConfigApi.removeUserNotificationConfigRole
    ).mockResolvedValueOnce({
      data: undefined,
      error: {
        status: 404,
        title: "Not Found",
        type: "about:blank",
      },
      request: new Request("http://test"),
      response: new Response(),
    });

    await processUserEvent(
      deleteEvent,
      mockReadModelServiceSQL,
      mockNotificationConfigProcessClient,
      mockInteropTokenGenerator,
      mockLogger,
      correlationId
    );

    // Should not throw, verify logger was called
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Notification config for user ${userId} and tenant ${tenantId} not found or role ${productRole} already missing, nothing to be done`
    );
  });
});
