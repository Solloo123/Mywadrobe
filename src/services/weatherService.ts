export interface LiveWeatherReport {
  provider: string;
  city: string;
  country: string;
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  windKmh: number;
  condition: string;
  stylistDescriptor: string;
  stylingTip: string;
  weatherContext: string;
  updatedAt: string;
}

export const WEATHER_CONTEXT_PRESETS = [
  'Warm & Breezy (28°C)',
  'Hot & Sunny Coastal (32°C)',
  'Warm & Humid (30°C)',
  'Cool Evening / Highland (20°C)',
  'Air-Conditioned Indoors',
  'Rainy Season Shower',
];

export async function fetchWeatherByCity(city: string): Promise<LiveWeatherReport> {
  const targetCity = city.trim() || 'Dar es Salaam, Tanzania';
  try {
    const resp = await fetch(`/api/weather?city=${encodeURIComponent(targetCity)}`);
    if (resp.ok) {
      return (await resp.json()) as LiveWeatherReport;
    }
  } catch {
    // Fallback below if offline
  }

  return buildClientFallbackWeather(targetCity);
}

export async function fetchWeatherByCoords(
  lat: number,
  lon: number,
  fallbackCity = 'Dar es Salaam'
): Promise<LiveWeatherReport> {
  try {
    const resp = await fetch(
      `/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&city=${encodeURIComponent(
        fallbackCity
      )}`
    );
    if (resp.ok) {
      return (await resp.json()) as LiveWeatherReport;
    }
  } catch {
    // Fallback below if offline
  }

  return buildClientFallbackWeather(fallbackCity);
}

export async function detectAndFetchLocalWeather(
  fallbackCity = 'Dar es Salaam, Tanzania',
  useGeolocation = true
): Promise<LiveWeatherReport> {
  if (useGeolocation && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 3500,
          maximumAge: 300000,
        });
      });
      return await fetchWeatherByCoords(
        position.coords.latitude,
        position.coords.longitude,
        fallbackCity
      );
    } catch {
      // Geolocation denied, unavailable in iframe, or timed out — fall back to user profile city
    }
  }

  return fetchWeatherByCity(fallbackCity);
}

function buildClientFallbackWeather(city: string): LiveWeatherReport {
  const clean = city.split(',')[0].trim() || 'Dar es Salaam';
  const lower = clean.toLowerCase();
  const isCool =
    lower.includes('arusha') ||
    lower.includes('nairobi') ||
    lower.includes('london') ||
    lower.includes('cape town');
  const tempC = isCool ? 21 : 29;
  const humidity = isCool ? 58 : 72;
  const condition = isCool ? 'Cool Highland Breeze' : 'Warm & Breezy';
  const stylistDescriptor = isCool ? 'Cool Evening / Highland' : 'Warm & Breezy';

  return {
    provider: 'Local Climate Fallback',
    city: clean,
    country: '',
    tempC,
    feelsLikeC: tempC + 1,
    humidity,
    windKmh: 14,
    condition,
    stylistDescriptor,
    stylingTip: isCool
      ? 'Great conditions for layering a tailored blazer or structured jacket.'
      : 'Breathable cotton, linen weaves, and relaxed smart-casual silhouettes recommended.',
    weatherContext: `${stylistDescriptor} (${tempC}°C) · ${condition} in ${clean}`,
    updatedAt: new Date().toISOString(),
  };
}
