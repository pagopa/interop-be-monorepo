# Personal data database

The initial schema is defined in `migrations/0000_initial.sql` and uses the
`personal_data` schema. For a new database, apply it with PostgreSQL's `psql`:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/personal-data-db-models/migrations/0000_initial.sql
```

The local Docker Compose database runs this script when its volume is first
created. PostgreSQL initialization scripts do not run again on an existing
volume. Applying the SQL in other environments requires the deployment process
and database permissions to be configured separately.
