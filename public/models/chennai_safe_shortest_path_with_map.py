import argparse
import math
import re
from pathlib import Path
from typing import List, Tuple

import networkx as nx
import requests
import folium


# ============================================================
# 1. LOAD FLOOD POINTS FROM KML
# ============================================================

def load_flood_points_from_kml(kml_path: Path) -> List[Tuple[float, float]]:
    text = kml_path.read_text(encoding="utf-8", errors="ignore")
    pattern = re.compile(r"(-?\d+\.\d+),(-?\d+\.\d+)")
    matches = pattern.findall(text)

    points = []
    for lon_str, lat_str in matches:
        points.append((float(lat_str), float(lon_str)))

    points = list(dict.fromkeys(points))

    if not points:
        raise ValueError("No coordinates found in KML")

    print(f"Loaded {len(points)} flood points")
    return points


# ============================================================
# 2. BASIC DISTANCE HELPERS
# ============================================================

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    from math import radians, sin, cos, sqrt, atan2

    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)

    a = sin(d_lat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(d_lon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c


def min_distance_to_flood(lat, lon, flood_points):
    return min(haversine_km(lat, lon, f[0], f[1]) for f in flood_points)


# ============================================================
# 3. BUILD ROAD GRAPH USING OVERPASS (NO OSMNX)
# ============================================================

def build_flood_weighted_graph_overpass(
    flood_points,
    margin=0.02,
    alpha=5.0,
    max_risk_dist_km=0.5
):
    lats = [p[0] for p in flood_points]
    lons = [p[1] for p in flood_points]

    south = min(lats) - margin
    north = max(lats) + margin
    west = min(lons) - margin
    east = max(lons) + margin

    print(f"Querying Overpass API for bbox {south},{west},{north},{east}")

    query = f"""
    [out:json][timeout:180];
    (
      way["highway"]({south},{west},{north},{east});
      >;
    );
    out body;
    """

    resp = requests.post("https://overpass-api.de/api/interpreter",
                         data={"data": query})
    resp.raise_for_status()
    data = resp.json()

    nodes = {}
    ways = []

    for el in data["elements"]:
        if el["type"] == "node":
            nodes[el["id"]] = (el["lat"], el["lon"])
        elif el["type"] == "way":
            ways.append(el)

    G = nx.Graph()

    for node_id, (lat, lon) in nodes.items():
        G.add_node(node_id, lat=lat, lon=lon)

    # Build edges
    for w in ways:
        refs = w.get("nodes", [])
        for a, b in zip(refs[:-1], refs[1:]):
            if a in nodes and b in nodes:
                lat1, lon1 = nodes[a]
                lat2, lon2 = nodes[b]
                length = haversine_km(lat1, lon1, lat2, lon2) * 1000  # convert km → meters
                G.add_edge(a, b, length=length)

    # Add flood risk weights
    for u, v, data in G.edges(data=True):
        lat_u = G.nodes[u]["lat"]
        lon_u = G.nodes[u]["lon"]
        lat_v = G.nodes[v]["lat"]
        lon_v = G.nodes[v]["lon"]

        mid_lat = (lat_u + lat_v)/2
        mid_lon = (lon_u + lon_v)/2

        d_min = min_distance_to_flood(mid_lat, mid_lon, flood_points)

        risk = 0 if d_min >= max_risk_dist_km else (1 - d_min/max_risk_dist_km)

        data["weight"] = data["length"] * (1 + alpha * risk)

    print("Graph ready with flood-weighted costs.")
    return G


# ============================================================
# 4. SAFEST–SHORTEST PATH
# ============================================================

def find_nearest_node(G, lat, lon):
    best_node = None
    best_dist = float("inf")

    for n, d in G.nodes(data=True):
        d_km = haversine_km(lat, lon, d["lat"], d["lon"])
        if d_km < best_dist:
            best_dist = d_km
            best_node = n

    return best_node


def compute_safe_path(G, start_lat, start_lon, end_lat, end_lon):
    start_node = find_nearest_node(G, start_lat, start_lon)
    end_node = find_nearest_node(G, end_lat, end_lon)

    print("Finding safest route...")
    path = nx.shortest_path(G, start_node, end_node, weight="weight")

    route = [(G.nodes[n]["lat"], G.nodes[n]["lon"]) for n in path]
    return route


# ============================================================
# 5. DRAW ROUTE ON MAP (FOLIUM)
# ============================================================

def draw_map(coords, output_html):
    mid = len(coords)//2
    m = folium.Map(location=[coords[mid][0], coords[mid][1]], zoom_start=14)

    folium.PolyLine(coords, color="blue", weight=6).add_to(m)

    folium.Marker(coords[0], icon=folium.Icon(color="green"), popup="Start").add_to(m)
    folium.Marker(coords[-1], icon=folium.Icon(color="red"), popup="Destination").add_to(m)

    m.save(output_html)
    print(f"Map saved → {output_html}")


# ============================================================
# 6. ASK USER FOR INPUT
# ============================================================

def ask_point(name):
    print(f"\nEnter {name} Coordinates:")
    lat = float(input("  Latitude : "))
    lon = float(input("  Longitude: "))
    return lat, lon


# ============================================================
# 7. MAIN
# ============================================================

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kml", default="chennai_flood_inundation_inches.kml")
    parser.add_argument("--output-html", default="safe_route_map.html")
    parser.add_argument("--output-coords", default="safe_route_coords.txt")
    args = parser.parse_args()

    flood_points = load_flood_points_from_kml(Path(args.kml))

    G = build_flood_weighted_graph_overpass(flood_points)

    start_lat, start_lon = ask_point("START")
    end_lat, end_lon = ask_point("DESTINATION")

    route = compute_safe_path(G, start_lat, start_lon, end_lat, end_lon)

    # Save coordinates
    with open(args.output_coords, "w") as f:
        for lat, lon in route:
            f.write(f"{lat},{lon}\n")

    print(f"Route coordinates saved → {args.output_coords}")

    draw_map(route, args.output_html)

    print("\n✔ DONE — safest route computed and map generated.\n")


if __name__ == "__main__":
    main()
