import { authRole } from "pagopa-interop-commons";
import {
  createPayload,
  createUserPayload,
  getMockTenant,
  signPayload,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import { upsertTenant } from "pagopa-interop-readmodel/testUtils";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import "../mockHttpMiddleware.js";
import { createApp } from "../../src/app.js";
import {
  authorizationService,
  postgresDB,
  readModelDB,
  selfcareV2Client,
} from "../integrationUtils.js";

const api = await createApp(authorizationService);

// Both UI and M2M creation reach the same authorization-process route.
const uiPayload = createUserPayload(authRole.ADMIN_ROLE);
const m2mPayload = createPayload(authRole.M2M_ADMIN_ROLE);
const m2mSelfcareId = generateId();
const callers = [
  {
    role: "UI admin",
    payload: uiPayload,
    selfcareId: uiPayload.selfcareId,
  },
  { role: "M2M admin", payload: m2mPayload, selfcareId: m2mSelfcareId },
];

describe("producer keychain creation member validation", () => {
  it.each(callers)(
    "POST /producerKeychains rejects an unknown member for $role without persisting an event",
    async ({ payload, selfcareId }) => {
      if (payload === m2mPayload) {
        await upsertTenant(
          readModelDB,
          {
            ...getMockTenant(),
            id: payload.organizationId,
            selfcareId,
          },
          0
        );
      }
      const missingUserId = generateId();
      selfcareV2Client.getInstitutionUsersByProductUsingGET = vi
        .fn()
        .mockResolvedValue([]);

      const response = await request(api)
        .post("/producerKeychains")
        .set("Authorization", `Bearer ${signPayload(payload)}`)
        .set("X-Correlation-Id", generateId())
        .send({
          name: "Keychain with an unknown member",
          description: "Member validation regression",
          members: [missingUserId],
        });

      expect.soft(response.status).toBe(404);
      expect
        .soft(selfcareV2Client.getInstitutionUsersByProductUsingGET)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            params: { institutionId: selfcareId },
            queries: { userId: missingUserId },
          })
        );
      expect(
        await postgresDB.any('SELECT stream_id FROM "authorization".events')
      ).toEqual([]);
    }
  );

  it("accepts members belonging to the producer's institution", async () => {
    const members = [generateId(), generateId()];
    selfcareV2Client.getInstitutionUsersByProductUsingGET = vi.fn(
      async (config) =>
        config?.params.institutionId === uiPayload.selfcareId
          ? members
              .filter((id) => id === config.queries?.userId)
              .map((id) => ({ id, name: "Test", surname: "User" }))
          : []
    );
    const response = await request(api)
      .post("/producerKeychains")
      .set("Authorization", `Bearer ${signPayload(uiPayload)}`)
      .set("X-Correlation-Id", generateId())
      .send({ name: "Valid keychain", description: "Valid users", members });
    expect(response.status).toBe(200);
    expect(response.body.users).toEqual(members);
    expect(
      await postgresDB.any('SELECT stream_id FROM "authorization".events')
    ).toHaveLength(1);
  });

  it("rejects a member belonging only to another institution", async () => {
    const userId = generateId();
    const foreignInstitutionId = generateId();
    selfcareV2Client.getInstitutionUsersByProductUsingGET = vi.fn(
      async (config) =>
        config?.params.institutionId === foreignInstitutionId
          ? [{ id: userId, name: "Foreign", surname: "User" }]
          : []
    );
    const response = await request(api)
      .post("/producerKeychains")
      .set("Authorization", `Bearer ${signPayload(uiPayload)}`)
      .set("X-Correlation-Id", generateId())
      .send({
        name: "Foreign user",
        description: "Wrong institution",
        members: [userId],
      });
    expect(response.status).toBe(404);
    expect(
      await postgresDB.any('SELECT stream_id FROM "authorization".events')
    ).toEqual([]);
  });

  it("does not persist a keychain with a valid and an unknown member", async () => {
    const validId = generateId();
    const missingId = generateId();
    selfcareV2Client.getInstitutionUsersByProductUsingGET = vi.fn(
      async (config) =>
        config?.queries?.userId === validId
          ? [{ id: validId, name: "Test", surname: "User" }]
          : []
    );
    const response = await request(api)
      .post("/producerKeychains")
      .set("Authorization", `Bearer ${signPayload(uiPayload)}`)
      .set("X-Correlation-Id", generateId())
      .send({
        name: "Mixed users",
        description: "Missing user",
        members: [validId, missingId],
      });
    expect(response.status).toBe(404);
    expect(response.body.errors).toEqual([
      expect.objectContaining({ detail: expect.stringContaining(missingId) }),
    ]);
    expect(
      await postgresDB.any('SELECT stream_id FROM "authorization".events')
    ).toEqual([]);
  });

  it("accepts empty members without calling Selfcare", async () => {
    selfcareV2Client.getInstitutionUsersByProductUsingGET = vi.fn();
    const response = await request(api)
      .post("/producerKeychains")
      .set("Authorization", `Bearer ${signPayload(uiPayload)}`)
      .set("X-Correlation-Id", generateId())
      .send({
        name: "Empty keychain",
        description: "No members yet",
        members: [],
      });
    expect(response.status).toBe(200);
    expect(
      selfcareV2Client.getInstitutionUsersByProductUsingGET
    ).not.toHaveBeenCalled();
  });

  it("does not convert a Selfcare failure into user absence", async () => {
    selfcareV2Client.getInstitutionUsersByProductUsingGET = vi
      .fn()
      .mockRejectedValue(new Error("Selfcare unavailable"));
    const response = await request(api)
      .post("/producerKeychains")
      .set("Authorization", `Bearer ${signPayload(uiPayload)}`)
      .set("X-Correlation-Id", generateId())
      .send({
        name: "Unavailable Selfcare",
        description: "Service failure",
        members: [generateId()],
      });
    expect(response.status).toBe(500);
    expect(
      await postgresDB.any('SELECT stream_id FROM "authorization".events')
    ).toEqual([]);
  });
});
