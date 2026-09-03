import Database from 'better-sqlite3';
import path from 'node:path';

const databaseUrl = process.env.DATABASE_URL ?? 'sqlite://./database.db';
const databasePath = databaseUrl.startsWith('sqlite://')
  ? databaseUrl.slice('sqlite://'.length)
  : databaseUrl;

export const db = new Database(
  databasePath === ':memory:'
    ? ':memory:'
    : path.resolve(__dirname, '..', '..', databasePath),
);

db.exec(`
  CREATE TABLE IF NOT EXISTS cars (
    id TEXT PRIMARY KEY,
    turbo_listing_id TEXT UNIQUE,
    turbo_url TEXT,
    title TEXT,
    brand TEXT,
    model TEXT,
    year INTEGER,
    price_azn INTEGER,
    mileage_km INTEGER,
    engine_volume_l REAL,
    horsepower INTEGER,
    fuel_type TEXT,
    transmission TEXT,
    drivetrain TEXT,
    body_type TEXT,
    color TEXT,
    condition TEXT,
    owners_count INTEGER,
    seats_count INTEGER,
    city TEXT,
    listed_at TEXT,
    description TEXT,
    views_count INTEGER,
    scraped_at TEXT,
    thumbnail_url TEXT,
    image_urls TEXT,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_cars_brand ON cars (brand);
  CREATE INDEX IF NOT EXISTS idx_cars_year ON cars (year);
  CREATE INDEX IF NOT EXISTS idx_cars_price_azn ON cars (price_azn);
  CREATE INDEX IF NOT EXISTS idx_cars_mileage_km ON cars (mileage_km);
  CREATE INDEX IF NOT EXISTS idx_cars_city ON cars (city);
  CREATE INDEX IF NOT EXISTS idx_cars_is_active ON cars (is_active);
`);

const existingColumns = new Set(
  (db.prepare('PRAGMA table_info(cars)').all() as Array<{ name: string }>).map(
    (column) => column.name,
  ),
);

const missingColumns = [
  ['horsepower', 'INTEGER'],
  ['seats_count', 'INTEGER'],
  ['description', 'TEXT'],
  ['views_count', 'INTEGER'],
] as const;

for (const [columnName, columnType] of missingColumns) {
  if (!existingColumns.has(columnName)) {
    db.exec(`ALTER TABLE cars ADD COLUMN ${columnName} ${columnType}`);
  }
}
