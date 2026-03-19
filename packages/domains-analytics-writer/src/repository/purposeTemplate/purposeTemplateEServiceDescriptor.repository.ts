/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DBConnection } from "../../db/db.js";
import { createRepository } from "../createRepository.js";
import {
  PurposeTemplateDbTable,
  DeletingDbTable,
} from "../../model/db/index.js";
import {
  PurposeTemplateEServiceDescriptorSchema,
  PurposeTemplateEServiceDescriptorDeletingSchema,
} from "../../model/purposeTemplate/purposeTemplateEserviceDescriptor.js";

export const purposeTemplateEServiceDescriptorRepository = (
  conn: DBConnection
) =>
  createRepository(conn, {
    tableName: PurposeTemplateDbTable.purpose_template_eservice_descriptor,
    schema: PurposeTemplateEServiceDescriptorSchema,
    keyColumns: ["purposeTemplateId", "eserviceId"],
    deleting: {
      deletingTableName:
        DeletingDbTable.purpose_template_eservice_descriptor_deleting_table,
      deletingSchema: PurposeTemplateEServiceDescriptorDeletingSchema,
      deletingKeyColumns: ["purposeTemplateId", "eserviceId", "descriptorId"],
      useIdAsSourceDeleteKey: false,
      physicalDelete: false,
    },
  });
