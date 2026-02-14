import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LogOut, Shield } from "lucide-react";
import FloodMap from "@/components/FloodMap";
import CitizenPanel from "@/components/CitizenPanel";
import DriverPanel from "@/components/DriverPanel";
import PharmacistPanel from "@/components/PharmacistPanel";

interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      navigate("/auth");
      return;
    }

    const stored = localStorage.getItem("auth_user");
    if (stored) {
      try {
        setProfile(JSON.parse(stored));
      } catch {
        navigate("/auth");
      }
    } else {
      navigate("/auth");
    }
    setLoading(false);
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      apiClient.clearAuthToken();
      toast.success("Signed out successfully");
      navigate("/auth");
    } catch {
      toast.error("Failed to sign out");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-lg text-muted-foreground">Loading emergency response system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Chennai Flood Response</h1>
              <p className="text-xs text-muted-foreground">Emergency Management System</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{profile?.fullName}</p>
              <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-80px)]">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
          <FloodMap />
        </div>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {profile?.role === "citizen" && <CitizenPanel userId={profile?.id} />}
          {profile?.role === "driver" && <DriverPanel userId={profile?.id} />}
          {profile?.role === "pharmacist" && <PharmacistPanel userId={profile?.id} />}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
