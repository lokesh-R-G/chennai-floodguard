import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Location {
  lat: number
  lon: number
}

interface WeatherData {
  time: string[]
  rain: number[]
}

/**
 * Fetch recent hourly rain series from Open-Meteo API
 */
async function fetchOpenMeteoRainSeries(lat: number, lon: number, pastHours: number = 24): Promise<number[]> {
  const url = 'https://api.open-meteo.com/v1/forecast'
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: 'rain',
    past_days: '1', // get last 24 hours
    forecast_days: '0',
    timezone: 'Asia/Kolkata',
  })

  try {
    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.statusText}`)
    }

    const data = await response.json() as { hourly?: { time?: string[]; rain?: number[] } }
    const times = data.hourly?.time || []
    const rains = data.hourly?.rain || []

    if (!times.length || !rains.length) {
      return []
    }

    // Sort by time and get recent hours
    const pairs = times.map((time, i) => [time, rains[i]] as [string, number])
      .sort((a, b) => a[0].localeCompare(b[0]))
    
    const recent = pairs.slice(-pastHours)
    return recent.map(([, rain]) => rain)
  } catch (error) {
    console.error('Error fetching Open-Meteo data:', error)
    return []
  }
}

/**
 * Call Python LSTM service for prediction (if available)
 */
async function predictNextRainLSTM(lat: number, lon: number): Promise<number | null> {
  const pythonServiceUrl = Deno.env.get('PYTHON_LSTM_SERVICE_URL')
  
  if (!pythonServiceUrl) {
    return null // Service not configured
  }

  try {
    const response = await fetch(`${pythonServiceUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lon }),
    })

    if (!response.ok) {
      console.warn(`Python LSTM service returned ${response.status}`)
      return null
    }

    const data = await response.json() as { success?: boolean; predicted_rainfall_mm?: number }
    
    if (data.success && typeof data.predicted_rainfall_mm === 'number') {
      return data.predicted_rainfall_mm
    }
    
    return null
  } catch (error) {
    console.warn('Python LSTM service unavailable, using fallback:', error)
    return null
  }
}

/**
 * Simple time-series prediction using moving average and trend
 * This is a fallback when the Python LSTM service is not available
 */
function predictNextRainSimple(rainSeries: number[]): number {
  if (rainSeries.length === 0) {
    return 0.0
  }

  // Use weighted moving average with emphasis on recent values
  const weights = rainSeries.map((_, i) => {
    const position = i / rainSeries.length
    return position * position // Quadratic weighting (more weight to recent)
  })
  
  const sumWeights = weights.reduce((a, b) => a + b, 0)
  const weightedAvg = rainSeries.reduce((sum, val, i) => sum + val * weights[i], 0) / sumWeights

  // Calculate trend from last 6 hours
  const recent = rainSeries.slice(-6)
  if (recent.length >= 2) {
    const trend = (recent[recent.length - 1] - recent[0]) / recent.length
    return Math.max(0, weightedAvg + trend * 0.5) // Apply trend with damping
  }

  return Math.max(0, weightedAvg)
}

/**
 * Compute risk score based on average depth and predicted rain
 * Matches the Python implementation: risk = (0.6 * rain_norm + 0.4 * depth_norm) * 10
 */
function computeRiskScore(avgDepthIn: number, predRainMm: number): number {
  // Normalize depth: 0..1 from 0..60 inches
  const depthNorm = Math.min(Math.max((avgDepthIn || 0.0) / 60.0, 0.0), 1.0)
  
  // Normalize rain: 0..1 from 0..200 mm
  const rainNorm = Math.min(Math.max(predRainMm / 200.0, 0.0), 1.0)
  
  // Combined risk: 60% rain, 40% depth
  const raw = 0.6 * rainNorm + 0.4 * depthNorm
  
  // Scale to 0-10 and round to 2 decimals
  return Math.round(raw * 10.0 * 100) / 100
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all flood zones from database
    const { data: zones, error: zonesError } = await supabase
      .from('flood_zones')
      .select('*')

    if (zonesError) {
      console.error('Error fetching flood zones:', zonesError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch flood zones' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!zones || zones.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No flood zones found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Predicting weather for ${zones.length} flood zones...`)

    // Predict weather for each zone
    const updates = []
    for (const zone of zones) {
      const lat = parseFloat(zone.center_lat.toString())
      const lon = parseFloat(zone.center_lon.toString())
      const avgDepth = parseFloat(zone.avg_flood_depth?.toString() || '0')

      try {
        // Try to use Python LSTM service first, fallback to simple prediction
        let predictedRain = await predictNextRainLSTM(lat, lon)
        
        if (predictedRain === null) {
          // Fallback: Fetch recent rain data and use simple prediction
          const rainSeries = await fetchOpenMeteoRainSeries(lat, lon, 24)
          predictedRain = predictNextRainSimple(rainSeries)
        }
        
        // Compute risk score
        const riskScore = computeRiskScore(avgDepth, predictedRain)

        updates.push({
          id: zone.id,
          predicted_rainfall: Math.round(predictedRain * 100) / 100, // Round to 2 decimals
          current_risk_score: Math.round(riskScore * 10) / 10, // Round to 1 decimal
          last_updated: new Date().toISOString(),
        })

        console.log(`Zone ${zone.zone_name}: ${predictedRain.toFixed(2)}mm predicted, risk ${riskScore.toFixed(1)}`)
      } catch (error) {
        console.error(`Error predicting for zone ${zone.id}:`, error)
        // Continue with other zones
      }
    }

    // Batch update all zones
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('flood_zones')
        .update({
          predicted_rainfall: update.predicted_rainfall,
          current_risk_score: update.current_risk_score,
          last_updated: update.last_updated,
        })
        .eq('id', update.id)

      if (updateError) {
        console.error(`Error updating zone ${update.id}:`, updateError)
      }
    }

    console.log(`Updated ${updates.length} zones with weather predictions`)

    return new Response(
      JSON.stringify({
        success: true,
        updated: updates.length,
        zones: updates,
        message: 'Weather predictions updated successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error predicting weather:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

