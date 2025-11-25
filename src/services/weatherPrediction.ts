/**
 * Weather Prediction Service
 * Fetches weather data from Open-Meteo API and makes predictions
 */

interface WeatherData {
  time: string[];
  rain: number[];
}

interface PredictionResult {
  predictedRainfall: number; // mm
  confidence: number; // 0-1
  currentRainfall: number; // mm
  trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Fetch recent hourly rain series for a location using Open-Meteo API
 */
export async function fetchOpenMeteoRainSeries(
  lat: number,
  lon: number,
  pastHours: number = 24
): Promise<number[]> {
  const url = "https://api.open-meteo.com/v1/forecast";
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: "rain",
    past_days: "1", // get last 24 hours
    forecast_days: "0",
    timezone: "Asia/Kolkata",
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.statusText}`);
    }

    const data = await response.json();
    const times = data.hourly?.time || [];
    const rains = data.hourly?.rain || [];

    if (!times || !rains || times.length === 0) {
      return [];
    }

    // Sort by time and get the most recent hours
    const pairs = times.map((time: string, idx: number) => [time, rains[idx]] as [string, number]);
    pairs.sort((a, b) => a[0].localeCompare(b[0]));
    const recent = pairs.slice(-pastHours);
    return recent.map(([, rain]) => (rain !== null && rain !== undefined ? parseFloat(rain.toString()) : 0));
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return [];
  }
}

/**
 * Build LSTM input tensor from rain series (for TensorFlow.js)
 * Shape: [1, seqLen, 1]
 */
export function buildLSTMInput(rainSeries: number[], seqLen: number = 24): number[][] {
  const arr = [...rainSeries];
  
  // Pad with zeros if not enough history
  if (arr.length < seqLen) {
    const padLen = seqLen - arr.length;
    arr.unshift(...Array(padLen).fill(0));
  } else {
    // Take the last seqLen values
    arr.splice(0, arr.length - seqLen);
  }

  // Reshape to [1, seqLen, 1] format
  return [arr.map(val => [val])];
}

/**
 * Simple trend-based prediction (fallback when model is not available)
 * Uses moving average and trend analysis
 */
function simpleTrendPrediction(rainSeries: number[]): number {
  if (rainSeries.length === 0) return 0;

  // Get recent values (last 6 hours)
  const recent = rainSeries.slice(-6);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  
  // Calculate trend
  const firstHalf = recent.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const secondHalf = recent.slice(3).reduce((a, b) => a + b, 0) / 3;
  const trend = secondHalf - firstHalf;

  // Predict next hour: average + trend adjustment
  const prediction = Math.max(0, avg + trend * 0.5);
  return Math.round(prediction * 100) / 100;
}

/**
 * Predict next hour rainfall for a location
 * This function will use TensorFlow.js model if available, otherwise falls back to trend analysis
 */
export async function predictNextHourRainfall(
  lat: number,
  lon: number,
  seqLen: number = 24
): Promise<PredictionResult> {
  try {
    // Fetch historical rain data
    const rainSeries = await fetchOpenMeteoRainSeries(lat, lon, seqLen);
    
    if (rainSeries.length === 0) {
      return {
        predictedRainfall: 0,
        confidence: 0,
        currentRainfall: 0,
        trend: 'stable',
      };
    }

    const currentRainfall = rainSeries[rainSeries.length - 1] || 0;
    
    // For now, use simple trend prediction
    // TODO: Load TensorFlow.js model and use it for more accurate predictions
    const predictedRainfall = simpleTrendPrediction(rainSeries);

    // Calculate trend
    const recent = rainSeries.slice(-6);
    const firstHalf = recent.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const secondHalf = recent.slice(3).reduce((a, b) => a + b, 0) / 3;
    const trendDiff = secondHalf - firstHalf;
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (trendDiff > 0.5) trend = 'increasing';
    else if (trendDiff < -0.5) trend = 'decreasing';

    // Confidence based on data quality
    const confidence = Math.min(1, rainSeries.length / seqLen);

    return {
      predictedRainfall,
      confidence,
      currentRainfall,
      trend,
    };
  } catch (error) {
    console.error("Error predicting rainfall:", error);
    return {
      predictedRainfall: 0,
      confidence: 0,
      currentRainfall: 0,
      trend: 'stable',
    };
  }
}

/**
 * Load TensorFlow.js model and make prediction
 * This requires the model to be converted to TensorFlow.js format first
 */
export async function predictWithModel(
  model: any, // tf.LayersModel
  lat: number,
  lon: number,
  seqLen: number = 24
): Promise<number> {
  try {
    const rainSeries = await fetchOpenMeteoRainSeries(lat, lon, seqLen);
    if (rainSeries.length === 0) return 0;

    // Build input tensor
    const input = buildLSTMInput(rainSeries, seqLen);
    
    // Use TensorFlow.js to make prediction
    // const tf = await import('@tensorflow/tfjs');
    // const inputTensor = tf.tensor3d(input);
    // const prediction = model.predict(inputTensor) as tf.Tensor;
    // const value = await prediction.data();
    // prediction.dispose();
    // inputTensor.dispose();
    // return Math.max(0, value[0]);

    // For now, return simple prediction
    return simpleTrendPrediction(rainSeries);
  } catch (error) {
    console.error("Error predicting with model:", error);
    return 0;
  }
}

