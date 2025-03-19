/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/* eslint-disable functional/no-let */
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
import { routesConfig } from "./routesConfig.js";

async function testRoute(
  route: string,
  role: UserRole,
  serviceFunctionName: any,
  mock: any,
  method: "get" | "post" | "put" | "delete",
  input: any
) {
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
    void req.query(input);
  } else {
    void req.send(input);
  }

  return await req;
}

async function successCase(
  route: string,
  role: UserRole,
  serviceFunctionName: any,
  mock: any,
  method: "get" | "post" | "put" | "delete",
  input: any,
  output: any
) {
  const res = await testRoute(
    route,
    role,
    serviceFunctionName,
    mock,
    method,
    input
  );

  expect(res.status).toBe(200);
  expect(res.body).toEqual(output);
  vi.clearAllMocks();
}

async function errorCase(
  route: string,
  role: UserRole,
  serviceFunctionName: any,
  mock: any,
  method: "get" | "post" | "put" | "delete",
  input: any
) {
  const res = await testRoute(
    route,
    role,
    serviceFunctionName,
    mock,
    method,
    input
  );
  expect(res.status).toBe(403);
}

const cases = Object.entries(routesConfig).flatMap(([key, value]) =>
  value.flatMap((config) =>
    config.roles.flatMap((role) => ({
      route: key,
      method: config.method,
      role,
      expected: config.expectedOutput,
      input: config.routeInput,
      serviceFunctionName: config.serviceFunctionName,
      mock: config.mock,
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

const errorRoleCases = Object.entries(routesConfig).flatMap(([key, value]) =>
  value.flatMap((config) =>
    allRoles
      .filter((role) => !config.roles.includes(role))
      .map((role) => ({
        route: key,
        method: config.method,
        role,
        expected: config.expectedOutput,
        input: config.routeInput,
        serviceFunctionName: config.serviceFunctionName,
        mock: config.mock,
      }))
  )
);

describe("API Routes", () => {
  cases.forEach((c) => {
    it(`should allow ${c.role} to access ${c.route} with ${c.method}`, async () => {
      await successCase(
        c.route,
        c.role as UserRole,
        c.serviceFunctionName,
        c.mock,
        c.method,
        c.input,
        c.expected
      );
    });
  });

  errorRoleCases.forEach((c) => {
    it(`should return 403 if role is not authorized for ${c.method} ${c.route}`, async () => {
      await errorCase(
        c.route,
        c.role,
        c.serviceFunctionName,
        c.mock,
        c.method,
        c.input
      );
    });
  });
});
