# BFF errors mapping

> **Not documented**:
> - Authentication: none — no BFF-specific error is raised while authenticating every request. Errors from specific login endpoints remain documentable.
> - Infrastructure: `selfcareEntityNotFilled`, `attributeNotExists`, `dynamoReadingError`, `missingInterface`, `noDescriptorInEservice`, `missingDescriptorInClonedEservice`, `missingSelfcareId`, `privacyNoticeVersionIsNotTheLatest`, `missingActivePurposeVersion`, `activeAgreementByEserviceAndConsumerNotFound`, `purposeIdNotProvided`, `cannotGetKeyWithClient`, `clientAssertionPublicKeyNotFound`, `delegatedEserviceNotExportable`, `missingUserRolesInIdentityToken`, `noVersionInEServiceTemplate`, `delegationContractNotFound`.
> - Unused (no throw site in the BFF): `eserviceIsNotDraft`, `invalidJwtClaim`, `eserviceTemplateIsNotPublished`, `tooManyDescriptorForInterfaceWithTemplate`, `eserviceTemplateInterfaceNotFound`, `invalidInterfaceFile`, `eserviceTemplateInterfaceDataNotValid`, `invalidEserviceInterfaceFileDetected`, `operationForbidden`.
>
> Routers covered: `catalogRouter`.

## `invalidEserviceRequester`

The e-service does not belong to the requesting producer.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `catalogRouter` | `GET /producers/eservices/{eserviceId}` | In `assertRequesterCanActAsProducer` called by `getProducerEServiceDetails`, the requesting tenant is neither the producer nor an active delegated producer. The list row's detail query can run after a delegation shown in the previously fetched list has been revoked. | **CAN HAPPEN** — `EServiceTableRow` fetches the producer details for each listed e-service; a delegation can be revoked after the list response but before that request completes. | Data precondition: tenant A has an admin or API user and an active producer delegation from tenant B; B can revoke it.<br>1. Sign in as A and open “Erogazione” → “I miei e-service”.<br>2. While B’s delegated e-service is being loaded into the list, have B open “Il mio ente” → “Gestione delle deleghe”, select A’s delegation, and click “Revoca”. The list result can still contain the stale row while its detail request is pending.<br>3. Let the row’s details request complete; it calls this endpoint after the revocation. | 🟡 **Medium resolution** — 1. Ask tenant B to restore the producer delegation, then reload “I miei e-service”; otherwise, open the e-service as tenant B. |
| `catalogRouter` | `GET /producers/eservices/{eserviceId}/descriptors/{descriptorId}` | `assertRequesterCanActAsProducer` in `getProducerEServiceDescriptor` throws when the requester is neither the producer nor an active delegated producer. | **CAN HAPPEN** — a delegated e-service is present in the already-loaded list, then tenant B revokes the delegation before A opens its detail page; the FE still navigates using the stale row IDs. | Data precondition: tenant A has an admin or API user and an active producer delegation from tenant B; B can revoke it. The e-service has a descriptor shown in A’s list.<br>1. Sign in as A and open “Erogazione” → “I miei e-service”; wait for B’s e-service to appear.<br>2. Leave the list open and have B open “Il mio ente” → “Gestione delle deleghe”, select A’s delegation, and click “Revoca”.<br>3. Before A reloads, click “Visualizza” on the stale row. The FE uses its e-service and descriptor IDs to open the detail page, whose descriptor request reaches this endpoint. | 🟡 **Medium resolution** — 1. Ask tenant B to restore the producer delegation, then reload and reopen the e-service; otherwise, ask B to perform the action. |
| `catalogRouter` | `GET /export/eservices/{eserviceId}/descriptors/{descriptorId}` | `assertRequesterIsProducer` in `exportEServiceDescriptor` throws when the requester is not the e-service’s producer. Unlike descriptor retrieval, this check does not accept an active producer delegation. | **CAN HAPPEN** — the detail page allows a delegated producer to view the e-service, and `ProviderEServiceGeneralInfoSection` renders “Scarica questa versione dell’e-service” for non-template e-services without excluding delegated producers. | Data precondition: tenant A has an admin or API user with an active producer delegation from tenant B; B’s e-service is not a template instance and has a valid descriptor.<br>1. Sign in as A and open “Erogazione” → “I miei e-service”.<br>2. Click “Visualizza” on B’s delegated e-service.<br>3. In “Dettagli e-service”, click “Scarica questa versione dell’e-service”. The FE sends the displayed descriptor ID, but the export check requires the producer tenant itself. | 🟡 **Medium resolution** — 1. Ask tenant B to download and share the export, or use an authorized account belonging to B. |

## `eserviceDescriptorNotFound`

The requested descriptor was not found in the e-service.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `catalogRouter` | `GET /producers/eservices/{eserviceId}/descriptors/{descriptorId}` | `retrieveEserviceDescriptor` in `getProducerEServiceDescriptor` throws when the descriptor ID from the path is absent from the e-service returned by catalog-process. A stale draft-only e-service row can retain the deleted draft ID. | Cannot happen — The FE does't permit this operation. | — | — |
| `catalogRouter` | `GET /catalog/eservices/{eserviceId}/descriptor/{descriptorId}` | `retrieveEserviceDescriptor` in `getCatalogEServiceDescriptor` throws if catalog-process returns an e-service that does not contain the requested descriptor. | Cannot happen — `EServiceCatalogGrid` builds the route from the e-service and active descriptor in the same catalog response. Other FE call sites use the e-service and descriptor IDs from the same freshly fetched agreement or purpose; the UI does not remove active descriptors. | — | — |
| `catalogRouter` | `POST /eservices/{eServiceId}/descriptors/{descriptorId}/documents` | `retrieveEserviceDescriptor` in `createEServiceDocument` throws if the descriptor ID from the editor’s loaded descriptor is no longer present in catalog-process. This can happen if another administrator deletes the draft while the editor remains open. | **CAN HAPPEN** — the draft editor uses its loaded descriptor ID for “Salva documento”; another administrator can delete that draft while the form is open. | Data precondition: tenant A has a non-template draft descriptor with no documents, and a second A administrator can delete the draft.<br>1. As an A administrator, open “Erogazione” → “I miei e-service”, choose the draft, then click “Modifica bozza”.<br>2. Select “Informazioni aggiuntive” and leave the editor open.<br>3. Have the second A administrator open “Erogazione” → “I miei e-service”, choose the same draft, and click “Elimina bozza”.<br>4. Select a document, enter a value in “Nome documento”, and click “Salva documento”. The editor submits the now-deleted descriptor ID. | 🟡 **Medium resolution** — 1. Reload the e-service. If the draft was deleted, create or open a replacement draft and upload the document there. |
| `catalogRouter` | `GET /export/eservices/{eserviceId}/descriptors/{descriptorId}` | `retrieveEserviceDescriptor` in `createDescriptorDocumentZipFile` throws if the requested descriptor is absent from the e-service returned by catalog-process. | Cannot happen — the export action is on a detail page loaded for the selected descriptor. The version selector excludes drafts, and the only descriptors deletable through the UI are drafts. | — | — |

## `eserviceRiskNotFound`

The risk analysis was not found in the e-service.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `catalogRouter` | `GET /eservices/{eServiceId}/riskAnalysis/{riskAnalysisId}` | `retrieveRiskAnalysis` in `getEServiceRiskAnalysis` throws when the ID is not among the risk analyses returned for the e-service. The summary page can retain an ID from its descriptor response while another administrator deletes that risk analysis. | Cannot happen — The FE does't permit this operation. | — | — |

## `invalidZipStructure`

The imported ZIP archive does not have the expected structure.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `catalogRouter` | `POST /import/eservices` | `importEService` throws `invalidZipStructure` when the uploaded archive lacks `configuration.json`, its configuration parses but fails schema validation, referenced document/interface files are missing, or it contains files outside the supported archive structure. | **CAN HAPPEN** — `ProviderEServiceImportVersionDrawer` accepts an uploaded file and calls this endpoint after the upload; it does not normalize or repair the archive contents. | Data precondition: sign in as tenant A with an admin or API role; prepare a valid empty `.zip` archive with no `configuration.json`.<br>1. Open “Erogazione” → “I miei e-service” and click “Importa”.<br>2. Select the prepared `.zip` archive.<br>3. Turn on “Ho preso visione e confermo”.<br>4. Click “Importa”. The importer cannot find `configuration.json` and returns this error. | 🟡 **Medium resolution** — 1. Use an unmodified archive exported by the platform, or repair the archive to include a valid `configuration.json` and every referenced file; then import it again. |

## `notValidDescriptor`

The descriptor is in a state that is invalid for the requested operation.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `catalogRouter` | `GET /export/eservices/{eserviceId}/descriptors/{descriptorId}` | `verifyExportEligibility` in `createDescriptorDocumentZipFile` throws when the descriptor is in `DRAFT` or `WAITING_FOR_APPROVAL`. | Cannot happen — The FE does't permit this operation. | — | — |

## `eserviceTemplateNotFound`

The e-service template was not found.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `catalogRouter` | `GET /templates/{templateId}/eservices` | `retrieveEServiceTemplate` in `getEServiceTemplateInstances` throws if the template-process lookup returns no template for the requested ID. | Cannot happen — the provider template “enti utilizzatori” screen gets its template ID from the selected template’s details; the normal UI has no action to delete the template record. | — | — |
| `catalogRouter` | `GET /templates/{templateId}/myInstances` | `retrieveEServiceTemplate` in `getMyEServiceTemplateInstances` throws if the template-process lookup returns no template for the requested ID. | Cannot happen — `ConsumerEServiceTemplateDetailsPage` gets the template ID from the selected catalog template and uses it for “my instances”; the normal UI has no action to delete the template record. | — | — |

## `templateInstanceNotAllowed`

The operation is not allowed on an e-service instance created from a template.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `catalogRouter` | `GET /export/eservices/{eserviceId}/descriptors/{descriptorId}` | `assertEServiceNotTemplateInstance` in `exportEServiceDescriptor` throws when the e-service has a `templateId`. | Cannot happen — `ProviderEServiceGeneralInfoSection` renders “Scarica questa versione dell’e-service” only when `descriptor.templateRef` is absent, which identifies template instances. | — | — |

## `delegatedEserviceNotExportable`

The operation is not allowed on an e-service instance created from a template.

| Router | BFF endpoint | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ------ | ------------ | --------------- | ---------------------- | ----------------------- | ---------------- |
| `catalogRouter` | `GET /export/eservices/{eserviceId}/descriptors/{descriptorId}` | ` assertRequesterIsProducer` in `exportEServiceDescriptor` throws when the requester is the e-service’s producer and there is an active producer delegation. Unlike descriptor retrieval, this check does not accept an active producer delegation. | **CAN HAPPEN** — the detail page allows a delegated producer to view the e-service, and `ProviderEServiceGeneralInfoSection` renders “Scarica questa versione dell’e-service” for non-template e-services without excluding delegated producers. | Data precondition: tenant A has an admin or API user with an active producer delegation from tenant B; B’s e-service is not a template instance and has a valid descriptor.<br>1. Sign in as A and open “Erogazione” → “I miei e-service”.<br>2. Click “Visualizza” on B’s delegated e-service.<br>3. In “Dettagli e-service”, click “Scarica questa versione dell’e-service”. The FE sends the displayed descriptor ID, but the export check requires the producer tenant itself. | 🟡 **Medium resolution** — 1. Ask tenant B to download and share the export, or use an authorized account belonging to B. |