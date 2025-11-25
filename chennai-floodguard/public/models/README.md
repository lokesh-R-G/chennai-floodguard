# Weather Prediction Models

This directory contains the pretrained LSTM model and related scripts for weather prediction.

## Files

- `weather_lstm_model.keras` - Pretrained LSTM model for next-hour rainfall prediction
- `chennai_realtime_flood_heatmap.py` - Standalone script for generating flood heatmaps
- `weather_prediction_api.py` - Flask API service for real-time predictions
- `requirements.txt` - Python dependencies

## Setup Python API Service

To use the pretrained LSTM model with the frontend:

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Start the API service:**
   ```bash
   python weather_prediction_api.py
   ```
   
   The service will start on `http://localhost:5000` by default.

3. **Configure Supabase Edge Function:**
   
   Set the environment variable in your Supabase project:
   ```
   PYTHON_LSTM_SERVICE_URL=http://your-python-service-url:5000
   ```
   
   Or deploy the Python service to a cloud provider (Heroku, Railway, Render, etc.) and use that URL.

4. **Test the API:**
   ```bash
   curl -X POST http://localhost:5000/predict \
     -H "Content-Type: application/json" \
     -d '{"lat": 13.0878, "lon": 80.2785}'
   ```

## API Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true
}
```

### `POST /predict`
Predict next-hour rainfall for a single location.

**Request:**
```json
{
  "lat": 13.0878,
  "lon": 80.2785
}
```

**Response:**
```json
{
  "success": true,
  "predicted_rainfall_mm": 12.5
}
```

### `POST /predict/batch`
Predict next-hour rainfall for multiple locations.

**Request:**
```json
{
  "locations": [
    {"lat": 13.0878, "lon": 80.2785},
    {"lat": 13.0418, "lon": 80.2341}
  ]
}
```

**Response:**
```json
{
  "success": true,
  "predictions": [
    {"lat": 13.0878, "lon": 80.2785, "predicted_rainfall_mm": 12.5},
    {"lat": 13.0418, "lon": 80.2341, "predicted_rainfall_mm": 8.3}
  ]
}
```

## Integration with Frontend

The Supabase Edge Function (`supabase/functions/predict-weather/index.ts`) will automatically:
1. Try to call the Python LSTM service if `PYTHON_LSTM_SERVICE_URL` is configured
2. Fall back to a simple time-series prediction if the service is unavailable

The frontend can trigger predictions by clicking the "Predict Weather" button in the FloodMap component.

## Standalone Script Usage

To run the standalone flood heatmap script:

```bash
python chennai_realtime_flood_heatmap.py \
  --kml path/to/chennai_flood_inundation_inches.kml \
  --model weather_lstm_model.keras \
  --zones 12
```

