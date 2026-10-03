import { generateId } from "pagopa-interop-models";

import { TenantDigestData } from "../src/services/digestDataService.js";

/**
 * Returns mock digest data with all sections populated (full data)
 */
export function getMockTenantDigestData(): TenantDigestData {
  return {
    tenantId: generateId(),
    tenantName: "Mock Tenant Organization",
    notificationSettingsLink: "https://example.com/notification-settings",
    viewAllNewEservicesLink: "https://example.com/eservices/new",
    viewAllUpdatedEservicesLink: "https://example.com/eservices/updated",
    viewAllSentAgreementsLink: "https://example.com/agreements/sent",
    viewAllSentPurposesLink: "https://example.com/purposes/sent",
    viewAllReceivedAgreementsLink: "https://example.com/agreements/received",
    viewAllReceivedPurposesLink: "https://example.com/purposes/received",
    viewAllReceivedDelegationsLink: "https://example.com/delegations/received",
    viewAllAttributesLink: "https://example.com/attributes",
    viewAllUpdatedEserviceTemplatesLink:
      "https://example.com/eservice-templates/updated",
    newEservices: {
      items: [
        {
          name: "Servizio Anagrafica Nazionale",
          producerName: "Ministero dell'Interno",
          link: "https://example.com/eservice/1",
        },
        {
          name: "API Fatturazione Elettronica",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/eservice/2",
        },
        {
          name: "Servizio Consultazione Catasto",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/eservice/3",
        },
        {
          name: "API Registro Imprese",
          producerName: "Unioncamere",
          link: "https://example.com/eservice/4",
        },
        {
          name: "Piattaforma Notifiche Digitali",
          producerName: "PagoPA S.p.A.",
          link: "https://example.com/eservice/5",
        },
        {
          name: "Servizio Mobilita Nazionale",
          producerName: "Ministero delle Infrastrutture e dei Trasporti",
          link: "https://example.com/eservice/6",
        },
      ],
      totalCount: 8,
    },
    updatedEservices: {
      items: [
        {
          name: "Servizio SPID",
          producerName: "AgID",
          link: "https://example.com/eservice/3",
        },
        {
          name: "API Pagamenti Digitali",
          producerName: "PagoPA S.p.A.",
          link: "https://example.com/eservice/4",
        },
        {
          name: "Servizio Dati Territoriali",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/eservice/5",
        },
        {
          name: "API Mobilita Pubblica",
          producerName: "Ministero delle Infrastrutture e dei Trasporti",
          link: "https://example.com/eservice/6",
        },
        {
          name: "Servizio Albo Nazionale",
          producerName: "Ministero della Giustizia",
          link: "https://example.com/eservice/7",
        },
        {
          name: "API Imprese e Professionisti",
          producerName: "Unioncamere",
          link: "https://example.com/eservice/8",
        },
      ],
      totalCount: 9,
    },
    updatedEserviceTemplates: {
      items: [
        {
          name: "Template Anagrafe Nazionale",
          producerName: "Ministero dell'Interno",
          link: "https://example.com/eservice-template/1",
        },
        {
          name: "Template Fatturazione PA",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/eservice-template/2",
        },
        {
          name: "Template Servizi Demografici",
          producerName: "Ministero dell'Interno",
          link: "https://example.com/eservice-template/3",
        },
        {
          name: "Template Pagamenti Telematici",
          producerName: "PagoPA S.p.A.",
          link: "https://example.com/eservice-template/4",
        },
        {
          name: "Template Dati Territoriali",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/eservice-template/5",
        },
        {
          name: "Template Registro Imprese",
          producerName: "Unioncamere",
          link: "https://example.com/eservice-template/6",
        },
      ],
      totalCount: 7,
    },
    acceptedSentAgreements: {
      items: [
        {
          name: "Richiesta Dati Anagrafici",
          producerName: "Comune di Roma",
          link: "https://example.com/agreement/1",
        },
        {
          name: "Accesso API Pagamenti",
          producerName: "PagoPA S.p.A.",
          link: "https://example.com/agreement/2",
        },
        {
          name: "Consultazione Dati Catastali",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/agreement/6",
        },
        {
          name: "Accesso Registro Imprese",
          producerName: "Unioncamere",
          link: "https://example.com/agreement/7",
        },
        {
          name: "Servizi di Mobilita",
          producerName: "Comune di Milano",
          link: "https://example.com/agreement/8",
        },
      ],
      totalCount: 7,
    },
    rejectedSentAgreements: {
      items: [
        {
          name: "Servizio Test Rifiutato",
          producerName: "Ente Test",
          link: "https://example.com/agreement/3",
        },
        {
          name: "Servizio Dati Rifiutato",
          producerName: "Comune di Torino",
          link: "https://example.com/agreement/9",
        },
        {
          name: "API Pagamenti Rifiutata",
          producerName: "Ente Pagamenti",
          link: "https://example.com/agreement/10",
        },
        {
          name: "Servizio Mobilita Rifiutato",
          producerName: "Comune di Napoli",
          link: "https://example.com/agreement/11",
        },
        {
          name: "Servizio Anagrafe Rifiutato",
          producerName: "Comune di Bologna",
          link: "https://example.com/agreement/12",
        },
      ],
      totalCount: 7,
    },
    suspendedSentAgreements: {
      items: [
        {
          name: "Servizio Sospeso",
          producerName: "Ente Sospeso",
          link: "https://example.com/agreement/4",
        },
        {
          name: "Servizio Catasto Sospeso",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/agreement/13",
        },
        {
          name: "API Imprese Sospesa",
          producerName: "Unioncamere",
          link: "https://example.com/agreement/14",
        },
        {
          name: "Servizio Pagamenti Sospeso",
          producerName: "PagoPA S.p.A.",
          link: "https://example.com/agreement/15",
        },
        {
          name: "Servizio Trasporti Sospeso",
          producerName: "Comune di Genova",
          link: "https://example.com/agreement/16",
        },
      ],
      totalCount: 7,
    },
    publishedSentPurposes: {
      items: [
        {
          name: "Finalità Gestione Utenti",
          producerName: "Sistema Centrale",
          link: "https://example.com/purpose/1",
        },
        {
          name: "Finalità Accesso Servizi",
          producerName: "Comune di Roma",
          link: "https://example.com/purpose/6",
        },
        {
          name: "Finalità Gestione Pagamenti",
          producerName: "PagoPA S.p.A.",
          link: "https://example.com/purpose/7",
        },
        {
          name: "Finalità Consultazione Dati",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/purpose/8",
        },
        {
          name: "Finalità Servizi Territoriali",
          producerName: "Regione Lazio",
          link: "https://example.com/purpose/9",
        },
      ],
      totalCount: 7,
    },
    rejectedSentPurposes: {
      items: [
        {
          name: "Finalità Rifiutata",
          producerName: "Ente Rifiutante",
          link: "https://example.com/purpose/2",
        },
        {
          name: "Finalità Dati Rifiutata",
          producerName: "Comune di Torino",
          link: "https://example.com/purpose/10",
        },
        {
          name: "Finalità Pagamenti Rifiutata",
          producerName: "Ente Pagamenti",
          link: "https://example.com/purpose/11",
        },
        {
          name: "Finalità Mobilita Rifiutata",
          producerName: "Comune di Napoli",
          link: "https://example.com/purpose/12",
        },
        {
          name: "Finalità Anagrafe Rifiutata",
          producerName: "Comune di Bologna",
          link: "https://example.com/purpose/13",
        },
      ],
      totalCount: 7,
    },
    waitingForApprovalSentPurposes: {
      items: [
        {
          name: "Finalità In Attesa",
          producerName: "Ente Erogatore",
          link: "https://example.com/purpose/3",
        },
        {
          name: "Finalità Catasto in Attesa",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/purpose/14",
        },
        {
          name: "Finalità Imprese in Attesa",
          producerName: "Unioncamere",
          link: "https://example.com/purpose/15",
        },
        {
          name: "Finalità Pagamenti in Attesa",
          producerName: "PagoPA S.p.A.",
          link: "https://example.com/purpose/16",
        },
        {
          name: "Finalità Trasporti in Attesa",
          producerName: "Comune di Genova",
          link: "https://example.com/purpose/17",
        },
      ],
      totalCount: 7,
    },
    waitingForApprovalReceivedAgreements: {
      items: [
        {
          name: "Richiesta in Attesa",
          producerName: "Ente Richiedente",
          link: "https://example.com/agreement/5",
        },
        {
          name: "Richiesta Dati in Attesa",
          producerName: "Comune di Torino",
          link: "https://example.com/agreement/17",
        },
        {
          name: "Richiesta Pagamenti in Attesa",
          producerName: "Ente Pagamenti",
          link: "https://example.com/agreement/18",
        },
        {
          name: "Richiesta Mobilita in Attesa",
          producerName: "Comune di Napoli",
          link: "https://example.com/agreement/19",
        },
        {
          name: "Richiesta Anagrafe in Attesa",
          producerName: "Comune di Bologna",
          link: "https://example.com/agreement/20",
        },
      ],
      totalCount: 7,
    },
    publishedReceivedPurposes: {
      items: [
        {
          name: "Finalità Ricevuta",
          producerName: "Ente Fruitore",
          link: "https://example.com/purpose/4",
          consumerName: "Ente Fruitore",
        },
        {
          name: "Finalità Dati Ricevuta",
          producerName: "Comune di Torino",
          link: "https://example.com/purpose/18",
          consumerName: "Comune di Torino",
        },
        {
          name: "Finalità Pagamenti Ricevuta",
          producerName: "Ente Pagamenti",
          link: "https://example.com/purpose/19",
          consumerName: "Ente Pagamenti",
        },
        {
          name: "Finalità Mobilita Ricevuta",
          producerName: "Comune di Napoli",
          link: "https://example.com/purpose/20",
          consumerName: "Comune di Napoli",
        },
        {
          name: "Finalità Anagrafe Ricevuta",
          producerName: "Comune di Bologna",
          link: "https://example.com/purpose/21",
          consumerName: "Comune di Bologna",
        },
      ],
      totalCount: 7,
    },
    waitingForApprovalReceivedPurposes: {
      items: [
        {
          name: "Finalità in Attesa di Approvazione",
          producerName: "Ente in Attesa",
          link: "https://example.com/purpose/5",
          consumerName: "Ente in Attesa",
        },
        {
          name: "Finalità Dati in Attesa",
          producerName: "Comune di Torino",
          link: "https://example.com/purpose/22",
          consumerName: "Comune di Torino",
        },
        {
          name: "Finalità Pagamenti in Attesa",
          producerName: "Ente Pagamenti",
          link: "https://example.com/purpose/23",
          consumerName: "Ente Pagamenti",
        },
        {
          name: "Finalità Mobilita in Attesa",
          producerName: "Comune di Napoli",
          link: "https://example.com/purpose/24",
          consumerName: "Comune di Napoli",
        },
        {
          name: "Finalità Anagrafe in Attesa",
          producerName: "Comune di Bologna",
          link: "https://example.com/purpose/25",
          consumerName: "Comune di Bologna",
        },
      ],
      totalCount: 7,
    },
    waitingForApprovalReceivedDelegations: {
      items: [
        {
          name: "Delega in Attesa",
          producerName: "Ente Richiedente Delega",
          link: "https://example.com/delegation/3",
          delegationKind: "erogazione",
        },
        {
          name: "Delega Dati in Attesa",
          producerName: "Comune di Torino",
          link: "https://example.com/delegation/5",
          delegationKind: "erogazione",
        },
        {
          name: "Delega Pagamenti in Attesa",
          producerName: "Ente Pagamenti",
          link: "https://example.com/delegation/6",
          delegationKind: "fruizione",
        },
        {
          name: "Delega Mobilita in Attesa",
          producerName: "Comune di Napoli",
          link: "https://example.com/delegation/7",
          delegationKind: "erogazione",
        },
        {
          name: "Delega Anagrafe in Attesa",
          producerName: "Comune di Bologna",
          link: "https://example.com/delegation/8",
          delegationKind: "fruizione",
        },
      ],
      totalCount: 7,
    },
    revokedReceivedDelegations: {
      items: [
        {
          name: "Delega Revocata",
          producerName: "Ente Revocante",
          link: "https://example.com/delegation/4",
          delegationKind: "fruizione",
        },
        {
          name: "Delega Dati Revocata",
          producerName: "Comune di Torino",
          link: "https://example.com/delegation/9",
          delegationKind: "erogazione",
        },
        {
          name: "Delega Pagamenti Revocata",
          producerName: "Ente Pagamenti",
          link: "https://example.com/delegation/10",
          delegationKind: "fruizione",
        },
        {
          name: "Delega Mobilita Revocata",
          producerName: "Comune di Napoli",
          link: "https://example.com/delegation/11",
          delegationKind: "erogazione",
        },
        {
          name: "Delega Anagrafe Revocata",
          producerName: "Comune di Bologna",
          link: "https://example.com/delegation/12",
          delegationKind: "fruizione",
        },
      ],
      totalCount: 7,
    },
    receivedAttributes: {
      items: [
        {
          name: "Attributo Certificato Nuovo",
          producerName: "Ente Certificatore",
          link: "https://example.com/attribute/1",
          attributeKind: "certified",
          attributeKindLabel: "(certificato)",
        },
        {
          name: "Attributo Identita Digitale",
          producerName: "AgID",
          link: "https://example.com/attribute/3",
          attributeKind: "certified",
          attributeKindLabel: "(certificato)",
        },
        {
          name: "Attributo Impresa Attiva",
          producerName: "Unioncamere",
          link: "https://example.com/attribute/4",
          attributeKind: "verified",
          attributeKindLabel: "(verificato)",
        },
        {
          name: "Attributo Residenza",
          producerName: "Comune di Roma",
          link: "https://example.com/attribute/5",
          attributeKind: "certified",
          attributeKindLabel: "(certificato)",
        },
        {
          name: "Attributo Professionale",
          producerName: "Ordine Professionale",
          link: "https://example.com/attribute/6",
          attributeKind: "verified",
          attributeKindLabel: "(verificato)",
        },
      ],
      totalCount: 7,
    },
    revokedAttributes: {
      items: [
        {
          name: "Attributo Revocato",
          producerName: "Ente Revocatore",
          link: "https://example.com/attribute/2",
          attributeKind: "verified",
          attributeKindLabel: "(verificato)",
        },
        {
          name: "Attributo Identita Revocato",
          producerName: "AgID",
          link: "https://example.com/attribute/7",
          attributeKind: "certified",
          attributeKindLabel: "(certificato)",
        },
        {
          name: "Attributo Impresa Revocato",
          producerName: "Unioncamere",
          link: "https://example.com/attribute/8",
          attributeKind: "verified",
          attributeKindLabel: "(verificato)",
        },
        {
          name: "Attributo Residenza Revocato",
          producerName: "Comune di Roma",
          link: "https://example.com/attribute/9",
          attributeKind: "certified",
          attributeKindLabel: "(certificato)",
        },
        {
          name: "Attributo Professionale Revocato",
          producerName: "Ordine Professionale",
          link: "https://example.com/attribute/10",
          attributeKind: "verified",
          attributeKindLabel: "(verificato)",
        },
      ],
      totalCount: 7,
    },
    viewAllArchivingProducerLink: "https://example.com/archiving",
    archivingImminentEservices: {
      items: [
        {
          id: "eservice-1",
          eserviceName: "Servizio Anagrafica Nazionale",
          version: "3",
          scope: "Descriptor",
          isEserviceScope: false,
          archivableOn: "05/10/2026",
          link: "https://example.com/eservice/1",
        },
      ],
      totalCount: 1,
    },
    archivingInProgressEservices: {
      items: [
        {
          id: "eservice-6",
          eserviceName: "Servizio Catasto",
          version: "1",
          scope: "EService",
          isEserviceScope: true,
          archivableOn: "20/10/2026",
          link: "https://example.com/eservice/6",
        },
        {
          id: "eservice-2",
          eserviceName: "API Fatturazione Elettronica",
          version: "1",
          scope: "Descriptor",
          isEserviceScope: false,
          archivableOn: "25/10/2026",
          link: "https://example.com/eservice/2",
        },
      ],
      totalCount: 2,
    },
    archivingEserviceScopeCount: 1,
    archivingDescriptorScopeCount: 1,
    archivingConsumerImminentEservices: {
      items: [
        {
          id: "eservice-7",
          eserviceName: "Servizio Pagamenti Fruito",
          version: "2",
          scope: "Descriptor",
          isEserviceScope: false,
          archivableOn: "06/10/2026",
          link: "https://example.com/eservice/7",
        },
        {
          id: "eservice-8",
          eserviceName: "Servizio Residenze Fruito",
          version: "1",
          scope: "EService",
          isEserviceScope: true,
          archivableOn: "07/10/2026",
          link: "https://example.com/eservice/8",
        },
      ],
      totalCount: 2,
    },
    archivingConsumerInProgressEservices: {
      items: [
        {
          id: "eservice-9",
          eserviceName: "Servizio Tributi Fruito",
          version: "4",
          scope: "Descriptor",
          isEserviceScope: false,
          archivableOn: "30/10/2026",
          link: "https://example.com/eservice/9",
        },
        {
          id: "eservice-10",
          eserviceName: "Servizio Anagrafe Fruito",
          version: "2",
          scope: "Descriptor",
          isEserviceScope: false,
          archivableOn: "31/10/2026",
          link: "https://example.com/eservice/10",
        },
        {
          id: "eservice-11",
          eserviceName: "Servizio Catasto Fruito",
          version: "3",
          scope: "Descriptor",
          isEserviceScope: false,
          archivableOn: "02/11/2026",
          link: "https://example.com/eservice/11",
        },
        {
          id: "eservice-12",
          eserviceName: "Servizio Protocollo Fruito",
          version: "1",
          scope: "Descriptor",
          isEserviceScope: false,
          archivableOn: "04/11/2026",
          link: "https://example.com/eservice/12",
        },
        {
          id: "eservice-13",
          eserviceName: "Servizio Notifiche Fruito",
          version: "1",
          scope: "EService",
          isEserviceScope: true,
          archivableOn: "06/11/2026",
          link: "https://example.com/eservice/13",
        },
      ],
      totalCount: 10,
    },
    archivingConsumerEserviceScopeCount: 0,
    archivingConsumerDescriptorScopeCount: 10,
  };
}

/**
 * Returns mock digest data with all sections populated but no extra data (limited data)
 */
export function getMockLimitedTenantDigestData(): TenantDigestData {
  return {
    tenantId: generateId(),
    tenantName: "Mock Tenant Organization",
    notificationSettingsLink: "https://example.com/notification-settings",
    viewAllNewEservicesLink: "https://example.com/eservices/new",
    viewAllUpdatedEservicesLink: "https://example.com/eservices/updated",
    viewAllSentAgreementsLink: "https://example.com/agreements/sent",
    viewAllSentPurposesLink: "https://example.com/purposes/sent",
    viewAllReceivedAgreementsLink: "https://example.com/agreements/received",
    viewAllReceivedPurposesLink: "https://example.com/purposes/received",
    viewAllReceivedDelegationsLink: "https://example.com/delegations/received",
    viewAllAttributesLink: "https://example.com/attributes",
    viewAllUpdatedEserviceTemplatesLink:
      "https://example.com/eservice-templates/updated",
    newEservices: {
      items: [
        {
          name: "Servizio Anagrafica Nazionale",
          producerName: "Ministero dell'Interno",
          link: "https://example.com/eservice/1",
        },
        {
          name: "API Fatturazione Elettronica",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/eservice/2",
        },
        {
          name: "Servizio Consultazione Catasto",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/eservice/3",
        },
        {
          name: "API Registro Imprese",
          producerName: "Unioncamere",
          link: "https://example.com/eservice/4",
        },
        {
          name: "Piattaforma Notifiche Digitali",
          producerName: "PagoPA S.p.A.",
          link: "https://example.com/eservice/5",
        },
        {
          name: "Servizio Mobilita Nazionale",
          producerName: "Ministero delle Infrastrutture e dei Trasporti",
          link: "https://example.com/eservice/6",
        },
      ],
      totalCount: 6,
    },
    updatedEservices: {
      items: [
        {
          name: "Servizio SPID",
          producerName: "AgID",
          link: "https://example.com/eservice/3",
        },
        {
          name: "API Pagamenti Digitali",
          producerName: "PagoPA S.p.A.",
          link: "https://example.com/eservice/4",
        },
        {
          name: "Servizio Dati Territoriali",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/eservice/5",
        },
        {
          name: "API Mobilita Pubblica",
          producerName: "Ministero delle Infrastrutture e dei Trasporti",
          link: "https://example.com/eservice/6",
        },
        {
          name: "Servizio Albo Nazionale",
          producerName: "Ministero della Giustizia",
          link: "https://example.com/eservice/7",
        },
        {
          name: "API Imprese e Professionisti",
          producerName: "Unioncamere",
          link: "https://example.com/eservice/8",
        },
      ],
      totalCount: 6,
    },
    updatedEserviceTemplates: {
      items: [
        {
          name: "Template Anagrafe Nazionale",
          producerName: "Ministero dell'Interno",
          link: "https://example.com/eservice-template/1",
        },
        {
          name: "Template Fatturazione PA",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/eservice-template/2",
        },
        {
          name: "Template Servizi Demografici",
          producerName: "Ministero dell'Interno",
          link: "https://example.com/eservice-template/3",
        },
        {
          name: "Template Pagamenti Telematici",
          producerName: "PagoPA S.p.A.",
          link: "https://example.com/eservice-template/4",
        },
        {
          name: "Template Dati Territoriali",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/eservice-template/5",
        },
        {
          name: "Template Registro Imprese",
          producerName: "Unioncamere",
          link: "https://example.com/eservice-template/6",
        },
      ],
      totalCount: 6,
    },
    acceptedSentAgreements: {
      items: [
        {
          name: "Richiesta Dati Anagrafici",
          producerName: "Comune di Roma",
          link: "https://example.com/agreement/1",
        },
        {
          name: "Accesso API Pagamenti",
          producerName: "PagoPA S.p.A.",
          link: "https://example.com/agreement/2",
        },
        {
          name: "Consultazione Dati Catastali",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/agreement/6",
        },
        {
          name: "Accesso Registro Imprese",
          producerName: "Unioncamere",
          link: "https://example.com/agreement/7",
        },
        {
          name: "Servizi di Mobilita",
          producerName: "Comune di Milano",
          link: "https://example.com/agreement/8",
        },
      ],
      totalCount: 5,
    },
    rejectedSentAgreements: {
      items: [
        {
          name: "Servizio Test Rifiutato",
          producerName: "Ente Test",
          link: "https://example.com/agreement/3",
        },
        {
          name: "Servizio Dati Rifiutato",
          producerName: "Comune di Torino",
          link: "https://example.com/agreement/9",
        },
        {
          name: "API Pagamenti Rifiutata",
          producerName: "Ente Pagamenti",
          link: "https://example.com/agreement/10",
        },
        {
          name: "Servizio Mobilita Rifiutato",
          producerName: "Comune di Napoli",
          link: "https://example.com/agreement/11",
        },
        {
          name: "Servizio Anagrafe Rifiutato",
          producerName: "Comune di Bologna",
          link: "https://example.com/agreement/12",
        },
      ],
      totalCount: 5,
    },
    suspendedSentAgreements: {
      items: [
        {
          name: "Servizio Sospeso",
          producerName: "Ente Sospeso",
          link: "https://example.com/agreement/4",
        },
        {
          name: "Servizio Catasto Sospeso",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/agreement/13",
        },
        {
          name: "API Imprese Sospesa",
          producerName: "Unioncamere",
          link: "https://example.com/agreement/14",
        },
        {
          name: "Servizio Pagamenti Sospeso",
          producerName: "PagoPA S.p.A.",
          link: "https://example.com/agreement/15",
        },
        {
          name: "Servizio Trasporti Sospeso",
          producerName: "Comune di Genova",
          link: "https://example.com/agreement/16",
        },
      ],
      totalCount: 5,
    },
    publishedSentPurposes: {
      items: [
        {
          name: "Finalità Gestione Utenti",
          producerName: "Sistema Centrale",
          link: "https://example.com/purpose/1",
        },
        {
          name: "Finalità Accesso Servizi",
          producerName: "Comune di Roma",
          link: "https://example.com/purpose/6",
        },
        {
          name: "Finalità Gestione Pagamenti",
          producerName: "PagoPA S.p.A.",
          link: "https://example.com/purpose/7",
        },
        {
          name: "Finalità Consultazione Dati",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/purpose/8",
        },
        {
          name: "Finalità Servizi Territoriali",
          producerName: "Regione Lazio",
          link: "https://example.com/purpose/9",
        },
      ],
      totalCount: 5,
    },
    rejectedSentPurposes: {
      items: [
        {
          name: "Finalità Rifiutata",
          producerName: "Ente Rifiutante",
          link: "https://example.com/purpose/2",
        },
        {
          name: "Finalità Dati Rifiutata",
          producerName: "Comune di Torino",
          link: "https://example.com/purpose/10",
        },
        {
          name: "Finalità Pagamenti Rifiutata",
          producerName: "Ente Pagamenti",
          link: "https://example.com/purpose/11",
        },
        {
          name: "Finalità Mobilita Rifiutata",
          producerName: "Comune di Napoli",
          link: "https://example.com/purpose/12",
        },
        {
          name: "Finalità Anagrafe Rifiutata",
          producerName: "Comune di Bologna",
          link: "https://example.com/purpose/13",
        },
      ],
      totalCount: 5,
    },
    waitingForApprovalSentPurposes: {
      items: [
        {
          name: "Finalità In Attesa",
          producerName: "Ente Erogatore",
          link: "https://example.com/purpose/3",
        },
        {
          name: "Finalità Catasto in Attesa",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/purpose/14",
        },
        {
          name: "Finalità Imprese in Attesa",
          producerName: "Unioncamere",
          link: "https://example.com/purpose/15",
        },
        {
          name: "Finalità Pagamenti in Attesa",
          producerName: "PagoPA S.p.A.",
          link: "https://example.com/purpose/16",
        },
        {
          name: "Finalità Trasporti in Attesa",
          producerName: "Comune di Genova",
          link: "https://example.com/purpose/17",
        },
      ],
      totalCount: 5,
    },
    waitingForApprovalReceivedAgreements: {
      items: [
        {
          name: "Richiesta in Attesa",
          producerName: "Ente Richiedente",
          link: "https://example.com/agreement/5",
        },
        {
          name: "Richiesta Dati in Attesa",
          producerName: "Comune di Torino",
          link: "https://example.com/agreement/17",
        },
        {
          name: "Richiesta Pagamenti in Attesa",
          producerName: "Ente Pagamenti",
          link: "https://example.com/agreement/18",
        },
        {
          name: "Richiesta Mobilita in Attesa",
          producerName: "Comune di Napoli",
          link: "https://example.com/agreement/19",
        },
        {
          name: "Richiesta Anagrafe in Attesa",
          producerName: "Comune di Bologna",
          link: "https://example.com/agreement/20",
        },
      ],
      totalCount: 5,
    },
    publishedReceivedPurposes: {
      items: [
        {
          name: "Finalità Ricevuta",
          producerName: "Ente Fruitore",
          link: "https://example.com/purpose/4",
          consumerName: "Ente Fruitore",
        },
        {
          name: "Finalità Dati Ricevuta",
          producerName: "Comune di Torino",
          link: "https://example.com/purpose/18",
          consumerName: "Comune di Torino",
        },
        {
          name: "Finalità Pagamenti Ricevuta",
          producerName: "Ente Pagamenti",
          link: "https://example.com/purpose/19",
          consumerName: "Ente Pagamenti",
        },
        {
          name: "Finalità Mobilita Ricevuta",
          producerName: "Comune di Napoli",
          link: "https://example.com/purpose/20",
          consumerName: "Comune di Napoli",
        },
        {
          name: "Finalità Anagrafe Ricevuta",
          producerName: "Comune di Bologna",
          link: "https://example.com/purpose/21",
          consumerName: "Comune di Bologna",
        },
      ],
      totalCount: 5,
    },
    waitingForApprovalReceivedPurposes: {
      items: [
        {
          name: "Finalità in Attesa di Approvazione",
          producerName: "Ente in Attesa",
          link: "https://example.com/purpose/5",
          consumerName: "Ente in Attesa",
        },
        {
          name: "Finalità Dati in Attesa",
          producerName: "Comune di Torino",
          link: "https://example.com/purpose/22",
          consumerName: "Comune di Torino",
        },
        {
          name: "Finalità Pagamenti in Attesa",
          producerName: "Ente Pagamenti",
          link: "https://example.com/purpose/23",
          consumerName: "Ente Pagamenti",
        },
        {
          name: "Finalità Mobilita in Attesa",
          producerName: "Comune di Napoli",
          link: "https://example.com/purpose/24",
          consumerName: "Comune di Napoli",
        },
        {
          name: "Finalità Anagrafe in Attesa",
          producerName: "Comune di Bologna",
          link: "https://example.com/purpose/25",
          consumerName: "Comune di Bologna",
        },
      ],
      totalCount: 5,
    },
    waitingForApprovalReceivedDelegations: {
      items: [
        {
          name: "Delega in Attesa",
          producerName: "Ente Richiedente Delega",
          link: "https://example.com/delegation/3",
          delegationKind: "erogazione",
        },
        {
          name: "Delega Dati in Attesa",
          producerName: "Comune di Torino",
          link: "https://example.com/delegation/5",
          delegationKind: "erogazione",
        },
        {
          name: "Delega Pagamenti in Attesa",
          producerName: "Ente Pagamenti",
          link: "https://example.com/delegation/6",
          delegationKind: "fruizione",
        },
        {
          name: "Delega Mobilita in Attesa",
          producerName: "Comune di Napoli",
          link: "https://example.com/delegation/7",
          delegationKind: "erogazione",
        },
        {
          name: "Delega Anagrafe in Attesa",
          producerName: "Comune di Bologna",
          link: "https://example.com/delegation/8",
          delegationKind: "fruizione",
        },
      ],
      totalCount: 5,
    },
    revokedReceivedDelegations: {
      items: [
        {
          name: "Delega Revocata",
          producerName: "Ente Revocante",
          link: "https://example.com/delegation/4",
          delegationKind: "fruizione",
        },
        {
          name: "Delega Dati Revocata",
          producerName: "Comune di Torino",
          link: "https://example.com/delegation/9",
          delegationKind: "erogazione",
        },
        {
          name: "Delega Pagamenti Revocata",
          producerName: "Ente Pagamenti",
          link: "https://example.com/delegation/10",
          delegationKind: "fruizione",
        },
        {
          name: "Delega Mobilita Revocata",
          producerName: "Comune di Napoli",
          link: "https://example.com/delegation/11",
          delegationKind: "erogazione",
        },
        {
          name: "Delega Anagrafe Revocata",
          producerName: "Comune di Bologna",
          link: "https://example.com/delegation/12",
          delegationKind: "fruizione",
        },
      ],
      totalCount: 5,
    },
    receivedAttributes: {
      items: [
        {
          name: "Attributo Certificato Nuovo",
          producerName: "Ente Certificatore",
          link: "https://example.com/attribute/1",
          attributeKind: "certified",
          attributeKindLabel: "(certificato)",
        },
        {
          name: "Attributo Identita Digitale",
          producerName: "AgID",
          link: "https://example.com/attribute/3",
          attributeKind: "certified",
          attributeKindLabel: "(certificato)",
        },
        {
          name: "Attributo Impresa Attiva",
          producerName: "Unioncamere",
          link: "https://example.com/attribute/4",
          attributeKind: "verified",
          attributeKindLabel: "(verificato)",
        },
        {
          name: "Attributo Residenza",
          producerName: "Comune di Roma",
          link: "https://example.com/attribute/5",
          attributeKind: "certified",
          attributeKindLabel: "(certificato)",
        },
        {
          name: "Attributo Professionale",
          producerName: "Ordine Professionale",
          link: "https://example.com/attribute/6",
          attributeKind: "verified",
          attributeKindLabel: "(verificato)",
        },
      ],
      totalCount: 5,
    },
    revokedAttributes: {
      items: [
        {
          name: "Attributo Revocato",
          producerName: "Ente Revocatore",
          link: "https://example.com/attribute/2",
          attributeKind: "verified",
          attributeKindLabel: "(verificato)",
        },
        {
          name: "Attributo Identita Revocato",
          producerName: "AgID",
          link: "https://example.com/attribute/7",
          attributeKind: "certified",
          attributeKindLabel: "(certificato)",
        },
        {
          name: "Attributo Impresa Revocato",
          producerName: "Unioncamere",
          link: "https://example.com/attribute/8",
          attributeKind: "verified",
          attributeKindLabel: "(verificato)",
        },
        {
          name: "Attributo Residenza Revocato",
          producerName: "Comune di Roma",
          link: "https://example.com/attribute/9",
          attributeKind: "certified",
          attributeKindLabel: "(certificato)",
        },
        {
          name: "Attributo Professionale Revocato",
          producerName: "Ordine Professionale",
          link: "https://example.com/attribute/10",
          attributeKind: "verified",
          attributeKindLabel: "(verificato)",
        },
      ],
      totalCount: 5,
    },
    viewAllArchivingProducerLink: "https://example.com/archiving",
  };
}

/**
 * Returns mock digest data with only one item per sections populated (Singular Data)
 */
export function getMockSingularTenantDigestData(): TenantDigestData {
  return {
    tenantId: generateId(),
    tenantName: "Mock Tenant Organization",
    notificationSettingsLink: "https://example.com/notification-settings",
    viewAllNewEservicesLink: "https://example.com/eservices/new",
    viewAllUpdatedEservicesLink: "https://example.com/eservices/updated",
    viewAllSentAgreementsLink: "https://example.com/agreements/sent",
    viewAllSentPurposesLink: "https://example.com/purposes/sent",
    viewAllReceivedAgreementsLink: "https://example.com/agreements/received",
    viewAllReceivedPurposesLink: "https://example.com/purposes/received",
    viewAllReceivedDelegationsLink: "https://example.com/delegations/received",
    viewAllAttributesLink: "https://example.com/attributes",
    viewAllUpdatedEserviceTemplatesLink:
      "https://example.com/eservice-templates/updated",
    newEservices: {
      items: [
        {
          name: "Servizio Anagrafica Nazionale",
          producerName: "Ministero dell'Interno",
          link: "https://example.com/eservice/1",
        },
      ],
      totalCount: 1,
    },
    updatedEservices: {
      items: [
        {
          name: "Servizio SPID",
          producerName: "AgID",
          link: "https://example.com/eservice/3",
        },
      ],
      totalCount: 1,
    },
    updatedEserviceTemplates: {
      items: [
        {
          name: "Template Anagrafe Nazionale",
          producerName: "Ministero dell'Interno",
          link: "https://example.com/eservice-template/1",
        },
      ],
      totalCount: 1,
    },
    acceptedSentAgreements: {
      items: [
        {
          name: "Richiesta Dati Anagrafici",
          producerName: "Comune di Roma",
          link: "https://example.com/agreement/1",
        },
      ],
      totalCount: 1,
    },
    rejectedSentAgreements: {
      items: [
        {
          name: "Servizio Test Rifiutato",
          producerName: "Ente Test",
          link: "https://example.com/agreement/3",
        },
      ],
      totalCount: 1,
    },
    suspendedSentAgreements: {
      items: [
        {
          name: "Servizio Sospeso",
          producerName: "Ente Sospeso",
          link: "https://example.com/agreement/4",
        },
      ],
      totalCount: 1,
    },
    publishedSentPurposes: {
      items: [
        {
          name: "Finalità Gestione Utenti",
          producerName: "Sistema Centrale",
          link: "https://example.com/purpose/1",
        },
      ],
      totalCount: 1,
    },
    rejectedSentPurposes: {
      items: [
        {
          name: "Finalità Rifiutata",
          producerName: "Ente Rifiutante",
          link: "https://example.com/purpose/2",
        },
      ],
      totalCount: 1,
    },
    waitingForApprovalSentPurposes: {
      items: [
        {
          name: "Finalità In Attesa",
          producerName: "Ente Erogatore",
          link: "https://example.com/purpose/3",
        },
      ],
      totalCount: 1,
    },
    waitingForApprovalReceivedAgreements: {
      items: [
        {
          name: "Richiesta in Attesa",
          producerName: "Ente Richiedente",
          link: "https://example.com/agreement/5",
        },
      ],
      totalCount: 1,
    },
    publishedReceivedPurposes: {
      items: [
        {
          name: "Finalità Ricevuta",
          producerName: "Ente Fruitore",
          link: "https://example.com/purpose/4",
          consumerName: "Ente Fruitore",
        },
      ],
      totalCount: 1,
    },
    waitingForApprovalReceivedPurposes: {
      items: [
        {
          name: "Finalità in Attesa di Approvazione",
          producerName: "Ente in Attesa",
          link: "https://example.com/purpose/5",
          consumerName: "Ente in Attesa",
        },
      ],
      totalCount: 1,
    },
    waitingForApprovalReceivedDelegations: {
      items: [
        {
          name: "Delega in Attesa",
          producerName: "Ente Richiedente Delega",
          link: "https://example.com/delegation/3",
          delegationKind: "erogazione",
        },
      ],
      totalCount: 1,
    },
    revokedReceivedDelegations: {
      items: [
        {
          name: "Delega Revocata",
          producerName: "Ente Revocante",
          link: "https://example.com/delegation/4",
          delegationKind: "fruizione",
        },
      ],
      totalCount: 1,
    },
    receivedAttributes: {
      items: [
        {
          name: "Attributo Certificato Nuovo",
          producerName: "Ente Certificatore",
          link: "https://example.com/attribute/1",
          attributeKind: "certified",
          attributeKindLabel: "(certificato)",
        },
      ],
      totalCount: 1,
    },
    revokedAttributes: {
      items: [
        {
          name: "Attributo Revocato",
          producerName: "Ente Revocatore",
          link: "https://example.com/attribute/2",
          attributeKind: "verified",
          attributeKindLabel: "(verificato)",
        },
      ],
      totalCount: 1,
    },
    viewAllArchivingProducerLink: "https://example.com/archiving",
    archivingImminentEservices: {
      items: [
        {
          id: "eservice-1",
          eserviceName: "Servizio Anagrafica Nazionale",
          version: "3",
          scope: "Descriptor",
          isEserviceScope: false,
          archivableOn: "05/10/2026",
          link: "https://example.com/eservice/1",
        },
      ],
      totalCount: 1,
    },
    archivingInProgressEservices: {
      items: [
        {
          id: "eservice-6",
          eserviceName: "Servizio Catasto",
          version: "1",
          scope: "EService",
          isEserviceScope: true,
          archivableOn: "20/10/2026",
          link: "https://example.com/eservice/6",
        },
      ],
      totalCount: 1,
    },
    archivingEserviceScopeCount: 1,
    archivingDescriptorScopeCount: 1,
    archivingConsumerImminentEservices: {
      items: [
        {
          id: "eservice-7",
          eserviceName: "Servizio Pagamenti Fruito",
          version: "2",
          scope: "Descriptor",
          isEserviceScope: false,
          archivableOn: "06/10/2026",
          link: "https://example.com/eservice/7",
        },
      ],
      totalCount: 1,
    },
    archivingConsumerInProgressEservices: {
      items: [
        {
          id: "eservice-7",
          eserviceName: "Servizio Pagamenti Fruito",
          version: "2",
          scope: "Descriptor",
          isEserviceScope: false,
          archivableOn: "06/10/2026",
          link: "https://example.com/eservice/7",
        },
      ],
      totalCount: 1,
    },
    archivingConsumerEserviceScopeCount: 0,
    archivingConsumerDescriptorScopeCount: 1,
  };
}

/**
 * Returns mock digest data with only E-services and Attributes sections populated
 * Used to verify that only populated section groups are rendered
 */
export function getMockPartialDigestData(): TenantDigestData {
  return {
    tenantId: generateId(),
    tenantName: "Mock Tenant Organization",
    notificationSettingsLink: "https://example.com/notification-settings",
    viewAllNewEservicesLink: "https://example.com/eservices/new",
    viewAllUpdatedEservicesLink: "https://example.com/eservices/updated",
    viewAllSentAgreementsLink: "https://example.com/agreements/sent",
    viewAllSentPurposesLink: "https://example.com/purposes/sent",
    viewAllReceivedAgreementsLink: "https://example.com/agreements/received",
    viewAllReceivedPurposesLink: "https://example.com/purposes/received",
    viewAllReceivedDelegationsLink: "https://example.com/delegations/received",
    viewAllAttributesLink: "https://example.com/attributes",
    viewAllUpdatedEserviceTemplatesLink:
      "https://example.com/eservice-templates/updated",
    viewAllArchivingProducerLink: "https://example.com/archiving",
    // E-services section - populated
    newEservices: {
      items: [
        {
          name: "Servizio Anagrafica Nazionale",
          producerName: "Ministero dell'Interno",
          link: "https://example.com/eservice/1",
        },
        {
          name: "API Fatturazione Elettronica",
          producerName: "Agenzia delle Entrate",
          link: "https://example.com/eservice/2",
        },
      ],
      totalCount: 2,
    },
    updatedEservices: {
      items: [
        {
          name: "Servizio SPID",
          producerName: "AgID",
          link: "https://example.com/eservice/3",
        },
      ],
      totalCount: 1,
    },
    updatedEserviceTemplates: { items: [], totalCount: 0 },
    // Sent Items section - empty
    acceptedSentAgreements: { items: [], totalCount: 0 },
    rejectedSentAgreements: { items: [], totalCount: 0 },
    suspendedSentAgreements: { items: [], totalCount: 0 },
    publishedSentPurposes: { items: [], totalCount: 0 },
    rejectedSentPurposes: { items: [], totalCount: 0 },
    waitingForApprovalSentPurposes: {
      items: [],
      totalCount: 0,
    },
    // Received Items section - empty
    waitingForApprovalReceivedAgreements: {
      items: [],
      totalCount: 0,
    },
    publishedReceivedPurposes: { items: [], totalCount: 0 },
    waitingForApprovalReceivedPurposes: {
      items: [],
      totalCount: 0,
    },
    // Delegations section - empty
    waitingForApprovalReceivedDelegations: {
      items: [],
      totalCount: 0,
    },
    revokedReceivedDelegations: { items: [], totalCount: 0 },
    // Attributes section - populated
    receivedAttributes: {
      items: [
        {
          name: "Attributo Certificato Nuovo",
          producerName: "Ente Certificatore",
          link: "https://example.com/attribute/1",
          attributeKind: "certified",
          attributeKindLabel: "(certificato)",
        },
      ],
      totalCount: 1,
    },
    revokedAttributes: {
      items: [
        {
          name: "Attributo Revocato",
          producerName: "Ente Revocatore",
          link: "https://example.com/attribute/2",
          attributeKind: "verified",
          attributeKindLabel: "(verificato)",
        },
      ],
      totalCount: 1,
    },
  };
}
