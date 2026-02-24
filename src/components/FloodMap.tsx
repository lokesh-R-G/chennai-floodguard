import { useEffect, useState } from "react";
import apiClient from "@/lib/apiClient";
import { MapPin, Droplets, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FloodZone {
  _id: string;
  zoneName: string;
  centerLat: number;
  centerLon: number;
  avgFloodDepth: number;
  currentRiskScore: number;
  predictedRainfall: number;
}

const FloodMap = () => {
  const [zones, setZones] = useState<FloodZone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchZones();
    const interval = window.setInterval(fetchZones, 15000);
    return () => window.clearInterval(interval);
  }, []);

  const fetchZones = async () => {
    try {
      const response: any = await apiClient.getFloodZones();
      setZones(response?.data?.zones || []);
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
            key={zone._id}
            className="p-4 bg-secondary/30 border border-border rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-base">{zone.zoneName}</h3>
                <p className="text-xs text-muted-foreground">
                  {zone.centerLat.toFixed(4)}°N, {zone.centerLon.toFixed(4)}°E
                </p>
              </div>
              <Badge variant={getRiskBadgeVariant(zone.currentRiskScore)}>
                {getRiskLabel(zone.currentRiskScore)}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="text-center p-2 bg-card rounded">
                <p className={`text-2xl font-bold ${getRiskColor(zone.currentRiskScore)}`}>
                  {zone.currentRiskScore.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Risk Score
                </p>
              </div>

              <div className="text-center p-2 bg-card rounded">
                <p className="text-2xl font-bold text-primary">
                  {zone.avgFloodDepth.toFixed(1)}"
                </p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Droplets className="h-3 w-3" />
                  Depth
                </p>
              </div>

              <div className="text-center p-2 bg-card rounded">
                <p className="text-2xl font-bold text-accent">
                  {zone.predictedRainfall.toFixed(1)}mm
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
