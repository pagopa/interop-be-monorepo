export const institutionsFields = [
  "Codice_IPA",
  "Denominazione_ente",
  "Denominazione_aoo",
  "Descrizione_uo",
  "Codice_fiscale_ente",
  "Codice_Categoria",
  "Mail1",
  "Indirizzo",
  "CAP",
  "Tipologia",
  "Codice_uni_aoo",
  "Codice_uni_uo",
] as const;

export type InstitutionsFields = (typeof institutionsFields)[number];

export const categoriesFields = [
  "Codice_categoria",
  "Nome_categoria",
  "Tipologia_categoria",
] as const;

export type CategoriesFields = (typeof categoriesFields)[number];