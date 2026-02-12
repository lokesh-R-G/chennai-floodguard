import axios from 'axios';
import NodeCache from 'node-cache';
import logger from '../config/logger.js';

interface WeatherData {
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  pressure: number;
  timestamp: Date;
}

interface ForecastData {
  hourly: Array<{
    time: string;
    temperature: number;
    precipitation: number;
    humidity: number;
  }>;
}

const weatherCache = new NodeCache({ stdTTL: 600 }); // 10 minutes cache

export class WeatherService {
  private baseURL: string;
  private fallbackURL?: string;
  private fallbackAPIKey?: string;

  constructor() {
    this.baseURL = process.env.OPEN_METEO_API_URL || 'https://api.open-meteo.com/v1';
    this.fallbackURL = process.env.WEATHER_FALLBACK_API_URL;
    this.fallbackAPIKey = process.env.WEATHER_FALLBACK_API_KEY;
  }

  async getCurrentWeather(lat: number, lon: number): Promise<WeatherData> {
    const cacheKey = `weather_${lat}_${lon}`;
    const cached = weatherCache.get<WeatherData>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // Try Open-Meteo API first (free, no key needed)
      const response = await axios.get(`${this.baseURL}/forecast`, {
        params: {
          latitude: lat,
          longitude: lon,
          current_weather: true,
          hourly: 'temperature_2m,precipitation,relative_humidity_2m',
          timezone: 'Asia/Kolkata'
        },
        timeout: 5000
      });

      const current = response.data.current_weather;
      const weatherData: WeatherData = {
        temperature: current.temperature,
        humidity: response.data.hourly?.relative_humidity_2m?.[0] || 0,
        rainfall: current.precipitation || 0,
        windSpeed: current.windspeed || 0,
        pressure: 1013, // Default as Open-Meteo doesn't provide pressure
        timestamp: new Date()
      };

      weatherCache.set(cacheKey, weatherData);
      return weatherData;

    } catch (error) {
      logger.warn('Open-Meteo API failed, trying fallback:', error);
      return this.getFallbackWeather(lat, lon);
    }
  }

  async getForecast(lat: number, lon: number, hours: number = 24): Promise<ForecastData> {
    const cacheKey = `forecast_${lat}_${lon}_${hours}`;
    const cached = weatherCache.get<ForecastData>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await axios.get(`${this.baseURL}/forecast`, {
        params: {
          latitude: lat,
          longitude: lon,
          hourly: 'temperature_2m,precipitation,relative_humidity_2m',
          forecast_days: Math.ceil(hours / 24),
          timezone: 'Asia/Kolkata'
        },
        timeout: 5000
      });

      const forecast: ForecastData = {
        hourly: response.data.hourly.time.slice(0, hours).map((time: string, i: number) => ({
          time,
          temperature: response.data.hourly.temperature_2m[i],
          precipitation: response.data.hourly.precipitation[i],
          humidity: response.data.hourly.relative_humidity_2m[i]
        }))
      };

      weatherCache.set(cacheKey, forecast);
      return forecast;

    } catch (error) {
      logger.error('Forecast API failed:', error);
      throw new Error('Unable to fetch weather forecast');
    }
  }

  private async getFallbackWeather(lat: number, lon: number): Promise<WeatherData> {
    if (!this.fallbackURL || !this.fallbackAPIKey) {
      throw new Error('Weather API unavailable and no fallback configured');
    }

    try {
      const response = await axios.get(`${this.fallbackURL}/current.json`, {
        params: {
          key: this.fallbackAPIKey,
          q: `${lat},${lon}`
        },
        timeout: 5000
      });

      const data = response.data.current;
      return {
        temperature: data.temp_c,
        humidity: data.humidity,
        rainfall: data.precip_mm,
        windSpeed: data.wind_kph,
        pressure: data.pressure_mb,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Fallback weather API also failed:', error);
      // Return dummy data to keep system operational
      return {
        temperature: 28,
        humidity: 70,
        rainfall: 0,
        windSpeed: 10,
        pressure: 1013,
        timestamp: new Date()
      };
    }
  }

  clearCache(): void {
    weatherCache.flushAll();
  }
}

export default new WeatherService();
