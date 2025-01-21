/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/no-let */
import {
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
  getMockDelegation,
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test/index.js";
import { handleMessageV2 } from "../src/delegationItemsArchiverConsumerServiceV2.js";
import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { addOnePurpose, readModelService } from "./utils.js";

const mockClients = {
  agreementProcessClient: {},
  purposeProcessClient: {
    deletePurpose: vi.fn(),
    archivePurposeVersion: vi.fn(),
  },
} as unknown as PagoPAInteropBeClients;

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

    const mockPurpose = {
      ...getMockPurpose(),
      delegationId: delegation.id,
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

    it("The consumer should call the deletePurpose when the purpose is deletable", async () => {
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

      await addOnePurpose(purpose1);
      await addOnePurpose(purpose2);
      await addOnePurpose(purpose3);

      await handleMessageV2(
        {
          decodedMessage: decodedKafkaMessage,
          refreshableToken: mockRefreshableToken,
          partition: Math.random(),
          offset: "10",
          correlationId,
          logger: genericLogger,
          readModelService,
        },
        mockClients
      );

      [purpose1, purpose2, purpose3].forEach((purpose) => {
        expect(
          mockClients.purposeProcessClient.deletePurpose
        ).toHaveBeenCalledWith(undefined, {
          params: {
            id: purpose.id,
          },
          headers: testHeaders,
        });
      });
    });

    it("The consumer should call the deletePurpose when the purpose is archivable", async () => {
      const purpose1: Purpose = {
        ...mockPurpose,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };

      const purpose2: Purpose = {
        ...mockPurpose,
        versions: [getMockPurposeVersion(purposeVersionState.suspended)],
      };

      await addOnePurpose(purpose1);
      await addOnePurpose(purpose2);

      await handleMessageV2(
        {
          decodedMessage: decodedKafkaMessage,
          refreshableToken: mockRefreshableToken,
          partition: Math.random(),
          offset: "10",
          correlationId,
          logger: genericLogger,
          readModelService,
        },
        mockClients
      );

      [purpose1, purpose2].forEach((purpose) => {
        expect(
          mockClients.purposeProcessClient.archivePurposeVersion
        ).toHaveBeenCalledWith(undefined, {
          params: {
            purposeId: purpose.id,
            versionId: purpose.versions[0].id,
          },
          headers: testHeaders,
        });
      });
    });
  });
});
