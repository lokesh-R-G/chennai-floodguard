import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Droplets, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { predictNextHourRainfall } from "@/services/weatherPrediction";

interface FloodZone {
  id: string;
  zone_name: string;
  center_lat: number;
  center_lon: number;
  avg_flood_depth: number;
  current_risk_score: number;
  predicted_rainfall: number;
}

const FloodMap = () => {
  const [zones, setZones] = useState<FloodZone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchZones();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('flood_zones_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flood_zones'
        },
        () => {
          fetchZones();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update weather predictions for all zones
  useEffect(() => {
    if (zones.length === 0 || loading) return;

    const updatePredictions = async () => {
      const zoneIds = zones.map(z => z.id).join(',');
      
      await Promise.all(
        zones.map(async (zone) => {
          try {
            // Try Supabase Edge Function first
            const { data, error } = await supabase.functions.invoke('predict-weather', {
              body: { lat: zone.center_lat, lon: zone.center_lon, seqLen: 24 }
            });

            let predictedRainfall = 0;
            if (data && !error && !data.error) {
              predictedRainfall = (data as any).predictedRainfall || 0;
            } else {
              // Fallback to direct API call
              const result = await predictNextHourRainfall(zone.center_lat, zone.center_lon, 24);
              predictedRainfall = result.predictedRainfall;
            }

            // Update zone in database
            await supabase
              .from('flood_zones')
              .update({ predicted_rainfall: predictedRainfall })
              .eq('id', zone.id);

            // Update local state
            setZones(prevZones =>
              prevZones.map(z =>
                z.id === zone.id
                  ? { ...z, predicted_rainfall: predictedRainfall }
                  : z
              )
            );
          } catch (error) {
            console.error(`Error predicting for zone ${zone.id}:`, error);
            // Fallback to direct API call
            try {
              const result = await predictNextHourRainfall(zone.center_lat, zone.center_lon, 24);
              await supabase
                .from('flood_zones')
                .update({ predicted_rainfall: result.predictedRainfall })
                .eq('id', zone.id);
              
              setZones(prevZones =>
                prevZones.map(z =>
                  z.id === zone.id
                    ? { ...z, predicted_rainfall: result.predictedRainfall }
                    : z
                )
              );
            } catch (fallbackError) {
              console.error(`Fallback prediction failed for zone ${zone.id}:`, fallbackError);
            }
          }
        })
      );
    };

    // Initial prediction fetch
    updatePredictions();

    // Update predictions every 5 minutes
    const interval = setInterval(updatePredictions, 5 * 60 * 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]); // Only run when loading completes

  const fetchZones = async () => {
    try {
      const { data, error } = await supabase
        .from("flood_zones")
        .select("*")
        .order("current_risk_score", { ascending: false });

      if (error) throw error;
      setZones(data || []);
    } catch (error) {
      console.error("Error fetching zones:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 8) return "text-danger";
    if (score >= 6) return "text-warning";
    if (score >= 4) return "text-accent";
    return "text-success";
  };

  const getRiskLabel = (score: number) => {
    if (score >= 8) return "Critical";
    if (score >= 6) return "High";
    if (score >= 4) return "Moderate";
    return "Low";
  };

  const getRiskBadgeVariant = (score: number): "default" | "destructive" | "outline" | "secondary" => {
    if (score >= 8) return "destructive";
    if (score >= 6) return "default";
    return "outline";
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading flood zones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Map Header */}
      <div className="p-4 border-b border-border bg-card/50">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Chennai Flood Risk Map
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time flood zone monitoring and risk assessment
        </p>
      </div>

      {/* Map Content - Simulated as list for now */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {zones.map((zone) => (
          <div
            key={zone.id}
            className="p-4 bg-secondary/30 border border-border rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-base">{zone.zone_name}</h3>
                <p className="text-xs text-muted-foreground">
                  {zone.center_lat.toFixed(4)}°N, {zone.center_lon.toFixed(4)}°E
                </p>
              </div>
              <Badge variant={getRiskBadgeVariant(zone.current_risk_score)}>
                {getRiskLabel(zone.current_risk_score)}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="text-center p-2 bg-card rounded">
                <p className={`text-2xl font-bold ${getRiskColor(zone.current_risk_score)}`}>
                  {zone.current_risk_score.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Risk Score
                </p>
              </div>

              <div className="text-center p-2 bg-card rounded">
                <p className="text-2xl font-bold text-primary">
                  {zone.avg_flood_depth.toFixed(1)}"
                </p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Droplets className="h-3 w-3" />
                  Depth
                </p>
              </div>

              <div className="text-center p-2 bg-card rounded">
                <p className="text-2xl font-bold text-accent">
                  {zone.predicted_rainfall.toFixed(1)}mm
                </p>
                <p className="text-xs text-muted-foreground">
                  Predicted
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FloodMap;
