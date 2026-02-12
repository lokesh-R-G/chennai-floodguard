import mongoose, { Schema, Document } from 'mongoose';

export interface ICamp extends Document {
  name: string;
  locationLat: number;
  locationLon: number;
  address?: string;
  capacity: number;
  currentOccupancy: number;
  managerId?: mongoose.Types.ObjectId;
  amenities: string[];
  contactPhone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CampSchema = new Schema<ICamp>(
  {
    name: {
      type: String,
      required: true,
      trim: true
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
    address: {
      type: String,
      trim: true
    },
    capacity: {
      type: Number,
      required: true,
      min: 0,
      default: 100
    },
    currentOccupancy: {
      type: Number,
      default: 0,
      min: 0
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    amenities: {
      type: [String],
      default: []
    },
    contactPhone: {
      type: String,
      match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Validation: occupancy cannot exceed capacity
CampSchema.pre('save', function (next) {
  if (this.currentOccupancy > this.capacity) {
    next(new Error('Current occupancy cannot exceed capacity'));
  } else {
    next();
  }
});

CampSchema.index({ locationLat: 1, locationLon: 1 });
CampSchema.index({ isActive: 1 });
CampSchema.index({ managerId: 1 });

export default mongoose.model<ICamp>('Camp', CampSchema);
