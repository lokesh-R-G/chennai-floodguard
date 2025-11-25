import { useEffect, useState } from "react";
import { Cloud, CloudRain, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { predictNextHourRainfall, type PredictionResult } from "@/services/weatherPrediction";
import { supabase } from "@/integrations/supabase/client";

interface WeatherPredictionProps {
  lat: number;
  lon: number;
  zoneId?: string;
}

const WeatherPrediction = ({ lat, lon, zoneId }: WeatherPredictionProps) => {
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPrediction();
    
    // Refresh prediction every 5 minutes
    const interval = setInterval(fetchPrediction, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [lat, lon]);

  const fetchPrediction = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let result: PredictionResult;
      
      // Try using Supabase Edge Function first
      try {
        const { data, error: funcError } = await supabase.functions.invoke('predict-weather', {
          body: { lat, lon, seqLen: 24 }
        });

        if (data && !funcError && !(data as any).error) {
          result = data as PredictionResult;
        } else {
          // Fallback to direct API call
          result = await predictNextHourRainfall(lat, lon, 24);
        }
      } catch (funcErr) {
        // Fallback to direct API call if Edge Function fails
        result = await predictNextHourRainfall(lat, lon, 24);
      }

      setPrediction(result);

      // Update zone in database if zoneId is provided
      if (zoneId && result) {
        await supabase
          .from('flood_zones')
          .update({ predicted_rainfall: result.predictedRainfall })
          .eq('id', zoneId)
          .then(({ error }) => {
            if (error) console.error('Error updating zone:', error);
          });
      }
    } catch (err) {
      console.error("Error fetching weather prediction:", err);
      setError("Failed to fetch weather prediction");
      // Final fallback
      try {
        const result = await predictNextHourRainfall(lat, lon, 24);
        setPrediction(result);
      } catch (fallbackErr) {
        setError("Unable to get weather prediction");
      }
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = () => {
    if (!prediction) return null;
    switch (prediction.trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-destructive" />;
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRainfallColor = (mm: number) => {
    if (mm >= 10) return "text-destructive";
    if (mm >= 5) return "text-orange-500";
    if (mm >= 2) return "text-yellow-500";
    return "text-green-500";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Next Hour Weather
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading prediction...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !prediction) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Next Hour Weather
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error || "No prediction available"}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-fit min-w-[200px]">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-xs flex items-center gap-2">
          <CloudRain className="h-3 w-3" />
          Next Hour Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Predicted</span>
          <span className={`text-base font-bold ${getRainfallColor(prediction.predictedRainfall)}`}>
            {prediction.predictedRainfall.toFixed(1)} mm
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Current</span>
          <span className="text-xs font-medium">
            {prediction.currentRainfall.toFixed(1)} mm
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Trend</span>
          <div className="flex items-center gap-1">
            {getTrendIcon()}
            <span className="text-xs capitalize">{prediction.trend}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeatherPrediction;

