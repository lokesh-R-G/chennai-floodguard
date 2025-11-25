"""
chennai_realtime_flood_heatmap.py

Pipeline:
  1. Load Chennai flood inundation points from KML.
  2. Cluster points into zones (hotspots) using K-Means on lat/lon.
  3. For each zone center:
       - Fetch recent rain series from Open-Meteo.
       - Use pretrained LSTM model to predict next-hour rainfall.
  4. Combine predicted rain + historical avg depth per zone
     => compute real-time flood risk score (0–10).
  5. Render a Folium Chennai zone heatmap with zone colors based on current risk.

Run example:
  python chennai_realtime_flood_heatmap.py \
      --kml chennai_flood_inundation_inches.kml \
      --model weather_lstm_model.keras \
      --zones 12
"""

import argparse
from pathlib import Path
import math
import xml.etree.ElementTree as ET

import numpy as np
import pandas as pd
import requests
from sklearn.cluster import KMeans
import folium
from tensorflow.keras.models import load_model


# ------------------------ 1. KML → FLOOD POINTS ------------------------ #

def load_flood_points_from_kml(kml_path: Path) -> pd.DataFrame:
    """
    Parse KML of Chennai flood points.

    Expected ExtendedData / SimpleData fields (typical):
      - OBJECTID
      - DEPTH (inches)
      - F_LATITUDE
      - F_LONGITUDE
      - F_REMARKS (description)

    Also reads geometry from <Point><coordinates>.
    Returns a DataFrame with columns:
      [objectid, lat, lon, depth_in, remarks]
    """
    ns = {"kml": "http://www.opengis.net/kml/2.2"}
    tree = ET.parse(kml_path)
    root = tree.getroot()
    placemarks = root.findall(".//kml:Placemark", ns)

    rows = []
    for pm in placemarks:
        # ExtendedData / SchemaData / SimpleData
        schema = pm.find("kml:ExtendedData/kml:SchemaData", ns)
        fields = {}
        if schema is not None:
            for sd in schema.findall("kml:SimpleData", ns):
                name = sd.get("name")
                val = sd.text.strip() if sd.text else None
                fields[name] = val

        # Coordinates from Point
        coord_elem = pm.find("kml:Point/kml:coordinates", ns)
        lat = lon = None
        if coord_elem is not None and coord_elem.text:
            parts = coord_elem.text.strip().split(",")
            if len(parts) >= 2:
                lon = float(parts[0])
                lat = float(parts[1])

        # F_LATITUDE / F_LONGITUDE override if present
        if "F_LATITUDE" in fields:
            try:
                lat = float(fields["F_LATITUDE"])
            except (TypeError, ValueError):
                pass
        if "F_LONGITUDE" in fields:
            try:
                lon = float(fields["F_LONGITUDE"])
            except (TypeError, ValueError):
                pass

        if lat is None or lon is None:
            continue  # skip invalid points

        # OBJECTID
        objid = fields.get("OBJECTID")
        try:
            objid = int(objid) if objid is not None else None
        except ValueError:
            objid = None

        # DEPTH (inches)
        depth_str = fields.get("DEPTH")
        try:
            depth_in = float(depth_str) if depth_str is not None else 0.0
        except ValueError:
            depth_in = 0.0

        # remarks
        remarks = fields.get("F_REMARKS", "")

        rows.append({
            "objectid": objid,
            "lat": lat,
            "lon": lon,
            "DEPTH": depth_in,
            "remarks": remarks,
        })

    df = pd.DataFrame(rows)
    # Clean up NaNs
    df["DEPTH"] = pd.to_numeric(df["DEPTH"], errors="coerce").fillna(0.0)
    df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
    df["lon"] = pd.to_numeric(df["lon"], errors="coerce")
    df = df.dropna(subset=["lat", "lon"])
    df = df.reset_index(drop=True)

    print(f"Loaded {len(df)} flood points from {kml_path}")
    return df


# ------------------------ 2. CLUSTER POINTS → ZONES ------------------------ #

def cluster_points_into_zones(points_df: pd.DataFrame, num_zones: int = 12):
    """
    Cluster point lat/lon into `num_zones` using KMeans.
    Returns:
      - points_with_zone: original df + 'zone_id' column
      - zone_summary: per zone aggregated info:
          zone_id, center_lat, center_lon, avg_depth_in, num_points
    """
    df = points_df.copy()
    coords = df[["lat", "lon"]].to_numpy()

    kmeans = KMeans(n_clusters=num_zones, random_state=42, n_init=10)
    df["zone_id"] = kmeans.fit_predict(coords)

    zone_rows = []
    for z in range(num_zones):
        sub = df[df["zone_id"] == z]
        if sub.empty:
            continue
        center_lat = sub["lat"].mean()
        center_lon = sub["lon"].mean()
        avg_depth = sub["DEPTH"].mean()
        zone_rows.append({
            "zone_id": z,
            "center_lat": center_lat,
            "center_lon": center_lon,
            "avg_depth_in": avg_depth,
            "num_points": len(sub),
        })

    zone_summary = pd.DataFrame(zone_rows)
    print(f"Created {len(zone_summary)} zones from {len(points_df)} points.")
    return df, zone_summary


# ------------------------ 3. OPEN-METEO + LSTM PREDICTION ------------------------ #

def fetch_open_meteo_rain_series(lat: float, lon: float, past_hours: int = 24):
    """
    Fetch recent hourly rain series for location using Open-Meteo.
    Returns list of rain values (mm) from oldest -> latest (length up to past_hours).
    """
    url = "https://api.open-meteo.com/v1/forecast?latitude=13.0878&longitude=80.2785&hourly=temperature_2m,rain,showers,precipitation&minutely_15=precipitation,rain"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "rain",
        "past_days": 1,         # get last 24 hours
        "forecast_days": 0,
        "timezone": "Asia/Kolkata",
    }

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


def predict_next_rain(model, lat: float, lon: float, seq_len: int = 24) -> float:
    """
    Use LSTM model to predict next-hour rainfall for a given location.
    """
    series = fetch_open_meteo_rain_series(lat, lon, past_hours=seq_len)
    if not series:
        return 0.0
    x = build_lstm_input(series, seq_len=seq_len)
    y = model.predict(x, verbose=0)
    pred = float(y.squeeze())
    return max(pred, 0.0)  # no negative rain


# ------------------------ 4. RISK SCORING ------------------------ #

def compute_risk_score(avg_depth_in: float, pred_rain_mm: float) -> float:
    """
    Simple flood risk score 0–10 based on:
      - avg_depth_in (historical depth in inches)
      - pred_rain_mm (LSTM predicted rain in mm)
    depth_norm: 0..1 from 0..60 in
    rain_norm:  0..1 from 0..200 mm
    risk = (0.6 * rain_norm + 0.4 * depth_norm) * 10
    """
    depth_norm = min(max((avg_depth_in or 0.0) / 60.0, 0.0), 1.0)
    rain_norm = min(max(pred_rain_mm / 200.0, 0.0), 1.0)
    raw = 0.6 * rain_norm + 0.4 * depth_norm
    return round(raw * 10.0, 2)


def risk_to_color(risk: float) -> str:
    if risk >= 7:
        return "red"
    elif risk >= 4:
        return "orange"
    else:
        return "green"


# ------------------------ 5. FOLIUM HEATMAP ------------------------ #

def build_zone_heatmap(zone_df: pd.DataFrame, output_html: Path):
    """
    Build a Folium map for Chennai zones with color-coded risk.
    """
    center_lat = zone_df["center_lat"].mean()
    center_lon = zone_df["center_lon"].mean()
    m = folium.Map(location=[center_lat, center_lon], zoom_start=11)

    for _, row in zone_df.iterrows():
        color = risk_to_color(row["risk_score"])
        popup = (
            f"Zone: {row['zone_id']}<br>"
            f"Avg Depth: {row['avg_depth_in']:.2f} in<br>"
            f"LSTM Predicted Rain: {row['pred_rain_mm']:.2f} mm<br>"
            f"Risk Score: {row['risk_score']:.2f}<br>"
            f"Points in zone: {row['num_points']}"
        )
        folium.CircleMarker(
            location=[row["center_lat"], row["center_lon"]],
            radius=10,
            popup=popup,
            color=color,
            fill=True,
            fill_color=color,
            fill_opacity=0.7,
        ).add_to(m)

    m.save(str(output_html))
    print(f"Saved real-time Chennai zone heatmap -> {output_html}")


# ------------------------ 6. MAIN ------------------------ #

def main():
    parser = argparse.ArgumentParser(
        description="Real-time Chennai zone flood heatmap using LSTM + Open-Meteo + KML."
    )
    parser.add_argument("--kml", type=str, required=True,
                        help="Path to Chennai flood inundation KML (chennai_flood_inundation_inches.kml)")
    parser.add_argument("--model", type=str, default="weather_lstm_model.keras",
                        help="Path to pretrained LSTM model (.keras)")
    parser.add_argument("--zones", type=int, default=12,
                        help="Number of zones (clusters) to create")
    parser.add_argument("--seq-len", type=int, default=24,
                        help="Sequence length (hours) expected by LSTM")
    parser.add_argument("--output-html", type=str,
                        default="chennai_realtime_zone_heatmap.html",
                        help="Output HTML for Folium heatmap")
    parser.add_argument("--output-csv", type=str,
                        default="chennai_realtime_zone_risk.csv",
                        help="Output CSV with per-zone risk")
    args = parser.parse_args()

    kml_path = Path(args.kml)
    model_path = Path(args.model)
    out_html = Path(args.output_html)
    out_csv = Path(args.output_csv)

    if not kml_path.exists():
        raise FileNotFoundError(f"KML file not found: {kml_path}")
    if not model_path.exists():
        raise FileNotFoundError(f"LSTM model not found: {model_path}")

    print(f"1) Loading flood points from KML: {kml_path}")
    points_df = load_flood_points_from_kml(kml_path)

    print(f"2) Clustering into {args.zones} zones...")
    _, zone_summary = cluster_points_into_zones(points_df, num_zones=args.zones)

    print(f"3) Loading LSTM model: {model_path}")
    model = load_model(str(model_path))
    print("   Model loaded.")

    # Predict rain + compute risk per zone
    pred_rains = []
    risks = []
    for _, row in zone_summary.iterrows():
        lat = float(row["center_lat"])
        lon = float(row["center_lon"])
        avg_depth = float(row["avg_depth_in"])

        print(f"   Zone {row['zone_id']}: predicting for ({lat:.4f}, {lon:.4f})...")
        try:
            pred_mm = predict_next_rain(model, lat, lon, seq_len=args.seq_len)
        except Exception as e:
            print(f"      Error predicting for zone {row['zone_id']}: {e}")
            pred_mm = 0.0

        risk = compute_risk_score(avg_depth, pred_mm)
        pred_rains.append(pred_mm)
        risks.append(risk)

    zone_summary["pred_rain_mm"] = pred_rains
    zone_summary["risk_score"] = risks

    # Save CSV
    zone_summary.to_csv(out_csv, index=False)
    print(f"Saved per-zone real-time risk CSV -> {out_csv}")

    # Build map
    build_zone_heatmap(zone_summary, out_html)


if __name__ == "__main__":
    main()
