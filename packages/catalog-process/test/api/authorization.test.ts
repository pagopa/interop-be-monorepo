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

async function testRoute(route: string, roles: UserRole[]) {
  const configs = routesConfig[route];
  if (!configs) {
    throw new Error(`Route ${route} not found in config`);
  }

  return await Promise.all(
    configs.map(async (config) => {
      vi.spyOn(catalogService, config.serviceFunctionName).mockImplementation(
        () => Promise.resolve(config.mock)
      );

      const authData: AuthData = {
        ...getMockAuthData(),
        userRoles: roles,
      };

      const validToken = jwt.sign(createPayload(authData), "test-secret");

      const req = request(api)
        [config.method](route)
        .set("Authorization", `Bearer ${validToken}`)
        .set("X-Correlation-Id", generateId());

      if (config.method === "get") {
        void req.query(config.routeInput);
      } else {
        void req.send(config.routeInput);
      }

      const res = await req;
      return { res, config };
    })
  );
}

async function successCase(route: string, roles: UserRole[]) {
  const results = await testRoute(route, roles);

  results.forEach(({ res, config }) => {
    expect(res.status).toBe(200);
    expect(res.body).toEqual(config.expectedOutput);
  });
  vi.clearAllMocks();
}

async function errorCase(route: string) {
  const configs = routesConfig[route];
  if (!configs) {
    throw new Error(`Route ${route} not found in config`);
  }
  const configRoles = configs.flatMap((config) => config.roles);
  const allRoles: UserRole[] = [
    "admin",
    "security",
    "api",
    "support",
    "m2m",
    "internal",
    "maintenance",
  ];
  const roles = allRoles.filter((role) => !configRoles.includes(role));

  const results = await testRoute(route, roles);
  results.forEach(({ res }) => {
    expect(res.status).toBe(403);
  });
}

export const filterRoutesByMethod = (
  method: "get" | "post" | "put" | "delete"
) =>
  Object.entries(routesConfig).reduce((acc, [route, configs]) => {
    const filteredConfigs = configs.filter(
      (config) => config.method === method
    );
    if (filteredConfigs.length > 0) {
      // Push un oggetto con una chiave 'route' e un array di 'filteredConfigs'
      acc.push({ [route]: filteredConfigs });
    }
    return acc;
  }, [] as Array<{ [key: string]: (typeof routesConfig)[string] }>); // Tipo corretto dell'accumulatore

const rotte = ["get", "post", "put", "delete"] as const;

describe("API Routes", () => {
  rotte.forEach((httpMethod) => {
    const filteredRoutes = filterRoutesByMethod(httpMethod);
    filteredRoutes.forEach((filteredRoute) => {
      // Ogni elemento di filteredRoute è un oggetto con una chiave 'route' e i relativi 'configs'
      const [route, configs] = Object.entries(filteredRoute)[0];

      configs.forEach((config) => {
        if (config.method === httpMethod) {
          config.roles.forEach((role) => {
            it(`should allow ${role} to access ${route} with ${httpMethod}`, async () => {
              await successCase(route, [role as UserRole]);
            });
          });
        }
      });

      it(`should return 403 if role is not authorized for ${httpMethod} ${route}`, async () => {
        await errorCase(route);
      });
    });
  });
});
