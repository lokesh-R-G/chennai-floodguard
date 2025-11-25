-- Create a function to handle driver creation
CREATE OR REPLACE FUNCTION create_driver_on_profile_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_vehicle_id UUID;
BEGIN
  -- Only proceed if role is driver
  IF NEW.role = 'driver' THEN
    -- Create a default vehicle for the driver
    INSERT INTO vehicles (vehicle_type, vehicle_number, capacity)
    VALUES ('Ambulance', 'TN-' || substr(md5(random()::text), 1, 6), 4)
    RETURNING id INTO v_vehicle_id;
    
    -- Create driver record
    INSERT INTO drivers (id, vehicle_id, status, current_lat, current_lon)
    VALUES (NEW.id, v_vehicle_id, 'offline', 13.0827, 80.2707);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new profiles
DROP TRIGGER IF EXISTS create_driver_trigger ON profiles;
CREATE TRIGGER create_driver_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_driver_on_profile_insert();

-- Backfill existing driver profiles
DO $$
DECLARE
  profile_record RECORD;
  v_vehicle_id UUID;
BEGIN
  FOR profile_record IN 
    SELECT p.id 
    FROM profiles p 
    LEFT JOIN drivers d ON p.id = d.id 
    WHERE p.role = 'driver' AND d.id IS NULL
  LOOP
    -- Create vehicle
    INSERT INTO vehicles (vehicle_type, vehicle_number, capacity)
    VALUES ('Ambulance', 'TN-' || substr(md5(random()::text), 1, 6), 4)
    RETURNING id INTO v_vehicle_id;
    
    -- Create driver
    INSERT INTO drivers (id, vehicle_id, status, current_lat, current_lon)
    VALUES (profile_record.id, v_vehicle_id, 'available', 13.0827, 80.2707);
  END LOOP;
END $$;

-- Create function to auto-assign nearest available driver
CREATE OR REPLACE FUNCTION auto_assign_driver()
RETURNS TRIGGER AS $$
DECLARE
  v_nearest_driver_id UUID;
  v_min_distance NUMERIC;
BEGIN
  -- Only proceed if status is pending and no driver assigned
  IF NEW.status = 'pending' AND NEW.assigned_driver_id IS NULL THEN
    -- Find nearest available driver using Haversine formula
    SELECT d.id INTO v_nearest_driver_id
    FROM drivers d
    WHERE d.status = 'available' 
      AND d.current_lat IS NOT NULL 
      AND d.current_lon IS NOT NULL
    ORDER BY (
      6371 * acos(
        cos(radians(NEW.location_lat)) * 
        cos(radians(d.current_lat)) * 
        cos(radians(d.current_lon) - radians(NEW.location_lon)) + 
        sin(radians(NEW.location_lat)) * 
        sin(radians(d.current_lat))
      )
    ) ASC
    LIMIT 1;
    
    -- If driver found, assign them
    IF v_nearest_driver_id IS NOT NULL THEN
      NEW.assigned_driver_id := v_nearest_driver_id;
      NEW.status := 'assigned';
      
      -- Update driver status to busy
      UPDATE drivers 
      SET status = 'busy', updated_at = now()
      WHERE id = v_nearest_driver_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-assignment
DROP TRIGGER IF EXISTS auto_assign_driver_trigger ON incidents;
CREATE TRIGGER auto_assign_driver_trigger
  BEFORE INSERT OR UPDATE ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_driver();