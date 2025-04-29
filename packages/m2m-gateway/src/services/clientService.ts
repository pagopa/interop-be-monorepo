import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";

export type ClientService = ReturnType<typeof clientServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function clientServiceBuilder(_clients: PagoPAInteropBeClients) {
  return {};
}
