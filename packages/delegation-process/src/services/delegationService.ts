import {
  Delegation,
  DelegationContractDocument,
  DelegationContractId,
  delegationEventToBinaryDataV2,
  DelegationId,
  delegationKind,
  DelegationKind,
  delegationState,
  DelegationState,
  EService,
  EServiceId,
  generateId,
  Tenant,
  ListResult,
  TenantId,
  WithMetadata,
  DelegationSignedContractDocument,
} from "pagopa-interop-models";

import {
  AppContext,
  AuthData,
  DB,
  eventRepository,
  FileManager,
  isFeatureFlagEnabled,
  M2MAdminAuthData,
  M2MAuthData,
  PDFGenerator,
  UIAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { delegationApi } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";
import {
  delegationNotFound,
  eserviceNotFound,
  tenantNotFound,
  delegationContractNotFound,
} from "../model/domain/errors.js";
import {
  toCreateEventConsumerDelegationApproved,
  toCreateEventConsumerDelegationRejected,
  toCreateEventConsumerDelegationSubmitted,
  toCreateEventConsumerDelegationRevoked,
  toCreateEventProducerDelegationApproved,
  toCreateEventProducerDelegationRejected,
  toCreateEventProducerDelegationRevoked,
  toCreateEventProducerDelegationSubmitted,
  toCreateEventDelegationContractGenerated,
  toCreateEventDelegationSignedContractGenerated,
} from "../model/domain/toEvent.js";
import {
  activeDelegationStates,
  assertDelegationNotExists,
  assertDelegatorAndDelegateAllowedOrigins,
  assertDelegatorIsNotDelegate,
  assertDelegatorIsProducer,
  assertEserviceIsConsumerDelegable,
  assertIsDelegate,
  assertIsDelegator,
  assertIsState,
  assertNoDelegationRelatedAgreementExists,
  assertRequesterIsDelegateOrDelegator,
  assertTenantAllowedToReceiveDelegation,
} from "./validators.js";
import { contractBuilder } from "./delegationContractBuilder.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

export const retrieveDelegationById = async (
  {
    delegationId,
    kind,
  }: {
    delegationId: DelegationId;
    kind: DelegationKind | undefined;
  },
  readModelService: ReadModelServiceSQL
): Promise<WithMetadata<Delegation>> => {
  const delegation = await readModelService.getDelegationById(
    delegationId,
    kind
  );
  if (!delegation?.data) {
    throw delegationNotFound(delegationId, kind);
  }
  return delegation;
};

export const retrieveTenantById = async (
  readModelService: ReadModelServiceSQL,
  tenantId: TenantId
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

export const retrieveEserviceById = async (
  readModelService: ReadModelServiceSQL,
  id: EServiceId
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(id);
  if (!eservice) {
    throw eserviceNotFound(id);
  }
  return eservice.data;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelServiceSQL,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager
) {
  const repository = eventRepository(dbInstance, delegationEventToBinaryDataV2);

  async function createDelegation(
    {
      delegateId,
      eserviceId,
      kind,
    }: {
      delegateId: TenantId;
      eserviceId: EServiceId;
      kind: DelegationKind;
    },
    {
      authData,
      logger,
      correlationId,
    }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
  ): Promise<WithMetadata<Delegation>> {
    const delegatorId = authData.organizationId;

    logger.info(
      `Creating a delegation for tenant ${delegateId} by ${
        kind === delegationKind.delegatedConsumer ? "consumer" : "producer"
      } ${delegatorId}`
    );

    assertDelegatorIsNotDelegate(delegatorId, delegateId);

    const [delegator, delegate, eservice] = await Promise.all([
      retrieveTenantById(readModelService, delegatorId),
      retrieveTenantById(readModelService, delegateId),
      retrieveEserviceById(readModelService, eserviceId),
    ]);

    assertTenantAllowedToReceiveDelegation(delegate, kind);
    await assertDelegatorAndDelegateAllowedOrigins(delegator, delegate);

    await match(kind)
      .with(delegationKind.delegatedProducer, () =>
        assertDelegatorIsProducer(delegatorId, eservice)
      )
      .with(delegationKind.delegatedConsumer, async () => {
        assertEserviceIsConsumerDelegable(eservice);

        await assertNoDelegationRelatedAgreementExists(
          delegator.id,
          eservice.id,
          readModelService
        );
      })
      .exhaustive();

    await assertDelegationNotExists(
      delegator,
      eserviceId,
      kind,
      readModelService
    );

    const creationDate = new Date();
    const delegation: Delegation = {
      id: generateId<DelegationId>(),
      delegatorId,
      delegateId,
      eserviceId,
      createdAt: creationDate,
      state: delegationState.waitingForApproval,
      kind,
      stamps: {
        submission: {
          who: authData.userId,
          when: creationDate,
        },
      },
    };

    const event = await repository.createEvent(
      match(kind)
        .with(delegationKind.delegatedProducer, () =>
          toCreateEventProducerDelegationSubmitted(delegation, correlationId)
        )
        .with(delegationKind.delegatedConsumer, () =>
          toCreateEventConsumerDelegationSubmitted(delegation, correlationId)
        )
        .exhaustive()
    );

    return {
      data: delegation,
      metadata: {
        version: event.newVersion,
      },
    };
  }

  async function approveDelegation(
    delegationId: DelegationId,
    kind: DelegationKind,
    {
      logger,
      correlationId,
      authData,
    }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
  ): Promise<WithMetadata<Delegation>> {
    logger.info(
      `Approving delegation ${delegationId} by delegate ${authData.organizationId}`
    );

    const { data: delegation, metadata } = await retrieveDelegationById(
      {
        delegationId,
        kind,
      },
      readModelService
    );

    assertIsDelegate(delegation, authData);
    assertIsState(delegationState.waitingForApproval, delegation);

    const [delegator, delegate, eservice] = await Promise.all([
      retrieveTenantById(readModelService, delegation.delegatorId),
      retrieveTenantById(readModelService, delegation.delegateId),
      retrieveEserviceById(readModelService, delegation.eserviceId),
    ]);

    const now = new Date();
    const approvedDelegationWithoutContract: Delegation = {
      ...delegation,
      state: delegationState.active,
      updatedAt: now,
      stamps: {
        ...delegation.stamps,
        activation: {
          who: authData.userId,
          when: now,
        },
      },
    };

    if (isFeatureFlagEnabled(config, "featureFlagDelegationsContractBuilder")) {
      const activationContract = await contractBuilder.createActivationContract(
        {
          delegation: approvedDelegationWithoutContract,
          delegator,
          delegate,
          eservice,
          pdfGenerator,
          fileManager,
          config,
          logger,
        }
      );

      const approvedDelegation = {
        ...approvedDelegationWithoutContract,
        activationContract,
      };
      const event = await repository.createEvent(
        match(kind)
          .with(delegationKind.delegatedProducer, () =>
            toCreateEventProducerDelegationApproved(
              { data: approvedDelegation, metadata },
              correlationId
            )
          )
          .with(delegationKind.delegatedConsumer, () =>
            toCreateEventConsumerDelegationApproved(
              { data: approvedDelegation, metadata },
              correlationId
            )
          )
          .exhaustive()
      );

      return {
        data: approvedDelegation,
        metadata: {
          version: event.newVersion,
        },
      };
    }

    // Feature flag disabled: persist approval without generating contracts
    const event = await repository.createEvent(
      match(kind)
        .with(delegationKind.delegatedProducer, () =>
          toCreateEventProducerDelegationApproved(
            { data: approvedDelegationWithoutContract, metadata },
            correlationId
          )
        )
        .with(delegationKind.delegatedConsumer, () =>
          toCreateEventConsumerDelegationApproved(
            { data: approvedDelegationWithoutContract, metadata },
            correlationId
          )
        )
        .exhaustive()
    );

    return {
      data: approvedDelegationWithoutContract,
      metadata: {
        version: event.newVersion,
      },
    };
  }

  async function rejectDelegation(
    delegationId: DelegationId,
    rejectionReason: string,
    kind: DelegationKind,
    {
      logger,
      correlationId,
      authData,
    }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
  ): Promise<WithMetadata<Delegation>> {
    logger.info(
      `Rejecting delegation ${delegationId} by delegate ${authData.organizationId}`
    );

    const { data: delegation, metadata } = await retrieveDelegationById(
      {
        delegationId,
        kind,
      },
      readModelService
    );

    assertIsDelegate(delegation, authData);
    assertIsState(delegationState.waitingForApproval, delegation);

    const now = new Date();

    const rejectedDelegation: Delegation = {
      ...delegation,
      state: delegationState.rejected,
      updatedAt: now,
      rejectionReason,
      stamps: {
        ...delegation.stamps,
        rejection: {
          who: authData.userId,
          when: now,
        },
      },
    };

    const event = await repository.createEvent(
      match(kind)
        .with(delegationKind.delegatedProducer, () =>
          toCreateEventProducerDelegationRejected(
            { data: rejectedDelegation, metadata },
            correlationId
          )
        )
        .with(delegationKind.delegatedConsumer, () =>
          toCreateEventConsumerDelegationRejected(
            { data: rejectedDelegation, metadata },
            correlationId
          )
        )
        .exhaustive()
    );

    return {
      data: rejectedDelegation,
      metadata: {
        version: event.newVersion,
      },
    };
  }

  async function revokeDelegation(
    delegationId: DelegationId,
    kind: DelegationKind,
    { authData, logger, correlationId }: WithLogger<AppContext<UIAuthData>>
  ): Promise<void> {
    logger.info(
      `Revoking delegation ${delegationId} by ${
        kind === delegationKind.delegatedProducer ? "producer" : "consumer"
      } ${authData.organizationId}`
    );

    const { data: delegation, metadata } = await retrieveDelegationById(
      {
        delegationId,
        kind,
      },
      readModelService
    );

    assertIsDelegator(delegation, authData);
    assertIsState(activeDelegationStates, delegation);

    const [delegator, delegate, eservice] = await Promise.all([
      retrieveTenantById(readModelService, delegation.delegatorId),
      retrieveTenantById(readModelService, delegation.delegateId),
      retrieveEserviceById(readModelService, delegation.eserviceId),
    ]);

    const now = new Date();
    const revokedDelegationWithoutContract: Delegation = {
      ...delegation,
      state: delegationState.revoked,
      updatedAt: now,
      stamps: {
        ...delegation.stamps,
        revocation: {
          who: authData.userId,
          when: now,
        },
      },
    };

    // eslint-disable-next-line functional/no-let
    let revokedDelegation: Delegation = {
      ...revokedDelegationWithoutContract,
    };

    if (isFeatureFlagEnabled(config, "featureFlagDelegationsContractBuilder")) {
      const revocationContract = await contractBuilder.createRevocationContract(
        {
          delegation: revokedDelegationWithoutContract,
          delegator,
          delegate,
          eservice,
          pdfGenerator,
          fileManager,
          config,
          logger,
        }
      );

      revokedDelegation = {
        ...revokedDelegation,
        revocationContract,
      };
      await repository.createEvent(
        match(kind)
          .with(delegationKind.delegatedProducer, () =>
            toCreateEventProducerDelegationRevoked(
              {
                data: revokedDelegation,
                metadata,
              },
              correlationId
            )
          )
          .with(delegationKind.delegatedConsumer, () =>
            toCreateEventConsumerDelegationRevoked(
              {
                data: revokedDelegation,
                metadata,
              },
              correlationId
            )
          )
          .exhaustive()
      );
    }
  }

  async function internalAddDelegationContract(
    delegationId: DelegationId,
    delegationContract: DelegationContractDocument,
    { logger, correlationId }: WithLogger<AppContext<AuthData>>
  ): Promise<WithMetadata<Delegation>> {
    logger.info(`Adding delegation contract to delegation ${delegationId}`);
    const { data: delegation, metadata } = await retrieveDelegationById(
      {
        delegationId,
        kind: undefined,
      },
      readModelService
    );
    const delegationWithContract: Delegation = ((): Delegation => {
      if (delegation.state === delegationState.revoked) {
        return {
          ...delegation,
          revocationContract: delegationContract,
        };
      } else {
        return {
          ...delegation,
          activationContract: delegationContract,
        };
      }
    })();

    const event = await repository.createEvent(
      toCreateEventDelegationContractGenerated(
        { data: delegationWithContract, metadata },
        correlationId
      )
    );
    return {
      data: delegation,
      metadata: {
        version: event.newVersion,
      },
    };
  }
  async function internalAddDelegationSignedContract(
    delegationId: DelegationId,
    delegationContract: DelegationSignedContractDocument,
    { logger, correlationId }: WithLogger<AppContext<AuthData>>
  ): Promise<WithMetadata<Delegation>> {
    logger.info(
      `Adding delegation signed contract to delegation ${delegationId}`
    );
    const { data: delegation, metadata } = await retrieveDelegationById(
      {
        delegationId,
        kind: undefined,
      },
      readModelService
    );

    assertIsState(
      [delegationState.active, delegationState.revoked],
      delegation
    );

    const delegationWithContract: Delegation = ((): Delegation => {
      if (delegation.state === delegationState.revoked) {
        return {
          ...delegation,
          revocationSignedContract: delegationContract,
        };
      } else {
        return {
          ...delegation,
          activationSignedContract: delegationContract,
        };
      }
    })();

    const event = await repository.createEvent(
      toCreateEventDelegationSignedContractGenerated(
        { data: delegationWithContract, metadata },
        correlationId
      )
    );
    return {
      data: delegation,
      metadata: {
        version: event.newVersion,
      },
    };
  }

  return {
    async getDelegationById(
      delegationId: DelegationId,
      { logger }: WithLogger<AppContext>
    ): Promise<WithMetadata<Delegation>> {
      logger.info(`Retrieving delegation by id ${delegationId}`);

      const delegation = await retrieveDelegationById(
        { delegationId, kind: undefined },
        readModelService
      );

      return {
        data: delegation.data,
        metadata: {
          version: delegation.metadata.version,
        },
      };
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
    ): Promise<ListResult<Delegation>> {
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
      { logger, authData }: WithLogger<AppContext<UIAuthData | M2MAuthData>>
    ): Promise<DelegationContractDocument> {
      logger.info(
        `Retrieving delegation ${delegationId} contract ${contractId}`
      );
      const delegation = await retrieveDelegationById(
        { delegationId, kind: undefined },
        readModelService
      );

      assertRequesterIsDelegateOrDelegator(delegation.data, authData);

      const { activationContract, revocationContract } = delegation.data;

      if (contractId === activationContract?.id) {
        return activationContract;
      }

      if (contractId === revocationContract?.id) {
        return revocationContract;
      }

      throw delegationContractNotFound(delegationId, contractId);
    },
    async createProducerDelegation(
      {
        delegateId,
        eserviceId,
      }: {
        delegateId: TenantId;
        eserviceId: EServiceId;
      },
      ctx: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Delegation>> {
      return createDelegation(
        {
          delegateId,
          eserviceId,
          kind: delegationKind.delegatedProducer,
        },
        ctx
      );
    },
    async createConsumerDelegation(
      {
        delegateId,
        eserviceId,
      }: {
        delegateId: TenantId;
        eserviceId: EServiceId;
      },
      ctx: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Delegation>> {
      return createDelegation(
        {
          delegateId,
          eserviceId,
          kind: delegationKind.delegatedConsumer,
        },
        ctx
      );
    },
    async approveProducerDelegation(
      delegationId: DelegationId,
      ctx: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Delegation>> {
      return approveDelegation(
        delegationId,
        delegationKind.delegatedProducer,
        ctx
      );
    },
    async approveConsumerDelegation(
      delegationId: DelegationId,
      ctx: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Delegation>> {
      return approveDelegation(
        delegationId,
        delegationKind.delegatedConsumer,
        ctx
      );
    },
    async rejectProducerDelegation(
      delegationId: DelegationId,
      rejectionReason: string,
      ctx: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Delegation>> {
      return rejectDelegation(
        delegationId,
        rejectionReason,
        delegationKind.delegatedProducer,
        ctx
      );
    },
    async rejectConsumerDelegation(
      delegationId: DelegationId,
      rejectionReason: string,
      ctx: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Delegation>> {
      return rejectDelegation(
        delegationId,
        rejectionReason,
        delegationKind.delegatedConsumer,
        ctx
      );
    },
    async revokeProducerDelegation(
      delegationId: DelegationId,
      ctx: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      await revokeDelegation(
        delegationId,
        delegationKind.delegatedProducer,
        ctx
      );
    },
    async revokeConsumerDelegation(
      delegationId: DelegationId,
      ctx: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      await revokeDelegation(
        delegationId,
        delegationKind.delegatedConsumer,
        ctx
      );
    },
    async getConsumerDelegators(
      filters: {
        delegatorName?: string;
        eserviceIds: EServiceId[];
        limit: number;
        offset: number;
      },
      { logger, authData }: WithLogger<AppContext<UIAuthData | M2MAuthData>>
    ): Promise<delegationApi.CompactTenants> {
      logger.info(
        `Retrieving consumer delegators with filters: ${JSON.stringify(
          filters
        )}`
      );

      return await readModelService.getConsumerDelegators({
        ...filters,
        delegateId: authData.organizationId,
      });
    },
    async getConsumerDelegatorsWithAgreements(
      filters: {
        delegatorName?: string;
        limit: number;
        offset: number;
      },
      { logger, authData }: WithLogger<AppContext<UIAuthData | M2MAuthData>>
    ): Promise<delegationApi.CompactTenants> {
      logger.info(
        `Retrieving consumer delegators with active agreements and filters: ${JSON.stringify(
          filters
        )}`
      );
      return await readModelService.getConsumerDelegatorsWithAgreements({
        ...filters,
        delegateId: authData.organizationId,
      });
    },
    async getConsumerEservices(
      filters: {
        delegatorId: TenantId;
        limit: number;
        offset: number;
        eserviceName?: string;
      },
      { logger, authData }: WithLogger<AppContext<UIAuthData | M2MAuthData>>
    ): Promise<delegationApi.CompactEServices> {
      logger.info(
        `Retrieving delegated consumer eservices with filters: ${JSON.stringify(
          filters
        )}`
      );

      return await readModelService.getConsumerEservices({
        ...filters,
        delegateId: authData.organizationId,
      });
    },
    async internalAddDelegationContract(
      delegationId: DelegationId,
      delegationContract: DelegationContractDocument,
      ctx: WithLogger<AppContext<AuthData>>
    ): Promise<WithMetadata<Delegation>> {
      return await internalAddDelegationContract(
        delegationId,
        delegationContract,
        ctx
      );
    },
    async internalAddDelegationSignedContract(
      delegationId: DelegationId,
      delegationContract: DelegationSignedContractDocument,
      ctx: WithLogger<AppContext<AuthData>>
    ): Promise<WithMetadata<Delegation>> {
      return await internalAddDelegationSignedContract(
        delegationId,
        delegationContract,
        ctx
      );
    },
  };
}

export type DelegationService = ReturnType<typeof delegationServiceBuilder>;
