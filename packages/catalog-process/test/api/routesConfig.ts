/* eslint-disable @typescript-eslint/no-explicit-any */
import { UserRole, userRoles } from "pagopa-interop-commons";
import { catalogService } from "../integrationUtils.js";
import {
  mockEService,
  mockEserviceSeed,
  mockApiEservice,
  mockEServicesResponse,
  mockEserviceFilter,
  mockApiEServicesResponse,
} from "./routesBody.js";

export type CatalogServiceFunctionNames = keyof typeof catalogService;

export const routesConfig: Record<
  string,
  Array<{
    method: "get" | "post" | "put" | "delete";
    roles: UserRole[];
    mock: any;
    routeInput: any;
    expectedOutput: any;
    serviceFunctionName: CatalogServiceFunctionNames;
  }>
> = {
  "/eservices": [
    {
      method: "post",
      roles: [userRoles.ADMIN_ROLE, userRoles.API_ROLE],
      mock: mockEService,
      routeInput: mockEserviceSeed,
      expectedOutput: mockApiEservice,
      serviceFunctionName: "createEService",
    },
    {
      method: "get",
      roles: [
        userRoles.ADMIN_ROLE,
        userRoles.API_ROLE,
        userRoles.M2M_ROLE,
        userRoles.SECURITY_ROLE,
        userRoles.SUPPORT_ROLE,
      ],
      mock: mockEServicesResponse,
      routeInput: { ...mockEserviceFilter, offset: 0, limit: 10 },
      expectedOutput: mockApiEServicesResponse,
      serviceFunctionName: "getEServices",
    },
  ],
};

export type Config = (typeof routesConfig)[string][number];
