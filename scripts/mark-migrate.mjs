import 'dotenv/config';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import fs from 'fs';
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.query("SHOW TABLES LIKE '__drizzle_migrations'");
console.log('migration table?', rows);
if (rows.length === 0) {
  await conn.query("CREATE TABLE `__drizzle_migrations` (id BIGINT AUTO_INCREMENT PRIMARY KEY, hash VARCHAR(255) NOT NULL UNIQUE, created_at BIGINT)");
  console.log('created table');
}
const sql = fs.readFileSync('drizzle/0008_stiff_maestro.sql','utf8');
const hash = crypto.createHash('sha256').update(sql).digest('hex');
await conn.query("INSERT IGNORE INTO `__drizzle_migrations` (hash, created_at) VALUES (?, ?)", [hash, Date.now()]);
const [list] = await conn.query("SELECT hash, created_at FROM __drizzle_migrations ORDER BY id DESC LIMIT 10");
console.log('recent:', list);
await conn.end();
