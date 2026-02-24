import { useState, useEffect } from "react";
import apiClient from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Car, MapPin, AlertCircle, CheckCircle, Navigation } from "lucide-react";

interface DriverPanelProps {
  userId?: string;
}

const DriverPanel = ({ userId }: DriverPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [driver, setDriver] = useState<any>(null);
  const [currentJob, setCurrentJob] = useState<any>(null);

  useEffect(() => {
    if (!userId) return;
    fetchDriverDetails();
    const interval = window.setInterval(fetchDriverDetails, 10000);
    return () => window.clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    if (!driver?._id) return;
    fetchCurrentJob();
    const interval = window.setInterval(fetchCurrentJob, 8000);
    return () => window.clearInterval(interval);
  }, [driver?._id]);

  const fetchDriverDetails = async () => {
    if (!userId) return;
    try {
      const response: any = await apiClient.getDriverByUser(userId);
      setDriver(response?.data?.driver || null);
    } catch (error) {
      console.error("Error fetching driver:", error);
    }
  };

  const fetchCurrentJob = async () => {
    if (!driver?._id) return;
    try {
      const response: any = await apiClient.getDriverCurrentJob(driver._id);
      setCurrentJob(response?.data?.incident || null);
    } catch (error) {
      console.error("Error fetching job:", error);
    }
  };

  const updateStatus = async (status: "available" | "busy" | "offline") => {
    if (!driver) return;
    setLoading(true);
    try {
      await apiClient.updateDriverStatus(driver._id, status);
      toast.success(`Status updated to ${status}`);
      fetchDriverDetails();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const updateJobStatus = async (status: "assigned" | "in_progress" | "completed" | "cancelled" | "pending") => {
    if (!currentJob) return;
    setLoading(true);
    try {
      await apiClient.updateIncidentStatus(currentJob._id, status);
      toast.success(`Job status updated to ${status}`);
      fetchCurrentJob();
    } catch {
      toast.error("Failed to update job status");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): "default" | "destructive" | "success" | "warning" => {
    switch (status) {
      case "available":
        return "success";
      case "busy":
        return "warning";
      case "offline":
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
          <Car className="h-6 w-6 text-primary" />
          Driver Control Panel
        </h2>
        <p className="text-sm text-muted-foreground">Manage emergency response jobs</p>
      </div>

      {driver && (
        <div className="mb-4 p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium">Vehicle</p>
              <p className="text-lg font-bold">{driver.vehicleId?.vehicleNumber || "Not assigned"}</p>
              <p className="text-xs text-muted-foreground">{driver.vehicleId?.vehicleType || "N/A"}</p>
            </div>
            <Badge variant={getStatusColor(driver.status)}>
              {driver.status.toUpperCase()}
            </Badge>
          </div>

          <div className="flex gap-2">
            <Button
              variant={driver.status === "available" ? "default" : "outline"}
              size="sm"
              onClick={() => updateStatus("available")}
              disabled={loading}
              className="flex-1"
            >
              Available
            </Button>
            <Button
              variant={driver.status === "offline" ? "default" : "outline"}
              size="sm"
              onClick={() => updateStatus("offline")}
              disabled={loading}
              className="flex-1"
            >
              Offline
            </Button>
          </div>
        </div>
      )}

      {currentJob ? (
        <div className="space-y-4 flex-1">
          <div className="p-4 bg-danger/10 border border-danger rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-danger" />
                Active Emergency
              </h3>
              <Badge variant="default">
                {currentJob.status.replace("_", " ").toUpperCase()}
              </Badge>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Emergency Type</p>
                <p className="font-medium capitalize">{currentJob.emergencyType?.replace("_", " ")}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Citizen</p>
                <p className="font-medium">{currentJob.citizenId?.fullName || "Unknown"}</p>
                {currentJob.citizenId?.phone && (
                  <p className="text-sm">{currentJob.citizenId.phone}</p>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Location
                </p>
                <p className="text-sm font-mono bg-muted p-2 rounded">
                  {currentJob.locationLat.toFixed(4)}°N, {currentJob.locationLon.toFixed(4)}°E
                </p>
              </div>

              {currentJob.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-sm">{currentJob.description}</p>
                </div>
              )}

              {currentJob.safeRoute && (
                <div className="p-3 bg-success/10 border border-success/30 rounded-md">
                  <p className="text-sm font-semibold mb-2 text-success">✓ Safe Route Available</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Distance</p>
                      <p className="font-medium">{currentJob.safeRoute.totalDistance} km</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg Risk</p>
                      <p className="font-medium">{currentJob.safeRoute.avgRiskScore}/10</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Waypoints</p>
                      <p className="font-medium">{currentJob.safeRoute.waypoints?.length || 0}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {currentJob.status === "assigned" && (
                <Button
                  onClick={() => updateJobStatus("in_progress")}
                  disabled={loading}
                  className="w-full gradient-safe"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Start Navigation
                </Button>
              )}

              {currentJob.status === "in_progress" && (
                <Button
                  onClick={() => updateJobStatus("completed")}
                  disabled={loading}
                  className="w-full bg-success hover:bg-success/90"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Completed
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <Car className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No Active Jobs</p>
            <p className="text-sm text-muted-foreground">
              {driver?.status === "available"
                ? "Waiting for emergency assignments..."
                : "Set status to Available to receive jobs"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverPanel;
