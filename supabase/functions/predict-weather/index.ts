/**
 * Supabase Edge Function: Weather Prediction
 * Fetches weather data and makes predictions for flood zones
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Location {
  lat: number
  lon: number
}

interface PredictionRequest {
  lat: number
  lon: number
  seqLen?: number
}

interface PredictionResponse {
  predictedRainfall: number
  currentRainfall: number
  confidence: number
  trend: 'increasing' | 'decreasing' | 'stable'
}

/**
 * Fetch recent hourly rain series from Open-Meteo API
 */
async function fetchOpenMeteoRainSeries(
  lat: number,
  lon: number,
  pastHours: number = 24
): Promise<number[]> {
  const url = "https://api.open-meteo.com/v1/forecast"
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: "rain",
    past_days: "1",
    forecast_days: "0",
    timezone: "Asia/Kolkata",
  })

  try {
    const response = await fetch(`${url}?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.statusText}`)
    }

    const data = await response.json()
    const times = data.hourly?.time || []
    const rains = data.hourly?.rain || []

    if (!times || !rains || times.length === 0) {
      return []
    }

    // Sort by time and get the most recent hours
    const pairs = times.map((time: string, idx: number) => [time, rains[idx]] as [string, number])
    pairs.sort((a, b) => a[0].localeCompare(b[0]))
    const recent = pairs.slice(-pastHours)
    return recent.map(([, rain]) => (rain !== null && rain !== undefined ? parseFloat(rain.toString()) : 0))
  } catch (error) {
    console.error("Error fetching weather data:", error)
    return []
  }
}

/**
 * Simple trend-based prediction
 * Uses moving average and trend analysis
 */
function simpleTrendPrediction(rainSeries: number[]): number {
  if (rainSeries.length === 0) return 0

  // Get recent values (last 6 hours)
  const recent = rainSeries.slice(-6)
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length

  // Calculate trend
  const firstHalf = recent.slice(0, 3).reduce((a, b) => a + b, 0) / 3
  const secondHalf = recent.slice(3).reduce((a, b) => a + b, 0) / 3
  const trend = secondHalf - firstHalf

  // Predict next hour: average + trend adjustment
  const prediction = Math.max(0, avg + trend * 0.5)
  return Math.round(prediction * 100) / 100
}

/**
 * Predict next hour rainfall
 */
async function predictNextHourRainfall(
  lat: number,
  lon: number,
  seqLen: number = 24
): Promise<PredictionResponse> {
  try {
    const rainSeries = await fetchOpenMeteoRainSeries(lat, lon, seqLen)

    if (rainSeries.length === 0) {
      return {
        predictedRainfall: 0,
        confidence: 0,
        currentRainfall: 0,
        trend: 'stable',
      }
    }

    const currentRainfall = rainSeries[rainSeries.length - 1] || 0
    const predictedRainfall = simpleTrendPrediction(rainSeries)

    // Calculate trend
    const recent = rainSeries.slice(-6)
    const firstHalf = recent.slice(0, 3).reduce((a, b) => a + b, 0) / 3
    const secondHalf = recent.slice(3).reduce((a, b) => a + b, 0) / 3
    const trendDiff = secondHalf - firstHalf

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable'
    if (trendDiff > 0.5) trend = 'increasing'
    else if (trendDiff < -0.5) trend = 'decreasing'

    const confidence = Math.min(1, rainSeries.length / seqLen)

    return {
      predictedRainfall,
      confidence,
      currentRainfall,
      trend,
    }
  } catch (error) {
    console.error("Error predicting rainfall:", error)
    return {
      predictedRainfall: 0,
      confidence: 0,
      currentRainfall: 0,
      trend: 'stable',
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { lat, lon, seqLen = 24 } = await req.json() as PredictionRequest

    if (!lat || !lon) {
      return new Response(
        JSON.stringify({ error: 'Latitude and longitude required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Predicting weather for location (${lat}, ${lon})`)

    const prediction = await predictNextHourRainfall(lat, lon, seqLen)

    return new Response(
      JSON.stringify(prediction),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in weather prediction:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

