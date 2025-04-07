import {
  EService,
  agreementApprovalPolicy,
  descriptorState,
  generateId,
  technology,
} from "pagopa-interop-models";

export const completeEService: EService = {
  id: "8ab11d8c-5091-4a89-9527-f7c3791aa6d2" as any, // EServiceId
  producerId: generateId(), // TenantId
  name: "Complete eService Example",
  description: "This is a complete eService with all fields populated",
  technology: technology.rest as any,
  attributes: {
    certified: [[{ id: generateId(), explicitAttributeVerification: true }]],
    declared: [[{ id: generateId(), explicitAttributeVerification: false }]],
    verified: [[{ id: generateId(), explicitAttributeVerification: true }]],
  },
  descriptors: [
    {
      id: "ff55200c-f2e1-4c18-a1a5-fdc069d436b2" as any, // DescriptorId
      version: "2.0",
      description: "Complete descriptor example updated",
      interface: {
        id: "a6346406-54b9-4a15-8c25-bc42e0828694" as any, // EServiceDocumentId
        name: "Interface Document",
        contentType: "application/pdf",
        prettyName: "Interface PDF",
        path: "/docs/interface.pdf",
        checksum: "abc123",
        uploadDate: new Date(),
      },
      docs: [
        {
          id: generateId(), // EServiceDocumentId
          name: "Document 1",
          contentType: "application/pdf",
          prettyName: "Document PDF",
          path: "/docs/doc1.pdf",
          checksum: "def456",
          uploadDate: new Date().toISOString() as any,
        },
      ],
      state: descriptorState.published,
      audience: ["public"],
      voucherLifespan: 3600,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 1000,
      agreementApprovalPolicy: agreementApprovalPolicy.automatic,
      createdAt: new Date(),
      serverUrls: ["https://api.example.com"],
      publishedAt: new Date(),
      suspendedAt: new Date(),
      deprecatedAt: new Date(),
      archivedAt: new Date(),
      attributes: {
        certified: [
          [
            {
              id: "ff55200c-f2e1-4c18-a1a5-fdc069d436b2" as any,
              explicitAttributeVerification: true,
            },
          ],
        ],
        declared: [
          [
            {
              id: generateId(),
              explicitAttributeVerification: false,
            },
          ],
        ],
        verified: [
          [
            {
              id: generateId(),
              explicitAttributeVerification: true,
            },
          ],
        ],
      },
      rejectionReasons: [
        {
          rejectionReason: "Incomplete documentation",
          rejectedAt: new Date(),
        },
      ],
      templateVersionRef: {
        id: "ff55200c-f2e1-4c18-a1a5-fdc069d436b2" as any, // EServiceTemplateVersionId
        interfaceMetadata: {
          contactName: "John Doe",
          contactEmail: "john.doe@example.com",
          contactUrl: "https://example.com/contact",
          termsAndConditionsUrl: "https://example.com/terms",
        },
      },
    },
    {
      id: generateId(), // DescriptorId
      version: "2.0",
      description: "Complete descriptor example updated",
      interface: {
        id: generateId(), // EServiceDocumentId
        name: "Interface Document",
        contentType: "application/pdf",
        prettyName: "Interface PDF",
        path: "/docs/interface.pdf",
        checksum: "abc123",
        uploadDate: new Date(),
      },
      docs: [
        {
          id: generateId(), // EServiceDocumentId
          name: "Document 1",
          contentType: "application/pdf",
          prettyName: "Document PDF",
          path: "/docs/doc1.pdf",
          checksum: "def456",
          uploadDate: new Date(),
        },
      ],
      state: descriptorState.published,
      audience: ["public"],
      voucherLifespan: 3600,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 1000,
      agreementApprovalPolicy: agreementApprovalPolicy.automatic,
      createdAt: new Date(),
      serverUrls: ["https://api.example.com"],
      publishedAt: new Date(),
      suspendedAt: new Date(),
      deprecatedAt: new Date(),
      archivedAt: new Date(),
      attributes: {
        certified: [
          [
            {
              id: generateId(),
              explicitAttributeVerification: true,
            },
          ],
        ],
        declared: [
          [
            {
              id: generateId(),
              explicitAttributeVerification: false,
            },
          ],
        ],
        verified: [
          [
            {
              id: generateId(),
              explicitAttributeVerification: true,
            },
          ],
        ],
      },
      rejectionReasons: [
        {
          rejectionReason: "Incomplete documentation",
          rejectedAt: new Date(),
        },
      ],
      templateVersionRef: {
        id: generateId(), // EServiceTemplateVersionId
        interfaceMetadata: {
          contactName: "John Doe",
          contactEmail: "john.doe@example.com",
          contactUrl: "https://example.com/contact",
          termsAndConditionsUrl: "https://example.com/terms",
        },
      },
    },
  ],
  createdAt: new Date(),
  riskAnalysis: [
    {
      name: "riskanalsys name",
      id: generateId(),
      createdAt: new Date(),
      riskAnalysisForm: {
        id: generateId(),
        version: "2",
        singleAnswers: [
          {
            id: generateId(),
            key: "",
            value: "",
          },
        ],
        multiAnswers: [
          {
            id: generateId(),
            key: "",
            values: ["123"],
          },
        ],
      },
    },
  ], // Populate with RiskAnalysis items if needed
  mode: "Deliver",
  isSignalHubEnabled: true,
  isConsumerDelegable: true,
  isClientAccessDelegable: false,
  templateRef: {
    id: "8ab11d8c-5091-4a89-9527-f7c3791aa6d2" as any, // EServiceTemplateId
    instanceLabel: "Template Instance Example",
  },
};
export const completeEService2: EService = {
  id: generateId(), // EServiceId
  producerId: generateId(), // TenantId
  name: "Complete eService Example",
  description: "This is a complete eService with all fields populated",
  technology: technology.rest as any,
  attributes: {
    certified: [[{ id: generateId(), explicitAttributeVerification: true }]],
    declared: [[{ id: generateId(), explicitAttributeVerification: false }]],
    verified: [[{ id: generateId(), explicitAttributeVerification: true }]],
  },
  descriptors: [
    {
      id: generateId(), // DescriptorId
      version: "2.0",
      description: "Complete descriptor example updated",
      interface: {
        id: generateId(), // EServiceDocumentId
        name: "Interface Document",
        contentType: "application/pdf",
        prettyName: "Interface PDF",
        path: "/docs/interface.pdf",
        checksum: "abc123",
        uploadDate: new Date(),
      },
      docs: [
        {
          id: generateId(), // EServiceDocumentId
          name: "Document 1",
          contentType: "application/pdf",
          prettyName: "Document PDF",
          path: "/docs/doc1.pdf",
          checksum: "def456",
          uploadDate: new Date(),
        },
      ],
      state: descriptorState.published,
      audience: ["public"],
      voucherLifespan: 3600,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 1000,
      agreementApprovalPolicy: agreementApprovalPolicy.automatic,
      createdAt: new Date(),
      serverUrls: ["https://api.example.com"],
      publishedAt: new Date(),
      suspendedAt: new Date(),
      deprecatedAt: new Date(),
      archivedAt: new Date(),
      attributes: {
        certified: [
          [
            {
              id: generateId(),
              explicitAttributeVerification: true,
            },
          ],
        ],
        declared: [
          [
            {
              id: generateId(),
              explicitAttributeVerification: false,
            },
          ],
        ],
        verified: [
          [
            {
              id: generateId(),
              explicitAttributeVerification: true,
            },
          ],
        ],
      },
      rejectionReasons: [
        {
          rejectionReason: "Incomplete documentation",
          rejectedAt: new Date(),
        },
      ],
      templateVersionRef: {
        id: generateId(), // EServiceTemplateVersionId
        interfaceMetadata: {
          contactName: "John Doe",
          contactEmail: "john.doe@example.com",
          contactUrl: "https://example.com/contact",
          termsAndConditionsUrl: "https://example.com/terms",
        },
      },
    },
  ],
  createdAt: new Date(),
  riskAnalysis: [
    {
      name: "riskanalsys name",
      id: generateId(),
      createdAt: new Date(),
      riskAnalysisForm: {
        id: generateId(),
        version: "2",
        singleAnswers: [
          {
            id: generateId(),
            key: "",
            value: "",
          },
        ],
        multiAnswers: [
          {
            id: generateId(),
            key: "",
            values: ["123"],
          },
        ],
      },
    },
  ], // Populate with RiskAnalysis items if needed
  mode: "Deliver",
  isSignalHubEnabled: true,
  isConsumerDelegable: true,
  isClientAccessDelegable: false,
  templateRef: {
    id: generateId(), // EServiceTemplateId
    instanceLabel: "Template Instance Example",
  },
};

// Sample UUIDs for testing purposes
// const sampleDescriptorId = "ff55200c-f2e1-4c18-a1a5-fdc069d436b2";

// // Updated envelope helper that includes event_version: 2
// // Sample UUIDs for testing purposes

// // Helper to create an envelope for event version 2
// function createEnvelopeV2<T>(
//   event: T,
//   sequence: number,
// ): T & {
//   sequence_num: number;
//   stream_id: string;
//   version: number;
//   correlation_id: string | null;
//   log_date: Date;
//   event_version: 2;
// } {
//   return {
//     sequence_num: sequence,
//     stream_id: "00000000-0000-0000-0000-000000000001",
//     version: randomInt(0, 9999),
//     correlation_id: null,
//     log_date: new Date(),
//     event_version: 2,
//     ...event,
//   };
// }

// Assuming `completeEService` is imported from your test setup
// const events: EServiceEventEnvelopeV2[] = [
//   // 1. EServiceAdded
//   createEnvelopeV2(
//     {
//       type: "EServiceAdded",
//       data: { eservice: completeEService as any as any },
//     },
//     1,
//   ),

//   // // 2. DraftEServiceUpdated
//   // createEnvelopeV2(
//   //   {
//   //     type: "DraftEServiceUpdated",
//   //     data: { eservice: completeEService as any },
//   //   },
//   //   2,
//   // ),
//   // 3. EServiceDeleted
//   // createEnvelopeV2(
//   //   { type: "EServiceDeleted", data: { eserviceId: sampleEServiceId } },
//   //   3,
//   // ),
//   createEnvelopeV2(
//     {
//       type: "EServiceRiskAnalysisDeleted",
//       data: { riskAnalysisId: "sampleRiskAnalysisId" },
//     },
//     3,
//   ),
//   // // 4. EServiceCloned
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceCloned",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       sourceDescriptorId: sampleDescriptorId,
//   //     },
//   //   },
//   //   4,
//   // ),
//   // // 5. EServiceDescriptorAdded
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorAdded",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //     },
//   //   },
//   //   5,
//   // ),
//   // // 6. EServiceDraftDescriptorUpdated
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDraftDescriptorUpdated",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //     },
//   //   },
//   //   6,
//   // ),
//   // // 7. EServiceDescriptorQuotasUpdated
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorQuotasUpdated",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //     },
//   //   },
//   //   7,
//   // ),
//   // // 8. EServiceDescriptorActivated
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorActivated",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //     },
//   //   },
//   //   8,
//   // ),
//   // 9. EServiceDescriptorArchived
//   createEnvelopeV2(
//     {
//       type: "EServiceDescriptorArchived",
//       data: {
//         eservice: completeEService as any,
//         descriptorId: sampleDescriptorId,
//       },
//     },
//     9,
//   ),
//   // // 10. EServiceDescriptorPublished
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorPublished",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //     },
//   //   },
//   //   10,
//   // ),
//   // // 11. EServiceDescriptorSuspended
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorSuspended",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //     },
//   //   },
//   //   11,
//   // ),
//   // 12. EServiceDraftDescriptorDeleted
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDraftDescriptorDeleted",
//   //     data: { descriptorId: sampleDescriptorId },
//   //   },
//   //   12,
//   // ),
//   // // 13. EServiceDescriptorInterfaceAdded
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorInterfaceAdded",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //       documentId: sampleDocumentId,
//   //     },
//   //   },
//   //   13,
//   // ),
//   // // 14. EServiceDescriptorDocumentAdded
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorDocumentAdded",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //       documentId: sampleDocumentId,
//   //     },
//   //   },
//   //   14,
//   // ),
//   // // 15. EServiceDescriptorInterfaceUpdated
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorInterfaceUpdated",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //       documentId: sampleDocumentId,
//   //     },
//   //   },
//   //   15,
//   // ),
//   // // 16. EServiceDescriptorDocumentUpdated
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorDocumentUpdated",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //       documentId: sampleDocumentId,
//   //     },
//   //   },
//   //   16,
//   // ),
//   // // 17. EServiceDescriptorInterfaceDeleted
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorInterfaceDeleted",
//   //     data: {
//   //       descriptorId: sampleDescriptorId,
//   //       documentId: sampleDocumentId,
//   //     },
//   //   },
//   //   17,
//   // ),
//   // // 18. EServiceDescriptorDocumentDeleted
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorDocumentDeleted",
//   //     data: {
//   //       descriptorId: sampleDescriptorId,
//   //       documentId: sampleDocumentId,
//   //     },
//   //   },
//   //   18,
//   // ),
//   // // 19. EServiceRiskAnalysisAdded
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceRiskAnalysisAdded",
//   //     data: { eservice: completeEService as any, riskAnalysisId: generateId() },
//   //   },
//   //   19,
//   // ),
//   // // 20. EServiceRiskAnalysisUpdated
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceRiskAnalysisUpdated",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       riskAnalysisId: sampleRiskAnalysisId,
//   //     },
//   //   },
//   //   20,
//   // ),
//   // // 21. EServiceRiskAnalysisDeleted
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceRiskAnalysisDeleted",
//   //     data: { riskAnalysisId: sampleRiskAnalysisId },
//   //   },
//   //   21,
//   // ),
//   // // 22. EServiceDescriptionUpdated
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptionUpdated",
//   //     data: { eservice: completeEService as any },
//   //   },
//   //   22,
//   // ),
//   // // 23. EServiceDescriptorSubmittedByDelegate
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorSubmittedByDelegate",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //     },
//   //   },
//   //   23,
//   // ),
//   // // 24. EServiceDescriptorApprovedByDelegator
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorApprovedByDelegator",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //     },
//   //   },
//   //   24,
//   // ),
//   // // 25. EServiceDescriptorRejectedByDelegator
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorRejectedByDelegator",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //     },
//   //   },
//   //   25,
//   // ),
//   // // 26. EServiceDescriptorAttributesUpdated
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorAttributesUpdated",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //       attributeIds: [generateId()],
//   //     },
//   //   },
//   //   26,
//   // ),
//   // // 27. EServiceIsConsumerDelegableEnabled
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceIsConsumerDelegableEnabled",
//   //     data: { eservice: completeEService as any },
//   //   },
//   //   27,
//   // ),
//   // // 28. EServiceIsConsumerDelegableDisabled
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceIsConsumerDelegableDisabled",
//   //     data: { eservice: completeEService as any },
//   //   },
//   //   28,
//   // ),
//   // // 29. EServiceIsClientAccessDelegableEnabled
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceIsClientAccessDelegableEnabled",
//   //     data: { eservice: completeEService as any },
//   //   },
//   //   29,
//   // ),
//   // // 30. EServiceIsClientAccessDelegableDisabled
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceIsClientAccessDelegableDisabled",
//   //     data: { eservice: completeEService as any },
//   //   },
//   //   30,
//   // ),
//   // // 31. EServiceNameUpdated
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceNameUpdated",
//   //     data: { eservice: completeEService as any },
//   //   },
//   //   31,
//   // ),
//   // // 32. EServiceNameUpdatedByTemplateUpdate
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceNameUpdatedByTemplateUpdate",
//   //     data: { eservice: completeEService as any },
//   //   },
//   //   32,
//   // ),
//   // // 33. EServiceDescriptionUpdatedByTemplateUpdate
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptionUpdatedByTemplateUpdate",
//   //     data: { eservice: completeEService as any },
//   //   },
//   //   33,
//   // ),
//   // // 34. EServiceDescriptorQuotasUpdatedByTemplateUpdate
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //     },
//   //   },
//   //   34,
//   // ),
//   // // 35. EServiceDescriptorAttributesUpdatedByTemplateUpdate
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //       attributeIds: [generateId()],
//   //     },
//   //   },
//   //   35,
//   // ),
//   // // 36. EServiceDescriptorDocumentAddedByTemplateUpdate
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorDocumentAddedByTemplateUpdate",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //       documentId: sampleDocumentId,
//   //       attributeIds: [generateId()],
//   //     },
//   //   },
//   //   36,
//   // ),
//   // // 37. EServiceDescriptorDocumentUpdatedByTemplateUpdate
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: sampleDescriptorId,
//   //       documentId: sampleDocumentId,
//   //       attributeIds: [generateId()],
//   //     },
//   //   },
//   //   37,
//   // ),
//   // // 38. EServiceDescriptorDocumentDeletedByTemplateUpdate
//   // createEnvelopeV2(
//   //   {
//   //     type: "EServiceDescriptorDocumentDeletedByTemplateUpdate",
//   //     data: {
//   //       documentId: sampleDocumentId,
//   //       descriptorId: sampleDescriptorId,
//   //       attributeIds: [generateId()],
//   //     },
//   //   },
//   //   38,
//   // ),
// ];

// Sample UUIDs for testing
// const sampleEServiceId = "11111111-1111-1111-1111-111111111111";
// const sampleDocumentId = "33333333-3333-3333-3333-333333333333";
// const sampleRiskAnalysisId = "44444444-4444-4444-4444-444444444444";

// const generatedDoc = {
//   id: "33333333-3333-3333-3333-333333333333",
//   name: "privacy-policy",
//   contentType: "application/pdf",
//   path: "/documents/privacy-policy.pdf",
//   checksum: "abc123def456",
//   uploadDate: "2024-04-01T10:30:00.000Z",
//   prettyName: "Privacy Policy",
// };

// // Helper to create V1 envelope
// function createEnvelopeV1<T>(
//   event: T,
//   sequence: number,
// ): T & {
//   sequence_num: number;
//   stream_id: string;
//   version: number;
//   correlation_id: string | null;
//   log_date: Date;
//   event_version: 1;
// } {
//   return {
//     sequence_num: sequence,
//     stream_id: "00000000-0000-0000-0000-000000000001",
//     version: 2,
//     correlation_id: null,
//     log_date: new Date(),
//     event_version: 1,
//     ...event,
//   };
// }

// // Fake EService V1 data placeholders
// const eserviceV1 = { id: sampleEServiceId }; // semplificato
// const descriptorV1 = { id: sampleDescriptorId };
// const documentV1 = { id: sampleDocumentId };
// const riskAnalysisV1 = { id: sampleRiskAnalysisId };

// const v1Events: EServiceEventEnvelopeV1[] = [
//   // createEnvelopeV1(
//   //   { type: "EServiceAdded", data: { eservice: completeEService as any } },
//   //   1,
//   // ),
//   // createEnvelopeV1(
//   //   {
//   //     type: "ClonedEServiceAdded",
//   //     data: { eservice: completeEService as any },
//   //   },
//   //   2,
//   // ),
//   // createEnvelopeV1(
//   //   { type: "EServiceUpdated", data: { eservice: completeEService as any } },
//   //   3,
//   // ),
//   // createEnvelopeV1(
//   //   {
//   //     type: "EServiceWithDescriptorsDeleted",
//   //     data: {
//   //       eservice: completeEService as any,
//   //       descriptorId: descriptorV1.id,
//   //     },
//   //   },
//   //   4,
//   // ),
//   // createEnvelopeV1(
//   //   { type: "EServiceDeleted", data: { eserviceId: sampleEServiceId } },
//   //   6,
//   // ),
//   // createEnvelopeV1(
//   //   {
//   //     type: "EServiceDocumentAdded",
//   //     data: {
//   //       eserviceId: completeEService.id,
//   //       descriptorId: completeEService.descriptors[0].id,
//   //       isInterface: false,
//   //       serverUrls: ["asdas", "dskjgiwj"],
//   //       document: generatedDoc,
//   //     },
//   //   },
//   //   7,
//   // ),
//   createEnvelopeV1(
//     {
//       type: "EServiceDescriptorAdded",
//       data: {
//         eserviceDescriptor: completeEService.descriptors[0] as any,
//         eserviceId: completeEService.id,
//       },
//     },
//     9,
//   ),
//   // createEnvelopeV1(
//   //   {
//   //     type: "EServiceRiskAnalysisDeleted",
//   //     data: { riskAnalysisId: sampleRiskAnalysisId },
//   //   },
//   //   14,
//   // ),
// ];
