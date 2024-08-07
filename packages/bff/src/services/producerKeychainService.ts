/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { AuthorizationProcessClient } from "../providers/clientProvider.js";

export type ProducerKeychainService = ReturnType<
  typeof producerKeychainServiceBuilder
>;

export function producerKeychainServiceBuilder(
  _authorizationProcessClient: AuthorizationProcessClient
) {
  return {};
}
