import {
  Delegation,
  DelegationContractDocument,
  DelegationContractId,
  DelegationId,
  DelegationKind,
  DelegationState,
  EService,
  EServiceId,
  Tenant,
  TenantId,
  WithMetadata,
} from "pagopa-interop-models";
import { AppContext, Logger, WithLogger } from "pagopa-interop-commons";
import {
  delegationNotFound,
  eserviceNotFound,
  tenantNotFound,
  delegationContractNotFound,
} from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";
import { assertRequesterIsDelegateOrDelegator } from "./validators.js";

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

export const retrieveTenantById = async (
  readModelService: ReadModelService,
  tenantId: TenantId
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

export const retrieveEserviceById = async (
  readModelService: ReadModelService,
  id: EServiceId
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(id);
  if (!eservice) {
    throw eserviceNotFound(id);
  }
  return eservice.data;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationServiceBuilder(readModelService: ReadModelService) {
  return {
    async getDelegationById(
      delegationId: DelegationId,
      logger: Logger
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
      logger: Logger
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
    async getDelegationContract(
      delegationId: DelegationId,
      contractId: DelegationContractId,
      { logger, authData }: WithLogger<AppContext>
    ): Promise<DelegationContractDocument> {
      logger.info(
        `Retrieving delegation ${delegationId} contract ${contractId}`
      );
      const delegation = await retrieveDelegationById(
        readModelService,
        delegationId
      );

      assertRequesterIsDelegateOrDelegator(
        delegation.data,
        authData.organizationId
      );

      const { activationContract, revocationContract } = delegation.data;

      if (contractId === activationContract?.id) {
        return activationContract;
      }

      if (contractId === revocationContract?.id) {
        return revocationContract;
      }

      throw delegationContractNotFound(delegationId, contractId);
    },
  };
}
