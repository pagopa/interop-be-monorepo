import { Delegation } from "pagopa-interop-models";

export type Delegations = {
  producerDelegation: Delegation | undefined;
  consumerDelegation: Delegation | undefined;
};
