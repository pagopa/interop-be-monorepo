export const catalogItemDescriptorUpdatedNotification = {
  messageUUID: "57a36acf-f9ca-45c2-a353-b29a13613bb3",
  eventJournalPersistenceId: "interop-be-catalog-management-persistence|11",
  eventJournalSequenceNumber: 203,
  eventTimestamp: 1711638179845,
  kind: "catalog_item_descriptor_updated",
  payload: {
    eServiceId: "d27f668f-630b-4889-a97f-2b7e39b24188",
    catalogDescriptor: {
      id: "6b48e234-aac6-4d33-aef4-93816588ff41",
      version: "1",
      description: "Questo è un e-service di test",
      docs: [],
      state: "Suspended",
      interface: {
        id: "4f1871f2-0082-4176-9edf-b6cbb735bf4d",
        name: "interface.yaml",
        contentType: "application/octet-stream",
        checksum:
          "575c48f91d7687237f01e29345c1189bd8b24a8e8d515bd372c8457bd6cb1ae8",
        path: "eservices/docs/4f1871f2-0082-4176-9edf-b6cbb735bf4d/interface.yaml",
        prettyName: "Interfaccia",
        uploadDate: "2024-03-26T10:16:05.449Z",
      },
      agreementApprovalPolicy: "Automatic",
      attributes: {
        certified: [
          [
            {
              id: "cbddada9-ad22-42c9-bb1d-9a832e34179e",
            },
          ],
        ],
        declared: [
          [
            {
              id: "cbddada9-ad22-42c9-bb1d-9a832e34179e",
            },
          ],
        ],
        verified: [
          [
            {
              id: "cbddada9-ad22-42c9-bb1d-9a832e34179e",
            },
          ],
        ],
      },
      audience: ["api/v1"],
      createdAt: "2024-03-26T10:16:03.946Z",
      dailyCallsPerConsumer: 10,
      dailyCallsTotal: 100,

      publishedAt: "2024-03-26T10:16:07.841Z",
      serverUrls: [
        "http://petstore.swagger.io/api/v1",
        "http://petstore.swagger.io/api/v2",
      ],
      suspendedAt: "2024-03-28T15:02:59.845Z",
      voucherLifespan: 60,
    },
  },
};
