import { ReadModelRepository } from "pagopa-interop-commons";
import {
  Agreement,
  Delegation,
  EService,
  EServiceId,
  Tenant,
  agreementState,
  delegationState,
  genericInternalError,
} from "pagopa-interop-models";
import { z } from "zod";

export type ReadModelService = {
  getEServiceById: (id: string) => Promise<EService | undefined>;
  getTenantById: (tenantId: string) => Promise<Tenant | undefined>;
  getAgreementsByEserviceId: (
    eserviceId: EServiceId
  ) => Promise<Agreement[] | undefined>;
  getDelegationByDelegatorId: (
    delegatorId: string
  ) => Promise<Delegation | undefined>;
};
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
): ReadModelService {
  const { eservices, tenants, agreements, delegations } = readModelRepository;

  async function getEServiceById(id: string): Promise<EService | undefined> {
    const data = await eservices.findOne(
      { "data.id": id },
      { projection: { data: true } }
    );

    if (data) {
      const result = EService.safeParse(data.data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse eservices item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
    }

    return undefined;
  }

  async function getTenantById(tenantId: string): Promise<Tenant | undefined> {
    const data = await tenants.findOne(
      { "data.id": tenantId },
      { projection: { data: true } }
    );

    if (data) {
      const result = Tenant.safeParse(data.data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse tenant item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
    }
    return undefined;
  }

  async function getAgreementsByEserviceId(
    eserviceId: EServiceId
  ): Promise<Agreement[] | undefined> {
    const data = await agreements
      .find(
        {
          "data.eserviceId": eserviceId,
          "data.state": {
            $in: [
              agreementState.active,
              agreementState.suspended,
              agreementState.pending,
            ],
          },
        },
        { projection: { data: true } }
      )
      .toArray();

    if (data) {
      const result = z
        .array(Agreement)
        .safeParse(data.map((agreement) => agreement.data));

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse agreement item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
    }
    return undefined;
  }

  async function getDelegationByDelegatorId(
    delegatorId: string
  ): Promise<Delegation | undefined> {
    const data = await delegations.findOne(
      {
        "data.delegatorId": delegatorId,
        // "data.state": {
        //   $in: [delegationState.active, delegationState.waitingForApproval],
        // }, I'm not sure if state waitingForApproval should be included
        "data.state": delegationState.active,
      },
      { projection: { data: true } }
    );

    if (data) {
      const result = Delegation.safeParse(data.data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse delegation item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
    }
    return undefined;
  }

  return {
    getEServiceById,
    getTenantById,
    getAgreementsByEserviceId,
    getDelegationByDelegatorId,
  };
}
