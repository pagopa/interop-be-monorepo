> Note: `GET /attributes` has `emptyErrorMapper` and therefore no non-500 errors; it is intentionally not documented as a separate section.

## 1. `GET /attributes/name/:name`

Service: `attributeRegistryService` → `getAttributeByName`. Mapper: `getAttributesByNameErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SUPPORT_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`.

### BFF endpoints

- none found by the generator

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | ---------------------- | ----------------------- | --------------- |
| `attributeNotFound` | 404 | The read model lookup for the requested attribute name returns `undefined` in `getAttributeByName`. | Cannot happen — no frontend route or component calls this endpoint; the UI only queries the generic attribute list via `GET /attributes`, never the name-based lookup. | — | No resolution needed — the UI never invokes this lookup. |

## 2. `GET /attributes/origin/:origin/code/:code`

Service: `attributeRegistryService` → `getAttributeByOriginAndCode`. Mapper: `getAttributeByOriginAndCodeErrorMapper`. Roles: `ADMIN_ROLE`, `SUPPORT_ROLE`, `M2M_ROLE`.

### BFF endpoints

- `GET /attributes/origin/:origin/code/:code`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | ---------------------- | ----------------------- | --------------- |
| `attributeNotFound` | 404 | The read model lookup for the requested attribute by `origin` and `code` returns `undefined` in `getAttributeByOriginAndCode`. | Cannot happen — no FE action or UI route reaches this BFF endpoint; the frontend does not call the origin/code lookup and the generic attribute autocomplete only uses `GET /attributes`. | — | No resolution needed — the UI never invokes this lookup. |

> Note: `POST /bulk/attributes` has `emptyErrorMapper` and therefore no non-500 errors; it is intentionally not documented as a separate section.

## 3. `GET /attributes/:attributeId`

Service: `attributeRegistryService` → `getAttributeById`. Mapper: `getAttributeByIdErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SUPPORT_ROLE`, `SECURITY_ROLE`, `M2M_ADMIN_ROLE`, `M2M_ROLE`, `REVIEWER_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- `GET /attributes/:attributeId`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | ---------------------- | ----------------------- | --------------- |
| `attributeNotFound` | 404 | The read model lookup for the requested attribute ID returns `undefined` in `getAttributeById`. | cannot happen — the attribute cannot be deleted and the page is shown only from a list | — | — |

## 4. `POST /bulk/attributes`

Service: `attributeRegistryService` → `getAttributesByIds`. Mapper: `emptyErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `SUPPORT_ROLE`, `SECURITY_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`, `REVIEWER_ROLE`, `VIEWER_ROLE`.

### BFF endpoints

- none found by the generator

No non-500 mapper errors are defined for this endpoint; it is intentionally excluded from a dedicated table.

## 5. `POST /certifiedAttributes`

Service: `attributeRegistryService` → `createCertifiedAttribute`. Mapper: `createCertifiedAttributesErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /certifiedAttributes`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | ---------------------- | ----------------------- | --------------- |
| `tenantIsNotACertifier` | 403 | `getCertifierId` checks the active tenant's features and throws `tenantIsNotACertifier` when no valid certifier feature is present. | Cannot happen — the `TENANT_CERTIFIER` route is gated by `AuthGuard`, which rejects non-certifier tenants before the action is rendered; the drawer is only available to a certifier organization. | — | No resolution needed — only a certifier tenant can reach this form. |
| `attributeDuplicate` | 409 | `readModelService.getAttributeByCodeOriginOrName(...)` finds an existing attribute for the same certifier, same name, or same generated code, and `attributeDuplicateByCodeOriginOrName(...)` is thrown. | **CAN HAPPEN** — the frontend creates the `code` as a hash of the typed name and does not perform a duplicate check before submitting, so a second attribute with the same name can be submitted. | **Data precondition:** you are logged in as a certifier tenant A and an attribute with the same name is already present in A's certifier registry.<br>1. Go to `/ente-certificatore` and open the attribute creation drawer.<br>2. In the name field, type the existing attribute name exactly as already present in A.<br>3. Fill the description and click _Crea attributo certificato_ / the submit action. | 🟡 Medium resolution <br />1. Change the attribute name to a unique value.<br />2. Re-open the drawer and submit again only after confirming the name is not already used by the certifier.<br />3. If the duplicate persists, refresh the page and verify the existing attribute list before retrying. |

> Note: `tenantNotFound` is thrown by `getCertifierId` when the active tenant record is missing from the read model; it falls through to the default common mapper and resolves as 500 because it is not a common code and is not declared in the endpoint mapper.

## 6. `POST /certifiedDiscreteAttributes`

Service: `attributeRegistryService` → `createCertifiedDiscreteAttribute`. Mapper: `createCertifiedAttributesErrorMapper`. Roles: `ADMIN_ROLE`, `M2M_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /certifiedDiscreteAttributes`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | ---------------------- | ----------------------- | --------------- |
| `tenantIsNotACertifier` | 403 | `getCertifierId` fails because the active organization is not a certifier and throws `tenantIsNotACertifier` before the attribute record is created. | Cannot happen — the certifier page is rendered only for tenants that pass `isTenantCertifier`, and the drawer action is hidden for non-certifier organizations. | — | No resolution needed — only a certifier tenant can reach this form. |
| `attributeDuplicate` | 409 | `readModelService.getAttributeByCodeOriginOrName(...)` finds an existing attribute for the same certifier, same name, or same generated code, and `attributeDuplicateByCodeOriginOrName(...)` is thrown. | **CAN HAPPEN** — the frontend submits a new certifier attribute without a client-side duplicate check, so a second attribute with the same name can be created. | **Data precondition:** you are logged in as certifier tenant A and an attribute with the same name already exists in A's certifier registry.<br>1. Go to `/ente-certificatore` and open the create-attribute drawer.<br>2. Choose _Attributo certificato con valore da personalizzare_ if the feature flag is enabled, or open the certifier attribute creation flow that submits `POST /certifiedDiscreteAttributes`.<br>3. Enter the existing attribute name in the _Nome_ field and a description, then click _Crea attributo_. | 🟡 Medium resolution <br />1. Change the attribute name to a unique value.<br />2. Re-open the drawer and submit the form again only after confirming the name is not already used in the certifier registry.<br />3. If the duplicate still persists, refresh the page and check the current attribute list before retrying. |

> Note: `tenantNotFound` can be thrown by `getCertifierId` when the active tenant is missing from the read model; because it is not in the mapper, the default common mapper resolves it as 500.

## 7. `POST /declaredAttributes`

Service: `attributeRegistryService` → `createDeclaredAttribute`. Mapper: `createDeclaredAttributesErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /declaredAttributes`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | ---------------------- | ----------------------- | --------------- |
| `originNotCompliant` | 403 | `retrieveOriginFromAuthData(...)` resolves the requesting tenant origin and `config.producerAllowedOrigins.includes(origin)` fails, causing `originNotCompliant(origin)` to be thrown. | Cannot happen — the provider create-attribute form is only available on protected provider routes, and `AuthGuard` blocks tenants whose organization is not allowed to produce before the drawer is rendered. | — | No resolution needed — the UI path is gated before this server-side validation can be reached. |
| `attributeDuplicate` | 409 | `readModelService.getAttributeByName(...)` finds an existing attribute with the same name and `attributeDuplicateByName(...)` is thrown. | **CAN HAPPEN** — the provider form accepts a new declared attribute name with no duplicate check in the client, so the same name can be submitted twice. | **Data precondition:** you are logged in as provider tenant A and an attribute with the same name already exists in the registry.<br>1. Go to `/erogazione/e-service/crea/` and proceed to the attribute step (thresholds/attributes).<br>2. Click _Crea attributo_ to open the drawer for declared attributes.<br>3. Enter the existing attribute name and a description, then click _Crea attributo_. | 🟡 Medium resolution <br />1. Change the attribute name to a unique value.<br />2. Close and reopen the drawer, then re-submit only after checking the current list for duplicates.<br />3. Refresh the page if the server-side duplicate was just created by another user or action. |

> Note: `tenantNotFound` can be thrown by `retrieveOriginFromAuthData(...)` when the active tenant is missing; because it is not mapped here, the default common mapper resolves it as 500.

## 8. `POST /verifiedAttributes`

Service: `attributeRegistryService` → `createVerifiedAttribute`. Mapper: `createVerifiedAttributesErrorMapper`. Roles: `ADMIN_ROLE`, `API_ROLE`, `M2M_ADMIN_ROLE`.

### BFF endpoints

- `POST /verifiedAttributes`

| Error | Status | When it happens | Reachable from the FE? | Steps to reproduce (UI) | Resolution steps |
| ----- | ------ | --------------- | ---------------------- | ----------------------- | --------------- |
| `originNotCompliant` | 403 | `retrieveOriginFromAuthData(...)` resolves the requesting tenant origin and `config.producerAllowedOrigins.includes(origin)` fails, causing `originNotCompliant(origin)` to be thrown. | Cannot happen — the provider create-attribute form is only available on protected provider routes, and `AuthGuard` blocks tenants whose organization is not allowed to produce before the drawer is rendered. | — | No resolution needed — the UI path is gated before this server-side validation can be reached. |
| `attributeDuplicate` | 409 | `readModelService.getAttributeByName(...)` finds an existing attribute with the same name and `attributeDuplicateByName(...)` is thrown. | **CAN HAPPEN** — the provider form accepts a new verified attribute name with no duplicate check in the client, so the same name can be submitted twice. | **Data precondition:** you are logged in as provider tenant A and an attribute with the same name already exists in the registry.<br>1. Go to `/erogazione/e-service/crea/` and proceed to the attribute step (thresholds/attributes).<br>2. Click _Crea attributo_ to open the drawer for verified attributes.<br>3. Enter the existing attribute name and a description, then click _Crea attributo_. | 🟡 Medium resolution <br />1. Change the attribute name to a unique value.<br />2. Close and reopen the drawer, then re-submit only after checking the current list for duplicates.<br />3. Refresh the page if the duplicate was just created by another user or action. |

> Note: `tenantNotFound` can be thrown by `retrieveOriginFromAuthData(...)` when the active tenant is missing; because it is not mapped here, the default common mapper resolves it as 500.
