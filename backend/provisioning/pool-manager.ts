import { Pool, PoolConfig } from "pg";
import type { NeonConnectionConfig, SupabaseConnectionConfig } from "./types";

type ConnectionConfig = NeonConnectionConfig | SupabaseConnectionConfig;

export class DatabasePoolManager {
  private pools: Map<string, Pool> = new Map();

  createPool(databaseId: string, config: ConnectionConfig): Pool {
    if (this.pools.has(databaseId)) {
      return this.pools.get(databaseId)!;
    }

    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.sslmode === "require" ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    const pool = new Pool(poolConfig);

    pool.on("error", (err) => {
      console.error(`Unexpected error on idle client for database ${databaseId}:`, err);
    });

    this.pools.set(databaseId, pool);
    return pool;
  }

  getPool(databaseId: string): Pool | undefined {
    return this.pools.get(databaseId);
  }

  async closePool(databaseId: string): Promise<void> {
    const pool = this.pools.get(databaseId);
    if (pool) {
      await pool.end();
      this.pools.delete(databaseId);
    }
  }

  async closeAllPools(): Promise<void> {
    const closePromises = Array.from(this.pools.keys()).map((id) => this.closePool(id));
    await Promise.all(closePromises);
  }

  async testConnection(pool: Pool): Promise<boolean> {
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      return true;
    } catch (error) {
      console.error("Connection test failed:", error);
      return false;
    }
  }
}

export const poolManager = new DatabasePoolManager();
