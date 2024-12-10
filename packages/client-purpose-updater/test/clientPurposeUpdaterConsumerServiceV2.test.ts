/* eslint-disable functional/no-let */
import {
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test/index.js";
import {
  CorrelationId,
  generateId,
  Purpose,
  PurposeArchivedV2,
  PurposeEventEnvelopeV2,
  toPurposeV2,
} from "pagopa-interop-models";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { RefreshableInteropToken } from "pagopa-interop-commons";
import { handleMessageV2 } from "../src/clientPurposeUpdaterConsumerServiceV2.js";
import { getInteropBeClients } from "../src/clients/clientsProvider.js";

describe("PurposeArchived", async () => {
  const testCorrelationId: CorrelationId = generateId();
  const testToken = "mockToken";
  const testHeaders = {
    "X-Correlation-Id": testCorrelationId,
    Authorization: `Bearer ${testToken}`,
  };

  let mockRefreshableToken: RefreshableInteropToken;

  beforeAll(async () => {
    mockRefreshableToken = {
      get: () => Promise.resolve({ serialized: testToken }),
    } as RefreshableInteropToken;
  });

  beforeEach(async () => {
    // eslint-disable-next-line functional/immutable-data
    getInteropBeClients().authorizationClient.client.removePurposeFromClients =
      vi.fn();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it("The consumer should call the removePurposeFromClients route and remove the purpose from the client", async () => {
    const activeVersion = getMockPurposeVersion();

    const purpose: Purpose = {
      ...getMockPurpose(),
      versions: [activeVersion],
    };

    const updatedPurpose: Purpose = {
      ...purpose,
      versions: [
        { ...activeVersion, updatedAt: new Date(), state: "Archived" },
      ],
    };

    const payload: PurposeArchivedV2 = {
      purpose: toPurposeV2(updatedPurpose),
      versionId: activeVersion.id,
    };

    const decodedKafkaMessage: PurposeEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: updatedPurpose.id,
      version: 2,
      type: "PurposeArchived",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV2({
      decodedKafkaMessage,
      refreshableToken: mockRefreshableToken,
      partition: Math.random(),
      offset: "10",
    });

    expect(
      getInteropBeClients().authorizationClient.client.removePurposeFromClients
    ).toHaveBeenCalledWith(undefined, {
      params: {
        purposeId: purpose.id,
      },
      headers: testHeaders,
    });
  });
});
