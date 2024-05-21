import {
  getMockDescriptorPublished,
  getMockEService,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import { EServiceEventEnvelopeV2, toEServiceV2 } from "pagopa-interop-models";
import { describe, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { sendAuthUpdate } from "../src/index.js";
import { readModelService } from "./utils.js";

describe("Authorization Updater processMessage", () => {
  it("should correctly process catalog messages and send updates to the auth management", async () => {
    const descriptor = getMockDescriptorPublished();
    const eservice = { ...getMockEService(), descriptors: [descriptor] };
    const message: EServiceEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: eservice.id,
      version: 1,
      type: randomArrayItem([
        "EServiceDescriptorPublished",
        "EServiceDescriptorArchived",
        "EServiceDescriptorSuspended",
        "EServiceDescriptorActivated",
      ]),
      event_version: 2,
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: descriptor.id,
      },
      log_date: new Date(),
    } as EServiceEventEnvelopeV2;

    await sendAuthUpdate(
      message,
      readModelService,
      {} as any, // TODO instance of AuthorizationService,
      genericLogger,
      "test-correlation-id"
    );
  });
});
