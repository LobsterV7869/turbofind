import express from 'express';
import { db } from './db';

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use((_request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  next();
});

const sortColumns = {
  price: 'price_azn',
  year: 'year',
  mileage: 'mileage_km',
} as const;

class BadRequestError extends Error {}

function getQueryString(value: unknown, name: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestError(`${name} must be a single value`);
  }

  return value;
}

function getQueryStrings(value: unknown, name: string): string[] {
  if (value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value as string[];
  }
  throw new BadRequestError(`${name} must contain single values`);
}

function parseOptionalNumber(value: unknown, name: string): number | undefined {
  const text = getQueryString(value, name);

  if (text === undefined) {
    return undefined;
  }

  if (text.trim() === '') {
    throw new BadRequestError(`${name} must be numeric`);
  }

  const number = Number(text);
  if (!Number.isFinite(number)) {
    throw new BadRequestError(`${name} must be numeric`);
  }

  return number;
}

function parsePositiveInteger(value: unknown, name: string, defaultValue: number): number {
  const number = parseOptionalNumber(value, name);

  if (number === undefined) {
    return defaultValue;
  }

  if (!Number.isInteger(number) || number < 1) {
    throw new BadRequestError(`${name} must be a positive integer`);
  }

  return number;
}

app.get('/api/cars', (request, response) => {
  try {
    const brand = getQueryString(request.query.brand, 'brand');
    const city = getQueryString(request.query.city, 'city');
    const search = getQueryString(request.query.search, 'search');
    const fuelTypes = getQueryStrings(request.query.fuelType, 'fuelType');
    const transmissions = getQueryStrings(request.query.transmission, 'transmission');
    const minYear = parseOptionalNumber(request.query.minYear, 'minYear');
    const maxYear = parseOptionalNumber(request.query.maxYear, 'maxYear');
    const minPrice = parseOptionalNumber(request.query.minPrice, 'minPrice');
    const maxPrice = parseOptionalNumber(request.query.maxPrice, 'maxPrice');
    const minMileage = parseOptionalNumber(request.query.minMileage, 'minMileage');
    const maxMileage = parseOptionalNumber(request.query.maxMileage, 'maxMileage');
    const page = parsePositiveInteger(request.query.page, 'page', 1);
    const pageSize = Math.min(
      parsePositiveInteger(request.query.pageSize, 'pageSize', 24),
      100,
    );
    const sortBy = getQueryString(request.query.sortBy, 'sortBy') ?? 'year';
    const sortOrder = getQueryString(request.query.sortOrder, 'sortOrder') ?? 'desc';

    if (!(sortBy in sortColumns)) {
      throw new BadRequestError('sortBy must be one of: price, year, mileage');
    }

    if (sortOrder !== 'asc' && sortOrder !== 'desc') {
      throw new BadRequestError('sortOrder must be asc or desc');
    }

    const allowedFuelTypes = new Set(['benzin', 'dizel', 'qaz', 'hibrid', 'elektro']);
    const allowedTransmissions = new Set(['avtomat', 'mexaniki', 'robot', 'variator']);
    if (fuelTypes.some((value) => !allowedFuelTypes.has(value))) {
      throw new BadRequestError('fuelType contains an unsupported value');
    }
    if (transmissions.some((value) => !allowedTransmissions.has(value))) {
      throw new BadRequestError('transmission contains an unsupported value');
    }

    const conditions = ['is_active = 1'];
    const values: Array<string | number> = [];
    const addFilter = (condition: string, value: string | number | undefined) => {
      if (value !== undefined) {
        conditions.push(condition);
        values.push(value);
      }
    };

    addFilter('brand = ?', brand);
    addFilter('city = ?', city);
    addFilter('year >= ?', minYear);
    addFilter('year <= ?', maxYear);
    addFilter('price_azn >= ?', minPrice);
    addFilter('price_azn <= ?', maxPrice);
    addFilter('mileage_km >= ?', minMileage);
    addFilter('mileage_km <= ?', maxMileage);

    if (fuelTypes.length > 0) {
      conditions.push(`fuel_type IN (${fuelTypes.map(() => '?').join(', ')})`);
      values.push(...fuelTypes);
    }
    if (transmissions.length > 0) {
      conditions.push(`transmission IN (${transmissions.map(() => '?').join(', ')})`);
      values.push(...transmissions);
    }

    if (search !== undefined) {
      conditions.push('(title LIKE ? OR brand LIKE ? OR model LIKE ?)');
      const searchValue = `%${search}%`;
      values.push(searchValue, searchValue, searchValue);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const total = db
      .prepare(`SELECT COUNT(*) AS total FROM cars ${whereClause}`)
      .get(...values) as { total: number };
    const sortColumn = sortColumns[sortBy as keyof typeof sortColumns];
    const offset = (page - 1) * pageSize;
    const data = db
      .prepare(
        `SELECT * FROM cars ${whereClause} ORDER BY ${sortColumn} ${sortOrder.toUpperCase()} LIMIT ? OFFSET ?`,
      )
      .all(...values, pageSize, offset);

    response.json({ data, total: total.total, page, pageSize });
  } catch (error) {
    if (error instanceof BadRequestError) {
      response.status(400).json({ error: error.message });
      return;
    }

    throw error;
  }
});

app.get('/api/cars/:id', (request, response) => {
  const car = db
    .prepare('SELECT * FROM cars WHERE turbo_listing_id = ? AND is_active = 1')
    .get(request.params.id);

  if (!car) {
    response.status(404).json({ error: 'Car not found' });
    return;
  }

  response.json(car);
});

app.get('/api/meta/brands', (_request, response) => {
  const rows = db
    .prepare(
      'SELECT DISTINCT brand FROM cars WHERE is_active = 1 AND brand IS NOT NULL ORDER BY brand COLLATE NOCASE ASC',
    )
    .all() as Array<{ brand: string }>;

  response.json(rows.map((row) => row.brand));
});

app.get('/api/meta/cities', (_request, response) => {
  const rows = db
    .prepare(
      'SELECT DISTINCT city FROM cars WHERE is_active = 1 AND city IS NOT NULL ORDER BY city COLLATE NOCASE ASC',
    )
    .all() as Array<{ city: string }>;

  response.json(rows.map((row) => row.city));
});

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`TurboFind server listening on http://localhost:${port}`);
});
