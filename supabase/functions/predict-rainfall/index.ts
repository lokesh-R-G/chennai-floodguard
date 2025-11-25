import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FloodZone {
  id: string;
  center_lat: number;
  center_lon: number;
  avg_flood_depth: number;
  current_risk_score: number;
}

// Fetch rainfall data from Open-Meteo API
async function fetchRainfallData(lat: number, lon: number): Promise<number[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation&past_hours=24&forecast_hours=1`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status}`);
  }
  
  const data = await response.json();
  // Get last 24 hours of precipitation data
  const rainfall = data.hourly.precipitation.slice(-24);
  return rainfall;
}

// Simple LSTM prediction simulation (in production, you'd load the actual model)
// For now, we'll use a weighted moving average with recent emphasis
function predictNextHourRainfall(rainfallHistory: number[]): number {
  if (rainfallHistory.length < 24) {
    throw new Error("Need at least 24 hours of data");
  }
  
  // Weight recent hours more heavily
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (let i = 0; i < 24; i++) {
    const weight = Math.pow(1.2, i); // Exponential weight favoring recent data
    weightedSum += rainfallHistory[i] * weight;
    totalWeight += weight;
  }
  
  const prediction = weightedSum / totalWeight;
  
  // Add some momentum based on trend
  const recentTrend = rainfallHistory.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const olderAvg = rainfallHistory.slice(-12, -3).reduce((a, b) => a + b, 0) / 9;
  const momentum = (recentTrend - olderAvg) * 0.3;
  
  return Math.max(0, prediction + momentum);
}

// Compute risk score based on flood depth and predicted rainfall
function computeRiskScore(avgDepth: number, predictedRain: number): number {
  // Base risk from historical flood depth (0-5 scale)
  const depthRisk = Math.min(5, avgDepth * 0.5);
  
  // Additional risk from predicted rainfall (0-5 scale)
  const rainRisk = Math.min(5, predictedRain * 0.2);
  
  // Combined risk score (0-10)
  const totalRisk = depthRisk + rainRisk;
  
  return Math.min(10, totalRisk);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    console.log("Fetching flood zones...");
    
    // Fetch all flood zones
    const { data: zones, error: zonesError } = await supabaseClient
      .from('flood_zones')
      .select('*');

    if (zonesError) {
      throw zonesError;
    }

    console.log(`Processing ${zones.length} flood zones...`);

    // Update each zone with predicted rainfall and new risk score
    const updates = [];
    
    for (const zone of zones as FloodZone[]) {
      try {
        // Fetch rainfall data from Open-Meteo
        const rainfallHistory = await fetchRainfallData(zone.center_lat, zone.center_lon);
        
        // Predict next hour rainfall
        const predictedRainfall = predictNextHourRainfall(rainfallHistory);
        
        // Compute new risk score
        const newRiskScore = computeRiskScore(zone.avg_flood_depth, predictedRainfall);
        
        console.log(`Zone ${zone.id}: Predicted rainfall ${predictedRainfall.toFixed(2)}mm, Risk score ${newRiskScore.toFixed(1)}`);
        
        updates.push({
          id: zone.id,
          predicted_rainfall: predictedRainfall,
          current_risk_score: newRiskScore,
          last_updated: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`Error processing zone ${zone.id}:`, error);
      }
    }

    // Batch update all zones
    for (const update of updates) {
      const { error: updateError } = await supabaseClient
        .from('flood_zones')
        .update({
          predicted_rainfall: update.predicted_rainfall,
          current_risk_score: update.current_risk_score,
          last_updated: update.last_updated,
        })
        .eq('id', update.id);

      if (updateError) {
        console.error(`Error updating zone ${update.id}:`, updateError);
      }
    }

    console.log("Flood zone predictions updated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        updated: updates.length,
        zones: updates,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
