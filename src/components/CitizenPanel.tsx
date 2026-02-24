import { useState, useEffect } from "react";
import apiClient from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertCircle, MapPin, Navigation, Car, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CitizenPanelProps {
  userId?: string;
}

const CitizenPanel = ({ userId }: CitizenPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [emergencyType, setEmergencyType] = useState("medical");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [activeIncident, setActiveIncident] = useState<any>(null);

  useEffect(() => {
    if (userId) {
      fetchActiveIncident();
      const interval = window.setInterval(fetchActiveIncident, 10000);
      return () => window.clearInterval(interval);
    }
  }, [userId]);

  const fetchActiveIncident = async () => {
    if (!userId) return;
    try {
      const response: any = await apiClient.getCitizenActiveIncident(userId);
      setActiveIncident(response?.data?.incident || null);
    } catch (error) {
      console.error("Error fetching incident:", error);
    }
  };

  const getCurrentLocation = () => {
    setLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          toast.success("Location acquired");
          setLoading(false);
        },
        (error) => {
          toast.error("Failed to get location: " + error.message);
          setLoading(false);
        }
      );
    } else {
      toast.error("Geolocation not supported");
      setLoading(false);
    }
  };

  const handleEmergencyAlert = async () => {
    if (!location) {
      toast.error("Please get your location first");
      return;
    }

    setLoading(true);
    try {
      await apiClient.createIncident({
        locationLat: location.lat,
        locationLon: location.lon,
        emergencyType,
        description,
      });

      toast.success("Emergency alert sent! Help is on the way.");
      setDescription("");
      fetchActiveIncident();
    } catch (error: any) {
      toast.error("Failed to send alert: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
          <AlertCircle className="h-6 w-6 text-danger" />
          Citizen Emergency Panel
        </h2>
        <p className="text-sm text-muted-foreground">
          Request emergency assistance during flood situations
        </p>
      </div>

      {activeIncident ? (
        <div className="space-y-4">
          <div className="p-4 bg-primary/10 border border-primary rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Active Emergency</h3>
              <Badge variant="default" className="pulse-danger">
                {activeIncident.status.replace("_", " ").toUpperCase()}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Type: <span className="font-medium capitalize">{activeIncident.emergencyType?.replace("_", " ")}</span>
              </p>
              
              {activeIncident.assignedDriverId && (
                <>
                  <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded">
                    <p className="font-medium flex items-center gap-2 mb-2">
                      <Check className="h-4 w-4 text-success" />
                      Driver Assigned
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vehicle: {activeIncident.assignedDriverId.vehicleId?.vehicleNumber || "Not assigned"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Type: {activeIncident.assignedDriverId.vehicleId?.vehicleType || "Not assigned"}
                    </p>
                  </div>
                </>
              )}
              
              {!activeIncident.assignedDriverId && (
                <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded">
                  <p className="text-sm flex items-center gap-2">
                    <Car className="h-4 w-4 text-warning animate-pulse" />
                    Searching for nearest available driver...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 flex-1">
          <div className="space-y-2">
            <Label>Your Location</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={getCurrentLocation}
                disabled={loading}
                className="flex-1"
              >
                <Navigation className="h-4 w-4 mr-2" />
                {location ? "Update Location" : "Get My Location"}
              </Button>
              {location && (
                <Badge variant="success" className="flex items-center gap-1 px-3">
                  <MapPin className="h-3 w-3" />
                  Acquired
                </Badge>
              )}
            </div>
            {location && (
              <p className="text-xs text-muted-foreground">
                {location.lat.toFixed(4)}°N, {location.lon.toFixed(4)}°E
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Emergency Type</Label>
            <Select value={emergencyType} onValueChange={setEmergencyType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="medical">Medical Emergency</SelectItem>
                <SelectItem value="rescue">Water Rescue</SelectItem>
                <SelectItem value="evacuation">Evacuation Request</SelectItem>
                <SelectItem value="shelter">Need Shelter</SelectItem>
                <SelectItem value="supplies">Need Supplies</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description (Optional)</Label>
            <Textarea
              placeholder="Provide additional details about your situation..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <Button
            onClick={handleEmergencyAlert}
            disabled={loading || !location}
            className="w-full gradient-emergency text-white font-bold py-6 text-lg"
            size="lg"
          >
            <AlertCircle className="h-6 w-6 mr-2" />
            SEND EMERGENCY ALERT
          </Button>

          <div className="p-3 bg-muted/50 border border-border rounded text-xs text-muted-foreground">
            <strong>Note:</strong> Emergency alerts are monitored 24/7. Please only use for genuine emergencies.
          </div>
        </div>
      )}
    </div>
  );
};

export default CitizenPanel;
