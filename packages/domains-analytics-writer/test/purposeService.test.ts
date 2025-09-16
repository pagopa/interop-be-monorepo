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
  purposeVersionState,
} from "pagopa-interop-models";
import {
  getMockPurpose,
  getMockPurposeVersion,
  getMockPurposeVersionStamps,
  getMockValidRiskAnalysisForm,
  toPurposeV1,
  toPurposeVersionV1,
} from "pagopa-interop-commons-test";
import { handlePurposeMessageV1 } from "../src/handlers/purpose/consumerServiceV1.js";
import { handlePurposeMessageV2 } from "../src/handlers/purpose/consumerServiceV2.js";
import { PurposeDbTable } from "../src/model/db/purpose.js";
import {
  dbContext,
  getManyFromDb,
  getOneFromDb,
  purposeTables,
  resetTargetTables,
} from "./utils.js";

describe("Purpose messages consumers - handlePurposeMessageV1", () => {
  beforeEach(async () => {
    await resetTargetTables(purposeTables);
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

    const stored = await getOneFromDb(dbContext, PurposeDbTable.purpose, {
      id: mockPurpose.id,
    });
    expect(stored).toBeDefined();

    for (const version of mockPurpose.versions) {
      const versionStored = await getOneFromDb(
        dbContext,
        PurposeDbTable.purpose_version,
        { id: version.id }
      );
      expect(versionStored).toBeDefined();

      const versionDocumentStored = await getManyFromDb(
        dbContext,
        PurposeDbTable.purpose_version_document,
        { purposeVersionId: version.id }
      );
      expect(versionDocumentStored.length).toBeGreaterThan(0);

      const riskAnalysisStored = await getManyFromDb(
        dbContext,
        PurposeDbTable.purpose_risk_analysis_form,
        { purposeId: mockPurpose.id }
      );

      expect(riskAnalysisStored.length).toBeGreaterThan(0);

      const riskAnalysisAnswerStored = await getManyFromDb(
        dbContext,
        PurposeDbTable.purpose_risk_analysis_answer,
        { purposeId: mockPurpose.id }
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

    const storedVer = await getOneFromDb(
      dbContext,
      PurposeDbTable.purpose_version,
      { id: version.id }
    );
    expect(storedVer).toBeDefined();
    expect(storedVer?.metadataVersion).toBe(2);
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

    const stored = await getOneFromDb(dbContext, PurposeDbTable.purpose, {
      id: mockPurpose.id,
    });
    expect(stored?.deleted).toBe(true);
    expect(mockPurpose.versions.length).toBeGreaterThan(0);
    for (const version of mockPurpose.versions) {
      const versionStored = await getOneFromDb(
        dbContext,
        PurposeDbTable.purpose_version,
        { id: version.id }
      );
      expect(versionStored?.deleted).toBe(true);

      const versionDocumentStored = await getManyFromDb(
        dbContext,
        PurposeDbTable.purpose_version_document,
        { purposeVersionId: version.id }
      );
      expect(versionDocumentStored.length).toBeGreaterThan(0);

      expect(
        versionDocumentStored.forEach((r) => expect(r.deleted).toBe(true))
      );
    }

    const riskAnalysisStored = await getManyFromDb(
      dbContext,
      PurposeDbTable.purpose_risk_analysis_form,
      { purposeId: mockPurpose.id }
    );

    expect(riskAnalysisStored.forEach((r) => expect(r.deleted).toBe(true)));

    const riskAnalysisAnswerStored = await getManyFromDb(
      dbContext,
      PurposeDbTable.purpose_risk_analysis_answer,
      { purposeId: mockPurpose.id }
    );

    expect(
      riskAnalysisAnswerStored.forEach((r) => expect(r.deleted).toBe(true))
    );
  });

  it("PurposeVersionDeleted: delete purpose version", async () => {
    const mock = getMockPurpose();
    const versionId = generateId();
    const purposeCreatedMessage: PurposeEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      type: "PurposeCreated",
      event_version: 1,
      data: { purpose: toPurposeV1(mock) } as any,
      log_date: new Date(),
    };

    const version = getMockPurposeVersion();
    version.id = versionId as any;

    const purposeVersionCreatedMessage: PurposeEventEnvelopeV1 = {
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
    };

    const deleteVer: PurposeEventEnvelopeV1 = {
      sequence_num: 3,
      stream_id: mock.id,
      version: 3,
      type: "PurposeVersionDeleted",
      event_version: 1,
      data: { versionId: version.id } as any,
      log_date: new Date(),
    };
    await handlePurposeMessageV1(
      [deleteVer, purposeVersionCreatedMessage, purposeCreatedMessage],
      dbContext
    );
    const purposeStored = await getOneFromDb(
      dbContext,
      PurposeDbTable.purpose,
      {
        id: mock.id,
      }
    );

    expect(purposeStored).toBeDefined();

    for (const version of mock.versions) {
      const versionStored = await getOneFromDb(
        dbContext,
        PurposeDbTable.purpose_version,
        { id: version.id }
      );
      expect(versionStored).toBeUndefined();

      const versionDocumentStored = await getManyFromDb(
        dbContext,
        PurposeDbTable.purpose_version_document,
        { purposeVersionId: version.id }
      );
      expect(versionDocumentStored).toHaveLength(0);
    }
  });
});

describe("Purpose messages consumers - handlePurposeMessageV2", () => {
  beforeEach(async () => {
    await resetTargetTables(purposeTables);
  });

  it("PurposeCreated: inserts purpose with multiple versions and its sub-objects", async () => {
    const purposeRiskAnalysisForm: PurposeRiskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(tenantKind.PA),
      riskAnalysisId: generateId<RiskAnalysisId>(),
    };

    const mockPurposeVersionStamps = getMockPurposeVersionStamps();

    const mockPurpose = {
      ...getMockPurpose(),
      delegationId: generateId<DelegationId>(),
      suspendedByConsumer: false,
      suspendedByProducer: false,
      updatedAt: new Date(),
      freeOfChargeReason: "Free of charge reason",
      riskAnalysisForm: purposeRiskAnalysisForm,
      versions: [
        getMockPurposeVersion(
          purposeVersionState.draft,
          mockPurposeVersionStamps
        ),
      ],
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

    const stored = await getOneFromDb(dbContext, PurposeDbTable.purpose, {
      id: mockPurpose.id,
    });
    expect(stored).toBeDefined();

    for (const version of mockPurpose.versions) {
      const versionStored = await getOneFromDb(
        dbContext,
        PurposeDbTable.purpose_version,
        { id: version.id }
      );
      expect(versionStored).toBeDefined();

      const versionDocumentStored = await getManyFromDb(
        dbContext,
        PurposeDbTable.purpose_version_document,
        { purposeVersionId: version.id }
      );
      expect(versionDocumentStored.length).toBeGreaterThan(0);

      const versionStampsStored = await getManyFromDb(
        dbContext,
        PurposeDbTable.purpose_version_stamp,
        { purposeVersionId: version.id }
      );
      expect(versionStampsStored.length).toBeGreaterThan(0);

      const riskAnalysisStored = await getManyFromDb(
        dbContext,
        PurposeDbTable.purpose_risk_analysis_form,
        { purposeId: mockPurpose.id }
      );
      expect(riskAnalysisStored.length).toBeGreaterThan(0);

      const riskAnalysisAnswerStored = await getManyFromDb(
        dbContext,
        PurposeDbTable.purpose_risk_analysis_answer,
        { purposeId: mockPurpose.id }
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

    const stored = await getOneFromDb(dbContext, PurposeDbTable.purpose, {
      id: mock.id,
    });
    expect(stored?.title).toBe("updated");
    expect(stored?.metadataVersion).toBe(2);
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

    const stored = await getOneFromDb(dbContext, PurposeDbTable.purpose, {
      id: mockPurpose.id,
    });
    expect(stored?.deleted).toBe(true);

    for (const version of mockPurpose.versions) {
      const versionStored = await getOneFromDb(
        dbContext,
        PurposeDbTable.purpose_version,
        { id: version.id }
      );
      expect(versionStored?.deleted).toBe(true);

      const versionDocumentStored = await getManyFromDb(
        dbContext,
        PurposeDbTable.purpose_version_document,
        { purposeVersionId: version.id }
      );
      expect(versionDocumentStored.length).toBeGreaterThan(0);
      versionDocumentStored.forEach((r) => expect(r.deleted).toBe(true));
    }

    const riskAnalysisStored = await getManyFromDb(
      dbContext,
      PurposeDbTable.purpose_risk_analysis_form,
      { purposeId: mockPurpose.id }
    );
    riskAnalysisStored.forEach((r) => expect(r.deleted).toBe(true));

    const riskAnalysisAnswerStored = await getManyFromDb(
      dbContext,
      PurposeDbTable.purpose_risk_analysis_answer,
      { purposeId: mockPurpose.id }
    );
    riskAnalysisAnswerStored.forEach((r) => expect(r.deleted).toBe(true));
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

    const mockPurposeVersionStamps = getMockPurposeVersionStamps();

    const version = getMockPurposeVersion(
      purposeVersionState.draft,
      mockPurposeVersionStamps
    );
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

    const storedVer = await getOneFromDb(
      dbContext,
      PurposeDbTable.purpose_version,
      { id: version.id }
    );
    expect(storedVer).toBeDefined();

    const versionStampsStored = await getOneFromDb(
      dbContext,
      PurposeDbTable.purpose_version_stamp,
      { purposeVersionId: version.id }
    );
    expect(versionStampsStored).toBeDefined();
  });

  it("WaitingForApprovalPurposeVersionDeleted: delete purpose version", async () => {
    const mockPurpose = getMockPurpose();
    const mockVersion = getMockPurposeVersion();

    const purposeAddedMsg: PurposeEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      type: "PurposeAdded",
      event_version: 2,
      data: { purpose: toPurposeV2(mockPurpose) },
      log_date: new Date(),
    };

    const purposeVersionActivatedMsg: PurposeEventEnvelopeV2 = {
      sequence_num: 2,
      stream_id: mockPurpose.id,
      version: 2,
      type: "NewPurposeVersionActivated",
      event_version: 2,
      data: {
        versionId: mockVersion.id,
        purpose: toPurposeV2({ ...mockPurpose, versions: [mockVersion] }),
      },
      log_date: new Date(),
    };

    const purposeDeletedMsg: PurposeEventEnvelopeV2 = {
      sequence_num: 3,
      stream_id: mockPurpose.id,
      version: 3,
      type: "WaitingForApprovalPurposeVersionDeleted",
      event_version: 2,
      data: {
        versionId: mockVersion.id,
        purpose: toPurposeV2({ ...mockPurpose, versions: [] }),
      },
      log_date: new Date(),
    };

    await handlePurposeMessageV2(
      [purposeDeletedMsg, purposeVersionActivatedMsg, purposeAddedMsg],
      dbContext
    );

    const purposeStored = await getOneFromDb(
      dbContext,
      PurposeDbTable.purpose,
      { id: mockPurpose.id }
    );
    expect(purposeStored).toBeDefined();

    const versionStored = await getOneFromDb(
      dbContext,
      PurposeDbTable.purpose_version,
      { id: mockVersion.id }
    );
    expect(versionStored).toBeUndefined();

    const versionDocumentStored = await getManyFromDb(
      dbContext,
      PurposeDbTable.purpose_version_document,
      { purposeVersionId: mockVersion.id }
    );
    expect(versionDocumentStored).toHaveLength(0);

    const versionStampsStored = await getManyFromDb(
      dbContext,
      PurposeDbTable.purpose_version_stamp,
      { purposeVersionId: mockVersion.id }
    );
    expect(versionStampsStored).toHaveLength(0);
  });
});

describe("Check on metadata_version merge - Purpose", () => {
  beforeEach(async () => {
    await resetTargetTables(purposeTables);
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

    const msgV3: PurposeEventEnvelopeV1 = {
      ...msgV1,
      version: 3,
      sequence_num: 2,
      data: { purpose: toPurposeV1({ ...mock, title: "Title v3" }) },
    };

    const msgV2: PurposeEventEnvelopeV1 = {
      ...msgV1,
      version: 2,
      sequence_num: 3,
      data: { purpose: toPurposeV1({ ...mock, title: "Title v2" }) },
    };
    await handlePurposeMessageV1([msgV3, msgV1, msgV2], dbContext);
    const stored3 = await getOneFromDb(dbContext, PurposeDbTable.purpose, {
      id: mock.id,
    });
    expect(stored3?.title).toBe("Title v3");
    expect(stored3?.metadataVersion).toBe(3);
  });
});
