# pagopa-interop-be-domains-analytics-writer

Node version required >=node18

## Waiting-for-approval reason rollout

Before deploying the writer with `PurposeVersion.waitingForApprovalReason`, apply
an additive Flyway migration in `pagopa/interop-analytics-deployment` for dev, qa
and prod:

```sql
ALTER TABLE domains.purpose_version
  ADD COLUMN waiting_for_approval_reason VARCHAR(2048);
```

The column is nullable. Historical versions remain NULL; no backfill is required.
The writer creates temporary staging tables from the target table at startup,
so the migration must run before deploying the updated writer and KPI checker.
