import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import pg from "pg";

let pool: pg.Pool | undefined;

/** Connection pool reused across warm Lambda invocations. Credentials come from Secrets Manager. */
export async function db(): Promise<pg.Pool> {
  if (pool) return pool;
  const sm = new SecretsManagerClient({});
  const secret = await sm.send(new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN! }));
  const c = JSON.parse(secret.SecretString!) as { host: string; port: number; username: string; password: string; dbname: string };
  pool = new pg.Pool({
    host: c.host,
    port: c.port,
    user: c.username,
    password: c.password,
    database: c.dbname ?? "shelfrelay",
    max: 2,
    ssl: { rejectUnauthorized: true },
  });
  return pool;
}

/** Run fn in a transaction scoped to one organization (sets the RLS tenant). */
export async function withTenant<T>(organizationId: string, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await (await db()).connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
