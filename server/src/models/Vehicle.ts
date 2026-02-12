import mongoose, { Schema, Document } from 'mongoose';

export enum VehicleType {
  AMBULANCE = 'Ambulance',
  RESCUE_VAN = 'Rescue Van',
  RESCUE_TRUCK = 'Rescue Truck',
  BOAT = 'Boat'
}

export interface IVehicle extends Document {
  vehicleNumber: string;
  vehicleType: VehicleType;
  capacity: number;
  isActive: boolean;
  maintenanceHistory: Array<{
    date: Date;
    description: string;
    cost?: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleSchema = new Schema<IVehicle>(
  {
    vehicleNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z]{2}-\d{2}-[A-Z]{2}-\d{4}$/, 'Invalid vehicle number format']
    },
    vehicleType: {
      type: String,
      enum: Object.values(VehicleType),
      required: true
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      default: 4
    },
    isActive: {
      type: Boolean,
      default: true
    },
    maintenanceHistory: [
      {
        date: { type: Date, required: true },
        description: { type: String, required: true },
        cost: { type: Number, min: 0 }
      }
    ]
  },
  {
    timestamps: true
  }
);

VehicleSchema.index({ vehicleNumber: 1 });
VehicleSchema.index({ isActive: 1 });

export default mongoose.model<IVehicle>('Vehicle', VehicleSchema);
