import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getWorkspaceInfo } from "../../api/workspace";
import { execCardClass } from "../../constants/designTokens";

export default function IamSetupGuide() {
  const [info, setInfo] = useState(null);
  useEffect(() => { getWorkspaceInfo().then(setInfo).catch(() => {}); }, []);

  const principalArn = info?.numio_principal_arn || "<NUMIO_PRINCIPAL_ARN>";
  const externalId = info?.external_id || "<EXTERNAL_ID>";
  const arnAvailable = !!info?.numio_principal_arn;

  const trustPolicy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [{
      Effect: "Allow",
      Principal: { AWS: principalArn },
      Action: "sts:AssumeRole",
      Condition: { StringEquals: { "sts:ExternalId": externalId } },
    }],
  }, null, 2);

  const permissionsPolicy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [{
      Effect: "Allow",
      Action: [
        "cur:DescribeReportDefinitions",
        "s3:GetObject",
        "s3:ListBucket",
      ],
      Resource: "*",
    }],
  }, null, 2);

  const codeBlock = { background: "var(--bg-inset)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 16px", fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap", overflowX: "auto", color: "var(--text)" };
  const arnDisplay = { background: "var(--bg-inset)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontFamily: "monospace", color: "var(--text)", wordBreak: "break-all" };
  const heading = { fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 };
  const body = { fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 };
  const card = { marginBottom: 16, borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" };

  return (
    <div className="pageContent" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/settings?tab=integrations" style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none" }}>&larr; Back to Integrations</Link>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: "8px 0 4px" }}>IAM Role Setup Guide</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Follow these steps to create a read-only IAM role in your AWS account so Numio can access your cost data.
        </p>
      </div>

      {/* Step 1: Determine Numio's Principal ARN */}
      <section className={execCardClass} style={card}>
        <h2 style={heading}>Step 1: Determine Numio&rsquo;s Principal ARN</h2>
        <p style={{ ...body, marginBottom: 10 }}>
          To connect your AWS account, Numio needs an IAM role that trusts Numio&rsquo;s identity.
          The first thing you need is the ARN (Amazon Resource Name) of the identity Numio runs as.
        </p>

        {arnAvailable ? (
          <div>
            <p style={{ ...body, marginBottom: 8 }}>
              <span style={{ color: "#16a34a", fontWeight: 600 }}>&#10003;</span>{" "}
              Numio detected its principal ARN automatically:
            </p>
            <div style={arnDisplay}>{principalArn}</div>
            <p style={{ ...body, marginTop: 8 }}>
              Use this ARN in the trust policy in Step 3. Proceed to Step 2.
            </p>
          </div>
        ) : (
          <div>
            <p style={{ ...body, marginBottom: 12 }}>
              <span style={{ color: "#d97706", fontWeight: 600 }}>&#9888;</span>{" "}
              Numio could not detect its ARN. This usually means AWS credentials are not configured on the host.
              Follow the instructions for your deployment:
            </p>

            <div style={{ ...body, marginBottom: 14 }}>
              <strong>Running on your laptop (Docker with AWS SSO):</strong>
              <ol style={{ paddingLeft: 20, marginTop: 4 }}>
                <li>Open a terminal and run: <code>aws sso login --profile &lt;your-profile&gt;</code></li>
                <li>Find your ARN: <code>aws sts get-caller-identity --profile &lt;your-profile&gt;</code></li>
                <li>Copy the ARN from the output. For SSO it will look like<br />
                  <code>arn:aws:sts::123456789012:assumed-role/AWSReservedSSO_.../username</code><br />
                  Convert it to the role format: <code>arn:aws:iam::123456789012:role/AWSReservedSSO_...</code><br />
                  (remove the <code>:sts:</code> &#8594; <code>:iam:</code>, <code>assumed-role</code> &#8594; <code>role</code>, drop the <code>/username</code> at the end)
                </li>
                <li>Set it in <code>.env</code>: <code>NUMIO_PRINCIPAL_ARN=arn:aws:iam::...</code></li>
                <li>Restart Numio: <code>docker compose restart backend worker</code></li>
                <li>Refresh this page. The ARN should appear above.</li>
              </ol>
            </div>

            <div style={{ ...body, marginBottom: 14 }}>
              <strong>Running on EC2:</strong>
              <p style={{ marginTop: 4 }}>
                Numio picks up the instance profile automatically. If you see this message,
                check that the EC2 instance has an IAM role attached with <code>sts:AssumeRole</code> permission.
                Then restart the backend and refresh.
              </p>
            </div>

            <div style={{ ...body, marginBottom: 14 }}>
              <strong>Running on ECS:</strong>
              <p style={{ marginTop: 4 }}>
                Numio picks up the task role automatically. If you see this message,
                check that the ECS task definition has a task role with <code>sts:AssumeRole</code> permission.
                Then redeploy the service and refresh.
              </p>
            </div>

            <div style={{ ...body }}>
              <strong>Running on Kubernetes (EKS):</strong>
              <p style={{ marginTop: 4 }}>
                Numio picks up the service account role automatically. If you see this message,
                check that the pod&rsquo;s service account has an IAM role annotation with <code>sts:AssumeRole</code> permission.
                Then restart the pod and refresh.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Step 2: Create the IAM Role */}
      <section className={execCardClass} style={card}>
        <h2 style={heading}>Step 2: Create the IAM Role</h2>
        <ol style={{ ...body, paddingLeft: 20 }}>
          <li>Open the <strong>IAM Console</strong> in your AWS account.</li>
          <li>Go to <strong>Roles</strong> &rarr; <strong>Create role</strong>.</li>
          <li>Select <strong>Custom trust policy</strong> as the trusted entity type.</li>
          <li>Paste the trust policy from Step 3 below.</li>
          <li>Click <strong>Next</strong>, then <strong>Create policy</strong> to attach the permissions from Step 4.</li>
          <li>Name the role (e.g., <code>NumioReadRole</code>) and click <strong>Create role</strong>.</li>
          <li>Copy the <strong>Role ARN</strong> &mdash; you&rsquo;ll need it when registering the account in Numio.</li>
        </ol>
      </section>

      {/* Step 3: Trust Policy */}
      <section className={execCardClass} style={card}>
        <h2 style={heading}>Step 3: Trust Policy</h2>
        <p style={{ ...body, marginBottom: 8 }}>
          This policy allows Numio to assume the role. It uses the ARN from Step 1
          and includes an ExternalId condition to prevent unauthorized access.
        </p>
        <div style={codeBlock}>{trustPolicy}</div>
      </section>

      {/* Step 4: Permissions Policy */}
      <section className={execCardClass} style={card}>
        <h2 style={heading}>Step 4: Permissions Policy</h2>
        <p style={{ ...body, marginBottom: 8 }}>
          Attach this policy to the role. It grants read-only access to CUR report definitions and S3 CUR data.
        </p>
        <div style={codeBlock}>{permissionsPolicy}</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          Tip: For tighter security, scope the S3 Resource to your specific CUR bucket ARN
          (e.g., <code>arn:aws:s3:::my-cur-bucket/*</code>).
        </p>
      </section>

      {/* Step 5: Locate CUR S3 Details */}
      <section className={execCardClass} style={card}>
        <h2 style={heading}>Step 5: Locate Your CUR S3 Details</h2>
        <ol style={{ ...body, paddingLeft: 20 }}>
          <li>Open the <strong>AWS Billing Console</strong>.</li>
          <li>Go to <strong>Cost & Usage Reports</strong> (under Data Exports or Legacy Reports).</li>
          <li>Find your CUR report and note: <strong>Report name</strong>, <strong>S3 bucket</strong>, and <strong>S3 prefix</strong>.</li>
          <li>Enter these values when registering your account in Numio.</li>
        </ol>
        <p style={{ ...body, marginTop: 8 }}>
          <strong>AWS Organizations:</strong> Register the management/payer account.
          Its CUR covers all member accounts in the organization.
        </p>
      </section>

      {/* Step 6: Ensure CUR Is Configured */}
      <section className={execCardClass} style={card}>
        <h2 style={heading}>Step 6: Ensure CUR Is Configured</h2>
        <p style={body}>
          If you haven&rsquo;t set up a CUR export yet:
        </p>
        <ol style={{ ...body, paddingLeft: 20 }}>
          <li>In the Billing Console, go to <strong>Cost & Usage Reports</strong> &rarr; <strong>Create report</strong>.</li>
          <li>Select <strong>Parquet</strong> format and enable <strong>Include resource IDs</strong>.</li>
          <li>Choose an S3 bucket for delivery and note the bucket name and prefix.</li>
          <li>CUR data may take up to <strong>24 hours</strong> to appear after initial configuration.</li>
        </ol>
      </section>

      <div style={{ textAlign: "center", padding: "16px 0" }}>
        <Link to="/settings?tab=integrations" className="btn btn--primary">
          Back to Integrations
        </Link>
      </div>
    </div>
  );
}
