# Worked baseline: AWS

A reasonable starting shape for a small AWS project, so a plan does not start from a blank page.
It is not a mandate: every line here is a default the plan may override with a tag. Versions and
service behaviour below are deliberately not pinned, because they change; resolve them when
planning, per section 2 of the rulebook.

## Accounts and state

- One AWS account per environment when the organisation allows it. Account boundaries are the
  only isolation that a wrong IAM policy cannot cross. A single account with per-environment
  prefixes is acceptable for a prototype, recorded as an ADR with that negative consequence.
- State in S3 with versioning, encryption and public access blocked. Locking: recent Terraform and
  OpenTofu releases support S3-native locking (`use_lockfile`); older setups use a DynamoDB table.
  Check what the pinned CLI supports rather than trusting this sentence.
- The state bucket lives in `infra/bootstrap/`, applied once by hand, and is never managed by the
  roots that store state in it.

## Identity

- Humans reach AWS through SSO or short-lived role sessions, never long-lived access keys on a
  laptop. The agent's shell gets the same short-lived credentials, scoped read-only where a plan
  is all it runs.
- CI authenticates with OIDC federation to a role, not stored keys.
- Account ids come from `data "aws_caller_identity"`, never literals.

## Network

- One VPC per environment, spread over at least two availability zones, three for production.
- Public subnets hold load balancers and NAT only. Workloads and data stores sit in private
  subnets.
- NAT: one per zone in production for availability, a single one in non-production for cost.
  Name the trade-off in the plan.

## Data

- Managed databases in private subnets, encrypted, with automated backups and a retention period
  chosen on purpose. Deletion protection on in production.
- Database credentials in Secrets Manager or SSM Parameter Store, generated there or by the
  module, never passed in as a variable from a file.

## Edge

- TLS certificates from ACM. Certificates used by CloudFront must be issued in `us-east-1`
  regardless of where everything else runs; this catches most first-time plans.
- A WAF in front of anything public that accepts input, starting from the managed rule groups.

## Observability

- Logs to CloudWatch with an explicit retention, never the default of forever.
- An alarm on at least: 5xx rate at the load balancer, database CPU and free storage, and a budget
  alarm on the account. A budget alarm is the cheapest guard against a runaway cost.

## Tags

Provider `default_tags` block with the tags from section 6 of the rulebook, so no resource is
missed and no resource repeats them.
