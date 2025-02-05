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
} from "pagopa-interop-commons-test/index.js";
import { handleMessageV2 } from "../src/delegationItemsArchiverConsumerServiceV2.js";
import {
  AgreementProcessClient,
  PurposeProcessClient,
} from "../src/clients/clientsProvider.js";
import { addOneAgreement, addOnePurpose, readModelService } from "./utils.js";

const agreementProcessClient = {
  internalDeleteAgreementAfterDelegationRevocation: vi.fn(),
  internalArchiveAgreementAfterDelegationRevocation: vi.fn(),
} as unknown as AgreementProcessClient;
const purposeProcessClient = {
  internalDeletePurposeAfterDelegationRevocation: vi.fn(),
  internalArchivePurposeVersionAfterDelegationRevocation: vi.fn(),
} as unknown as PurposeProcessClient;

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

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      consumerId: delegation.delegatorId,
      delegationId: delegation.id,
      eserviceId: delegation.eserviceId,
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      consumerId: delegation.delegatorId,
      eserviceId: delegation.eserviceId,
    };

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
          ...mockPurpose,
          versions: [
            getMockPurposeVersion(purposeVersionState.draft),
            getMockPurposeVersion(purposeVersionState.waitingForApproval),
          ],
        };

        const purpose2: Purpose = {
          ...mockPurpose,
          versions: [getMockPurposeVersion(purposeVersionState.draft)],
        };

        const purpose3: Purpose = {
          ...mockPurpose,
          versions: [
            getMockPurposeVersion(purposeVersionState.waitingForApproval),
          ],
        };

        const agreement = {
          ...mockAgreement,
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

        [purpose1, purpose2, purpose3].forEach((purpose) => {
          expect(
            purposeProcessClient.internalDeletePurposeAfterDelegationRevocation
          ).toHaveBeenCalledWith(undefined, {
            params: { id: purpose.id },
            queries: { delegationId: delegation.id },
            headers: testHeaders,
          });
        });
        expect(
          purposeProcessClient.internalArchivePurposeVersionAfterDelegationRevocation
        ).not.toHaveBeenCalled();

        expect(
          agreementProcessClient.internalArchiveAgreementAfterDelegationRevocation
        ).toHaveBeenCalledWith(undefined, {
          params: { agreementId: agreement.id },
          queries: { delegationId: delegation.id },
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
          ...mockPurpose,
          versions: [getMockPurposeVersion(purposeVersionState.active)],
        };

        const purpose2: Purpose = {
          ...mockPurpose,
          versions: [getMockPurposeVersion(purposeVersionState.suspended)],
        };

        const agreement = {
          ...mockAgreement,
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

        [purpose1, purpose2].forEach((purpose) => {
          expect(
            purposeProcessClient.internalArchivePurposeVersionAfterDelegationRevocation
          ).toHaveBeenCalledWith(undefined, {
            params: {
              purposeId: purpose.id,
              versionId: purpose.versions[0].id,
            },
            queries: { delegationId: delegation.id },
            headers: testHeaders,
          });
        });
        expect(
          purposeProcessClient.internalDeletePurposeAfterDelegationRevocation
        ).not.toHaveBeenCalled();

        expect(
          agreementProcessClient.internalArchiveAgreementAfterDelegationRevocation
        ).toHaveBeenCalledWith(undefined, {
          params: { agreementId: agreement.id },
          queries: { delegationId: delegation.id },
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
        const agreement = {
          ...mockAgreement,
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
        ).toHaveBeenCalledWith(undefined, {
          params: { agreementId: agreement.id },
          queries: { delegationId: delegation.id },
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
        const agreement = {
          ...mockAgreement,
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
        ).toHaveBeenCalledWith(undefined, {
          params: { agreementId: agreement.id },
          queries: { delegationId: delegation.id },
          headers: testHeaders,
        });
        expect(
          agreementProcessClient.internalArchiveAgreementAfterDelegationRevocation
        ).not.toHaveBeenCalled();
      }
    );
  });
});
