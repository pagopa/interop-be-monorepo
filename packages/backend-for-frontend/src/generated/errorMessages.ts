// Generated from the error messages CSV. Do not edit manually.
import type { ErrorMessage } from "pagopa-interop-models";

export const errorMessages = [
  {
    "process": "Delegation Process",
    "error": "delegationNotAllowedForTenant",
    "errorCode": "010-0006",
    "bffEndpoint": "POST /producers/delegations",
    "copy": {
      "it": "Non puoi scegliere questo ente per la delega perché non è una Pubblica Amministrazione. Scegli un altro ente.",
      "en": "You can't select this party for the delegation because it isn't a Public Administration. Select another party."
    }
  },
  {
    "process": "Delegation Process",
    "error": "incorrectState",
    "errorCode": "010-0011",
    "bffEndpoint": "POST /producers/delegations/:delegationId/approve",
    "copy": {
      "it": "La delega non è più in attesa di approvazione. Aggiorna la pagina.",
      "en": "The delegation is no longer waiting for approval. Refresh the page."
    }
  },
  {
    "process": "Delegation Process",
    "error": "incorrectState",
    "errorCode": "010-0011",
    "bffEndpoint": "DELETE /producers/delegations/:delegationId",
    "copy": {
      "it": "Non puoi revocare la delega perché non è più attiva. Aggiorna la pagina.",
      "en": "You can't revoke the delegation because it is no longer active. Refresh the page."
    }
  },
  {
    "process": "Delegation Process",
    "error": "delegationNotAllowedForTenant",
    "errorCode": "010-0006",
    "bffEndpoint": "POST /consumers/delegations",
    "copy": {
      "it": "Non puoi scegliere questo ente per la delega perché non è una Pubblica Amministrazione. Scegli un altro ente.",
      "en": "You can't select this party for the delegation because it isn't a Public Administration. Select another party."
    }
  },
  {
    "process": "Delegation Process",
    "error": "incorrectState",
    "errorCode": "010-0011",
    "bffEndpoint": "POST /consumers/delegations/:delegationId/approve",
    "copy": {
      "it": "La delega non è più in attesa di approvazione. Aggiorna la pagina.",
      "en": "The delegation is no longer waiting for approval. Refresh the page."
    }
  },
  {
    "process": "Delegation Process",
    "error": "incorrectState",
    "errorCode": "010-0011",
    "bffEndpoint": "DELETE /consumers/delegations/:delegationId",
    "copy": {
      "it": "Non puoi revocare la delega perché non è più attiva. Aggiorna la pagina.",
      "en": "You can't revoke the delegation because it is no longer active. Refresh the page."
    }
  },
  {
    "process": "Delegation Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "010-10027",
    "bffEndpoint": "POST /producers/delegations/:delegationId/reject",
    "copy": {
      "it": "Non puoi inserire un link nella motivazione del rifiuto alla delega. Rimuovi il link e riprova.",
      "en": "You can't reject the delegation because the reason contains a link. Remove the link and try again."
    }
  },
  {
    "process": "Delegation Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "010-10027",
    "bffEndpoint": "POST /consumers/delegations/:delegationId/reject",
    "copy": {
      "it": "Non puoi inserire un link nella motivazione del rifiuto alla delega. Rimuovi il link e riprova.",
      "en": "You can't reject the delegation because the reason contains a link. Remove the link and try again."
    }
  },
  {
    "process": "Tenant Process",
    "error": "expirationDateCannotBeInThePast",
    "errorCode": "005-009",
    "bffEndpoint": "POST /tenants/:tenantId/attributes/verified/:attributeId",
    "copy": {
      "it": "La data di scadenza deve essere successiva a oggi. Seleziona una data futura.",
      "en": "The expiration date must be later than today. Select a future date.\n"
    }
  },
  {
    "process": "Tenant Process",
    "error": "certifiedAttributeAlreadyAssigned",
    "errorCode": "005-0014",
    "bffEndpoint": "POST /tenants/:tenantId/attributes/certified",
    "copy": {
      "it": "L’ente possiede già l'attributo certificato {attributeName}. Aggiorna la pagina.",
      "en": "The party already has the certified attribute {attributeName}. Refresh the page."
    }
  },
  {
    "process": "Tenant Process",
    "error": "certifiedAttributeAlreadyAssigned",
    "errorCode": "005-0014",
    "bffEndpoint": "POST /tenants/:tenantId/attributes/certifiedDiscrete",
    "copy": {
      "it": "L’ente possiede già l'attributo certificato {attributeName}. Aggiorna la pagina.",
      "en": "The party already has the certified attribute {attributeName}. Refresh the page."
    }
  },
  {
    "process": "Tenant Process",
    "error": "expirationDateCannotBeInThePast",
    "errorCode": "005-009",
    "bffEndpoint": "POST /tenants/:tenantId/attributes/verified",
    "copy": {
      "it": "La data di scadenza deve essere successiva a oggi. Seleziona una data futura.",
      "en": "The expiration date must be later than today. Select a future date."
    }
  },
  {
    "process": "Tenant Process",
    "error": "operationForbidden",
    "errorCode": "005-9989",
    "bffEndpoint": "POST /tenants/delegatedFeatures/update",
    "copy": {
      "it": "Non puoi aggiornare la disponibilità alle deleghe perché il tuo ente non è una Pubblica Amministrazione e quindi non è abilitato a usarle.",
      "en": "You can't update your delegation availability because your party is not a Public Administration and therefore isn't eligible to use delegations."
    }
  },
  {
    "process": "Tenant Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "005-10027",
    "bffEndpoint": "POST /tenants/:tenantId/mails",
    "copy": {
      "it": "L’indirizzo email non è stato salvato perché il campo “Note” contiene un link. Rimuovi il link e riprova.",
      "en": "The email address was not saved because the “Notes” field contains a link. Remove the link and try again."
    }
  },
  {
    "process": "Purpose Process",
    "error": "duplicatedPurposeTitle",
    "errorCode": "004-0016",
    "bffEndpoint": "POST /purposes",
    "copy": {
      "it": "Esiste già una finalità con lo stesso nome per questo e-service. Vai su \"Modifica bozza\" per scegliere un altro nome, oppure elimina questa bozza e riprova.",
      "en": "There is already a purpose with the same name for this e-service. Go to “Edit draft” to choose a different name, or delete this draft and try again."
    }
  },
  {
    "process": "Purpose Process",
    "error": "duplicatedPurposeTitle",
    "errorCode": "004-0016",
    "bffEndpoint": "POST /reverse/purposes",
    "copy": {
      "it": "Esiste già una finalità con lo stesso nome per questo e-service. Vai su \"Modifica bozza\" per scegliere un altro nome, oppure elimina questa bozza e riprova.",
      "en": "There is already a purpose with the same name for this e-service. Go to “Edit draft” to choose a different name, or delete this draft and try again."
    }
  },
  {
    "process": "Purpose Process",
    "error": "duplicatedPurposeTitle",
    "errorCode": "004-0016",
    "bffEndpoint": "POST /purposes/:purposeId",
    "copy": {
      "it": "Esiste già una finalità con lo stesso nome per questo e-service. Scegli un altro nome.",
      "en": "There is already a purpose with the same name for this e-service. Choose a different name."
    }
  },
  {
    "process": "Purpose Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "004-10027",
    "bffEndpoint": "POST /purposes/:purposeId",
    "copy": {
      "it": "Non puoi inserire un link nel nome o nella descrizione della finalità, né nel motivo per cui usi l’e-service è a titolo gratuito. Rimuovi il link e riprova.",
      "en": "You can't include a link in the purpose name or description, or in the reason for using the e-service free of charge. Remove the link and try again."
    }
  },
  {
    "process": "Purpose Process",
    "error": "duplicatedPurposeTitle",
    "errorCode": "004-0016",
    "bffEndpoint": "POST /purposes/:purposeId/clone",
    "copy": {
      "it": "Esiste già una finalità con lo stesso nome per questo e-service. Vai su \"Modifica bozza\" per scegliere un altro nome, oppure elimina questa bozza e riprova.",
      "en": "There is already a purpose with the same name for this e-service. Go to “Edit draft” to choose a different name, or delete this draft and try again."
    }
  },
  {
    "process": "Purpose Process",
    "error": "duplicatedPurposeTitle",
    "errorCode": "004-0016",
    "bffEndpoint": "POST /purposeTemplates/:purposeTemplateId/purposes",
    "copy": {
      "it": "Esiste già una finalità con lo stesso nome per questo e-service. Vai su \"Modifica bozza\" per scegliere un altro nome, oppure elimina questa bozza e riprova.",
      "en": "There is already a purpose with the same name for this e-service. Go to “Edit draft” to choose a different name, or delete this draft and try again."
    }
  },
  {
    "process": "Purpose Process",
    "error": "duplicatedPurposeTitle",
    "errorCode": "004-0016",
    "bffEndpoint": "PATCH /purposeTemplates/:purposeTemplateId/purposes/:purposeId",
    "copy": {
      "it": "Esiste già una finalità con lo stesso nome per questo e-service. Scegli un altro nome.",
      "en": "There is already a purpose with the same name for this e-service. Choose a different name."
    }
  },
  {
    "process": "Purpose Process",
    "error": "riskAnalysisAlreadyApproved",
    "errorCode": null,
    "bffEndpoint": "POST /purposes/{purposeId}/riskAnalysis/sign",
    "copy": {
      "it": "",
      "en": ""
    }
  },
  {
    "process": "Purpose Process",
    "error": "riskAnalysisAlreadyRejected",
    "errorCode": null,
    "bffEndpoint": "POST /purposes/{purposeId}/riskAnalysis/sign",
    "copy": {
      "it": "",
      "en": ""
    }
  },
  {
    "process": "Purpose Process",
    "error": "purposeMetadataVersionMismatch",
    "errorCode": "004-0064",
    "bffEndpoint": "POST /purposes/{purposeId}/riskAnalysis/sign",
    "copy": {
      "it": "",
      "en": ""
    }
  },
  {
    "process": "Purpose Process",
    "error": "riskAnalysisAlreadyApproved",
    "errorCode": null,
    "bffEndpoint": "POST /purposes/{purposeId}/riskAnalysis/reject",
    "copy": {
      "it": "",
      "en": ""
    }
  },
  {
    "process": "Purpose Process",
    "error": "riskAnalysisAlreadyRejected",
    "errorCode": null,
    "bffEndpoint": "POST /purposes/{purposeId}/riskAnalysis/reject",
    "copy": {
      "it": "",
      "en": ""
    }
  },
  {
    "process": "Purpose Process",
    "error": "riskAnalysisAlreadyApproved",
    "errorCode": null,
    "bffEndpoint": "PUT /purposes/{purposeId}/riskAnalysis/form",
    "copy": {
      "it": "",
      "en": ""
    }
  },
  {
    "process": "Purpose Process",
    "error": "riskAnalysisAlreadyRejected",
    "errorCode": null,
    "bffEndpoint": "PUT /purposes/{purposeId}/riskAnalysis/form",
    "copy": {
      "it": "",
      "en": ""
    }
  },
  {
    "process": "",
    "error": "",
    "errorCode": null,
    "bffEndpoint": "",
    "copy": {
      "it": "",
      "en": ""
    }
  },
  {
    "process": "Purpose Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "004-10027",
    "bffEndpoint": "POST /purposes/:purposeId/riskAnalysis/reject",
    "copy": {
      "it": "Non puoi inserire un link nella motivazione del rifiuto dell’analisi del rischio. Rimuovi il link e riprova.",
      "en": "You can't include a link in the risk analysis rejection reason. Remove the link and try again."
    }
  },
  {
    "process": "Catalog Process",
    "error": "eServiceNameDuplicateForProducer",
    "errorCode": "001-007",
    "bffEndpoint": "POST /eservices",
    "copy": {
      "it": "Esiste già un e-service con lo stesso nome. Scegli un altro nome.",
      "en": "There is already an e-service with the same name. Choose a different name."
    }
  },
  {
    "process": "Catalog Process",
    "error": "eserviceTemplateNameConflict",
    "errorCode": "001-0039",
    "bffEndpoint": "POST /eservices",
    "copy": {
      "it": "Esiste già un template e-service con lo stesso nome. Scegli un altro nome.",
      "en": "There is already a template with the same name. Choose a different name."
    }
  },
  {
    "process": "Catalog Process",
    "error": "eServiceNameDuplicateForProducer",
    "errorCode": "001-007",
    "bffEndpoint": "POST /templates/:templateId/eservices",
    "copy": {
      "it": "Esiste già un e-service con la parola identificativa {identifyingWord}. Scegli un'altra parola identificativa.",
      "en": "There is already an e-service with the identifying word {identifyingWord}. Choose a different identifying word."
    }
  },
  {
    "process": "Catalog Process",
    "error": "eServiceNameDuplicateForProducer",
    "errorCode": "001-007",
    "bffEndpoint": "POST /templates/eservices/:eServiceId",
    "copy": {
      "it": "Esiste già un e-service con la parola identificativa {identifyingWord}. Scegli un'altra parola identificativa.",
      "en": "There is already an e-service with the identifying word {identifyingWord}. Choose a different identifying word."
    }
  },
  {
    "process": "Catalog Process",
    "error": "gracePeriodDaysLowerThanDescriptor",
    "errorCode": "001-0070",
    "bffEndpoint": "POST /eservices/:eServiceId/scheduleArchive",
    "copy": {
      "it": "Non puoi archiviare l’e-service prima di una versione già in fase di archiviazione. Seleziona una durata più lunga.",
      "en": "You can't archive the e-service before a version that is already being archived. Select a longer duration."
    }
  },
  {
    "process": "Catalog Process",
    "error": "gracePeriodDaysLowerThanDescriptor",
    "errorCode": "001-0070",
    "bffEndpoint": "POST /eservices/:eServiceId/submitDelegatedArchiving",
    "copy": {
      "it": "Non puoi archiviare l’e-service prima di una versione già in fase di archiviazione. Seleziona una durata più lunga.",
      "en": "You can't archive the e-service before a version that is already being archived. Select a longer duration."
    }
  },
  {
    "process": "Catalog Process",
    "error": "documentPrettyNameDuplicate",
    "errorCode": "001-0020",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/documents",
    "copy": {
      "it": "Esiste già un documento con lo stesso nome in questa versione. Rinomina il documento.",
      "en": "There is already a document with the same name in this version. Rename the document."
    }
  },
  {
    "process": "Catalog Process",
    "error": "checksumDuplicate",
    "errorCode": "001-0040",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/documents",
    "copy": {
      "it": "Il file che hai provato a caricare ha lo stesso contenuto di un documento già allegato a questa versione. Scegli un file con contenuto diverso.",
      "en": "The file you tried to upload has the same content as a document already attached to this version. Choose a file with different content."
    }
  },
  {
    "process": "Catalog Process",
    "error": "documentPrettyNameDuplicate",
    "errorCode": "001-0020",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
    "copy": {
      "it": "Esiste già un documento con lo stesso nome in questa versione. Rinomina il documento.",
      "en": "There is already a document with the same name in this version. Choose another name."
    }
  },
  {
    "process": "Catalog Process",
    "error": "riskAnalysisDuplicated",
    "errorCode": "001-0021",
    "bffEndpoint": "POST /eservices/:eServiceId/riskAnalysis",
    "copy": {
      "it": "Esiste già una finalità con lo stesso nome per questo e-service. Scegli un altro nome.",
      "en": "There is already a purpose with the same name for this e-service. Choose a different name."
    }
  },
  {
    "process": "Catalog Process",
    "error": "riskAnalysisDuplicated",
    "errorCode": "001-0021",
    "bffEndpoint": "POST /eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
    "copy": {
      "it": "Esiste già una finalità con lo stesso nome per questo e-service. Scegli un altro nome.",
      "en": "There is already a purpose with the same name for this e-service. Choose a different name."
    }
  },
  {
    "process": "Catalog Process",
    "error": "eServiceNameDuplicateForProducer",
    "errorCode": "001-007",
    "bffEndpoint": "POST /eservices/:eServiceId/name/update",
    "copy": {
      "it": "Esiste già un e-service con lo stesso nome. Scegli un altro nome.",
      "en": "There is already an e-service with the same name. Choose a different name."
    }
  },
  {
    "process": "Catalog Process",
    "error": "eserviceTemplateNameConflict",
    "errorCode": "001-0039",
    "bffEndpoint": "POST /eservices/:eServiceId/name/update",
    "copy": {
      "it": "Esiste già un template e-service con lo stesso nome. Scegli un altro nome.",
      "en": "There is already a template with the same name. Choose a different name."
    }
  },
  {
    "process": "Catalog Process",
    "error": "eServiceNameDuplicateForProducer",
    "errorCode": "001-007",
    "bffEndpoint": "POST /templates/eservices/:eServiceId/instanceLabel/update",
    "copy": {
      "it": "Esiste già un e-service con la parola identificativa {identifyingWord}. Scegli un'altra parola identificativa.",
      "en": "There is already an e-service with the identifying word {identifyingWord}. Choose a different identifying word."
    }
  },
  {
    "process": "Catalog Process",
    "error": "gracePeriodDaysLowerThanDescriptor",
    "errorCode": "001-0070",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/submitDelegatedArchiving",
    "copy": {
      "it": "",
      "en": ""
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /templates/eservices/:eServiceId",
    "copy": {
      "it": "Non puoi modificare questo e-service: la tua delega per l’erogazione di questo e-service non è più attiva. Aggiorna la pagina.",
      "en": "You can’t edit this e-service: your delegation for producing this e-service is no longer active. Refresh the page."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "DELETE /eservices/:eServiceId",
    "copy": {
      "it": "Non puoi eliminare questo e-service in bozza perché lo gestisci in delega. Può eliminarlo solo l’ente delegante.",
      "en": "You can't delete this draft e-service because you manage it as a delegate. Only the delegating party can delete it."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /eservices/:eServiceId/submitDelegatedArchiving",
    "copy": {
      "it": "Non puoi richiedere l’archiviazione di questo e-service: la tua delega per l’erogazione di questo e-service non è più attiva. Aggiorna la pagina.",
      "en": "You can’t request this e-service’s archiving: your delegation for producing this e-service is no longer active. Refresh the page."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "DELETE /eservices/:eServiceId/submitDelegatedArchiving",
    "copy": {
      "it": "Non puoi annullare la richiesta di archiviazione di questo e-service: la tua delega per l’erogazione di questo e-service non è più attiva. Aggiorna la pagina.",
      "en": "You can’t cancel this e-service’s archiving request: your delegation for producing this e-service is no longer active. Refresh the page."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/submitDelegatedArchiving",
    "copy": {
      "it": "Non puoi richiedere l’archiviazione di questa versione: la tua delega per l’erogazione di questo e-service non è più attiva. Aggiorna la pagina.",
      "en": "You can’t request this e-service version’s archiving: your delegation for producing this e-service is no longer active. Refresh the page."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "DELETE /eservices/:eServiceId/descriptors/:descriptorId/submitDelegatedArchiving",
    "copy": {
      "it": "Non puoi annullare la richiesta di archiviazione di questa versione: la tua delega per l’erogazione di questo e-service non è più attiva. Aggiorna la pagina.",
      "en": "You can’t cancel this e-service version’s archiving request: your delegation for producing this e-service is no longer active. Refresh the page."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/documents",
    "copy": {
      "it": "Non puoi caricare il file perché la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can't upload the file because your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "DELETE /eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
    "copy": {
      "it": "Non puoi eliminare questo documento perché la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can't delete this document: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
    "copy": {
      "it": "Non puoi rinominare questo documento: la delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t rename this document: the delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors",
    "copy": {
      "it": "Non puoi creare una nuova versione: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t create a new e-service version: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "DELETE /eservices/:eServiceId/descriptors/:descriptorId",
    "copy": {
      "it": "Non puoi eliminare questa bozza di versione: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t delete this draft e-service version: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /templates/eservices/:eServiceId/descriptors/:descriptorId",
    "copy": {
      "it": "Non puoi modificare questa bozza creata da un template e-service: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t edit this draft created from an e-service template: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/publish",
    "copy": {
      "it": "Non puoi pubblicare questa versione: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t publish this e-service version: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/suspend",
    "copy": {
      "it": "Non puoi sospendere questa versione: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t suspend this e-service version: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/activate",
    "copy": {
      "it": "Non puoi riattivare questa versione: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t reactivate this e-service version: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/update",
    "copy": {
      "it": "Non puoi salvare le modifiche di questa versione: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t save changes to this e-service version: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/agreementApprovalPolicy/update",
    "copy": {
      "it": "Non puoi modificare la modalità di attivazione delle richieste di fruizione: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t change how service requests are activated: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /eservices/:eServiceId/description/update",
    "copy": {
      "it": "Non puoi modificare la descrizione di questo e-service: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t edit this e-service’s description: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /eservices/:eServiceId/delegationFlags/update",
    "copy": {
      "it": "Non puoi modificare le preferenze di fruizione tramite delega: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t change this e-service’s delegation preferences: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /eservices/:eServiceId/name/update",
    "copy": {
      "it": "Non puoi modificare il nome di questo e-service: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t edit this e-service’s name: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /eservices/:eServiceId/signalhub/update",
    "copy": {
      "it": "Non puoi modificare l’adesione a Signal Hub: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t change this e-service’s Signal Hub settings: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/attributes/update",
    "copy": {
      "it": "Non puoi modificare i requisiti di accesso di questa versione: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t edit this e-service version’s access requirements: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /templates/eservices/:eServiceId/upgrade",
    "copy": {
      "it": "Non puoi aggiornare questo e-service: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t upgrade this e-service: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /templates/eservices/:eServiceId/descriptors/:descriptorId/interface/soap",
    "copy": {
      "it": "Non puoi salvare i dati dell’interfaccia SOAP: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t save the SOAP interface details: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /templates/eservices/:eServiceId/descriptors/:descriptorId/interface/rest",
    "copy": {
      "it": "Non puoi salvare i dati dell’interfaccia REST: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t save the REST interface details: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /templates/eservices/:eServiceId/descriptors/:descriptorId/update",
    "copy": {
      "it": "Non puoi modificare questa versione: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t edit this e-service version: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /eservices/:eServiceId/personalDataFlag",
    "copy": {
      "it": "Non puoi modificare l’indicazione sul trattamento dei dati personali: la tua delega per l’erogazione di questo e-service non è più attiva. Torna aii tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t change the personal data processing information: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "operationForbidden",
    "errorCode": "001-9989",
    "bffEndpoint": "POST /templates/eservices/:eServiceId/instanceLabel/update",
    "copy": {
      "it": "Non puoi modificare la parola identificativa di questo e-service: la tua delega per l’erogazione di questo e-service non è più attiva. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can’t edit this e-service’s identifying word: your delegation for producing this e-service is no longer active. Go back to your e-services to see which ones you can manage."
    }
  },
  {
    "process": "Catalog Process",
    "error": "invalidEserviceInterfaceFileDetected",
    "errorCode": "001-10010",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/documents",
    "copy": {
      "it": "Il file dell’interfaccia non è valido per questo e-service. Controlla il formato e il contenuto del file, poi prova di nuovo.",
      "en": "The interface file is not valid for this e-service. Check the file format and content, then try again."
    }
  },
  {
    "process": "Catalog Process",
    "error": "openapiVersionNotRecognized",
    "errorCode": "001-10011",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/documents",
    "copy": {
      "it": "La versione OpenAPI del file non è supportata. Usa OpenAPI 2.0 o 3.x per l’interfaccia del template e-service, oppure 3.x per l’interfaccia di callback, e carica di nuovo il file.",
      "en": "The OpenAPI version in the file is not supported. Use OpenAPI 2.0 or 3.x for the e-service template interface, or 3.x for the callback interface, and upload the file again."
    }
  },
  {
    "process": "Catalog Process",
    "error": "openapiVersionNotRecognized",
    "errorCode": "001-10011",
    "bffEndpoint": "POST /templates/eservices/:eServiceId/descriptors/:descriptorId/interface/rest",
    "copy": {
      "it": "Non puoi salvare i dati dell’interfaccia: la versione OpenAPI del template e-service non è riconosciuta.",
      "en": "You can’t save the interface details: the OpenAPI version in the e-service template isn’t recognised."
    }
  },
  {
    "process": "Catalog Process",
    "error": "invalidContentTypeDetected",
    "errorCode": "001-10013",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/documents",
    "copy": {
      "it": "Non puoi caricare il file perché non è stato possibile verificarne il formato. Scegli un file valido in uno dei formati indicati e riprova.",
      "en": "You can't upload the file because its format could not be verified. Choose a valid file in one of the listed formats and try again."
    }
  },
  {
    "process": "Catalog Process",
    "error": "interfaceExtractingSoapFieldValueError",
    "errorCode": "001-10017",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/documents",
    "copy": {
      "it": "Il file WSDL è incompleto: manca l’indirizzo del servizio o la definizione delle operazioni. Completa il file e caricalo di nuovo.",
      "en": "The WSDL file is incomplete: the service address or operation definitions are missing. Complete the file and upload it again."
    }
  },
  {
    "process": "Catalog Process",
    "error": "invalidServerUrl",
    "errorCode": "001-10026",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/documents",
    "copy": {
      "it": "Il file OpenAPI o WSDL contiene un URL del server non valido. Correggi l’URL nel file e caricalo di nuovo.",
      "en": "The OpenAPI or WSDL file contains an invalid server URL. Correct the URL in the file and upload it again."
    }
  },
  {
    "process": "Catalog Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "001-10027",
    "bffEndpoint": "POST /eservices",
    "copy": {
      "it": "Non puoi inserire un link nel nome o nella descrizione dell’e-service. Rimuovi il link e riprova.",
      "en": "You can't include a link in the e-service name or description. Remove the link and try again."
    }
  },
  {
    "process": "Catalog Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "001-10027",
    "bffEndpoint": "POST /templates/:templateId/eservices",
    "copy": {
      "it": "Non puoi inserire un link nella parola identificativa dell’e-service. Rimuovi il link e riprova.",
      "en": "You can't include a link in the e-service identifier. Remove the link and try again."
    }
  },
  {
    "process": "Catalog Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "001-10027",
    "bffEndpoint": "POST /templates/eservices/:eServiceId",
    "copy": {
      "it": "Non puoi inserire un link nella parola identificativa dell’e-service. Rimuovi il link e riprova.",
      "en": "You can't include a link in the e-service identifier. Remove the link and try again."
    }
  },
  {
    "process": "Catalog Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "001-10027",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/documents",
    "copy": {
      "it": "Non puoi inserire un link nel nome del documento o del file. Rimuovi il link dal nome del documento oppure rinomina il file e riprova.",
      "en": "You can't include a link in the document or file name. Remove the link from the document name or rename the file and try again."
    }
  },
  {
    "process": "Catalog Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "001-10027",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
    "copy": {
      "it": "Non puoi inserire un link nel nome del documento. Rimuovi il link e riprova.",
      "en": "You can't include a link in the document name. Remove the link and try again."
    }
  },
  {
    "process": "Catalog Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "001-10027",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors",
    "copy": {
      "it": "Non puoi creare una nuova versione perché la versione precedente contiene un link nella descrizione o nel nome di un documento.",
      "en": "You can't create a new version because the previous version contains a link in its description or in a document name."
    }
  },
  {
    "process": "Catalog Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "001-10027",
    "bffEndpoint": "POST /eservices/:eServiceId/description/update",
    "copy": {
      "it": "Non puoi inserire un link nella descrizione dell’e-service. Rimuovi il link e riprova.",
      "en": "You can't include a link in the e-service description. Remove the link and try again."
    }
  },
  {
    "process": "Catalog Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "001-10027",
    "bffEndpoint": "POST /eservices/:eServiceId/name/update",
    "copy": {
      "it": "Non puoi inserire un link nel nome dell’e-service. Rimuovi il link e riprova.",
      "en": "You can't include a link in the e-service name. Remove the link and try again."
    }
  },
  {
    "process": "Catalog Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "001-10027",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/reject",
    "copy": {
      "it": "Non puoi inserire un link nella motivazione del rifiuto della pubblicazione della versione. Rimuovi il link e riprova.",
      "en": "You can't include a link in the version rejection reason. Remove the link and try again."
    }
  },
  {
    "process": "Catalog Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "001-10027",
    "bffEndpoint": "POST /templates/eservices/:eServiceId/instanceLabel/update",
    "copy": {
      "it": "Non puoi inserire un link nella parola identificativa dell’e-service. Rimuovi il link e riprova.",
      "en": "You can't include a link in the e-service identifier. Remove the link and try again."
    }
  },
  {
    "process": "Catalog Process",
    "error": "contentTooLargeError",
    "errorCode": "001-10031",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/documents",
    "copy": {
      "it": "Il file selezionato è troppo grande. Scegli un file di massimo 3 MB per un’interfaccia o di massimo 10 MB per un documento.",
      "en": "The selected file is too large. Choose a file up to 3 MB for an interface or up to 10 MB for a document."
    }
  },
  {
    "process": "Catalog Process",
    "error": "invalidFileUploadError",
    "errorCode": "001-10033",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/documents",
    "copy": {
      "it": "Il formato del file non è supportato o il contenuto non è valido. Controlla e riprova usando uno dei formati indicati.",
      "en": "The file format is not supported or the content is invalid. Check the file and try again using one of the supported formats."
    }
  },
  {
    "process": "Attribute Registry Process",
    "error": "attributeDuplicate",
    "errorCode": "003-0002",
    "bffEndpoint": "POST /certifiedAttributes",
    "copy": {
      "it": "Esiste già un attributo certificato con lo stesso nome. Scegli un altro nome.",
      "en": "There is already a certified attribute with the same name. Choose a different name."
    }
  },
  {
    "process": "Attribute Registry Process",
    "error": "attributeDuplicate",
    "errorCode": "003-0002",
    "bffEndpoint": "POST /certifiedDiscreteAttributes",
    "copy": {
      "it": "Esiste già un attributo certificato con lo stesso nome. Scegli un altro nome.",
      "en": "There is already a certified attribute with the same name. Choose a different name."
    }
  },
  {
    "process": "Attribute Registry Process",
    "error": "attributeDuplicate",
    "errorCode": "003-0002",
    "bffEndpoint": "POST /declaredAttributes",
    "copy": {
      "it": "Esiste già un attributo con questo nome. Scegli un altro nome.",
      "en": "An attribute with this name already exists. Choose another name."
    }
  },
  {
    "process": "Attribute Registry Process",
    "error": "attributeDuplicate",
    "errorCode": "003-0002",
    "bffEndpoint": "POST /verifiedAttributes",
    "copy": {
      "it": "Esiste già un attributo con questo nome. Scegli un altro nome.",
      "en": "An attribute with this name already exists. Choose another name."
    }
  },
  {
    "process": "Attribute Registry Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "003-10027",
    "bffEndpoint": "POST /certifiedAttributes",
    "copy": {
      "it": "Non puoi inserire un link nel nome o nella descrizione dell’attributo. Rimuovi il link e riprova.",
      "en": "You can't include a link in the attribute name or description. Remove the link and try again."
    }
  },
  {
    "process": "Attribute Registry Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "003-10027",
    "bffEndpoint": "POST /declaredAttributes",
    "copy": {
      "it": "Non puoi inserire un link nel nome o nella descrizione dell’attributo. Rimuovi il link e riprova.",
      "en": "You can't include a link in the attribute name or description. Remove the link and try again."
    }
  },
  {
    "process": "Attribute Registry Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "003-10027",
    "bffEndpoint": "POST /verifiedAttributes",
    "copy": {
      "it": "Non puoi inserire un link nel nome o nella descrizione dell’attributo. Rimuovi il link e riprova.",
      "en": "You can't include a link in the attribute name or description. Remove the link and try again."
    }
  },
  {
    "process": "Authorization Process",
    "error": "notAllowedPrivateKeyException",
    "errorCode": "006-10001",
    "bffEndpoint": "POST /clients/:clientId/keys",
    "copy": {
      "it": "Hai inserito una chiave privata. Sostituiscila con una chiave pubblica RSA in formato PEM.",
      "en": "You entered the private key, replace it with the public key from the same key pair."
    }
  },
  {
    "process": "Authorization Process",
    "error": "notAllowedCertificateException",
    "errorCode": "006-10005",
    "bffEndpoint": "POST /clients/:clientId/keys",
    "copy": {
      "it": "Hai inserito un certificato che contiene una chiave pubblica e altri dati. Inserisci solo una chiave pubblica RSA in formato PEM.",
      "en": "You entered a certificate, which contains a public key and other data. Enter only an RSA public key in PEM format."
    }
  },
  {
    "process": "Authorization Process",
    "error": "notAllowedMultipleKeysException",
    "errorCode": "006-10019",
    "bffEndpoint": "POST /clients/:clientId/keys",
    "copy": {
      "it": "Hai inserito dei blocchi di testo non necessari. Inserisci una sola chiave pubblica RSA completa, comprese le righe che segnalano l'inizio e la fine.",
      "en": "You entered unnecessary text blocks. Enter a single complete RSA public key, including the lines that mark the beginning and end."
    }
  },
  {
    "process": "Authorization Process",
    "error": "invalidPublicKey",
    "errorCode": "006-10003",
    "bffEndpoint": "POST /clients/:clientId/keys",
    "copy": {
      "it": "Hai inserito una chiave non completa o non valida. Inserisci una chiave pubblica RSA completa in formato PEM.",
      "en": "You entered an incomplete or invalid key. Enter a complete RSA public key in PEM format."
    }
  },
  {
    "process": "Authorization Process",
    "error": "notAnRSAKey",
    "errorCode": "006-10009",
    "bffEndpoint": "POST /clients/:clientId/keys",
    "copy": {
      "it": "Hai inserito un tipo di chiave non supportato. Inserisci una chiave pubblica RSA in formato PEM.",
      "en": "You entered an unsupported key type. Enter an RSA public key in PEM format."
    }
  },
  {
    "process": "Authorization Process",
    "error": "invalidKeyLength",
    "errorCode": "006-10008",
    "bffEndpoint": "POST /clients/:clientId/keys",
    "copy": {
      "it": "Hai inserito una chiave troppo corta. Inserisci una chiave pubblica RSA da almeno 2048 bit in formato PEM.",
      "en": "You entered a key that is too short. Enter an RSA public key of at least 2048 bits in PEM format."
    }
  },
  {
    "process": "Authorization Process",
    "error": "keyAlreadyExists",
    "errorCode": "006-0017",
    "bffEndpoint": "POST /clients/:clientId/keys",
    "copy": {
      "it": "Hai inserito una chiave già registrata su PDND. Se te ne serve una nuova, genera una coppia RSA da almeno 2048 bit e inserisci la chiave pubblica in formato PEM.",
      "en": "You entered a key that is already registered on PDND. If you need a new one, generate an RSA key pair of at least 2048 bits and enter the public key in PEM format."
    }
  },
  {
    "process": "Authorization Process",
    "error": "userNotAllowedToDeleteClientKey",
    "errorCode": "006-0027",
    "bffEndpoint": "DELETE /clients/:clientId/keys/:keyId",
    "copy": {
      "it": "Non puoi eliminare la chiave {keyName} perché è stata aggiunta da un altro operatore. Chiedi a chi l’ha aggiunta o a un amministratore del tuo ente di eliminarla.",
      "en": "You can't delete the key {keyName} because it was added by another operator. Ask the person who added it or an administrator of your party to delete it."
    }
  },
  {
    "process": "Authorization Process",
    "error": "notAllowedPrivateKeyException",
    "errorCode": "006-10001",
    "bffEndpoint": "POST /producerKeychains/:producerKeychainId/keys",
    "copy": {
      "it": "Hai inserito una chiave privata. Sostituiscila con una chiave pubblica RSA in formato PEM.",
      "en": "You entered the private key, replace it with the public key from the same key pair."
    }
  },
  {
    "process": "Authorization Process",
    "error": "notAllowedCertificateException",
    "errorCode": "006-10005",
    "bffEndpoint": "POST /producerKeychains/:producerKeychainId/keys",
    "copy": {
      "it": "Hai inserito un certificato che contiene una chiave pubblica e altri dati. Inserisci solo una chiave pubblica RSA in formato PEM.",
      "en": "You entered a certificate, which contains a public key and other data. Enter only an RSA public key in PEM format."
    }
  },
  {
    "process": "Authorization Process",
    "error": "notAllowedMultipleKeysException",
    "errorCode": "006-10019",
    "bffEndpoint": "POST /producerKeychains/:producerKeychainId/keys",
    "copy": {
      "it": "Hai inserito dei blocchi di testo non necessari. Inserisci una sola chiave pubblica RSA completa, comprese le righe che segnalano l'inizio e la fine.",
      "en": "You entered unnecessary text blocks. Enter a single complete RSA public key, including the lines that mark the beginning and end."
    }
  },
  {
    "process": "Authorization Process",
    "error": "invalidPublicKey",
    "errorCode": "006-10003",
    "bffEndpoint": "POST /producerKeychains/:producerKeychainId/keys",
    "copy": {
      "it": "Hai inserito una chiave non completa o non valida. Inserisci una chiave pubblica RSA completa in formato PEM.",
      "en": "You entered an incomplete or invalid key. Enter a complete RSA public key in PEM format."
    }
  },
  {
    "process": "Authorization Process",
    "error": "notAnRSAKey",
    "errorCode": "006-10009",
    "bffEndpoint": "POST /producerKeychains/:producerKeychainId/keys",
    "copy": {
      "it": "Hai inserito un tipo di chiave non supportato. Inserisci una chiave pubblica RSA in formato PEM.",
      "en": "You entered an unsupported key type. Enter an RSA public key in PEM format."
    }
  },
  {
    "process": "Authorization Process",
    "error": "invalidKeyLength",
    "errorCode": "006-10008",
    "bffEndpoint": "POST /producerKeychains/:producerKeychainId/keys",
    "copy": {
      "it": "Hai inserito una chiave troppo corta. Inserisci una chiave pubblica RSA da almeno 2048 bit in formato PEM.",
      "en": "You entered a key that is too short. Enter an RSA public key of at least 2048 bits in PEM format."
    }
  },
  {
    "process": "Authorization Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "006-10027",
    "bffEndpoint": "POST /clientsConsumer",
    "copy": {
      "it": "Non puoi inserire un link nel nome o nella descrizione del client. Rimuovi il link e riprova.",
      "en": "You can't include a link in the client name or description. Remove the link and try again."
    }
  },
  {
    "process": "Authorization Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "006-10027",
    "bffEndpoint": "POST /clientsApi",
    "copy": {
      "it": "Non puoi inserire un link nel nome o nella descrizione del client. Rimuovi il link e riprova.",
      "en": "You can't include a link in the client name or description. Remove the link and try again."
    }
  },
  {
    "process": "Authorization Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "006-10027",
    "bffEndpoint": "POST /clients/:clientId/keys",
    "copy": {
      "it": "Non puoi inserire un link nel nome della chiave. Rimuovi il link e riprova.",
      "en": "You can't include a link in the key name. Remove the link and try again."
    }
  },
  {
    "process": "Authorization Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "006-10027",
    "bffEndpoint": "POST /producerKeychains",
    "copy": {
      "it": "Non puoi inserire un link nel nome o nella descrizione del portachiavi. Rimuovi il link e riprova.",
      "en": "You can't include a link in the keychain name or description. Remove the link and try again."
    }
  },
  {
    "process": "Authorization Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "006-10027",
    "bffEndpoint": "POST /producerKeychains/:producerKeychainId/keys",
    "copy": {
      "it": "Non puoi inserire un link nel nome della chiave. Rimuovi il link e riprova.",
      "en": "You can't include a link in the key name. Remove the link and try again."
    }
  },
  {
    "process": "EService Template Process",
    "error": "eserviceTemplateDuplicate",
    "errorCode": "011-0004",
    "bffEndpoint": "POST /eservices/templates",
    "copy": {
      "it": "Esiste già un template e-service con lo stesso nome. Scegli un altro nome.",
      "en": "There is already an e-service template with the same name. Choose a different name."
    }
  },
  {
    "process": "EService Template Process",
    "error": "documentPrettyNameDuplicate",
    "errorCode": "011-0022",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents",
    "copy": {
      "it": "Esiste già un documento con lo stesso nome in questa versione. Rinomina il documento.",
      "en": "There is already a document with the same name in this version. Choose another name."
    }
  },
  {
    "process": "EService Template Process",
    "error": "checksumDuplicate",
    "errorCode": "011-0023",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents",
    "copy": {
      "it": "Il file che hai provato a caricare ha lo stesso contenuto di un documento già allegato a questa versione. Scegli un file con contenuto diverso.",
      "en": "The file you tried to upload has the same content as a document already attached to this version. Choose a file with different content."
    }
  },
  {
    "process": "EService Template Process",
    "error": "documentPrettyNameDuplicate",
    "errorCode": "011-0022",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents/:documentId/update",
    "copy": {
      "it": "Esiste già un documento con lo stesso nome in questa versione. Rinomina il documento.",
      "en": "There is already a document with the same name in this version. Choose another name."
    }
  },
  {
    "process": "EService Template Process",
    "error": "riskAnalysisNameDuplicate",
    "errorCode": "011-0006",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/riskAnalysis",
    "copy": {
      "it": "Esiste già una finalità con questo nome nel template e-service. Scegli un altro nome.",
      "en": "A purpose with this name already exists in the e-service template. Choose another name."
    }
  },
  {
    "process": "EService Template Process",
    "error": "eserviceTemplateDuplicate",
    "errorCode": "011-0004",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/name/update",
    "copy": {
      "it": "Esiste già un template e-service con lo stesso nome. Scegli un altro nome.",
      "en": "There is already an e-service template with the same name. Choose a different name."
    }
  },
  {
    "process": "EService Template Process",
    "error": "eserviceTemplateDocumentNotFound",
    "errorCode": "011-0025",
    "bffEndpoint": "GET /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents/:documentId",
    "copy": {
      "it": "Non puoi scaricare il documento perché non è più disponibile. Aggiorna la pagina per vedere i documenti disponibili.",
      "en": "You can't download the document because it is no longer available. Refresh the page to see the available documents."
    }
  },
  {
    "process": "EService Template Process",
    "error": "invalidEserviceInterfaceFileDetected",
    "errorCode": "011-10010",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents",
    "copy": {
      "it": "Il file dell’interfaccia non è valido per questo template e-service. Controlla il formato e il contenuto del file, poi prova di nuovo.",
      "en": "The interface file isn’t valid for this e-service template. Check its OpenAPI or WSDL structure and upload it again."
    }
  },
  {
    "process": "EService Template Process",
    "error": "openapiVersionNotRecognized",
    "errorCode": "011-10011",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents",
    "copy": {
      "it": "La versione OpenAPI del file non è supportata. Usa OpenAPI 2.0 o 3.x per l’interfaccia del template e-service, oppure 3.x per l’interfaccia di callback, e carica di nuovo il file.",
      "en": "The OpenAPI version in the file is not supported. Use OpenAPI 2.0 or 3.x for the e-service template interface, or 3.x for the callback interface, and upload the file again."
    }
  },
  {
    "process": "EService Template Process",
    "error": "invalidContentTypeDetected",
    "errorCode": "011-10013",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents",
    "copy": {
      "it": "Non puoi caricare questo file perché non è stato possibile verificarne il formato.",
      "en": "You can't upload this file because its format could not be verified."
    }
  },
  {
    "process": "EService Template Process",
    "error": "interfaceExtractingSoapFieldValueError",
    "errorCode": "011-10017",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents",
    "copy": {
      "it": "Il file WSDL è incompleto: manca l’indirizzo del servizio o la definizione delle operazioni. Completa il file e caricalo di nuovo.",
      "en": "The WSDL file is incomplete: the service address or operation definitions are missing. Complete the file and upload it again."
    }
  },
  {
    "process": "EService Template Process",
    "error": "invalidServerUrl",
    "errorCode": "011-10026",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents",
    "copy": {
      "it": "Il file OpenAPI o WSDL contiene un URL del server non valido. Correggi l’URL nel file e caricalo di nuovo.",
      "en": "The OpenAPI or WSDL file contains an invalid server URL. Correct the URL in the file and upload it again."
    }
  },
  {
    "process": "EService Template Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "011-10027",
    "bffEndpoint": "POST /eservices/templates",
    "copy": {
      "it": "Non puoi inserire un link nel nome, nella descrizione o nel campo “A chi è rivolto il template”. Rimuovi il link e riprova.",
      "en": "You can't include a link in the name, description, or “Who is the template intended for?” field. Remove the link and try again."
    }
  },
  {
    "process": "EService Template Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "011-10027",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId",
    "copy": {
      "it": "Non puoi inserire un link nella descrizione della versione del template e-service. Rimuovi il link e riprova.",
      "en": "You can't include a link in the e-service template version description. Remove the link and try again."
    }
  },
  {
    "process": "EService Template Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "011-10027",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents",
    "copy": {
      "it": "Non puoi inserire un link nel nome del documento o del file. Rimuovi il link dal nome del documento oppure rinomina il file e riprova.",
      "en": "You can't include a link in the document or file name. Remove the link from the document name or rename the file and try again."
    }
  },
  {
    "process": "EService Template Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "011-10027",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents/:documentId/update",
    "copy": {
      "it": "Non puoi inserire un link nel nome del documento. Rimuovi il link e riprova.",
      "en": "You can't include a link in the document name. Remove the link and try again."
    }
  },
  {
    "process": "EService Template Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "011-10027",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/intendedTarget/update",
    "copy": {
      "it": "Non puoi inserire un link nel campo “A chi è rivolto il template”. Rimuovi il link e riprova.",
      "en": "You can't include a link in the “Who is the template intended for?” field. Remove the link and try again."
    }
  },
  {
    "process": "EService Template Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "011-10027",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/description/update",
    "copy": {
      "it": "Non puoi inserire un link nella descrizione del template e-service. Rimuovi il link e riprova.",
      "en": "You can't include a link in the e-service template description. Remove the link and try again."
    }
  },
  {
    "process": "EService Template Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "011-10027",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/name/update",
    "copy": {
      "it": "Non puoi inserire un link nel nome del template e-service. Rimuovi il link e riprova.",
      "en": "You can't include a link in the e-service template name. Remove the link and try again."
    }
  },
  {
    "process": "EService Template Process",
    "error": "contentTooLargeError",
    "errorCode": "011-10031",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents",
    "copy": {
      "it": "Il file selezionato supera la dimensione massima consentita. Scegli un file di massimo 3 MB se stai caricando un’interfaccia, o di massimo 10 MB se stai caricando un documento.",
      "en": "The selected file exceeds the maximum allowed size. Choose a file up to 3 MB if you're uploading an interface, or up to 10 MB if you're uploading a document."
    }
  },
  {
    "process": "EService Template Process",
    "error": "invalidFileUploadError",
    "errorCode": "011-10033",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents",
    "copy": {
      "it": "Il formato del file non è supportato o il contenuto non è valido. Controlla e riprova usando uno dei formati indicati.",
      "en": "The file format is not supported or the content is invalid. Check the file and try again using one of the supported formats."
    }
  },
  {
    "process": "Purpose Template Process",
    "error": "invalidAssociatedEServiceForPublicationError",
    "errorCode": "015-0023",
    "bffEndpoint": "POST /purposeTemplates/:purposeTemplateId/unsuspend",
    "copy": {
      "it": "Non puoi riattivare il template finalità perché l'e-service suggerito per questo template è sospeso, in archiviazione o archiviato.",
      "en": "You can't reactivate the purpose template because one of the suggested e-service versions is suspended, being archived, or archived."
    }
  },
  {
    "process": "Purpose Template Process",
    "error": "invalidAssociatedEServiceForPublicationError",
    "errorCode": "015-0023",
    "bffEndpoint": "POST /purposeTemplates/:purposeTemplateId/publish",
    "copy": {
      "it": "Non puoi pubblicare il template finalità perché l'e-service suggerito è sospeso, in fase di archiviazione o archiviato.",
      "en": "You can't publish the purpose template because a version of a linked e-service is suspended, being archived, or archived."
    }
  },
  {
    "process": "Purpose Template Process",
    "error": "conflictDocumentPrettyNameDuplicate",
    "errorCode": "015-0018",
    "bffEndpoint": "POST /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents",
    "copy": {
      "it": "Esiste già un documento con lo stesso nome tra gli allegati di questa annotazione. Rinomina il documento.",
      "en": "There is already a document with the same name in this annotation. Rename the document."
    }
  },
  {
    "process": "Purpose Template Process",
    "error": "conflictDuplicatedDocument",
    "errorCode": "015-0020",
    "bffEndpoint": "POST /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents",
    "copy": {
      "it": "Il file che hai provato a caricare ha lo stesso contenuto di un documento già allegato a questa annotazione. Scegli un file con contenuto diverso.",
      "en": "The file you tried to upload has the same content as a document already attached to this annotation. Choose a file with different content."
    }
  },
  {
    "process": "Purpose Template Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "015-10027",
    "bffEndpoint": "POST /purposeTemplates/:purposeTemplateId/riskAnalysis/answers",
    "copy": {
      "it": "Non puoi inserire un link nelle annotazioni. Rimuovi il link e riprova.",
      "en": "You can't include a link in the annotations. Remove the link and try again."
    }
  },
  {
    "process": "Purpose Template Process",
    "error": "hyperlinkDetectionError",
    "errorCode": "015-10027",
    "bffEndpoint": "PUT /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation",
    "copy": {
      "it": "Non puoi inserire un link nelle annotazioni. Rimuovi il link e riprova.",
      "en": "You can't include a link in the annotations. Remove the link and try again."
    }
  },
  {
    "process": "Purpose Template Process",
    "error": "conflictDocumentPrettyNameDuplicate",
    "errorCode": "015-0018",
    "bffEndpoint": "POST /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents/:documentId/update",
    "copy": {
      "it": "Esiste già un documento con lo stesso nome tra gli allegati di questa annotazione. Rinomina il documento.",
      "en": "There is already a document with the same name in this annotation. Rename the document."
    }
  },
  {
    "process": "Purpose Template Process",
    "error": "unauthorizedError",
    "errorCode": "015-9993",
    "bffEndpoint": "GET /purposeTemplates/:purposeTemplateId/riskAnalysisDocument/signed",
    "copy": {
      "it": "Non puoi scaricare il documento dell’analisi del rischio di questo template finalità con il tuo ruolo. Chiedi a un amministratore del tuo ente di scaricarlo.",
      "en": "You can’t download this purpose template’s risk analysis document with your role. Ask an Administrator in your party to download it."
    }
  },
  {
    "process": "Purpose Template Process",
    "error": "invalidContentTypeDetected",
    "errorCode": "015-10013",
    "bffEndpoint": "POST /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents",
    "copy": {
      "it": "Non è stato possibile caricare il file. Puoi caricare solo file in formato PDF.",
      "en": "The file could not be uploaded. You can only upload PDF files."
    }
  },
  {
    "process": "Purpose Template Process",
    "error": "invalidPdfSignatureError",
    "errorCode": "015-10032",
    "bffEndpoint": "POST /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents",
    "copy": {
      "it": "Non è stato possibile caricare il file. Puoi caricare solo file in formato PDF.",
      "en": "The file could not be uploaded. You can only upload PDF files."
    }
  },
  {
    "process": "Agreement Process",
    "error": "agreementSubmissionFailed",
    "errorCode": "002-0002",
    "bffEndpoint": "POST /agreements/:agreementId/submit",
    "copy": {
      "it": "Non puoi inviare la richiesta di fruizione perché il tuo ente non soddisfa almeno uno degli attributi richiesti. Aggiorna la pagina per controllare gli attributi e lo stato della richiesta.",
      "en": "You cannot submit the service request because your party is missing at least one required attribute. Refresh the page to check the attributes and the request’s status."
    }
  },
  {
    "process": "Agreement Process",
    "error": "agreementNotInExpectedState",
    "errorCode": "002-0003",
    "bffEndpoint": "POST /agreements/:agreementId/approve",
    "copy": {
      "it": "Questa richiesta di fruizione non è più in attesa di approvazione. Aggiorna la pagina per vedere il suo stato attuale.",
      "en": "This service request is no longer awaiting approval. Refresh the page to see its current status."
    }
  },
  {
    "process": "Agreement Process",
    "error": "agreementActivationFailed",
    "errorCode": "002-0008",
    "bffEndpoint": "POST /agreements/:agreementId/approve",
    "copy": {
      "it": "Non puoi approvare questa richiesta di fruizione perché l’ente fruitore non soddisfa tutti gli attributi richiesti.",
      "en": "You cannot approve this service request because some of the consumer party’s access requirements are not satisfied."
    }
  },
  {
    "process": "Agreement Process",
    "error": "descriptorNotInExpectedState",
    "errorCode": "002-0004",
    "bffEndpoint": "POST /agreements/:agreementId/approve",
    "copy": {
      "it": "Non puoi attivare questa richiesta di fruizione perché la versione dell’e-service è in fase di archiviazione o è archiviata. Aggiorna la pagina per controllarne lo stato.",
      "en": "You cannot activate this service request because its e-service version is being archived or has been archived. Refresh the page to check its status."
    }
  },
  {
    "process": "Agreement Process",
    "error": "agreementNotInExpectedState",
    "errorCode": "002-0003",
    "bffEndpoint": "POST /agreements/:agreementId/unsuspend",
    "copy": {
      "it": "Questa richiesta di fruizione non è più sospesa. Aggiorna la pagina per vedere il suo stato attuale.",
      "en": "This service request is no longer suspended. Refresh the page to see its current status."
    }
  },
  {
    "process": "Agreement Process",
    "error": "agreementActivationFailed",
    "errorCode": "002-0008",
    "bffEndpoint": "POST /agreements/:agreementId/unsuspend",
    "copy": {
      "it": "UNKNOWN / TO VERIFY",
      "en": "UNKNOWN / TO VERIFY"
    }
  },
  {
    "process": "Agreement Process",
    "error": "descriptorNotInExpectedState",
    "errorCode": "002-0004",
    "bffEndpoint": "POST /agreements/:agreementId/unsuspend",
    "copy": {
      "it": "Non puoi riattivare questa richiesta di fruizione perché la versione dell’e-service è in fase di archiviazione o è archiviata. Aggiorna la pagina per vedere il suo stato attuale.",
      "en": "You cannot reactivate this service request because its e-service version is being archived or has been archived. Refresh the page to see its current status."
    }
  },
  {
    "process": "Agreement Process",
    "error": "documentsChangeNotAllowed",
    "errorCode": "002-0018",
    "bffEndpoint": "POST /agreements/:agreementId/consumer-documents",
    "copy": {
      "it": "Non puoi caricare il documento perché la richiesta di fruizione non è più in bozza. Aggiorna la pagina per vedere il suo stato attuale.",
      "en": "You cannot upload the document because the service request is no longer a draft. Refresh the page to see its current status."
    }
  },
  {
    "process": "Agreement Process",
    "error": "documentNotFound",
    "errorCode": "002-0017",
    "bffEndpoint": "GET /agreements/:agreementId/consumer-documents/:documentId",
    "copy": {
      "it": "Non puoi scaricare il documento perché non risulta più allegato alla richiesta di fruizione. Aggiorna la pagina per vedere i documenti disponibili.",
      "en": "You cannot download the document because it is no longer attached to the service request. Refresh the page to check the available documents."
    }
  },
  {
    "process": "Agreement Process",
    "error": "documentNotFound",
    "errorCode": "002-0017",
    "bffEndpoint": "DELETE /agreements/:agreementId/consumer-documents/:documentId",
    "copy": {
      "it": "Non puoi eliminare il documento perché non risulta più allegato alla richiesta di fruizione. Aggiorna la pagina per vedere i documenti disponibili.",
      "en": "You cannot delete the document because it is no longer attached to the service request. Refresh the page to check the available documents."
    }
  },
  {
    "process": "Agreement Process",
    "error": "documentsChangeNotAllowed",
    "errorCode": "002-0018",
    "bffEndpoint": "DELETE /agreements/:agreementId/consumer-documents/:documentId",
    "copy": {
      "it": "Non puoi eliminare il documento perché la richiesta di fruizione non è più in bozza. Aggiorna la pagina per vedere il suo stato attuale.",
      "en": "You cannot delete the document because the service request is no longer a draft. Refresh the page to see its current status."
    }
  },
  {
    "process": "Agreement Process",
    "error": "agreementNotInExpectedState",
    "errorCode": "002-0003",
    "bffEndpoint": "POST /agreements/:agreementId/suspend",
    "copy": {
      "it": "Non puoi sospendere questa richiesta di fruizione. Aggiorna la pagina per vedere il suo stato attuale.",
      "en": "You cannot suspend this service request. Refresh the page to see its current state."
    }
  },
  {
    "process": "Agreement Process",
    "error": "agreementNotInExpectedState",
    "errorCode": "002-0003",
    "bffEndpoint": "POST /agreements/:agreementId/reject",
    "copy": {
      "it": "Non puoi rifiutare questa richiesta di fruizione perché non è più in attesa di approvazione. Aggiorna la pagina per vedere il suo stato attuale.",
      "en": "You cannot reject this service request because it is no longer awaiting approval. Refresh the page to see its current status."
    }
  },
  {
    "process": "Agreement Process",
    "error": "agreementNotInExpectedState",
    "errorCode": "002-0003",
    "bffEndpoint": "POST /agreements/:agreementId/archive",
    "copy": {
      "it": "Non puoi archiviare questa richiesta di fruizione. Aggiorna la pagina per vedere il suo stato attuale.",
      "en": "You cannot archive this service request because it is no longer active or suspended. Refresh the page to see its current status."
    }
  },
  {
    "process": "Agreement Process",
    "error": "notLatestEServiceDescriptor",
    "errorCode": "002-0021",
    "bffEndpoint": "POST /agreements",
    "copy": {
      "it": "Non puoi richiedere la fruizione di questa versione perché non è la più recente. Aggiorna la pagina e, se disponibile, crea una richiesta per l'ultima versione.",
      "en": "You cannot submit a service request for this e-service version because it is not the latest one. Refresh the page and, if available, create the request for the latest version."
    }
  },
  {
    "process": "Agreement Process",
    "error": "descriptorNotInExpectedState",
    "errorCode": "002-0004",
    "bffEndpoint": "POST /agreements",
    "copy": {
      "it": "Non puoi richiedere la fruizione di questa versione perché non è più disponibile. Aggiorna la pagina per vedere il suo stato attuale.",
      "en": "You cannot submit a service request for this e-service version because is not available anymore. Refresh the page to see its current status."
    }
  },
  {
    "process": "Agreement Process",
    "error": "missingCertifiedAttributesError",
    "errorCode": "002-0001",
    "bffEndpoint": "POST /agreements",
    "copy": {
      "it": "Non puoi richiedere la fruizione perché manca almeno un attributo certificato richiesto. Aggiorna la pagina per controllare gli attributi.",
      "en": "You cannot submit a service request for this e-service version because the consumer party is missing required certified attributes. Refresh the page to check which ones are missing."
    }
  },
  {
    "process": "Agreement Process",
    "error": "agreementAlreadyExists",
    "errorCode": "002-0010",
    "bffEndpoint": "POST /agreements",
    "copy": {
      "it": "Esiste già una richiesta di fruizione per questo e-service. Aggiorna la pagina delle richieste di fruizione inviate.",
      "en": "A service request for this e-service already exists. Refresh the submitted request page."
    }
  },
  {
    "process": "Agreement Process",
    "error": "missingCertifiedAttributesError",
    "errorCode": "002-0001",
    "bffEndpoint": "POST /agreements/:agreementId/clone",
    "copy": {
      "it": "Non puoi duplicare questa richiesta di fruizione perché manca almeno uno degli attributi certificati richiesti. Aggiorna la pagina per controllare gli attributi.",
      "en": "You cannot duplicate this service request because there are some missing certified attributes required by the e-service version. Refresh the page to check which ones are missing."
    }
  },
  {
    "process": "Agreement Process",
    "error": "agreementAlreadyExists",
    "errorCode": "002-0010",
    "bffEndpoint": "POST /agreements/:agreementId/clone",
    "copy": {
      "it": "Non puoi duplicare questa richiesta di fruizione perché per questo e-service esiste già una richiesta in corso o attiva. ",
      "en": "You cannot duplicate the service request because another request for this e-service is already in progress or active."
    }
  },
  {
    "process": "Agreement Process",
    "error": "unauthorizedError",
    "errorCode": "002-9993",
    "bffEndpoint": "GET /agreements/:agreementId/consumer-documents/:documentId",
    "copy": {
      "it": "Non puoi scaricare questo documento con il ruolo di operatore di sicurezza. Chiedi a un amministratore del tuo ente di scaricarlo.",
      "en": "You can't download this document as a Security Operator. Ask an Administrator in your party to download it."
    }
  },
  {
    "process": "Agreement Process",
    "error": "invalidFileUploadError",
    "errorCode": "002-10033",
    "bffEndpoint": "POST /agreements/:agreementId/consumer-documents",
    "copy": {
      "it": "Non puoi caricare il documento perché il file selezionato non è valido o è in un formato non supportato. Scegli un file valido in formato PDF, JSON, Markdown, YAML, TXT, XSD, WSDL o XML e riprova.",
      "en": "You can't upload the document because the selected file is invalid or its format is not supported. Choose a valid PDF, JSON, Markdown, YAML, TXT, XSD, WSDL, or XML file and try again."
    }
  },
  {
    "process": "BFF Process",
    "error": "contractException",
    "errorCode": "008-0023",
    "bffEndpoint": "GET /agreements/:agreementId/signedContract",
    "copy": {
      "it": "Il documento della richiesta di fruizione non è ancora disponibile. Aggiorna la pagina e riprova.",
      "en": "The service request document is not available yet. Refresh the page and try again."
    }
  },
  {
    "process": "BFF Process",
    "error": "invalidEserviceRequester",
    "errorCode": "008-0006",
    "bffEndpoint": "GET /producers/eservices/:eserviceId",
    "copy": {
      "it": "Uno degli e-service che gestivi in delega non è più disponibile. Aggiorna la pagina per vedere quali e-service puoi gestire.",
      "en": "One of the e-services you were managing as a delegate is no longer available. Refresh the page to see the current list of your e-services."
    }
  },
  {
    "process": "BFF Process",
    "error": "invalidEserviceRequester",
    "errorCode": "008-0006",
    "bffEndpoint": "GET /producers/eservices/:eserviceId/descriptors/:descriptorId",
    "copy": {
      "it": "Non puoi visualizzare questo e-service perché non lo gestisci più in delega. Torna ai tuoi e-service per vedere quelli che puoi gestire.",
      "en": "You can't view this e-service because you no longer manage it as a delegate. Refresh the page to see the current list of your e-services."
    }
  },
  {
    "process": "BFF Process",
    "error": "invalidEserviceRequester",
    "errorCode": "008-0006",
    "bffEndpoint": "GET /export/eservices/:eserviceId/descriptors/:descriptorId",
    "copy": {
      "it": "Non puoi scaricare questa versione dell'e-service perché la gestisci tramite delega.",
      "en": "You can’t download this e-service version because you manage it through a delegation."
    }
  },
  {
    "process": "BFF Process",
    "error": "eserviceDescriptorNotFound",
    "errorCode": "008-0011",
    "bffEndpoint": "POST /eservices/:eServiceId/descriptors/:descriptorId/documents",
    "copy": {
      "it": "Non puoi caricare il documento perché questa bozza di versione non è più disponibile. Torna ai tuoi e-service per controllare quali bozze sono disponibili.",
      "en": "You can't upload the document because this version draft is no longer available. Go back to your e-services to check which drafts are available."
    }
  },
  {
    "process": "BFF Process",
    "error": "invalidZipStructure",
    "errorCode": "008-0021",
    "bffEndpoint": "POST /import/eservices",
    "copy": {
      "it": "Non puoi importare l’e-service perché l’archivio ZIP non ha la struttura richiesta. Usa un archivio esportato da PDND senza modificarlo oppure verifica che configuration.json sia valido e che i file presenti corrispondano a quelli indicati.",
      "en": "You can't import the e-service: the ZIP archive does not have the required structure. Use an archive exported from PDND Interoperability without changing it, or check that configuration.json is valid and that the files in the archive match those listed in it."
    }
  },
  {
    "process": "BFF Process",
    "error": "delegatedEserviceNotExportable",
    "errorCode": "008-0035",
    "bffEndpoint": "GET /export/eservices/:eserviceId/descriptors/:descriptorId",
    "copy": {
      "it": "Non puoi scaricare questa versione dell'e-service perché è attiva una delega per l’erogazione o ce n’è una in attesa di approvazione.",
      "en": "You can't download this e-service version because there is an active delegation, or one waiting for approval."
    }
  },
  {
    "process": "BFF Process",
    "error": "eserviceTemplateVersionNotFound",
    "errorCode": "008-0036",
    "bffEndpoint": "POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents",
    "copy": {
      "it": "Non puoi caricare il file perché questa bozza di versione del template e-service non è più disponibile.",
      "en": "You can't upload the file because this draft e-service template version is no longer available."
    }
  },
  {
    "process": "BFF Process",
    "error": "privacyNoticeNotFoundInConfiguration",
    "errorCode": "008-0025",
    "bffEndpoint": "GET /user/consent/:consentType",
    "copy": {
      "it": "Non puoi accedere a PDND Interoperabilità perché non riusciamo a verificare se hai accettato i Termini e condizioni d’uso e preso visione dell’Informativa Privacy.",
      "en": "You can't access PDND Interoperability because we can't check whether you've accepted the Terms and Conditions of Use and read the Privacy Policy."
    }
  },
  {
    "process": "BFF Process",
    "error": "privacyNoticeNotFound",
    "errorCode": "008-0026",
    "bffEndpoint": "GET /user/consent/:consentType",
    "copy": {
      "it": "Non puoi accedere a PDND Interoperabilità perché non riusciamo a verificare se hai accettato i Termini e condizioni d’uso e preso visione dell’Informativa Privacy.",
      "en": "You can't access PDND Interoperability because we can't check whether you've accepted the Terms and Conditions of Use and read the Privacy Policy."
    }
  },
  {
    "process": "BFF Process",
    "error": "privacyNoticeNotFound",
    "errorCode": "008-0026",
    "bffEndpoint": "POST /user/consent/:consentType",
    "copy": {
      "it": "Non puoi accedere a PDND Interoperabilità perché non riusciamo a verificare se hai accettato i Termini e condizioni d’uso e preso visione dell’Informativa Privacy.",
      "en": "You can't access PDND Interoperability because we can't check whether you've accepted the Terms and Conditions of Use and read the Privacy Policy."
    }
  },
  {
    "process": "BFF Process",
    "error": "userNotFound",
    "errorCode": "008-0002",
    "bffEndpoint": "GET /users/:userId",
    "copy": {
      "it": "Non puoi visualizzare i dettagli di questo membro perché non risulta più tra gli utenti attivi del tuo ente. Aggiorna la pagina.",
      "en": "You can't view this member's details because they are no longer listed as an active user for your party. Refresh the page."
    }
  },
  {
    "process": "BFF Process",
    "error": "tenantNotAllowed",
    "errorCode": "008-0032",
    "bffEndpoint": "POST /tools/validateTokenGeneration",
    "copy": {
      "it": "Non puoi verificare questa client assertion: il client a cui si riferisce appartiene a un altro ente. Se hai accesso a quell’ente, cambia profilo. Altrimenti usa una client assertion di un client del tuo ente.",
      "en": "You can't verify this client assertion because the client it refers to belongs to another party. If you have access to that party, switch to that profile; otherwise, use a client assertion from a client belonging to your party."
    }
  }
] as const satisfies readonly ErrorMessage[];

export type GeneratedErrorMessage = (typeof errorMessages)[number];
