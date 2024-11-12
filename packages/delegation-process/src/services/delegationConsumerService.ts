import { Delegation } from "pagopa-interop-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationConsumerServiceBuilder() {
  return {
    async createConsumerDelegation(): Promise<Delegation> {
      throw new Error("Not implemented");
    },
  };
}

export type DelegationConsumerService = ReturnType<
  typeof delegationConsumerServiceBuilder
>;
