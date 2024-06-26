export const pa1 = {
  version: "1.0",
  questions: [
    {
      id: "purpose",
      type: "text",
      dataType: "freeText",
      label: {
        it: "Finalità (richiesto)",
        en: "Purpose (required)",
      },
      infoLabel: {
        it: "Indicare per quale finalità si intende accedere ai dati messi a disposizione con la fruizione del presente E-Service",
        en: "State what is your purpose in accessing the data provided with this E-Service",
      },
      defaultValue: [],
      required: true,
      dependencies: [],
    },
    {
      id: "usesPersonalData",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare se si accede a dati personali (richiesto)",
        en: "Will you have access to personal data? (required)",
      },
      options: [
        {
          label: { it: "Sì", en: "Yes" },
          value: "YES",
        },
        {
          label: { it: "No", en: "No" },
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
        it: "Indicare se si accede a dati non personali di terzi (richiesto)",
        en: "Will you access third-party non personal data? (required)",
      },
      options: [
        {
          label: { it: "Sì", en: "Yes" },
          value: "YES",
        },
        {
          label: { it: "No", en: "No" },
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
      id: "usesConfidentialData",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare se si accede a dati non personali ma confidenziali o strettamente riservati (richiesto)",
        en: "Will you access confidential or reserved non personal data? (required)",
      },
      options: [
        {
          label: { it: "Sì", en: "Yes" },
          value: "YES",
        },
        {
          label: { it: "No", en: "No" },
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
        {
          id: "usesThirdPartyPersonalData",
          value: "YES",
        },
      ],
    },
    {
      id: "securedDataAccess",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare se sono state adottate tutte le misure di sicurezza necessarie e/o richieste per l’accesso al dato (richiesto)",
        en: "Were all necessary and/or required security measures taken before accessing this data? (required)",
      },
      infoLabel: {
        it: "Se la risposta a questa domanda è no, prima di procedere con l’invio della richiesta di accesso al presente E-Service per la finalità indicata, si invita a adottare ogni misura di sicurezza necessaria e/o richiesta per l’accesso al dato",
        en: "If the answer is no, please take all necessary and/or required security measures before accessing this data",
      },
      options: [
        {
          label: { it: "Sì", en: "Yes" },
          value: "YES",
        },
        {
          label: { it: "No", en: "No" },
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
      id: "legalBasis",
      type: "checkbox",
      dataType: "multi",
      label: {
        it: "Indicare sulla base di quale, fra le seguenti basi giuridiche ex art. 6 del GDPR, ritiene di essere titolato ad accedere ai dati personali messi a disposizione con la fruizione dell’E-Service (richiesto, scelta multipla)",
        en: "Based on GDPR ex art. 6, state on which legal basis you think you are entitled to access the personal data provided with the access to this E-Service (required, multiple choice)",
      },
      options: [
        {
          label: {
            it: "consenso dell’interessato al trattamento dei dati personali per una o più specifiche finalità",
            en: "consent of the interested party to the treatment of personal data for one or more purposes",
          },
          value: "CONSENT",
        },
        {
          label: {
            it: "esecuzione di un contratto di cui l'interessato è parte o di misure precontrattuali adottate su richiesta dello stesso",
            en: "execution of a contract which the party is part of or precontractual measures adopted upon request of said party",
          },
          value: "CONTRACT",
        },
        {
          label: {
            it: "adempimento di un obbligo legale",
            en: "fulfillment of a legal obligation",
          },
          value: "LEGAL_OBLIGATION",
        },
        {
          label: {
            it: "salvaguardia degli interessi vitali di una persona fisica",
            en: "safeguard of vital interests of a physical person",
          },
          value: "SAFEGUARD",
        },
        {
          label: {
            it: "esecuzione di un compito di interesse pubblico o connesso all'esercizio di pubblici poteri di cui sei investito",
            en: "execution of a task of public interest or connected to the exercise of public authority bestowed upon you",
          },
          value: "PUBLIC_INTEREST",
        },
        {
          label: {
            it: "perseguimento del legittimo interesse del titolare del trattamento o di terzi, a condizione che non prevalgano gli interessi o i diritti e le libertà fondamentali dell'interessato che richiedono la protezione dei dati personali, in particolare se l'interessato è un minore",
            en: "pursue of a legitimate interest of the owner of the treatment or of a third party, on condition that the interest, rights and fundamental freedoms of the interested party that require personal data protection not prevail, with particular interests in case of a minor",
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
        it: "Inserire riferimento normativo per adempimento di un obbligo legale (richiesto)",
        en: "State the normative reference towards the fulfillment of a legal obligation (required)",
      },
      defaultValue: [],
      required: true,
      dependencies: [
        {
          id: "legalBasis",
          value: "LEGAL_OBLIGATION",
        },
      ],
    },
    {
      id: "publicInterestReference",
      type: "text",
      dataType: "freeText",
      label: {
        it: "Inserire riferimento normativo per esecuzione di un compito di interesse pubblico o connesso all'esercizio di pubblici poteri di cui sei investito (richiesto)",
        en: "State the normative reference for the execution of a public interest task, or connected to the exercise of public powers bestowed upon you (required)",
      },
      defaultValue: [],
      required: true,
      dependencies: [
        {
          id: "legalBasis",
          value: "PUBLIC_INTEREST",
        },
      ],
    },
    {
      id: "knowsAccessedDataCategories",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare se si conosce la tipologia di dati personali cui si avrà accesso attraverso la fruizione del presente E-Service di cui alle definizioni contenute nell’art. 4, nn. 1, 13, 14 e 15 del GDPR (richiesto)",
        en: "Do you know the type of personal data you will have access to with the subscription to this E-Service? (required)",
      },
      options: [
        {
          label: { it: "Sì", en: "Yes" },
          value: "YES",
        },
        {
          label: { it: "No", en: "No" },
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
      id: "accessDataArt9Gdpr",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare se si accederà a particolari categorie di dati personali ex art. 9 del GDPR (richiesto)",
        en: "Will you access personal data of peculiar categories with reference to the GDPR ex art. 9? (required)",
      },
      options: [
        {
          label: { it: "Sì", en: "Yes" },
          value: "YES",
        },
        {
          label: { it: "No", en: "No" },
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
          id: "knowsAccessedDataCategories",
          value: "YES",
        },
      ],
    },
    {
      id: "accessUnderageData",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare se si accederà a dati di minori ex art. 8 del GDPR (richiesto)",
        en: "Will you access underage data with reference to the GDPR ex art. 8? (required)",
      },
      options: [
        {
          label: { it: "Sì", en: "Yes" },
          value: "YES",
        },
        {
          label: { it: "No", en: "No" },
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
          id: "knowsAccessedDataCategories",
          value: "YES",
        },
      ],
    },
    {
      id: "knowsDataQuantity",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare se si conosce la quantità di dati personali di cui si entrerà in possesso attraverso la fruizione del presente E-Service (richiesto)",
        en: "Do you know how much personal data you will access through the subscription of this E-Service? (required)",
      },
      options: [
        {
          label: { it: "Sì", en: "Yes" },
          value: "YES",
        },
        {
          label: { it: "No", en: "No" },
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
        it: "Fascia di riferimento (richiesto)",
        en: "Reference range (required)",
      },
      infoLabel: {
        it: "Si richiede di specificare la fascia di riferimento fra quelle di seguito indicate anche in funzione del periodo di validità del voucher emesso per la fruizione dell’E-Service",
        en: "You are required to state the reference range among the options given, keeping in mind the expiration of the access token (voucher) emitted for the fruition of the E-Service",
      },
      options: [
        {
          label: { it: "0-100", en: "0-100" },
          value: "QUANTITY_0_TO_100",
        },
        {
          label: { it: "101-500", en: "101-500" },
          value: "QUANTITY_101_TO_500",
        },
        {
          label: { it: "501-1000", en: "501-1000" },
          value: "QUANTITY_500_TO_1000",
        },
        {
          label: { it: "1001-5000", en: "1001-5000" },
          value: "QUANTITY_1001_TO_5000",
        },
        {
          label: { it: "da 5001 in su", en: "5001 and above" },
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
        it: "Modalità di erogazione (richiesto)",
        en: "Delivery mode (required)",
      },
      infoLabel: {
        it: "Indicare con quali modalità il Fruitore intende ricevere le informazioni dall’Erogatore, d’accordo con quelle già previste dall’Erogatore stesso",
        en: "State how the Subscriber will receive the information from the Provider, in accordance with the ones already provided by the Provider",
      },
      options: [
        {
          label: { it: "in chiaro", en: "cleartext" },
          value: "CLEARTEXT",
        },
        {
          label: { it: "in forma aggregata", en: "aggregated" },
          value: "AGGREGATE",
        },
        {
          label: { it: "in forma anonimizzata", en: "anonymized" },
          value: "ANONYMOUS",
        },
        {
          label: {
            it: "in forma pseudoanonimizzata",
            en: "pseudonymized",
          },
          value: "PSEUDOANONYMOUS",
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
      id: "doneDpia",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare se è stata fatta un’apposita valutazione di impatto (c.d. DPIA) relativamente alle attività di trattamento dei dati personali che saranno effettuate attraverso la fruizione del presente E-Service (richiesto)",
        en: "Have you done an impact assessment (c.d. DPIA) with reference to the personal data handling activities that will be carried out through the fruition of the present E-Service? (required)",
      },
      infoLabel: {
        it: "Se la risposta a questa domanda è no, si invita a fare tale valutazione prima di fruire dell’E-Service",
        en: "If the answer is no, please do this evaluation before accessing the E-Service",
      },
      options: [
        {
          label: { it: "Sì", en: "Yes" },
          value: "YES",
        },
        {
          label: { it: "No", en: "No" },
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
      id: "definedDataRetentionPeriod",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare se è stato determinato un periodo di conservazione dei dati cui si avrà accesso attraverso il presente E-Service (richiesto)",
        en: "Have you determined a data retention period you will have access to through the fruition of the E-Service? (required)",
      },
      infoLabel: {
        it: "Se la risposta a questa domanda è no, si invita a determinare tale periodo prima di fruire dell’E-Service",
        en: "If the answer is no, please determine such period before accessing the E-Service",
      },
      options: [
        {
          label: { it: "Sì", en: "Yes" },
          value: "YES",
        },
        {
          label: { it: "No", en: "No" },
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
      id: "purposePursuit",
      type: "radio",
      dataType: "single",
      label: {
        it: "Per perseguire la finalità dichiarata, indicare se (richiesto)",
        en: "To pursue this purpose, please state if (required)",
      },
      options: [
        {
          label: {
            it: "è sufficiente che l’Erogatore verifichi la mera correttezza di una/o determinata/o informazione/dato personale già in suo possesso",
            en: "it is sufficient for the Provider to check the mere correctedness of a particular information or personal data they already own",
          },
          value: "MERE_CORRECTNESS",
        },
        {
          label: {
            it: "è necessario ricevere ex novo una/o determinata/o informazione/dato personale",
            en: "it is necessary to receive the information or personal data ex novo",
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
      type: "checkbox",
      dataType: "multi",
      label: {
        it: "Confermare se è stato verificato se sul Catalogo API è presente un altro E-Service in grado di svolgere questa attività di mera verifica (che non preveda ex novo la comunicazione di altri informazioni/dati personali – richiesto)",
        en: "Have you checked if there is another E-Service in the Catalog that allows you to carry out this simple check task (in case it does not require the ex novo transmission of other information/personal data)? (required)",
      },
      options: [
        {
          label: { it: "Confermo", en: "Confirm" },
          value: "YES",
        },
      ],
      defaultValue: [],
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
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare se è stato verificato se occorrono necessariamente tutte le informazioni e i dati personali messi a disposizione con il presente E-Service (richiesto)",
        en: "Did you check if it necessary for you to access all the information and personal data provided with the present E-Service? (required)",
      },
      options: [
        {
          label: { it: "Sì", en: "Yes" },
          value: "YES",
        },
        {
          label: { it: "No", en: "No" },
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
          id: "purposePursuit",
          value: "NEW_PERSONAL_DATA",
        },
      ],
    },
    {
      id: "checkedExistenceMinimalDataInteropCatalogue",
      type: "radio",
      dataType: "single",
      label: {
        it: "Indicare se si è verificato se sul Catalogo API è presente un altro E-Service che consenta di accedere alle sole informazioni/dati personali di cui si necessita (richiesto)",
        en: "Did you check if another E-Service that allows you to only access the information/personal data you need is present on the Catalog? (required)",
      },
      infoLabel: {
        it: "Se la risposta a questa domanda è no, per evitare comunicazioni di informazioni/dati personali non necessarie, si invita a sollecitare un Erogatore ad attivare un E-Service che consenta di accedere ai soli dati personali di cui si necessita e, una volta attivato, si invita a inviare una richiesta di accesso per quell’E-Service",
        en: "If the answer is no, please check the Catalog for E-Services that allow you to only access the information/personal data you need",
      },
      options: [
        {
          label: { it: "Sì", en: "Yes" },
          value: "YES",
        },
        {
          label: { it: "No", en: "No" },
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
          id: "purposePursuit",
          value: "NEW_PERSONAL_DATA",
        },
        {
          id: "checkedAllDataNeeded",
          value: "NO",
        },
      ],
    },
  ],
};
