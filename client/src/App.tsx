import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';

const API_BASE_URL = 'http://localhost:3001';
const FALLBACK_IMAGE_URL = 'https://placehold.co/800x600/e5e7eb/6b7280?text=TurboFind';

// Clean filter options - no qaz, robot, variator
const FUEL_TYPES = ['benzin', 'dizel', 'hibrid', 'elektrik'] as const;
const TRANSMISSIONS = ['avtomat', 'mexaniki'] as const;
const RANGE_KEYS = ['minYear', 'maxYear', 'minPrice', 'maxPrice', 'minMileage', 'maxMileage'] as const;

type RangeKey = typeof RANGE_KEYS[number];
type Ranges = Record<RangeKey, string>;

interface Car {
  turbo_listing_id: string;
  turbo_url: string;
  title: string;
  brand: string;
  model: string;
  year: number | null;
  price_azn: number | null;
  mileage_km: number | null;
  engine_volume_l: number | null;
  city: string | null;
  description: string | null;
  image_urls: string | null;
  thumbnail_url: string | null;
  fuel_type?: string | null;
  transmission?: string | null;
  body_type?: string | null;
  color?: string | null;
  drivetrain?: string | null;
  horsepower?: number | null;
  seats_count?: number | null;
  condition?: string | null;
  owners_count?: number | null;
  views_count?: number | null;
  listed_at?: string | null;
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('az-AZ').format(value);
}

function formatPrice(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${formatNumber(value)} ₼`;
}

function CarImage({ car, className }: { car: Car; className?: string }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  let imageUrl = FALLBACK_IMAGE_URL;

  if (!imageError && car.image_urls) {
    try {
      const parsed = JSON.parse(car.image_urls);
      if (Array.isArray(parsed) && parsed.length > 0) {
        imageUrl = parsed[0];
      }
    } catch {
      // Use fallback
    }
  }

  return (
    <img
      src={imageUrl}
      alt={car.title}
      className={className}
      style={{ display: imageLoaded ? 'block' : 'none' }}
      onLoad={() => setImageLoaded(true)}
      onError={() => setImageError(true)}
    />
  );
}

function RangeField({
  label,
  minKey,
  maxKey,
  ranges,
  onChange,
}: {
  label: string;
  minKey: RangeKey;
  maxKey: RangeKey;
  ranges: Ranges;
  onChange: (key: RangeKey, value: string) => void;
}) {
  return (
    <div>
      <span className="block text-sm font-semibold text-slate-700">{label}</span>
      <div className="mt-1 flex gap-2">
        <input
          type="number"
          placeholder="Min"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
          value={ranges[minKey]}
          onChange={(e) => onChange(minKey, e.target.value)}
        />
        <input
          type="number"
          placeholder="Max"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
          value={ranges[maxKey]}
          onChange={(e) => onChange(maxKey, e.target.value)}
        />
      </div>
    </div>
  );
}

function CheckGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const labels: Record<string, string> = {
    benzin: 'Benzin',
    dizel: 'Dizel',
    hibrid: 'Hibrid',
    elektrik: 'Elektrik',
    avtomat: 'Avtomat',
    mexaniki: 'Mexaniki',
  };

  const icons: Record<string, string> = {
    benzin: '⛽',
    dizel: '🛢️',
    hibrid: '🔋',
    elektrik: '⚡',
    avtomat: '🔄',
    mexaniki: '⚙️',
  };

  return (
    <div>
      <span className="block text-sm font-semibold text-slate-700">{label}</span>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm transition hover:border-blue-300 hover:bg-blue-50">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => onToggle(option)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            {icons[option] && <span>{icons[option]}</span>}
            {labels[option] || option}
          </label>
        ))}
      </div>
    </div>
  );
}

function FilterPanel({
  ranges,
  onRangeChange,
  selectedFuel,
  selectedTransmission,
  city,
  cities,
  onToggleFuel,
  onToggleTransmission,
  onCityChange,
  onReset,
}: {
  ranges: Ranges;
  onRangeChange: (key: RangeKey, value: string) => void;
  selectedFuel: string[];
  selectedTransmission: string[];
  city: string;
  cities: string[];
  onToggleFuel: (value: string) => void;
  onToggleTransmission: (value: string) => void;
  onCityChange: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6">
      <RangeField label="İl aralığı" minKey="minYear" maxKey="maxYear" ranges={ranges} onChange={onRangeChange} />
      <RangeField label="Qiymət aralığı (₼)" minKey="minPrice" maxKey="maxPrice" ranges={ranges} onChange={onRangeChange} />
      <RangeField label="Yürüş aralığı (km)" minKey="minMileage" maxKey="maxMileage" ranges={ranges} onChange={onRangeChange} />
      
      <CheckGroup label="Yanacaq növü" options={FUEL_TYPES} selected={selectedFuel} onToggle={onToggleFuel} />
      <CheckGroup label="Sürətlər qutusu" options={TRANSMISSIONS} selected={selectedTransmission} onToggle={onToggleTransmission} />
      
      <label className="block text-sm font-semibold text-slate-700">
        Şəhər
        <select value={city} onChange={(e) => onCityChange(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
          <option value="">Bütün şəhərlər</option>
          {cities.map((cityName) => (
            <option key={cityName} value={cityName}>{cityName}</option>
          ))}
        </select>
      </label>
      
      <button type="button" onClick={onReset} className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-blue-700 hover:to-blue-800 hover:shadow-md">
        🧹 Süzgəcləri sıfırla
      </button>
    </div>
  );
}

function HomePage() {
  const [params, setParams] = useSearchParams();
  const [cars, setCars] = useState<Car[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brands, setBrands] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState(params.get('search') ?? '');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const ranges: Ranges = {
    minYear: params.get('minYear') ?? '',
    maxYear: params.get('maxYear') ?? '',
    minPrice: params.get('minPrice') ?? '',
    maxPrice: params.get('maxPrice') ?? '',
    minMileage: params.get('minMileage') ?? '',
    maxMileage: params.get('maxMileage') ?? '',
  };

  const selectedFuel = params.get('fuel')?.split(',')?.filter(Boolean) ?? [];
  const selectedTransmission = params.get('transmission')?.split(',')?.filter(Boolean) ?? [];
  const city = params.get('city') ?? '';

  const updateSingle = (key: string, value: string) => {
    const newParams = new URLSearchParams(params);
    if (value) newParams.set(key, value);
    else newParams.delete(key);
    setParams(newParams);
  };

  const updateRange = (key: RangeKey, value: string) => {
    const newParams = new URLSearchParams(params);
    if (value) newParams.set(key, value);
    else newParams.delete(key);
    setParams(newParams);
  };

  const toggleArrayParam = (key: string, value: string) => {
    const current = params.get(key)?.split(',')?.filter(Boolean) ?? [];
    const newValues = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    const newParams = new URLSearchParams(params);
    if (newValues.length) newParams.set(key, newValues.join(','));
    else newParams.delete(key);
    setParams(newParams);
  };

  const resetFilters = () => {
    const newParams = new URLSearchParams();
    if (params.get('search')) newParams.set('search', params.get('search')!);
    setParams(newParams);
  };

  useEffect(() => {
    async function fetchBrandsAndCities() {
      try {
        const [brandRes, cityRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/brands`),
          fetch(`${API_BASE_URL}/api/cities`),
        ]);
        if (brandRes.ok) setBrands(await brandRes.json());
        if (cityRes.ok) setCities(await cityRes.json());
      } catch {
        // Silent fail for filters
      }
    }
    fetchBrandsAndCities();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchCars() {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams(params);
        const response = await fetch(`${API_BASE_URL}/api/cars?${query}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Failed to fetch cars');
        const data = await response.json();
        setCars(data.data || []);
        setTotal(data.total || 0);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Yükləmə xətası baş verdi');
          console.error('Fetch error:', err);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchCars();
    return () => controller.abort();
  }, [params]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header with gradient */}
        <header className="mb-10 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white shadow-xl">
          <div className="flex items-center gap-4">
            <div className="text-5xl">🚗</div>
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">TurboFind</h1>
              <p className="mt-2 text-blue-100">Avtomobil elanlarını rahat kəşf edin.</p>
            </div>
          </div>
        </header>

        <div className="mb-5 flex items-center justify-between lg:hidden">
          <button type="button" onClick={() => setMobileFiltersOpen(true)} className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg">
            🔍 Filtrlər
          </button>
        </div>

        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-20 bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileFiltersOpen(false)}>
            <aside className="h-full w-80 max-w-[90%] overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">Filtrlər</h2>
                <button type="button" onClick={() => setMobileFiltersOpen(false)} className="text-3xl text-slate-400 transition hover:text-slate-600">×</button>
              </div>
              <FilterPanel
                ranges={ranges}
                onRangeChange={updateRange}
                selectedFuel={selectedFuel}
                selectedTransmission={selectedTransmission}
                city={city}
                cities={cities}
                onToggleFuel={(v) => toggleArrayParam('fuel', v)}
                onToggleTransmission={(v) => toggleArrayParam('transmission', v)}
                onCityChange={(v) => updateSingle('city', v)}
                onReset={resetFilters}
              />
            </aside>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          {/* Sidebar with glass effect */}
          <aside className="hidden rounded-2xl bg-white/80 p-6 shadow-lg backdrop-blur-sm ring-1 ring-slate-200/50 lg:block">
            <div className="mb-6 flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              <h2 className="text-xl font-bold text-slate-800">Filtrlər</h2>
            </div>
            <FilterPanel
              ranges={ranges}
              onRangeChange={updateRange}
              selectedFuel={selectedFuel}
              selectedTransmission={selectedTransmission}
              city={city}
              cities={cities}
              onToggleFuel={(v) => toggleArrayParam('fuel', v)}
              onToggleTransmission={(v) => toggleArrayParam('transmission', v)}
              onCityChange={(v) => updateSingle('city', v)}
              onReset={resetFilters}
            />
          </aside>

          <section>
            {/* Search bar with brand filter */}
            <div className="mb-6 grid gap-3 rounded-2xl bg-white p-4 shadow-md ring-1 ring-slate-200/50 sm:grid-cols-[1fr_220px]">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input
                  className="w-full rounded-xl border-0 bg-slate-50 px-12 py-3.5 text-sm outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-blue-500"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Marka və ya model axtarın..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateSingle('search', searchInput);
                    }
                  }}
                />
              </div>
              <select
                className="rounded-xl border-0 bg-slate-50 px-4 py-3.5 text-sm outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-blue-500"
                value={params.get('brand') ?? ''}
                onChange={(e) => updateSingle('brand', e.target.value)}
              >
                <option value="">🏷️ Bütün markalar</option>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                  <span className="text-lg font-medium text-slate-600">Yüklənir...</span>
                </div>
              </div>
            ) : error ? (
              <div className="rounded-2xl bg-red-50 p-8 text-center text-red-600 ring-1 ring-red-200">
                <span className="text-4xl">😅</span>
                <p className="mt-2">{error}</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-600">
                    <span className="font-bold text-blue-600">{formatNumber(total)}</span> nəticə tapıldı
                  </p>
                </div>
                {cars.length === 0 ? (
                  <div className="rounded-2xl bg-white p-16 text-center shadow-md ring-1 ring-slate-200/50">
                    <span className="text-6xl">🔍</span>
                    <p className="mt-4 text-lg font-medium text-slate-600">Nəticə tapılmadı</p>
                    <p className="text-sm text-slate-400">Filtirləri dəyişərək yenidən cəhd edin</p>
                  </div>
                ) : (
                  <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {cars.map((car) => (
                      <Link key={car.turbo_listing_id} to={`/elan/${car.turbo_listing_id}`} className="group overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:ring-blue-300">
                        <div className="relative overflow-hidden bg-slate-100">
                          <CarImage car={car} className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" />
                          {car.brand && (
                            <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                              {car.brand}
                            </div>
                          )}
                        </div>
                        <div className="p-5">
                          <p className="text-2xl font-bold text-blue-700">{formatPrice(car.price_azn)}</p>
                          <h2 className="mt-1 truncate text-lg font-semibold text-slate-900">{car.title}</h2>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            {car.year && <span className="rounded-full bg-slate-100 px-2.5 py-0.5">📅 {car.year}</span>}
                            {car.mileage_km !== null && <span className="rounded-full bg-slate-100 px-2.5 py-0.5">📏 {formatNumber(car.mileage_km)} km</span>}
                            {car.engine_volume_l && <span className="rounded-full bg-slate-100 px-2.5 py-0.5">⚙️ {car.engine_volume_l} L</span>}
                          </div>
                          {car.city && (
                            <div className="mt-2 text-xs text-slate-400">📍 {car.city}</div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </section>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function DetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadCar() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/cars/${encodeURIComponent(id ?? '')}`, { signal: controller.signal });
        if (response.status === 404) { setNotFound(true); return; }
        if (!response.ok) throw new Error();
        setCar((await response.json()) as Car);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setNotFound(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadCar();
    return () => controller.abort();
  }, [id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-white px-4 py-16 text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <span className="text-lg font-medium text-slate-600">Yüklənir...</span>
        </div>
      </main>
    );
  }

  if (notFound || !car) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-white px-4 py-16 text-center">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-10 shadow-xl ring-1 ring-slate-200/50">
          <div className="mb-4 text-7xl">🚗</div>
          <p className="text-xl font-semibold text-slate-900">Elan tapılmadı</p>
          <p className="mt-2 text-sm text-slate-500">Bu elan mövcud deyil və ya silinib.</p>
          <button className="mt-6 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-3 font-semibold text-white transition hover:shadow-lg" onClick={() => navigate('/')}>
            ← Elanlara qayıt
          </button>
        </div>
      </main>
    );
  }

  const specs = [
    ['İl', car.year?.toString() ?? '—'],
    ['Yürüş', car.mileage_km === null ? '—' : `${formatNumber(car.mileage_km)} km`],
    ['Mühərrik', car.engine_volume_l === null ? '—' : `${car.engine_volume_l} L`],
    ['Yanacaq', car.fuel_type ?? '—'],
    ['Sürətlər qutusu', car.transmission ?? '—'],
    ['Ban növü', car.body_type ?? '—'],
    ['Rəng', car.color ?? '—'],
    ['Ötürücü', car.drivetrain ?? '—'],
    ['At gücü', car.horsepower ? `${formatNumber(car.horsepower)} a.g.` : '—'],
    ['Oturacaq sayı', car.seats_count?.toString() ?? '—'],
    ['Şəhər', car.city ?? '—'],
    ['Vəziyyəti', car.condition ?? '—'],
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <button className="group mb-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-blue-50 hover:text-blue-700 hover:ring-blue-300" onClick={() => navigate('/')}>
          <span className="text-xl transition group-hover:-translate-x-1">←</span>
          Geri
        </button>

        <article className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200/50">
          <div className="relative bg-slate-100">
            <CarImage car={car} className="aspect-[16/9] w-full object-cover" />
            <div className="absolute bottom-4 right-4 rounded-full bg-black/60 px-4 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
              #{car.turbo_listing_id}
            </div>
            {car.brand && (
              <div className="absolute left-4 top-4 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
                🏷️ {car.brand}
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">{car.title}</h1>
                {car.listed_at && (
                  <p className="mt-1.5 text-sm text-slate-500">
                    📅 {new Date(car.listed_at).toLocaleDateString('az-AZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
              <div className="shrink-0 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 px-6 py-4 ring-1 ring-blue-200/30">
                <p className="text-sm font-medium text-blue-700">💰 Qiymət</p>
                <p className="mt-1 text-3xl font-extrabold text-blue-700">{formatPrice(car.price_azn)}</p>
              </div>
            </div>

            <section className="mt-8">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-950">⚙️ Texniki xüsusiyyətlər</h2>
                <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-700">
                  {specs.filter(([_, v]) => v !== '—').length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {specs.map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition hover:border-blue-300 hover:bg-blue-50/30">
                    <dt className="text-xs font-medium text-slate-500">{label}</dt>
                    <dd className="mt-1.5 font-semibold text-slate-900">{value}</dd>
                  </div>
                ))}
              </div>
            </section>

            {car.description && (
              <section className="mt-8">
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-950">📝 Elanın təsviri</h2>
                  <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-700">Mətn</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 sm:p-6">
                  <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{car.description}</div>
                </div>
              </section>
            )}

            <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center">
              <a className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3.5 font-bold text-white shadow-sm transition hover:from-blue-700 hover:to-blue-800 hover:shadow-md active:scale-95" href={car.turbo_url} target="_blank" rel="noreferrer">
                <span>🔗 Turbo.az-da bax</span>
                <span className="text-lg">→</span>
              </a>
              <button className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-medium text-slate-700 transition hover:bg-slate-50 active:scale-95" onClick={() => navigate('/')}>
                📋 Digər elanlar
              </button>
              {car.views_count !== null && car.views_count !== undefined && (
                <p className="ml-auto text-sm text-slate-500">👁️ {formatNumber(car.views_count)} baxış</p>
              )}
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/elan/:id" element={<DetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
