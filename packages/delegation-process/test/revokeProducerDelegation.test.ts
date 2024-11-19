import {
  decodeProtobufPayload,
  getMockDelegation,
  getMockEService,
  getMockTenant,
  getRandomAuthData,
} from "pagopa-interop-commons-test";
import {
  Delegation,
  DelegationId,
  ProducerDelegationRevokedV2,
  delegationState,
  generateId,
  TenantId,
  EServiceId,
  unsafeBrandId,
  DelegationContractId,
  delegationKind,
  UserId,
  toDelegationV2,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  formatDateyyyyMMddHHmmss,
  genericLogger,
} from "pagopa-interop-commons";
import {
  delegationNotFound,
  delegationNotRevokable,
  delegatorNotAllowToRevoke,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import { contractBuilder } from "../src/services/delegationContractBuilder.js";
import {
  addOneDelegation,
  addOneEservice,
  addOneTenant,
  delegationProducerService,
  fileManager,
  flushPDFMetadata,
  pdfGenerator,
  readLastDelegationEvent,
} from "./utils.js";

type DelegationStateSeed =
  | {
      delegationData: {
        state: "Rejected";
        rejectedAt: Date;
        rejectionReason: string;
      };
      stamps: {
        rejection: {
          who: UserId;
          when: Date;
        };
      };
    }
  | {
      delegationData: {
        state: "Revoked";
        revokedAt: Date;
      };
      stamps: {
        revocation: {
          who: UserId;
          when: Date;
        };
      };
    };

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getNotRevocableStateSeeds = (): DelegationStateSeed[] => {
  const rejectionOrRevokeDate = new Date();
  rejectionOrRevokeDate.setMonth(new Date().getMonth() - 1);

  return [
    {
      delegationData: {
        state: delegationState.rejected,
        rejectedAt: rejectionOrRevokeDate,
        rejectionReason: "Test is a test stop",
      },
      stamps: {
        rejection: {
          who: generateId<UserId>(),
          when: rejectionOrRevokeDate,
        },
      },
    },
    {
      delegationData: {
        state: delegationState.revoked,
        revokedAt: rejectionOrRevokeDate,
      },
      stamps: {
        revocation: {
          who: generateId<UserId>(),
          when: rejectionOrRevokeDate,
        },
      },
    },
  ];
};

describe("revoke producer delegation", () => {
  const TEST_EXECUTION_DATE = new Date();

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TEST_EXECUTION_DATE);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const notRevocableDelegationState = getNotRevocableStateSeeds();

  it("should revoke a delegation if it exists", async () => {
    const currentExecutionTime = new Date();
    const eserviceId = generateId<EServiceId>();
    const delegatorId = generateId<TenantId>();
    const delegateId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);

    const delegationCreationDate = new Date();
    delegationCreationDate.setMonth(currentExecutionTime.getMonth() - 2);

    const delegationActivationDate = new Date();
    delegationActivationDate.setMonth(currentExecutionTime.getMonth() - 1);

    const delegate = getMockTenant(delegateId);
    const delegator = getMockTenant(delegatorId);
    const eservice = getMockEService(eserviceId);

    await addOneTenant(delegate);
    await addOneTenant(delegator);
    await addOneEservice(eservice);

    const existentDelegation: Delegation = {
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegatorId,
        delegateId,
      }),
      eserviceId,
      approvedAt: delegationActivationDate,
      submittedAt: delegationCreationDate,
      stamps: {
        submission: {
          who: generateId<UserId>(),
          when: delegationCreationDate,
        },
        activation: {
          who: generateId<UserId>(),
          when: delegationActivationDate,
        },
      },
    };

    await addOneDelegation(existentDelegation);

    await delegationProducerService.revokeProducerDelegation(
      existentDelegation.id,
      {
        authData,
        logger: genericLogger,
        correlationId: generateId(),
        serviceName: "DelegationServiceTest",
      }
    );

    const event = await readLastDelegationEvent(existentDelegation.id);
    expect(event.version).toBe("1");

    const { delegation: actualDelegation } = decodeProtobufPayload({
      messageType: ProducerDelegationRevokedV2,
      payload: event.data,
    });

    const actualContractPath = (
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    )[0];

    const documentId = unsafeBrandId<DelegationContractId>(
      actualContractPath.split("/")[2]
    );

    const revokedDelegationWithoutContract: Delegation = {
      ...existentDelegation,
      state: delegationState.revoked,
      revokedAt: currentExecutionTime,
      stamps: {
        ...existentDelegation.stamps,
        revocation: {
          who: authData.userId,
          when: currentExecutionTime,
        },
      },
    };

    const expectedDelegation = toDelegationV2({
      ...revokedDelegationWithoutContract,
      revocationContract: {
        id: documentId,
        contentType: "application/pdf",
        createdAt: currentExecutionTime,
        name: `${formatDateyyyyMMddHHmmss(
          currentExecutionTime
        )}_delegation_revocation_contract.pdf`,
        path: actualContractPath,
        prettyName: "Revoca della delega",
      },
    });
    expect(actualDelegation).toEqual(expectedDelegation);

    const actualContract = await fileManager.get(
      config.s3Bucket,
      actualContractPath,
      genericLogger
    );

    const { path: expectedContractPath } =
      await contractBuilder.createRevocationContract({
        delegation: revokedDelegationWithoutContract,
        delegator,
        delegate,
        eservice,
        pdfGenerator,
        fileManager,
        config,
        logger: genericLogger,
      });

    const expectedContract = await fileManager.get(
      config.s3Bucket,
      expectedContractPath,
      genericLogger
    );

    // TODO fix this, it's not really working
    expect(flushPDFMetadata(actualContract, currentExecutionTime)).toEqual(
      flushPDFMetadata(expectedContract, currentExecutionTime)
    );
  });

  it("should throw a delegationNotFound if Delegation does not exist", async () => {
    const delegatorId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegationId = generateId<DelegationId>();
    await expect(
      delegationProducerService.revokeProducerDelegation(delegationId, {
        authData,
        logger: genericLogger,
        correlationId: generateId(),
        serviceName: "DelegationServiceTest",
      })
    ).rejects.toThrow(delegationNotFound(delegationId));
  });

  it("should throw a delegatorNotAllowToRevoke if Requester Id and DelegatorId are differents", async () => {
    const currentExecutionTime = new Date();

    const delegatorId = generateId<TenantId>();
    const delegateId = generateId<TenantId>();
    const authData = getRandomAuthData(delegatorId);
    const delegationId = generateId<DelegationId>();

    const delegationCreationDate = new Date();
    delegationCreationDate.setMonth(currentExecutionTime.getMonth() - 2);

    const delegationApprovalDate = new Date();
    delegationApprovalDate.setMonth(currentExecutionTime.getMonth() - 1);

    const existentDelegation = {
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
        id: delegationId,
        delegateId,
      }),
      approvedAt: delegationApprovalDate,
      submittedAt: delegationCreationDate,
      stamps: {
        submission: {
          who: generateId<UserId>(),
          when: delegationCreationDate,
        },
        approval: {
          who: generateId<UserId>(),
          when: delegationApprovalDate,
        },
      },
    };

    await addOneDelegation(existentDelegation);

    await expect(
      delegationProducerService.revokeProducerDelegation(delegationId, {
        authData,
        logger: genericLogger,
        correlationId: generateId(),
        serviceName: "DelegationServiceTest",
      })
    ).rejects.toThrow(delegatorNotAllowToRevoke(existentDelegation));
    vi.useRealTimers();
  });

  it.each(notRevocableDelegationState)(
    "should throw a delegatorNotAllowToRevoke if delegation doesn't have revocable one of revocable states [Rejected,Revoked]",
    async (notRevocableDelegationState: DelegationStateSeed) => {
      const currentExecutionTime = new Date();

      const delegatorId = generateId<TenantId>();
      const delegateId = generateId<TenantId>();
      const authData = getRandomAuthData(delegatorId);

      const delegationCreationDate = new Date();
      delegationCreationDate.setMonth(currentExecutionTime.getMonth() - 2);

      const delegationActivationDate = new Date();
      delegationActivationDate.setMonth(currentExecutionTime.getMonth() - 1);

      const existentDelegation: Delegation = {
        ...getMockDelegation({
          kind: delegationKind.delegatedProducer,
          delegatorId,
          delegateId,
        }),
        approvedAt: delegationActivationDate,
        submittedAt: delegationCreationDate,
        stamps: {
          submission: {
            who: generateId<UserId>(),
            when: delegationCreationDate,
          },
          activation: {
            who: generateId<UserId>(),
            when: delegationActivationDate,
          },
          ...notRevocableDelegationState.stamps,
        },
        ...notRevocableDelegationState.delegationData,
      };

      await addOneDelegation(existentDelegation);

      await expect(
        delegationProducerService.revokeProducerDelegation(
          existentDelegation.id,
          {
            authData,
            logger: genericLogger,
            correlationId: generateId(),
            serviceName: "DelegationServiceTest",
          }
        )
      ).rejects.toThrow(delegationNotRevokable(existentDelegation));
    }
  );
});
