/* eslint-disable functional/no-let */
import {
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import {
  CorrelationId,
  generateId,
  missingKafkaMessageDataError,
  Purpose,
  PurposeArchivedV2,
  PurposeEventEnvelopeV2,
  toPurposeV2,
} from "pagopa-interop-models";
import { beforeAll, describe, expect, it, vi, afterEach } from "vitest";
import { RefreshableInteropToken } from "pagopa-interop-commons";

const removePurposeFromClientsFn = vi.fn();

vi.doMock("pagopa-interop-api-clients", () => ({
  authorizationApi: {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    createClientApiClient: () => ({
      removePurposeFromClients: removePurposeFromClientsFn,
    }),
  },
}));

describe("PurposeArchived", () => {
  const correlationId: CorrelationId = generateId();

  const activeVersion = getMockPurposeVersion();

  const purpose: Purpose = {
    ...getMockPurpose(),
    versions: [activeVersion],
  };

  const testToken = "mockToken";

  const testHeaders = {
    "X-Correlation-Id": correlationId,
    Authorization: `Bearer ${testToken}`,
  };

  let mockRefreshableToken: RefreshableInteropToken;

  beforeAll(() => {
    mockRefreshableToken = {
      get: () => Promise.resolve({ serialized: testToken }),
    } as unknown as RefreshableInteropToken;
  });

  afterEach(() => {
    removePurposeFromClientsFn.mockClear();
  });

  it("The consumer should call the removePurposeFromClients route and remove the purpose from the client", async () => {
    const payload: PurposeArchivedV2 = {
      purpose: toPurposeV2(purpose),
      versionId: activeVersion.id,
    };

    const decodedKafkaMessage: PurposeEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: purpose.id,
      version: 2,
      type: "PurposeArchived",
      event_version: 2,
      data: payload,
      log_date: new Date(),
      correlation_id: correlationId,
    };

    const { handleMessageV2 } = await import(
      "../src/clientPurposeUpdaterConsumerServiceV2.js"
    );

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: Math.random(),
      offset: "10",
    });

    expect(removePurposeFromClientsFn).toHaveBeenCalledWith(undefined, {
      params: {
        purposeId: purpose.id,
      },
      headers: testHeaders,
    });
  });

  it("Should throw missingKafkaMessageDataError when purpose data is missing", async () => {
    const decodedKafkaMessage: PurposeEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: "stream-id",
      version: 2,
      type: "PurposeArchived",
      event_version: 2,
      data: { purpose: undefined, versionId: generateId() },
      log_date: new Date(),
      correlation_id: correlationId,
    };

    const { handleMessageV2 } = await import(
      "../src/clientPurposeUpdaterConsumerServiceV2.js"
    );

    await expect(
      handleMessageV2({
        decodedKafkaMessage,
        refreshableToken: mockRefreshableToken,
        partition: 0,
        offset: "10",
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeArchived")
    );
  });
});
