/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  Attribute,
  AttributeId,
  Tenant,
  WithMetadata,
  unsafeBrandId,
} from "pagopa-interop-models";
import { inject, vi } from "vitest";
import { InteropContext } from "../src/model/interopContextModel.js";
import { setupTestContainersVitest } from "pagopa-interop-commons-test/index.js";
import {
  tenantReadModelServiceBuilder,
  attributeReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  upsertAttribute,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import { readModelQueriesBuilderSQL } from "../src/service/readModelServiceSQL.js";
import { ISTAT_ATTRIBUTE_SEED } from "../src/config/constants.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilder(readModelDB);

export const readModelService = readModelQueriesBuilderSQL(
  readModelDB,
  tenantReadModelServiceSQL,
  attributeReadModelServiceSQL
);

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await upsertAttribute(readModelDB, attribute, 0);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await upsertTenant(readModelDB, tenant, 0);
};

export const csvFileContent = `"Popolazione residente per età e sesso al 1° gennaio 2026 (stima)"
"Codice comune";"Comune";"Età";"Totale maschi";"Totale femmine";"Totale"
"028001";"Abano Terme";0;60;53;113
"028001";"Abano Terme";1;61;53;114
"028001";"Abano Terme";999;121;106;227
"001002";"Altro Comune";5;10;15;25
"001002";"Altro Comune";999;10;15;25
"003003";"Comune Solo Totale";999;50;50;100
"004004";"Comune Senza Dati";999;0;0;0
"015146";"Milano";0;2000;1950;3950
"015146";"Milano";1;2100;2000;4100
"015146";"Milano";999;650000;700000;1350000
"102050";"Zungri";10;10;10;20
"102050";"Zungri";999;100;100;200
"090001";"Roma Capitale";0;10000;9800;19800
"090001";"Roma Capitale";999;1350000;1450000;2800000
"048017";"Bologna";5;500;480;980
"048017";"Bologna";999;180000;210000;390000`;

const ATTRIBUTE_ISTAT_POPULATION_ID = "c1d64ee0-fda9-48e2-84f8-1b62f1292b99";

export const downloadCSVMock = vi
  .fn()
  .mockImplementation((): Promise<string> => Promise.resolve(csvFileContent));

export const internalAssignCertifiedDiscreteAttributeMock = (
  _tOrigin: string,
  _tRemoteId: string,
  _aOrigin: string,
  _aExternalId: string,
  _value: number,
  _context: InteropContext
): Promise<{ version: number } | undefined> => Promise.resolve({ version: 1 });

export const internalRevokeCertifiedDiscreteAttributeMock = (
  _tOrigin: string,
  _tRemoteId: string,
  _aOrigin: string,
  _aExternalId: string,
  _context: InteropContext
): Promise<{ version: number } | undefined> => Promise.resolve({ version: 1 });

const persistentTenant: Tenant = {
  id: unsafeBrandId("091fbea1-0c8e-411b-988f-5098b6a33ba7"),
  externalId: { origin: "ISTAT", value: "001001" },
  attributes: [],
  features: [],
  createdAt: new Date(),
  mails: [],
  name: "Comune di Prova",
};

export const persistentAttribute: Attribute = {
  id: unsafeBrandId<AttributeId>(ATTRIBUTE_ISTAT_POPULATION_ID),
  origin: ISTAT_ATTRIBUTE_SEED.origin,
  code: ISTAT_ATTRIBUTE_SEED.code,
  name: "Popolazione Residente",
  kind: "Certified",
  creationTime: new Date(),
  description:
    "Attributo certificato discreto indicante la popolazione comunale",
};

export const getTenantsWithDiscreteAttributeMock = (): Promise<
  WithMetadata<Tenant>[]
> =>
  Promise.resolve([
    {
      data: persistentTenant,
      metadata: { version: 1 },
    },
  ]);
