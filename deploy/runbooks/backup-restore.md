# Backup and Restore

The chart creates a daily PostgreSQL `pg_dump` CronJob that writes to `backup.hostPath`.

Verify backup:

```sh
kubectl -n furfriend-finder create job --from=cronjob/furfriend-finder-postgres-backup manual-backup
kubectl -n furfriend-finder logs job/manual-backup
sudo ls -lh /var/backups/furfriend-finder/postgres
```

Restore rehearsal into a safe target database:

```sh
kubectl -n furfriend-finder exec -it statefulset/furfriend-finder-postgresql -- createdb -U furfriend restore_check
kubectl -n furfriend-finder cp /var/backups/furfriend-finder/postgres/BACKUP.sql furfriend-finder-postgresql-0:/tmp/restore.sql
kubectl -n furfriend-finder exec -it statefulset/furfriend-finder-postgresql -- \
  psql -U furfriend -d restore_check -f /tmp/restore.sql
```

VPS-local backups are not full VPS-loss protection. Configure an owner-operated off-VPS copy path, such as object storage, rsync to another host, or scheduled download.
