import { authorizationApi } from "pagopa-interop-api-clients";
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

const endpoints = ["/clientsApi", "/clientsConsumer"];

const sendRequest = (endpoint: string, members: string[], payload: object) =>
  request(api)
    .post(endpoint)
    .set("Authorization", `Bearer ${signPayload(payload)}`)
    .set("X-Correlation-Id", generateId())
    .send({ name: "Member validation", members });

const expectNoEvents = async (): Promise<void> => {
  expect(
    await postgresDB.any('SELECT stream_id FROM "authorization".events')
  ).toEqual([]);
};

describe("client creation member validation", () => {
  it.each(["/clientsApi", "/clientsConsumer"])(
    "POST %s should return 404 without creating a client when a member does not exist in the tenant",
    async (endpoint) => {
      const payload = createUserPayload(authRole.ADMIN_ROLE);
      await upsertTenant(
        readModelDB,
        {
          ...getMockTenant(),
          id: payload.organizationId,
          selfcareId: payload.selfcareId,
        },
        0
      );

      // A valid UUID, but Selfcare has no matching user for this institution.
      const missingUserId = generateId();
      selfcareV2Client.getInstitutionUsersByProductUsingGET = vi
        .fn()
        .mockResolvedValue([]);

      const seed: authorizationApi.ClientSeed = {
        name: "Client with a nonexistent member",
        description: "Regression test for client member validation",
        members: [missingUserId],
      };

      const response = await request(api)
        .post(endpoint)
        .set("Authorization", `Bearer ${signPayload(payload)}`)
        .set("X-Correlation-Id", generateId())
        .send(seed);

      expect.soft(response.status).toBe(404);
      expect
        .soft(selfcareV2Client.getInstitutionUsersByProductUsingGET)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            params: { institutionId: payload.selfcareId },
            queries: expect.objectContaining({ userId: missingUserId }),
          })
        );
      const events = await postgresDB.any(
        'SELECT stream_id FROM "authorization".events'
      );
      expect(events).toEqual([]);
    }
  );

  it.each(endpoints)(
    "POST %s should accept all valid members",
    async (endpoint) => {
      const payload = createUserPayload(authRole.ADMIN_ROLE);
      const members = [generateId(), generateId()];
      selfcareV2Client.getInstitutionUsersByProductUsingGET = vi.fn(
        async (config) =>
          config?.params.institutionId === payload.selfcareId
            ? members
                .filter((id) => id === config.queries?.userId)
                .map((id) => ({ id, name: "Test", surname: "User" }))
            : []
      );
      const response = await sendRequest(endpoint, members, payload);
      expect(response.status).toBe(200);
      expect(response.body.users).toEqual(members);
      expect(
        await postgresDB.any('SELECT stream_id FROM "authorization".events')
      ).toHaveLength(1);
    }
  );

  it.each(endpoints)(
    "POST %s should reject a member belonging only to another institution",
    async (endpoint) => {
      const payload = createUserPayload(authRole.ADMIN_ROLE);
      const otherInstitutionId = generateId();
      const member = generateId();
      selfcareV2Client.getInstitutionUsersByProductUsingGET = vi.fn(
        async (config) =>
          config?.params.institutionId === otherInstitutionId
            ? [{ id: member, name: "Test", surname: "User" }]
            : []
      );
      const response = await sendRequest(endpoint, [member], payload);
      expect(response.status).toBe(404);
      await expectNoEvents();
    }
  );

  it.each(endpoints)(
    "POST %s should not persist a mixed list of valid and missing members",
    async (endpoint) => {
      const validMember = generateId();
      const missingMember = generateId();
      selfcareV2Client.getInstitutionUsersByProductUsingGET = vi.fn(
        async (config) =>
          config?.queries?.userId === validMember
            ? [{ id: validMember, name: "Test", surname: "User" }]
            : []
      );
      const response = await sendRequest(
        endpoint,
        [validMember, missingMember],
        createUserPayload(authRole.ADMIN_ROLE)
      );
      expect(response.status).toBe(404);
      expect(response.body.errors).toEqual([
        expect.objectContaining({
          detail: expect.stringContaining(missingMember),
        }),
      ]);
      await expectNoEvents();
    }
  );

  it.each(endpoints)(
    "POST %s should accept an empty list without calling Selfcare",
    async (endpoint) => {
      selfcareV2Client.getInstitutionUsersByProductUsingGET = vi.fn();
      const response = await sendRequest(
        endpoint,
        [],
        createUserPayload(authRole.ADMIN_ROLE)
      );
      expect(response.status).toBe(200);
      expect(
        selfcareV2Client.getInstitutionUsersByProductUsingGET
      ).not.toHaveBeenCalled();
    }
  );

  it.each(endpoints)(
    "POST %s should reject duplicates before calling Selfcare",
    async (endpoint) => {
      selfcareV2Client.getInstitutionUsersByProductUsingGET = vi.fn();
      const member = generateId();
      const response = await sendRequest(
        endpoint,
        [member, member],
        createUserPayload(authRole.ADMIN_ROLE)
      );
      expect(response.status).toBe(400);
      expect(
        selfcareV2Client.getInstitutionUsersByProductUsingGET
      ).not.toHaveBeenCalled();
      await expectNoEvents();
    }
  );

  it.each(endpoints)(
    "POST %s should not turn a Selfcare failure into a missing user",
    async (endpoint) => {
      selfcareV2Client.getInstitutionUsersByProductUsingGET = vi
        .fn()
        .mockRejectedValue(new Error("Selfcare unavailable"));
      const response = await sendRequest(
        endpoint,
        [generateId()],
        createUserPayload(authRole.ADMIN_ROLE)
      );
      expect(response.status).toBe(500);
      await expectNoEvents();
    }
  );

  it.each(endpoints)(
    "POST %s should fail closed on a malformed Selfcare response",
    async (endpoint) => {
      selfcareV2Client.getInstitutionUsersByProductUsingGET = vi
        .fn()
        .mockResolvedValue(null);
      const response = await sendRequest(
        endpoint,
        [generateId()],
        createUserPayload(authRole.ADMIN_ROLE)
      );
      expect(response.status).toBe(500);
      await expectNoEvents();
    }
  );

  it.each([true, false])(
    "should resolve the M2M tenant and validate its member (exists: %s)",
    async (exists) => {
      const payload = createPayload(authRole.M2M_ADMIN_ROLE);
      const selfcareId = generateId();
      const member = generateId();
      await upsertTenant(
        readModelDB,
        { ...getMockTenant(), id: payload.organizationId, selfcareId },
        0
      );
      selfcareV2Client.getInstitutionUsersByProductUsingGET = vi.fn(
        async (config) =>
          exists &&
          config?.params.institutionId === selfcareId &&
          config.queries?.userId === member
            ? [{ id: member, name: "Test", surname: "User" }]
            : []
      );
      const response = await sendRequest("/clientsConsumer", [member], payload);
      expect(response.status).toBe(exists ? 200 : 404);
      expect(
        selfcareV2Client.getInstitutionUsersByProductUsingGET
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { institutionId: selfcareId },
          queries: { userId: member },
        })
      );
      if (!exists) {
        await expectNoEvents();
      }
    }
  );

  it("should accept empty members for M2M without looking up the tenant", async () => {
    selfcareV2Client.getInstitutionUsersByProductUsingGET = vi.fn();
    const response = await sendRequest(
      "/clientsConsumer",
      [],
      createPayload(authRole.M2M_ADMIN_ROLE)
    );
    expect(response.status).toBe(200);
    expect(
      selfcareV2Client.getInstitutionUsersByProductUsingGET
    ).not.toHaveBeenCalled();
  });

  it("should fail closed when the M2M tenant has no Selfcare ID", async () => {
    const payload = createPayload(authRole.M2M_ADMIN_ROLE);
    await upsertTenant(
      readModelDB,
      { ...getMockTenant(), id: payload.organizationId, selfcareId: undefined },
      0
    );
    selfcareV2Client.getInstitutionUsersByProductUsingGET = vi.fn();
    const response = await sendRequest(
      "/clientsConsumer",
      [generateId()],
      payload
    );
    expect(response.status).toBe(500);
    expect(
      selfcareV2Client.getInstitutionUsersByProductUsingGET
    ).not.toHaveBeenCalled();
    await expectNoEvents();
  });
});
