import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LogOut, Shield, CloudRain } from "lucide-react";
import FloodMap from "@/components/FloodMap";
import CitizenPanel from "@/components/CitizenPanel";
import DriverPanel from "@/components/DriverPanel";
import PharmacistPanel from "@/components/PharmacistPanel";
import WeatherPrediction from "@/components/WeatherPrediction";

const Dashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        fetchProfile(session.user.id);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      navigate("/auth");
    } catch (error: any) {
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
            {/* Weather Prediction Widget */}
            <div className="hidden md:block">
              <WeatherPrediction lat={13.0878} lon={80.2785} />
            </div>
            
            <div className="text-right">
              <p className="text-sm font-medium">{profile?.full_name}</p>
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
        {/* Map - Takes 2 columns on large screens */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
          <FloodMap />
        </div>

        {/* Role-specific Panel */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {profile?.role === "citizen" && <CitizenPanel userId={session?.user?.id} />}
          {profile?.role === "driver" && <DriverPanel userId={session?.user?.id} />}
          {profile?.role === "pharmacist" && <PharmacistPanel userId={session?.user?.id} />}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
