/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { afterAll, afterEach, beforeAll, describe } from "vitest";
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
  mongoDBContainer,
  postgreSQLContainer,
} from "pagopa-interop-commons-test";
import { StartedTestContainer } from "testcontainers";
import { config } from "../src/utilities/config.js";
import {
  PurposeService,
  purposeServiceBuilder,
} from "../src/services/purposeService.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readModelService.js";
import { testGetPurposeById } from "./testGetPurposeById.js";
import { testGetRiskAnalysisDocument } from "./testGetRiskAnalysisDocument.js";
import { testDeletePurposeVersion } from "./testDeletePurposeVersion.js";
import { testRejectPurposeVersion } from "./testRejectPurposeVersion.js";

export let purposes: PurposeCollection;
export let eservices: EServiceCollection;
export let tenants: TenantCollection;
export let readModelService: ReadModelService;
export let purposeService: PurposeService;
export let postgresDB: IDatabase<unknown>;

describe("Integration tests", async () => {
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
    testGetPurposeById();
    testGetRiskAnalysisDocument();
    testDeletePurposeVersion();
    testRejectPurposeVersion();

    describe("updatePurpose and updateReversePurpose", () => {
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
      it.each(
        Object.values(purposeVersionState).filter(
          (state) => state !== purposeVersionState.draft
        )
      )(
        "Should throw purposeNotInDraftState if the purpose is in state %s",
        async (state) => {
          const mockPurpose: Purpose = {
            ...purposeForDeliver,
            versions: [{ ...getMockPurposeVersion(), state }],
          };

          await addOnePurpose(mockPurpose, postgresDB, purposes);
          await writeInReadmodel(
            toReadModelEService(eServiceDeliver),
            eservices
          );
          await writeInReadmodel(tenant, tenants);

          expect(
            purposeService.updatePurpose({
              purposeId: mockPurpose.id,
              purposeUpdateContent,
              organizationId: tenant.id,
              correlationId: generateId(),
            })
          ).rejects.toThrowError(purposeNotInDraftState(mockPurpose.id));
        }
      );
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
      it("should throw eServiceModeNotAllowed if the eService mode is incorrect when expecting DELIVER", async () => {
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
      });
      it("should throw eServiceModeNotAllowed if the eService mode is incorrect when expecting RECEIVE", async () => {
        await addOnePurpose(purposeForDeliver, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
        await writeInReadmodel(tenant, tenants);

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
      it("Should throw riskAnalysisValidationFailed if the risk analysis is not valid in updatePurpose", async () => {
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
      it("Should throw riskAnalysisValidationFailed if the risk analysis is not valid in updateReversePurpose", async () => {
        const purposeWithInvalidRiskAnalysis: Purpose = {
          ...purposeForReceive,
          riskAnalysisForm: {
            ...purposeForReceive.riskAnalysisForm!,
            version: "0",
          },
        };

        await addOnePurpose(
          purposeWithInvalidRiskAnalysis,
          postgresDB,
          purposes
        );
        await writeInReadmodel(toReadModelEService(eServiceReceive), eservices);
        await writeInReadmodel(tenant, tenants);

        expect(
          purposeService.updateReversePurpose({
            purposeId: purposeWithInvalidRiskAnalysis.id,
            reversePurposeUpdateContent,
            organizationId: tenant.id,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          riskAnalysisValidationFailed([unexpectedRulesVersionError("0")])
        );
      });
    });

  });
});
