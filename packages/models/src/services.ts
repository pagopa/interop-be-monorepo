import { z } from "zod";

export const SERVICE_NAME = {
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
  Object.values(SERVICE_NAME)[0],
  ...Object.values(SERVICE_NAME).slice(1),
]);
export type ServiceName = z.infer<typeof ServiceName>;

export const SERVICE_ERROR_CODE: Record<ServiceName, string> = {
  [SERVICE_NAME.CATALOG_PROCESS]: "001",
  [SERVICE_NAME.AGREEMENT_PROCESS]: "002",
  [SERVICE_NAME.ATTRIBUTE_REGISTRY_PROCESS]: "003",
  [SERVICE_NAME.PURPOSE_PROCESS]: "004",
  [SERVICE_NAME.TENANT_PROCESS]: "005",
  [SERVICE_NAME.AUTHORIZATION_PROCESS]: "006",
  [SERVICE_NAME.AUTHORIZATION_SERVER]: "007",
  [SERVICE_NAME.BACKEND_FOR_FRONTEND]: "008",
  [SERVICE_NAME.API_GATEWAY]: "009",
  [SERVICE_NAME.DELEGATION_PROCESS]: "010",
  [SERVICE_NAME.ESERVICE_TEMPLATE_PROCESS]: "011",
};
