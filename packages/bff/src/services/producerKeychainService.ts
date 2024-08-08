/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { PagoPAInteropBeClients } from "../providers/clientProvider.js";

export function producerKeychainServiceBuilder(
  _apiClients: PagoPAInteropBeClients
) {
  // const { authorizationProcessClient } = apiClients;

  return {};
}

export type ProducerKeychainService = ReturnType<
  typeof producerKeychainServiceBuilder
>;
