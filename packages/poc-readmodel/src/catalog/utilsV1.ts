// "EServiceAdded",
// "ClonedEServiceAdded"
// insert in all the tables

// "EServiceUpdated"
// delete cascade from all the tables and replace

// "EServiceRiskAnalysisAdded"
// TODO

// "MovedAttributesFromEserviceToDescriptors"
// insert only in attributes table

// "EServiceRiskAnalysisUpdated"
// delete cascade from risk analysis and replace

// "EServiceWithDescriptorsDeleted"
// delete cascade from descriptor

// "EServiceDocumentUpdated"
// update only in document table? (beware of interface and docs)
// IMPORTANT: interface also brings new serverUrls value in descriptor table

// "EServiceDeleted"
// delete cascade from eservice

// "EServiceDocumentAdded"
// same considerations of EServiceDocumentUpdated

// "EServiceDocumentDeleted"
// delete in document table, plus what about serverUrls?

// "EServiceDescriptorAdded"
// create in all the tables from descriptor

// "EServiceDescriptorUpdated"
// replace cascade, from descriptor

// "EServiceRiskAnalysisDeleted"
// TODO
