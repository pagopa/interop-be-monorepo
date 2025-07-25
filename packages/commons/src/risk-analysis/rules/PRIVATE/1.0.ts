export const private1 = {
  version: "1.0",
  questions: [
    {
      id: "purpose",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare per quale finalità si intende accedere ai dati messi a disposizione con la fruizione del presente E-service",
        en: "",
      },
      infoLabel: {
        it: "NB: Si ricorda ai sensi dell’art. 5, paragrafo 1, lett. b), del GDPR (principio della limitazione delle finalità), le finalità devono essere determinate, esplicite e legittime, e che i dati ottenuti possono essere successivamente trattati solo in modo compatibile con le predette finalità. Si ricorda, altresì, che qualora sussista più di una finalità, il Fruitore DEVE effettuare un’analisi del rischio per ognuna delle finalità individuate",
        en: "",
      },
      options: [
        {
          label: {
            it: "Per fini istituzionali che non richiedano prestazioni di elaborazioni aggiuntive",
            en: "",
          },
          value: "INSTITUTIONAL",
        },
        {
          label: {
            it: "Altro",
            en: "",
          },
          value: "OTHER",
        },
      ],
      defaultValue: ["INSTITUTIONAL"],
      required: true,
      dependencies: [],
    },
    {
      id: "institutionalPurpose",
      type: "text",
      dataType: "freeText",
      label: {
        it: "Specificare il fine perseguito per fini istituzionali che non richiedano prestazioni di elaborazioni aggiuntive",
        en: "",
      },
      validation: {
        maxLength: 2000,
      },
      defaultValue: [],
      required: true,
      dependencies: [
        {
          id: "purpose",
          value: "INSTITUTIONAL",
        },
      ],
    },
    {
      id: "otherPurpose",
      type: "text",
      dataType: "freeText",
      label: {
        it: "Specificare il fine perseguito",
        en: "",
      },
      validation: {
        maxLength: 2000,
      },
      defaultValue: [],
      required: true,
      dependencies: [
        {
          id: "purpose",
          value: "OTHER",
        },
      ],
    },
    {
      id: "usesPersonalData",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare se si accede a dati personali",
        en: "",
      },
      infoLabel: {
        it: "NB: si ricorda che ai sensi dell’art. 4, paragrafo 1, n. 1,  del GDPR  per dato personale si intende qualsiasi informazione riguardante una persona fisica identificata o che può essere identificata, direttamente o indirettamente, con particolare riferimento a un identificativo come il nome, un numero di identificazione, dati relativi all'ubicazione, un identificativo online o a uno o più elementi caratteristici della sua identità fisica, fisiologica, genetica, psichica, economica, culturale o sociale”. Pertanto devono essere considerati dati personali non solo dati che identificano direttamente un individuo (es. nome e cognome, codice fiscale, indirizzo e-mail) ma anche dati che possono essere ricondotti a un individuo solo indirettamente, tramite terzi rispetto al Fruitore (es. la targa di un veicolo, numero di matricola o altro codice alfanumerico attribuito a un individuo da un soggetto terzo).",
        en: "",
      },
      options: [
        {
          label: {
            it: "Sì",
            en: "Yes",
          },
          value: "YES",
        },
        {
          label: {
            it: "No",
            en: "No",
          },
          value: "NO",
        },
      ],
      defaultValue: ["NO"],
      required: true,
      dependencies: [],
    },
    {
      id: "usesThirdPartyPersonalData",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare se si accede a dati non personali di terzi (quindi a dati non personali che non sono riferibili al Fruitore stesso)",
        en: "",
      },
      options: [
        {
          label: {
            it: "Sì",
            en: "Yes",
          },
          value: "YES",
        },
        {
          label: {
            it: "No",
            en: "No",
          },
          value: "NO",
        },
      ],
      defaultValue: ["NO"],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "NO",
        },
      ],
    },
    {
      id: "personalDataTypes",
      type: "checkbox",
      dataType: "multi",
      label: {
        it: "Indicare la tipologia di dati personali cui si avrà accesso attraverso la fruizione del presente E-service, tenuto conto delle definizioni contenute nell’art. 4, nn. 1, 13, 14 e 15 del GDPR",
        en: "",
      },
      options: [
        {
          label: {
            it: "Dati personali comuni non identificativi (es. numero di targa)",
            en: "",
          },
          value: "WITH_NON_IDENTIFYING_DATA",
        },
        {
          label: {
            it: "Dati personali comuni identificativi (es. codice fiscale)",
            en: "",
          },
          value: "WITH_IDENTIFYING_DATA",
        },
        {
          label: {
            it: "Dati di minori ex art. 8 del GDPR (es. nome e cognome di un minore)",
            en: "",
          },
          value: "GDPR_ART_8",
        },
        {
          label: {
            it: "Dati particolari ex art. 9 del GDPR (es. origine razziale o etnica, opinioni politiche, convinzioni religiose o filosofiche, appartenenza sindacale, nonché dati genetici, biometrici intesi a identificare in modo univoco una persona fisica, dati relativi alla salute o alla vita sessuale o all'orientamento sessuale della persona)",
            en: "",
          },
          value: "GDPR_ART_9",
        },
        {
          label: {
            it: "Dati giudiziari ex art. 10 del GDPR",
            en: "",
          },
          value: "GDPR_ART_10",
        },
        {
          label: {
            it: "Altro",
            en: "",
          },
          value: "OTHER",
        },
      ],
      defaultValue: [],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
      ],
    },
    {
      id: "otherPersonalDataTypes",
      type: "text",
      dataType: "freeText",
      label: {
        it: "Specificare la tipologia di dati personali",
        en: "",
      },
      validation: {
        maxLength: 2000,
      },
      defaultValue: [],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
        {
          id: "personalDataTypes",
          value: "OTHER",
        },
      ],
    },
    {
      id: "legalBasis",
      type: "checkbox",
      dataType: "multi",
      label: {
        it: "Indicare sulla base di quale, fra le seguenti basi giuridiche ex art. 6 del GDPR, ritiene di essere titolato ad accedere ai dati personali messi a disposizione con la fruizione dell’E-Service",
        en: "",
      },
      options: [
        {
          label: {
            it: "Consenso dell’interessato al trattamento dei dati personali per una o più specifiche finalità",
            en: "",
          },
          value: "CONSENT",
        },
        {
          label: {
            it: "Esecuzione di un contratto di cui l'interessato è parte o di misure precontrattuali adottate su richiesta dello stesso",
            en: "",
          },
          value: "CONTRACT",
        },
        {
          label: {
            it: "Adempimento di un obbligo legale",
            en: "",
          },
          value: "LEGAL_OBLIGATION",
        },
        {
          label: {
            it: "Salvaguardia degli interessi vitali di una persona fisica",
            en: "",
          },
          value: "SAFEGUARD",
        },
        {
          label: {
            it: "Esecuzione di un compito di interesse pubblico o connesso all'esercizio di pubblici poteri di cui sei investito",
            en: "",
          },
          value: "PUBLIC_INTEREST",
        },
        {
          label: {
            it: "Perseguimento del legittimo interesse del titolare del trattamento o di terzi, a condizione che non prevalgano gli interessi o i diritti e le libertà fondamentali dell'interessato che richiedono la protezione dei dati personali, in particolare se l'interessato è un minore (NB: ai sensi dell’art. 6 lettera f) primo comma, questa opzione non può essere selezionata in caso di trattamento di dati effettuato dalle autorità pubbliche nell’esecuzione dei propri compiti)",
            en: "",
          },
          value: "LEGITIMATE_INTEREST",
        },
      ],
      defaultValue: [],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
      ],
    },
    {
      id: "legalObligationReference",
      type: "text",
      dataType: "freeText",
      label: {
        it: "Specificare l’obbligo legale e, laddove possibile, la normativa di riferimento",
        en: "",
      },
      infoLabel: {
        it: "",
        en: "",
      },
      validation: {
        maxLength: 2000,
      },
      defaultValue: [],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
        {
          id: "legalBasis",
          value: "LEGAL_OBLIGATION",
        },
      ],
    },
    {
      id: "legitimateInterestReference",
      type: "text",
      dataType: "freeText",
      label: {
        it: "Inserire I) l’interesse legittimo perseguito II) l’analisi sulla non prevalenza degli interessi, diritti e libertà degli Interessati che richiedono la protezione dei dati personali, in particolare se l’interessato è un minore",
        en: "",
      },
      infoLabel: {
        it: "",
        en: "",
      },
      validation: {
        maxLength: 2000,
      },
      defaultValue: [],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
        {
          id: "legalBasis",
          value: "LEGITIMATE_INTEREST",
        },
      ],
    },
    {
      id: "legalBasisPublicInterest",
      type: "radio",
      dataType: "single",
      label: {
        it: "Specificare le motivazioni di esecuzione di un compito di interesse pubblico o connesso all'esercizio di pubblici poteri di cui sei investito",
        en: "",
      },
      options: [
        {
          label: {
            it: "Norma di legge o di regolamento ai sensi dell’art. 2-ter, comma 1, del Codice Privacy per quanto attiene ai dati personali comuni e ai sensi dell’art. 2- sexies, comma 1 del Codice Privacy per quanto attiene alle categorie particolari di dati",
            en: "",
          },
          value: "RULE_OF_LAW",
        },
        {
          label: {
            it: "Atto amministrativo generale ai sensi dell’art. 2-ter, comma 1, del Codice Privacy per quanto attiene ai dati personali comuni e ai sensi dell’art. 2-sexies, comma 1 del Codice Privacy per quanto attiene alle categorie particolari di dati",
            en: "",
          },
          value: "ADMINISTRATIVE_ACT",
        },
        {
          label: {
            it: "Adempimento di un compito svolto nel pubblico interesse o per l’esecuzione di pubblici poteri attribuiti al Fruitore ai sensi dell’art. 2-ter, comma 1 bis, del Codice Privacy",
            en: "",
          },
          value: "PUBLIC_INTEREST_TASK",
        },
      ],
      defaultValue: ["RULE_OF_LAW"],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
        {
          id: "legalBasis",
          value: "PUBLIC_INTEREST",
        },
      ],
      hideOption: {
        PUBLIC_INTEREST_TASK: [
          {
            id: "personalDataTypes",
            value: "GDPR_ART_9",
          },
        ],
      },
    },
    {
      id: "ruleOfLawText",
      type: "text",
      dataType: "freeText",
      label: {
        it: "Inserire norma di legge o regolamento applicabile",
        en: "",
      },
      infoLabel: {
        it: "È previsto sia inserita la norma di legge o di regolamento ai sensi dell’art. 2-ter, comma 1, del Codice Privacy per quanto attiene ai dati personali comuni e ai sensi dell’art. 2- sexies, comma 1 del Codice Privacy per quanto attiene alle categorie particolari di dati",
        en: "",
      },
      validation: {
        maxLength: 2000,
      },
      defaultValue: [],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
        {
          id: "legalBasisPublicInterest",
          value: "RULE_OF_LAW",
        },
        {
          id: "legalBasis",
          value: "PUBLIC_INTEREST",
        },
      ],
    },
    {
      id: "administrativeActText",
      type: "text",
      dataType: "freeText",
      label: {
        it: "Inserire il riferimento dell’atto amministrativo generale applicabile",
        en: "",
      },
      infoLabel: {
        it: "È previsto sia inserito l'atto amministrativo generale ai sensi dell’art. 2-ter, comma 1, del Codice Privacy per quanto attiene ai dati personali comuni e ai sensi dell’art. 2-sexies, comma 1 del Codice Privacy per quanto attiene alle categorie particolari di dati",
        en: "TODO",
      },
      validation: {
        maxLength: 2000,
      },
      defaultValue: [],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
        {
          id: "legalBasisPublicInterest",
          value: "ADMINISTRATIVE_ACT",
        },
        {
          id: "legalBasis",
          value: "PUBLIC_INTEREST",
        },
      ],
    },
    {
      id: "publicInterestTaskText",
      type: "text",
      dataType: "freeText",
      label: {
        it: "Inserire il compito svolto o il pubblico il riferimento dell’atto amministrativo generale applicabile",
        en: "",
      },
      infoLabel: {
        it: "È previsto sia inserito il riferimento all'adempimento di un compito svolto nel pubblico interesse o per l’esecuzione di pubblici poteri attribuiti al Fruitore ai sensi dell’art. 2-ter, comma 1 bis, del Codice Privacy",
        en: "",
      },
      validation: {
        maxLength: 2000,
      },
      defaultValue: [],
      required: true,
      dependencies: [
        {
          id: "legalBasisPublicInterest",
          value: "PUBLIC_INTEREST_TASK",
        },
      ],
    },
    {
      id: "knowsDataQuantity",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare se si conosce la quantità di dati personali di cui si entrerà in possesso attraverso la fruizione del presente E-Service",
        en: "",
      },
      options: [
        {
          label: {
            it: "Sì",
            en: "Yes",
          },
          value: "YES",
        },
        {
          label: {
            it: "No",
            en: "No",
          },
          value: "NO",
        },
      ],
      defaultValue: ["NO"],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
      ],
    },
    {
      id: "dataQuantity",
      type: "select-one",
      dataType: "single",
      label: {
        it: "Fascia di riferimento",
        en: "",
      },
      infoLabel: {
        it: "Si richiede di specificare la fascia di riferimento fra quelle di seguito indicate anche in funzione del periodo di validità del voucher emesso per la fruizione dell’E-Service",
        en: "",
      },
      options: [
        {
          label: {
            it: "0-100",
            en: "0-100",
          },
          value: "QUANTITY_0_TO_100",
        },
        {
          label: {
            it: "101-500",
            en: "101-500",
          },
          value: "QUANTITY_101_TO_500",
        },
        {
          label: {
            it: "501-1000",
            en: "501-1000",
          },
          value: "QUANTITY_500_TO_1000",
        },
        {
          label: {
            it: "1001-5000",
            en: "1001-5000",
          },
          value: "QUANTITY_1001_TO_5000",
        },
        {
          label: {
            it: "da 5001 in su",
            en: "5001 and up",
          },
          value: "QUANTITY_5001_OVER",
        },
      ],
      defaultValue: ["QUANTITY_0_TO_100"],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
        {
          id: "knowsDataQuantity",
          value: "YES",
        },
      ],
    },
    {
      id: "deliveryMethod",
      type: "select-one",
      dataType: "single",
      label: {
        it: "Modalità di erogazione",
        en: "",
      },
      infoLabel: {
        it: "Indicare con quali modalità il Fruitore intende ricevere le informazioni dall’Erogatore, d’accordo con quelle già previste dall’Erogatore stesso. NB: si ricorda che ai sensi dell’art. 5, paragrafo 1, lett. c), del GDPR (principio di minimizzazione) il trattamento di dati personali deve essere sempre proporzionale e limitato a quanto strettamente necessario alla finalità perseguita, e possono essere acceduti tramite l’e-service unicamente i dati adeguati, pertinenti e limitati a quanto necessario per il fine perseguito. Pertanto: (i) solo qualora non sia possibile perseguire le finalità dichiarate nel punto 1 sopra sulla base di dati aggregati o anonimi è possibile barrare le opzioni di dati in chiaro e pseudonimizzati e (ii) solo qualora non sia possibile perseguire le predette finalità con dati pseudonimizzati è possibile barrare l’opzione di dati in chiaro",
        en: "",
      },
      options: [
        {
          label: {
            it: "In chiaro",
            en: "cleartext",
          },
          value: "CLEARTEXT",
        },
        {
          label: {
            it: "In forma pseudoanonimizzata",
            en: "pseudonymized",
          },
          value: "PSEUDOANONYMOUS",
        },
        {
          label: {
            it: "In forma aggregata",
            en: "aggregated",
          },
          value: "AGGREGATE",
        },
        {
          label: {
            it: "In forma anonimizzata",
            en: "anonymized",
          },
          value: "ANONYMOUS",
        },
      ],
      defaultValue: ["CLEARTEXT"],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
      ],
    },
    {
      id: "policyProvided",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare se è stata fornita un’informativa all’interessato circa l’accesso ai dati cui si intende accedere/che si intende ricevere tramite la fruizione dell’E-Service e le relative attività di trattamento effettuate dal Fruitore",
        en: "",
      },
      options: [
        {
          label: {
            it: "Sì",
            en: "Yes",
          },
          value: "YES",
        },
        {
          label: {
            it: "No",
            en: "No",
          },
          value: "NO",
        },
      ],
      defaultValue: ["YES"],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
      ],
    },
    {
      id: "reasonPolicyNotProvided",
      type: "text",
      dataType: "freeText",
      label: {
        it: "Inserire le ragioni per cui non è stata fornita informativa specifica ai sensi dell’art. 14, paragrafo 5, del GDPR",
        en: "",
      },
      infoLabel: {
        it: "È previsto sia fornita un’informativa all’interessato circa l’accesso ai dati cui si intende accedere/che si intende ricevere tramite la fruizione dell’E-Service e le relative attività di trattamento effettuate dal Fruitore",
        en: "TODO",
      },
      validation: {
        maxLength: 2000,
      },
      defaultValue: [],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
        {
          id: "policyProvided",
          value: "NO",
        },
      ],
    },
    {
      id: "policyProvidedMedium",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare la modalità attraverso la quale è stata fornita l'informativa",
        en: "",
      },
      options: [
        {
          label: {
            it: "Cartacea",
            en: "",
          },
          value: "PRINT",
        },
        {
          label: {
            it: "Online",
            en: "",
          },
          value: "ONLINE",
        },
      ],
      defaultValue: ["PRINT"],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
        {
          id: "policyProvided",
          value: "YES",
        },
      ],
    },
    {
      id: "policyProvidedOnlineLink",
      type: "text",
      dataType: "freeText",
      label: {
        it: "Inserire il link all'informativa",
        en: "",
      },
      validation: {
        maxLength: 2000,
      },
      defaultValue: [],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
        {
          id: "policyProvided",
          value: "YES",
        },
        {
          id: "policyProvidedMedium",
          value: "ONLINE",
        },
      ],
    },
    {
      id: "confirmPricipleIntegrityAndDiscretion",
      type: "switch",
      dataType: "single",
      label: {
        it: "Confermare se - in linea con il principio di integrità e riservatezza di cui all’art. 5, paragrafo 1, lett. f), del GDPR - sono state adottate tutte le misure tecniche e organizzative necessarie a garantire un’adeguata sicurezza dei dati personali cui si avrà accesso in sede di fruizione del presente E-service, compresa la protezione da trattamenti non autorizzati o illeciti e dalla perdita, dalla distruzione o dal danno accidentali",
        en: "",
      },
      options: [
        {
          label: {
            it: "Confermo",
            en: "Confirm",
          },
          value: "true",
        },
      ],
      defaultValue: ["false"],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
      ],
    },
    {
      id: "dataProtectionMeasures",
      type: "text",
      dataType: "freeText",
      label: {
        it: "Misure tecniche e organizzative adottate",
        en: "",
      },
      infoLabel: {
        it: "Indicare le misure tecniche e organizzative adottate necessarie a garantire un’adeguata sicurezza dei dati personali ai sensi degli articoli 25 e 32 del GDPR",
        en: "",
      },
      validation: {
        maxLength: 2000,
      },
      defaultValue: [],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
        {
          id: "personalDataTypes",
          value: "GDPR_ART_10",
        },
        {
          id: "confirmPricipleIntegrityAndDiscretion",
          value: "true",
        },
      ],
    },
    {
      id: "doneDpia",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare se è stata fatta un’apposita Valutazione di Impatto (c.d. DPIA) relativamente alle attività di trattamento dei dati personali che saranno effettuate attraverso la fruizione del presente E-service",
        en: "",
      },
      infoLabel: {
        it: "In caso di risposta negativa, si ricorda che la valutazione di impatto è obbligatoria ​​qualora sussistano le condizioni di cui all’art. 35 del GDPR",
        en: "",
      },
      options: [
        {
          label: {
            it: "Sì",
            en: "Yes",
          },
          value: "YES",
        },
        {
          label: {
            it: "No",
            en: "No",
          },
          value: "NO",
        },
      ],
      defaultValue: ["NO"],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
      ],
    },
    {
      id: "confirmedDoneDpia",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare se si è proceduto alla consultazione preventiva al Garante per la protezione dei dati personali",
        en: "",
      },
      infoLabel: {
        it: "In caso di risposta negativa, si ricorda che la consultazione preventiva è obbligatoria ​​qualora sussistano le condizioni di cui all’art. 36 del GDPR",
        en: "",
      },
      options: [
        {
          label: {
            it: "Sì",
            en: "Yes",
          },
          value: "YES",
        },
        {
          label: {
            it: "No",
            en: "No",
          },
          value: "NO",
        },
      ],
      defaultValue: ["NO"],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
        {
          id: "doneDpia",
          value: "YES",
        },
      ],
    },
    {
      id: "dataDownload",
      type: "radio",
      dataType: "single",
      label: {
        it: "In caso di download dei dati cui si avrà accesso attraverso il presente E-service, dichiarare se è stato individuato un periodo di conservazione dei dati",
        en: "",
      },
      infoLabel: {
        it: "NB: si ricorda che il download del dato non consente di disporre di un dato aggiornato, e quindi di agire nel rispetto del principio di esattezza dei dati di cui all’art. 5, paragrafo 1, lettera d), del GDPR. Pertanto, si invita a limitare i casi di download del dato alle ipotesi in cui tale download è strettamente necessario e giustificato dalla finalità del trattamento. Si ricorda, altresì, che, ai sensi dell’art. 5, paragrafo 1, lett. b) ed e) del GDPR (principio della limitazione della finalità e della conservazione) , i dati possono essere conservati unicamente per il tempo strettamente necessario al perseguimento delle finalità per cui sono stati raccolti, e che le stesse siano determinate, esplicite e legittime.",
        en: "",
      },
      options: [
        {
          label: {
            it: "Sì",
            en: "Yes",
          },
          value: "YES",
        },
        {
          label: {
            it: "No",
            en: "No",
          },
          value: "NO",
        },
      ],
      defaultValue: ["NO"],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
      ],
    },
    {
      id: "dataRetentionPeriod",
      type: "text",
      dataType: "freeText",
      label: {
        it: "Indicare il periodo di conservazione dei dati individuato",
        en: "",
      },
      infoLabel: {
        it: "La cifra seguita da ora, giorno, mese, anno. Ad es. 1 ora oppure 10 giorni oppure 3 mesi oppure 2 anni",
        en: "",
      },
      validation: {
        maxLength: 2000,
      },
      defaultValue: [],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
        {
          id: "dataDownload",
          value: "YES",
        },
      ],
    },
    {
      id: "purposePursuit",
      type: "radio",
      dataType: "single",
      label: {
        it: "Ai sensi del principio di minimizzazione di cui all’art. 5, paragrafo 1, let. c) del GDPR, per perseguire la finalità di cui al punto 1, indicare se",
        en: "",
      },
      options: [
        {
          label: {
            it: "È sufficiente che l’Erogatore verifichi la mera correttezza di una/o determinata/o informazione/dato personale già in suo possesso",
            en: "",
          },
          value: "MERE_CORRECTNESS",
        },
        {
          label: {
            it: "È necessario ricevere ex novo una/o determinata/o informazione/dato personale",
            en: "",
          },
          value: "NEW_PERSONAL_DATA",
        },
      ],
      defaultValue: ["MERE_CORRECTNESS"],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
      ],
    },
    {
      id: "checkedExistenceMereCorrectnessInteropCatalogue",
      type: "switch",
      dataType: "single",
      label: {
        it: "Confermare se è stato verificato se sul Catalogo API è presente un altro E-Service in grado di svolgere questa attività di mera verifica (che non preveda ex novo la comunicazione di altri informazioni/dati personali)",
        en: "",
      },
      options: [
        {
          label: {
            it: "Confermo",
            en: "Confirm",
          },
          value: "true",
        },
      ],
      defaultValue: ["false"],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
        {
          id: "purposePursuit",
          value: "MERE_CORRECTNESS",
        },
      ],
    },
    {
      id: "checkedAllDataNeeded",
      type: "switch",
      dataType: "single",
      label: {
        it: "Indicare se è stato verificato se occorrono necessariamente tutte le informazioni e i dati personali messi a disposizione con il presente E-service",
        en: "",
      },
      infoLabel: {
        it: "NB: in caso nel Catalogo non sia presente un E-Service che consenta di accedere alle sole informazioni/dati personali di cui si necessita, per evitare comunicazioni di informazioni/dati personali non necessarie, si invita a sollecitare un Erogatore ad attivare un E-service che consenta di accedere ai soli dati personali di cui si necessita e, una volta attivato, si invita a inviare una richiesta di accesso per quell’E-Service",
        en: "",
      },
      options: [
        {
          label: {
            it: "Sì",
            en: "Yes",
          },
          value: "true",
        },
      ],
      defaultValue: ["false"],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
        {
          id: "purposePursuit",
          value: "NEW_PERSONAL_DATA",
        },
      ],
    },
    {
      id: "declarationConfirmGDPR",
      type: "switch",
      dataType: "single",
      label: {
        it: "Dichiara di essere consapevole degli obblighi di cui al GDPR in tema di trattamento di dati personali e ​​dichiara di essere in grado di comprovarne il rispetto (principio di responsabilizzazione di cui all’art. 5, paragrafo 2, del GDPR)",
        en: "",
      },
      options: [
        {
          label: {
            it: "Confermo",
            en: "Confirm",
          },
          value: "true",
        },
      ],
      defaultValue: ["false"],
      required: true,
      dependencies: [
        {
          id: "usesPersonalData",
          value: "YES",
        },
      ],
    },
  ],
};
