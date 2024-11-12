import { fail } from "assert";
import {
  decodeProtobufPayload,
  getMockDelegationProducer,
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
  fromDelegationV2,
  EServiceId,
  unsafeBrandId,
  DelegationContractId,
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
  readDelegationEventByVersion,
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
          who: TenantId;
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
          who: TenantId;
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
          who: generateId<TenantId>(),
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
          who: generateId<TenantId>(),
          when: rejectionOrRevokeDate,
        },
      },
    },
  ];
};

describe("revoke delegation", () => {
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
      ...getMockDelegationProducer({
        delegatorId,
        delegateId,
      }),
      eserviceId,
      approvedAt: delegationActivationDate,
      submittedAt: delegationCreationDate,
      stamps: {
        submission: {
          who: delegatorId,
          when: delegationCreationDate,
        },
        activation: {
          who: delegateId,
          when: delegationActivationDate,
        },
      },
    };

    await addOneDelegation(existentDelegation);

    const actualDelegation =
      await delegationProducerService.revokeProducerDelegation(
        existentDelegation.id,
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "DelegationServiceTest",
        }
      );

    const expectedContractFilePath = (
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    )[0];

    const documentId = unsafeBrandId<DelegationContractId>(
      expectedContractFilePath.split("/")[2]
    );

    const expectedDelegation: Delegation = {
      ...existentDelegation,
      state: delegationState.revoked,
      revokedAt: currentExecutionTime,
      stamps: {
        submission: {
          who: delegatorId,
          when: delegationCreationDate,
        },
        activation: {
          who: delegateId,
          when: delegationActivationDate,
        },
        revocation: {
          who: delegatorId,
          when: currentExecutionTime,
        },
      },
      revocationContract: {
        id: documentId,
        contentType: "application/pdf",
        createdAt: currentExecutionTime,
        name: `${formatDateyyyyMMddHHmmss(
          currentExecutionTime
        )}_delegation_revocation_contract.pdf`,
        path: expectedContractFilePath,
        prettyName: "Revoca della delega",
      },
    };

    expect(actualDelegation).toEqual(expectedDelegation);

    const actualContract = await fileManager.get(
      config.s3Bucket,
      expectedContractFilePath,
      genericLogger
    );

    const { path: expectedContractPath } =
      await contractBuilder.createActivationContract({
        delegation: actualDelegation,
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

    expect(flushPDFMetadata(actualContract, currentExecutionTime)).toEqual(
      flushPDFMetadata(expectedContract, currentExecutionTime)
    );

    const lastDelegationEvent = await readDelegationEventByVersion(
      actualDelegation.id,
      1
    );

    const delegationEventPayload = decodeProtobufPayload({
      messageType: ProducerDelegationRevokedV2,
      payload: lastDelegationEvent.data,
    }).delegation;
    if (!delegationEventPayload) {
      return fail("DelegationRevokedV2 payload not found");
    }

    const delegationFromLastEvent = fromDelegationV2(delegationEventPayload);

    expect(lastDelegationEvent.version).toBe("1");
    expect(delegationFromLastEvent).toMatchObject(expectedDelegation);
  });

  it("should throw an delegationNotFound if Delegation not exists", async () => {
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

  it("should throw an delegatorNotAllowToRevoke if Requester Id and DelegatorId are differents", async () => {
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
      ...getMockDelegationProducer({
        id: delegationId,
        delegateId,
      }),
      approvedAt: delegationApprovalDate,
      submittedAt: delegationCreationDate,
      stamps: {
        submission: {
          who: delegatorId,
          when: delegationCreationDate,
        },
        approval: {
          who: delegateId,
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
    "should throw an delegatorNotAllowToRevoke if delegation doesn't have revocable one of revocable states [Rejected,Revoked]",
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
        ...getMockDelegationProducer({
          delegatorId,
          delegateId,
        }),
        approvedAt: delegationActivationDate,
        submittedAt: delegationCreationDate,
        stamps: {
          submission: {
            who: delegatorId,
            when: delegationCreationDate,
          },
          activation: {
            who: delegateId,
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