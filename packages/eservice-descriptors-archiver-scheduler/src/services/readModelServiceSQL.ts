/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  descriptorState,
  unsafeBrandId,
  archivingScope,
} from "pagopa-interop-models";
import { and, eq, inArray, lt } from "drizzle-orm";
import {
  eserviceDescriptorInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  DrizzleReturnType,
  EServiceDescriptorSQL,
  eserviceDescriptorArchivingScheduleInReadmodelCatalog,
  EServiceDescriptorArchivingScheduleSQL,
  EServiceSQL,
} from "pagopa-interop-readmodel-models";
import { RefsToBeArchived } from "../models/models.js";

export function readModelServiceBuilderSQL(readModelDB: DrizzleReturnType) {
  return {
    /**
     * Fetches all expired archivable descriptor references from the database.
     * A descriptor is considered expired and archivable if it has a state of "archiving" or "archivingSuspended"
     * and its archivableOn date is in the past.
     *
     * @returns The array of expired archivable descriptor references
     */
    async getExpiredArchivableDescriptorRefs(): Promise<RefsToBeArchived[]> {
      const queryResult: {
        eservice: EServiceSQL;
        descriptor: EServiceDescriptorSQL;
        archivingSchedule: EServiceDescriptorArchivingScheduleSQL | null;
      }[] = await readModelDB
        .select({
          eservice: eserviceInReadmodelCatalog,
          descriptor: eserviceDescriptorInReadmodelCatalog,
          archivingSchedule:
            eserviceDescriptorArchivingScheduleInReadmodelCatalog,
        })
        .from(eserviceInReadmodelCatalog)
        .where(
          and(
            inArray(eserviceDescriptorInReadmodelCatalog.state, [
              descriptorState.archiving,
              descriptorState.archivingSuspended,
            ]),
            lt(
              // FIXME: convertire in giorno mese anno NO timestamp
              eserviceDescriptorArchivingScheduleInReadmodelCatalog.archivableOn,
              new Date().toISOString()
            ),
            eq(
              eserviceDescriptorArchivingScheduleInReadmodelCatalog.scope,
              archivingScope.descriptor
            )
          )
        )
        .innerJoin(
          eserviceInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceDescriptorInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          eserviceDescriptorArchivingScheduleInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorArchivingScheduleInReadmodelCatalog.descriptorId
          )
        );

      const refs = queryResult.map((row) => row.descriptor);

      const refsToBeArchived: RefsToBeArchived[] = refs.map((descriptor) => ({
        eserviceId: unsafeBrandId(descriptor.eserviceId),
        descriptorId: unsafeBrandId(descriptor.id),
      }));
      return refsToBeArchived;
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
