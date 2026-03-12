/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/no-let */
import {
  Agreement,
  agreementState,
  ConsumerDelegationRevokedV2,
  CorrelationId,
  DelegationEventEnvelopeV2,
  delegationKind,
  delegationState,
  generateId,
  Purpose,
  purposeVersionState,
  toDelegationV2,
} from "pagopa-interop-models";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { genericLogger, RefreshableInteropToken } from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockDelegation,
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import { agreementApi, purposeApi } from "pagopa-interop-api-clients";
import { handleMessageV2 } from "../src/delegationItemsArchiverConsumerServiceV2.js";
import { addOneAgreement, addOnePurpose, readModelService } from "./utils.js";

const agreementProcessClient = {
  internalDeleteAgreementAfterDelegationRevocation: vi.fn(),
  internalArchiveAgreementAfterDelegationRevocation: vi.fn(),
} as unknown as agreementApi.AgreementProcessClient;
const purposeProcessClient = {
  internalDeletePurposeAfterDelegationRevocation: vi.fn(),
  internalArchivePurposeVersionAfterDelegationRevocation: vi.fn(),
} as unknown as purposeApi.PurposeProcessClient;

describe("delegationItemsArchiverConsumerServiceV2", () => {
  describe("ConsumerDelegationRevoked", () => {
    const correlationId: CorrelationId = generateId();
    const testToken = "mockToken";
    const testHeaders = {
      "X-Correlation-Id": correlationId,
      Authorization: `Bearer ${testToken}`,
    };

    let mockRefreshableToken: RefreshableInteropToken;

    const delegation = getMockDelegation({
      state: delegationState.revoked,
      kind: delegationKind.delegatedConsumer,
    });

    const payload: ConsumerDelegationRevokedV2 = {
      delegation: toDelegationV2(delegation),
    };

    const decodedKafkaMessage: DelegationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: delegation.id,
      version: 2,
      type: "ConsumerDelegationRevoked",
      event_version: 2,
      data: payload,
      log_date: new Date(),
      correlation_id: correlationId,
    };

    beforeAll(() => {
      mockRefreshableToken = {
        get: () => Promise.resolve({ serialized: testToken }),
      } as unknown as RefreshableInteropToken;
    });

    afterEach(() => {
      vi.clearAllMocks();
    });
    it.each([agreementState.suspended, agreementState.active])(
      "The consumer should call the deletePurpose when the purpose is deletable and should call archiveAgreement for the agreement in %s state",

      async (agreementState) => {
        const purpose1: Purpose = {
          ...getMockPurpose(),
          consumerId: delegation.delegatorId,
          delegationId: delegation.id,
          eserviceId: delegation.eserviceId,
          versions: [
            getMockPurposeVersion(purposeVersionState.draft),
            getMockPurposeVersion(purposeVersionState.waitingForApproval),
          ],
        };

        const purpose2: Purpose = {
          ...getMockPurpose(),
          consumerId: delegation.delegatorId,
          delegationId: delegation.id,
          eserviceId: delegation.eserviceId,
          versions: [getMockPurposeVersion(purposeVersionState.draft)],
        };

        const purpose3: Purpose = {
          ...getMockPurpose(),
          consumerId: delegation.delegatorId,
          delegationId: delegation.id,
          eserviceId: delegation.eserviceId,
          versions: [
            getMockPurposeVersion(purposeVersionState.waitingForApproval),
          ],
        };

        const agreement: Agreement = {
          ...getMockAgreement(),
          consumerId: delegation.delegatorId,
          eserviceId: delegation.eserviceId,
          state: agreementState,
        };

        await addOneAgreement(agreement);
        await addOnePurpose(purpose1);
        await addOnePurpose(purpose2);
        await addOnePurpose(purpose3);

        await handleMessageV2({
          decodedMessage: decodedKafkaMessage,
          refreshableToken: mockRefreshableToken,
          partition: Math.random(),
          offset: "10",
          correlationId,
          logger: genericLogger,
          readModelService,
          agreementProcessClient,
          purposeProcessClient,
        });

        expect(
          purposeProcessClient.internalDeletePurposeAfterDelegationRevocation
        ).toHaveBeenCalledTimes(3);
        [purpose1, purpose2, purpose3].forEach((purpose) => {
          expect(
            purposeProcessClient.internalDeletePurposeAfterDelegationRevocation
          ).toHaveBeenCalledWith(undefined, {
            params: { id: purpose.id, delegationId: delegation.id },
            headers: testHeaders,
          });
        });
        expect(
          purposeProcessClient.internalArchivePurposeVersionAfterDelegationRevocation
        ).not.toHaveBeenCalled();

        expect(
          agreementProcessClient.internalArchiveAgreementAfterDelegationRevocation
        ).toHaveBeenCalledOnce();
        expect(
          agreementProcessClient.internalArchiveAgreementAfterDelegationRevocation
        ).toHaveBeenCalledWith(undefined, {
          params: { agreementId: agreement.id, delegationId: delegation.id },
          headers: testHeaders,
        });
        expect(
          agreementProcessClient.internalDeleteAgreementAfterDelegationRevocation
        ).not.toHaveBeenCalled();
      }
    );
    it.each([agreementState.suspended, agreementState.active])(
      "The consumer should call the archivePurposeVersion when the purpose is archivable and should call archiveAgreement for the agreement in %s state",
      async (agreementState) => {
        const purpose1: Purpose = {
          ...getMockPurpose(),
          consumerId: delegation.delegatorId,
          delegationId: delegation.id,
          eserviceId: delegation.eserviceId,
          versions: [getMockPurposeVersion(purposeVersionState.active)],
        };

        const purpose2: Purpose = {
          ...getMockPurpose(),
          consumerId: delegation.delegatorId,
          delegationId: delegation.id,
          eserviceId: delegation.eserviceId,
          versions: [getMockPurposeVersion(purposeVersionState.suspended)],
        };

        const agreement: Agreement = {
          ...getMockAgreement(),
          consumerId: delegation.delegatorId,
          eserviceId: delegation.eserviceId,
          state: agreementState,
        };

        await addOneAgreement(agreement);
        await addOnePurpose(purpose1);
        await addOnePurpose(purpose2);

        await handleMessageV2({
          decodedMessage: decodedKafkaMessage,
          refreshableToken: mockRefreshableToken,
          partition: Math.random(),
          offset: "10",
          correlationId,
          logger: genericLogger,
          readModelService,
          agreementProcessClient,
          purposeProcessClient,
        });

        expect(
          purposeProcessClient.internalArchivePurposeVersionAfterDelegationRevocation
        ).toHaveBeenCalledTimes(2);
        [purpose1, purpose2].forEach((purpose) => {
          expect(
            purposeProcessClient.internalArchivePurposeVersionAfterDelegationRevocation
          ).toHaveBeenCalledWith(undefined, {
            params: {
              purposeId: purpose.id,
              versionId: purpose.versions[0].id,
              delegationId: delegation.id,
            },
            headers: testHeaders,
          });
        });
        expect(
          purposeProcessClient.internalDeletePurposeAfterDelegationRevocation
        ).not.toHaveBeenCalled();

        expect(
          agreementProcessClient.internalArchiveAgreementAfterDelegationRevocation
        ).toHaveBeenCalledOnce();
        expect(
          agreementProcessClient.internalArchiveAgreementAfterDelegationRevocation
        ).toHaveBeenCalledWith(undefined, {
          params: { agreementId: agreement.id, delegationId: delegation.id },
          headers: testHeaders,
        });
        expect(
          agreementProcessClient.internalDeleteAgreementAfterDelegationRevocation
        ).not.toHaveBeenCalled();
      }
    );
    it.each([agreementState.active, agreementState.suspended])(
      "The consumer should call the archiveAgreement for the agreement in %s state and there are no purposes",
      async (state) => {
        const agreement: Agreement = {
          ...getMockAgreement(),
          consumerId: delegation.delegatorId,
          eserviceId: delegation.eserviceId,
          state,
        };

        await addOneAgreement(agreement);

        await handleMessageV2({
          decodedMessage: decodedKafkaMessage,
          refreshableToken: mockRefreshableToken,
          partition: Math.random(),
          offset: "10",
          correlationId,
          logger: genericLogger,
          readModelService,
          agreementProcessClient,
          purposeProcessClient,
        });

        expect(
          purposeProcessClient.internalArchivePurposeVersionAfterDelegationRevocation
        ).not.toHaveBeenCalled();
        expect(
          purposeProcessClient.internalDeletePurposeAfterDelegationRevocation
        ).not.toHaveBeenCalled();

        expect(
          agreementProcessClient.internalArchiveAgreementAfterDelegationRevocation
        ).toHaveBeenCalledOnce();
        expect(
          agreementProcessClient.internalArchiveAgreementAfterDelegationRevocation
        ).toHaveBeenCalledWith(undefined, {
          params: { agreementId: agreement.id, delegationId: delegation.id },
          headers: testHeaders,
        });
        expect(
          agreementProcessClient.internalDeleteAgreementAfterDelegationRevocation
        ).not.toHaveBeenCalled();
      }
    );
    it.each([
      agreementState.draft,
      agreementState.missingCertifiedAttributes,
      agreementState.pending,
    ])(
      "The consumer should call deleteAgreement when the agreement is in %s state",
      async (state) => {
        const agreement: Agreement = {
          ...getMockAgreement(),
          consumerId: delegation.delegatorId,
          eserviceId: delegation.eserviceId,
          state,
        };

        await addOneAgreement(agreement);

        await handleMessageV2({
          decodedMessage: decodedKafkaMessage,
          refreshableToken: mockRefreshableToken,
          partition: Math.random(),
          offset: "10",
          correlationId,
          logger: genericLogger,
          readModelService,
          agreementProcessClient,
          purposeProcessClient,
        });

        expect(
          purposeProcessClient.internalArchivePurposeVersionAfterDelegationRevocation
        ).not.toHaveBeenCalled();
        expect(
          purposeProcessClient.internalDeletePurposeAfterDelegationRevocation
        ).not.toHaveBeenCalled();

        expect(
          agreementProcessClient.internalDeleteAgreementAfterDelegationRevocation
        ).toHaveBeenCalledOnce();
        expect(
          agreementProcessClient.internalDeleteAgreementAfterDelegationRevocation
        ).toHaveBeenCalledWith(undefined, {
          params: { agreementId: agreement.id, delegationId: delegation.id },
          headers: testHeaders,
        });
        expect(
          agreementProcessClient.internalArchiveAgreementAfterDelegationRevocation
        ).not.toHaveBeenCalled();
      }
    );
    it("The consumer should call the proper routes if there are more than one agreement and purposes", async () => {
      const agreement1: Agreement = {
        ...getMockAgreement(),
        consumerId: delegation.delegatorId,
        eserviceId: delegation.eserviceId,
        state: agreementState.active,
      };

      const agreement2: Agreement = {
        ...getMockAgreement(),
        consumerId: delegation.delegatorId,
        eserviceId: delegation.eserviceId,
        state: agreementState.pending,
      };

      const purpose1: Purpose = {
        ...getMockPurpose(),
        consumerId: delegation.delegatorId,
        delegationId: delegation.id,
        eserviceId: delegation.eserviceId,
        title: "Purpose 1", // Setting title because there can't be two purposes with the same title for the same consumer and eservice
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };

      const purpose2: Purpose = {
        ...getMockPurpose(),
        consumerId: delegation.delegatorId,
        delegationId: delegation.id,
        eserviceId: delegation.eserviceId,
        title: "Purpose 2",
        versions: [getMockPurposeVersion(purposeVersionState.suspended)],
      };

      const purpose3: Purpose = {
        ...getMockPurpose(),
        consumerId: delegation.delegatorId,
        delegationId: delegation.id,
        eserviceId: delegation.eserviceId,
        title: "Purpose 3",
        versions: [getMockPurposeVersion(purposeVersionState.draft)],
      };

      const purpose4: Purpose = {
        ...getMockPurpose(),
        consumerId: delegation.delegatorId,
        delegationId: delegation.id,
        eserviceId: delegation.eserviceId,
        title: "Purpose 3",
        versions: [getMockPurposeVersion(purposeVersionState.rejected)],
      };

      const purpose5: Purpose = {
        ...getMockPurpose(),
        consumerId: delegation.delegatorId,
        delegationId: delegation.id,
        eserviceId: delegation.eserviceId,
        title: "Purpose 3",
        versions: [
          getMockPurposeVersion(purposeVersionState.waitingForApproval),
        ],
      };

      const purpose6: Purpose = {
        ...getMockPurpose(),
        consumerId: delegation.delegatorId,
        delegationId: delegation.id,
        eserviceId: delegation.eserviceId,
        title: "Purpose 3",
        versions: [getMockPurposeVersion(purposeVersionState.archived)],
      };

      await addOneAgreement(agreement1);
      await addOneAgreement(agreement2);
      await addOnePurpose(purpose1);
      await addOnePurpose(purpose2);
      await addOnePurpose(purpose3);
      await addOnePurpose(purpose4);
      await addOnePurpose(purpose5);
      await addOnePurpose(purpose6);

      await handleMessageV2({
        decodedMessage: decodedKafkaMessage,
        refreshableToken: mockRefreshableToken,
        partition: Math.random(),
        offset: "10",
        correlationId,
        logger: genericLogger,
        readModelService,
        agreementProcessClient,
        purposeProcessClient,
      });

      expect(
        purposeProcessClient.internalArchivePurposeVersionAfterDelegationRevocation
      ).toHaveBeenCalledTimes(2);
      expect(
        purposeProcessClient.internalArchivePurposeVersionAfterDelegationRevocation
      ).toHaveBeenCalledWith(undefined, {
        params: {
          purposeId: purpose1.id,
          versionId: purpose1.versions[0].id,
          delegationId: delegation.id,
        },
        headers: testHeaders,
      });
      expect(
        purposeProcessClient.internalArchivePurposeVersionAfterDelegationRevocation
      ).toHaveBeenCalledWith(undefined, {
        params: {
          purposeId: purpose2.id,
          versionId: purpose2.versions[0].id,
          delegationId: delegation.id,
        },
        headers: testHeaders,
      });

      expect(
        purposeProcessClient.internalDeletePurposeAfterDelegationRevocation
      ).toHaveBeenCalledTimes(2);
      expect(
        purposeProcessClient.internalDeletePurposeAfterDelegationRevocation
      ).toHaveBeenCalledWith(undefined, {
        params: { id: purpose3.id, delegationId: delegation.id },
        headers: testHeaders,
      });
      expect(
        purposeProcessClient.internalDeletePurposeAfterDelegationRevocation
      ).toHaveBeenCalledWith(undefined, {
        params: { id: purpose5.id, delegationId: delegation.id },
        headers: testHeaders,
      });

      expect(
        agreementProcessClient.internalArchiveAgreementAfterDelegationRevocation
      ).toHaveBeenCalledOnce();
      expect(
        agreementProcessClient.internalArchiveAgreementAfterDelegationRevocation
      ).toHaveBeenCalledWith(undefined, {
        params: { agreementId: agreement1.id, delegationId: delegation.id },
        headers: testHeaders,
      });

      expect(
        agreementProcessClient.internalDeleteAgreementAfterDelegationRevocation
      ).toHaveBeenCalledOnce();
      expect(
        agreementProcessClient.internalDeleteAgreementAfterDelegationRevocation
      ).toHaveBeenCalledWith(undefined, {
        params: { agreementId: agreement2.id, delegationId: delegation.id },
        headers: testHeaders,
      });
    });
  });
});
