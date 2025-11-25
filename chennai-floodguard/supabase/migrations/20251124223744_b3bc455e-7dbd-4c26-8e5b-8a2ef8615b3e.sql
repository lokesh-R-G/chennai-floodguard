-- Create user roles enum
CREATE TYPE public.user_role AS ENUM ('citizen', 'driver', 'pharmacist');

-- Create incident status enum
CREATE TYPE public.incident_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');

-- Create driver status enum
CREATE TYPE public.driver_status AS ENUM ('available', 'busy', 'offline');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'citizen',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create flood zones table
CREATE TABLE public.flood_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name TEXT NOT NULL,
  center_lat DECIMAL(10, 8) NOT NULL,
  center_lon DECIMAL(11, 8) NOT NULL,
  avg_flood_depth DECIMAL(8, 2) DEFAULT 0,
  current_risk_score DECIMAL(3, 1) DEFAULT 0,
  predicted_rainfall DECIMAL(8, 2) DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vehicles table
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number TEXT NOT NULL UNIQUE,
  vehicle_type TEXT NOT NULL,
  capacity INTEGER DEFAULT 4,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create drivers table
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  current_lat DECIMAL(10, 8),
  current_lon DECIMAL(11, 8),
  status driver_status DEFAULT 'offline',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create incidents table
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  location_lat DECIMAL(10, 8) NOT NULL,
  location_lon DECIMAL(11, 8) NOT NULL,
  emergency_type TEXT NOT NULL,
  description TEXT,
  assigned_driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  status incident_status DEFAULT 'pending',
  safe_route JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create camps table
CREATE TABLE public.camps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location_lat DECIMAL(10, 8) NOT NULL,
  location_lon DECIMAL(11, 8) NOT NULL,
  address TEXT,
  capacity INTEGER DEFAULT 0,
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create inventory table
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id UUID REFERENCES public.camps(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'units',
  min_threshold INTEGER DEFAULT 10,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flood_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for flood_zones (public read, system write)
CREATE POLICY "Anyone can view flood zones" ON public.flood_zones FOR SELECT USING (true);

-- RLS Policies for vehicles (public read)
CREATE POLICY "Anyone can view vehicles" ON public.vehicles FOR SELECT USING (true);

-- RLS Policies for drivers
CREATE POLICY "Anyone can view drivers" ON public.drivers FOR SELECT USING (true);
CREATE POLICY "Drivers can update own status" ON public.drivers FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for incidents
CREATE POLICY "Anyone can view incidents" ON public.incidents FOR SELECT USING (true);
CREATE POLICY "Citizens can create incidents" ON public.incidents FOR INSERT WITH CHECK (auth.uid() = citizen_id);
CREATE POLICY "Citizens can update own incidents" ON public.incidents FOR UPDATE USING (auth.uid() = citizen_id);
CREATE POLICY "Drivers can update assigned incidents" ON public.incidents FOR UPDATE USING (
  auth.uid() IN (SELECT id FROM public.drivers WHERE id = assigned_driver_id)
);

-- RLS Policies for camps
CREATE POLICY "Anyone can view camps" ON public.camps FOR SELECT USING (true);

-- RLS Policies for inventory
CREATE POLICY "Anyone can view inventory" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "Pharmacists can update inventory" ON public.inventory FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'pharmacist')
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample flood zones for Chennai
INSERT INTO public.flood_zones (zone_name, center_lat, center_lon, avg_flood_depth, current_risk_score) VALUES
  ('T. Nagar', 13.0418, 80.2341, 2.5, 6.5),
  ('Velachery', 12.9756, 80.2207, 4.0, 8.2),
  ('Adyar', 13.0067, 80.2570, 3.2, 7.0),
  ('Anna Nagar', 13.0850, 80.2101, 1.8, 5.5),
  ('Mylapore', 13.0339, 80.2707, 2.0, 6.0),
  ('Tambaram', 12.9249, 80.1000, 3.5, 7.5),
  ('Porur', 13.0358, 80.1559, 2.8, 6.8),
  ('Perungudi', 12.9611, 80.2429, 3.8, 7.8),
  ('Sholinganallur', 12.9010, 80.2279, 4.5, 8.5),
  ('Madipakkam', 12.9622, 80.1986, 3.0, 7.2);

-- Insert sample vehicles
INSERT INTO public.vehicles (vehicle_number, vehicle_type, capacity) VALUES
  ('TN-01-AB-1234', 'Ambulance', 6),
  ('TN-01-CD-5678', 'Rescue Van', 8),
  ('TN-01-EF-9012', 'Ambulance', 6),
  ('TN-01-GH-3456', 'Rescue Truck', 12),
  ('TN-01-IJ-7890', 'Ambulance', 6);