import { buildHTMLTemplateService } from "pagopa-interop-commons";
import { beforeAll, describe, expect, it } from "vitest";

import { digestTemplateServiceBuilder } from "../src/services/templateService.js";
import { getVisibleSections } from "../src/utils/digestAdmittedRoles.js";
import {
  getMockSingularTenantDigestData,
  getMockTenantDigestData,
} from "./mockUtils.js";

describe("Template Service", () => {
  let compiledHtml: string;
  let compiledText: string;

  beforeAll(() => {
    const htmlTemplateService = buildHTMLTemplateService();
    const digestTemplateService =
      digestTemplateServiceBuilder(htmlTemplateService);
    const mockData = getMockTenantDigestData();
    const visibility = getVisibleSections(["admin"]);

    compiledHtml = digestTemplateService.compileDigestEmail(
      mockData,
      visibility
    );
    compiledText = compiledHtml
      .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  });

  it("Should compile the digest and includes its basic structure", () => {
    expect(compiledHtml).toBeDefined();
    expect(compiledHtml.length).toBeGreaterThan(0);
    expect(compiledHtml).toContain("<!DOCTYPE html>");
    expect(compiledText).toContain("PDND Interoperabilità");
    expect(compiledText).toContain("Il tuo riepilogo settimanale su PDND");
  });

  it("Should render new, updated, and template e-services", () => {
    expect(compiledText).toContain("Nuovi e-service");
    expect(compiledText).toContain("8 nuovi e-service");
    expect(compiledText).toContain("Nuovo e-service 1");

    expect(compiledText).toContain("E-service aggiornati");
    expect(compiledText).toContain("9 e-service di cui sei fruitore");
    expect(compiledText).toContain("E-service aggiornato 1");

    expect(compiledText).toContain("Template e-service aggiornati");
    expect(compiledText).toContain("10 template e-service");
    expect(compiledText).toContain("Template aggiornato 1");

    expect(compiledHtml).toContain("https://example.com/eservices/new");
    expect(compiledHtml).toContain("https://example.com/eservices/updated");
    expect(compiledHtml).toContain("https://example.com/eservice/1");
  });

  it("Should render sent agreements and purposes", () => {
    expect(compiledText).toContain("Richieste di fruizione inoltrate");
    expect(compiledText).toContain("7 richieste di fruizione per:");
    expect(compiledText).toContain("Richiesta approvata 1");
    expect(compiledText).toContain("Sono state rifiutate 8 richieste");
    expect(compiledText).toContain("Richiesta rifiutata 1");
    expect(compiledText).toContain(
      "Sono state sospese 9 richieste di fruizione"
    );
    expect(compiledText).toContain("Richiesta sospesa 1");

    expect(compiledText).toContain("Finalità inoltrate");
    expect(compiledText).toContain("Sono state pubblicate 10 finalità");
    expect(compiledText).toContain("Finalità pubblicata 1");
    expect(compiledText).toContain("Sono state rifiutate 11 finalità");
    expect(compiledText).toContain("Finalità rifiutata 1");
    expect(compiledText).toContain(
      "12 finalità sono in attesa di approvazione:"
    );
    expect(compiledText).toContain("Finalità in attesa di approvazione 1");

    expect(compiledHtml).toContain("https://example.com/agreements/sent");
    expect(compiledHtml).toContain("https://example.com/agreement/1");
  });

  it("Should render received agreements and purposes", () => {
    expect(compiledText).toContain("Richieste di fruizione ricevute");
    expect(compiledText).toContain(
      "Ci sono 7 richieste di fruizione in attesa di approvazione:"
    );
    expect(compiledText).toContain("Richiesta ricevuta 1");
    expect(compiledText).toContain("richiesta da Richiesta ricevuta - Ente 1");

    expect(compiledText).toContain("Finalità ricevute");
    expect(compiledText).toContain(
      "Sono state pubblicate 8 finalità inoltrate al tuo ente:"
    );
    expect(compiledText).toContain("Finalità ricevuta 1");
    expect(compiledText).toContain(
      "Ci sono 9 finalità in attesa di approvazione:"
    );
    expect(compiledText).toContain("Finalità ricevuta in attesa 1");

    expect(compiledHtml).toContain("https://example.com/agreements/received");
    expect(compiledHtml).toContain("https://example.com/purposes/received");
  });

  it("Should render received delegations", () => {
    expect(compiledText).toContain("Deleghe");
    expect(compiledText).toContain("Hai ricevuto 10 richieste");
    expect(compiledText).toContain("Delega in attesa 1");
    expect(compiledText).toContain("Delega in attesa - Ente Richiedente 1");
    expect(compiledText).toContain("Hai ricevuto 11 richieste di delega:");
    expect(compiledText).toContain("Delega revocata 1");
  });

  it("Should render assigned and revoked attributes", () => {
    expect(compiledText).toContain("Attributi");
    expect(compiledText).toContain(
      "Ti sono stati assegnati 12 nuovi attributi:"
    );
    expect(compiledText).toContain("Attributo assegnato 1");
    expect(compiledText).toContain("assegnato da Attributo assegnato - Ente 1");
    expect(compiledText).toContain("Ti sono stati revocati 13 attributi:");
    expect(compiledText).toContain("Attributo revocato 1");
  });

  it("Should render the section alert messages", () => {
    expect(compiledText).toContain("Ora puoi creare almeno una finalità");
    expect(compiledText).toContain("per ogni richiesta approvata.");
    expect(compiledText).toContain("permetti agli enti");
    expect(compiledText).toContain("di attivare la richiesta di fruizione.");
    expect(compiledText).toContain("Approva le richieste");
    expect(compiledText).toContain("inizia a gestire");
    expect(compiledText).toContain("interrompe l'accesso");
  });

  it("Should render the producer archiving section", () => {
    expect(compiledText).toContain("In fase di archiviazione - erogazione");
    expect(compiledText).toContain("1 archiviazioni previste a breve");
    expect(compiledText).toContain("1 e-service in fase di archiviazione");
    expect(compiledText).toContain("1 versioni in fase di archiviazione");

    expect(compiledText).toContain("C'è 1 archiviazione prevista a breve");
    expect(compiledText).toContain(
      "L'archiviazione della versione 3 dell'e-service Servizio Anagrafica Nazionale avverrà il giorno 05/10/2026"
    );

    expect(compiledText).toContain(
      "Ci sono 2 versioni di e-service o e-service in fase di archiviazione"
    );
    expect(compiledText).toContain(
      "L'e-service Servizio Catasto è in fase di archiviazione. L'archiviazione avverrà il giorno 20/10/2026"
    );
    expect(compiledText).toContain(
      "La versione 1 dell'e-service API Fatturazione Elettronica è in fase di archiviazione. L'archiviazione avverrà il giorno 25/10/2026"
    );

    expect(compiledHtml).toContain("https://example.com/archiving");
    expect(compiledHtml).toContain("https://example.com/eservice/6");
  });

  it("should render the consumer archiving section, hiding zero-count stat cards", () => {
    const htmlTemplateService = buildHTMLTemplateService();
    const digestTemplateService =
      digestTemplateServiceBuilder(htmlTemplateService);

    const compiledHtml = digestTemplateService.compileDigestEmail(
      getMockTenantDigestData(),
      getVisibleSections(["security"])
    );

    expect(compiledHtml).toContain("In fase di archiviazione - fruizione");
    expect(compiledHtml).toContain(
      "Ci sono <strong>2 archiviazioni previste a breve</strong>"
    );
    expect(compiledHtml).toContain("Servizio Pagamenti Fruito");
    expect(compiledHtml).toContain("Servizio Residenze Fruito");
    expect(compiledHtml).toContain("06/10/2026");
    expect(compiledHtml).toContain(
      "passa a una nuova versione per continuare a scambiare dati"
    );
    expect(compiledHtml).toContain(
      "Ci sono <strong>10 versioni di e-service o e-service in fase di archiviazione</strong>"
    );
    expect(compiledHtml).toContain("Servizio Tributi Fruito");
    expect(compiledHtml).toContain("E altre <strong>5</strong>.");
    // archivingConsumerEserviceScopeCount is 0: only 2 of the 3 cards are rendered
    expect(compiledHtml.match(/width="50%"/g)?.length).toBe(2);
  });

  it("should use singular texts in the consumer archiving section", () => {
    const htmlTemplateService = buildHTMLTemplateService();
    const digestTemplateService =
      digestTemplateServiceBuilder(htmlTemplateService);

    const compiledHtml = digestTemplateService.compileDigestEmail(
      getMockSingularTenantDigestData(),
      getVisibleSections(["security"])
    );

    expect(compiledHtml).toContain(
      "C'è <strong>1 archiviazione prevista a breve</strong>"
    );
    expect(compiledHtml).toContain(
      "C'è <strong>1 versione di e-service o e-service in fase di archiviazione</strong>"
    );
  });

  it("should not render the consumer archiving section for the api role", () => {
    const htmlTemplateService = buildHTMLTemplateService();
    const digestTemplateService =
      digestTemplateServiceBuilder(htmlTemplateService);

    const compiledHtml = digestTemplateService.compileDigestEmail(
      getMockTenantDigestData(),
      getVisibleSections(["api"])
    );

    expect(compiledHtml).not.toContain("In fase di archiviazione - fruizione");
  });
});
