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
import { AxiosError } from "axios";
import { processUserEvent } from "../src/services/messageProcessor.js";
import { UsersEventPayload } from "../src/model/UsersEventPayload.js";
import { ReadModelServiceSQL } from "../src/services/readModelServiceSQL.js";

describe("processUserEvent", () => {
  const mockReadModelServiceSQL: ReadModelServiceSQL = {
    getTenantIdBySelfcareId: vi.fn(),
  };

  const mockNotificationConfigProcessClient = {
    ensureUserNotificationConfigExistsWithRoles: vi.fn(),
    removeUserNotificationConfigRole: vi.fn(),
  } as unknown as ReturnType<
    typeof notificationConfigApi.createProcessApiClient
  >;

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

    vi.spyOn(
      mockNotificationConfigProcessClient,
      "ensureUserNotificationConfigExistsWithRoles"
    ).mockResolvedValue(undefined);

    vi.spyOn(
      mockNotificationConfigProcessClient,
      "removeUserNotificationConfigRole"
    ).mockResolvedValue(undefined);
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

  it("should throw an error if tenant is not found", async () => {
    const addEvent: UsersEventPayload = {
      ...baseEvent,
      eventType: "add",
    };

    vi.spyOn(
      mockReadModelServiceSQL,
      "getTenantIdBySelfcareId"
    ).mockResolvedValueOnce(undefined);

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
        mockNotificationConfigProcessClient.ensureUserNotificationConfigExistsWithRoles
      ).toHaveBeenCalledWith(
        {
          userId,
          tenantId: unsafeBrandId<TenantId>(tenantId),
          userRoles: [apiProductRole],
        },
        {
          headers: {
            "X-Correlation-Id": correlationId,
            Authorization: `Bearer mock-token`,
          },
        }
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

      const apiError = new Error("API Error");
      vi.spyOn(
        mockNotificationConfigProcessClient,
        "ensureUserNotificationConfigExistsWithRoles"
      ).mockRejectedValueOnce(apiError);

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
          `Error in request to ensure a notification config exists for user ${userId} in tenant ${tenantId} with role ${productRole}. Reason: ${apiError}`
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
      mockNotificationConfigProcessClient.removeUserNotificationConfigRole
    ).toHaveBeenCalledWith(undefined, {
      params: {
        userId,
        tenantId: unsafeBrandId<TenantId>(tenantId),
        userRole: apiProductRole,
      },
      headers: {
        "X-Correlation-Id": correlationId,
        Authorization: `Bearer mock-token`,
      },
    });
  });

  it("should throw an error if the client request for 'delete' events responds with a non-404 error", async () => {
    const deleteEvent: UsersEventPayload = {
      ...baseEvent,
      eventType: "delete",
    };

    const apiError = new Error("API Error");
    vi.spyOn(
      mockNotificationConfigProcessClient,
      "removeUserNotificationConfigRole"
    ).mockRejectedValueOnce(apiError);

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
        `Error removing role ${productRole} from notification config for user ${userId} in tenant ${tenantId}. Reason: ${apiError}`
      )
    );
  });

  it("should not throw an error if the client request for 'delete' events responds with a 404 error", async () => {
    const deleteEvent: UsersEventPayload = {
      ...baseEvent,
      eventType: "delete",
    };

    vi.spyOn(
      mockNotificationConfigProcessClient,
      "removeUserNotificationConfigRole"
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
    ).mockRejectedValueOnce(new AxiosError("", "", {}, {}, { status: 404 }));

    await processUserEvent(
      deleteEvent,
      mockReadModelServiceSQL,
      mockNotificationConfigProcessClient,
      mockInteropTokenGenerator,
      mockLogger,
      correlationId
    );
  });
});
