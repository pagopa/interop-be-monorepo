/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  EServiceCollection,
  PurposeCollection,
  ReadModelRepository,
  TenantCollection,
  initDB,
  unexpectedRulesVersionError,
} from "pagopa-interop-commons";
import { IDatabase } from "pg-promise";
import {
  TEST_MONGO_DB_PORT,
  TEST_POSTGRES_DB_PORT,
  decodeProtobufPayload,
  getMockPurpose,
  getMockPurposeVersion,
  getMockPurposeVersionDocument,
  getMockTenant,
  getMockValidRiskAnalysis,
  getMockValidRiskAnalysisForm,
  mongoDBContainer,
  postgreSQLContainer,
  randomArrayItem,
  readLastEventByStreamId,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { StartedTestContainer } from "testcontainers";
import {
  DraftPurposeDeletedV2,
  DraftPurposeUpdatedV2,
  EService,
  EServiceId,
  Purpose,
  PurposeId,
  PurposeVersion,
  PurposeVersionDocumentId,
  PurposeVersionId,
  PurposeVersionRejectedV2,
  RiskAnalysis,
  Tenant,
  TenantId,
  WaitingForApprovalPurposeDeletedV2,
  WaitingForApprovalPurposeVersionDeletedV2,
  generateId,
  purposeVersionState,
  tenantKind,
  toPurposeV2,
  toReadModelEService,
  unsafeBrandId,
} from "pagopa-interop-models";
import { config } from "../src/utilities/config.js";
import {
  PurposeService,
  purposeServiceBuilder,
} from "../src/services/purposeService.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readModelService.js";
import {
  eServiceModeNotAllowed,
  eserviceNotFound,
  missingFreeOfChargeReason,
  notValidVersionState,
  organizationIsNotTheConsumer,
  organizationIsNotTheProducer,
  organizationNotAllowed,
  purposeCannotBeDeleted,
  purposeNotFound,
  purposeNotInDraftState,
  purposeVersionCannotBeDeleted,
  purposeVersionDocumentNotFound,
  purposeVersionNotFound,
  riskAnalysisValidationFailed,
  tenantKindNotFound,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import {
  ApiPurposeUpdateContent,
  ApiReversePurposeUpdateContent,
} from "../src/model/domain/models.js";
import {
  addOnePurpose,
  buildRiskAnalysisSeed,
  createUpdatedPurpose,
  getMockEService,
} from "./utils.js";

describe("Integration tests", async () => {
  let purposes: PurposeCollection;
  let eservices: EServiceCollection;
  let tenants: TenantCollection;
  let readModelService: ReadModelService;
  let purposeService: PurposeService;
  let postgresDB: IDatabase<unknown>;
  let startedPostgreSqlContainer: StartedTestContainer;
  let startedMongodbContainer: StartedTestContainer;

  beforeAll(async () => {
    startedPostgreSqlContainer = await postgreSQLContainer(config).start();
    startedMongodbContainer = await mongoDBContainer(config).start();

    config.eventStoreDbPort = startedPostgreSqlContainer.getMappedPort(
      TEST_POSTGRES_DB_PORT
    );
    config.readModelDbPort =
      startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);

    const readModelRepository = ReadModelRepository.init(config);
    purposes = readModelRepository.purposes;
    eservices = readModelRepository.eservices;
    tenants = readModelRepository.tenants;
    readModelService = readModelServiceBuilder(readModelRepository);
    postgresDB = initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: config.eventStoreDbPort,
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    });
    purposeService = purposeServiceBuilder(postgresDB, readModelService);
  });

  afterEach(async () => {
    await purposes.deleteMany({});
    await tenants.deleteMany({});
    await eservices.deleteMany({});
    await postgresDB.none("TRUNCATE TABLE purpose.events RESTART IDENTITY");
  });

  afterAll(async () => {
    await startedPostgreSqlContainer.stop();
    await startedMongodbContainer.stop();
  });

  describe("Purpose service", () => {
    const mockPurpose = getMockPurpose();
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion();
    describe("getPurposeById", () => {
      it("should get the purpose if it exists", async () => {
        const mockTenant = {
          ...getMockTenant(),
          kind: tenantKind.PA,
        };

        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
        };
        const mockPurpose2: Purpose = {
          ...getMockPurpose(),
          id: generateId(),
          title: "another purpose",
        };
        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await addOnePurpose(mockPurpose2, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);
        await writeInReadmodel(mockTenant, tenants);

        const result = await purposeService.getPurposeById(
          mockPurpose1.id,
          mockTenant.id
        );
        expect(result).toMatchObject({
          purpose: mockPurpose1,
          isRiskAnalysisValid: false,
        });
      });
      it("should throw purposeNotFound if the purpose doesn't exist", async () => {
        const notExistingId: PurposeId = generateId();
        await addOnePurpose(mockPurpose, postgresDB, purposes);

        expect(
          purposeService.getPurposeById(notExistingId, generateId())
        ).rejects.toThrowError(purposeNotFound(notExistingId));
      });
      it("should throw eserviceNotFound if the eservice doesn't exist", async () => {
        const notExistingId: EServiceId = generateId();
        const mockTenant = {
          ...getMockTenant(),
          kind: tenantKind.PA,
        };

        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: notExistingId,
        };
        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(mockTenant, tenants);

        expect(
          purposeService.getPurposeById(mockPurpose1.id, mockTenant.id)
        ).rejects.toThrowError(eserviceNotFound(notExistingId));
      });
      it("should throw tenantNotFound if the tenant doesn't exist", async () => {
        const notExistingId: TenantId = generateId();

        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
        };
        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.getPurposeById(mockPurpose1.id, notExistingId)
        ).rejects.toThrowError(tenantNotFound(notExistingId));
      });
      it("should throw tenantKindNotFound if the tenant doesn't exist", async () => {
        const mockTenant = getMockTenant();

        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
        };
        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);
        await writeInReadmodel(mockTenant, tenants);

        expect(
          purposeService.getPurposeById(mockPurpose1.id, mockTenant.id)
        ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
      });
    });

    describe("getRiskAnalysisDocument", () => {
      it("should get the purpose version document", async () => {
        const mockDocument = getMockPurposeVersionDocument();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [{ ...mockPurposeVersion, riskAnalysis: mockDocument }],
        };
        const mockPurpose2: Purpose = {
          ...getMockPurpose(),
          id: generateId(),
          title: "another purpose",
        };
        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await addOnePurpose(mockPurpose2, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        const result = await purposeService.getRiskAnalysisDocument({
          purposeId: mockPurpose1.id,
          versionId: mockPurposeVersion.id,
          documentId: mockDocument.id,
          organizationId: mockEService.producerId,
        });
        expect(result).toEqual(mockDocument);
      });
      it("should throw purposeNotFound if the purpose doesn't exist", async () => {
        const notExistingId: PurposeId = generateId();
        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.getRiskAnalysisDocument({
            purposeId: notExistingId,
            versionId: generateId(),
            documentId: generateId(),
            organizationId: mockEService.producerId,
          })
        ).rejects.toThrowError(purposeNotFound(notExistingId));
      });
      it("should throw eserviceNotFound if the eservice doesn't exist", async () => {
        const mockDocument = getMockPurposeVersionDocument();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [{ ...mockPurposeVersion, riskAnalysis: mockDocument }],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);

        expect(
          purposeService.getRiskAnalysisDocument({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            documentId: mockDocument.id,
            organizationId: mockEService.producerId,
          })
        ).rejects.toThrowError(eserviceNotFound(mockEService.id));
      });
      it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
        const randomVersionId: PurposeVersionId = generateId();
        const randomDocumentId: PurposeVersionDocumentId = generateId();
        const mockDocument = getMockPurposeVersionDocument();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [{ ...mockPurposeVersion, riskAnalysis: mockDocument }],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.getRiskAnalysisDocument({
            purposeId: mockPurpose1.id,
            versionId: randomVersionId,
            documentId: randomDocumentId,
            organizationId: mockEService.producerId,
          })
        ).rejects.toThrowError(
          purposeVersionNotFound(mockPurpose1.id, randomVersionId)
        );
      });
      it("should throw purposeVersionDocumentNotFound if the document doesn't exist", async () => {
        const mockDocument = getMockPurposeVersionDocument();
        const randomDocumentId: PurposeVersionDocumentId = generateId();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [{ ...mockPurposeVersion, riskAnalysis: mockDocument }],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.getRiskAnalysisDocument({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            documentId: randomDocumentId,
            organizationId: mockEService.producerId,
          })
        ).rejects.toThrowError(
          purposeVersionDocumentNotFound(
            mockPurpose1.id,
            mockPurposeVersion.id,
            randomDocumentId
          )
        );
      });
      it("should throw organizationNotAllowed if the requester is not the producer nor the consumer", async () => {
        const randomId: TenantId = generateId();
        const mockDocument = getMockPurposeVersionDocument();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [{ ...mockPurposeVersion, riskAnalysis: mockDocument }],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.getRiskAnalysisDocument({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            documentId: mockDocument.id,
            organizationId: randomId,
          })
        ).rejects.toThrowError(organizationNotAllowed(randomId));
      });
    });

    describe("deletePurposeVersion", () => {
      it("should write in event-store for the deletion of a purpose version", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date());

        const mockPurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.waitingForApproval,
        };
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        await purposeService.deletePurposeVersion({
          purposeId: mockPurpose1.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockPurpose1.consumerId,
          correlationId: generateId(),
        });

        const writtenEvent = await readLastEventByStreamId(
          mockPurpose1.id,
          "purpose",
          postgresDB
        );

        expect(writtenEvent).toMatchObject({
          stream_id: mockPurpose1.id,
          version: "1",
          type: "WaitingForApprovalPurposeVersionDeleted",
          event_version: 2,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: WaitingForApprovalPurposeVersionDeletedV2,
          payload: writtenEvent.data,
        });

        const expectedPurpose: Purpose = {
          ...mockPurpose1,
          versions: [],
          updatedAt: new Date(),
        };

        expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

        vi.useRealTimers();
      });
      it("should throw purposeNotFound if the purpose doesn't exist", async () => {
        const randomId: PurposeId = generateId();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.deletePurposeVersion({
            purposeId: randomId,
            versionId: mockPurposeVersion.id,
            organizationId: mockEService.producerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeNotFound(randomId));
      });
      it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
        const randomVersionId: PurposeVersionId = generateId();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.deletePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: randomVersionId,
            organizationId: mockPurpose1.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          purposeVersionNotFound(mockPurpose1.id, randomVersionId)
        );
      });
      it("should throw organizationIsNotTheConsumer if the requester is not the consumer", async () => {
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.deletePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            organizationId: mockEService.producerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          organizationIsNotTheConsumer(mockEService.producerId)
        );
      });
      it("should throw purposeVersionCannotBeDeleted if the purpose version is in draft state", async () => {
        const mockPurposeVersion1: PurposeVersion = {
          ...mockPurposeVersion,
          state: purposeVersionState.draft,
        };
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion1],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.deletePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion1.id,
            organizationId: mockPurpose1.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          purposeVersionCannotBeDeleted(mockPurpose1.id, mockPurposeVersion1.id)
        );
      });
      it("should throw purposeVersionCannotBeDeleted if the purpose version is in active state", async () => {
        const mockPurposeVersion1: PurposeVersion = {
          ...mockPurposeVersion,
          state: purposeVersionState.active,
        };
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion1],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.deletePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion1.id,
            organizationId: mockPurpose1.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          purposeVersionCannotBeDeleted(mockPurpose1.id, mockPurposeVersion1.id)
        );
      });
      it("should throw purposeVersionCannotBeDeleted if the purpose version is in archived state", async () => {
        const mockPurposeVersion1: PurposeVersion = {
          ...mockPurposeVersion,
          state: purposeVersionState.archived,
        };
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion1],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.deletePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion1.id,
            organizationId: mockPurpose1.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          purposeVersionCannotBeDeleted(mockPurpose1.id, mockPurposeVersion1.id)
        );
      });
      it("should throw purposeVersionCannotBeDeleted if the purpose version is in suspended state", async () => {
        const mockPurposeVersion1: PurposeVersion = {
          ...mockPurposeVersion,
          state: purposeVersionState.suspended,
          suspendedAt: new Date(),
        };
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion1],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.deletePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion1.id,
            organizationId: mockPurpose1.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          purposeVersionCannotBeDeleted(mockPurpose1.id, mockPurposeVersion1.id)
        );
      });
    });

    describe("rejectPurposeVersion", () => {
      it("should write on event-store for the rejection of a purpose version", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date());

        const mockEService = getMockEService();
        const mockPurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.waitingForApproval,
        };
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        await purposeService.rejectPurposeVersion({
          purposeId: mockPurpose1.id,
          versionId: mockPurposeVersion.id,
          rejectionReason: "test",
          organizationId: mockEService.producerId,
          correlationId: generateId(),
        });

        const writtenEvent = await readLastEventByStreamId(
          mockPurpose1.id,
          "purpose",
          postgresDB
        );

        expect(writtenEvent).toMatchObject({
          stream_id: mockPurpose1.id,
          version: "1",
          type: "PurposeVersionRejected",
          event_version: 2,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: PurposeVersionRejectedV2,
          payload: writtenEvent.data,
        });

        const expectedPurposeVersion: PurposeVersion = {
          ...mockPurposeVersion,
          state: purposeVersionState.rejected,
          rejectionReason: "test",
          updatedAt: new Date(),
        };
        const expectedPurpose: Purpose = {
          ...mockPurpose1,
          versions: [expectedPurposeVersion],
          updatedAt: new Date(),
        };

        expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

        vi.useRealTimers();
      });
      it("should throw purposeNotFound if the purpose doesn't exist", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion = getMockPurposeVersion();
        const randomId: PurposeId = generateId();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.rejectPurposeVersion({
            purposeId: randomId,
            versionId: mockPurposeVersion.id,
            rejectionReason: "test",
            organizationId: mockEService.producerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeNotFound(randomId));
      });
      it("Should throw eserviceNotFound if the eservice doesn't exist", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion = getMockPurposeVersion();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);

        expect(
          purposeService.rejectPurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            rejectionReason: "test",
            organizationId: mockPurpose1.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(eserviceNotFound(mockEService.id));
      });
      it("should throw organizationIsNotTheProducer if the requester is not the producer", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion = getMockPurposeVersion();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.rejectPurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            rejectionReason: "test",
            organizationId: mockPurpose1.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          organizationIsNotTheProducer(mockPurpose.consumerId)
        );
      });
      it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion = getMockPurposeVersion();
        const randomVersionId: PurposeVersionId = generateId();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.rejectPurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: randomVersionId,
            rejectionReason: "test",
            organizationId: mockEService.producerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          purposeVersionNotFound(mockPurpose1.id, randomVersionId)
        );
      });
      it("should throw notValidVersionState if the purpose version is in draft state", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion: PurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.draft,
        };
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.rejectPurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            rejectionReason: "test",
            organizationId: mockEService.producerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
        );
      });
      it("should throw notValidVersionState if the purpose version is in active state", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion: PurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.active,
        };
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.rejectPurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            rejectionReason: "test",
            organizationId: mockEService.producerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
        );
      });
      it("should throw notValidVersionState if the purpose version is in archived state", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion: PurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.archived,
        };
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.rejectPurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            rejectionReason: "test",
            organizationId: mockEService.producerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
        );
      });
      it("should throw notValidVersionState if the purpose version is in rejected state", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion: PurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.rejected,
        };
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.rejectPurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            rejectionReason: "test",
            organizationId: mockEService.producerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
        );
      });
      it("should throw notValidVersionState if the purpose version is in suspended state", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion: PurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.suspended,
          suspendedAt: new Date(),
        };
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.rejectPurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            rejectionReason: "test",
            organizationId: mockEService.producerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
        );
      });
    });

    describe("updatePurpose and reverseUpdatePurpose", () => {
      const tenantType = randomArrayItem(Object.values(tenantKind));
      const tenant: Tenant = {
        ...getMockTenant(),
        kind: tenantType,
      };

      const eServiceDeliver: EService = {
        ...getMockEService(),
        mode: "Deliver",
      };

      const eServiceReceive: EService = {
        ...getMockEService(),
        mode: "Receive",
        producerId: tenant.id,
      };

      const purposeForReceive: Purpose = {
        ...getMockPurpose(),
        eserviceId: eServiceReceive.id,
        consumerId: tenant.id,
        versions: [
          { ...getMockPurposeVersion(), state: purposeVersionState.draft },
        ],
        riskAnalysisForm: {
          ...getMockValidRiskAnalysisForm(tenantType),
          id: generateId(),
        },
      };

      const purposeForDeliver: Purpose = {
        ...getMockPurpose(),
        eserviceId: eServiceDeliver.id,
        consumerId: tenant.id,
        versions: [
          { ...getMockPurposeVersion(), state: purposeVersionState.draft },
        ],
      };

      const validRiskAnalysis = getMockValidRiskAnalysis(tenantType);

      const purposeUpdateContent: ApiPurposeUpdateContent = {
        title: "test",
        dailyCalls: 10,
        description: "test",
        isFreeOfCharge: true,
        freeOfChargeReason: "reason",
        riskAnalysisForm: buildRiskAnalysisSeed(validRiskAnalysis),
      };

      const reversePurposeUpdateContent: ApiReversePurposeUpdateContent = {
        ...purposeUpdateContent,
      };

      it("Should write on event store for the update of a purpose of an e-service in mode DELIVER", async () => {
        await addOnePurpose(purposeForDeliver, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
        await writeInReadmodel(tenant, tenants);

        await purposeService.updatePurpose({
          purposeId: purposeForDeliver.id,
          purposeUpdateContent,
          organizationId: tenant.id,
          correlationId: generateId(),
        });

        const writtenEvent = await readLastEventByStreamId(
          purposeForDeliver.id,
          "purpose",
          postgresDB
        );

        expect(writtenEvent).toMatchObject({
          stream_id: purposeForDeliver.id,
          version: "1",
          type: "DraftPurposeUpdated",
          event_version: 2,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: DraftPurposeUpdatedV2,
          payload: writtenEvent.data,
        });

        const expectedPurpose: Purpose = createUpdatedPurpose(
          purposeForDeliver,
          purposeUpdateContent,
          validRiskAnalysis,
          writtenPayload
        );

        expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
      });
      it("Should write on event store for the update of a purpose of an e-service in mode RECEIVE", async () => {
        await addOnePurpose(purposeForReceive, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(eServiceReceive), eservices);
        await writeInReadmodel(tenant, tenants);

        await purposeService.updateReversePurpose({
          purposeId: purposeForReceive.id,
          reversePurposeUpdateContent,
          organizationId: tenant.id,
          correlationId: generateId(),
        });

        const writtenEvent = await readLastEventByStreamId(
          purposeForReceive.id,
          "purpose",
          postgresDB
        );

        expect(writtenEvent).toMatchObject({
          stream_id: purposeForReceive.id,
          version: "1",
          type: "DraftPurposeUpdated",
          event_version: 2,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: DraftPurposeUpdatedV2,
          payload: writtenEvent.data,
        });

        const expectedPurpose: Purpose = createUpdatedPurpose(
          purposeForReceive,
          reversePurposeUpdateContent,
          validRiskAnalysis,
          writtenPayload
        );

        expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
      });
      it("Should throw purposeNotFound if the purpose doesn't exist", async () => {
        await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
        await writeInReadmodel(tenant, tenants);

        const purposeId: PurposeId = unsafeBrandId(generateId());

        expect(
          purposeService.updatePurpose({
            purposeId,
            purposeUpdateContent,
            organizationId: tenant.id,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeNotFound(purposeId));
      });
      it("Should throw organizationIsNotTheConsumer if the organization is not the consumer", async () => {
        const mockPurpose: Purpose = {
          ...purposeForDeliver,
          consumerId: generateId(),
        };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
        await writeInReadmodel(tenant, tenants);

        const organizationId: TenantId = unsafeBrandId(generateId());

        expect(
          purposeService.updatePurpose({
            purposeId: mockPurpose.id,
            purposeUpdateContent,
            organizationId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(organizationIsNotTheConsumer(organizationId));
      });
      it("Should throw purposeNotInDraftState if the purpose is not in draft state", async () => {
        const mockPurpose: Purpose = {
          ...purposeForDeliver,
          versions: [
            { ...getMockPurposeVersion(), state: purposeVersionState.active },
          ],
        };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
        await writeInReadmodel(tenant, tenants);

        expect(
          purposeService.updatePurpose({
            purposeId: mockPurpose.id,
            purposeUpdateContent,
            organizationId: tenant.id,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeNotInDraftState(mockPurpose.id));
      });
      it("Should throw eserviceNotFound if the eservice doesn't exist", async () => {
        const eserviceId: EServiceId = unsafeBrandId(generateId());
        const mockPurpose: Purpose = {
          ...purposeForDeliver,
          eserviceId,
        };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(tenant, tenants);

        expect(
          purposeService.updatePurpose({
            purposeId: mockPurpose.id,
            purposeUpdateContent,
            organizationId: tenant.id,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(eserviceNotFound(eserviceId));
      });
      it("should throw eServiceModeNotAllowed if the eService mode is incorrect", async () => {
        await addOnePurpose(purposeForReceive, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(eServiceReceive), eservices);
        await writeInReadmodel(tenant, tenants);

        expect(
          purposeService.updatePurpose({
            purposeId: purposeForReceive.id,
            purposeUpdateContent,
            organizationId: tenant.id,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          eServiceModeNotAllowed(eServiceReceive.id, "Deliver")
        );

        await addOnePurpose(purposeForDeliver, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);

        expect(
          purposeService.updateReversePurpose({
            purposeId: purposeForDeliver.id,
            reversePurposeUpdateContent,
            organizationId: tenant.id,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          eServiceModeNotAllowed(eServiceDeliver.id, "Receive")
        );
      });
      it("Should throw missingFreeOfChargeReason if the freeOfChargeReason is missing", async () => {
        await addOnePurpose(purposeForDeliver, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
        await writeInReadmodel(tenant, tenants);

        expect(
          purposeService.updatePurpose({
            purposeId: purposeForDeliver.id,
            purposeUpdateContent: {
              ...purposeUpdateContent,
              freeOfChargeReason: undefined,
            },
            organizationId: tenant.id,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(missingFreeOfChargeReason());
      });
      it("Should throw tenantNotFound if the tenant does not exist", async () => {
        await addOnePurpose(purposeForDeliver, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);

        expect(
          purposeService.updatePurpose({
            purposeId: purposeForDeliver.id,
            purposeUpdateContent,
            organizationId: tenant.id,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(tenantNotFound(tenant.id));

        await addOnePurpose(purposeForReceive, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(eServiceReceive), eservices);

        expect(
          purposeService.updateReversePurpose({
            purposeId: purposeForReceive.id,
            reversePurposeUpdateContent,
            organizationId: tenant.id,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(tenantNotFound(tenant.id));
      });
      it("Should throw tenantKindNotFound if the tenant kind does not exist", async () => {
        const mockTenant = {
          ...tenant,
          kind: undefined,
        };

        await addOnePurpose(purposeForDeliver, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
        await writeInReadmodel(mockTenant, tenants);

        expect(
          purposeService.updatePurpose({
            purposeId: purposeForDeliver.id,
            purposeUpdateContent,
            organizationId: mockTenant.id,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
      });
      it("Should throw riskAnalysisValidationFailed if the risk analysis is not valid", async () => {
        await addOnePurpose(purposeForDeliver, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
        await writeInReadmodel(tenant, tenants);

        const invalidRiskAnalysis: RiskAnalysis = {
          ...validRiskAnalysis,
          riskAnalysisForm: {
            ...validRiskAnalysis.riskAnalysisForm,
            version: "0",
          },
        };

        const mockPurposeUpdateContent: ApiPurposeUpdateContent = {
          ...purposeUpdateContent,
          riskAnalysisForm: buildRiskAnalysisSeed(invalidRiskAnalysis),
        };

        expect(
          purposeService.updatePurpose({
            purposeId: purposeForDeliver.id,
            purposeUpdateContent: mockPurposeUpdateContent,
            organizationId: tenant.id,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          riskAnalysisValidationFailed([unexpectedRulesVersionError("0")])
        );
      });
    });

    describe("deletePurpose", () => {
      it("should write on event-store for the deletion of a purpose (no versions)", async () => {
        const mockEService = getMockEService();
        const mockPurpose: Purpose = {
          ...getMockPurpose(),
          eserviceId: mockEService.id,
          versions: [],
        };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        await purposeService.deletePurpose({
          purposeId: mockPurpose.id,
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
        });

        const writtenEvent = await readLastEventByStreamId(
          mockPurpose.id,
          "purpose",
          postgresDB
        );

        expect(writtenEvent).toMatchObject({
          stream_id: mockPurpose.id,
          version: "1",
          type: "DraftPurposeDeleted",
          event_version: 2,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: DraftPurposeDeletedV2,
          payload: writtenEvent.data,
        });

        expect(writtenPayload.purpose).toEqual(toPurposeV2(mockPurpose));
      });
      it("should write on event-store for the deletion of a purpose (draft version)", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.draft,
        };
        const mockPurpose: Purpose = {
          ...getMockPurpose(),
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        await purposeService.deletePurpose({
          purposeId: mockPurpose.id,
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
        });

        const writtenEvent = await readLastEventByStreamId(
          mockPurpose.id,
          "purpose",
          postgresDB
        );

        expect(writtenEvent).toMatchObject({
          stream_id: mockPurpose.id,
          version: "1",
          type: "DraftPurposeDeleted",
          event_version: 2,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: DraftPurposeDeletedV2,
          payload: writtenEvent.data,
        });

        expect(writtenPayload.purpose).toEqual(toPurposeV2(mockPurpose));
      });
      it("should write on event-store for the deletion of a purpose (waiting for approval version)", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.waitingForApproval,
        };
        const mockPurpose: Purpose = {
          ...getMockPurpose(),
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        await purposeService.deletePurpose({
          purposeId: mockPurpose.id,
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
        });

        const writtenEvent = await readLastEventByStreamId(
          mockPurpose.id,
          "purpose",
          postgresDB
        );

        expect(writtenEvent).toMatchObject({
          stream_id: mockPurpose.id,
          version: "1",
          type: "WaitingForApprovalPurposeDeleted",
          event_version: 2,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: WaitingForApprovalPurposeDeletedV2,
          payload: writtenEvent.data,
        });

        expect(writtenPayload.purpose).toEqual(toPurposeV2(mockPurpose));
      });
      it("should throw purposeNotFound if the purpose doesn't exist", async () => {
        const randomId: PurposeId = generateId();

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        expect(
          purposeService.deletePurpose({
            purposeId: randomId,
            organizationId: mockPurpose.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeNotFound(randomId));
      });
      it("should throw organizationIsNotTheConsumer if the requester is not the consumer", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion: PurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.draft,
        };
        const mockPurpose: Purpose = {
          ...getMockPurpose(),
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.deletePurpose({
            purposeId: mockPurpose.id,
            organizationId: mockEService.producerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          organizationIsNotTheConsumer(mockEService.producerId)
        );
      });
      it("should throw purposeCannotBeDeleted if the purpose has an active version ", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion: PurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.active,
        };
        const mockPurpose: Purpose = {
          ...getMockPurpose(),
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.deletePurpose({
            purposeId: mockPurpose.id,
            organizationId: mockPurpose.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeCannotBeDeleted(mockPurpose.id));
      });
      it("should throw purposeCannotBeDeleted if the purpose has a rejected version ", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion: PurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.rejected,
        };
        const mockPurpose: Purpose = {
          ...getMockPurpose(),
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.deletePurpose({
            purposeId: mockPurpose.id,
            organizationId: mockPurpose.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeCannotBeDeleted(mockPurpose.id));
      });
      it("should throw purposeCannotBeDeleted if the purpose has a suspeneded version ", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion: PurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.suspended,
          suspendedAt: new Date(),
        };
        const mockPurpose: Purpose = {
          ...getMockPurpose(),
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.deletePurpose({
            purposeId: mockPurpose.id,
            organizationId: mockPurpose.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeCannotBeDeleted(mockPurpose.id));
      });
      it("should throw purposeCannotBeDeleted if the purpose has an archived version ", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion: PurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.archived,
        };
        const mockPurpose: Purpose = {
          ...getMockPurpose(),
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.deletePurpose({
            purposeId: mockPurpose.id,
            organizationId: mockPurpose.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeCannotBeDeleted(mockPurpose.id));
      });
    });
  });
});
