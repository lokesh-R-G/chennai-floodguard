import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Location {
  lat: number
  lon: number
}

interface FloodZone {
  id: string
  center_lat: number
  center_lon: number
  current_risk_score: number
}

interface GraphNode {
  id: string
  lat: number
  lon: number
  riskScore: number
}

interface Edge {
  to: string
  weight: number
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Dijkstra's algorithm implementation
function dijkstra(
  graph: Map<string, Edge[]>,
  start: string,
  end: string,
  nodes: Map<string, GraphNode>
): string[] {
  const distances = new Map<string, number>()
  const previous = new Map<string, string | null>()
  const unvisited = new Set<string>()

  // Initialize distances
  for (const nodeId of graph.keys()) {
    distances.set(nodeId, nodeId === start ? 0 : Infinity)
    previous.set(nodeId, null)
    unvisited.add(nodeId)
  }

  while (unvisited.size > 0) {
    // Find unvisited node with minimum distance
    let current: string | null = null
    let minDistance = Infinity
    for (const nodeId of unvisited) {
      const dist = distances.get(nodeId)!
      if (dist < minDistance) {
        minDistance = dist
        current = nodeId
      }
    }

    if (!current || current === end) break
    if (minDistance === Infinity) break

    unvisited.delete(current)

    // Update distances to neighbors
    const edges = graph.get(current) || []
    for (const edge of edges) {
      if (!unvisited.has(edge.to)) continue
      
      const newDistance = distances.get(current)! + edge.weight
      if (newDistance < distances.get(edge.to)!) {
        distances.set(edge.to, newDistance)
        previous.set(edge.to, current)
      }
    }
  }

  // Reconstruct path
  const path: string[] = []
  let current: string | null = end
  while (current) {
    path.unshift(current)
    current = previous.get(current) || null
  }

  return path.length > 1 ? path : []
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { start, end } = await req.json() as { start: Location; end: Location }

    if (!start?.lat || !start?.lon || !end?.lat || !end?.lon) {
      return new Response(
        JSON.stringify({ error: 'Start and end locations required with lat/lon' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Computing route from (${start.lat}, ${start.lon}) to (${end.lat}, ${end.lon})`)

    // Fetch flood zones from database
    const { data: zones, error: zonesError } = await supabase
      .from('flood_zones')
      .select('*')

    if (zonesError) {
      console.error('Error fetching flood zones:', zonesError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch flood zones' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build graph nodes
    const nodes = new Map<string, GraphNode>()
    const graph = new Map<string, Edge[]>()

    // Add start and end nodes
    nodes.set('START', { id: 'START', lat: start.lat, lon: start.lon, riskScore: 0 })
    nodes.set('END', { id: 'END', lat: end.lat, lon: end.lon, riskScore: 0 })
    graph.set('START', [])
    graph.set('END', [])

    // Add flood zone nodes
    for (const zone of zones || []) {
      const nodeId = zone.id
      nodes.set(nodeId, {
        id: nodeId,
        lat: zone.center_lat,
        lon: zone.center_lon,
        riskScore: zone.current_risk_score || 0
      })
      graph.set(nodeId, [])
    }

    // Build edges with risk-weighted distances
    const nodeArray = Array.from(nodes.values())
    for (let i = 0; i < nodeArray.length; i++) {
      for (let j = i + 1; j < nodeArray.length; j++) {
        const node1 = nodeArray[i]
        const node2 = nodeArray[j]

        const distance = calculateDistance(node1.lat, node1.lon, node2.lat, node2.lon)
        
        // Weight calculation: distance × (1 + average risk factor)
        // Higher risk zones increase the weight, making routes avoid them
        const avgRisk = (node1.riskScore + node2.riskScore) / 2
        const riskFactor = 1 + (avgRisk / 10) * 2 // Risk multiplier (0-10 scale becomes 0-2 multiplier)
        const weight = distance * riskFactor

        // Add bidirectional edges
        graph.get(node1.id)!.push({ to: node2.id, weight })
        graph.get(node2.id)!.push({ to: node1.id, weight })
      }
    }

    // Run Dijkstra's algorithm
    const path = dijkstra(graph, 'START', 'END', nodes)

    if (path.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No safe route found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convert path to coordinates
    const routeCoordinates = path.map(nodeId => {
      const node = nodes.get(nodeId)!
      return { lat: node.lat, lon: node.lon }
    })

    // Calculate total distance and risk
    let totalDistance = 0
    let totalRisk = 0
    for (let i = 0; i < path.length - 1; i++) {
      const node1 = nodes.get(path[i])!
      const node2 = nodes.get(path[i + 1])!
      totalDistance += calculateDistance(node1.lat, node1.lon, node2.lat, node2.lon)
      totalRisk += (node1.riskScore + node2.riskScore) / 2
    }

    const avgRisk = path.length > 1 ? totalRisk / (path.length - 1) : 0

    console.log(`Route computed: ${path.length} waypoints, ${totalDistance.toFixed(2)} km, avg risk ${avgRisk.toFixed(2)}`)

    return new Response(
      JSON.stringify({
        route: routeCoordinates,
        path: path,
        totalDistance: Math.round(totalDistance * 100) / 100,
        averageRisk: Math.round(avgRisk * 100) / 100,
        waypoints: path.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error computing route:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
