import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";

export type TenantService = ReturnType<typeof tenantServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(_clients: PagoPAInteropBeClients) {
  return {};
}
