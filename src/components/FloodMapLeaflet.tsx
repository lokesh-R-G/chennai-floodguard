import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { toast } from 'sonner';
import { MapPin, Droplets, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import apiClient from '@/lib/apiClient';
import wsClient from '@/lib/websocketClient';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
});

interface FloodZone {
  _id: string;
  zoneName: string;
  centerLat: number;
  centerLon: number;
  avgFloodDepth: number;
  currentRiskScore: number;
  predictedRainfall: number;
  lastUpdated: string;
}

const DEFAULT_CENTER: [number, number] = [13.0827, 80.2707]; // Chennai

function MapUpdater({ zones }: { zones: FloodZone[] }) {
  const map = useMap();

  useEffect(() => {
    if (zones.length > 0) {
      const bounds = zones.map(z => [z.centerLat, z.centerLon] as [number, number]);
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [zones, map]);

  return null;
}

const FloodMap = () => {
  const [zones, setZones] = useState<FloodZone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchZones();

    // Subscribe to WebSocket updates
    wsClient.subscribeToFloodZones();
    wsClient.onFloodZoneUpdate((updatedZone) => {
      setZones(prev =>
        prev.map(z => (z._id === updatedZone._id ? updatedZone : z))
      );
    });

    return () => {
      wsClient.removeAllListeners();
    };
  }, []);

  const fetchZones = async () => {
    try {
      const response = await apiClient.getFloodZones();
      setZones(response.data?.zones || []);
    } catch (error: any) {
      toast.error('Failed to load flood zones');
      console.error('Error fetching zones:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number): string => {
    if (score >= 8) return '#ef4444'; // red
    if (score >= 6) return '#f97316'; // orange
    if (score >= 4) return '#f59e0b'; // amber
    return '#22c55e'; // green
  };

  const getRiskLabel = (score: number): string => {
    if (score >= 8) return 'Critical';
    if (score >= 6) return 'High';
    if (score >= 4) return 'Moderate';
    return 'Low';
  };

  const getRiskBadgeVariant = (score: number): 'default' | 'destructive' | 'outline' | 'secondary' => {
    if (score >= 8) return 'destructive';
    if (score >= 6) return 'default';
    return 'outline';
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading flood map...</p>
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
          Real-time flood zone monitoring • {zones.length} zones tracked
        </p>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={11}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapUpdater zones={zones} />

          {zones.map((zone) => (
            <div key={zone._id}>
              {/* Risk Circle */}
              <Circle
                center={[zone.centerLat, zone.centerLon]}
                radius={1000} // 1km radius
                pathOptions={{
                  color: getRiskColor(zone.currentRiskScore),
                  fillColor: getRiskColor(zone.currentRiskScore),
                  fillOpacity: 0.3,
                  weight: 2
                }}
              />

              {/* Marker */}
              <Marker position={[zone.centerLat, zone.centerLon]}>
                <Popup>
                  <Card className="p-3 min-w-[250px] border-0 shadow-none">
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

                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="text-center p-2 bg-secondary/30 rounded">
                        <p className="text-xl font-bold" style={{ color: getRiskColor(zone.currentRiskScore) }}>
                          {zone.currentRiskScore.toFixed(1)}
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Risk
                        </p>
                      </div>

                      <div className="text-center p-2 bg-secondary/30 rounded">
                        <p className="text-xl font-bold text-primary">
                          {zone.avgFloodDepth.toFixed(1)}"
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                          <Droplets className="h-2.5 w-2.5" />
                          Depth
                        </p>
                      </div>

                      <div className="text-center p-2 bg-secondary/30 rounded">
                        <p className="text-xl font-bold text-accent">
                          {zone.predictedRainfall.toFixed(1)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Rain(mm)
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-2">
                      Updated: {new Date(zone.lastUpdated).toLocaleTimeString()}
                    </p>
                  </Card>
                </Popup>
              </Marker>
            </div>
          ))}
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg z-[1000]">
          <h4 className="text-xs font-semibold mb-2">Risk Levels</h4>
          <div className="space-y-1">
            {[
              { label: 'Low', color: '#22c55e' },
              { label: 'Moderate', color: '#f59e0b' },
              { label: 'High', color: '#f97316' },
              { label: 'Critical', color: '#ef4444' }
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2 text-xs">
                <div
                  className="w-4 h-4 rounded-full border-2"
                  style={{ borderColor: color, backgroundColor: `${color}33` }}
                />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloodMap;
