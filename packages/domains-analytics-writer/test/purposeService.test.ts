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
  DelegationId,
  PurposeRiskAnalysisForm,
  RiskAnalysisId,
  tenantKind,
} from "pagopa-interop-models";
import {
  getMockPurpose,
  getMockPurposeVersion,
  getMockValidRiskAnalysisForm,
  toPurposeV1,
  toPurposeVersionV1,
} from "pagopa-interop-commons-test";
import { handlePurposeMessageV1 } from "../src/handlers/purpose/consumerServiceV1.js";
import { handlePurposeMessageV2 } from "../src/handlers/purpose/consumerServiceV2.js";
import {
  dbContext,
  resetPurposeTables,
  getPurposeFromDb,
  getPurposeVersionFromDb,
  getVersionDocumentsFromDb,
  getPurposeRiskAnalysisAnswerByPurposeIdFromDb,
  getPurposeRiskAnalysisByPurposeIdFromDb,
} from "./utils.js";

describe("Purpose messages consumers - handlePurposeMessageV1", () => {
  beforeEach(async () => {
    await resetPurposeTables(dbContext);
  });

  it("PurposeCreated: inserts purpose with mutiple versions and its sub-objects", async () => {
    const purposeRiskAnalysisForm: PurposeRiskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(tenantKind.PA),
      riskAnalysisId: generateId<RiskAnalysisId>(),
    };

    const mockPurpose = {
      ...getMockPurpose(),
      delegationId: generateId<DelegationId>(),
      suspendedByConsumer: false,
      suspendedByProducer: false,
      updatedAt: new Date(),
      freeOfChargeReason: "Free of charge reason",
      riskAnalysisForm: purposeRiskAnalysisForm,
      versions: [getMockPurposeVersion()],
    };
    const payload: PurposeCreatedV1 = { purpose: toPurposeV1(mockPurpose) };
    const msg: PurposeEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      type: "PurposeCreated",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };

    await handlePurposeMessageV1([msg], dbContext);

    const stored = await getPurposeFromDb(mockPurpose.id, dbContext);
    expect(stored).toBeDefined();

    for (const version of mockPurpose.versions) {
      const versionStored = await getPurposeVersionFromDb(
        version.id,
        dbContext
      );
      expect(versionStored).toBeDefined();

      const versionDocumentStored = await getVersionDocumentsFromDb(
        version.id,
        dbContext
      );
      expect(versionDocumentStored.length).toBeGreaterThan(0);

      const riskAnalysisStored = await getPurposeRiskAnalysisByPurposeIdFromDb(
        mockPurpose.id,
        dbContext
      );

      expect(riskAnalysisStored.length).toBeGreaterThan(0);

      const riskAnalysisAnswerStored =
        await getPurposeRiskAnalysisAnswerByPurposeIdFromDb(
          mockPurpose.id,
          dbContext
        );
      expect(riskAnalysisAnswerStored.length).toBeGreaterThan(0);
    }
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
      dbContext
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

    const storedVer = await getPurposeVersionFromDb(version.id, dbContext);
    expect(storedVer).toBeDefined();
    expect(storedVer.metadata_version).toBe(2);
  });

  it("PurposeDeleted: marks purpose and its subobject as deleted", async () => {
    const purposeRiskAnalysisForm: PurposeRiskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(tenantKind.PA),
      riskAnalysisId: generateId<RiskAnalysisId>(),
    };

    const mockPurpose = {
      ...getMockPurpose(),
      delegationId: generateId<DelegationId>(),
      suspendedByConsumer: false,
      suspendedByProducer: false,
      updatedAt: new Date(),
      freeOfChargeReason: "Free of charge reason",
      riskAnalysisForm: purposeRiskAnalysisForm,
      versions: [getMockPurposeVersion(), getMockPurposeVersion()],
    };
    const createMsg: PurposeEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      type: "PurposeCreated",
      event_version: 1,
      data: { purpose: toPurposeV1(mockPurpose) } as any,
      log_date: new Date(),
    };
    await handlePurposeMessageV1([createMsg], dbContext);

    const deleteMsg: PurposeEventEnvelopeV1 = {
      sequence_num: 2,
      stream_id: mockPurpose.id,
      version: 2,
      type: "PurposeDeleted",
      event_version: 1,
      data: { purposeId: mockPurpose.id } as any,
      log_date: new Date(),
    };
    await handlePurposeMessageV1([deleteMsg], dbContext);

    const stored = await getPurposeFromDb(mockPurpose.id, dbContext);
    expect(stored.deleted).toBe(true);
    expect(mockPurpose.versions.length).toBeGreaterThan(0);
    for (const version of mockPurpose.versions) {
      const versionStored = await getPurposeVersionFromDb(
        version.id,
        dbContext
      );
      expect(versionStored.deleted).toBe(true);

      const versionDocumentStored = await getVersionDocumentsFromDb(
        version.id,
        dbContext
      );

      expect(versionDocumentStored.length).toBeGreaterThan(0);

      expect(
        versionDocumentStored.forEach((r: { deleted: boolean }) =>
          expect(r.deleted).toBe(true)
        )
      );
    }

    const riskAnalysisStored = await getPurposeRiskAnalysisByPurposeIdFromDb(
      mockPurpose.id,
      dbContext
    );

    expect(
      riskAnalysisStored.forEach((r: { deleted: boolean }) =>
        expect(r.deleted).toBe(true)
      )
    );

    const riskAnalysisAnswerStored =
      await getPurposeRiskAnalysisAnswerByPurposeIdFromDb(
        mockPurpose.id,
        dbContext
      );

    expect(
      riskAnalysisAnswerStored.forEach((r: { deleted: boolean }) =>
        expect(r.deleted).toBe(true)
      )
    );
  });

  it("PurposeVersionDeleted: marks version deleted", async () => {
    const mock = getMockPurpose();
    const versionId = generateId();
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
      dbContext
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
      dbContext
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
    const purposeStored = await getPurposeFromDb(mock.id, dbContext);

    expect(purposeStored.deleted).toBeFalsy();

    for (const version of mock.versions) {
      const versionStored = await getPurposeVersionFromDb(
        version.id,
        dbContext
      );
      expect(versionStored.deleted).toBe(true);

      const versionDocumentStored = await getVersionDocumentsFromDb(
        version.id,
        dbContext
      );

      expect(versionDocumentStored.length).toBeGreaterThan(0);

      expect(
        versionDocumentStored.forEach((r: { deleted: boolean }) =>
          expect(r.deleted).toBe(true)
        )
      );
    }
  });
});

describe("Purpose messages consumers - handlePurposeMessageV2", () => {
  beforeEach(async () => {
    await resetPurposeTables(dbContext);
  });

  it("PurposeCreated: inserts purpose with mutiple versions and its sub-objects", async () => {
    const purposeRiskAnalysisForm: PurposeRiskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(tenantKind.PA),
      riskAnalysisId: generateId<RiskAnalysisId>(),
    };

    const mockPurpose = {
      ...getMockPurpose(),
      delegationId: generateId<DelegationId>(),
      suspendedByConsumer: false,
      suspendedByProducer: false,
      updatedAt: new Date(),
      freeOfChargeReason: "Free of charge reason",
      riskAnalysisForm: purposeRiskAnalysisForm,
      versions: [getMockPurposeVersion()],
    };
    const payload: PurposeAddedV2 = { purpose: toPurposeV2(mockPurpose) };
    const msg: PurposeEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      type: "PurposeAdded",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    await handlePurposeMessageV2([msg], dbContext);

    const stored = await getPurposeFromDb(mockPurpose.id, dbContext);
    expect(stored).toBeDefined();

    for (const version of mockPurpose.versions) {
      const versionStored = await getPurposeVersionFromDb(
        version.id,
        dbContext
      );
      expect(versionStored).toBeDefined();

      const versionDocumentStored = await getVersionDocumentsFromDb(
        version.id,
        dbContext
      );
      expect(versionDocumentStored.length).toBeGreaterThan(0);

      const riskAnalysisStored = await getPurposeRiskAnalysisByPurposeIdFromDb(
        mockPurpose.id,
        dbContext
      );

      expect(riskAnalysisStored.length).toBeGreaterThan(0);

      const riskAnalysisAnswerStored =
        await getPurposeRiskAnalysisAnswerByPurposeIdFromDb(
          mockPurpose.id,
          dbContext
        );
      expect(riskAnalysisAnswerStored.length).toBeGreaterThan(0);
    }
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
      dbContext
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

  it("DraftPurposeDeleted: marks purpose and all its subobjects deleted", async () => {
    const purposeRiskAnalysisForm: PurposeRiskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(tenantKind.PA),
      riskAnalysisId: generateId<RiskAnalysisId>(),
    };

    const mockPurpose = {
      ...getMockPurpose(),
      delegationId: generateId<DelegationId>(),
      suspendedByConsumer: false,
      suspendedByProducer: false,
      updatedAt: new Date(),
      freeOfChargeReason: "Free of charge reason",
      riskAnalysisForm: purposeRiskAnalysisForm,
      versions: [getMockPurposeVersion(), getMockPurposeVersion()],
    };
    await handlePurposeMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: mockPurpose.id,
          version: 1,
          type: "PurposeAdded",
          event_version: 2,
          data: { purpose: toPurposeV2(mockPurpose) } as any,
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const msg: PurposeEventEnvelopeV2 = {
      sequence_num: 2,
      stream_id: mockPurpose.id,
      version: 2,
      type: "DraftPurposeDeleted",
      event_version: 2,
      data: { purpose: toPurposeV2(mockPurpose) } as any,
      log_date: new Date(),
    };
    await handlePurposeMessageV2([msg], dbContext);
    const stored = await getPurposeFromDb(mockPurpose.id, dbContext);
    expect(stored.deleted).toBe(true);
    expect(mockPurpose.versions.length).toBeGreaterThan(0);

    for (const version of mockPurpose.versions) {
      const versionStored = await getPurposeVersionFromDb(
        version.id,
        dbContext
      );
      expect(versionStored.deleted).toBe(true);

      const versionDocumentStored = await getVersionDocumentsFromDb(
        version.id,
        dbContext
      );

      expect(versionDocumentStored.length).toBeGreaterThan(0);

      expect(
        versionDocumentStored.forEach((r: { deleted: boolean }) =>
          expect(r.deleted).toBe(true)
        )
      );
    }

    const riskAnalysisStored = await getPurposeRiskAnalysisByPurposeIdFromDb(
      mockPurpose.id,
      dbContext
    );

    expect(
      riskAnalysisStored.forEach((r: { deleted: boolean }) =>
        expect(r.deleted).toBe(true)
      )
    );

    const riskAnalysisAnswerStored =
      await getPurposeRiskAnalysisAnswerByPurposeIdFromDb(
        mockPurpose.id,
        dbContext
      );

    expect(
      riskAnalysisAnswerStored.forEach((r: { deleted: boolean }) =>
        expect(r.deleted).toBe(true)
      )
    );
  });

  it("NewPurposeVersionActivated: adds a version on a existing purpose", async () => {
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
      dbContext
    );
    const version = getMockPurposeVersion();
    mock.versions.push(version);

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
    const storedVer = await getPurposeVersionFromDb(version.id, dbContext);
    expect(storedVer).toBeDefined();
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
      dbContext
    );
    const version = getMockPurposeVersion();
    mock.versions.push(version);
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
      dbContext
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

    const purposeStored = await getPurposeFromDb(mock.id, dbContext);

    expect(purposeStored.deleted).toBeFalsy();

    for (const version of mock.versions) {
      const versionStored = await getPurposeVersionFromDb(
        version.id,
        dbContext
      );
      expect(versionStored.deleted).toBe(true);

      const versionDocumentStored = await getVersionDocumentsFromDb(
        version.id,
        dbContext
      );

      expect(versionDocumentStored.length).toBeGreaterThan(0);

      expect(
        versionDocumentStored.forEach((r: { deleted: boolean }) =>
          expect(r.deleted).toBe(true)
        )
      );
    }
  });
});

describe("Check on metadata_version merge - Purpose", () => {
  beforeEach(async () => {
    await resetPurposeTables(dbContext);
  });

  it("should skip update when incoming metadata_version is lower or equal", async () => {
    const mock = getMockPurpose();

    const msgV1: PurposeEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      type: "PurposeCreated",
      event_version: 1,
      data: { purpose: toPurposeV1({ ...mock, title: "Title v1" }) },
      log_date: new Date(),
    };

    await handlePurposeMessageV1([msgV1], dbContext);
    const stored1 = await getPurposeFromDb(mock.id, dbContext);
    expect(stored1.title).toBe("Title v1");
    expect(stored1.metadata_version).toBe(1);

    const msgV3 = {
      ...msgV1,
      version: 3,
      sequence_num: 2,
      data: { purpose: toPurposeV1({ ...mock, title: "Title v3" }) },
    };
    await handlePurposeMessageV1([msgV3], dbContext);
    const stored2 = await getPurposeFromDb(mock.id, dbContext);
    expect(stored2.title).toBe("Title v3");
    expect(stored2.metadata_version).toBe(3);

    const msgV2 = {
      ...msgV1,
      version: 2,
      sequence_num: 3,
      data: { purpose: toPurposeV1({ ...mock, title: "Title v2" }) },
    };
    await handlePurposeMessageV1([msgV2], dbContext);
    const stored3 = await getPurposeFromDb(mock.id, dbContext);
    expect(stored3.title).toBe("Title v3");
    expect(stored3.metadata_version).toBe(3);
  });

  it("should apply update when incoming metadata_version is greater", async () => {
    const mock = getMockPurpose();

    const msgV2: PurposeEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 2,
      type: "PurposeCreated",
      event_version: 1,
      data: { purpose: toPurposeV1({ ...mock, title: "Title v2" }) },
      log_date: new Date(),
    };
    await handlePurposeMessageV1([msgV2], dbContext);

    const stored = await getPurposeFromDb(mock.id, dbContext);
    expect(stored.title).toBe("Title v2");
    expect(stored.metadata_version).toBe(2);
  });
});
