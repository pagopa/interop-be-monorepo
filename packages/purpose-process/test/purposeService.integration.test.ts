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
} from "pagopa-interop-commons";
import { IDatabase } from "pg-promise";
import {
  TEST_MONGO_DB_PORT,
  TEST_POSTGRES_DB_PORT,
  decodeProtobufPayload,
  getMockAuthData,
  getMockPurpose,
  getMockPurposeVersion,
  getMockPurposeVersionDocument,
  getMockTenant,
  getMockValidRiskAnalysis,
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
  eserviceNotFound,
  notValidVersionState,
  organizationIsNotTheConsumer,
  organizationIsNotTheProducer,
  organizationNotAllowed,
  purposeCannotBeDeleted,
  purposeNotFound,
  purposeVersionCannotBeDeleted,
  purposeVersionDocumentNotFound,
  purposeVersionNotFound,
  tenantKindNotFound,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import {
  PurposeUpdateContent,
  ReversePurposeUpdateContent,
} from "../src/model/domain/models.js";
import {
  addOnePurpose,
  buildRiskAnalysisSeed,
  getMockEService,
} from "./utils.js";

describe("database test", async () => {
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

    await postgresDB.none("TRUNCATE TABLE purpose.events RESTART IDENTITY");
  });

  afterAll(async () => {
    await startedPostgreSqlContainer.stop();
    await startedMongodbContainer.stop();
  });

  describe("Purpose service", () => {
    const mockPurpose = getMockPurpose();
    describe("getPurposeById", () => {
      it("should get the purpose if it exists", async () => {
        const mockEService = getMockEService();
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
          getMockAuthData(mockTenant.id)
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
          purposeService.getPurposeById(notExistingId, getMockAuthData())
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
        const mockPurpose2: Purpose = {
          ...getMockPurpose(),
          id: generateId(),
          title: "another purpose",
        };
        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await addOnePurpose(mockPurpose2, postgresDB, purposes);
        await writeInReadmodel(mockTenant, tenants);

        expect(
          purposeService.getPurposeById(
            mockPurpose1.id,
            getMockAuthData(mockTenant.id)
          )
        ).rejects.toThrowError(eserviceNotFound(notExistingId));
      });
      it("should throw tenantNotFound if the tenant doesn't exist", async () => {
        const mockEService = getMockEService();
        const notExistingId: TenantId = generateId();

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

        expect(
          purposeService.getPurposeById(
            mockPurpose1.id,
            getMockAuthData(notExistingId)
          )
        ).rejects.toThrowError(tenantNotFound(notExistingId));
      });
      it("should throw tenantKindNotFound if the tenant doesn't exist", async () => {
        const mockEService = getMockEService();
        const mockTenant = getMockTenant();

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

        expect(
          purposeService.getPurposeById(
            mockPurpose1.id,
            getMockAuthData(mockTenant.id)
          )
        ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
      });
    });

    describe("getRiskAnalysisDocument", () => {
      it("should get the purpose version document", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion = getMockPurposeVersion();
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
          authData: getMockAuthData(mockEService.producerId),
        });
        expect(result).toEqual(mockDocument);
      });
      it("should throw purposeNotFound if the purpose doesn't exist", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion = getMockPurposeVersion();
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
        await addOnePurpose(mockPurpose2, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.getRiskAnalysisDocument({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            documentId: mockDocument.id,
            authData: getMockAuthData(mockEService.producerId),
          })
        ).rejects.toThrowError(purposeNotFound(mockPurpose1.id));
      });
      it("should throw eserviceNotFound if the eservice doesn't exist", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion = getMockPurposeVersion();
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
            authData: getMockAuthData(mockEService.producerId),
          })
        ).rejects.toThrowError(eserviceNotFound(mockEService.id));
      });
      it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion = getMockPurposeVersion();
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
            authData: getMockAuthData(mockEService.producerId),
          })
        ).rejects.toThrowError(
          purposeVersionNotFound(mockPurpose1.id, randomVersionId)
        );
      });
      it("should throw purposeVersionDocumentNotFound if the document doesn't exist", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion = getMockPurposeVersion();
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
            authData: getMockAuthData(mockEService.producerId),
          })
        ).rejects.toThrowError(
          purposeVersionDocumentNotFound(
            mockPurpose1.id,
            mockPurposeVersion.id,
            randomDocumentId
          )
        );
      });
      it("should throw organizationNotAllowed if the requester is not the producer not the consumer", async () => {
        const randomId: TenantId = generateId();
        const mockEService = getMockEService();
        const mockPurposeVersion = getMockPurposeVersion();
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
            authData: getMockAuthData(randomId),
          })
        ).rejects.toThrowError(organizationNotAllowed(randomId));
      });
    });

    describe("deletePurposeVersion", () => {
      it("should write in event-store for the deletion of a purpose version", async () => {
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

        await purposeService.deletePurposeVersion({
          purposeId: mockPurpose1.id,
          versionId: mockPurposeVersion.id,
          authData: getMockAuthData(mockPurpose1.consumerId),
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
        };

        expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
      });
      it("should throw purposeNotFound if the purpose doesn't exist", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion = getMockPurposeVersion();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };
        const mockPurpose2: Purpose = {
          ...getMockPurpose(),
          id: generateId(),
          title: "another purpose",
        };
        await addOnePurpose(mockPurpose2, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.deletePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            authData: getMockAuthData(mockEService.producerId),
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeNotFound(mockPurpose1.id));
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
          purposeService.deletePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: randomVersionId,
            authData: getMockAuthData(mockPurpose1.consumerId),
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          purposeVersionNotFound(mockPurpose1.id, randomVersionId)
        );
      });
      it("should throw organizationIsNotTheConsumer if the requester is not the consumer", async () => {
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
          purposeService.deletePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            authData: getMockAuthData(mockEService.producerId),
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          organizationIsNotTheConsumer(mockEService.producerId)
        );
      });
      it("should throw purposeVersionCannotBeDeleted if the purpose version is in draft state", async () => {
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
          purposeService.deletePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            authData: getMockAuthData(mockPurpose1.consumerId),
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          purposeVersionCannotBeDeleted(mockPurpose1.id, mockPurposeVersion.id)
        );
      });
      it("should throw purposeVersionCannotBeDeleted if the purpose version is in active state", async () => {
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
          purposeService.deletePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            authData: getMockAuthData(mockPurpose1.consumerId),
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          purposeVersionCannotBeDeleted(mockPurpose1.id, mockPurposeVersion.id)
        );
      });
      it("should throw purposeVersionCannotBeDeleted if the purpose version is in archived state", async () => {
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
          purposeService.deletePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            authData: getMockAuthData(mockPurpose1.consumerId),
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          purposeVersionCannotBeDeleted(mockPurpose1.id, mockPurposeVersion.id)
        );
      });
      it("should throw purposeVersionCannotBeDeleted if the purpose version is in suspended state", async () => {
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
          purposeService.deletePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            authData: getMockAuthData(mockPurpose1.consumerId),
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          purposeVersionCannotBeDeleted(mockPurpose1.id, mockPurposeVersion.id)
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
          authData: getMockAuthData(mockEService.producerId),
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
        };

        expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

        vi.useRealTimers();
      });
      it("should throw purposeNotFound if the purpose doesn't exist", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion = getMockPurposeVersion();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };
        const mockPurpose2: Purpose = {
          ...getMockPurpose(),
          id: generateId(),
          title: "another purpose",
        };
        await addOnePurpose(mockPurpose2, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.rejectPurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            rejectionReason: "test",
            authData: getMockAuthData(mockEService.producerId),
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeNotFound(mockPurpose1.id));
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
            authData: getMockAuthData(mockPurpose1.consumerId),
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
            authData: getMockAuthData(mockPurpose1.consumerId),
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
            authData: getMockAuthData(mockEService.producerId),
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
            authData: getMockAuthData(mockEService.producerId),
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
            authData: getMockAuthData(mockEService.producerId),
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
            authData: getMockAuthData(mockEService.producerId),
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
            authData: getMockAuthData(mockEService.producerId),
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
            authData: getMockAuthData(mockEService.producerId),
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
        );
      });
    });

    describe("updatePurpose and reverseUpdatePurpose", () => {
      it("Should write on event store for the update of a purpose of an e-service in mode DELIVER", async () => {
        const consumerTenantKind = randomArrayItem(Object.values(tenantKind));
        const consumer: Tenant = {
          ...getMockTenant(),
          kind: consumerTenantKind,
        };

        const mockEservice: EService = {
          ...getMockEService(),
          mode: "Deliver",
        };
        const mockPurpose: Purpose = {
          ...getMockPurpose(),
          eserviceId: mockEservice.id,
          consumerId: consumer.id,
          versions: [
            {
              ...getMockPurposeVersion(),
              state: purposeVersionState.draft,
            },
          ],
        };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEservice), eservices);
        await writeInReadmodel(consumer, tenants);

        const mockValidRiskAnalysis =
          getMockValidRiskAnalysis(consumerTenantKind);

        const purposeUpdateContent: PurposeUpdateContent = {
          title: "test",
          dailyCalls: 10,
          description: "test",
          isFreeOfCharge: false,
          riskAnalysisForm: buildRiskAnalysisSeed(mockValidRiskAnalysis),
        };

        await purposeService.updatePurpose({
          purposeId: mockPurpose.id,
          purposeUpdateContent,
          organizationId: consumer.id,
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
          type: "DraftPurposeUpdated",
          event_version: 2,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: DraftPurposeUpdatedV2,
          payload: writtenEvent.data,
        });

        const expectedPurpose: Purpose = {
          ...mockPurpose,
          title: purposeUpdateContent.title,
          description: purposeUpdateContent.description,
          isFreeOfCharge: purposeUpdateContent.isFreeOfCharge,
          riskAnalysisForm: {
            ...mockValidRiskAnalysis.riskAnalysisForm,
            id: unsafeBrandId(writtenPayload.purpose!.riskAnalysisForm!.id),
            singleAnswers:
              mockValidRiskAnalysis.riskAnalysisForm.singleAnswers.map(
                (singleAnswer) => ({
                  ...singleAnswer,
                  id: unsafeBrandId(
                    writtenPayload.purpose!.riskAnalysisForm!.singleAnswers.find(
                      (sa) => sa.key === singleAnswer.key
                    )!.id
                  ),
                })
              ),
            multiAnswers:
              mockValidRiskAnalysis.riskAnalysisForm.multiAnswers.map(
                (multiAnswer) => ({
                  ...multiAnswer,
                  id: unsafeBrandId(
                    writtenPayload.purpose!.riskAnalysisForm!.multiAnswers.find(
                      (ma) => ma.key === multiAnswer.key
                    )!.id
                  ),
                })
              ),
          },
        };

        expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
      });
      it("Should write on event store for the update of a purpose of an e-service in mode RECEIVE", async () => {
        const producerTenantKind = randomArrayItem(Object.values(tenantKind));
        const producer: Tenant = {
          ...getMockTenant(),
          kind: producerTenantKind,
        };

        const mockEservice: EService = {
          ...getMockEService(),
          mode: "Receive",
          producerId: producer.id,
        };

        const mockValidRiskAnalysis =
          getMockValidRiskAnalysis(producerTenantKind);

        const mockPurpose: Purpose = {
          ...getMockPurpose(),
          eserviceId: mockEservice.id,
          consumerId: producer.id,
          versions: [
            {
              ...getMockPurposeVersion(),
              state: purposeVersionState.draft,
            },
          ],
          riskAnalysisForm: {
            ...mockValidRiskAnalysis.riskAnalysisForm,
            id: generateId(),
            singleAnswers:
              mockValidRiskAnalysis.riskAnalysisForm.singleAnswers.map(
                (singleAnswer) => ({
                  ...singleAnswer,
                  id: generateId(),
                })
              ),
            multiAnswers:
              mockValidRiskAnalysis.riskAnalysisForm.multiAnswers.map(
                (multiAnswer) => ({
                  ...multiAnswer,
                  id: generateId(),
                })
              ),
          },
        };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEservice), eservices);
        await writeInReadmodel(producer, tenants);

        const reversePurposeUpdateContent: ReversePurposeUpdateContent = {
          title: "test",
          dailyCalls: 10,
          description: "test",
          isFreeOfCharge: false,
        };

        await purposeService.updateReversePurpose({
          purposeId: mockPurpose.id,
          reversePurposeUpdateContent,
          organizationId: producer.id,
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
          type: "DraftPurposeUpdated",
          event_version: 2,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: DraftPurposeUpdatedV2,
          payload: writtenEvent.data,
        });

        const expectedPurpose: Purpose = {
          ...mockPurpose,
          title: reversePurposeUpdateContent.title,
          description: reversePurposeUpdateContent.description,
          isFreeOfCharge: reversePurposeUpdateContent.isFreeOfCharge,
          riskAnalysisForm: {
            ...mockValidRiskAnalysis.riskAnalysisForm,
            id: unsafeBrandId(writtenPayload.purpose!.riskAnalysisForm!.id),
            singleAnswers:
              mockValidRiskAnalysis.riskAnalysisForm.singleAnswers.map(
                (singleAnswer) => ({
                  ...singleAnswer,
                  id: unsafeBrandId(
                    writtenPayload.purpose!.riskAnalysisForm!.singleAnswers.find(
                      (sa) => sa.key === singleAnswer.key
                    )!.id
                  ),
                })
              ),
            multiAnswers:
              mockValidRiskAnalysis.riskAnalysisForm.multiAnswers.map(
                (multiAnswer) => ({
                  ...multiAnswer,
                  id: unsafeBrandId(
                    writtenPayload.purpose!.riskAnalysisForm!.multiAnswers.find(
                      (ma) => ma.key === multiAnswer.key
                    )!.id
                  ),
                })
              ),
          },
        };

        expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
      });
    });

    describe("deletePurpose", () => {
      it("should write on event-store for the deletion of a purpose (no versions)", async () => {
        const mockEService = getMockEService();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        await purposeService.deletePurpose({
          purposeId: mockPurpose1.id,
          organizationId: mockPurpose.consumerId,
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
          type: "DraftPurposeDeleted",
          event_version: 2,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: DraftPurposeDeletedV2,
          payload: writtenEvent.data,
        });

        expect(writtenPayload.purpose).toEqual(toPurposeV2(mockPurpose1));
      });
      it("should write on event-store for the deletion of a purpose (draft version)", async () => {
        const mockEService = getMockEService();
        const mockPurposeVersion = {
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

        await purposeService.deletePurpose({
          purposeId: mockPurpose1.id,
          organizationId: mockPurpose.consumerId,
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
          type: "DraftPurposeDeleted",
          event_version: 2,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: DraftPurposeDeletedV2,
          payload: writtenEvent.data,
        });

        expect(writtenPayload.purpose).toEqual(toPurposeV2(mockPurpose1));
      });
      it("should write on event-store for the deletion of a purpose (waiting for approval version)", async () => {
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

        await purposeService.deletePurpose({
          purposeId: mockPurpose1.id,
          organizationId: mockPurpose.consumerId,
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
          type: "WaitingForApprovalPurposeDeleted",
          event_version: 2,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: WaitingForApprovalPurposeDeletedV2,
          payload: writtenEvent.data,
        });

        expect(writtenPayload.purpose).toEqual(toPurposeV2(mockPurpose1));
      });
      it("should throw purposeNotFound if the purpose doesn't exist", () => {
        expect(
          purposeService.deletePurpose({
            purposeId: mockPurpose.id,
            organizationId: mockPurpose.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeNotFound(mockPurpose.id));
      });
      it("should throw organizationIsNotTheConsumer if the requester is not the consumer", async () => {
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
          purposeService.deletePurpose({
            purposeId: mockPurpose1.id,
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
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.deletePurpose({
            purposeId: mockPurpose1.id,
            organizationId: mockPurpose1.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeCannotBeDeleted(mockPurpose1.id));
      });
      it("should throw purposeCannotBeDeleted if the purpose has a rejected version ", async () => {
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
          purposeService.deletePurpose({
            purposeId: mockPurpose1.id,
            organizationId: mockPurpose1.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeCannotBeDeleted(mockPurpose1.id));
      });
      it("should throw purposeCannotBeDeleted if the purpose has a suspeneded version ", async () => {
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
          purposeService.deletePurpose({
            purposeId: mockPurpose1.id,
            organizationId: mockPurpose1.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeCannotBeDeleted(mockPurpose1.id));
      });
      it("should throw purposeCannotBeDeleted if the purpose has an archived version ", async () => {
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
          purposeService.deletePurpose({
            purposeId: mockPurpose1.id,
            organizationId: mockPurpose1.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeCannotBeDeleted(mockPurpose1.id));
      });
    });

    describe("archivePurposeVersion", () => {
      it("should write on event-store for the archiving of a purpose", () => {});
      it("should throw purposeNotFound if the purpose doesn't exist", async () => {
        const randomPurposeId: PurposeId = generateId();
        const randomVersionId: PurposeVersionId = generateId();
        await addOnePurpose(mockPurpose, postgresDB, purposes);

        expect(
          purposeService.archivePurposeVersion({
            purposeId: randomPurposeId,
            versionId: randomVersionId,
            organizationId: mockPurpose.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeNotFound(randomPurposeId));
      });
      it("should throw organizationIsNotTheConsumer if the requester is not the consumer", async () => {
        const randomOrganizationId: TenantId = generateId();

        const mockPurposeVersion: PurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.active,
        };
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);

        expect(
          purposeService.archivePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            organizationId: randomOrganizationId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          organizationIsNotTheConsumer(randomOrganizationId)
        );
      });
      it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
        const randomVersionId: PurposeVersionId = generateId();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          versions: [],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);

        expect(
          purposeService.archivePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: randomVersionId,
            organizationId: mockPurpose.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          purposeVersionNotFound(mockPurpose1.id, randomVersionId)
        );
      });
      it("should throw notValidVersionState if the purpose version is in draft state", async () => {
        const mockPurposeVersion: PurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.draft,
        };
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);

        expect(
          purposeService.archivePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            organizationId: mockPurpose1.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
        );
      });
      it("should throw notValidVersionState if the purpose version is in waitingForApproval state", async () => {
        const mockPurposeVersion: PurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.waitingForApproval,
        };
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);

        expect(
          purposeService.archivePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            organizationId: mockPurpose1.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
        );
      });
      it("should throw notValidVersionState if the purpose version is in rejected state", async () => {
        const mockPurposeVersion: PurposeVersion = {
          ...getMockPurposeVersion(),
          state: purposeVersionState.rejected,
        };
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);

        expect(
          purposeService.archivePurposeVersion({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            organizationId: mockPurpose1.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
        );
      });
    });
  });
});
