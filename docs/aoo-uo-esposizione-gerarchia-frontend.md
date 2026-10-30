# [DRAFT] AOO/UO - Copertura frontend e scelta di esposizione della gerarchia

## 1. Obiettivo e stato

Verificare come rendere disponibile la gerarchia dei Tenant nelle superfici
frontend previste dalla feature e concordare la strategia prima di consolidare
i contratti e i Work Item backend aggiuntivi.

Questo documento distingue:

- **AS-IS verificato:** endpoint, oggetti e identificativi individuati nel codice;
- **proposta:** modifiche suggerite, non ancora una decisione architetturale approvata;
- **punti aperti:** superfici Design, autorizzazioni e costi da verificare.

La mappatura FE e statica sui repository locali; la prova backend e stata
validata con i test mirati descritti sotto. Non certifica lo stato in produzione,
le prestazioni o tutti i flussi applicativi.

La numerazione FE 17-29 segue l'ultimo esempio discusso, con "I miei template
finalita" al WI 19. E un riferimento provvisorio da riallineare all'SRS prima
della creazione dei ticket. La colonna "Orig." riporta la numerazione 15-27
della precedente analisi di copertura.
Il titolo identifica il WI anche in caso di successive rinumerazioni.

Le precedenti proposte di cinque WI BE e di dettaglio M2M non costituiscono
decisioni di questo documento. Il dettaglio M2M e stato escluso dal perimetro
discusso; il dettaglio Tenant per uso FE rimane distinto.

### Bozza di contratto BFF

La [spec BFF](../packages/api-clients/open-api/bffApi.yml) include ora la proposta
additiva per le superfici censite:

- `ParentTenant` ricorsivo, con `id`, `name`, `subUnitType?`, `parentTenant?`;
- nessun modello distinto per il root: la catena termina con l'assenza di
  `parentTenant`. Il contratto non fissa la profondita; i recuperi e le ricerche
  attuali rimangono limitati ai livelli previsti dall'SRS;
- `parentTenant` opzionale su `Tenant`, `CompactTenant`, `CompactOrganization`,
  `CatalogTenant` e `DelegationTenant`; `subUnitType` opzionale anche sui modelli
  compatti che prima non lo esponevano;
- `producerSubUnitType?` e `parentProducer?: ParentTenant` su
  `EServiceTemplateInstance` e `DelegationEService`, mantenendo `producerId`
  e `producerName`;
- `tenantSubUnitType?` e `parentTenant?: ParentTenant` su
  `RequesterCertifiedAttribute`, mantenendo `tenantId` e `tenantName`.

Nelle proiezioni piatte, i campi `parentProducer` e `parentTenant` rappresentano
il parent immediato dell'ente identificato dai campi preesistenti, non l'ente
stesso. L'eventuale root e annidata nel suo `parentTenant`. I campi
`producerSubUnitType` e `tenantSubUnitType` descrivono invece l'ente corrente.
Non vengono cambiati i campi obbligatori, gli endpoint o i parametri di ricerca.

### Prova implementativa backend

E stata implementata la lettura gerarchica nei process e la propagazione nei
converter e nelle costruzioni manuali BFF censite, comprese le proiezioni piatte.
Le ricerche dedicate di Tenant, producer/consumer, controparti delle richieste,
creator dei template e deleganti includono nome proprio, parent, root e nome
composto, mantenendo i rispettivi vincoli.

Il metodo di lettura interno `getTenantById` non e arricchito globalmente:
il dettaglio pubblico usa un recupero gerarchico esplicito. I nomi degli antenati
restano una proiezione di lettura; protobuf V2 e read model persistono soltanto
gli ID. Il protobuf V1 non e modificato.

Lo schema di dominio `Tenant` contiene soltanto i riferimenti persistiti.
`ParentTenant` rimane uno schema dedicato al read-side; nel tenant-process il
tipo locale `TenantWithHierarchy` rappresenta le risposte arricchite di lista,
dettaglio e filtri producer/consumer, senza estendere lo stato event-sourced.

`getTenants`, `getConsumers` e `getProducers` ricostruiscono gli antenati dalle join parent/root gia presenti nella
query paginata, all'interno della transazione, senza un ulteriore recupero batch
degli antenati. I test del generatore coprono entrambi i template, verificando
il tipo ricorsivo, la compilazione TypeScript e il mantenimento della generazione
precedente per gli schemi non ricorsivi.

Validazione dopo il consolidamento: 118 test passati (43 API/converter,
44 integrazione Tenant, 16 integrazione filtri dedicati, 11 mapping/splitter,
4 generatore). I typecheck dei cinque
process interessati e del BFF passano; per il BFF e stato necessario ricompilare
`commons` per aggiornare le dichiarazioni locali obsolete. I test dei filtri
usano le credenziali di test del container S3 previste dal repository.

Questa prova non implementa l'importer, l'onboarding o il comando di aggiornamento
parent: i riferimenti devono essere popolati da quei WI prima che le gerarchie
siano disponibili sui dati reali. Lo SQL locale inizializza le nuove colonne;
la migration degli ambienti rimane nel repository di deployment.

Non sono state implementate modifiche FE, Selfcare, PDF/email/notifiche.
Non sono certificati tutti gli endpoint BFF con test HTTP individuali, la
conformita visuale al Design o le prestazioni a volumi di produzione. La suite
completa del monorepo non e stata eseguita. La prova non sostituisce la decisione
di soluzione e la successiva suddivisione dei WI.

## 2. Vincoli e confini

- `Tenant.name` non viene trasformato in un nome composto.
- Si persistono `parentTenantId` e `rootTenantId`, non i nomi degli antenati.
- L'oggetto di lettura BFF e `parentTenant`, non una nuova colonna DB.
- Il naming BFF non rinomina `parentTenantId` e `rootTenantId` del modello dati.
  Il converter dovra mappare esplicitamente la gerarchia del tenant-process
  nel contratto BFF; questa modifica non rinomina il contratto del process.
- La relazione prevista e completa oppure assente: l'importer invia entrambi
  i riferimenti a `null` se parent/root necessari non sono censiti in PDND.
- La rappresentazione FE usa solo i livelli ricevuti; la composizione grafica,
  le righe e il troncamento rimangono responsabilita FE.
- Sono esclusi lookup FE per ogni riga di tabelle, griglie e liste di card.
- E escluso il batch orchestrato dal FE.
- Il recupero BE deve evitare di introdurre chiamate o query per ogni livello
  di ogni risultato; deduplicazione degli ID e batch non sono sinonimi.
- Non arricchire indiscriminatamente i metodi interni Tenant condivisi:
  circoscrivere il recupero gerarchico ai percorsi di lettura necessari.
- Visualizzazione e ricerca sono distinte: un lookup di enti gia restituiti
  non permette di trovare una UO cercando il nome della root.
- La disponibilita di un Tenant ID non dimostra che il dettaglio sia accessibile
  per ogni ruolo e controparte: serve una verifica delle autorizzazioni.

Contratto gerarchico di riferimento:

```ts
parentTenant?: {
  id: string;
  name: string;
  subUnitType?: "AOO" | "UO";
  parentTenant?: {
    id: string;
    name: string;
    subUnitType?: "AOO" | "UO";
  };
};
```

La sotto-unita corrente resta l'oggetto esterno. Root e relazione assente non
hanno `parentTenant`; parent e root coincidenti non devono essere duplicati.

## 3. Come leggere gli impatti

Il dominio della pagina non e necessariamente la fonte del nome Tenant.
Per esempio, il purpose-template-process restituisce `creatorId`, mentre il
BFF recupera separatamente il Tenant e costruisce il creator della risposta.
Non occorre quindi aggiungere una join alla query del template per propagare
un dato gia ottenuto dal BFF.

Legenda della colonna "Impatto proposto":

- **S:** spec OpenAPI/modelli e relativi client/schema generati.
- **C:** converter e costruzioni manuali dei payload.
- **T:** recupero gerarchico Tenant condiviso, implementato nella POC e riutilizzato;
  non significa una nuova query dedicata per ogni endpoint.
- **Q:** query/proiezione dedicata da estendere per la gerarchia.
- **R:** estensione della ricerca per parent/root, solo dove confermata.
- **FE:** query, props o rendering frontend da adeguare.

Gli impatti sono riferiti alla proposta di arricchimento dei payload, salvo
le eccezioni esplicite. Non sono una stima del numero di PR o di query.
Tutti gli endpoint della colonna dedicata sono BFF; nella colonna "Fonte BE"
sono indicate le responsabilita interne verificate, non nuovi endpoint.

## 4. Copertura per superficie

### 4.1 Catalogo e richieste di fruizione

| WI / Orig. | Pagina e superficie | Dominio / oggetto e nome | ID Tenant disponibile nel FE | Endpoint BFF | Fonte BE del dato Tenant | Intervento proposto e impatto |
| --- | --- | --- | --- | --- | --- | --- |
| 17 / 15 | Catalogo - card | `CatalogEService.producer.name` (`CatalogTenant`) | `producer.id` | `GET /catalog` | Catalogo + recupero Tenant nel BFF [B1] | Includere gerarchia nel producer: **S+C+T** |
| 17 / 15 | Catalogo - dettaglio | `CatalogEServiceDescriptor.eservice.producer.name` (`CompactOrganization`) | `eservice.producer.id` | `GET /catalog/eservices/{eserviceId}/descriptor/{descriptorId}` | Composizione nel BFF [B1] | Propagare nel producer gia costruito: **S+C+T**; lookup puntuale alternativa da validare |
| 17 / 15 | Catalogo - filtro erogatori | `CompactOrganization.name` | Opzione `id` | `GET /producers` | tenant-process `getProducers`; BFF proietta `id/name` [B2] | Estendere opzioni e proiezione: **S+C+Q**, **R** se richiesta |
| 18 / 16 | Richieste inoltrate - tabella | `AgreementListEntry.eservice.producer.name` | `eservice.producer.id` | `GET /consumers/agreements` | Composizione richieste/Tenant nel BFF [B3] | Includere gerarchia nelle righe: **S+C+T** |
| 18 / 16 | Richieste inoltrate - filtro | `CompactOrganization.name` | Opzione `id` | `GET /agreements/filter/producers` | Proiezione dedicata agreement-process [B3] | Estendere opzioni: **S+C+Q**, **R** se richiesta |
| 18, 20 / 16, 18 | Richieste - dettaglio condiviso | `Agreement.producer.name`, `consumer.name`, eventuale `delegation.delegate.name` | Rispettivi `.id` | `GET /agreements/{agreementId}` | Recuperi Tenant e costruzioni manuali BFF; consumer non eredita automaticamente il converter Tenant [B3] | **S+C+T**, inclusa delega; lookup puntuali alternativa da validare |
| 20 / 18 | Richieste ricevute - tabella | `AgreementListEntry.consumer.name` | `consumer.id` | `GET /producers/agreements` | Composizione richieste/Tenant nel BFF [B3] | Includere gerarchia nelle righe: **S+C+T**, riuso schemi richieste |
| 20 / 18 | Richieste ricevute - filtro | `CompactOrganization.name` | Opzione `id` | `GET /agreements/filter/consumers` | Proiezione dedicata agreement-process [B3] | Estendere opzioni: **S+C+Q**, **R** se richiesta |

### 4.2 Finalita e selettori di creazione

| WI / Orig. | Pagina e superficie | Dominio / oggetto e nome | ID Tenant disponibile nel FE | Endpoint BFF | Fonte BE del dato Tenant | Intervento proposto e impatto |
| --- | --- | --- | --- | --- | --- | --- |
| 21 / 19 | Finalita ricevute - tabella | `Purpose.consumer.name` | `consumer.id` | `GET /producers/purposes` | Composizione e costruzioni manuali BFF [B4] | Gerarchia nel consumer: **S+C+T** |
| 21 / 19 | Finalita ricevute - filtro | `CompactOrganization.name` | Opzione `id` | `GET /consumers` | tenant-process `getConsumers`; BFF proietta `id/name` [B2] | Estendere opzioni: **S+C+Q**, **R** se richiesta |
| 26 / 24 | Finalita inoltrate - tabella | `Purpose.eservice.producer.name` | `eservice.producer.id` | `GET /consumers/purposes` | Composizione e costruzioni manuali BFF [B4] | Gerarchia nel producer: **S+C+T** |
| 26 / 24 | Finalita inoltrate - filtro | `CompactOrganization.name` | Opzione `id` | `GET /producers` | Come filtro Catalogo [B2] | Riuso dello stesso intervento, non un nuovo lavoro per pagina |
| 21, 26 / 19, 24 | Finalita - dettaglio e riepilogo | `Purpose.consumer`, `eservice.producer`, eventuale `delegation.delegate` | Rispettivi `.id` | `GET /purposes/{purposeId}` | Composizione BFF, inclusa delega [B4] | **S+C+T**; lookup puntuali alternativa da validare |
| 18, 20 / 16, 18 | Selezione fruitore nelle richieste | Opzioni `tenant.name`; ente attivo da JWT | `tenant.id`; `jwt.organizationId` | `GET /consumers/delegations/delegators` | delegation-process, risultati inoltrati dal BFF [B5] | Gerarchia nelle opzioni: **S+C+Q**; ente attivo da dettaglio condiviso **FE+T** |
| 26 / 24 | Selezione fruitore nella creazione finalita | Opzioni `tenant.name`; ente attivo da JWT | `tenant.id`; `jwt.organizationId` | `GET /consumers/delegations/delegatorsWithAgreements` | delegation-process, risultati inoltrati dal BFF [B5] | Come sopra, preservando i vincoli sugli accordi; **R** se richiesta |
| 26 / 24 | Selettori e-service / template finalita | `eservice.producer.name` / `purposeTemplate.creator.name` | `producer.id` / `creator.id`, non ID della risorsa | Payload Catalogo e template gia elencati | Converter e recuperi BFF dei rispettivi cataloghi | Riuso gerarchia nelle opzioni: **S+C+T+FE**, senza lookup per opzione |

### 4.3 Template finalita

| WI / Orig. | Pagina e superficie | Dominio / oggetto e nome | ID Tenant disponibile nel FE | Endpoint BFF | Fonte BE del dato Tenant | Intervento proposto e impatto |
| --- | --- | --- | --- | --- | --- | --- |
| 19 / 17 | I miei template finalita - tabella e dropdown | Tabella attuale: titolo, destinatari, stato; dropdown: nome e-service | Nel risultato Catalogo c'e `producer.id`; `option.id` della risorsa e invece un e-service ID | `GET /creators/purposeTemplates`; dropdown `GET /catalog` | Lista template e Catalogo [B6] | Nessuna nuova colonna/filtro Tenant da dedurre. Se il Design mostra producer nelle opzioni, riuso Catalogo; superficie da confermare |
| 19, 27 / 17, 25 | Template finalita - dettaglio condiviso | `PurposeTemplateWithCompactCreator.creator.name` | `creator.id` | `GET /purposeTemplates/{purposeTemplateId}` | Il BFF chiama gia tenant-process `getTenant(creatorId)` [B6] | **S+C+T**; nessuna nuova query del template per ottenere il creator. Lookup FE alternativa non necessaria al riuso |
| 27 / 25 | Template finalita - card | `CatalogPurposeTemplate.creator.name` (`CatalogTenant`) | `creator.id` nel chiamante; card riceve oggi solo nome | `GET /catalog/purposeTemplates` | BFF recupera i creator distinti con `getTenant` e li associa ai template [B6] | **S+C+T+FE**; adeguare props o rendering nel chiamante |
| 27 / 25 | Template finalita - filtro creator | `CompactOrganization.name` | Opzione `id` | `GET /purposeTemplates/filter/creators` | purpose-template-process `getPublishedPurposeTemplateCreators` [B6] | **S+C+Q**, **R** se richiesta |
| 19, 27 / 17, 25 | Risorse collegate - tabella, riepilogo, selezione | Producer e-service / creator template; view FE `publisherName` | `resource.eservice.producer.id` / `resource.eserviceTemplate.creator.id`; conservati negli oggetti originali | Flussi risorse collegate del purpose-template, da censire puntualmente prima del WI | BFF recupera e-service/template e relativi Tenant [B6] | **S+C+T+FE** dove il Design richiede l'ente. Non usare l'ID della view: identifica la risorsa, non il Tenant |

### 4.4 Template e-service

| WI / Orig. | Pagina e superficie | Dominio / oggetto e nome | ID Tenant disponibile nel FE | Endpoint BFF | Fonte BE del dato Tenant | Intervento proposto e impatto |
| --- | --- | --- | --- | --- | --- | --- |
| 22 / 20 | Template e-service - card | `CatalogEServiceTemplate.creator.name` | `creator.id` nel chiamante; card riceve oggi solo nome | `GET /catalog/eservices/templates` | Composizione creator nel BFF [B7] | **S+C+T+FE**, riusando `CatalogTenant` |
| 22 / 20 | Template e-service - filtro creator | `CompactOrganization.name` | Opzione `id` | `GET /eservices/templates/filter/creators` | eservice-template-process `getCreators` [B7] | **S+C+Q**, **R** se richiesta |
| 22, 23 / 20, 21 | Template e-service - dettaglio versione | `eserviceTemplate.creator` nel payload; non mostrato come campo ente nelle informazioni generali attuali | `eserviceTemplate.creator.id` | `GET /eservices/templates/{eServiceTemplateId}/versions/{eServiceTemplateVersionId}` | Il BFF recupera il creator Tenant [B7] | **S+C+T** solo per la superficie confermata dal Design; non introdurre campi UI per deduzione |
| 22 / 20 | Template e-service - mie istanze | `EServiceTemplateInstance.producerName` | `producerId` | `GET /templates/{eServiceTemplateId}/myInstances` | Catalogo BFF, recupero producer e converter istanze [B1] | Estensione strutturata additiva: **S+C+T**; conservare `producerId/producerName` |
| 23 / 21 | I miei template e-service - utilizzatori | `EServiceTemplateInstance.producerName` | `producerId` | `GET /templates/{eServiceTemplateId}/eservices` | Come istanze; filtro `producerName` usa gia `getTenants` per ricavare gli ID [B1] | Riuso estensione istanze **S+C+T**; testare ereditarieta ricerca WI 5, non introdurre ricerca duplicata |
| 23 / 21 | I miei template e-service - lista principale | Nome template, versione, stato; non nome Tenant | ID template non utilizzabile come Tenant ID | `GET /creators/eservices/templates` | Lista template [B7] | Nessun nuovo dropdown/colonna Tenant identificato: verificare il Design |

### 4.5 Certificatore, deleghe, archiviazione e tenant attivo

| WI / Orig. | Pagina e superficie | Dominio / oggetto e nome | ID Tenant disponibile nel FE | Endpoint BFF | Fonte BE del dato Tenant | Intervento proposto e impatto |
| --- | --- | --- | --- | --- | --- | --- |
| 24 / 22 | Certificatore - selezione ente | `CompactTenant.name` | `tenant.id` | `GET /tenants` | tenant-process `getTenants`, converter BFF [B2] | Gia previsto dai WI 5-6; **FE** per rendering. Nessun lookup extra |
| 24 / 22 | Certificatore - assegnazioni | `RequesterCertifiedAttribute.tenantName` | `tenantId`, non `attributeId` | `GET /tenants/attributes/certified` | Proiezione `getCertifiedAttributesByCertifier` del tenant-process [B2] | **S+C+Q** su proiezione e risposta BFF; conservare i campi piatti |
| 25 / 23 | Deleghe - selezione ente | `CompactTenant.name` | `delegate.id` | `GET /tenants` | Come selezione certificatore [B2] | Riuso WI 5-6, **FE**; nessun lookup extra |
| 25 / 23 | Deleghe - lista | `CompactDelegation.delegator/delegate.name` | Rispettivi `.id` | `GET /delegations` | BFF recupera Tenant e costruisce `DelegationTenant` [B5] | **S+C+T**, senza GET FE per riga |
| 25 / 23 | Deleghe - dettaglio | `Delegation.delegator/delegate.name`; eventuale `eservice.producerName` | Rispettivi `.id`; `eservice.producerId` | `GET /delegations/{delegationId}` | Composizione nel BFF [B5] | **S+C+T**; lookup puntuali alternativa da validare |
| 28 / 26 | Archiviazione - alert e modali | Nomi delegante/delegato passati come props | ID nella delega del chiamante; non sempre nelle props della modale | Payload descriptor, tra cui `GET /producers/eservices/{eserviceId}/descriptors/{descriptorId}` | Composizione delega nel Catalogo BFF [B1] | Riuso arricchimento deleghe **S+C+T** e adeguamento props **FE**; nessuna nuova API di archiviazione per il nome |
| 29 / 27 | Anagrafica e attributi - titolo | Oggi `jwt.organization.name`; dati anagrafici dal dettaglio | `jwt.organizationId`; Tenant caricato `id` | `GET /tenants/{tenantId}` | tenant-process `getTenant`, BFF `toBffApiTenant` [B2] | Dettaglio gerarchico **S+C+T**; titolo usa query Tenant esistente **FE** |
| Trasversale | Profilo del tenant attivo | Header Selfcare/JWT | `jwt.organizationId` e Tenant ID PDND | Dettaglio Tenant riutilizzabile; oggi header usa anche `GET /selfcare/institutions` | Flussi Tenant e Selfcare distinti [F1] | Riuso dettaglio/query condivisa **FE**; verificare stati autenticati e comportamento header |
| Aperto | Opzioni cambio ente | `SelfcareInstitution.description` | `SelfcareInstitution.id` e Selfcare ID, non Tenant ID PDND | `GET /selfcare/institutions` | Selfcare, non proiezione Tenant [F1] | Lookup diretto per quel valore non valido. Perimetro Design e mapping da definire, non coperti dalla proposta |

I campi identificativi sono disponibili nelle superfici applicative verificate,
ma talvolta solo nel chiamante. Le card template e le modali di archiviazione
richiedono quindi adeguamenti FE anche senza nuove informazioni dal backend.

### 4.6 Tracciabilita dei filtri implementati nella POC

Esito del controllo per processo: tenant, agreement, delegation,
eservice-template e purpose-template hanno ciascuno almeno un selettore
effettivo nelle famiglie WI richieste. Non e emerso un process esteso privo
di un chiamante pertinente. Questo riscontro verifica il collegamento al
frontend e all'elenco di superfici fornito, non una validazione visuale dei
singoli frame Figma.

La presenza di un dropdown dimostra dove servono i dati gerarchici, ma non
dimostra da sola che il Design richieda la ricerca testuale per nome del parent:
tale comportamento della POC deriva dalla richiesta esplicita di estendere
le ricerche gerarchiche e va riportato nei criteri di accettazione dei WI BE.

La ricerca per nome proprio, parent e root e stata richiesta per i filtri
gerarchici della prova. La tabella associa ogni query estesa al suo uso FE
effettivo: non introduce nuovi filtri o superfici assenti dal frontend.

| Endpoint BFF | Query process | Vista / selettore FE verificato |
| --- | --- | --- |
| `GET /tenants` | tenant `getTenants` | Selezione ente in creazione delega e assegnazione attributi del certificatore |
| `GET /producers` | tenant `getProducers` | Catalogo e-service, finalita inoltrate; riuso nei filtri delle risorse collegate |
| `GET /consumers` | tenant `getConsumers` | Finalita ricevute; lo stesso endpoint e usato nella lista e-service del produttore |
| `GET /agreements/filter/producers` | agreement `getAgreementsProducers` | Filtro erogatore nelle richieste inoltrate |
| `GET /agreements/filter/consumers` | agreement `getAgreementsConsumers` | Filtro fruitore nelle richieste ricevute |
| `GET /purposeTemplates/filter/creators` | purpose-template `getPublishedPurposeTemplateCreators` | Filtro creator nel catalogo template finalita |
| `GET /eservices/templates/filter/creators` | eservice-template `getCreators` | Filtro creator nel catalogo template e-service |
| `GET /consumers/delegations/delegators` | delegation `getConsumerDelegators` | Selezione fruitore nella richiesta di fruizione |
| `GET /consumers/delegations/delegatorsWithAgreements` | delegation `getConsumerDelegatorsWithAgreements` | Selezione fruitore nella creazione finalita |

L'endpoint `GET /tenants` e usato anche dalla selezione ente di assistenza:
gli endpoint e gli schemi condivisi propagano l'estensione anche ai chiamanti
non elencati nell'SRS. Questo non equivale a richiedere modifiche UI in quelle
viste. La ricerca per parent puo ampliare i risultati dei chiamanti condivisi;
se si richiede un comportamento diverso per vista, serve una decisione esplicita
prima della messa in produzione, non la duplicazione automatica degli endpoint.

Il filtro `producerName` degli utilizzatori dei template e-service riusa gia
`getTenants`: non e stata aggiunta una seconda ricerca gerarchica.
Restano aperte le superfici Design indicate nelle sezioni precedenti; il dettaglio
Tenant per Anagrafica/Profile resta un intervento distinto dalla ricerca.

Il mapping SQL parent/root e condiviso tramite `aggregateTenantHierarchy` negli
aggregatori Tenant del readmodel. Join, visibilita, stati, filtri e paginazione
rimangono espliciti nei servizi dei singoli process. Gli alias introdotti dalla
POC usano lo stesso nome camelCase della variabile, come i precedenti del repo.
Un nome vuoto non e trattato come un antenato assente; riferimenti mancanti e
tipi non validi sono coperti dai test del mapping.

Nel tenant-process il modulo locale `services/tenantHierarchySQL.ts` raccoglie
alias, selezione degli antenati, tipi SQL privati e arricchimento batch.
Entrambi i percorsi (join e recupero batch) riusano l'aggregatore condiviso.
Il builder del read service mantiene le query degli endpoint; il modulo locale
riceve il DB esplicitamente e non introduce accessi aggiuntivi.

## 5. Fonti tecniche

Le fonti BE seguenti documentano composizione e converter. Gli endpoint e le
superfici FE per ciascuna famiglia sono riportati nelle tabelle precedenti.

- **[B1] Catalogo e istanze:** [servizio](../packages/backend-for-frontend/src/services/catalogService.ts),
  [converter](../packages/backend-for-frontend/src/api/catalogApiConverter.ts).
- **[B2] Tenant, filtri producer/consumer e certificatore:** [servizio BFF](../packages/backend-for-frontend/src/services/tenantService.ts),
  [converter BFF](../packages/backend-for-frontend/src/api/tenantApiConverter.ts),
  [query tenant-process](../packages/tenant-process/src/services/readModelServiceSQL.ts).
- **[B3] Richieste:** [servizio BFF](../packages/backend-for-frontend/src/services/agreementService.ts),
  [converter](../packages/backend-for-frontend/src/api/agreementApiConverter.ts),
  [query agreement-process](../packages/agreement-process/src/services/readModelServiceSQL.ts).
- **[B4] Finalita:** [servizio BFF](../packages/backend-for-frontend/src/services/purposeService.ts).
- **[B5] Deleghe:** [servizio BFF](../packages/backend-for-frontend/src/services/delegationService.ts),
  [converter](../packages/backend-for-frontend/src/api/delegationApiConverter.ts),
  [query delegation-process](../packages/delegation-process/src/services/readModelServiceSQL.ts).
- **[B6] Template finalita:** [servizio BFF](../packages/backend-for-frontend/src/services/purposeTemplateService.ts),
  [converter](../packages/backend-for-frontend/src/api/purposeTemplateApiConverter.ts),
  [query purpose-template-process](../packages/purpose-template-process/src/services/readModelServiceSQL.ts).
- **[B7] Template e-service:** [servizio BFF](../packages/backend-for-frontend/src/services/eserviceTemplateService.ts),
  [converter](../packages/backend-for-frontend/src/api/eserviceTemplateApiConverter.ts),
  [query eservice-template-process](../packages/eservice-template-process/src/services/readModelServiceSQL.ts).
- **[F1] Tenant attivo e header:** [query Tenant FE](../../../pdnd-interop-frontend/src/api/tenant/tenant.queries.ts),
  [service Tenant FE](../../../pdnd-interop-frontend/src/api/tenant/tenant.services.ts),
  [Header](../../../pdnd-interop-frontend/src/components/layout/Header.tsx).
- **Contratti:** [BFF](../packages/api-clients/open-api/bffApi.yml),
  [tenant-process](../packages/api-clients/open-api/tenantApi.yml).

### Precedenti nel repository

- [PR #2914](https://github.com/pagopa/interop-be-monorepo/pull/2914):
  introduzione di `CatalogTenant` e propagazione di `selfcareId` nei cataloghi
  tramite spec e converter BFF, usando i Tenant gia recuperati.
- [PR #1335](https://github.com/pagopa/interop-be-monorepo/pull/1335):
  arricchimento della delega nel dettaglio finalita; il BFF recupera delega e
  Tenant e restituisce gli enti compatti anziche il solo `delegationId`.

Sono precedenti di composizione nel BFF, non una regola universale ne una
certificazione delle prestazioni delle implementazioni esistenti.

## 6. Alternative e raccomandazione

| Aspetto | A - Gerarchia nei payload BFF interessati | B - Approccio misto |
| --- | --- | --- |
| Liste, card e dropdown | Payload arricchito | Payload arricchito |
| Dettagli con pochi enti | BFF propaga la gerarchia, riusando i recuperi esistenti | Lookup FE puntuale con cache dove scelto esplicitamente |
| Tenant attivo | Riuso dettaglio/query FE esistente | Riuso dettaglio/query FE esistente |
| Contratti | Piu modelli/converter BFF da adeguare, molti condivisi | Meno dettagli di dominio da adeguare; liste comunque coinvolte |
| Richieste dal browser | Nessuna aggiuntiva per i nomi nei payload arricchiti | Possibili GET aggiuntive per ogni Tenant distinto nei dettagli |
| Caricamento ed errori | Dati ente disponibili insieme al risultato della pagina | Stati separati per gerarchia e contenuto; errori da gestire esplicitamente |
| Costo BE | Da verificare anche quando il recupero resta interno | Costo dei dettagli Tenant aggiuntivi e recupero del payload completo |

**Raccomandazione da validare:** A, con riuso della query Tenant per il profilo
attivo. Nei flussi in cui il BFF recupera gia il Tenant, propagare la gerarchia
evita di richiedere lo stesso ente una seconda volta dal browser.
Considerare B solo come eccezione motivata per dettagli specifici.

Questa proposta non richiede di persistere il Tenant dentro Purpose, Agreement
o EService: i domini continuano a referenziare gli ID. Il BFF compone gli oggetti
di risposta; le proiezioni dedicate recuperano dal read model i dati necessari.

Una modifica allo schema condiviso non popola da sola tutte le risposte.
Viceversa, piu endpoint che usano lo stesso converter non implicano lavori
indipendenti o nuove query per ciascun endpoint.

## 7. Verifiche e decisioni aperte

1. Concordare A o B con TPM, referenti BE/FE e referente architetturale secondo
   il processo del team; riportare la decisione nella soluzione dell'SRS.
2. Definire il percorso di recupero Tenant gerarchico senza estendere
   indiscriminatamente ogni chiamata interna o aggiungere N+1 nascosti nel BFF.
3. Se si ammettono lookup FE, verificare ruoli/controparti, costo del dettaglio,
   cache, refetch, cambio sessione/ente e gestione errori. La query esistente non
   specifica uno `staleTime`: non garantisce un solo recupero per sessione.
4. Confermare per ogni filtro la ricerca per parent/root e preservare gli altri
   vincoli di eleggibilita, stati, ordinamento, paginazione e conteggio.
5. Concordare i campi additivi per istanze template e assegnazioni certificatore,
   senza cambiare il significato di `producerName` e `tenantName`.
6. Chiarire le superfici Design delle liste "I miei template", del creator nel
   dettaglio template e-service e del dropdown di archiviazione non identificato.
7. Catalogo "In evidenza" e raccolte non sono coperti dalla verifica dei flussi
   Catalogo qui descritti. Verificarli se inclusi nel requisito.
8. Confermare separatamente cambio ente Selfcare e PDF/email/notifiche.
9. Completare il censimento puntuale degli endpoint delle risorse collegate
   prima di trasformare la relativa riga in un WI implementativo.

## 8. Conseguenze sui Work Item

Non fissare il numero definitivo dei nuovi WI prima della decisione.
Con A, i gruppi di lavoro possono essere:

- dettaglio Tenant process/BFF e recupero gerarchico condiviso;
- payload Catalogo, richieste, finalita e template, riusando modelli/converter;
- deleghe, dati annidati e opzioni deleganti;
- proiezioni piatte di istanze template e assegnazioni certificatore;
- opzioni dei filtri e ricerche dedicate confermate.

Il dettaglio Tenant puo essere il WI gia aggiunto all'SRS, da completare con
la parte BFF se non inclusa. I gruppi non implicano cinque nuovi ticket:
la scomposizione finale dipende da ownership, dipendenze e perimetro confermato.

Per ogni payload modificato verificare la risposta HTTP dopo il parsing degli
schemi, non solo l'oggetto interno: root, AOO, UO diretta, UO sotto AOO, relazione
assente, identificativi/nomi invariati e root non duplicata.
Per query e filtri verificare anche esclusioni, autorizzazioni, conteggio e
paginazione; misurare il numero di recuperi e il costo sulle liste.

### Decisione

- Stato: **da concordare**.
- Approccio ed eccezioni: da compilare dopo il confronto.
- Partecipanti/data: da compilare.
- Aggiornamento soluzione SRS, data requirement e WI: successivo alla decisione.
