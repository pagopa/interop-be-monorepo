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
import { UserServiceSQL } from "../src/services/userServiceSQL.js";

describe("processUserEvent", () => {
  const mockReadModelServiceSQL: ReadModelServiceSQL = {
    getTenantIdBySelfcareId: vi.fn(),
  };

  const mockUserServiceSQL: UserServiceSQL = {
    insertUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
  };

  const mockNotificationConfigProcessClient = {
    createUserDefaultNotificationConfig: vi.fn(),
    deleteUserNotificationConfig: vi.fn(),
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
      "createUserDefaultNotificationConfig"
    ).mockResolvedValue({
      id: "123",
      createdAt: "2022-01-01T00:00:00.000Z",
      tenantId,
      userId,
      inAppConfig: {
        newEServiceVersionPublished: true,
      },
      emailConfig: {
        newEServiceVersionPublished: true,
      },
    });

    vi.spyOn(
      mockNotificationConfigProcessClient,
      "deleteUserNotificationConfig"
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

  it("should call insertUser for 'add' event", async () => {
    const addEvent: UsersEventPayload = {
      ...baseEvent,
      eventType: "add",
    };

    await processUserEvent(
      addEvent,
      mockReadModelServiceSQL,
      mockUserServiceSQL,
      mockNotificationConfigProcessClient,
      mockInteropTokenGenerator,
      mockLogger,
      correlationId
    );

    expect(mockUserServiceSQL.insertUser).toHaveBeenCalledWith({
      userId: unsafeBrandId(userId),
      tenantId: unsafeBrandId(tenantId),
      institutionId: unsafeBrandId(institutionId),
      name: "John",
      familyName: "Doe",
      email: "john.doe@example.com",
      productRole: "admin",
    });

    expect(
      mockNotificationConfigProcessClient.createUserDefaultNotificationConfig
    ).toHaveBeenCalledWith(
      {
        userId: unsafeBrandId(userId),
        tenantId: unsafeBrandId(tenantId),
      },
      {
        headers: {
          "X-Correlation-Id": correlationId,
          Authorization: "Bearer mock-token",
        },
      }
    );
  });

  it("should call updateUser for 'update' event", async () => {
    const updateEvent: UsersEventPayload = {
      ...baseEvent,
      eventType: "update",
    };

    await processUserEvent(
      updateEvent,
      mockReadModelServiceSQL,
      mockUserServiceSQL,
      mockNotificationConfigProcessClient,
      mockInteropTokenGenerator,
      mockLogger,
      correlationId
    );

    expect(mockUserServiceSQL.updateUser).toHaveBeenCalledWith({
      userId: unsafeBrandId(userId),
      tenantId: unsafeBrandId(tenantId),
      institutionId: unsafeBrandId(institutionId),
      name: "John",
      familyName: "Doe",
      email: "john.doe@example.com",
      productRole: "admin",
    });
  });

  it("should call deleteUser for 'delete' event", async () => {
    const deleteEvent: UsersEventPayload = {
      ...baseEvent,
      eventType: "delete",
    };

    await processUserEvent(
      deleteEvent,
      mockReadModelServiceSQL,
      mockUserServiceSQL,
      mockNotificationConfigProcessClient,
      mockInteropTokenGenerator,
      mockLogger,
      correlationId
    );

    expect(mockUserServiceSQL.deleteUser).toHaveBeenCalledWith(
      unsafeBrandId(userId)
    );

    expect(
      mockNotificationConfigProcessClient.deleteUserNotificationConfig
    ).toHaveBeenCalledWith(undefined, {
      params: {
        userId: unsafeBrandId(userId),
        tenantId: unsafeBrandId(tenantId),
      },
      headers: {
        "X-Correlation-Id": correlationId,
        Authorization: "Bearer mock-token",
      },
    });
  });

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
        mockUserServiceSQL,
        mockNotificationConfigProcessClient,
        mockInteropTokenGenerator,
        mockLogger,
        correlationId
      )
    ).rejects.toThrow(
      genericInternalError(`Tenant not found for selfcareId: ${institutionId}`)
    );
  });

  it("should handle notification config creation error for 'add' event", async () => {
    const addEvent: UsersEventPayload = {
      ...baseEvent,
      eventType: "add",
    };

    vi.spyOn(
      mockNotificationConfigProcessClient,
      "createUserDefaultNotificationConfig"
    ).mockRejectedValueOnce(new Error("API Error"));

    await processUserEvent(
      addEvent,
      mockReadModelServiceSQL,
      mockUserServiceSQL,
      mockNotificationConfigProcessClient,
      mockInteropTokenGenerator,
      mockLogger,
      correlationId
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      `Error creating user default notification config for user ${unsafeBrandId(
        userId
      )} from tenant ${unsafeBrandId(tenantId)}. Reason: Error: API Error`
    );
    expect(mockUserServiceSQL.insertUser).toHaveBeenCalled();
  });

  it("should handle notification config deletion error for 'delete' event", async () => {
    const deleteEvent: UsersEventPayload = {
      ...baseEvent,
      eventType: "delete",
    };

    vi.spyOn(
      mockNotificationConfigProcessClient,
      "deleteUserNotificationConfig"
    ).mockRejectedValueOnce(new Error("API Error"));

    await processUserEvent(
      deleteEvent,
      mockReadModelServiceSQL,
      mockUserServiceSQL,
      mockNotificationConfigProcessClient,
      mockInteropTokenGenerator,
      mockLogger,
      correlationId
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      `Error deleting user default notification config for user ${unsafeBrandId(
        userId
      )} from tenant ${unsafeBrandId(tenantId)}. Reason: Error: API Error`
    );
    expect(mockUserServiceSQL.deleteUser).toHaveBeenCalled();
  });
});
