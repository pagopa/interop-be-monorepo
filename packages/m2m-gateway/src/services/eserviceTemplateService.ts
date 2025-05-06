import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";

export type EserviceTemplateService = ReturnType<
  typeof eserviceTemplateServiceBuilder
>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceTemplateServiceBuilder(
  _clients: PagoPAInteropBeClients
) {
  return {};
}
