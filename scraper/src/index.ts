import { randomUUID } from 'node:crypto';
import { load } from 'cheerio';
import { db } from '../../server/src/db';

const AUTOS_URL = 'https://turbo.az/autos';

interface CarListing {
  turboListingId: string;
  turboUrl: string;
  title: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  priceAzn: number | null;
  mileageKm: number | null;
  engineVolumeL: number | null;
  fuelType: string | null;
  city: string | null;
  thumbnailUrl: string | null;
}

function parseInteger(value: string): number | null {
  const digits = value.replace(/[^\d]/g, '');
  return digits === '' ? null : Number.parseInt(digits, 10);
}

function parseListing(card: ReturnType<ReturnType<typeof load>>): CarListing | null {
  const relativeUrl = card.find('.products-i__link[href]').first().attr('href');
  const listingId = relativeUrl?.match(/^\/autos\/(\d+)(?:-|$)/)?.[1];

  if (!relativeUrl || !listingId) {
    return null;
  }

  const title = card.find('.products-i__name').first().text().trim();
  const [brand = '', ...modelParts] = title.split(/\s+/);
  const attributes = card
    .find('.products-i__attributes')
    .first()
    .text()
    .split(',')
    .map((part) => part.trim());
  const [yearText = '', engineOrBattery = '', mileageText = ''] = attributes;
  const city = card.find('.products-i__datetime').first().text().split(',')[0]?.trim() || null;
  const isElectric = /kwh/i.test(engineOrBattery);

  return {
    turboListingId: listingId,
    turboUrl: new URL(relativeUrl, AUTOS_URL).toString(),
    title,
    brand: brand || null,
    model: modelParts.join(' ') || null,
    year: parseInteger(yearText),
    priceAzn: parseInteger(card.find('.products-i__price').first().text().replace('₼', '')),
    mileageKm: parseInteger(mileageText.replace(/km/i, '')),
    engineVolumeL: /\bL\b/i.test(engineOrBattery)
      ? Number.parseFloat(engineOrBattery.replace(',', '.'))
      : null,
    fuelType: isElectric ? 'elektro' : null,
    city,
    thumbnailUrl: card.find('.products-i__top img[src]').first().attr('src') ?? null,
  };
}

const upsertCar = db.prepare(`
  INSERT INTO cars (
    id, turbo_listing_id, turbo_url, title, brand, model, year, price_azn,
    mileage_km, engine_volume_l, fuel_type, city, scraped_at, thumbnail_url,
    image_urls, is_active
  ) VALUES (
    @id, @turboListingId, @turboUrl, @title, @brand, @model, @year, @priceAzn,
    @mileageKm, @engineVolumeL, @fuelType, @city, @scrapedAt, @thumbnailUrl,
    @imageUrls, 1
  )
  ON CONFLICT(turbo_listing_id) DO UPDATE SET
    turbo_url = excluded.turbo_url,
    title = excluded.title,
    brand = excluded.brand,
    model = excluded.model,
    year = excluded.year,
    price_azn = excluded.price_azn,
    mileage_km = excluded.mileage_km,
    engine_volume_l = COALESCE(excluded.engine_volume_l, cars.engine_volume_l),
    fuel_type = COALESCE(excluded.fuel_type, cars.fuel_type),
    city = excluded.city,
    scraped_at = excluded.scraped_at,
    thumbnail_url = excluded.thumbnail_url,
    image_urls = excluded.image_urls,
    is_active = 1
`);

interface DetailListing {
  bodyType: string | null;
  color: string | null;
  engineVolumeL: number | null;
  horsepower: number | null;
  fuelType: string | null;
  transmission: string | null;
  drivetrain: string | null;
  seatsCount: number | null;
  condition: string | null;
  ownersCount: number | null;
  description: string | null;
  viewsCount: number | null;
  listedAt: string | null;
}

interface StoredListing {
  turbo_listing_id: string;
  turbo_url: string;
  title: string;
}

const updateDetails = db.prepare(`
  UPDATE cars SET
    body_type = COALESCE(@bodyType, body_type),
    color = COALESCE(@color, color),
    engine_volume_l = COALESCE(@engineVolumeL, engine_volume_l),
    horsepower = COALESCE(@horsepower, horsepower),
    fuel_type = COALESCE(@fuelType, fuel_type),
    transmission = COALESCE(@transmission, transmission),
    drivetrain = COALESCE(@drivetrain, drivetrain),
    seats_count = COALESCE(@seatsCount, seats_count),
    condition = COALESCE(@condition, condition),
    owners_count = COALESCE(@ownersCount, owners_count),
    description = COALESCE(@description, description),
    views_count = COALESCE(@viewsCount, views_count),
    listed_at = COALESCE(@listedAt, listed_at),
    scraped_at = @scrapedAt
  WHERE turbo_listing_id = @turboListingId
`);

function normalizeFuelType(value: string): string | null {
  const normalized = value.toLocaleLowerCase('az');
  if (normalized.includes('benzin')) return 'benzin';
  if (normalized.includes('dizel')) return 'dizel';
  if (normalized.includes('qaz')) return 'qaz';
  if (normalized.includes('hibrid')) return 'hibrid';
  if (normalized.includes('elektro')) return 'elektro';
  return null;
}

function normalizeTransmission(value: string | undefined): string | null {
  const normalized = value?.toLocaleLowerCase('az') ?? '';
  if (normalized.includes('avtomat')) return 'avtomat';
  if (normalized.includes('mexaniki')) return 'mexaniki';
  if (normalized.includes('robot')) return 'robot';
  if (normalized.includes('variator')) return 'variator';
  return null;
}

function normalizeDrivetrain(value: string | undefined): string | null {
  const normalized = value?.toLocaleLowerCase('az') ?? '';
  if (normalized.includes('arxa')) return 'arxa';
  if (normalized.includes('ön')) return 'on';
  if (normalized.includes('tam')) return 'tam';
  return null;
}

function parseDetailPage(html: string): DetailListing {
  const $ = load(html);
  const properties = new Map<string, string>();
  $('.product-properties__i').each((_index, element) => {
    const item = $(element);
    const name = item.find('.product-properties__i-name').first().text().trim();
    const value = item.find('.product-properties__i-value').first().text().trim();
    if (name && value) properties.set(name, value);
  });

  const engine = properties.get('Mühərrik') ?? '';
  const engineVolume = engine.match(/([\d.,]+)\s*L\b/i)?.[1];
  const horsepower = engine.match(/([\d\s]+)\s*a\.g\./i)?.[1];
  const ownerEntry = [...properties.entries()].find(([name]) =>
    name.toLocaleLowerCase('az').includes('sahib'),
  );
  const statistics = $('.product-statistics__i-text')
    .toArray()
    .map((element) => $(element).text().trim());
  const updatedText = statistics.find((text) => text.startsWith('Yeniləndi:'));
  const viewsText = statistics.find((text) => text.startsWith('Baxışların sayı:'));
  const description = $('.product-description__content').first().text().trim();

  return {
    bodyType: properties.get('Ban növü') ?? null,
    color: properties.get('Rəng') ?? null,
    engineVolumeL: engineVolume ? Number.parseFloat(engineVolume.replace(',', '.')) : null,
    horsepower: horsepower ? parseInteger(horsepower) : null,
    fuelType: normalizeFuelType(engine),
    transmission: normalizeTransmission(properties.get('Sürətlər qutusu')),
    drivetrain: normalizeDrivetrain(properties.get('Ötürücü')),
    seatsCount: parseInteger(properties.get('Yerlərin sayı') ?? ''),
    condition: properties.get('Vəziyyəti') ?? null,
    ownersCount: parseInteger(ownerEntry?.[1] ?? ''),
    description: description || null,
    viewsCount: parseInteger(viewsText?.replace('Baxışların sayı:', '') ?? ''),
    listedAt: updatedText?.replace('Yeniləndi:', '').trim() || null,
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function enrichListing(listing: StoredListing): Promise<void> {
  const response = await fetch(listing.turbo_url, {
    headers: { 'user-agent': 'TurboFind/1.0 (+local development scraper)' },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Turbo.az returned ${response.status} ${response.statusText}`);
  }

  updateDetails.run({
    ...parseDetailPage(await response.text()),
    turboListingId: listing.turbo_listing_id,
    scrapedAt: new Date().toISOString(),
  });
}

const MAX_PAGES = 500;

async function fetchListingPage(page: number): Promise<CarListing[]> {
  const pageUrl = page === 1 ? AUTOS_URL : `${AUTOS_URL}?page=${page}`;
  const response = await fetch(pageUrl, {
    headers: {
      'user-agent': 'TurboFind/1.0 (+local development scraper)',
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Turbo.az returned ${response.status} ${response.statusText}`);
  }

  const $ = load(await response.text());
  const listings: CarListing[] = [];
  $('.products-i').each((_index, element) => {
    const listing = parseListing($(element));
    if (listing) listings.push(listing);
  });
  return listings;
}

async function scrapeAutos(): Promise<void> {
  const scrapedAt = new Date().toISOString();
  let savedCount = 0;
  let newCount = 0;
  let existingCount = 0;
  let pagesFetched = 0;
  const currentListingIds = new Set<string>();
  const upsertedIds = new Set<string>();
  const existingListing = db.prepare('SELECT 1 FROM cars WHERE turbo_listing_id = ?');

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const listings = await fetchListingPage(page);
    pagesFetched = page;
    if (listings.length === 0) break;

    const savePage = db.transaction(() => {
      for (const listing of listings) {
        if (upsertedIds.has(listing.turboListingId)) continue;
        if (existingListing.get(listing.turboListingId)) existingCount += 1;
        else newCount += 1;
        upsertedIds.add(listing.turboListingId);
        currentListingIds.add(listing.turboListingId);
      upsertCar.run({
        ...listing,
        id: randomUUID(),
        scrapedAt,
        imageUrls: listing.thumbnailUrl ? JSON.stringify([listing.thumbnailUrl]) : '[]',
      });
        savedCount += 1;
      }
    });
    savePage();

    if (page % 10 === 0) {
      console.log(`Fetched page ${page}: ${currentListingIds.size} unique listings so far.`);
    }
    if (page < MAX_PAGES) await delay(750);
  }

  if (currentListingIds.size === 0) {
    throw new Error('No Turbo.az listing cards were parsed; leaving active rows unchanged');
  }

  const activeListingIds = [...currentListingIds];
  const placeholders = activeListingIds.map(() => '?').join(', ');
  db.transaction(() => {
    db.prepare(
      `UPDATE cars SET is_active = 0
       WHERE is_active = 1
         AND (turbo_listing_id IS NULL OR turbo_listing_id NOT IN (${placeholders}))`,
    ).run(...activeListingIds);
  })();

  console.log(`List scrape complete: ${pagesFetched} pages, ${savedCount} listings (${newCount} new, ${existingCount} existing).`);

  const listings = db
    .prepare(
      `SELECT turbo_listing_id, turbo_url, title FROM cars
       WHERE turbo_listing_id IN (${placeholders}) AND views_count IS NULL`,
    )
    .all(...currentListingIds) as StoredListing[];
  let enrichedCount = 0;
  let failedCount = 0;

  for (const [index, listing] of listings.entries()) {
    try {
      await enrichListing(listing);
      enrichedCount += 1;
      console.log(`Fetched detail ${index + 1}/${listings.length}: ${listing.title}`);
    } catch (error) {
      failedCount += 1;
      console.warn(`Skipped detail ${index + 1}/${listings.length}: ${listing.title}`, error);
    }

    if (index < listings.length - 1) {
      await delay(750);
    }
  }

  console.log(`Detail enrichment complete: ${enrichedCount} enriched, ${failedCount} skipped or failed.`);
}

scrapeAutos()
  .catch((error: unknown) => {
    console.error('Turbo.az scrape failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });
