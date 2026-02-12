import mongoose, { Schema, Document } from 'mongoose';

export interface IFloodZone extends Document {
  zoneName: string;
  centerLat: number;
  centerLon: number;
  avgFloodDepth: number;
  currentRiskScore: number;
  predictedRainfall: number;
  boundaryPolygon?: number[][];
  historicalData: Array<{
    timestamp: Date;
    riskScore: number;
    rainfall: number;
    floodDepth: number;
  }>;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FloodZoneSchema = new Schema<IFloodZone>(
  {
    zoneName: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    centerLat: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    centerLon: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },
    avgFloodDepth: {
      type: Number,
      default: 0,
      min: 0
    },
    currentRiskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 10
    },
    predictedRainfall: {
      type: Number,
      default: 0,
      min: 0
    },
    boundaryPolygon: {
      type: [[Number]],
      default: []
    },
    historicalData: [
      {
        timestamp: { type: Date, required: true },
        riskScore: { type: Number, required: true },
        rainfall: { type: Number, required: true },
        floodDepth: { type: Number, required: true }
      }
    ],
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Geospatial index for location-based queries
FloodZoneSchema.index({ centerLat: 1, centerLon: 1 });
FloodZoneSchema.index({ currentRiskScore: -1 });
FloodZoneSchema.index({ lastUpdated: -1 });

// TTL index to automatically remove old historical data (keep 90 days)
FloodZoneSchema.index(
  { 'historicalData.timestamp': 1 },
  { expireAfterSeconds: 7776000 }
);

export default mongoose.model<IFloodZone>('FloodZone', FloodZoneSchema);
