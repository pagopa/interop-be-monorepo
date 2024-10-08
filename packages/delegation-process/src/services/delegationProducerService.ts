import { Delegation, DelegationId } from "pagopa-interop-models";
import { delegationNotFound } from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationProducerServiceBuilder(
  readModelService: ReadModelService
) {
  return {
    async getDelegationById(delegationId: DelegationId): Promise<Delegation> {
      const delegation = await readModelService.getDelegationById(delegationId);

      if (!delegation) {
        throw delegationNotFound(delegationId);
      }

      return delegation;
    },
  };
}
