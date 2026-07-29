# PIN-7463 — Spostare la paginazione da M2M al process (solo m2m-gateway-v3)

Spec di implementazione. Fonte del piano: `PIN-7463-m2m-pagination-report.md`.

## Obiettivo

Spostare la paginazione delle sotto-risorse dal gateway **m2m-gateway-v3** al **process**,
sfruttando le tabelle SQL dedicate del readmodel (Mongo è già dismesso: i process leggono via
`drizzle` + Postgres). `m2m-gateway` (v1) **non** va toccato.

## Vincoli

- **NON breaking.** Tutte le modifiche al process sono **additive**: nuovi endpoint di lista
  (nuovi query param opzionali). Il contratto OpenAPI esterno di `m2m-gateway-v3` **non cambia**
  (già espone `offset`/`limit`/`{results, pagination}`): cambia solo l'implementazione interna.
- Modifiche solo a: **process interessato**, **api-clients** (spec + client generato),
  **m2m-gateway-v3**. Mai `m2m-gateway` (v1).
- TDD: test lato process (readmodel + integration route) e lato m2m (integration + api).

## Pattern di riferimento (già esistente in repo)

`getTenantVerifiedAttributeVerifiers` (tenant-process) è una sotto-risorsa già paginata a SQL:
- `packages/api-clients/open-api/tenantApi.yml` → path GET con `offset`/`limit`, response `{results, totalCount}`.
- `packages/api-clients/src/generated/tenantApi.ts` → schema + endpoint zodios (GENERATO).
- `packages/tenant-process/src/services/readModelServiceSQL.ts` → query con
  `withTotalCount(...)` + `.orderBy().offset().limit()` + `createListResult(...)`.
- `packages/tenant-process/src/services/tenantService.ts` → valida esistenza + delega al readmodel.
- `packages/tenant-process/src/routers/TenantRouter.ts` → route `.get()` con auth + parse response.
- m2m: `clients.tenantProcessClient.tenant.getTenantVerifiedAttributeVerifiers({ params, queries:{limit,offset}, headers })`.

## Gestione client generati (IMPORTANTE)

Gli api-clients in `packages/api-clients/src/generated/*.ts` sono **generati** dagli yml via
`pnpm --filter pagopa-interop-api-clients generate-model` (openapi-zod-client). Lo **yml è la
source of truth**. Poiché per policy non eseguo build/generazione, per ogni endpoint aggiungo la
modifica **sia allo yml sia al file generato** (a mano, per lasciare l'albero coerente e i test
lanciabili). Dopo il merge conviene rigenerare canonicamente con lo script sopra.

## Struttura di una slice (checklist ripetibile)

Per ogni sotto-risorsa `X` di risorsa padre `P` nel process `p`:

1. `open-api/<p>Api.yml`: nuova operazione `GET` (query `offset`,`limit` + eventuali filtri),
   response schema `Xs = { results: [X], totalCount }`.
2. `src/generated/<p>Api.ts`: schema `Xs` + endpoint zodios (alias `get<X>`).
3. `src/<p>Api.ts`: (se serve) tipo helper `Get<X>QueryParams`.
4. `<p>-process/src/services/readModelServiceSQL.ts`: `get<X>(parentId, {..filtri, offset, limit}): Promise<ListResult<X>>`
   con query paginata sulla tabella dedicata (+ fetch tabelle figlie via `inArray` se `X` è aggregato).
5. `<p>-process/src/services/<p>Service.ts`: `get<X>(...)` valida esistenza del padre + delega al readmodel.
6. `<p>-process/src/routers/<P>Router.ts`: route `.get()` (auth = stesse role della list del padre).
7. `<p>-process/src/utilities/errorMappers.ts`: `get<X>ErrorMapper` (parentNotFound → 404).
8. Test process: readmodel (paginazione/filtri) + integration route.
9. `m2m-gateway-v3/src/services/<p>Service.ts`: sostituisci lo `.slice(...)` con la chiamata al client.
10. Test m2m v3: integration + api aggiornati (mock del nuovo metodo client invece di `getPurpose`+slice).

## Elenco lavorazioni (ordine = report) — solo le 16 spostabili a DB

Le 3 rotte `users` (SelfCare) sono ESCLUSE: non spostabili a DB.

| # | Process | Sotto-risorsa | Endpoint nuovo | Stato |
|---|---------|---------------|----------------|-------|
| 1 | purpose-process | purpose versions | `GET /purposes/{purposeId}/versions` | ✅ implementata (da verificare i test) |
| 2 | catalog-process | e-service descriptors | `GET /eservices/{eServiceId}/descriptors` | ✅ implementata con visibility (pending generate-model + test) |
| 3 | catalog-process | e-service risk analyses | `GET /eservices/{eServiceId}/riskAnalyses` | ✅ implementata (pending generate-model + test process) |
| 4 | catalog-process | descriptor certified attributes | `GET .../descriptors/{descriptorId}/attributes/certified` | ✅ implementata (ref+visibility, m2m risolve) |
| 5 | catalog-process | descriptor declared attributes | `GET .../descriptors/{descriptorId}/attributes/declared` | ✅ implementata (ref+visibility, m2m risolve) |
| 6 | catalog-process | descriptor verified attributes | `GET .../descriptors/{descriptorId}/attributes/verified` | ✅ implementata (ref+visibility, m2m risolve) |
| 7 | eservice-template-process | template versions | `GET /templates/{id}/versions` | ✅ implementata con visibility (pending generate-model + test) |
| 8 | eservice-template-process | template risk analyses | `GET /templates/{id}/riskAnalyses` | ✅ implementata (pending generate-model + test process) |
| 9 | eservice-template-process | version documents | `GET .../versions/{versionId}/documents` | ✅ implementata con visibility (pending generate-model + test) |
| 10 | eservice-template-process | version certified attributes | `GET .../versions/{versionId}/attributes/certified` | ✅ implementata (ref+visibility, m2m risolve) |
| 11 | eservice-template-process | version declared attributes | `GET .../versions/{versionId}/attributes/declared` | ✅ implementata (ref+visibility, m2m risolve) |
| 12 | eservice-template-process | version verified attributes | `GET .../versions/{versionId}/attributes/verified` | ✅ implementata (ref+visibility, m2m risolve) |
| 13 | tenant-process | tenant declared attributes | `GET /tenants/{tenantId}/attributes/declared` | ✅ implementata (pending generate-model + test process) |
| 14 | tenant-process | tenant certified attributes | `GET /tenants/{tenantId}/attributes/certified` | ✅ implementata (pending generate-model + test process) |
| 15 | tenant-process | tenant verified attributes | `GET /tenants/{tenantId}/attributes/verified` | ✅ implementata (pending generate-model + test process) |
| 16 | authorization-process | producer keychain e-services | `GET /producerKeychains/{id}/eservices` (paginato) | ✅ implementata (pending generate-model + test process) |

> Nota #16: implementata con slice **a livello service** (mirror dell'esistente
> `getProducerKeychainKeys`), non query-level SQL. Sposta comunque la paginazione dal m2m al
> process con l'access-control `assertOrganizationIsProducerKeychainProducer`. Un'eventuale
> ottimizzazione query-level andrebbe applicata anche a `getProducerKeychainKeys` per coerenza.

> Nota #13/#14/#15: gli endpoint tenant `.../verifiers` e `.../revokers` sono già paginati a
> process → riusare lo stesso pattern per gli attributi.

## Slice #1 — design dettagliato (purpose versions)

- **Endpoint**: `GET /purposes/{purposeId}/versions?state&offset&limit` → `PurposeVersions {results:[PurposeVersion], totalCount}`.
  - `state`: opzionale (`PurposeVersionState`), `offset` int ≥0 required, `limit` int 1..50 required.
  - Auth: stesse role di `getPurposes`.
- **Readmodel** (`purpose-process/readModelServiceSQL.getPurposeVersions`):
  1. query paginata su `purpose_version` (filtro `purposeId` + opz. `state`), `orderBy(createdAt asc)`,
     `withTotalCount`, `offset`, `limit`;
  2. fetch tabelle figlie (`purpose_version_document`, `purpose_version_stamp`,
     `purpose_version_signed_document`) per gli id di pagina via `inArray`;
  3. map a `PurposeVersion[]` (mapper locale, mirror di `aggregatePurpose`) + `createListResult`.
- **Ordine**: `createdAt asc` (coerente con `sortPurposeVersionsByDate`). L'm2m non garantiva un
  ordine → non breaking.
- **m2m-v3**: `getPurposeVersions` chiama `purposeProcessClient.getPurposeVersions({params:{purposeId}, queries:{state,offset,limit}, headers})`
  e mappa con `toM2mGatewayApiPurposeVersion`.

## Ricetta concreta per-process (scoperta durante l'analisi)

Aggregatori/tabelle già esistenti da riusare (blast radius minimo: query paginata sugli id +
fetch tabelle figlie via `inArray` + aggregatore esistente).

### catalog-process (#2, #3, #4-6)
- readModelServiceSQL: builder `readModelServiceBuilderSQL(readmodelDB, ..., tenantKindHistoryDB)`;
  già importa `withTotalCount`/`createListResult`/`inArray`/`asc`. Serve importare gli aggregatori.
- **#3 risk analyses**: tabella `eserviceRiskAnalysisInReadmodelCatalog` (filtro `eserviceId`,
  `orderBy(createdAt)`, join answers `eserviceRiskAnalysisAnswerInReadmodelCatalog` via
  `riskAnalysisFormId`) → `aggregateRiskAnalysis(riskAnalysisSQL, answers)` (da `pagopa-interop-readmodel`).
  Converter API: mapping inline in `eServiceToApiEService` (apiConverter.ts:232) da estrarre/replicare.
  Endpoint: `GET /eservices/{eServiceId}/riskAnalyses`. Router: `EServiceRouter.ts`. Auth = quella di `getEServiceById`.
- **#2 descriptors**: `aggregateDescriptor({descriptorSQL, interfacesSQL, documentsSQL, attributesSQL,
  rejectionReasonsSQL, templateVersionRefSQL, archivingScheduleSQL, asyncExchangePropertiesSQL})` —
  8 bundle figli (il più pesante). Converter `descriptorToApiDescriptor` già esiste.
- **#4-6 descriptor attributes**: paginare la tabella `eserviceDescriptorAttributeInReadmodelCatalog`
  filtrando per `descriptorId` + `kind` (certified/declared/verified). Nel m2m l'helper unico
  `retrieveEServiceDescriptorAttributes` copre le 3 rotte.

### eservice-template-process (#7-12)
- Speculare a catalog: aggregatori `aggregateEServiceTemplateVersion` / risk analyses template
  (`eserviceTemplateRiskAnalysis*` tabelle) + attributi versione. Router `EServiceTemplateRouter`.

### tenant-process (#13-15)
- **Più semplice**: mirror ESATTO di `getTenantVerifiedAttributeVerifiers` (già a process).
  Tabelle attributi tenant (`tenantDeclaredAttribute*/tenantCertifiedAttribute*/tenantVerifiedAttribute*`),
  query flat con `withTotalCount` + `createListResult`. Basso rischio.

### authorization-process (#16)
- **producer keychain e-services**: la lista `producerKeychain.eservices` (tabella
  `producerKeychainEServiceInReadmodelProducerKeychain`) paginata; poi il m2m risolve i dettagli
  e-service. Router producer keychain.

## ⚠️ Finding di sicurezza — visibility (catalog, e probabilmente altri)

`GET /eservices/{id}` applica `applyVisibilityToEService` (catalogService.ts:4800):
- ruolo INTERNAL o producer/delegate-producer → vede tutti i descriptor;
- altrimenti → vede **solo i descriptor attivi** (draft nascosti) e riceve **`eServiceNotFound`**
  se non esistono descriptor attivi.

Conseguenze per la migrazione (NON banali, access-control):
- **#2 descriptors**: la query paginata a DB deve filtrare per gli stati **visibili** in base al
  ruolo/tenant, altrimenti espone descriptor draft. Il metodo readmodel `getEServiceDescriptors`
  è stato reso visibility-aware (param `states?: DescriptorState[]`); il **service deve calcolare**
  gli stati visibili (mirror di `applyVisibilityToEService` + `activeDescriptorStates` +
  `hasRoleToAccessInactiveDescriptors` + check producer/delegate).
- **#3 risk analyses**: le risk analyses non sono filtrate per item, MA per preservare il
  comportamento attuale il service deve comunque invocare `applyVisibilityToEService` (che può
  sollevare `eServiceNotFound`) prima di paginare.
- Pattern analoghi vanno verificati per eservice-template e per gli attributi descriptor (#4-6).

**Raccomandazione:** le slice con visibility (#2, #4-6 e analoghe template) vanno implementate con
verifica (test) e non completamente alla cieca, per non introdurre falle di access-control.

### Stato catalog (parziale)
- readmodel `getEServiceRiskAnalyses` (#3) e `getEServiceDescriptors` (#2, visibility-aware)
  AGGIUNTI in `catalog-process/readModelServiceSQL.ts` — **non ancora wired** a service/router/
  OpenAPI/m2m. Da completare con la gestione visibility di cui sopra.

## Comandi di verifica (li lancia l'utente)

```
# rigenera i client dagli yml (canonico)
pnpm --filter pagopa-interop-api-clients generate-model
# typecheck / test
pnpm --filter pagopa-interop-purpose-process test
pnpm --filter pagopa-interop-m2m-gateway-v3 test
```
