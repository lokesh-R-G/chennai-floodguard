-- Fix search_path for security
CREATE OR REPLACE FUNCTION create_driver_on_profile_insert()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vehicle_id UUID;
BEGIN
  IF NEW.role = 'driver' THEN
    INSERT INTO vehicles (vehicle_type, vehicle_number, capacity)
    VALUES ('Ambulance', 'TN-' || substr(md5(random()::text), 1, 6), 4)
    RETURNING id INTO v_vehicle_id;
    
    INSERT INTO drivers (id, vehicle_id, status, current_lat, current_lon)
    VALUES (NEW.id, v_vehicle_id, 'offline', 13.0827, 80.2707);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION auto_assign_driver()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nearest_driver_id UUID;
BEGIN
  IF NEW.status = 'pending' AND NEW.assigned_driver_id IS NULL THEN
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
    
    IF v_nearest_driver_id IS NOT NULL THEN
      NEW.assigned_driver_id := v_nearest_driver_id;
      NEW.status := 'assigned';
      
      UPDATE drivers 
      SET status = 'busy', updated_at = now()
      WHERE id = v_nearest_driver_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;