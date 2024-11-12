import {
  Delegation,
  DelegationId,
  DelegationKind,
  DelegationState,
  EServiceId,
  TenantId,
  WithMetadata,
} from "pagopa-interop-models";
import { AppContext, WithLogger } from "pagopa-interop-commons";
import { delegationNotFound } from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

export const retrieveDelegationById = async (
  readModelService: ReadModelService,
  delegationId: DelegationId
): Promise<WithMetadata<Delegation>> => {
  const delegation = await readModelService.getDelegationById(delegationId);
  if (!delegation?.data) {
    throw delegationNotFound(delegationId);
  }
  return delegation;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationServiceBuilder(readModelService: ReadModelService) {
  return {
    async getDelegationById(
      delegationId: DelegationId,
      { logger }: WithLogger<AppContext>
    ): Promise<Delegation> {
      logger.info(`Retrieving delegation by id ${delegationId}`);

      const delegation = await retrieveDelegationById(
        readModelService,
        delegationId
      );
      return delegation.data;
    },
    async getDelegations(
      {
        delegateIds,
        delegatorIds,
        delegationStates,
        eserviceIds,
        kind,
        offset,
        limit,
      }: {
        delegateIds: TenantId[];
        delegatorIds: TenantId[];
        delegationStates: DelegationState[];
        eserviceIds: EServiceId[];
        kind: DelegationKind | undefined;
        offset: number;
        limit: number;
      },
      { logger }: WithLogger<AppContext>
    ): Promise<Delegation[]> {
      logger.info(
        `Retrieving delegations with filters: delegateIds=${delegateIds}, delegatorIds=${delegatorIds}, delegationStates=${delegationStates}, eserviceIds=${eserviceIds}, kind=${kind}, offset=${offset}, limit=${limit}`
      );

      return readModelService.getDelegations({
        delegateIds,
        delegatorIds,
        eserviceIds,
        delegationStates,
        kind,
        offset,
        limit,
      });
    },
  };
}
