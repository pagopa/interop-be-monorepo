/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  PurposeCollection,
  riskAnalysisFormToRiskAnalysisFormToValidate,
} from "pagopa-interop-commons";
import {
  StoredEvent,
  getMockTenant,
  writeInEventstore,
  writeInReadmodel,
  getMockDescriptorPublished,
  getMockAgreement,
  getMockPurposeVersion,
  getMockPurpose,
  getMockValidRiskAnalysisForm,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  Descriptor,
  EService,
  Purpose,
  PurposeEvent,
  PurposeVersion,
  RiskAnalysis,
  Tenant,
  agreementState,
  generateId,
  purposeVersionState,
  technology,
  toPurposeV2,
  unsafeBrandId,
  toReadModelEService,
} from "pagopa-interop-models";
import { IDatabase } from "pg-promise";
import {
  ApiPurposeUpdateContent,
  ApiReversePurposeUpdateContent,
  ApiRiskAnalysisFormSeed,
} from "../src/model/domain/models.js";
import { PurposeRiskAnalysisFormV2 } from "../../models/dist/gen/v2/purpose/riskAnalysis.js";
import {
  postgresDB,
  purposes,
  eservices,
  agreements,
  tenants,
} from "./purposeService.integration.test.js";

export const addOnePurpose = async (
  purpose: Purpose,
  postgresDB: IDatabase<unknown>,
  purposes: PurposeCollection
): Promise<void> => {
  await writePurposeInEventstore(purpose, postgresDB);
  await writeInReadmodel(purpose, purposes);
};

export const writePurposeInEventstore = async (
  purpose: Purpose,
  postgresDB: IDatabase<unknown>
): Promise<void> => {
  const purposeEvent: PurposeEvent = {
    type: "PurposeAdded",
    event_version: 2,
    data: { purpose: toPurposeV2(purpose) },
  };
  const eventToWrite: StoredEvent<PurposeEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: purposeEvent.data.purpose!.id,
    version: 0,
    event: purposeEvent,
  };

  await writeInEventstore(eventToWrite, "purpose", postgresDB);
};

export const getMockEService = (): EService => ({
  id: generateId(),
  name: "eService name",
  description: "eService description",
  createdAt: new Date(),
  producerId: generateId(),
  technology: technology.rest,
  descriptors: [],
  attributes: undefined,
  riskAnalysis: [],
  mode: "Deliver",
});

export const buildRiskAnalysisSeed = (
  riskAnalysis: RiskAnalysis
): ApiRiskAnalysisFormSeed =>
  riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysis.riskAnalysisForm);

export const createUpdatedPurpose = (
  mockPurpose: Purpose,
  purposeUpdateContent:
    | ApiPurposeUpdateContent
    | ApiReversePurposeUpdateContent,
  mockValidRiskAnalysis: RiskAnalysis,
  writtenRiskAnalysisForm: PurposeRiskAnalysisFormV2
): Purpose => ({
  ...mockPurpose,
  title: purposeUpdateContent.title,
  description: purposeUpdateContent.description,
  isFreeOfCharge: purposeUpdateContent.isFreeOfCharge,
  freeOfChargeReason: purposeUpdateContent.freeOfChargeReason,
  versions: [
    {
      ...mockPurpose.versions[0],
      dailyCalls: purposeUpdateContent.dailyCalls,
      updatedAt: new Date(),
    },
  ],
  updatedAt: new Date(),
  riskAnalysisForm: {
    ...mockValidRiskAnalysis.riskAnalysisForm,
    id: unsafeBrandId(writtenRiskAnalysisForm.id),
    singleAnswers: mockValidRiskAnalysis.riskAnalysisForm.singleAnswers.map(
      (singleAnswer) => ({
        ...singleAnswer,
        id: unsafeBrandId(
          writtenRiskAnalysisForm.singleAnswers.find(
            (sa) => sa.key === singleAnswer.key
          )!.id
        ),
      })
    ),
    multiAnswers: mockValidRiskAnalysis.riskAnalysisForm.multiAnswers.map(
      (multiAnswer) => ({
        ...multiAnswer,
        id: unsafeBrandId(
          writtenRiskAnalysisForm.multiAnswers.find(
            (ma) => ma.key === multiAnswer.key
          )!.id
        ),
      })
    ),
  },
});

export async function prepareReadModelForPurposeTest(options?: {
  consumer?: Partial<Tenant>;
  producer?: Partial<Tenant>;
  eservice?: Partial<EService>;
  eserviceDescriptor?: Partial<Descriptor>;
  agreement?: Partial<Agreement>;
  purpose?: Partial<Purpose>;
  purposeVersion?: Partial<PurposeVersion>;
}): Promise<{
  mockConsumer: Tenant;
  mockProducer: Tenant;
  mockEService: EService;
  mockAgreement: Agreement;
  mockPurpose: Purpose;
  mockPurposeVersion: PurposeVersion;
}> {
  const mockConsumer: Tenant = {
    ...getMockTenant(),
    kind: "PA",
    ...options?.consumer,
  };

  const mockProducer: Tenant = {
    ...getMockTenant(),
    kind: "PA",
    ...options?.producer,
  };

  const mockEServiceDescriptor: Descriptor = {
    ...getMockDescriptorPublished(),
    ...options?.eserviceDescriptor,
  };

  const mockEService: EService = {
    ...getMockEService(),
    ...options?.eservice,
    producerId: mockProducer.id,
    descriptors: [mockEServiceDescriptor],
  };

  const mockAgreement: Agreement = {
    ...getMockAgreement(),
    eserviceId: mockEService.id,
    consumerId: mockConsumer.id,
    descriptorId: mockEService.descriptors[0].id,
    state: agreementState.active,
    ...options?.agreement,
  };

  const mockPurposeVersion: PurposeVersion = {
    ...getMockPurposeVersion(),
    state: purposeVersionState.active,
    ...options?.purposeVersion,
  };

  const mockPurpose: Purpose = {
    ...getMockPurpose(),
    riskAnalysisForm: getMockValidRiskAnalysisForm("PA"),
    consumerId: mockAgreement.consumerId,
    eserviceId: mockEService.id,
    versions: [mockPurposeVersion],
  };

  await addOnePurpose(mockPurpose, postgresDB, purposes);
  await writeInReadmodel(toReadModelEService(mockEService), eservices);
  await writeInReadmodel(mockAgreement, agreements);
  await writeInReadmodel(mockConsumer, tenants);
  await writeInReadmodel(mockProducer, tenants);

  return {
    mockConsumer,
    mockProducer,
    mockEService,
    mockAgreement,
    mockPurpose,
    mockPurposeVersion,
  };
}
