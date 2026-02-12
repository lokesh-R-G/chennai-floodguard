import mongoose, { Schema, Document } from 'mongoose';

export interface IInventory extends Document {
  campId: mongoose.Types.ObjectId;
  itemName: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  updatedBy?: mongoose.Types.ObjectId;
  lastRestocked?: Date;
  expiryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  isLowStock(): boolean;
}

const InventorySchema = new Schema<IInventory>(
  {
    campId: {
      type: Schema.Types.ObjectId,
      ref: 'Camp',
      required: true
    },
    itemName: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    unit: {
      type: String,
      default: 'units',
      trim: true
    },
    minThreshold: {
      type: Number,
      default: 10,
      min: 0
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    lastRestocked: {
      type: Date
    },
    expiryDate: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Method to check if stock is low
InventorySchema.methods.isLowStock = function (): boolean {
  return this.quantity <= this.minThreshold;
};

// Compound index for uniqueness
InventorySchema.index({ campId: 1, itemName: 1 }, { unique: true });
InventorySchema.index({ quantity: 1 });

export default mongoose.model<IInventory>('Inventory', InventorySchema);
