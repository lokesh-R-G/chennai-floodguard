"""
Weather Prediction API Service

A Flask/FastAPI service that loads the pretrained LSTM model and provides
predictions via HTTP API. This can be called from Supabase Edge Functions
or directly from the frontend.

Usage:
    python weather_prediction_api.py

The service will:
    1. Load the pretrained LSTM model (weather_lstm_model.keras)
    2. Accept POST requests with lat/lon coordinates
    3. Fetch weather data from Open-Meteo
    4. Use LSTM model to predict next-hour rainfall
    5. Return prediction in JSON format

Example request:
    POST http://localhost:5000/predict
    {
        "lat": 13.0878,
        "lon": 80.2785
    }

Example response:
    {
        "predicted_rainfall_mm": 12.5,
        "success": true
    }
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import requests
from pathlib import Path
from tensorflow.keras.models import load_model
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global model variable
model = None
MODEL_PATH = Path(__file__).parent / "weather_lstm_model.keras"
SEQ_LEN = 24  # Sequence length expected by LSTM


def fetch_open_meteo_rain_series(lat: float, lon: float, past_hours: int = 24):
    """
    Fetch recent hourly rain series for location using Open-Meteo.
    Returns list of rain values (mm) from oldest -> latest (length up to past_hours).
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "rain",
        "past_days": 1,  # get last 24 hours
        "forecast_days": 0,
        "timezone": "Asia/Kolkata",
    }

    try:
        resp = requests.get(url, params=params, timeout=20)
        resp.raise_for_status()
        data = resp.json()

        times = data.get("hourly", {}).get("time", [])
        rains = data.get("hourly", {}).get("rain", [])

        if not times or not rains:
            return []

        pairs = sorted(zip(times, rains), key=lambda x: x[0])
        recent = pairs[-past_hours:]
        series = [float(r) for _, r in recent]
        return series
    except Exception as e:
        print(f"Error fetching Open-Meteo data: {e}")
        return []


def build_lstm_input(rain_series, seq_len: int = 24):
    """
    Build input tensor for LSTM (shape: (1, seq_len, 1)) from 1D rain series.
    Left-pad with zeros if not enough history.
    """
    arr = np.array(rain_series, dtype="float32")
    if len(arr) < seq_len:
        pad_len = seq_len - len(arr)
        arr = np.concatenate([np.zeros(pad_len, dtype="float32"), arr])
    else:
        arr = arr[-seq_len:]
    return arr.reshape(1, seq_len, 1)


def predict_next_rain(lat: float, lon: float, seq_len: int = 24) -> float:
    """
    Use LSTM model to predict next-hour rainfall for a given location.
    """
    if model is None:
        raise ValueError("Model not loaded")
    
    series = fetch_open_meteo_rain_series(lat, lon, past_hours=seq_len)
    if not series:
        return 0.0
    
    x = build_lstm_input(series, seq_len=seq_len)
    y = model.predict(x, verbose=0)
    pred = float(y.squeeze())
    return max(pred, 0.0)  # no negative rain


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "model_loaded": model is not None
    })


@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict next-hour rainfall for given coordinates.
    
    Request body:
        {
            "lat": float,
            "lon": float
        }
    
    Response:
        {
            "predicted_rainfall_mm": float,
            "success": bool,
            "error": str (if failed)
        }
    """
    try:
        if model is None:
            return jsonify({
                "success": False,
                "error": "Model not loaded"
            }), 500

        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400

        lat = float(data.get("lat"))
        lon = float(data.get("lon"))

        if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
            return jsonify({
                "success": False,
                "error": "Invalid coordinates"
            }), 400

        predicted_rain = predict_next_rain(lat, lon, SEQ_LEN)

        return jsonify({
            "success": True,
            "predicted_rainfall_mm": round(predicted_rain, 2)
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """
    Predict next-hour rainfall for multiple coordinates.
    
    Request body:
        {
            "locations": [
                {"lat": float, "lon": float},
                ...
            ]
        }
    
    Response:
        {
            "success": bool,
            "predictions": [
                {"lat": float, "lon": float, "predicted_rainfall_mm": float},
                ...
            ]
        }
    """
    try:
        if model is None:
            return jsonify({
                "success": False,
                "error": "Model not loaded"
            }), 500

        data = request.get_json()
        if not data or "locations" not in data:
            return jsonify({
                "success": False,
                "error": "No locations provided"
            }), 400

        locations = data["locations"]
        predictions = []

        for loc in locations:
            lat = float(loc.get("lat"))
            lon = float(loc.get("lon"))
            predicted_rain = predict_next_rain(lat, lon, SEQ_LEN)
            predictions.append({
                "lat": lat,
                "lon": lon,
                "predicted_rainfall_mm": round(predicted_rain, 2)
            })

        return jsonify({
            "success": True,
            "predictions": predictions
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


def load_model_once():
    """Load the LSTM model on startup"""
    global model
    try:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")
        
        print(f"Loading LSTM model from {MODEL_PATH}...")
        model = load_model(str(MODEL_PATH))
        print("Model loaded successfully!")
    except Exception as e:
        print(f"Error loading model: {e}")
        model = None


if __name__ == '__main__':
    # Load model on startup
    load_model_once()
    
    if model is None:
        print("WARNING: Model not loaded. Predictions will fail.")
        print(f"Please ensure the model file exists at: {MODEL_PATH}")
    
    # Get port from environment or default to 5000
    port = int(os.environ.get('PORT', 5000))
    
    print(f"\nStarting Weather Prediction API on port {port}")
    print("Endpoints:")
    print("  GET  /health - Health check")
    print("  POST /predict - Predict for single location")
    print("  POST /predict/batch - Predict for multiple locations")
    print("\nExample request:")
    print('  curl -X POST http://localhost:5000/predict \\')
    print('    -H "Content-Type: application/json" \\')
    print('    -d \'{"lat": 13.0878, "lon": 80.2785}\'')
    print()
    
    app.run(host='0.0.0.0', port=port, debug=False)

