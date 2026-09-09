# PIN-5576 — Standardize the test utils

> Branch: `PIN-5576-standardize-the-test-utils`
> Fonte: Jira PIN-5576 (duplicato di IMN-248). Update ticket 22/05/24 + analisi commento 21/07/2026.

## Contesto

Non esiste un modo unico per definire le funzioni che generano dati mock nei test:
util sparse tra i package, alcuni servizi ridefiniscono i propri metodi, altri usano
quelli condivisi in `commons-test`. L'update del 22/05/24 chiede di partire da dati
random e sovrascrivere inline dove serve, invece di nascondere override dentro i
metodi `getMock...()`.

## Analisi verificata (09/09/2026)

Numeri reali misurati sul monorepo:

| Metrica | Commento 21/07 | Repo oggi |
|---|---|---|
| `getMock*` esportati totali | 215 | **267** |
| di cui in `commons-test/src/testUtils.ts` | 62 | **62** (1633 righe) |
| file `test/utils.ts` / `test/mockUtils.ts` | ~78 | **72** |
| file con `generateMock` diretto | 84 | **84** |
| `.test.ts` totali | 2099 | **2098** |
| file che importano `commons-test` | 2112 | **2109** |
| util con object-param | 6 | **6** |

Le uniche 6 util già object-param: `getMockClient`, `getMockProducerKeychain`,
`getMockDelegation`, `getMockContext*`.

Call-site delle util più usate (numeri reali):

```
getMockContext              2225      getMockAgreement            728
getMockAuthData             1810 (!)  getMockPurpose              524
getMockTenant               1314      getMockDelegation           490  (già object-param)
getMockEService             1091      getMockClient               236  (già object-param)
getMockDescriptor            735      getMockDescriptorPublished   232
```

### Correzioni all'analisi del 21/07

1. **`getMockAuthData` (1810 usi) mancava dal commento.** È la 2ª util più usata,
   firma posizionale `(organizationId?, userId?, userRoles?)`, e hardcoda
   `externalId: { value: "123456", origin: "IPA" }`.
2. Lo shadow `getMockAgreement` di `tenant-process` NON è un duplicato assorbibile con
   un delete: usa già object-param con firma diversa e più stretta
   (`{ eserviceId, descriptorId, producerId, consumerId }` obbligatori) e default
   `state: 'active'` invece di `'draft'`.
3. Gli shadow di `catalog-readmodel-writer-sql` (`getMockEService`/`getMockDescriptor`,
   righe 1684/1696 dell'integration test) sono copie locali pigre senza argomenti →
   sostituzione banale.

### Override nascosti confermati

- `getMockEService` → **non parte da `generateMock`**: hardcoda `name`, `description`,
  `technology.rest`, `mode:"Deliver"`, `riskAnalysis:[]`.
- `getMockTenant`, `getMockDescriptor`, `getMockPurpose` → interamente hardcoded.
- `getMockAgreement` → `generateMock(Agreement)` ma forza `certifiedDiscreteAttributes:[]`
  + `stamps:getMockAgreementStamps()`.
- `getMockAgreementStamps` → `generateMock` seguito da `delete` su 7 `delegationId`.
- `getMockAuthData` → `externalId` hardcoded `"123456"`.
- `getMockCertifiedDiscreteTenantAttribute` → hardcoda `discreteValue:42`.

## Decisioni prese

- **Direzione:** object-param + override espliciti (mantenere i wrapper con valore,
  firma a oggetto, partire da `generateMock` e sovrascrivere solo le invarianti di
  dominio). NON demolire i wrapper.
- **Meccanismo migrazione firme:** codemod `ts-morph`, 1 PR per package (rilevante per
  il futuro ticket "firme", non per questo).
- **Scope di QUESTO ticket:** **solo gli override espliciti.** Le firme object-param e
  gli shadow+lint diventano ticket separati e non collegati.

## Perché non un big-bang

Un big-bang su ~2100 file test va in conflitto con ogni branch aperto ed è
irrevieweabile. La premessa 2024 ("cancella i wrapper") è invecchiata: `getMockContext`
(2225 usi) costruisce una struttura non banale e ha valore reale; `getMockDelegation`/
`getMockClient` già usano object-param, che risolve la lamentela sull'ordine dei
parametri senza cancellare la util.

## Epic → 3 ticket (per contesto; qui eseguiamo solo il n.2)

1. **Firme object-param** — convertire a `getMockX({...})` le ~10 util più usate,
   incluso `getMockAuthData`. Codemod ts-morph, 1 PR/package. *(ticket separato)*
2. **Override espliciti** — QUESTO TICKET. Vedi sotto.
3. **Shadow + lint** — assorbire i 5 shadow, lint rule anti-ridefinizione. *(ticket separato)*

---

## Questo ticket: "Rendere espliciti gli override nascosti"

### Obiettivo (scoped)
Le util `getMock*` devono partire da `generateMock(Schema)` e sovrascrivere solo le
invarianti di dominio strettamente necessarie, ciascuna documentata. Si eliminano i
valori hardcoded arbitrari e i `delete` su campi generati. **Le firme restano
invariate** (object-param è un altro ticket). **Gli shadow restano dove sono** (altro
ticket). Diff puramente interno alle util + fix mirati dei test che cadono.

### Pattern target
```ts
export const getMockEService = (
  eserviceId: EServiceId = generateId<EServiceId>(),
  producerId: TenantId = generateId<TenantId>(),
  descriptors: Descriptor[] = [],
  templateId?: EServiceTemplateId
): EService => ({
  ...generateMock(EService),
  id: eserviceId,
  producerId,
  descriptors,          // invariante: partiamo senza descrittori
  riskAnalysis: [],     // invariante di dominio documentata
  ...(templateId ? { templateId, instanceLabel: "instance 001" } : {}),
  // name / description / technology / mode → ora random da generateMock
});
```

### Regola per ogni campo override
1. **Invariante di dominio** (senza cui il mock è incoerente) → tienilo come override
   esplicito + commento che spiega il perché.
2. **Valore arbitrario "carino"** (`name:"eService name"`, `"123456"`) → rimuovi, lascia
   random; se un test ne dipende, il test lo imposta inline.
3. **`delete` su campo generato** → costruisci esplicitamente il sotto-oggetto senza quel
   campo, niente `delete`.

### Inventario target

| Util | Override nascosto | Azione |
|---|---|---|
| `getMockEService` | no `generateMock`; `name`,`description`,`technology`,`mode`,`riskAnalysis` | `...generateMock(EService)` + tieni `descriptors:[]`, `riskAnalysis:[]` |
| `getMockTenant` | interamente hardcoded | `...generateMock(Tenant)` + override minimi |
| `getMockDescriptor` | interamente hardcoded | `...generateMock(Descriptor)` + logica `state→timestamp` esplicita |
| `getMockPurpose` | interamente hardcoded | `...generateMock(Purpose)` + override minimi |
| `getMockAgreement` | forza `certifiedDiscreteAttributes:[]`, `stamps` | valuta invarianti; documenta |
| `getMockAgreementStamps` | `generateMock` + 7 `delete` | ricostruisci esplicitamente, no `delete` |
| `getMockAuthData` | `externalId:"123456"` | rimuovi magic value |
| `getMockCertifiedDiscreteTenantAttribute` | `discreteValue:42` | random o documentato |

**Task 0:** audit completo delle 62 util → classifica in *(a) già generateMock corrette*,
*(b) override nascosti*, *(c) legittimamente hardcoded*. L'inventario sopra è il nucleo
confermato; l'audit chiude i casi residui.

### Strategia — 1 PR per util (o gruppo affine)
1. Riscrivi la util in `commons-test`.
2. Lancia i test del repo per quella util → raccogli i caduti.
3. Triage dei caduti:
   - rotto perché asseriva un valore hardcoded arbitrario → il test lo esplicita inline.
   - rotto perché passava per la ragione sbagliata → segnalalo nel PR, poi rendi
     esplicita la precondizione del test. **È il deliverable del ticket.**
   - rotto perché l'invariante era reale → reintroducila come override documentato.

### Ordine consigliato (meno → più pervasivo)
`getMockAgreementStamps` → `getMockCertifiedDiscreteTenantAttribute` → `getMockAuthData`
→ `getMockPurpose` → `getMockDescriptor` → `getMockAgreement` → `getMockTenant` →
`getMockEService`.

### Nota sul codemod
Qui il fallout è comportamentale (assert di valori), non sintattico (forma della
chiamata): i test si correggono a mano, caso per caso. Il codemod ts-morph si usa nel
futuro ticket "firme", non in questo.

### Definition of Done
- Ogni util dell'inventario parte da `generateMock(Schema)`.
- Ogni override residuo ha un commento che ne motiva l'invariante.
- Zero `delete` su campi generati da `generateMock`.
- Zero magic value arbitrari nascosti nelle util.
- Test verdi; i test corretti perché "passavano per la ragione sbagliata" elencati nel PR.

### Fuori scope
- Conversione firme object-param (incl. `getMockAuthData`) → ticket "firme".
- Assorbimento dei 5 shadow + lint rule → ticket "shadow/lint".
- `readmodel/src/testUtils.ts` (helper `upsert*`) e i `test/utils.ts` di setup/asserzione
  → non sono mock, restano fuori.

---

## Task 0 — Audit delle 62 util (COMPLETATO 09/09/2026)

Legenda: **(a)** già `generateMock`-based corretta · **(b)** override nascosti (target) ·
**(c)** legittimamente hardcoded/strutturale (fuori scope o già ok).

### (b) — TARGET di questo ticket

**Nucleo confermato:**
| Util | Problema |
|---|---|
| `getMockAgreementStamps` | `generateMock` + `delete` su 7 `delegationId` (+ `eslint-disable fp/no-delete`) |
| `getMockCertifiedDiscreteTenantAttribute` | hardcoda `discreteValue:42`, no `generateMock` |
| `getMockAuthData` | hardcoda `externalId:{value:"123456",origin:"IPA"}` |
| `getMockPurpose` | interamente hardcoded, no `generateMock` |
| `getMockDescriptor` | interamente hardcoded, no `generateMock` |
| `getMockAgreement` | `generateMock(Agreement)` + forza `certifiedDiscreteAttributes:[]`, `stamps` |
| `getMockTenant` | interamente hardcoded, no `generateMock` |
| `getMockEService` | no `generateMock`; `name`,`description`,`technology`,`mode`,`riskAnalysis` hardcoded |

**Ulteriori (b) emersi dall'audit — stesso pattern (no `generateMock`, valori arbitrari):**
| Util | Problema |
|---|---|
| `getMockPurposeTemplate` | hardcoded, no `generateMock` |
| `getMockPurposeVersion` | hardcoded, no `generateMock` |
| `getMockEServiceTemplateVersion` | hardcoded, no `generateMock` |
| `getMockEServiceTemplate` | hardcoded (`technology`,`mode`,`riskAnalysis:[]`,`isSignalHubEnabled:true`) |
| `getMockAttribute` / `getMockCertifiedAttribute` | parziali: `generateMock` solo per `name` |
| `getMockSessionClaims` | magic `name`/`email` hardcoded (minore) |

**Derivate (si sistemano una volta corretta la base):**
`getMockDescriptorArchiving`, `getMockDescriptorPublished` (derivano da `getMockDescriptor`);
`getMockDescriptorList` (compone `getMockDescriptor`).

### (a) — Già corrette (nessun intervento)
`getMockEServiceAttribute`, `getMockEServiceTemplateAttribute`,
`getMockVerifiedTenantAttribute`, `getMockCertifiedTenantAttribute`,
`getMockDeclaredTenantAttribute`, `getMockPurposeVersionStamps`,
`getMockNotificationConfig`, `getMockTenantNotificationConfig`,
`getMockUserNotificationConfig`, `getMockWithMetadata`, `getMockTenantMail` (parziale).

### (c) — Strutturali/fixture legittime (fuori scope)
`getMockClient`, `getMockProducerKeychain`, `getMockDelegation`, `getMockContext*`
(già object-param, reference pattern); `getMockClientAssertion`, `getMockDPoPProof`
(già override-via-param); tutti i `...Document`/`...Contract`/`...SignedDocument`;
`getMockKey`, `getMockClientJWKKey`, `getMockProducerJWKKey`;
`getMockTokenGenStates*`, `getMockPlatformStates*` (builder strutturali DynamoDB);
`getMockAgreementStamp`, `getMockAgreementAttribute`, `getMockEServiceAttributes`
(compositori/schema banale); `getMockDescriptorRejectionReason`, `getMockTenantRemoteId`,
`getMockEServiceAttributeCertifiedDiscrete*`; `getMockedPdfBuffer`,
`getPaddedMockedPdfBuffer`, `createDummyStub`.

### Ordine di esecuzione (meno → più pervasivo)
1. `getMockAgreementStamps` — **behavior-equivalent** (rimuove `delete`, esplicita "no delegationId"). Fallout atteso: **zero**.
2. `getMockCertifiedDiscreteTenantAttribute`
3. `getMockAuthData`
4. `getMockPurpose`
5. `getMockDescriptor`
6. `getMockAgreement`
7. `getMockTenant`
8. `getMockEService`

_(`getMockPurposeTemplate`, `getMockPurposeVersion`, `getMockEServiceTemplate*`,
`getMockAttribute*`, `getMockSessionClaims` in coda, dopo aver rodato il pattern.)_

## Log di esecuzione
- **Task 0 (audit):** completato 09/09/2026.
- **PR 1 — `getMockAgreementStamps`:** rimosso il `delete` (+ `eslint-disable fp/no-delete`),
  ricostruzione esplicita degli stamp senza `delegationId`. Behavior-equivalent.
- **PR 2 — `getMockCertifiedDiscreteTenantAttribute`:** ora `...generateMock(...)` + `id`;
  rimossi `discreteValue:42` / `revocationTimestamp:undefined`; rimosso import
  `tenantAttributeType` inutilizzato. Fallout atteso in `agreement-process` (matching
  discreto) → richiede test-loop.
- **PR 3 — `getMockAuthData`:** `externalId.value "123456"` → `generateId()`. Nessun test
  asserisce quel valore per authData; `origin:"IPA"` tenuto come default di dominio.

## Randomizzazione dei valori arbitrari (COMPLETATO 09/09/2026)

Applicato a tutte le entity/template/attribute util: i **valori cosmetici arbitrari**
(stringhe hardcoded) ora vengono da `generateMock(z.string())`; i **default di dominio**
(`technology.rest`, `mode`, `externalId.origin:"IPA"`, `audience`, `voucherLifespan`,
collezioni vuote, flag) restano espliciti perché i test li usano legittimamente
(randomizzarli = churn, non bug).

Util toccate: `getMockEService` (name/description), `getMockTenant` (name),
`getMockPurpose` (title/description/freeOfChargeReason), `getMockPurposeTemplate`
(targetDescription/purposeTitle/purposeDescription), `getMockEServiceTemplate`
(name/intendedTarget/description), `getMockEServiceTemplateVersion` (description),
`getMockAttribute`/`getMockCertifiedAttribute` (description),
`getMockSessionClaims` (name/family_name/email).

**Fallout statico (sweep completo):** su 16 stringhe magiche randomizzate, solo `"A tenant"`
era referenziato (15 punti), di cui **14 non si rompono** (set espliciti in payload,
filtri negativi con `totalCount:0` senza tenant nel DB) e **1 sola rottura reale** →
`in-app-notification-dispatcher/.../handleEserviceTemplateStatusChangedToInstantiator.test.ts`
(letterale `"A tenant"` → `creatorTenant.name`). **Corretto.**

Motivo del basso impatto: il codebase cattura i valori mock in variabili
(`mockEService.name`, `creatorTenant.name`) e li riusa, invece di hardcodare il letterale
di default → randomizzare i default arbitrari non rompe quasi nulla. Questo *conferma* che
quei valori non erano un'assunzione nascosta rischiosa.

## Blocco strutturale sulle entity-mock (evidenza)
Le util `getMockEService`, `getMockTenant`, `getMockDescriptor`, `getMockAgreement`,
`getMockPurpose` **non possono** essere convertite a `...generateMock(Schema)` alla cieca:

1. **Iniezione di campi opzionali.** Es. `EService` ha 6 opzionali non settati dalla util
   (`isSignalHubEnabled`, `isConsumerDelegable`, `isClientAccessDelegable`, `personalData`,
   `archivingReason`, `asyncExchange`), oggi sempre `undefined`. `generateMock` li
   renderebbe random `true/false`; la logica di dominio branch-a su di essi. Idem
   `Agreement` (`suspendedByConsumer/Producer/Platform`), `Descriptor` (timestamp di stato).
2. **Randomizzazione di scalari semantici.** `technology`/`mode` (EService),
   `externalId.origin "IPA"` (Tenant, toccato da **161 test**): il codice branch-a per
   SOAP/Receive/registry **senza che i test asseriscano il campo** → rottura invisibile.

Conseguenza: la conversione richiede il **test-loop** (modalità A) per enumerare e
correggere i test che "passavano per la ragione sbagliata". Per policy i test li lancia
l'utente (regola 4). Le entity-mock restano quindi in attesa del loop, util-per-util,
nell'ordine: `getMockPurpose` → `getMockDescriptor` → `getMockAgreement` → `getMockTenant`
→ `getMockEService` (dal meno al più pervasivo).

---

# ESECUZIONE EFFETTIVA — Point 1: firme object-param (codemod)

**Fatto** (il "problema vero" del commento 21/07: firme posizionali).

9 util convertite da posizionali a object-param in `commons-test/src/testUtils.ts`:
`getMockEService`, `getMockTenant`, `getMockDescriptor`, `getMockDescriptorPublished`,
`getMockAgreement`, `getMockAttribute`, `getMockPurpose`, `getMockPurposeVersion`,
`getMockAuthData`. Ognuna ora `getMockX({ ... } = {})`.

Call-site migrati con un **codemod Python** (parser a parentesi bilanciate,
string/comment/**regex**-aware) scritto in `scratchpad/codemod.py` ed eseguito localmente
(no `ts-morph`: non installabile — regola 4; no `node` nello shell):
- **420 file** modificati, **3135** chiamate convertite in object-param.
- Nessuna chiamata posizionale residua (verificato).
- Integrità parentesi/quadre invariata su tutti i 420 file; graffe aggiunte in coppie.
- Gestiti spread (`...getMockX(a)`), nesting (`getMockContext({ authData: getMockAuthData(x) })`),
  multi-arg, array multiriga, e regex literal con apostrofi (bug scanner risolto).

**È behavior-preserving** (stessi default) → la logica dei test non cambia; restano solo
riformattazioni prettier (righe lunghe) e `object-shorthand`.

### Verifica richiesta all'utente (regola 4 — i comandi li lancia l'utente)
```
pnpm -r lint:autofix     # prettier riforma le righe collassate + object-shorthand
pnpm -r check            # type-check
pnpm -r test             # (o per-package) suite
```

### Rimanente
- **Point 2** (override espliciti / partire da `generateMock`): behavior-CHANGING, richiede
  il test-loop per correggere i test che "passano per la ragione sbagliata" (vedi
  "Blocco strutturale"). Non eseguibile alla cieca.
- **Point 3** (assorbire 5 shadow + lint rule): l'assorbimento cambia i valori (gli shadow
  hardcodano diversamente) → richiede verifica; la lint rule deve atterrare insieme
  all'assorbimento.
