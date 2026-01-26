import { generateId } from "pagopa-interop-models";
import { TenantDigestData } from "../src/services/digestDataService.js";

export function getMockTenantDigestData(): TenantDigestData {
  return {
    tenantId: generateId(),
    tenantName: "Mock Tenant Organization",
    timePeriod: "1-15 Dicembre 2025",
    viewAllNewEservicesLink: "https://example.com/eservices/new",
    viewAllUpdatedEservicesLink: "https://example.com/eservices/updated",
    viewAllSentAgreementsLink: "https://example.com/agreements/sent",
    viewAllSentPurposesLink: "https://example.com/purposes/sent",
    viewAllReceivedAgreementsLink: "https://example.com/agreements/received",
    viewAllReceivedPurposesLink: "https://example.com/purposes/received",
    viewAllDelegationsLink: "https://example.com/delegations/sent",
    viewAllAttributesLink: "https://example.com/attributes",
    viewAllUpdatedEserviceTemplatesLink:
      "https://example.com/eservice-templates/updated",
    viewAllPopularEserviceTemplatesLink:
      "https://example.com/eservice-templates/popular",
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
      totalCount: 5,
    },
    updatedEservices: {
      items: [
        {
          name: "Servizio SPID",
          producerName: "AgID",
          link: "https://example.com/eservice/3",
        },
      ],
      totalCount: 3,
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
      ],
      totalCount: 4,
    },
    popularEserviceTemplates: {
      items: [
        {
          name: "Template Gestione Documenti",
          producerName: "Mock Tenant Organization",
          link: "https://example.com/eservice-template/3",
        },
        {
          name: "Template Servizi Pagamento",
          producerName: "Mock Tenant Organization",
          link: "https://example.com/eservice-template/4",
        },
        {
          name: "Template API Certificati",
          producerName: "Mock Tenant Organization",
          link: "https://example.com/eservice-template/5",
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
      ],
      totalCount: 2,
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
    suspendedSentPurposes: {
      items: [
        {
          name: "Finalità Sospesa",
          producerName: "Ente Sospendente",
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
        },
      ],
      totalCount: 1,
    },
    activeSentDelegations: {
      items: [
        {
          name: "Delega Attiva",
          producerName: "Ente Delegato",
          link: "https://example.com/delegation/1",
          delegationKind: "producer",
        },
      ],
      totalCount: 1,
    },
    rejectedSentDelegations: {
      items: [
        {
          name: "Delega Rifiutata",
          producerName: "Ente Rifiutante",
          link: "https://example.com/delegation/2",
          delegationKind: "consumer",
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
          delegationKind: "producer",
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
          delegationKind: "consumer",
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
        },
      ],
      totalCount: 1,
    },
  };
}
