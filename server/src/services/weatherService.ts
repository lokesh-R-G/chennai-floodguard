import axios from 'axios';
import { cacheGet, cacheSet } from '../config/redis.js';
import logger from '../config/logger.js';

export interface WeatherData {
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  pressure: number;
  timestamp: Date;
}

export interface ForecastData {
  hourly: Array<{
    time: string;
    temperature: number;
    precipitation: number;
    humidity: number;
  }>;
}

const CACHE_TTL = 600; // 10 minutes

export class WeatherService {
  private primaryURL: string;
  private fallbackURL?: string;
  private fallbackAPIKey?: string;

  constructor() {
    this.primaryURL = process.env.OPEN_METEO_API_URL || 'https://api.open-meteo.com/v1';
    this.fallbackURL = process.env.WEATHER_FALLBACK_API_URL;
    this.fallbackAPIKey = process.env.WEATHER_FALLBACK_API_KEY;
  }

  /**
   * Get current weather for a lat/lon. Redis cache → Open-Meteo → Fallback API.
   * Throws if ALL providers fail — no dummy data.
   */
  async getCurrentWeather(lat: number, lon: number): Promise<WeatherData> {
    const cacheKey = `weather:current:${lat.toFixed(4)}_${lon.toFixed(4)}`;

    const cached = await cacheGet<WeatherData>(cacheKey);
    if (cached) return cached;

    // Primary: Open-Meteo
    try {
      const data = await this.fetchOpenMeteo(lat, lon);
      await cacheSet(cacheKey, data, CACHE_TTL);
      return data;
    } catch (primaryErr) {
      logger.warn('Open-Meteo failed, trying fallback', { error: (primaryErr as Error).message });
    }

    // Fallback: WeatherAPI.com
    if (this.fallbackURL && this.fallbackAPIKey) {
      try {
        const data = await this.fetchFallback(lat, lon);
        await cacheSet(cacheKey, data, CACHE_TTL);
        return data;
      } catch (fbErr) {
        logger.error('Fallback weather also failed', { error: (fbErr as Error).message });
      }
    }

    throw new Error(`All weather providers failed for (${lat}, ${lon})`);
  }

  async getForecast(lat: number, lon: number, hours: number = 24): Promise<ForecastData> {
    const cacheKey = `weather:forecast:${lat.toFixed(4)}_${lon.toFixed(4)}_${hours}`;
    const cached = await cacheGet<ForecastData>(cacheKey);
    if (cached) return cached;

    const response = await axios.get(`${this.primaryURL}/forecast`, {
      params: {
        latitude: lat,
        longitude: lon,
        hourly: 'temperature_2m,precipitation,relative_humidity_2m',
        forecast_days: Math.ceil(hours / 24),
        timezone: 'Asia/Kolkata',
      },
      timeout: 8000,
    });

    const forecast: ForecastData = {
      hourly: response.data.hourly.time.slice(0, hours).map((time: string, i: number) => ({
        time,
        temperature: response.data.hourly.temperature_2m[i],
        precipitation: response.data.hourly.precipitation[i],
        humidity: response.data.hourly.relative_humidity_2m[i],
      })),
    };

    await cacheSet(cacheKey, forecast, CACHE_TTL);
    return forecast;
  }

  /* ── private ────────────────────────────────── */

  private async fetchOpenMeteo(lat: number, lon: number): Promise<WeatherData> {
    const response = await axios.get(`${this.primaryURL}/forecast`, {
      params: {
        latitude: lat,
        longitude: lon,
        current_weather: true,
        hourly: 'relative_humidity_2m,surface_pressure',
        timezone: 'Asia/Kolkata',
      },
      timeout: 8000,
    });
    const cw = response.data.current_weather;
    const h = response.data.hourly;

    return {
      temperature: cw.temperature,
      humidity: h?.relative_humidity_2m?.[0] ?? 0,
      rainfall: cw.precipitation ?? 0,
      windSpeed: cw.windspeed ?? 0,
      pressure: h?.surface_pressure?.[0] ?? 1013,
      timestamp: new Date(),
    };
  }

  private async fetchFallback(lat: number, lon: number): Promise<WeatherData> {
    const response = await axios.get(`${this.fallbackURL}/current.json`, {
      params: { key: this.fallbackAPIKey, q: `${lat},${lon}` },
      timeout: 8000,
    });
    const d = response.data.current;
    return {
      temperature: d.temp_c,
      humidity: d.humidity,
      rainfall: d.precip_mm,
      windSpeed: d.wind_kph,
      pressure: d.pressure_mb,
      timestamp: new Date(),
    };
  }
}

export const weatherService = new WeatherService();
export default weatherService;
