# Private Certified Attributes Importer

- **Attribute Bootstrapping**: Creates "Adesione dal Registro Imprese" and "Società a Controllo Pubblico" attributes using SHA256-based codes.
- **Dynamic Assignment**: Assigns certified attributes to tenants with `PDND_INFOCAMERE` origin prefix and `SCP` institution types.
- **Sync & Revocation**: Periodically synchronizes the Read Model by assigning missing attributes or revoking them from unauthorized tenants.