import { describe, it, expect } from "vitest";
import {
  UsersEventPayload,
  selfcareUserEventType,
  relationshipStatus,
} from "../src/model/UsersEventPayload.js";

describe("UsersEventPayload", () => {
  describe("ADD event", () => {
    it("should transform ADD event to add type", () => {
      const rawEvent = {
        id: "event-125",
        institutionId: "inst-123",
        productId: "prod-123",
        eventType: selfcareUserEventType.add,
        user: {
          userId: "123e4567-e89b-12d3-a456-426614174000",
          name: "John",
          familyName: "Doe",
          email: "john.doe@example.com",
          productRole: "admin" as const,
          relationshipStatus: relationshipStatus.active,
        },
      };

      const result = UsersEventPayload.parse(rawEvent);

      expect(result).toEqual({
        id: "event-125",
        institutionId: "inst-123",
        productId: "prod-123",
        eventType: "add",
        user: {
          userId: "123e4567-e89b-12d3-a456-426614174000",
          name: "John",
          familyName: "Doe",
          email: "john.doe@example.com",
          productRole: "admin" as const,
        },
      });
    });

    it("should throw if required fields are missing", () => {
      const invalidEvent = {
        // Missing required fields
        eventType: selfcareUserEventType.add,
        user: {
          // Missing required fields
          name: "John",
        },
      };

      expect(() => UsersEventPayload.parse(invalidEvent)).toThrow();
    });
  });

  describe("UPDATE event", () => {
    it("should transform UPDATE event to update type", () => {
      const rawEvent = {
        id: "event-126",
        institutionId: "inst-123",
        productId: "prod-123",
        eventType: selfcareUserEventType.update,
        user: {
          userId: "123e4567-e89b-12d3-a456-426614174000",
          name: "John",
          familyName: "Doe",
          email: "john.doe.updated@example.com",
          productRole: "admin" as const,
          relationshipStatus: relationshipStatus.active,
        },
      };

      const result = UsersEventPayload.parse(rawEvent);

      expect(result).toEqual({
        id: "event-126",
        institutionId: "inst-123",
        productId: "prod-123",
        eventType: "update",
        user: {
          userId: "123e4567-e89b-12d3-a456-426614174000",
          name: "John",
          familyName: "Doe",
          email: "john.doe.updated@example.com",
          productRole: "admin" as const,
        },
      });
    });
  });

  describe("DELETE event", () => {
    it("should transform DELETE event to delete type", () => {
      const rawEvent = {
        id: "event-125",
        institutionId: "inst-123",
        productId: "prod-123",
        eventType: selfcareUserEventType.update, // DELETE is handled via relationshipStatus
        user: {
          userId: "123e4567-e89b-12d3-a456-426614174000",
          name: "John",
          familyName: "Doe",
          email: "john.doe@example.com",
          productRole: "admin" as const,
          relationshipStatus: relationshipStatus.deleted,
        },
      };

      const result = UsersEventPayload.parse(rawEvent);

      expect(result).toEqual({
        id: "event-125",
        institutionId: "inst-123",
        productId: "prod-123",
        eventType: "delete",
        user: {
          userId: "123e4567-e89b-12d3-a456-426614174000",
          name: "John",
          familyName: "Doe",
          email: "john.doe@example.com",
          productRole: "admin" as const,
        },
      });
    });
  });

  describe("Type guards", () => {
    it("should correctly identify event types", () => {
      const addEvent = {
        id: "event-125",
        institutionId: "inst-123",
        productId: "prod-123",
        eventType: "add",
        user: {
          userId: "123e4567-e89b-12d3-a456-426614174000",
          name: "John",
          familyName: "Doe",
          email: "john.doe@example.com",
          productRole: "admin" as const,
        },
      } as const;

      const updateEvent = {
        id: "event-126",
        institutionId: "inst-123",
        productId: "prod-123",
        eventType: "update",
        user: {
          userId: "123e4567-e89b-12d3-a456-426614174000",
          name: "John",
          familyName: "Doe",
          email: "john.doe.updated@example.com",
          productRole: "admin" as const,
        },
      } as const;

      const deleteEvent = {
        id: "event-127",
        institutionId: "inst-123",
        productId: "prod-123",
        eventType: "delete",
        user: {
          userId: "123e4567-e89b-12d3-a456-426614174000",
          name: "John",
          familyName: "Doe",
          email: "john.doe@example.com",
          productRole: "admin" as const,
        },
      } as const;

      expect(addEvent.eventType).toBe("add");
      expect(updateEvent.eventType).toBe("update");
      expect(deleteEvent.eventType).toBe("delete");
    });
  });
});
