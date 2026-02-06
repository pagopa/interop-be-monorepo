import { describe, it, expect } from "vitest";
import { buildHTMLTemplateService } from "pagopa-interop-commons";
import { digestTemplateServiceBuilder } from "../src/services/templateService.js";
import { getVisibleSections } from "../src/utils/digestAdmittedRoles.js";
import { getMockTenantDigestData } from "./mockUtils.js";

describe("Template Service", () => {
  it("should compile digest email template with mock data and verify content is present", () => {
    // Arrange
    const htmlTemplateService = buildHTMLTemplateService();
    const digestTemplateService =
      digestTemplateServiceBuilder(htmlTemplateService);
    const mockData = getMockTenantDigestData();
    const visibility = getVisibleSections(["admin"]);

    // Act
    const compiledHtml = digestTemplateService.compileDigestEmail(
      mockData,
      visibility
    );

    // Assert - Verify the HTML was compiled
    expect(compiledHtml).toBeDefined();
    expect(compiledHtml.length).toBeGreaterThan(0);

    // Assert - Verify basic structure
    expect(compiledHtml).toContain("<!DOCTYPE html>");
    expect(compiledHtml).toContain("PDND Interoperabilità");
    expect(compiledHtml).toContain("Riepilogo notifiche");

    // Assert - Verify section headers are present (split across lines in HTML)
    expect(compiledHtml).toContain("Nuovi e-service");
    expect(compiledHtml).toContain("E-service");
    expect(compiledHtml).toContain("aggiornati");
    expect(compiledHtml).toContain("Richieste di fruizione inoltrate");
    expect(compiledHtml).toContain("Finalità inoltrate");
    expect(compiledHtml).toContain("Richieste di fruizione che hai ricevuto");
    expect(compiledHtml).toContain("Finalità che hai ricevuto");
    expect(compiledHtml).toContain("Richieste di delega");
    expect(compiledHtml).toContain("inoltrate come delegante");
    expect(compiledHtml).toContain("ricevute come delegato");
    expect(compiledHtml).toContain("Attributi");

    // Assert - Verify new e-services content
    expect(compiledHtml).toContain("Servizio Anagrafica Nazionale");
    expect(compiledHtml).toContain("Ministero dell&#x27;Interno");
    expect(compiledHtml).toContain("API Fatturazione Elettronica");
    expect(compiledHtml).toContain("Agenzia delle Entrate");
    expect(compiledHtml).toContain("5");
    expect(compiledHtml).toContain("nuovi");

    // Assert - Verify updated e-services content
    expect(compiledHtml).toContain("Servizio SPID");
    expect(compiledHtml).toContain("AgID");
    expect(compiledHtml).toContain("3");

    // Assert - Verify accepted agreements content
    expect(compiledHtml).toContain("Richiesta Dati Anagrafici");
    expect(compiledHtml).toContain("Comune di Roma");
    expect(compiledHtml).toContain("Accesso API Pagamenti");
    expect(compiledHtml).toContain("PagoPA S.p.A.");
    expect(compiledHtml).toContain("2");
    expect(compiledHtml).toContain("richieste");

    // Assert - Verify rejected agreements (singular - totalCount: 1)
    expect(compiledHtml).toContain("Servizio Test Rifiutato");
    expect(compiledHtml).toContain("Ente Test");
    expect(compiledHtml).toContain("rifiutata");

    // Assert - Verify suspended agreements (singular - totalCount: 1)
    expect(compiledHtml).toContain("Servizio Sospeso");
    expect(compiledHtml).toContain("Ente Sospeso");
    expect(compiledHtml).toContain("sospesa");

    // Assert - Verify published purposes (singular - totalCount: 1, producerName is not shown for sent purposes)
    expect(compiledHtml).toContain("Finalità Gestione Utenti");
    expect(compiledHtml).toContain("pubblicata");

    // Assert - Verify rejected purposes
    expect(compiledHtml).toContain("Finalità Rifiutata");
    expect(compiledHtml).toContain("Ente Rifiutante");

    // Assert - Verify waiting for approval received agreements
    expect(compiledHtml).toContain("Richiesta in Attesa");
    expect(compiledHtml).toContain("Ente Richiedente");

    // Assert - Verify received purposes
    expect(compiledHtml).toContain("Finalità Ricevuta");
    expect(compiledHtml).toContain("Ente Fruitore");

    // Assert - Verify waiting for approval purposes
    expect(compiledHtml).toContain("Finalità in Attesa di Approvazione");
    expect(compiledHtml).toContain("Ente in Attesa");

    // Assert - Verify delegations
    expect(compiledHtml).toContain("Delega Attiva");
    expect(compiledHtml).toContain("Ente Delegato");
    expect(compiledHtml).toContain("Delega Rifiutata");
    expect(compiledHtml).toContain("Delega in Attesa");
    expect(compiledHtml).toContain("Delega Revocata");
    expect(compiledHtml).toContain("Ente Revocante");

    // Assert - Verify attributes
    expect(compiledHtml).toContain("Attributo Certificato Nuovo");
    expect(compiledHtml).toContain("Ente Certificatore");
    expect(compiledHtml).toContain("Attributo Revocato");
    expect(compiledHtml).toContain("Ente Revocatore");

    // Assert - Verify alert boxes are present (text split across lines in HTML)
    expect(compiledHtml).toContain("Puoi proseguire");
    expect(compiledHtml).toContain("formulando almeno una finalità");
    expect(compiledHtml).toContain("ciascuna richiesta accettata");
    expect(compiledHtml).toContain("associando almeno un client");
    expect(compiledHtml).toContain("Verifica le");
    expect(compiledHtml).toContain("richieste per permettere");
    expect(compiledHtml).toContain("Fruitori di completare");
    expect(compiledHtml).toContain("finalità per permettere");
    expect(compiledHtml).toContain("Ricorda che la");
    expect(compiledHtml).toContain("rimozione di un attributo");

    // Assert - Verify links are present
    expect(compiledHtml).toContain("https://example.com/eservices/new");
    expect(compiledHtml).toContain("https://example.com/eservices/updated");
    expect(compiledHtml).toContain("https://example.com/agreements/sent");
    expect(compiledHtml).toContain("https://example.com/eservice/1");
    expect(compiledHtml).toContain("https://example.com/agreement/1");

    // Assert - Verify "Visualizza" CTAs are present
    expect(compiledHtml).toContain("Visualizza tutti");
    expect(compiledHtml).toContain("Visualizza tutte");
  });
});
