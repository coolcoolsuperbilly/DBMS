const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '5432';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_NAME = process.env.DB_NAME || 'medicare_hms';

const psqlBase = `psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER}`;

function run(command) {
  try {
    execSync(command, {
      stdio: 'inherit',
      env: { ...process.env, PGPASSWORD: DB_PASSWORD },
    });
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    process.exit(1);
  }
}

function databaseExists() {
  const command = `${psqlBase} -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'"`;
  try {
    const output = execSync(command, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PGPASSWORD: DB_PASSWORD },
    }).toString().trim();
    return output === '1';
  } catch (error) {
    return false;
  }
}

function ensureDatabase() {
  if (!databaseExists()) {
    console.log(`Creating database ${DB_NAME}...`);
    run(`${psqlBase} -d postgres -c "CREATE DATABASE ${DB_NAME};"`);
  } else {
    console.log(`Database ${DB_NAME} already exists.`);
  }
}

function applySql(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing SQL file: ${filePath}`);
  }
  console.log(`Applying ${label} from: ${filePath}...`);
  run(`${psqlBase} -d ${DB_NAME} -f "${filePath}"`);
}

function main() {
  ensureDatabase();

  const candidateSchemaPaths = [
    process.env.SCHEMA_FILE,
    path.join(__dirname, '..', '..', 'database', 'HMS_01_final_BCNF_schema.sql'),
    path.join(__dirname, '..', '..', '..', 'DBMS_OLD', 'DB', 'HMS_01_final_BCNF_schema.sql'),
    path.join(__dirname, '..', 'HMS_01_final_BCNF_schema.sql'),
  ].filter(Boolean);

  const schemaFile = candidateSchemaPaths.find((p) => fs.existsSync(p));
  if (!schemaFile) {
    throw new Error(
      `Could not locate HMS_01_final_BCNF_schema.sql. Checked:\n${candidateSchemaPaths.join('\n')}`
    );
  }

  const modifyFile = path.join(__dirname, '..', 'modify.sql');

  applySql(schemaFile, 'HMS_01_final_BCNF_schema.sql (main BCNF schema)');
  applySql(modifyFile, 'modify.sql (auth + dashboard helpers)');

  console.log('Database initialized successfully with BCNF schema and auth extensions.');
}

main();
