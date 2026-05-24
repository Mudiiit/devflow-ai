# Backup and Recovery Runbook

## Scope
This runbook defines production backup and recovery procedures for DevFlow AI services and data stores.

## Assets
- PostgreSQL primary data
- Redis queues and cache snapshots
- Container image versions and environment manifests
- Application secrets and key material

## Backup Policy
- PostgreSQL: full backup daily, WAL/archive every 5 minutes
- Redis: snapshot every 15 minutes for queue recovery
- Object storage: versioning enabled for exported artifacts
- Retention: 35 days rolling, 12 monthly snapshots

## Recovery Objectives
- RPO: 15 minutes
- RTO: 60 minutes

## Restore Procedure
1. Freeze writes by scaling API and worker deployments to zero.
2. Restore PostgreSQL from latest full backup and replay WAL to target timestamp.
3. Restore Redis from the latest compatible snapshot.
4. Rehydrate environment variables and verify encryption key versions.
5. Run smoke checks against health endpoints and queue worker readiness.
6. Scale API/worker back up and monitor error budget for 30 minutes.

## Validation Checklist
- Confirm newest review jobs are present
- Confirm organization settings and billing records are intact
- Confirm webhook delivery resumes
- Confirm queue lag returns below threshold

## Testing Cadence
- Monthly restore drill in staging
- Quarterly game day simulating region-level failure
