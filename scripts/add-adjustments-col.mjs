import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL missing'); process.exit(1); }

const conn = await mysql.createConnection(url);
try {
  await conn.query('ALTER TABLE `monthly_snapshots` ADD `adjustmentsJson` text');
  console.log('OK: column added');
} catch (e) {
  console.log('ALTER message:', e.message);
}
const [rows] = await conn.query("SHOW COLUMNS FROM monthly_snapshots LIKE 'adjustmentsJson'");
console.log('Column check:', rows);
await conn.end();
