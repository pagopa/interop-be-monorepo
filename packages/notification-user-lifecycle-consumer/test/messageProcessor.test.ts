import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger } from "pagopa-interop-commons";
import {
  genericInternalError,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
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

  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as ReturnType<typeof logger>;

  const userId = "123e4567-e89b-12d3-a456-426614174000";
  const institutionId = "inst-123";
  const tenantId = "tenant-123";
  beforeEach(() => {
    vi.spyOn(
      mockReadModelServiceSQL,
      "getTenantIdBySelfcareId"
    ).mockResolvedValueOnce(unsafeBrandId<TenantId>(tenantId));
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
      mockLogger
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
      mockLogger
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
      mockLogger
    );

    expect(mockUserServiceSQL.deleteUser).toHaveBeenCalledWith(
      unsafeBrandId(userId)
    );
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
        mockLogger
      )
    ).rejects.toThrow(
      genericInternalError(`Tenant not found for selfcareId: ${institutionId}`)
    );
  });
});
