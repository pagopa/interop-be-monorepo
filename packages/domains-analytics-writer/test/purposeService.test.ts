/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/immutable-data */

import { describe, it, expect, beforeEach } from "vitest";
import {
  PurposeCreatedV1,
  PurposeVersionCreatedV1,
  PurposeEventEnvelopeV1,
  PurposeAddedV2,
  NewPurposeVersionActivatedV2,
  PurposeEventEnvelopeV2,
  toPurposeV2,
  generateId,
} from "pagopa-interop-models";
import {
  getMockPurpose,
  getMockPurposeVersion,
  toPurposeV1,
  toPurposeVersionV1,
} from "pagopa-interop-commons-test";
import { handlePurposeMessageV1 } from "../src/handlers/purpose/consumerServiceV1.js";
import { handlePurposeMessageV2 } from "../src/handlers/purpose/consumerServiceV2.js";
import {
  dbContext,
  resetPurposeTables,
  getPurposeFromDb,
  getVersionFromDb,
} from "./utils.js";

describe("Purpose messages consumers - handlePurposeMessageV1", () => {
  beforeEach(async () => {
    await resetPurposeTables(dbContext);
  });

  it("PurposeCreated: inserts purpose with metadata_version", async () => {
    const mock = getMockPurpose();
    const payload: PurposeCreatedV1 = { purpose: toPurposeV1(mock) };
    const msg: PurposeEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      type: "PurposeCreated",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };

    await handlePurposeMessageV1([msg], dbContext);

    const stored = await getPurposeFromDb(mock.id, dbContext);
    expect(stored).toBeDefined();
    expect(stored.metadata_version).toBe(1);
  });

  it("PurposeVersionCreated: inserts version record", async () => {
    const mock = getMockPurpose();
    await handlePurposeMessageV1(
      [
        {
          sequence_num: 1,
          stream_id: mock.id,
          version: 1,
          type: "PurposeCreated",
          event_version: 1,
          data: { purpose: toPurposeV1(mock) } as any,
          log_date: new Date(),
        },
      ],
      dbContext,
    );

    const version = getMockPurposeVersion();
    const payload: PurposeVersionCreatedV1 = {
      purposeId: mock.id,
      version: toPurposeVersionV1(version),
    };
    const msg: PurposeEventEnvelopeV1 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      type: "PurposeVersionCreated",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };

    await handlePurposeMessageV1([msg], dbContext);

    const storedVer = await getVersionFromDb(version.id, dbContext);
    expect(storedVer).toBeDefined();
    expect(storedVer.metadata_version).toBe(2);
  });

  it("PurposeDeleted: marks purpose deleted", async () => {
    const mock = getMockPurpose();
    const createMsg: PurposeEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      type: "PurposeCreated",
      event_version: 1,
      data: { purpose: toPurposeV1(mock) } as any,
      log_date: new Date(),
    };
    await handlePurposeMessageV1([createMsg], dbContext);

    const deleteMsg: PurposeEventEnvelopeV1 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      type: "PurposeDeleted",
      event_version: 1,
      data: { purposeId: mock.id } as any,
      log_date: new Date(),
    };
    await handlePurposeMessageV1([deleteMsg], dbContext);

    const stored = await getPurposeFromDb(mock.id, dbContext);
    expect(stored.deleted).toBe(true);
  });

  it("PurposeVersionDeleted: marks version deleted", async () => {
    const mock = getMockPurpose();
    const versionId = generateId();
    console.log("AO ", mock);
    await handlePurposeMessageV1(
      [
        {
          sequence_num: 1,
          stream_id: mock.id,
          version: 1,
          type: "PurposeCreated",
          event_version: 1,
          data: { purpose: toPurposeV1(mock) } as any,
          log_date: new Date(),
        },
      ],
      dbContext,
    );
    const version = getMockPurposeVersion();
    version.id = versionId as any;
    await handlePurposeMessageV1(
      [
        {
          sequence_num: 2,
          stream_id: mock.id,
          version: 2,
          type: "PurposeVersionCreated",
          event_version: 1,
          data: {
            purposeId: mock.id,
            version: toPurposeVersionV1(version),
          } as any,
          log_date: new Date(),
        },
      ],
      dbContext,
    );

    const deleteVer: PurposeEventEnvelopeV1 = {
      sequence_num: 3,
      stream_id: mock.id,
      version: 3,
      type: "PurposeVersionDeleted",
      event_version: 1,
      data: { versionId: version.id } as any,
      log_date: new Date(),
    };
    await handlePurposeMessageV1([deleteVer], dbContext);

    const stored = await getVersionFromDb(version.id, dbContext);
    expect(stored.deleted).toBe(true);
  });

  it("should skip older metadata_version", async () => {
    const mock = getMockPurpose();
    const msgV1: PurposeEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      type: "PurposeCreated",
      event_version: 1,
      data: { purpose: toPurposeV1({ ...mock, title: "v1" }) } as any,
      log_date: new Date(),
    };
    await handlePurposeMessageV1([msgV1], dbContext);
    const stored = await getPurposeFromDb(mock.id, dbContext);
    expect(stored.title).toBe("v1");

    const msgV3 = {
      ...msgV1,
      version: 3,
      data: { purpose: toPurposeV1({ ...mock, title: "v3" }) } as any,
      sequence_num: 2,
    };
    await handlePurposeMessageV1([msgV3], dbContext);
    const stored2 = await getPurposeFromDb(mock.id, dbContext);
    expect(stored2.title).toBe("v3");

    const msgV2 = {
      ...msgV1,
      version: 2,
      data: { purpose: toPurposeV1({ ...mock, title: "v2" }) } as any,
      sequence_num: 3,
    };
    await handlePurposeMessageV1([msgV2], dbContext);
    const stored3 = await getPurposeFromDb(mock.id, dbContext);
    expect(stored3.title).toBe("v3");
  });
});

describe("Purpose messages consumers - handlePurposeMessageV2", () => {
  beforeEach(async () => {
    await resetPurposeTables(dbContext);
  });

  it("PurposeAdded: inserts purpose and version metadata_version=1", async () => {
    const mock = getMockPurpose();
    const payload: PurposeAddedV2 = { purpose: toPurposeV2(mock) };
    const msg: PurposeEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      type: "PurposeAdded",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };
    await handlePurposeMessageV2([msg], dbContext);

    const stored = await getPurposeFromDb(mock.id, dbContext);
    expect(stored.metadata_version).toBe(1);
  });

  it("DraftPurposeUpdated: upserts purpose metadata_version incremented", async () => {
    const mock = getMockPurpose();
    await handlePurposeMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: mock.id,
          version: 1,
          type: "PurposeAdded",
          event_version: 2,
          data: { purpose: toPurposeV2(mock) } as any,
          log_date: new Date(),
        },
      ],
      dbContext,
    );
    const updated = { ...mock, title: "updated" };
    const msg: PurposeEventEnvelopeV2 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      type: "DraftPurposeUpdated",
      event_version: 2,
      data: { purpose: toPurposeV2(updated) },
      log_date: new Date(),
    };
    await handlePurposeMessageV2([msg], dbContext);
    const stored = await getPurposeFromDb(mock.id, dbContext);
    expect(stored.title).toBe("updated");
    expect(stored.metadata_version).toBe(2);
  });

  it("DraftPurposeDeleted: marks purpose deleted", async () => {
    const mock = getMockPurpose();
    await handlePurposeMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: mock.id,
          version: 1,
          type: "PurposeAdded",
          event_version: 2,
          data: { purpose: toPurposeV2(mock) } as any,
          log_date: new Date(),
        },
      ],
      dbContext,
    );

    const msg: PurposeEventEnvelopeV2 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      type: "DraftPurposeDeleted",
      event_version: 2,
      data: { purpose: toPurposeV2(mock) } as any,
      log_date: new Date(),
    };
    await handlePurposeMessageV2([msg], dbContext);
    const stored = await getPurposeFromDb(mock.id, dbContext);
    expect(stored.deleted).toBe(true);
  });

  it("PurposeVersionCreated: inserts version record in V2", async () => {
    const mock = getMockPurpose();
    await handlePurposeMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: mock.id,
          version: 1,
          type: "PurposeAdded",
          event_version: 2,
          data: { purpose: toPurposeV2(mock) } as any,
          log_date: new Date(),
        },
      ],
      dbContext,
    );
    const version = getMockPurposeVersion();
    const payload: NewPurposeVersionActivatedV2 = {
      versionId: version.id,
      purpose: toPurposeV2(mock),
    };
    const msg: PurposeEventEnvelopeV2 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      type: "NewPurposeVersionActivated",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };
    await handlePurposeMessageV2([msg], dbContext);
    const storedVer = await getVersionFromDb(version.id, dbContext);
    expect(storedVer.metadata_version).toBe(2);
  });

  it("WaitingForApprovalPurposeVersionDeleted: marks version deleted", async () => {
    const mock = getMockPurpose();
    await handlePurposeMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: mock.id,
          version: 1,
          type: "PurposeAdded",
          event_version: 2,
          data: { purpose: toPurposeV2(mock) } as any,
          log_date: new Date(),
        },
      ],
      dbContext,
    );
    const version = getMockPurposeVersion();
    await handlePurposeMessageV2(
      [
        {
          sequence_num: 2,
          stream_id: mock.id,
          version: 2,
          type: "NewPurposeVersionActivated",
          event_version: 2,
          data: { versionId: version.id, purpose: toPurposeV2(mock) } as any,
          log_date: new Date(),
        },
      ],
      dbContext,
    );

    const msg: PurposeEventEnvelopeV2 = {
      sequence_num: 3,
      stream_id: mock.id,
      version: 3,
      type: "WaitingForApprovalPurposeVersionDeleted",
      event_version: 2,
      data: { versionId: version.id, purpose: toPurposeV2(mock) } as any,
      log_date: new Date(),
    };
    await handlePurposeMessageV2([msg], dbContext);
    const stored = await getVersionFromDb(version.id, dbContext);
    expect(stored.deleted).toBe(true);
  });
});
