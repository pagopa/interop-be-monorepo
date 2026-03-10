import {
  genericInternalError,
  Purpose,
  PurposeId,
  purposeVersionState,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  purposeInReadmodelPurpose,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
  purposeVersionSignedDocumentInReadmodelPurpose,
  purposeVersionStampInReadmodelPurpose,
  tenantCertifiedAttributeInReadmodelTenant,
  tenantDeclaredAttributeInReadmodelTenant,
  tenantInReadmodelTenant,
  tenantVerifiedAttributeInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  aggregatePurposeArray,
  toPurposeAggregatorArray,
} from "pagopa-interop-readmodel";
import { Purpose as CustomPurpose } from "../models/purposeModel.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL(readModelDB: DrizzleReturnType) {
  return {
    async getSENDPurposes(
      pnEServiceId: string,
      comuniAttributeId: string
    ): Promise<CustomPurpose[]> {
      const subquery = readModelDB
        .select({
          purposeId: purposeInReadmodelPurpose.id,
        })
        .from(purposeInReadmodelPurpose)
        .innerJoin(
          purposeVersionInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            purposeVersionInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          tenantDeclaredAttributeInReadmodelTenant,
          eq(
            purposeInReadmodelPurpose.consumerId,
            tenantDeclaredAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          tenantCertifiedAttributeInReadmodelTenant,
          eq(
            purposeInReadmodelPurpose.consumerId,
            tenantCertifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          tenantVerifiedAttributeInReadmodelTenant,
          eq(
            purposeInReadmodelPurpose.consumerId,
            tenantVerifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .where(
          and(
            eq(purposeInReadmodelPurpose.eserviceId, pnEServiceId),
            inArray(purposeVersionInReadmodelPurpose.state, [
              purposeVersionState.active,
              purposeVersionState.suspended,
              purposeVersionState.waitingForApproval,
            ]),
            or(
              eq(
                tenantDeclaredAttributeInReadmodelTenant.attributeId,
                comuniAttributeId
              ),
              eq(
                tenantCertifiedAttributeInReadmodelTenant.attributeId,
                comuniAttributeId
              ),
              eq(
                tenantVerifiedAttributeInReadmodelTenant.attributeId,
                comuniAttributeId
              )
            )
          )
        )
        .as("subquery");

      const queryResult = await readModelDB
        .select({
          purpose: purposeInReadmodelPurpose,
          purposeVersion: purposeVersionInReadmodelPurpose,
          purposeVersionDocument: purposeVersionDocumentInReadmodelPurpose,
          purposeVersionSignedDocument:
            purposeVersionSignedDocumentInReadmodelPurpose,
          purposeVersionStamp: purposeVersionStampInReadmodelPurpose,
          purposeRiskAnalysisForm: sql<null>`NULL`,
          purposeRiskAnalysisAnswer: sql<null>`NULL`,
          consumerName: tenantInReadmodelTenant.name,
          consumerExternalIdOrigin: tenantInReadmodelTenant.externalIdOrigin,
          consumerExternalIdValue: tenantInReadmodelTenant.externalIdValue,
        })
        .from(purposeInReadmodelPurpose)
        .innerJoin(
          subquery,
          eq(purposeInReadmodelPurpose.id, subquery.purposeId)
        )
        .innerJoin(
          purposeVersionInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            purposeVersionInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          purposeVersionDocumentInReadmodelPurpose,
          eq(
            purposeVersionInReadmodelPurpose.id,
            purposeVersionDocumentInReadmodelPurpose.purposeVersionId
          )
        )
        .leftJoin(
          purposeVersionStampInReadmodelPurpose,
          eq(
            purposeVersionInReadmodelPurpose.id,
            purposeVersionStampInReadmodelPurpose.purposeVersionId
          )
        )
        .leftJoin(
          purposeVersionSignedDocumentInReadmodelPurpose,
          eq(
            purposeVersionInReadmodelPurpose.id,
            purposeVersionSignedDocumentInReadmodelPurpose.purposeVersionId
          )
        )
        .innerJoin(
          tenantInReadmodelTenant,
          eq(purposeInReadmodelPurpose.consumerId, tenantInReadmodelTenant.id)
        );

      const tenantsByPurposeId = new Map<
        PurposeId,
        {
          consumerName: string;
          consumerExternalIdOrigin: string;
          consumerExternalIdValue: string;
        }
      >();

      for (const row of queryResult) {
        const purposeId = unsafeBrandId<PurposeId>(row.purpose.id);
        if (!tenantsByPurposeId.has(purposeId)) {
          tenantsByPurposeId.set(purposeId, {
            consumerName: row.consumerName,
            consumerExternalIdOrigin: row.consumerExternalIdOrigin,
            consumerExternalIdValue: row.consumerExternalIdValue,
          });
        }
      }

      const purposes = aggregatePurposeArray(
        toPurposeAggregatorArray(queryResult)
      );

      const purposeToCustomPurpose = (
        purpose: WithMetadata<Purpose>
      ): CustomPurpose => {
        const consumerData = tenantsByPurposeId.get(purpose.data.id);
        if (!consumerData) {
          throw genericInternalError(
            `No consumer data found for purpose ${purpose.data.id}`
          );
        }

        return {
          id: purpose.data.id,
          versions: purpose.data.versions,
          consumerId: purpose.data.consumerId,
          consumerName: consumerData.consumerName,
          consumerExternalId: {
            origin: consumerData.consumerExternalIdOrigin,
            value: consumerData.consumerExternalIdValue,
          },
        };
      };

      return purposes.map(purposeToCustomPurpose);
    },
  };
}
