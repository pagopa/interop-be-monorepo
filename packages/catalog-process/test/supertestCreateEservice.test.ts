/* eslint-disable @typescript-eslint/explicit-function-return-type */
import request from "supertest";
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { AuthData, ExpressContext, userRoles } from "pagopa-interop-commons";
import jwt from "jsonwebtoken";
import { SelfcareId, TenantId, UserId } from "pagopa-interop-models";
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { getMockAuthData, getMockEService } from "./utils.js";
import { createPayload } from "./mockedPayloadForToken.js";

// ✅ Spostato sopra per evitare il problema di hoisting
export const mockAuthenticationMiddleware: (
  config: unknown
) => ZodiosRouterContextRequestHandler<ExpressContext> =
  () =>
  async (req, _res, next): Promise<unknown> => {
    try {
      req.ctx.authData = {
        ...getMockAuthData("ed6e288d-c9cf-4c9c-893d-0a051dac638a" as TenantId),
        userId: "2098e3bd-f2bb-4695-8d54-efcea7dc1092" as UserId,
        selfcareId: "2efb2a51-9fdc-4ce6-9d24-875b7d834839" as SelfcareId,
        userRoles: [userRoles.ADMIN_ROLE],
      } satisfies AuthData;
      return next();
    } catch (error) {
      next(error);
    }
  };

// ✅ `mockAuthenticationMiddleware` ora esiste prima di essere usato nel mock
vi.mock("pagopa-interop-commons", async (importActual) => {
  const actual = await importActual<typeof import("pagopa-interop-commons")>();
  return {
    ...actual,
    initDB: vi.fn(), // Evita qualsiasi connessione a DB
    authenticationMiddleware: mockAuthenticationMiddleware,
  };
});

vi.mock("../src/services/catalogService", async (importActual) => {
  const originalModule = await importActual<
    typeof import("../src/services/catalogService.js")
  >();

  return {
    ...originalModule,
    catalogServiceBuilder: vi.fn(() => ({
      ...originalModule.catalogServiceBuilder,
      createEService: vi.fn().mockResolvedValue({
        id: "123",
        producerId: "ed6e288d-c9cf-4c9c-893d-0a051dac638a",
        name: "Mocked EService",
        description: "Mocked description",
        technology: "API",
        mode: "STANDARD",
        attributes: undefined,
        descriptors: [],
        createdAt: new Date(),
        riskAnalysis: [],
        isSignalHubEnabled: false,
        isConsumerDelegable: false,
        isClientAccessDelegable: false,
      }),
    })),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Test autorizzazione API /eservices", async () => {
  const validToken = jwt.sign(
    createPayload({
      ...getMockAuthData("ed6e288d-c9cf-4c9c-893d-0a051dac638a" as TenantId),
      userId: "2098e3bd-f2bb-4695-8d54-efcea7dc1092" as UserId,
      selfcareId: "2efb2a51-9fdc-4ce6-9d24-875b7d834839" as SelfcareId,
      userRoles: [userRoles.ADMIN_ROLE],
    } satisfies AuthData),
    "test-secret"
  );

  const eservicePayload = {
    ...getMockEService(),
    producerId: "ed6e288d-c9cf-4c9c-893d-0a051dac638a",
  };

  // ✅ Import dell'app spostato dentro `describe`, per evitare problemi di esecuzione anticipata
  const { default: app } = await import("../src/app.js");

  it("Dovrebbe restituire 200 per un utente con ADMIN_ROLE", async () => {
    const response = await request(app)
      .post("/eservices")
      .set("Authorization", `Bearer ${validToken}`)
      .set("X-Correlation-Id", "test-correlation-id")
      .send(eservicePayload);

    expect(response.status).toBe(200);
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});
