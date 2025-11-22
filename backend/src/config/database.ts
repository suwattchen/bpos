import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from './index';

class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool(config.database);

    this.pool.on('connect', () => {
      console.log('✅ Database connected');
    });

    this.pool.on('error', (err) => {
      console.error('❌ Database connection error:', err);
      process.exit(-1);
    });
  }

  async query(text: string, params?: readonly unknown[]): Promise<QueryResult> {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      if (config.nodeEnv === 'development') {
        console.log('📊 Query:', { text, duration, rows: res.rowCount });
      }
      return res;
    } catch (error) {
      console.error('❌ Database query error:', error);
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async end(): Promise<void> {
    await this.pool.end();
    console.log('Database pool closed');
  }
}

export const db = new Database();
