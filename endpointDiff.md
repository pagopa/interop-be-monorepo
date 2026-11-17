# Differenze tra gli endpoint

Confronto tra [endpointDaControllare.md](./endpointDaControllare.md) e [endpointMappati.md](./endpointMappati.md).

## Criteri di confronto

- Confronto per metodo HTTP e percorso, indipendentemente dall'ordine e dai duplicati.
- Parametri normalizzati da `:nome` a `{nome}`. Nel confronto conta la posizione, non il nome: `{partyId}` e `{tenantId}`, `{kid}` e `{keyId}`, `{id}` e `{purposeTemplateId}` sono equivalenti nella stessa posizione.
- I segmenti statici e i metodi HTTP restano distinti: ad esempio `PUT`, `POST` e `PATCH` sullo stesso percorso sono differenze da verificare.
- Le sequenze separate da frecce sono scomposte nei singoli endpoint, ignorando note come `(se presente)`.
- Gli URL esterni presigned descritti tra parentesi graffe non sono endpoint confrontabili e sono esclusi.
- Negli elenchi i parametri sono mostrati con la sintassi `{nome}`, conservando il primo nome incontrato nel rispettivo file.

## Riepilogo

| Voce | Numero |
| --- | ---: |
| Endpoint unici in endpointDaControllare.md | 180 |
| Endpoint unici in endpointMappati.md | 114 |
| Endpoint comuni dopo la normalizzazione | 100 |
| Solo in endpointDaControllare.md | 80 |
| Solo in endpointMappati.md | 14 |
| Totale endpoint non comuni | 94 |

## Solo in endpointDaControllare.md (80)

```text
"DELETE /agreements/{agreementId}",
"GET /agreements/{agreementId}/contract",
"POST /agreements/{agreementId}/update",

"POST /agreements/{agreementId}/upgrade",
"DELETE /clients/{clientId}",
"POST /clients/{clientId}/admin",

"DELETE /clients/{clientId}/admin/{adminId}",
"DELETE /clients/{clientId}/purposes/{purposeId}",
"POST /clients/{clientId}/users",

"DELETE /clients/{clientId}/users/{userId}",
"GET /delegations/{delegationId}/contracts/{contractId}",
"GET /delegations/{delegationId}/signedContract/{contractId}",

"POST /eservices/templates/{eServiceTemplateId}",
"GET /eservices/templates/{eServiceTemplateId}/instances",
"POST /eservices/templates/{eserviceTemplateId}/personalDataFlag",

"DELETE /eservices/templates/{eServiceTemplateId}/riskAnalysis/{riskAnalysisId}",
"POST /eservices/templates/{eServiceTemplateId}/riskAnalysis/{riskAnalysisId}",
"POST /eservices/templates/{eServiceTemplateId}/versions",

"DELETE /eservices/templates/{eServiceTemplateId}/versions/{eServiceTemplateVersionId}",
"POST /eservices/templates/{eServiceTemplateId}/versions/{eServiceTemplateVersionId}/activate",
"POST /eservices/templates/{eServiceTemplateId}/versions/{eServiceTemplateVersionId}/attributes/update",

"DELETE /eservices/templates/{eServiceTemplateId}/versions/{eServiceTemplateVersionId}/documents/{documentId}",
"POST /eservices/templates/{eServiceTemplateId}/versions/{eServiceTemplateVersionId}/publish",
"POST /eservices/templates/{eServiceTemplateId}/versions/{eServiceTemplateVersionId}/quotas/update",

"POST /eservices/templates/{eServiceTemplateId}/versions/{eServiceTemplateVersionId}/suspend",
"PUT /eservices/{eserviceId}",
"POST /eservices/{eserviceId}/approveDelegatedArchiving",

"GET /eservices/{eserviceId}/consumers",
"PUT /eservices/{eserviceId}/descriptors/{descriptorId}",
"POST /eservices/{eserviceId}/descriptors/{descriptorId}/approve",

"POST /eservices/{eserviceId}/descriptors/{descriptorId}/approveDelegatedArchiving",
"POST /eservices/{eserviceId}/descriptors/{descriptorId}/clone",
"GET /eservices/{eserviceId}/descriptors/{descriptorId}/documents/{documentId}",

"POST /eservices/{eserviceId}/descriptors/{descriptorId}/rejectDelegatedArchiving",
"DELETE /eservices/{eserviceId}/descriptors/{descriptorId}/scheduleArchive",
"POST /eservices/{eserviceId}/descriptors/{descriptorId}/scheduleArchive",

"POST /eservices/{eserviceId}/rejectDelegatedArchiving",
"DELETE /eservices/{eserviceId}/riskAnalysis/{riskAnalysisId}",
"DELETE /eservices/{eserviceId}/scheduleArchive",

"GET /import/eservices/presignedUrl",
"DELETE /inAppNotifications",
"POST /inAppNotifications/bulk/markAsRead",

"POST /inAppNotifications/bulk/markAsUnread",
"DELETE /inAppNotifications/{notificationId}",
"POST /inAppNotifications/{notificationId}/markAsRead",

"POST /inAppNotifications/{notificationId}/markAsUnread",
"DELETE /producerKeychains/{producerKeychainId}",
"DELETE /producerKeychains/{keychainId}/eservices/{eserviceId}",

"DELETE /producerKeychains/{producerKeychainId}/keys/{keyId}",
"POST /producerKeychains/{producerKeychainId}/users",
"DELETE /producerKeychains/{producerKeychainId}/users/{userId}",

"POST /purposeTemplates",
"DELETE /purposeTemplates/{id}",
"POST /purposeTemplates/{id}/archive",

"DELETE /purposeTemplates/{purposeTemplateId}/riskAnalysis/answers/{answerId}/annotation",
"DELETE /purposeTemplates/{purposeTemplateId}/riskAnalysis/answers/{answerId}/annotation/documents/{documentId}",
"GET /purposeTemplates/{purposeTemplateId}/riskAnalysis/answers/{answerId}/annotation/documents/{documentId}",

"POST /purposeTemplates/{id}/suspend",
"POST /purposeTemplates/{purposeTemplateId}/unlinkResource",
"DELETE /purposes/{purposeId}",

"GET /purposes/{purposeId}",
"POST /purposes/{purposeId}/riskAnalysis/assign",
"POST /purposes/{purposeId}/riskAnalysis/submit",

"POST /purposes/{purposeId}/versions",
"DELETE /purposes/{purposeId}/versions/{versionId}",
"POST /purposes/{purposeId}/versions/{versionId}/activate",

"POST /purposes/{purposeId}/versions/{versionId}/archive",
"GET /purposes/{purposeId}/versions/{versionId}/documents/{documentId}",
"POST /purposes/{purposeId}/versions/{versionId}/reject",

"GET /purposes/{purposeId}/versions/{versionId}/signedDocuments/{signedContractId}",
"POST /purposes/{purposeId}/versions/{versionId}/suspend",
"POST /reverse/purposes/{purposeId}",

"POST /tenantNotificationConfigs",
"POST /tenants/attributes/declared",
"DELETE /tenants/attributes/declared/{attributeId}",

"DELETE /tenants/{tenantId}/attributes/certified/{attributeId}",
"DELETE /tenants/{tenantId}/attributes/certifiedDiscrete/{attributeId}",
"PUT /tenants/{tenantId}/attributes/certifiedDiscrete/{attributeId}",

"DELETE /tenants/{partyId}/attributes/verified/{attributeId}",
"POST /userNotificationConfigs"
```

## Solo in endpointMappati.md (14)

```text
POST /agreements/{agreementId}/unsuspend
PATCH /clients/{clientId}
PATCH /eservices/templates/{eServiceTemplateId}
PATCH /eservices/{eServiceId}
PATCH /producerKeychains/{producerKeychainId}
GET /producers/eservices/{eserviceId}
GET /producers/eservices/{eserviceId}/descriptors/{descriptorId}
PATCH /purposeTemplates/{purposeTemplateId}
PUT /purposeTemplates/{purposeTemplateId}/riskAnalysis/answers/{answerId}/annotation
PATCH /purposes/{purposeId}
PATCH /reverse/purposes/{purposeId}
GET /user/consent/{consentType}
POST /user/consent/{consentType}
GET /users/{userId}
```
