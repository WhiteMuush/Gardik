import { Code, Step, Sub, Warning } from "./parts"

export function AWSGuide() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Gardik connects to AWS IAM Identity Center via the Identity Store API. This works whether your
        identity source is AWS Managed Microsoft AD, an external IdP, or the built-in Identity Center
        directory.
      </p>

      <div className="space-y-4">
        <Step n={1} title="Enable IAM Identity Center">
          <Sub>
            Go to the <strong>AWS Management Console</strong> and open <strong>IAM Identity Center</strong>{" "}
            (search for it in the top bar). If not already enabled, click Enable. IAM Identity Center is a
            free service but must be enabled once per AWS organization.
          </Sub>
          <Warning>
            IAM Identity Center is region-specific. Note the region where you enable it: you must use the same
            region in Gardik.
          </Warning>
        </Step>

        <Step n={2} title="Find the Identity Store ID">
          <Sub>
            In the IAM Identity Center console, go to <strong>Settings</strong>. Under the Identity source
            section, copy the <strong>Identity store ID</strong>. It starts with <Code>d-</Code> followed by
            10 characters (e.g. <Code>d-1234567890</Code>).
          </Sub>
        </Step>

        <Step n={3} title="Create an IAM user for Gardik">
          <Sub>
            Go to <strong>IAM</strong> (not Identity Center) and create a dedicated user for Gardik. Select{" "}
            <em>Programmatic access</em> to get an Access Key ID and Secret Access Key.
          </Sub>
          <Sub>Attach the following inline policy to the user. It grants read-only access to list users:</Sub>
          <div className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground whitespace-pre">{`{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "identitystore:ListUsers",
      "identitystore:DescribeUser"
    ],
    "Resource": "*"
  }]
}`}</div>
        </Step>

        <Step n={4} title="Enter credentials in Gardik">
          <Sub>Access Key ID and Secret Access Key: from the IAM user created in step 3.</Sub>
          <Sub>
            Region: the AWS region where IAM Identity Center is enabled (e.g. <Code>us-east-1</Code>,{" "}
            <Code>eu-west-1</Code>).
          </Sub>
          <Sub>
            Identity Store ID: the <Code>d-</Code> value from step 2.
          </Sub>
        </Step>
      </div>

      <Warning>
        IAM credentials are long-lived. Prefer creating an IAM user with only the two permissions above rather
        than using credentials with broad access. Rotate the access key periodically.
      </Warning>
    </div>
  )
}
