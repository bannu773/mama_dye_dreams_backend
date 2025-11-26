import mongoose, { Schema, Document } from 'mongoose';

export interface ISize {
  name: string;
  measurements?: {
    chest?: number;
    length?: number;
    shoulder?: number;
  };
}

export interface IInventory {
  color: string;
  size: string;
  stock: number;
  sku: string;
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  colors: string[];
  sizes: ISize[];
  inventory: IInventory[];
  isActive: boolean;
  isFeatured: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  checkStock(color: string, size: string, quantity: number): boolean;
  updateStock(color: string, size: string, quantity: number): Promise<void>;
}

const sizeSchema = new Schema<ISize>({
  name: { type: String, required: true },
  measurements: {
    chest: { type: Number },
    length: { type: Number },
    shoulder: { type: Number },
  },
});

const inventorySchema = new Schema<IInventory>({
  color: { type: String, required: true },
  size: { type: String, required: true },
  stock: { type: Number, required: true, min: 0 },
  sku: { type: String, required: true, unique: true },
});

const productSchema = new Schema<IProduct>(
  {
    name: { 
      type: String, 
      required: true,
      trim: true 
    },
    slug: { 
      type: String, 
      required: true, 
      unique: true,
      lowercase: true,
      trim: true,
      index: true 
    },
    description: { 
      type: String, 
      required: true 
    },
    category: { 
      type: String, 
      required: true,
      index: true 
    },
    price: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    compareAtPrice: { 
      type: Number, 
      min: 0 
    },
    images: [{ 
      type: String, 
      required: true 
    }],
    colors: [{ 
      type: String, 
      required: true 
    }],
    sizes: [sizeSchema],
    inventory: [inventorySchema],
    isActive: { 
      type: Boolean, 
      default: true,
      index: true 
    },
    isFeatured: { 
      type: Boolean, 
      default: false,
      index: true 
    },
    tags: [{ 
      type: String,
      lowercase: true,
      trim: true 
    }],
  },
  { 
    timestamps: true,
    collection: 'products'
  }
);

// Text search index
productSchema.index({ 
  name: 'text', 
  description: 'text', 
  tags: 'text' 
});

// Compound indexes for common queries
productSchema.index({ category: 1, isActive: 1, isFeatured: 1 });
productSchema.index({ price: 1, isActive: 1 });

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function() {
  if (this.compareAtPrice && this.compareAtPrice > this.price) {
    return Math.round(((this.compareAtPrice - this.price) / this.compareAtPrice) * 100);
  }
  return 0;
});

// Method to check stock availability
productSchema.methods.checkStock = function(color: string, size: string, quantity: number): boolean {
  const item = this.inventory.find(inv => inv.color === color && inv.size === size);
  return item ? item.stock >= quantity : false;
};

// Method to update stock
productSchema.methods.updateStock = async function(color: string, size: string, quantity: number) {
  const item = this.inventory.find(inv => inv.color === color && inv.size === size);
  if (item) {
    item.stock -= quantity;
    await this.save();
  }
};

export const Product = mongoose.model<IProduct>('Product', productSchema);
