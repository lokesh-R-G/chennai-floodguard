import mongoose, { Schema, Document } from 'mongoose';

export enum DriverStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  OFFLINE = 'offline'
}

export interface IDriver extends Document {
  userId: mongoose.Types.ObjectId;
  vehicleId?: mongoose.Types.ObjectId;
  currentLat?: number;
  currentLon?: number;
  status: DriverStatus;
  rating: number;
  totalJobs: number;
  completedJobs: number;
  lastLocationUpdate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DriverSchema = new Schema<IDriver>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle'
    },
    currentLat: {
      type: Number,
      min: -90,
      max: 90
    },
    currentLon: {
      type: Number,
      min: -180,
      max: 180
    },
    status: {
      type: String,
      enum: Object.values(DriverStatus),
      default: DriverStatus.OFFLINE
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 0,
      max: 5
    },
    totalJobs: {
      type: Number,
      default: 0,
      min: 0
    },
    completedJobs: {
      type: Number,
      default: 0,
      min: 0
    },
    lastLocationUpdate: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Geospatial index for location-based queries
DriverSchema.index({ currentLat: 1, currentLon: 1 });
DriverSchema.index({ status: 1 });
DriverSchema.index({ userId: 1 });

export default mongoose.model<IDriver>('Driver', DriverSchema);
