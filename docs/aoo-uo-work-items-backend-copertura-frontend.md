# [DRAFT] Gestione AOO/UO - Work Item backend per la copertura frontend

I seguenti cinque Work Item integrano i WI BE 1-14 dell'elenco condiviso e
precedono i Work Item frontend.

La numerazione proposta e:

- WI BE esistenti: 1-14, con precisazione del perimetro M2M del WI 7 sotto;
- nuovi WI BE: 15-19;
- WI FE precedenti 15-27: diventano 20-32.

I riferimenti ai WI FE nel testo riportano entrambe le numerazioni.
Gli altri documenti non vengono rinumerati da questa proposta.

Il dettaglio dell'analisi e disponibile nel
[documento di copertura](./aoo-uo-copertura-backend-wi-frontend-15-27.md).

## Precisazione del perimetro M2M del WI 7

Per decisione di perimetro, l'esposizione M2M della gerarchia riguarda
soltanto il gateway v3. Il gateway M2M v2 non deve essere adeguato.

Il WI 7 deve quindi riferirsi al
[contratto M2M v3](../packages/api-clients/open-api/m2mGatewayApiV3.yml)
e al package [m2m-gateway-v3](../packages/m2m-gateway-v3), includendo
`GET /tenants` e `GET /tenants/{tenantId}` e il relativo converter.
Entrambe le operazioni richiedono che il tenant-process popoli la gerarchia
nel rispettivo percorso lista/dettaglio; concatenare le PR non sostituisce
questa implementazione.

Questa esclusione riguarda la versione del gateway M2M, non i protobuf e
gli eventi Tenant V2 previsti dai WI di modello ed eventi.

## Vincoli comuni

- Riutilizzare lo schema ricorsivo `ParentTenant` introdotto dai WI 5-6:
  `id`, `name`, `subUnitType?`, `parentTenant?`.
- Esporre `subUnitType` anche sull'ente rappresentato, ove previsto dal
  modello aggiornato.
- Non modificare i nomi persistiti e non sostituire i campi `name`,
  `producerName` o `tenantName` con denominazioni composte.
- Il backend restituisce i dati completi; composizione, righe, troncamento
  e disposizione dei nomi sono responsabilita del frontend.
- Per un ente principale o una relazione assente, `parentTenant` non e
  valorizzato.
- Per AOO/UO direttamente sotto l'ente principale, restituire un solo nodo
  parent, anche quando `parentTenantId` e `rootTenantId` coincidono.
- Per UO sotto AOO, restituire AOO e relativo ente principale.
- Non introdurre una relazione parziale: secondo la decisione tecnica
  corrente, se parent/root necessari non sono censiti in PDND, l'importer
  invia entrambi i riferimenti a `null`.
- Il FE deve usare esclusivamente i livelli presenti nel payload, senza
  ricostruirli o dedurli; se `parentTenant` e assente, mostra il solo Tenant
  corrente.
- Preservare autorizzazioni, ruoli, filtri, identificativi e campi esistenti.
- Non introdurre nuovi endpoint per singola pagina, modifiche al JWT o
  scritture sul read model dai process service per questa esposizione.
- Recuperare parent/root con join o recuperi batch, senza introdurre una
  chiamata aggiuntiva per ogni livello di ogni riga.
- Aggiornare contratti OpenAPI, client/schema generati, converter e
  costruzioni manuali. Verificare il payload HTTP dopo il parsing dello
  schema di risposta, non soltanto l'oggetto interno.

## [Work Item 15] [BE] - Esposizione della gerarchia nel dettaglio Tenant

Estendere il dettaglio Tenant del tenant-process e del BFF affinche esponga
la gerarchia AOO/UO gia prevista per la ricerca `getTenants` nei WI 5-6.

**Package coinvolti**

- `packages/api-clients`
- `packages/tenant-process`
- `packages/backend-for-frontend`

**Interventi**

1. Nel tenant-process, valorizzare `Tenant.parentTenant` anche nell'operazione
   `getTenant` per ID. L'aggiunta del campo al contratto nel WI 5 non basta:
   devono essere recuperati i dati referenziati anche da questo percorso.
2. Recuperare parent e root dal read model usando i riferimenti persistiti,
   senza ricercare l'afferenza tramite nome, JWT o dati Selfcare.
3. Riutilizzare la conversione della gerarchia prevista dal WI 5, evitando
   implementazioni divergenti tra lista e dettaglio.
4. Nel contratto BFF, aggiungere al modello `Tenant`:

   ```yaml
   parentTenant:
     $ref: "#/components/schemas/ParentTenant"
   ```

5. Aggiornare `toBffApiTenant` per propagare la gerarchia nel risultato di
   `GET /tenants/{tenantId}`. Conservare `subUnitType`, gia presente, e tutti
   gli altri dati, inclusi attributi e contatti.
6. Non modificare il perimetro del modello `CompactTenant` del WI 6: lista
   e dettaglio BFF rimangono modelli distinti.

**File principali**

- [Contratto tenant-process](../packages/api-clients/open-api/tenantApi.yml)
- [Contratto BFF](../packages/api-clients/open-api/bffApi.yml)
- [Servizio tenant-process](../packages/tenant-process/src/services/tenantService.ts)
- [Query tenant-process](../packages/tenant-process/src/services/readModelServiceSQL.ts)
- [Converter tenant-process](../packages/tenant-process/src/model/domain/apiConverter.ts)
- [Servizio Tenant BFF](../packages/backend-for-frontend/src/services/tenantService.ts)
- [Converter Tenant BFF](../packages/backend-for-frontend/src/api/tenantApiConverter.ts)

**Dipendenze**

- Modello e read model con i riferimenti definiti nel WI 1.
- Contratto ricorsivo introdotto nei WI 5-6.

**Copertura FE**

- WI FE 32, precedentemente 27: Anagrafica e attributi.
- Dati del tenant attivo utilizzabili dal FE per il profilo/header.
- Prerequisito per gli altri payload BFF che recuperano Tenant per ID.

Il titolo Anagrafica e alcune opzioni del tenant attivo sono costruiti oggi
dal JWT: il loro adeguamento resta nei WI FE. Questo WI non modifica il
token e non estende automaticamente le opzioni del cambio ente Selfcare.

**Criteri di accettazione**

- Test per root, AOO sotto root, UO sotto root, UO sotto AOO e relazione assente.
- Nessuna duplicazione della root e nessuna modifica a `name` o agli ID.
- Gerarchia presente nella risposta HTTP del dettaglio BFF.
- Attributi, contatti e comportamento delle autorizzazioni invariati.

## [Work Item 16] [BE] - Esposizione della gerarchia nei payload BFF di Catalogo, richieste, finalita e template

Propagare la gerarchia degli enti nelle risposte gia utilizzate dal FE,
senza richiedere chiamate al dettaglio Tenant per ogni riga o card.

**Package coinvolti**

- `packages/api-clients`
- `packages/backend-for-frontend`
- `packages/tenant-process`, per gli eventuali percorsi di recupero dei
  Tenant non gia coperti dai WI 5 e 15

**Interventi**

1. Aggiungere `subUnitType` e `parentTenant`, opzionali, ai modelli BFF
   `CompactOrganization` e `CatalogTenant`, riutilizzando `ParentTenant`.
2. Adeguare tutti i punti di costruzione dei seguenti payload:

   | Flusso BFF | Enti da arricchire |
   | --- | --- |
   | `GET /catalog` e dettaglio descriptor Catalogo | Producer delle card e del dettaglio |
   | `GET /consumers/agreements`, `/producers/agreements`, `/agreements/{agreementId}` | Producer e consumer della richiesta |
   | `GET /consumers/purposes`, `/producers/purposes`, `/purposes/{purposeId}` | Producer e consumer della finalita |
   | `GET /catalog/eservices/templates` e dettaglio versione template | Creator |
   | `GET /catalog/purposeTemplates` e `/purposeTemplates/{purposeTemplateId}` | Creator |
   | Risorse collegate ai template finalita | Producer degli e-service e creator dei template e-service |

3. Aggiornare almeno i converter `toBffCompactOrganization`,
   `toBffCatalogTenant`, `toBffCatalogApiEService`,
   `toBffCatalogDescriptorEService`, `toBffEServiceTemplateDetails`,
   `toBffCatalogEServiceTemplate`, `toBffCatalogPurposeTemplate` e
   `toBffPurposeTemplateWithCompactCreator`, oltre ai converter delle risorse
   collegate.
4. Aggiornare le costruzioni manuali in `agreementService.ts` e
   `purposeService.ts`. In particolare, `Agreement.consumer` e un `Tenant`
   BFF costruito esplicitamente: non eredita la modifica a `toBffApiTenant`.
5. Riutilizzare i Tenant gia recuperati e le cache/batch del flusso; evitare
   un ulteriore recupero per ciascun producer, consumer o creator ripetuto.
6. Non aggiungere una colonna ente o un filtro al FE per deduzione: le liste
   "I miei template" attuali non mostrano necessariamente un nome ente.

**File principali**

- [Contratto BFF](../packages/api-clients/open-api/bffApi.yml)
- [Converter Catalogo](../packages/backend-for-frontend/src/api/catalogApiConverter.ts)
- [Converter richieste](../packages/backend-for-frontend/src/api/agreementApiConverter.ts)
- [Servizio richieste](../packages/backend-for-frontend/src/services/agreementService.ts)
- [Servizio finalita](../packages/backend-for-frontend/src/services/purposeService.ts)
- [Converter template e-service](../packages/backend-for-frontend/src/api/eserviceTemplateApiConverter.ts)
- [Converter template finalita](../packages/backend-for-frontend/src/api/purposeTemplateApiConverter.ts)

**Dipendenze e confini**

- Dipende dai dati gerarchici dei WI 5 e 15.
- I dati di delega annidati sono trattati dal WI 17.
- I campi piatti delle istanze e del certificatore sono trattati dal WI 18.
- I payload e le query dei filtri dedicati sono trattati dal WI 19.
- PDF e notifiche rimangono nel WI 8, con perimetro da confermare.

**Copertura FE**

- WI FE 20-26 e 29-30, precedentemente 15-21 e 24-25, per le superfici
  alimentate dai modelli sopra.

**Criteri di accettazione**

- Test per ogni punto di costruzione modificato, inclusi quelli manuali.
- Copertura dei quattro casi gerarchici e della relazione assente.
- Gerarchia presente nei payload lista e dettaglio dopo il parsing HTTP.
- `name`, ID, attributi e altri dati funzionali rimangono invariati.

## [Work Item 17] [BE] - Esposizione della gerarchia nelle deleghe e negli elenchi deleganti

Esporre la gerarchia di delegante e delegato nelle deleghe, nei dati di
delega annidati e negli elenchi utilizzati per selezionare il fruitore.

**Package coinvolti**

- `packages/api-clients`
- `packages/backend-for-frontend`
- `packages/delegation-process`

**Interventi**

1. Estendere il modello BFF `DelegationTenant` con `subUnitType` e
   `parentTenant`, opzionali.
2. Adeguare i converter di:
   - `GET /delegations`, risposta `CompactDelegation`;
   - `GET /delegations/{delegationId}`, risposta `Delegation`.
3. Propagare la gerarchia anche negli oggetti di delega annidati in richieste,
   finalita, e-service e descriptor erogatore, inclusi
   `DelegationWithCompactTenants` e i dati del delegato nel dettaglio richiesta.
   Verificare i riferimenti reali degli schemi: il nome del tipo non garantisce
   il riuso del converter di `CompactTenant`.
4. Aggiornare contratti e proiezioni del delegation-process per gli elenchi
   consumati dal BFF:
   - `GET /consumers/delegations/delegators`;
   - `GET /consumers/delegations/delegatorsWithAgreements`.
5. Propagare i nuovi dati nel BFF: oggi i due elenchi inoltrano i risultati
   del delegation-process senza arricchimento gerarchico.
6. Recuperare i livelli gerarchici nelle proiezioni o in batch, senza
   modificare l'insieme dei deleganti ammessi.
7. Rendere disponibili i dati ai chiamanti delle modali di archiviazione,
   che oggi passano soltanto `delegatorName` o `delegatedName`.
   La composizione della stringa e l'adeguamento delle props restano FE.

**File principali**

- [Contratto BFF](../packages/api-clients/open-api/bffApi.yml)
- [Contratto delegation-process](../packages/api-clients/open-api/delegationApi.yml)
- [Converter deleghe](../packages/backend-for-frontend/src/api/delegationApiConverter.ts)
- [Servizio deleghe](../packages/backend-for-frontend/src/services/delegationService.ts)
- [Servizio Catalogo](../packages/backend-for-frontend/src/services/catalogService.ts)
- [Servizio richieste](../packages/backend-for-frontend/src/services/agreementService.ts)
- [Servizio finalita](../packages/backend-for-frontend/src/services/purposeService.ts)
- [Query delegation-process](../packages/delegation-process/src/services/readModelServiceSQL.ts)

**Dipendenze e confini**

- Riutilizza i dati gerarchici dei WI 5 e 15 e gli schemi condivisi del WI 16.
- Le costruzioni dei campi delega nei servizi condivisi sono di competenza
  di questo WI, per evitare duplicazioni con il WI 16.
- La ricerca gerarchica degli elenchi deleganti e trattata nel WI 19.

**Copertura FE**

- WI FE 28 e 31, precedentemente 23 e 26: Deleghe e Archiviazione.
- Superfici con deleghe dei WI FE 20-21, 23-24 e 29, precedentemente
  15-16, 18-19 e 24.

**Criteri di accettazione**

- Test di delegante e delegato per i casi gerarchici e la relazione assente.
- Verifica di lista, dettaglio, dati annidati ed entrambi gli elenchi deleganti.
- Stati, vincoli sugli accordi, filtri per e-service e autorizzazioni invariati.
- Le modali possono ricevere i dati necessari senza nuove chiamate Tenant.

## [Work Item 18] [BE] - Esposizione della gerarchia nelle istanze template e nelle assegnazioni del certificatore

Estendere le proiezioni che oggi espongono soltanto identificativo e nome
piatto dell'ente, conservando i campi esistenti.

**Package coinvolti**

- `packages/api-clients`
- `packages/backend-for-frontend`
- `packages/tenant-process`

**Istanze template e-service**

1. Estendere `EServiceTemplateInstance` nel contratto BFF con i dati
   strutturati necessari alla gerarchia del producer.
2. Conservare `producerId` e `producerName` con i valori attuali.
3. Aggiornare `toBffEServiceTemplateInstance` e i recuperi del producer per:
   - `GET /templates/{eServiceTemplateId}/eservices`;
   - `GET /templates/{eServiceTemplateId}/myInstances`.
4. Restituire lo stesso formato gerarchico in entrambi i flussi.

**Assegnazioni del certificatore**

1. Estendere la proiezione `CertifiedAttribute` del tenant-process,
   restituita da `getCertifiedAttributesByCertifier`, con i dati gerarchici
   dell'ente assegnatario.
2. Recuperare parent/root nella query della proiezione senza chiamate al
   dettaglio Tenant per ogni riga.
3. Estendere il modello BFF `RequesterCertifiedAttribute` e aggiornare
   `toBffApiRequesterCertifiedAttributes`.
4. Esporre i dati in `GET /tenants/attributes/certified`, conservando
   `tenantId`, `tenantName`, attributo, tipologia e valore discreto.

**Definizione del contratto**

Prima di implementare, concordare i nomi e la collocazione dei nuovi campi
additivi per entrambe le proiezioni. Riutilizzare `ParentTenant`, mantenendo
inequivocabile a quale ente si riferisce la gerarchia.
Non reinterpretare i campi piatti esistenti come stringhe composte.

**File principali**

- [Contratto BFF](../packages/api-clients/open-api/bffApi.yml)
- [Contratto tenant-process](../packages/api-clients/open-api/tenantApi.yml)
- [Converter istanze](../packages/backend-for-frontend/src/api/catalogApiConverter.ts)
- [Servizio Catalogo](../packages/backend-for-frontend/src/services/catalogService.ts)
- [Converter certificatore](../packages/backend-for-frontend/src/api/tenantApiConverter.ts)
- [Query certificatore](../packages/tenant-process/src/services/readModelServiceSQL.ts)

**Dipendenze e copertura FE**

- Riutilizza la gerarchia e i contratti introdotti dai WI 5-6 e 15.
- Copre WI FE 25-27, precedentemente 20-22: istanze template, enti
  utilizzatori e tabella assegnazioni certificatore.
- Il dropdown tenant del certificatore resta coperto dai WI 5-6.

**Criteri di accettazione**

- Test dei due endpoint istanze e della risposta certificatore.
- Copertura di root, AOO, UO sotto root, UO sotto AOO e relazione assente.
- Campi piatti esistenti e dati degli attributi invariati.
- Paginazione, conteggio, filtri e autorizzazioni invariati.

## [Work Item 19] [BE] - Estensione della ricerca e dei payload dei filtri ente dedicati

Estendere i filtri per nome ente utilizzati dal FE, mantenendo il perimetro
funzionale di ogni ricerca. L'estensione di `getTenants` nel WI 5 non si
propaga automaticamente alle query dedicate degli altri process.

**Package coinvolti**

- `packages/api-clients`
- `packages/backend-for-frontend`
- `packages/tenant-process`
- `packages/agreement-process`
- `packages/delegation-process`
- `packages/eservice-template-process`
- `packages/purpose-template-process`

**Flussi da adeguare**

| Endpoint BFF | Responsabilita della ricerca |
| --- | --- |
| `GET /producers` e `GET /consumers` | tenant-process `getProducers` e `getConsumers` |
| `GET /agreements/filter/producers` e `/agreements/filter/consumers` | agreement-process, filtri per nome erogatore/fruitore |
| `GET /eservices/templates/filter/creators` | eservice-template-process `getCreators` |
| `GET /purposeTemplates/filter/creators` | purpose-template-process `getPublishedPurposeTemplateCreators` |
| `GET /consumers/delegations/delegators` e `/delegatorsWithAgreements` nello stesso prefisso | delegation-process, filtri `delegatorName` |

**Interventi**

1. Confermare per ciascun filtro il requisito di ricerca per afferenza:
   la rappresentazione su due righe, da sola, non ne definisce la semantica.
   Applicare i punti seguenti alle ricerche confermate nel perimetro.
2. Applicare la stessa semantica del WI 5 al nome del tenant, del parent,
   della root e al nome completo composto dai livelli:
   - ente principale: `<nome ente>`;
   - AOO/UO sotto root: `<nome sotto-unita> - <nome ente>`;
   - UO sotto AOO: `<nome UO> - <nome AOO> - <nome ente>`.
3. Non duplicare la root quando parent e root coincidono. Per relazione
   assente, cercare soltanto nel nome del tenant.
4. Conservare normalizzazione ed escaping gia adottati da ciascun filtro.
5. Recuperare i dati gerarchici necessari alle opzioni anche dove la ricerca
   per afferenza non e richiesta: le opzioni devono comunque poter essere
   rappresentate nel formato gerarchico previsto dal Design.
6. Estendere i contratti process delle proiezioni dei filtri e la relativa
   propagazione BFF. Riutilizzare gli schemi del WI 16 e, per i deleganti,
   coordinare i recuperi e i contratti del WI 17.
7. Aggiornare le proiezioni BFF che oggi scartano i dati aggiuntivi, tra cui
   `getProducers` e `getConsumers`, che restituiscono solo `id` e `name`.
8. Non sostituire i filtri dedicati con la ricerca generica `GET /tenants`:
   devono rimanere invariati gli enti ammessi nel contesto.

**Filtro degli utilizzatori template**

`GET /templates/{eServiceTemplateId}/eservices`, quando riceve `producerName`,
usa gia `getTenants` del tenant-process per ricavare gli ID degli erogatori,
poi filtra gli e-service per quegli ID.

Verificare quindi la propagazione della ricerca del WI 5 con un test del
flusso, senza introdurre una seconda implementazione della stessa ricerca.
Il recupero di tutte le pagine Tenant e la successiva paginazione degli
e-service devono mantenere il comportamento esistente.

**File principali**

- [Servizio Tenant BFF](../packages/backend-for-frontend/src/services/tenantService.ts)
- [Servizio richieste BFF](../packages/backend-for-frontend/src/services/agreementService.ts)
- [Servizio Catalogo BFF](../packages/backend-for-frontend/src/services/catalogService.ts)
- [Query tenant-process](../packages/tenant-process/src/services/readModelServiceSQL.ts)
- [Query agreement-process](../packages/agreement-process/src/services/readModelServiceSQL.ts)
- [Query delegation-process](../packages/delegation-process/src/services/readModelServiceSQL.ts)
- [Query eservice-template-process](../packages/eservice-template-process/src/services/readModelServiceSQL.ts)
- [Query purpose-template-process](../packages/purpose-template-process/src/services/readModelServiceSQL.ts)

**Dipendenze e copertura FE**

- Riutilizza la semantica del WI 5 e i contratti dei WI 16-17.
- Copre le opzioni dei filtri dei WI FE interessati, in particolare
  20-21, 23-24 e 29-30, precedentemente 15-16, 18-19 e 24-25, e i flussi
  aggiuntivi di selezione deleganti.
- Non crea nuovi dropdown per i punti Design ancora da identificare.

**Criteri di accettazione**

- Per ogni query modificata, testare match sul tenant, parent, root e nome
  composto; includere ente principale e relazione assente.
- Testare esclusioni per gli stati e gli altri vincoli specifici del flusso,
  inclusi autorizzazioni e perimetro delle deleghe.
- Nessun duplicato quando la ricerca coincide con piu livelli.
- Ordinamento, paginazione e `totalCount` invariati nella semantica.
- Gerarchia presente nelle opzioni restituite dal BFF dopo il parsing HTTP.
- Test del filtro utilizzatori template attraverso `getTenants`.

## Ordine di inserimento e dipendenze

I cinque WI possono essere inseriti prima dei WI FE, ma l'ordine numerico
non implica che tutta l'implementazione debba essere sequenziale:

- il WI 15 dipende dal modello/read model e dai contratti dei WI 1, 5 e 6;
- il WI 16 usa la gerarchia disponibile da lista/dettaglio Tenant;
- il WI 17 riutilizza gli schemi del WI 16 per i payload annidati;
- il WI 18 puo procedere indipendentemente dagli adeguamenti delle deleghe;
- il WI 19 riutilizza gli schemi e coordina le proiezioni con i WI 16-17;
- ciascun WI FE puo partire quando i payload che utilizza sono disponibili,
  senza attendere necessariamente tutti gli altri flussi.

Restano fuori da questi cinque WI la definizione della gerarchia per tutte
le opzioni del cambio ente Selfcare, il perimetro PDF/notifiche del WI 8 e
le superfici Design non ancora identificate. Il profilo del tenant attivo
puo utilizzare il dettaglio esteso del WI 15 tramite adeguamento FE, senza
modificare il JWT.
