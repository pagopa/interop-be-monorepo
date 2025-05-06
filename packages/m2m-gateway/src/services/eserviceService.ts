import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";

export type EserviceService = ReturnType<typeof eserviceServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceServiceBuilder(_clients: PagoPAInteropBeClients) {
  return {};
}
