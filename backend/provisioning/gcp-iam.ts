import type { GCPServiceAccountKey } from "./types";

const GCP_IAM_API_BASE = "https://iam.googleapis.com/v1";
const GCP_CLOUDRESOURCEMANAGER_API_BASE = "https://cloudresourcemanager.googleapis.com/v1";

export class GCPIAMClient {
  private accessToken: string;
  private projectId: string;

  constructor(accessToken: string, projectId: string) {
    this.accessToken = accessToken;
    this.projectId = projectId;
  }

  async createServiceAccount(accountId: string, displayName: string): Promise<string> {
    const response = await fetch(
      `${GCP_IAM_API_BASE}/projects/${this.projectId}/serviceAccounts`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountId,
          serviceAccount: {
            displayName,
            description: `Service account for Neon database connection - ${displayName}`,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `GCP IAM API error (${response.status}): ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json() as { email: string };
    return data.email;
  }

  async grantDatabaseRole(serviceAccountEmail: string, role: string = "roles/cloudsql.client"): Promise<void> {
    const getResponse = await fetch(
      `${GCP_CLOUDRESOURCEMANAGER_API_BASE}/projects/${this.projectId}:getIamPolicy`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!getResponse.ok) {
      const errorData = await getResponse.json().catch(() => ({}));
      throw new Error(
        `Failed to get IAM policy (${getResponse.status}): ${JSON.stringify(errorData)}`
      );
    }

    const policy = await getResponse.json() as {
      bindings?: Array<{ role: string; members: string[] }>;
    };
    
    const binding = policy.bindings?.find((b: any) => b.role === role);
    const member = `serviceAccount:${serviceAccountEmail}`;

    if (binding) {
      if (!binding.members.includes(member)) {
        binding.members.push(member);
      }
    } else {
      policy.bindings = policy.bindings || [];
      policy.bindings.push({
        role,
        members: [member],
      });
    }

    const setResponse = await fetch(
      `${GCP_CLOUDRESOURCEMANAGER_API_BASE}/projects/${this.projectId}:setIamPolicy`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ policy }),
      }
    );

    if (!setResponse.ok) {
      const errorData = await setResponse.json().catch(() => ({}));
      throw new Error(
        `Failed to set IAM policy (${setResponse.status}): ${JSON.stringify(errorData)}`
      );
    }
  }

  async createServiceAccountKey(serviceAccountEmail: string): Promise<GCPServiceAccountKey> {
    const response = await fetch(
      `${GCP_IAM_API_BASE}/projects/${this.projectId}/serviceAccounts/${serviceAccountEmail}/keys`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE",
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to create service account key (${response.status}): ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json() as { privateKeyData: string };
    const keyData = JSON.parse(Buffer.from(data.privateKeyData, "base64").toString("utf-8"));
    
    return keyData;
  }

  async deleteServiceAccount(serviceAccountEmail: string): Promise<void> {
    const response = await fetch(
      `${GCP_IAM_API_BASE}/projects/${this.projectId}/serviceAccounts/${serviceAccountEmail}`,
      {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to delete service account (${response.status}): ${JSON.stringify(errorData)}`
      );
    }
  }

  static async getAccessTokenFromServiceAccount(serviceAccountKey: GCPServiceAccountKey): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600;

    const header = {
      alg: "RS256",
      typ: "JWT",
    };

    const claimSet = {
      iss: serviceAccountKey.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: serviceAccountKey.token_uri,
      exp: expiry,
      iat: now,
    };

    const base64UrlEncode = (obj: any) => {
      return Buffer.from(JSON.stringify(obj))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
    };

    const headerEncoded = base64UrlEncode(header);
    const claimSetEncoded = base64UrlEncode(claimSet);
    const signatureInput = `${headerEncoded}.${claimSetEncoded}`;

    const { createSign } = await import("crypto");
    const sign = createSign("RSA-SHA256");
    sign.update(signatureInput);
    const signature = sign.sign(serviceAccountKey.private_key, "base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const jwt = `${signatureInput}.${signature}`;

    const response = await fetch(serviceAccountKey.token_uri, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get access token (${response.status}): ${errorText}`);
    }

    const data = await response.json() as { access_token: string };
    return data.access_token;
  }
}
