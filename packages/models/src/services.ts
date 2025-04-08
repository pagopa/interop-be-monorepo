import { z } from "zod";

export const serviceName = {
  CATALOG_PROCESS: "catalog-process",
  AGREEMENT_PROCESS: "agreement-process",
  ATTRIBUTE_REGISTRY_PROCESS: "attribute-registry-process",
  PURPOSE_PROCESS: "purpose-process",
  TENANT_PROCESS: "tenant-process",
  AUTHORIZATION_PROCESS: "authorization-process",
  AUTHORIZATION_SERVER: "authorization-server",
  BACKEND_FOR_FRONTEND: "backend-for-frontend",
  API_GATEWAY: "api-gateway",
  DELEGATION_PROCESS: "delegation-process",
  ESERVICE_TEMPLATE_PROCESS: "eservice-template-process",
} as const;

export const ServiceName = z.enum([
  Object.values(serviceName)[0],
  ...Object.values(serviceName).slice(1),
]);
export type ServiceName = z.infer<typeof ServiceName>;

export const serviceErrorCode: Record<ServiceName, string> = {
  [serviceName.CATALOG_PROCESS]: "001",
  [serviceName.AGREEMENT_PROCESS]: "002",
  [serviceName.ATTRIBUTE_REGISTRY_PROCESS]: "003",
  [serviceName.PURPOSE_PROCESS]: "004",
  [serviceName.TENANT_PROCESS]: "005",
  [serviceName.AUTHORIZATION_PROCESS]: "006",
  [serviceName.AUTHORIZATION_SERVER]: "007",
  [serviceName.BACKEND_FOR_FRONTEND]: "008",
  [serviceName.API_GATEWAY]: "009",
  [serviceName.DELEGATION_PROCESS]: "010",
  [serviceName.ESERVICE_TEMPLATE_PROCESS]: "011",
};
