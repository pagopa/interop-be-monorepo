/* eslint-disable @typescript-eslint/explicit-function-return-type */
import request from "supertest";
import { AuthData, UserRole } from "pagopa-interop-commons";
import jwt from "jsonwebtoken";
import { generateId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { getMockAuthData } from "../mockUtils.js";
import { api } from "../vitest.api.setup.js";
import { createPayload } from "../mockedPayloadForToken.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
import { Config, routesConfig } from "./routesConfig.js";

async function testRoute(route: string, role: UserRole, config: Config) {
  const { serviceFunctionName, mock, method, routeInput } = config;

  vi.spyOn(catalogService, serviceFunctionName).mockImplementation(() =>
    Promise.resolve(mock)
  );

  const authData: AuthData = {
    ...getMockAuthData(),
    userRoles: [role],
  };

  const validToken = jwt.sign(createPayload(authData), "test-secret");

  const req = request(api)
    [method](route)
    .set("Authorization", `Bearer ${validToken}`)
    .set("X-Correlation-Id", generateId());

  if (method === "get") {
    void req.query(routeInput);
  } else {
    void req.send(routeInput);
  }

  return await req;
}

async function successCase(route: string, role: UserRole, config: Config) {
  const res = await testRoute(route, role, config);

  expect(res.status).toBe(200);
  expect(res.body).toEqual(config.expectedOutput);
  vi.clearAllMocks();
}

async function errorCase(route: string, role: UserRole, config: Config) {
  const res = await testRoute(route, role, config);

  expect(res.status).toBe(403);
}

const cases = Object.entries(routesConfig).flatMap(([route, configs]) =>
  configs.flatMap((config) =>
    config.roles.map((role) => ({
      route,
      role,
      config,
    }))
  )
);

const allRoles: UserRole[] = [
  "admin",
  "security",
  "api",
  "support",
  "m2m",
  "internal",
  "maintenance",
];

const errorRoleCases = Object.entries(routesConfig).flatMap(
  ([route, configs]) =>
    configs.flatMap((config) =>
      allRoles
        .filter((role) => !config.roles.includes(role))
        .map((role) => ({
          route,
          role,
          config,
        }))
    )
);

describe("API Routes", () => {
  cases.forEach(({ route, role, config }) => {
    it(`should allow ${role} to access ${route} with ${config.method}`, async () => {
      await successCase(route, role, config);
    });
  });

  errorRoleCases.forEach(({ route, role, config }) => {
    it(`should return 403 if role ${role} is not authorized for ${config.method} ${route}`, async () => {
      await errorCase(route, role, config);
    });
  });
});
