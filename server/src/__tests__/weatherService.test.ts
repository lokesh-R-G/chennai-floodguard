import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock Redis
jest.unstable_mockModule('../../config/redis.js', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}));

jest.unstable_mockModule('../../config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('axios', () => ({
  default: { get: jest.fn() },
}));

describe('WeatherService', () => {
  let WeatherService: any;
  let cacheGet: jest.Mock;
  let cacheSet: jest.Mock;
  let axiosGet: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    const redis = await import('../../config/redis.js');
    cacheGet = redis.cacheGet as jest.Mock;
    cacheSet = redis.cacheSet as jest.Mock;
    const axios = (await import('axios')).default;
    axiosGet = axios.get as jest.Mock;
    const mod = await import('../../services/weatherService.js');
    WeatherService = mod.WeatherService;
  });

  it('should return cached data when available', async () => {
    const cached = { temperature: 30, humidity: 80, rainfall: 5, windSpeed: 10, pressure: 1013, timestamp: new Date() };
    cacheGet.mockResolvedValue(cached as never);

    const service = new WeatherService();
    const result = await service.getCurrentWeather(13.08, 80.27);
    expect(result).toEqual(cached);
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it('should fetch from Open-Meteo when cache misses', async () => {
    cacheGet.mockResolvedValue(null as never);
    cacheSet.mockResolvedValue(undefined as never);

    axiosGet.mockResolvedValue({
      data: {
        current_weather: { temperature: 32, windspeed: 12, precipitation: 2 },
        hourly: { relative_humidity_2m: [78], surface_pressure: [1012] },
      },
    } as never);

    const service = new WeatherService();
    const result = await service.getCurrentWeather(13.08, 80.27);
    expect(result.temperature).toBe(32);
    expect(result.windSpeed).toBe(12);
    expect(cacheSet).toHaveBeenCalled();
  });

  it('should throw when all providers fail and no fallback configured', async () => {
    cacheGet.mockResolvedValue(null as never);
    axiosGet.mockRejectedValue(new Error('Network error') as never);

    const service = new WeatherService();
    await expect(service.getCurrentWeather(13.08, 80.27)).rejects.toThrow('All weather providers failed');
  });

  it('should return forecast data', async () => {
    cacheGet.mockResolvedValue(null as never);
    cacheSet.mockResolvedValue(undefined as never);

    axiosGet.mockResolvedValue({
      data: {
        hourly: {
          time: ['2024-01-01T00:00', '2024-01-01T01:00', '2024-01-01T02:00'],
          temperature_2m: [28, 27, 26],
          precipitation: [2, 5, 1],
          relative_humidity_2m: [80, 82, 85],
        },
      },
    } as never);

    const service = new WeatherService();
    const forecast = await service.getForecast(13.08, 80.27, 3);
    expect(forecast.hourly.length).toBe(3);
    expect(forecast.hourly[0].precipitation).toBe(2);
  });
});
