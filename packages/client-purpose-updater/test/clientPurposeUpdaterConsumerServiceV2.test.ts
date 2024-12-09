import {
  getMockClient,
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test/index.js";
import {
  Client,
  Purpose,
  PurposeArchivedV2,
  PurposeEventEnvelopeV2,
  toPurposeV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  InteropTokenGenerator,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { handleMessageV2 } from "../src/clientPurposeUpdaterConsumerServiceV2.js";

describe("PurposeArchived", async () => {
  const refreshableTokenMock = new RefreshableInteropToken(
    {} as InteropTokenGenerator
  );

  it("The consumer should call the removePurposeFromClients route and remove the purpose from the client", async () => {
    const activeVersion = getMockPurposeVersion();

    const purpose: Purpose = {
      ...getMockPurpose(),
      versions: [activeVersion],
    };

    const clientWithPurpose: Client = {
      ...getMockClient(),
      purposes: [purpose.id],
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
      refreshableToken: refreshableTokenMock,
      partition: Math.random(),
      offset: "10",
    });

    const updatedClient: Client = {
      ...clientWithPurpose,
      purposes: [],
    };

    expect(clientWithPurpose).toEqual(updatedClient);
  });
});
