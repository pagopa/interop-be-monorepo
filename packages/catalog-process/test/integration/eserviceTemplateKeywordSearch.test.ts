import { and, asc, desc, eq, SQL } from "drizzle-orm";
import {
  getMockDescriptor,
  getMockEService,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import {
  DescriptorState,
  EService,
  EServiceId,
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersionState,
  TenantId,
  descriptorState,
  eserviceTemplateVersionState,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  eserviceInReadmodelCatalog,
  eserviceTemplateInReadmodelEserviceTemplate,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import { beforeEach, describe, expect, it } from "vitest";

import {
  eserviceKeywordRelevance,
  eserviceProducerJoin,
  eserviceTemplateKeywordFilter,
  eserviceTemplateKeywordRelevance,
} from "../../src/services/keywordSearch.js";
import { existsAvailableTemplateInstance } from "../../src/services/readModelServiceSQL.js";
import {
  addOneEService,
  addOneEServiceTemplate,
  readModelDB,
} from "../integrationUtils.js";

describe("e-service template keyword search", () => {
  const buildEServiceTemplate = (
    name: string,
    description: string,
    versionState: EServiceTemplateVersionState = eserviceTemplateVersionState.published
  ): EServiceTemplate => ({
    ...getMockEServiceTemplate(undefined, undefined, [
      getMockEServiceTemplateVersion(undefined, versionState),
    ]),
    name,
    description,
  });

  const buildInstance = (
    eserviceTemplate: EServiceTemplate,
    producerId: TenantId = generateId(),
    state: DescriptorState = descriptorState.published
  ): EService => ({
    ...getMockEService(),
    name: eserviceTemplate.name,
    description: eserviceTemplate.description,
    producerId,
    templateId: eserviceTemplate.id,
    descriptors: [{ ...getMockDescriptor(), state }],
  });

  const addTemplateWithInstance = async (
    eserviceTemplate: EServiceTemplate,
    producerId?: TenantId,
    state?: DescriptorState
  ): Promise<void> => {
    await addOneEServiceTemplate(eserviceTemplate);
    await addOneEService(buildInstance(eserviceTemplate, producerId, state));
  };

  const search = (
    keyword: string | undefined,
    instancesCondition?: SQL
  ): Promise<EServiceTemplateId[]> =>
    readModelDB.transaction(async (tx) => {
      const condition = existsAvailableTemplateInstance(tx, instancesCondition);
      const filter = await eserviceTemplateKeywordFilter(
        tx,
        keyword,
        condition
      );
      const rows = await tx
        .select({ id: eserviceTemplateInReadmodelEserviceTemplate.id })
        .from(eserviceTemplateInReadmodelEserviceTemplate)
        .where(and(condition, filter))
        .orderBy(
          ...(keyword === undefined
            ? []
            : [desc(eserviceTemplateKeywordRelevance(keyword))]),
          asc(eserviceTemplateInReadmodelEserviceTemplate.name)
        );
      return rows.map((row) => unsafeBrandId<EServiceTemplateId>(row.id));
    });

  const templateAnagrafe = buildEServiceTemplate(
    "Anagrafe",
    "Consultazione dei dati anagrafici dei cittadini"
  );
  const templateTributi = buildEServiceTemplate(
    "Tributi",
    "Pagamento delle imposte comunali"
  );
  const templateSanita = buildEServiceTemplate(
    "Sanità",
    "Prenotazione delle visite specialistiche"
  );
  const templateCertificati = buildEServiceTemplate(
    "Albo dei certificati",
    "Rilascio dei certificati di stato civile e anagrafe"
  );
  const instancesProducerId: TenantId = generateId();

  beforeEach(async () => {
    await addTemplateWithInstance(templateAnagrafe, instancesProducerId);
    await addTemplateWithInstance(templateTributi);
    await addTemplateWithInstance(templateSanita);
    await addTemplateWithInstance(templateCertificati);
  });

  it("should return every e-service template with available instances when keyword is not set", async () => {
    await addOneEServiceTemplate(
      buildEServiceTemplate("Protocollo", "Protocollo informatico")
    );

    expect(await search(undefined)).toEqual([
      templateCertificati.id,
      templateAnagrafe.id,
      templateSanita.id,
      templateTributi.id,
    ]);
  });

  it("should match the keyword on the e-service template name", async () => {
    expect(await search("tributi")).toEqual([templateTributi.id]);
  });

  it("should match the keyword on the e-service template description", async () => {
    expect(await search("prenotazione")).toEqual([templateSanita.id]);
  });

  it("should fall back to trigram similarity on the e-service template description", async () => {
    const template = buildEServiceTemplate(
      "Protocollo",
      "Protocollo informatico"
    );
    await addTemplateWithInstance(template);

    expect(await search("informatco")).toEqual([template.id]);
  });

  it("should not fall back to trigram similarity when the full text search has a result", async () => {
    await addTemplateWithInstance(
      buildEServiceTemplate("Anagrfe", "Servizio con un nome simile")
    );

    expect(await search("anagrafe")).toEqual([
      templateAnagrafe.id,
      templateCertificati.id,
    ]);
  });

  it("should match all the words of a multi-word keyword", async () => {
    expect(await search("dati anagrafici")).toEqual([templateAnagrafe.id]);
  });

  it.each(["sanità", "SANITÀ", "sanita", "Sanita"])(
    "should ignore case and accents (keyword: '%s')",
    async (keyword) => {
      expect(await search(keyword)).toEqual([templateSanita.id]);
    }
  );

  it("should match the keyword on the Italian stem of the words", async () => {
    expect(await search("tributo")).toEqual([templateTributi.id]);
  });

  it.each(['"dati anagrafici"', "-dati anagrafici", "dati, anagrafici!"])(
    "should ignore quotes, minus signs and punctuation (keyword: '%s')",
    async (keyword) => {
      expect(await search(keyword)).toEqual([templateAnagrafe.id]);
    }
  );

  it("should fall back to trigram similarity when the full text search has no result", async () => {
    expect(await search("anagrfe")).toEqual([templateAnagrafe.id]);
  });

  it("should return no e-service template when nothing matches the keyword", async () => {
    expect(await search("xyzxyz")).toEqual([]);
  });

  it.each(["!!!", "...", "- -"])(
    "should return no e-service template when the keyword normalizes to an empty string (keyword: '%s')",
    async (keyword) => {
      expect(await search(keyword)).toEqual([]);
    }
  );

  it("should order the e-service templates by relevance before name", async () => {
    expect(await search("anagrafe")).toEqual([
      templateAnagrafe.id,
      templateCertificati.id,
    ]);
  });

  it.each(Object.values(eserviceTemplateVersionState))(
    "should match an e-service template with instances in any state (version state: %s)",
    async (versionState) => {
      const template = buildEServiceTemplate(
        "Protocollo",
        "Protocollo informatico",
        versionState
      );
      await addTemplateWithInstance(template);

      expect(await search("protocollo")).toEqual([template.id]);
      expect(await search("protocolo")).toEqual([template.id]);
    }
  );

  it("should not match an e-service template without instances", async () => {
    const template = buildEServiceTemplate(
      "Protocollo",
      "Protocollo informatico"
    );
    await addOneEServiceTemplate(template);

    expect(await search("protocollo")).toEqual([]);
    expect(await search("protocolo")).toEqual([]);
  });

  it("should not match an e-service template whose instances do not satisfy the instances condition", async () => {
    const instancesCondition = eq(
      eserviceInReadmodelCatalog.producerId,
      instancesProducerId
    );

    expect(await search("tributi", instancesCondition)).toEqual([]);
    expect(await search("anagrafe", instancesCondition)).toEqual([
      templateAnagrafe.id,
    ]);
  });

  it("should not match an e-service template whose instances are not visible in the catalog", async () => {
    const template = buildEServiceTemplate(
      "Protocollo",
      "Protocollo informatico"
    );
    await addTemplateWithInstance(template, undefined, descriptorState.draft);

    expect(await search("protocollo")).toEqual([]);
    expect(await search("protocolo")).toEqual([]);
  });

  it("should match an e-service template when at least one of its instances satisfies the instances condition", async () => {
    const template = buildEServiceTemplate(
      "Protocollo",
      "Protocollo informatico"
    );
    await addTemplateWithInstance(template, instancesProducerId);
    await addOneEService(buildInstance(template));
    const instancesCondition = eq(
      eserviceInReadmodelCatalog.producerId,
      instancesProducerId
    );

    expect(await search("protocollo", instancesCondition)).toEqual([
      template.id,
    ]);
  });

  it("should fall back to trigram similarity when the only full text match has no visible instances", async () => {
    await addTemplateWithInstance(
      buildEServiceTemplate("Anagrfe", "Servizio in bozza"),
      undefined,
      descriptorState.draft
    );

    expect(await search("anagrfe")).toEqual([templateAnagrafe.id]);
  });

  it("should fall back to trigram similarity when the only full text match has no available instances", async () => {
    await addOneEServiceTemplate(
      buildEServiceTemplate("Anagrfe", "Servizio senza istanze")
    );

    expect(await search("anagrfe")).toEqual([templateAnagrafe.id]);
  });

  it("should fall back to trigram similarity when the only full text match has no instance that satisfies the instances condition", async () => {
    await addTemplateWithInstance(
      buildEServiceTemplate("Anagrfe", "Servizio di un altro erogatore")
    );
    const instancesCondition = eq(
      eserviceInReadmodelCatalog.producerId,
      instancesProducerId
    );

    expect(await search("anagrfe", instancesCondition)).toEqual([
      templateAnagrafe.id,
    ]);
  });

  it.each(["anagrafe", "dati anagrafici", "anagrfe"])(
    "should give an e-service template the same relevance as an e-service with the same name and description (keyword: '%s')",
    async (keyword) => {
      const eservice: EService = {
        ...buildInstance(templateAnagrafe),
        id: generateId<EServiceId>(),
      };
      await addOneEService(eservice);

      const [templateRelevance] = await readModelDB
        .select({
          relevance: eserviceTemplateKeywordRelevance(keyword).mapWith(Number),
        })
        .from(eserviceTemplateInReadmodelEserviceTemplate)
        .where(
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            templateAnagrafe.id
          )
        );
      const [eserviceRelevance] = await readModelDB
        .select({
          relevance: eserviceKeywordRelevance(keyword).mapWith(Number),
        })
        .from(eserviceInReadmodelCatalog)
        .leftJoin(tenantInReadmodelTenant, eserviceProducerJoin)
        .where(eq(eserviceInReadmodelCatalog.id, eservice.id));

      expect(templateRelevance.relevance).toBeGreaterThan(0);
      expect(templateRelevance.relevance).toBeCloseTo(
        eserviceRelevance.relevance
      );
    }
  );
});
