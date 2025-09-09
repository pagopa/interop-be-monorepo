import {
  AgreementReadModelService,
  CatalogReadModelService,
  TenantReadModelService,
} from "pagopa-interop-readmodel";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  agreementReadModelServiceSQL: _agreementReadModelServiceSQL,
  catalogReadModelServiceSQL: _catalogReadModelServiceSQL,
  tenantReadModelServiceSQL: _tenantReadModelServiceSQL,
}: {
  agreementReadModelServiceSQL: AgreementReadModelService;
  catalogReadModelServiceSQL: CatalogReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
}) {
  return {};
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
