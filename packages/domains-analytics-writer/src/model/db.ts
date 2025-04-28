export const AttributeDbtable = {
  attribute: "attribute",
} as const;

export const DeletingDbTable = {
  attribute_deleting_table: "attribute_deleting_table",
};

export type AttributeDbtable =
  (typeof AttributeDbtable)[keyof typeof AttributeDbtable];

export type DeletingDbTable =
  (typeof DeletingDbTable)[keyof typeof DeletingDbTable];
