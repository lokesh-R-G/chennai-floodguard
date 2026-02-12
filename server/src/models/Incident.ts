import mongoose, { Schema, Document } from 'mongoose';

export enum IncidentStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum EmergencyType {
  MEDICAL = 'medical',
  WATER_RESCUE = 'water_rescue',
  EVACUATION = 'evacuation',
  SHELTER = 'shelter',
  SUPPLIES = 'supplies',
  OTHER = 'other'
}

export interface ISafeRoute {
  waypoints: Array<{ lat: number; lon: number }>;
  totalDistance: number;
  avgRiskScore: number;
  estimatedTime: number;
}

export interface IIncident extends Document {
  citizenId: mongoose.Types.ObjectId;
  locationLat: number;
  locationLon: number;
  emergencyType: EmergencyType;
  description?: string;
  assignedDriverId?: mongoose.Types.ObjectId;
  status: IncidentStatus;
  safeRoute?: ISafeRoute;
  priority: number;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const IncidentSchema = new Schema<IIncident>(
  {
    citizenId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    locationLat: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    locationLon: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },
    emergencyType: {
      type: String,
      enum: Object.values(EmergencyType),
      required: true
    },
    description: {
      type: String,
      maxlength: 500
    },
    assignedDriverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver'
    },
    status: {
      type: String,
      enum: Object.values(IncidentStatus),
      default: IncidentStatus.PENDING
    },
    safeRoute: {
      waypoints: [
        {
          lat: { type: Number, required: true },
          lon: { type: Number, required: true }
        }
      ],
      totalDistance: Number,
      avgRiskScore: Number,
      estimatedTime: Number
    },
    priority: {
      type: Number,
      default: 5,
      min: 1,
      max: 10
    },
    assignedAt: Date,
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancellationReason: String
  },
  {
    timestamps: true
  }
);

// Indexes for efficient queries
IncidentSchema.index({ citizenId: 1, status: 1 });
IncidentSchema.index({ assignedDriverId: 1, status: 1 });
IncidentSchema.index({ status: 1, createdAt: -1 });
IncidentSchema.index({ locationLat: 1, locationLon: 1 });
IncidentSchema.index({ emergencyType: 1 });
IncidentSchema.index({ priority: -1 });

export default mongoose.model<IIncident>('Incident', IncidentSchema);
