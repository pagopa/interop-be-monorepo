/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  agreementApprovalPolicy,
  attributeKind,
  Descriptor,
  EService,
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

export const generateTestCatalogSQLObjects = async (
  isEServiceComplete: boolean,
  isUpdate: boolean
): Promise<{
  retrieved: {
    retrievedEserviceSQL: EServiceSQL | undefined;
    retrievedDescriptorsSQL: EServiceDescriptorSQL[] | undefined;
    retrievedRejectionReasonsSQL:
      | EServiceDescriptorRejectionReasonSQL[]
      | undefined;
    retrievedDocumentsSQL: EServiceDescriptorDocumentSQL[] | undefined;
    retrievedInterfacesSQL: EServiceDescriptorInterfaceSQL[] | undefined;
    retrievedAttributesSQL: EServiceDescriptorAttributeSQL[] | undefined;
    retrievedRiskAnalysesSQL: EServiceRiskAnalysisSQL[] | undefined;
    retrievedRiskAnalysisAnswersSQL:
      | EServiceRiskAnalysisAnswerSQL[]
      | undefined;
  };
  expected: {
    expectedEserviceSQL: EServiceSQL;
    expectedDescriptorsSQL: EServiceDescriptorSQL[];
    expectedAttributesSQL: EServiceDescriptorAttributeSQL[];
    expectedDocumentsSQL: EServiceDescriptorDocumentSQL[];
    expectedInterfacesSQL: EServiceDescriptorInterfaceSQL[] | undefined;
    expectedRejectionReasonsSQL:
      | EServiceDescriptorRejectionReasonSQL[]
      | undefined;
    expectedRiskAnalysesSQL: EServiceRiskAnalysisSQL[];
    expectedRiskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[];
  };
}> => {
  const metadataVersion = 1;
  const rejectionReason = getMockDescriptorRejectionReason();
  const descriptorInterface = getMockDocument();
  const descriptorDocument = getMockDocument();
  const attributes = [getMockEServiceAttribute(), getMockEServiceAttribute()];
  const incompleteDescriptor = getMockDescriptor();
  const descriptor: Descriptor = {
    ...incompleteDescriptor,
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
      : {
          agreementApprovalPolicy: undefined,
        }),
  };

  const riskAnalyses = [
    getMockValidRiskAnalysis(tenantKind.PA),
    getMockValidRiskAnalysis(tenantKind.PRIVATE),
  ];
  const incompleteEService: WithMetadata<EService> = {
    data: {
      ...getMockEService(),
      descriptors: [incompleteDescriptor],
    },
    metadata: { version: metadataVersion },
  };
  const eservice: WithMetadata<EService> = {
    ...incompleteEService,
    data: {
      ...incompleteEService.data,
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

  if (isUpdate) {
    await readModelService.upsertEService(incompleteEService);
  }
  await readModelService.upsertEService(eservice);

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

  const expectedEserviceSQL: EServiceSQL = {
    name: eservice.data.name,
    description: eservice.data.description,
    id: eservice.data.id,
    metadataVersion: eservice.metadata.version,
    producerId: eservice.data.producerId,
    technology: eservice.data.technology,
    createdAt: eservice.data.createdAt.toISOString(),
    mode: eservice.data.mode,
    ...(isEServiceComplete
      ? {
          isSignalHubEnabled: eservice.data.isSignalHubEnabled!,
          isConsumerDelegable: eservice.data.isConsumerDelegable!,
          isClientAccessDelegable: eservice.data.isClientAccessDelegable!,
        }
      : {
          isSignalHubEnabled: null,
          isConsumerDelegable: null,
          isClientAccessDelegable: null,
        }),
  };
  const expectedDescriptorsSQL: EServiceDescriptorSQL[] = [
    {
      id: descriptor.id,
      eserviceId: eservice.data.id,
      metadataVersion,
      version: descriptor.version,
      state: descriptor.state,
      audience: descriptor.audience,
      voucherLifespan: descriptor.voucherLifespan,
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
      dailyCallsTotal: descriptor.dailyCallsTotal,
      createdAt: descriptor.createdAt.toISOString(),
      serverUrls: descriptor.serverUrls,
      ...(isEServiceComplete
        ? {
            agreementApprovalPolicy: descriptor.agreementApprovalPolicy!,
            description: descriptor.description!,
            publishedAt: descriptor.publishedAt!.toISOString(),
            suspendedAt: descriptor.suspendedAt!.toISOString(),
            deprecatedAt: descriptor.deprecatedAt!.toISOString(),
            archivedAt: descriptor.archivedAt!.toISOString(),
          }
        : {
            agreementApprovalPolicy: null,
            description: null,
            publishedAt: null,
            suspendedAt: null,
            deprecatedAt: null,
            archivedAt: null,
          }),
    },
  ];
  const expectedRejectionReasonsSQL:
    | EServiceDescriptorRejectionReasonSQL[]
    | undefined =
    isEServiceComplete && rejectionReason
      ? [
          {
            eserviceId: eservice.data.id,
            metadataVersion,
            descriptorId: descriptor.id,
            rejectionReason: rejectionReason.rejectionReason,
            rejectedAt: rejectionReason.rejectedAt.toISOString(),
          },
        ]
      : undefined;
  const expectedInterfacesSQL: EServiceDescriptorInterfaceSQL[] | undefined =
    isEServiceComplete && descriptorInterface
      ? [
          {
            id: descriptorInterface.id,
            eserviceId: eservice.data.id,
            metadataVersion,
            descriptorId: descriptor.id,
            name: descriptorInterface.name,
            contentType: descriptorInterface.contentType,
            prettyName: descriptorInterface.prettyName,
            path: descriptorInterface.path,
            checksum: descriptorInterface.checksum,
            uploadDate: descriptorInterface.uploadDate.toISOString(),
          },
        ]
      : undefined;
  const expectedDocumentsSQL: EServiceDescriptorDocumentSQL[] = [
    {
      id: descriptorDocument.id,
      eserviceId: eservice.data.id,
      metadataVersion,
      descriptorId: descriptor.id,
      name: descriptorDocument.name,
      contentType: descriptorDocument.contentType,
      prettyName: descriptorDocument.prettyName,
      path: descriptorDocument.path,
      checksum: descriptorDocument.checksum,
      uploadDate: descriptorDocument.uploadDate.toISOString(),
    },
  ];
  const expectedAttributesSQL: EServiceDescriptorAttributeSQL[] =
    attributes.map((attribute, idx) => ({
      attributeId: attribute.id,
      eserviceId: eservice.data.id,
      metadataVersion,
      descriptorId: descriptor.id,
      explicitAttributeVerification: attribute.explicitAttributeVerification,
      kind: attributeKind.certified,
      groupId: idx,
    }));
  const expectedRiskAnalysesSQL: EServiceRiskAnalysisSQL[] = riskAnalyses.map(
    (riskAnalysis) => ({
      id: riskAnalysis.id,
      eserviceId: eservice.data.id,
      metadataVersion,
      name: riskAnalysis.name,
      createdAt: riskAnalysis.createdAt.toISOString(),
      riskAnalysisFormId: riskAnalysis.riskAnalysisForm.id,
      riskAnalysisFormVersion: riskAnalysis.riskAnalysisForm.version,
    })
  );
  const expectedRiskAnalysisAnswersSQL = generateRiskAnalysisAnswersSQL(
    eservice.data.id,
    riskAnalyses
  );

  return {
    retrieved: {
      retrievedEserviceSQL: retrievedAndFormattedEserviceSQL,
      retrievedDescriptorsSQL: retrievedAndFormattedDescriptorsSQL,
      retrievedAttributesSQL,
      retrievedDocumentsSQL: retrievedAndFormattedDocumentsSQL,
      retrievedInterfacesSQL: retrievedAndFormattedInterfacesSQL,
      retrievedRejectionReasonsSQL: retrievedAndFormattedRejectionReasonsSQL,
      retrievedRiskAnalysesSQL: retrievedAndFormattedRiskAnalysesSQL,
      retrievedRiskAnalysisAnswersSQL,
    },
    expected: {
      expectedEserviceSQL,
      expectedDescriptorsSQL,
      expectedAttributesSQL,
      expectedDocumentsSQL,
      expectedInterfacesSQL,
      expectedRejectionReasonsSQL,
      expectedRiskAnalysesSQL,
      expectedRiskAnalysisAnswersSQL,
    },
  };
};

export function stringToISOString(input: string): string;
export function stringToISOString(input: string | null): string | null;
export function stringToISOString(input: string | null): string | null {
  return input ? stringToDate(input).toISOString() : null;
}
