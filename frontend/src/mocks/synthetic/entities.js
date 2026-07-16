/**
 * Canonical entities for the synthetic mock data layer (spec §5.1).
 *
 * Defined once here and imported by every domain dataset. Domain datasets MUST
 * source every account, service, region, and date from this registry — no
 * domain dataset defines a parallel entity set. This is what makes the same
 * account / service / region read identically on every screen.
 *
 * All values are fixed constants (not generated), so the canonical set itself
 * is stable across runs. Generated, derived data (costs, counts, timestamps)
 * is produced by the seeded generator in ./seed.js.
 */

/** AWS accounts — valid 12-digit numeric IDs. */
export const ACCOUNTS = [
  { id: "182334512768", alias: "numio-production", environment: "production", primaryRegion: "us-east-1" },
  { id: "274916083355", alias: "numio-staging", environment: "staging", primaryRegion: "us-west-2" },
  { id: "330815562947", alias: "numio-data-platform", environment: "production", primaryRegion: "eu-west-1" },
  { id: "419028374651", alias: "numio-sandbox", environment: "development", primaryRegion: "ap-southeast-1" },
];

/** AWS services — real service names as they appear in Cost and Usage Reports. */
export const SERVICES = [
  { key: "ec2", name: "Amazon Elastic Compute Cloud - Compute" },
  { key: "s3", name: "Amazon Simple Storage Service" },
  { key: "rds", name: "Amazon Relational Database Service" },
  { key: "lambda", name: "AWS Lambda" },
  { key: "cloudfront", name: "Amazon CloudFront" },
  { key: "dynamodb", name: "Amazon DynamoDB" },
  { key: "eks", name: "Amazon Elastic Container Service for Kubernetes" },
  { key: "vpc", name: "Amazon Virtual Private Cloud" },
  { key: "cloudwatch", name: "AmazonCloudWatch" },
  { key: "ebs", name: "Amazon Elastic Block Store" },
];

/** AWS regions — real region codes and display names. */
export const REGIONS = [
  { code: "us-east-1", name: "US East (N. Virginia)" },
  { code: "us-west-2", name: "US West (Oregon)" },
  { code: "eu-west-1", name: "Europe (Ireland)" },
  { code: "ap-southeast-1", name: "Asia Pacific (Singapore)" },
  { code: "eu-central-1", name: "Europe (Frankfurt)" },
];

/**
 * Demo time window — a fixed absolute date range, never derived from the
 * current date, so the demo and tests are reproducible regardless of when they
 * run. Five full months: Jan–May 2026.
 */
export const DEMO_WINDOW = {
  start: "2026-01-01",
  end: "2026-05-31",
  months: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"],
};

// --- lookups ---------------------------------------------------------------

export const accountById = (id) => ACCOUNTS.find((a) => a.id === id) || null;
export const serviceByKey = (key) => SERVICES.find((s) => s.key === key) || null;
export const serviceByName = (name) => SERVICES.find((s) => s.name === name) || null;
export const regionByCode = (code) => REGIONS.find((r) => r.code === code) || null;
