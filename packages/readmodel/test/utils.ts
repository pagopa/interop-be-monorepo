/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  agreementApprovalPolicy,
  Descriptor,
  DescriptorRejectionReason,
  Document,
  EService,
  EServiceAttribute,
  RiskAnalysis,
  riskAnalysisAnswerKind,
  stringToDate,
  tenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import {
  getMockDescriptorRejectionReason,
  getMockDocument,
  getMockEServiceAttribute,
  getMockValidRiskAnalysis,
  setupTestContainersVitest,
} from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import {
  EServiceDescriptorAttributeSQL,
  EServiceDescriptorDocumentSQL,
  EServiceDescriptorInterfaceSQL,
  EServiceDescriptorRejectionReasonSQL,
  EServiceDescriptorSQL,
  EServiceRiskAnalysisAnswerSQL,
  EServiceRiskAnalysisSQL,
  EServiceSQL,
} from "pagopa-interop-readmodel-models";
import { catalogReadModelServiceBuilder } from "../src/catalogReadModelServiceSQL.js";
import {
  retrieveEServiceSQL,
  retrieveEserviceDescriptorsSQL,
  retrieveEserviceRejectionReasonsSQL,
  retrieveEserviceDocumentsSQL,
  retrieveEserviceInterfacesSQL,
  retrieveEserviceAttributesSQL,
  retrieveEserviceRiskAnalysesSQL,
  retrieveEserviceRiskAnalysisAnswersSQL,
} from "./eserviceTestReadModelService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

export const readModelService = catalogReadModelServiceBuilder(readModelDB);

afterEach(cleanup);

export const generateRiskAnalysisAnswersSQL = (
  eserviceId: string,
  riskAnalyses: RiskAnalysis[]
): EServiceRiskAnalysisAnswerSQL[] =>
  riskAnalyses.flatMap(({ riskAnalysisForm }) => [
    ...riskAnalysisForm.singleAnswers.map(
      (a): EServiceRiskAnalysisAnswerSQL => ({
        id: a.id,
        eserviceId,
        metadataVersion: 1,
        key: a.key,
        value: a.value ? [a.value] : [],
        riskAnalysisFormId: riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.single,
      })
    ),
    ...riskAnalysisForm.multiAnswers.map(
      (a): EServiceRiskAnalysisAnswerSQL => ({
        id: a.id,
        eserviceId,
        metadataVersion: 1,
        key: a.key,
        value: a.values,
        riskAnalysisFormId: riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.multi,
      })
    ),
  ]);

export function stringToISOString(input: string): string;
export function stringToISOString(input: string | null): string | null;
export function stringToISOString(input: string | null): string | null {
  return input ? stringToDate(input).toISOString() : null;
}

export const initMockEService = (
  mockEService: WithMetadata<EService>,
  mockDescriptor: Descriptor,
  isEServiceComplete: boolean
): {
  eservice: WithMetadata<EService>;
  descriptor: Descriptor;
  rejectionReason: DescriptorRejectionReason | undefined;
  descriptorInterface: Document | undefined;
  document: Document;
  attributes: EServiceAttribute[];
  riskAnalyses: RiskAnalysis[];
} => {
  const rejectionReason = getMockDescriptorRejectionReason();
  const descriptorInterface = getMockDocument();
  const descriptorDocument = getMockDocument();
  const attributes = [getMockEServiceAttribute(), getMockEServiceAttribute()];
  const descriptor: Descriptor = {
    ...mockDescriptor,
    attributes: {
      certified: [[attributes[0]], [attributes[1]]],
      declared: [],
      verified: [],
    },
    docs: [descriptorDocument],
    ...(isEServiceComplete
      ? {
          interface: descriptorInterface,
          rejectionReasons: [rejectionReason],
          description: "description test",
          publishedAt: new Date(),
          suspendedAt: new Date(),
          deprecatedAt: new Date(),
          archivedAt: new Date(),
          agreementApprovalPolicy: agreementApprovalPolicy.automatic,
        }
      : {}),
  };

  if (!isEServiceComplete) {
    // eslint-disable-next-line fp/no-delete
    delete descriptor.agreementApprovalPolicy;
  }

  const riskAnalyses = [
    getMockValidRiskAnalysis(tenantKind.PA),
    getMockValidRiskAnalysis(tenantKind.PRIVATE),
  ];
  const eservice: WithMetadata<EService> = {
    ...mockEService,
    data: {
      ...mockEService.data,
      descriptors: [descriptor],
      riskAnalysis: riskAnalyses,
      ...(isEServiceComplete
        ? {
            isSignalHubEnabled: true,
            isConsumerDelegable: true,
            isClientAccessDelegable: true,
          }
        : {}),
    },
  };

  return {
    eservice,
    descriptor,
    rejectionReason: isEServiceComplete ? rejectionReason : undefined,
    descriptorInterface: isEServiceComplete ? descriptorInterface : undefined,
    document: descriptorDocument,
    attributes,
    riskAnalyses,
  };
};

export const retrieveAllEServiceSQLObjects = async (
  eservice: WithMetadata<EService>,
  isEServiceComplete: boolean
): Promise<{
  retrievedEserviceSQL: EServiceSQL | undefined;
  retrievedDescriptorsSQL: EServiceDescriptorSQL[] | undefined;
  retrievedRejectionReasonsSQL:
    | EServiceDescriptorRejectionReasonSQL[]
    | undefined;
  retrievedDocumentsSQL: EServiceDescriptorDocumentSQL[] | undefined;
  retrievedInterfacesSQL: EServiceDescriptorInterfaceSQL[] | undefined;
  retrievedAttributesSQL: EServiceDescriptorAttributeSQL[] | undefined;
  retrievedRiskAnalysesSQL: EServiceRiskAnalysisSQL[] | undefined;
  retrievedRiskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[] | undefined;
}> => {
  const retrievedEserviceSQL = await retrieveEServiceSQL(
    eservice.data.id,
    readModelDB
  );
  const retrievedAndFormattedEserviceSQL = retrievedEserviceSQL
    ? {
        ...retrievedEserviceSQL,
        createdAt: stringToISOString(retrievedEserviceSQL.createdAt),
      }
    : undefined;
  const retrievedDescriptorsSQL = await retrieveEserviceDescriptorsSQL(
    eservice.data.id,
    readModelDB
  );
  const retrievedAndFormattedDescriptorsSQL = retrievedDescriptorsSQL?.map(
    (descriptor) => ({
      ...descriptor,
      createdAt: stringToISOString(descriptor.createdAt),
      ...(isEServiceComplete
        ? {
            publishedAt: stringToISOString(descriptor.publishedAt),
            suspendedAt: stringToISOString(descriptor.suspendedAt),
            deprecatedAt: stringToISOString(descriptor.deprecatedAt),
            archivedAt: stringToISOString(descriptor.archivedAt),
          }
        : {}),
    })
  );
  const retrievedRejectionReasonsSQL =
    await retrieveEserviceRejectionReasonsSQL(eservice.data.id, readModelDB);
  const retrievedAndFormattedRejectionReasonsSQL =
    retrievedRejectionReasonsSQL?.map((rejection) => ({
      ...rejection,
      rejectedAt: stringToISOString(rejection.rejectedAt),
    }));

  const retrievedDocuments = await retrieveEserviceDocumentsSQL(
    eservice.data.id,
    readModelDB
  );
  const retrievedAndFormattedDocumentsSQL = retrievedDocuments?.map((doc) => ({
    ...doc,
    uploadDate: stringToISOString(doc.uploadDate),
  }));

  const retrievedInterfaces = await retrieveEserviceInterfacesSQL(
    eservice.data.id,
    readModelDB
  );
  const retrievedAndFormattedInterfacesSQL = retrievedInterfaces?.map((i) => ({
    ...i,
    uploadDate: stringToISOString(i.uploadDate),
  }));
  const retrievedAttributesSQL = await retrieveEserviceAttributesSQL(
    eservice.data.id,
    readModelDB
  );
  const retrievedRiskAnalyses = await retrieveEserviceRiskAnalysesSQL(
    eservice.data.id,
    readModelDB
  );
  const retrievedAndFormattedRiskAnalysesSQL = retrievedRiskAnalyses?.map(
    (ra) => ({
      ...ra,
      createdAt: stringToISOString(ra.createdAt),
    })
  );
  const retrievedRiskAnalysisAnswersSQL =
    await retrieveEserviceRiskAnalysisAnswersSQL(eservice.data.id, readModelDB);

  return {
    retrievedEserviceSQL: retrievedAndFormattedEserviceSQL,
    retrievedDescriptorsSQL: retrievedAndFormattedDescriptorsSQL,
    retrievedAttributesSQL,
    retrievedDocumentsSQL: retrievedAndFormattedDocumentsSQL,
    retrievedInterfacesSQL: retrievedAndFormattedInterfacesSQL,
    retrievedRejectionReasonsSQL: retrievedAndFormattedRejectionReasonsSQL,
    retrievedRiskAnalysesSQL: retrievedAndFormattedRiskAnalysesSQL,
    retrievedRiskAnalysisAnswersSQL,
  };
};
