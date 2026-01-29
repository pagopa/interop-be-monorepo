/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { api, mockClientService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { userNotFound } from "../../../src/model/errors.js";
import { getMockm2mGatewayApiV3CompactUser } from "../../mockUtils.js";

describe("API GET /clients/:clientId/users", () => {
    const mockResponse: m2mGatewayApiV3.CompactUsers = [
        getMockm2mGatewayApiV3CompactUser(),
        getMockm2mGatewayApiV3CompactUser(),
        getMockm2mGatewayApiV3CompactUser(),
    ];

    beforeEach(() => {
        mockClientService.getClientUsers = vi
            .fn()
            .mockResolvedValue(mockResponse);
    });

    const makeRequest = async (
        token: string,
        clientId: ClientId = generateId()
    ) =>
        request(api)
            .get(`${appBasePath}/clients/${clientId}/users`)
            .set("Authorization", `Bearer ${token}`)
            .set("X-Correlation-Id", generateId());

    it("Should return 200 for user with role M2M Admin", async () => {
        const token = generateToken(authRole.M2M_ADMIN_ROLE);
        const res = await makeRequest(token);
        expect(res.status).toBe(200);
        expect(res.body).toEqual(mockResponse);
    });

    it("Should return 404 for userNotFound", async () => {
        mockClientService.getClientUsers = vi
            .fn()
            .mockRejectedValue(userNotFound(generateId(), generateId()));
        const token = generateToken(authRole.M2M_ADMIN_ROLE);
        const res = await makeRequest(token);
        expect(res.status).toBe(404);
    });

    it("Should return 400 if passed an invalid client id", async () => {
        const token = generateToken(authRole.M2M_ADMIN_ROLE);
        const res = await makeRequest(token, "invalid" as ClientId);
        expect(res.status).toBe(400);
    });
});
