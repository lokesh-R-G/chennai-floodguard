import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, RefreshCw, Eye, Calendar } from "lucide-react";
import { toast } from "sonner";

interface FloodZone {
  id: string;
  zone_name: string;
  center_lat: number;
  center_lon: number;
  avg_flood_depth: number;
  current_risk_score: number;
  predicted_rainfall: number;
}

interface Incident {
  id: string;
  location_lat: number;
  location_lon: number;
  emergency_type: string;
  status: string;
  safe_route: any;
}

const InteractiveFloodMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  
  const [zones, setZones] = useState<FloodZone[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [showPredicted, setShowPredicted] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    // Initialize map centered on Chennai
    const map = L.map(mapContainer.current).setView([13.0827, 80.2707], 11);
    mapInstance.current = map;

    // Add tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Initialize layers
    markersLayer.current = L.layerGroup().addTo(map);
    routeLayer.current = L.layerGroup().addTo(map);

    // Fetch initial data
    fetchZonesAndIncidents();

    // Set up realtime subscriptions
    const zonesChannel = supabase
      .channel('flood_zones_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flood_zones' }, () => {
        fetchZonesAndIncidents();
      })
      .subscribe();

    const incidentsChannel = supabase
      .channel('incidents_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => {
        fetchZonesAndIncidents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(zonesChannel);
      supabase.removeChannel(incidentsChannel);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  useEffect(() => {
    updateMapMarkers();
  }, [zones, incidents, showPredicted]);

  const fetchZonesAndIncidents = async () => {
    try {
      const [zonesResult, incidentsResult] = await Promise.all([
        supabase.from("flood_zones").select("*").order("current_risk_score", { ascending: false }),
        supabase.from("incidents").select("*").in("status", ["pending", "assigned", "in_progress"])
      ]);

      if (zonesResult.error) {
        console.error("Error fetching zones:", zonesResult.error);
        toast.error("Failed to load flood zones");
      } else {
        setZones(zonesResult.data || []);
      }

      if (incidentsResult.error) {
        console.error("Error fetching incidents:", incidentsResult.error);
      } else {
        setIncidents(incidentsResult.data || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load map data");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 8) return "#ef4444"; // red
    if (score >= 6) return "#f97316"; // orange
    if (score >= 4) return "#eab308"; // yellow
    return "#22c55e"; // green
  };

  const getRiskLabel = (score: number) => {
    if (score >= 8) return "Critical";
    if (score >= 6) return "High";
    if (score >= 4) return "Moderate";
    return "Low";
  };

  const updateMapMarkers = () => {
    if (!markersLayer.current || !routeLayer.current) return;

    // Clear existing markers
    markersLayer.current.clearLayers();
    routeLayer.current.clearLayers();

    // Add flood zone markers
    zones.forEach((zone) => {
      const score = showPredicted ? 
        Math.min(10, zone.current_risk_score + zone.predicted_rainfall * 0.1) : 
        zone.current_risk_score;

      const color = getRiskColor(score);
      const radius = 300 + (score * 50); // Larger circles for higher risk

      const circle = L.circle([zone.center_lat, zone.center_lon], {
        color: color,
        fillColor: color,
        fillOpacity: 0.3,
        radius: radius,
        weight: 2,
      }).addTo(markersLayer.current!);

      const popupContent = `
        <div class="p-2">
          <h3 class="font-bold text-sm mb-1">${zone.zone_name}</h3>
          <div class="text-xs space-y-1">
            <div><strong>Risk:</strong> ${getRiskLabel(score)} (${score.toFixed(1)})</div>
            <div><strong>Flood Depth:</strong> ${zone.avg_flood_depth.toFixed(1)} inches</div>
            <div><strong>Predicted Rain:</strong> ${zone.predicted_rainfall.toFixed(1)} mm</div>
            ${showPredicted ? `<div class="text-orange-600 font-semibold mt-1">Predicted Impact</div>` : ''}
          </div>
        </div>
      `;

      circle.bindPopup(popupContent);
    });

    // Add incident markers
    incidents.forEach((incident) => {
      const icon = L.divIcon({
        className: 'custom-incident-marker',
        html: `
          <div style="
            background: #dc2626;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 16px;
          ">!</div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([incident.location_lat, incident.location_lon], { icon })
        .addTo(markersLayer.current!);

      marker.bindPopup(`
        <div class="p-2">
          <h3 class="font-bold text-sm mb-1">Emergency Alert</h3>
          <div class="text-xs space-y-1">
            <div><strong>Type:</strong> ${incident.emergency_type}</div>
            <div><strong>Status:</strong> ${incident.status}</div>
          </div>
        </div>
      `);

      // Draw safe route if available
      if (incident.safe_route && incident.safe_route.coordinates) {
        const coordinates = incident.safe_route.coordinates.map((coord: any) => [coord.lat, coord.lon]);
        
        L.polyline(coordinates, {
          color: '#3b82f6',
          weight: 4,
          opacity: 0.7,
          dashArray: '10, 10',
        }).addTo(routeLayer.current!);
      }
    });
  };

  const handlePredictRainfall = async () => {
    setPredicting(true);
    try {
      const { error } = await supabase.functions.invoke('predict-rainfall');
      
      if (error) throw error;
      
      toast.success("Rainfall predictions updated successfully");
      await fetchZonesAndIncidents();
    } catch (error) {
      console.error("Error predicting rainfall:", error);
      toast.error("Failed to update predictions");
    } finally {
      setPredicting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-secondary/20">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading flood map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-secondary/10">
      {/* Map Controls */}
      <div className="p-3 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-sm font-bold">Chennai Flood Risk Map</h2>
              <p className="text-xs text-muted-foreground">Live hotspot monitoring</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={showPredicted ? "default" : "outline"}
              size="sm"
              onClick={() => setShowPredicted(!showPredicted)}
              className="gap-1"
            >
              {showPredicted ? (
                <>
                  <Calendar className="h-3 w-3" />
                  Predicted
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" />
                  Current
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePredictRainfall}
              disabled={predicting}
              className="gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${predicting ? 'animate-spin' : ''}`} />
              Update
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-3 mt-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#22c55e]"></div>
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#eab308]"></div>
            <span>Moderate</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#f97316]"></div>
            <span>High</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
            <span>Critical</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div ref={mapContainer} className="flex-1" />

      {/* Stats Footer */}
      <div className="p-2 border-t border-border bg-card/95 backdrop-blur-sm">
        <div className="flex justify-around text-xs">
          <div className="text-center">
            <div className="font-bold text-primary">{zones.length}</div>
            <div className="text-muted-foreground">Zones</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-danger">{incidents.length}</div>
            <div className="text-muted-foreground">Active Alerts</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-warning">
              {zones.filter(z => z.current_risk_score >= 6).length}
            </div>
            <div className="text-muted-foreground">High Risk</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveFloodMap;
