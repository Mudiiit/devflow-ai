# Incident Response Guide

## Severity Levels
- Sev-1: Production outage, security compromise, or data loss risk
- Sev-2: Major degradation with customer impact
- Sev-3: Minor impact with workaround available

## Detection and Triage
1. Acknowledge alert within 5 minutes.
2. Assign incident commander and operations lead.
3. Open incident channel and start timeline log.
4. Classify severity and impacted services.

## Immediate Containment
- For security events: rotate API keys and revoke affected sessions.
- For abuse spikes: tighten rate limits and block malicious signatures.
- For queue failures: route new jobs to dead-letter protection path.

## Investigation Workflow
1. Collect request IDs and trace IDs from logs.
2. Inspect deployment changes and configuration diffs.
3. Identify blast radius by organization and repository.
4. Apply rollback or hotfix with peer approval.

## Communication
- Update internal status every 15 minutes for Sev-1.
- Post external status updates every 30 minutes for customer-visible incidents.
- Send post-incident summary within 24 hours.

## Recovery and Verification
1. Validate core API, webhook, and worker paths.
2. Verify billing and analytics ingestion resumes.
3. Verify no backlog growth in Redis queues.

## Postmortem Requirements
- Root cause and contributing factors
- Timeline with key decisions
- Corrective actions with owners and due dates
- Detection/prevention improvements
