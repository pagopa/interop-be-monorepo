/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  agreementApprovalPolicy,
  attributeKind,
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
  getMockDescriptor,
  getMockDescriptorRejectionReason,
  getMockDocument,
  getMockEService,
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
import { catalogReadModelServiceBuilderSQL } from "../src/catalogReadModelService.js";
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

export const readModelService = catalogReadModelServiceBuilderSQL(readModelDB);

afterEach(cleanup);

export const catalogReadModelService =
  catalogReadModelServiceBuilderSQL(readModelDB);

export function stringToISOString(input: string): string;
export function stringToISOString(input: string | null): string | null;
export function stringToISOString(input: string | null): string | null {
  return input ? stringToDate(input).toISOString() : null;
}

export const generateRiskAnalysisAnswersSQL = (
  eserviceId: string,
  riskAnalyses: RiskAnalysis[],
  metadataVersion: number
): EServiceRiskAnalysisAnswerSQL[] =>
  riskAnalyses.flatMap(({ riskAnalysisForm }) => [
    ...riskAnalysisForm.singleAnswers.map(
      (a): EServiceRiskAnalysisAnswerSQL => ({
        id: a.id,
        eserviceId,
        metadataVersion,
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
        metadataVersion,
        key: a.key,
        value: a.values,
        riskAnalysisFormId: riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.multi,
      })
    ),
  ]);

export const initMockEService = (
  isEServiceComplete: boolean
): {
  eserviceBeforeUpdate: WithMetadata<EService>;
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
  const descriptorBeforeUpdate = getMockDescriptor();
  const descriptor: Descriptor = {
    ...descriptorBeforeUpdate,
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
  const eserviceBeforeUpdate: WithMetadata<EService> = {
    data: {
      ...getMockEService(),
      descriptors: [descriptorBeforeUpdate],
    },
    metadata: {
      version: 1,
    },
  };
  const eservice: WithMetadata<EService> = {
    data: {
      ...eserviceBeforeUpdate.data,
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
    metadata: {
      version: 2,
    },
  };

  return {
    eserviceBeforeUpdate,
    eservice,
    descriptor,
    rejectionReason: isEServiceComplete ? rejectionReason : undefined,
    descriptorInterface: isEServiceComplete ? descriptorInterface : undefined,
    document: descriptorDocument,
    attributes,
    riskAnalyses,
  };
};

export const retrieveEServiceSQLObjects = async (
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

export const generateCompleteExpectedEServiceSQLObjects = ({
  eservice,
  descriptor,
  rejectionReason,
  descriptorInterface,
  document,
  attributes,
  riskAnalyses,
}: {
  eservice: WithMetadata<EService>;
  descriptor: Descriptor;
  rejectionReason: DescriptorRejectionReason;
  descriptorInterface: Document;
  document: Document;
  attributes: EServiceAttribute[];
  riskAnalyses: RiskAnalysis[];
}): {
  expectedEserviceSQL: EServiceSQL;
  expectedDescriptorsSQL: EServiceDescriptorSQL[];
  expectedRejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
  expectedInterfacesSQL: EServiceDescriptorInterfaceSQL[];
  expectedDocumentsSQL: EServiceDescriptorDocumentSQL[];
  expectedAttributesSQL: EServiceDescriptorAttributeSQL[];
  expectedRiskAnalysesSQL: EServiceRiskAnalysisSQL[];
  expectedRiskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[];
} => {
  const expectedEserviceSQL: EServiceSQL = {
    name: eservice.data.name,
    description: eservice.data.description,
    id: eservice.data.id,
    metadataVersion: eservice.metadata.version,
    producerId: eservice.data.producerId,
    technology: eservice.data.technology,
    createdAt: eservice.data.createdAt.toISOString(),
    mode: eservice.data.mode,
    isSignalHubEnabled: eservice.data.isSignalHubEnabled!,
    isConsumerDelegable: eservice.data.isConsumerDelegable!,
    isClientAccessDelegable: eservice.data.isClientAccessDelegable!,
  };
  const expectedDescriptorsSQL: EServiceDescriptorSQL[] = [
    {
      id: descriptor.id,
      eserviceId: eservice.data.id,
      metadataVersion: eservice.metadata.version,
      version: descriptor.version,
      state: descriptor.state,
      audience: descriptor.audience,
      voucherLifespan: descriptor.voucherLifespan,
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
      dailyCallsTotal: descriptor.dailyCallsTotal,
      createdAt: descriptor.createdAt.toISOString(),
      serverUrls: descriptor.serverUrls,
      agreementApprovalPolicy: descriptor.agreementApprovalPolicy!,
      description: descriptor.description!,
      publishedAt: descriptor.publishedAt!.toISOString(),
      suspendedAt: descriptor.suspendedAt!.toISOString(),
      deprecatedAt: descriptor.deprecatedAt!.toISOString(),
      archivedAt: descriptor.archivedAt!.toISOString(),
    },
  ];
  const expectedRejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[] = [
    {
      eserviceId: eservice.data.id,
      metadataVersion: eservice.metadata.version,
      descriptorId: descriptor.id,
      rejectionReason: rejectionReason.rejectionReason,
      rejectedAt: rejectionReason.rejectedAt.toISOString(),
    },
  ];
  const expectedInterfacesSQL: EServiceDescriptorInterfaceSQL[] = [
    {
      id: descriptorInterface.id,
      eserviceId: eservice.data.id,
      metadataVersion: eservice.metadata.version,
      descriptorId: descriptor.id,
      name: descriptorInterface.name,
      contentType: descriptorInterface.contentType,
      prettyName: descriptorInterface.prettyName,
      path: descriptorInterface.path,
      checksum: descriptorInterface.checksum,
      uploadDate: descriptorInterface.uploadDate.toISOString(),
    },
  ];
  const expectedDocumentsSQL: EServiceDescriptorDocumentSQL[] = [
    {
      id: document.id,
      eserviceId: eservice.data.id,
      metadataVersion: eservice.metadata.version,
      descriptorId: descriptor.id,
      name: document.name,
      contentType: document.contentType,
      prettyName: document.prettyName,
      path: document.path,
      checksum: document.checksum,
      uploadDate: document.uploadDate.toISOString(),
    },
  ];
  const expectedAttributesSQL: EServiceDescriptorAttributeSQL[] =
    attributes.map((attribute, idx) => ({
      attributeId: attribute.id,
      eserviceId: eservice.data.id,
      metadataVersion: eservice.metadata.version,
      descriptorId: descriptor.id,
      explicitAttributeVerification: attribute.explicitAttributeVerification,
      kind: attributeKind.certified,
      groupId: idx,
    }));
  const expectedRiskAnalysesSQL: EServiceRiskAnalysisSQL[] = riskAnalyses.map(
    (riskAnalysis) => ({
      id: riskAnalysis.id,
      eserviceId: eservice.data.id,
      metadataVersion: eservice.metadata.version,
      name: riskAnalysis.name,
      createdAt: riskAnalysis.createdAt.toISOString(),
      riskAnalysisFormId: riskAnalysis.riskAnalysisForm.id,
      riskAnalysisFormVersion: riskAnalysis.riskAnalysisForm.version,
    })
  );
  const expectedRiskAnalysisAnswersSQL = generateRiskAnalysisAnswersSQL(
    eservice.data.id,
    riskAnalyses,
    eservice.metadata.version
  );

  return {
    expectedEserviceSQL,
    expectedDescriptorsSQL,
    expectedRejectionReasonsSQL,
    expectedInterfacesSQL,
    expectedDocumentsSQL,
    expectedAttributesSQL,
    expectedRiskAnalysesSQL,
    expectedRiskAnalysisAnswersSQL,
  };
};
