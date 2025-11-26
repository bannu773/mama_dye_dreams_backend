import mongoose, { Schema, Document } from 'mongoose';

export type OrderStatus = 
  | 'pending'
  | 'payment_pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface IOrderItem {
  product: mongoose.Types.ObjectId;
  productName: string;
  productImage: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  sku: string;
}

export interface IShippingAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface IPayment {
  method: 'razorpay' | 'cod';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  transactionId?: string;
  paidAt?: Date;
}

export interface IOrder extends Document {
  orderNumber: string;
  user: mongoose.Types.ObjectId;
  items: IOrderItem[];
  shippingAddress: IShippingAddress;
  billingAddress: IShippingAddress;
  subtotal: number;
  shippingCost: number;
  tax: number;
  taxAmount: number;
  discount: number;
  total: number;
  totalAmount: number;
  payment: IPayment;
  status: OrderStatus;
  orderStatus: OrderStatus;
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  trackingNumber?: string;
  carrier?: string;
  deliveredAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>({
  product: { 
    type: Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  productName: { type: String, required: true },
  productImage: { type: String, required: true },
  color: { type: String, required: true },
  size: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  sku: { type: String, required: true },
});

const addressSchema = new Schema<IShippingAddress>({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  addressLine1: { type: String, required: true },
  addressLine2: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
});

const paymentSchema = new Schema<IPayment>({
  method: { 
    type: String, 
    enum: ['razorpay', 'cod'], 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  transactionId: { type: String },
  paidAt: { type: Date },
});

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { 
      type: String, 
      required: true, 
      unique: true,
      index: true 
    },
    user: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true 
    },
    items: [orderItemSchema],
    shippingAddress: { 
      type: addressSchema, 
      required: true 
    },
    billingAddress: { 
      type: addressSchema, 
      required: true 
    },
    subtotal: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    shippingCost: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    tax: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    taxAmount: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    discount: { 
      type: Number, 
      default: 0, 
      min: 0 
    },
    total: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    totalAmount: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    payment: { 
      type: paymentSchema, 
      required: true 
    },
    status: { 
      type: String, 
      enum: [
        'pending',
        'payment_pending',
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'refunded'
      ],
      default: 'pending',
      index: true
    },
    orderStatus: { 
      type: String, 
      enum: [
        'pending',
        'payment_pending',
        'confirmed',
        'processing',
        'shipped',
        'out-for-delivery',
        'delivered',
        'cancelled',
        'refunded',
        'return-requested'
      ],
      default: 'pending',
      index: true
    },
    paymentStatus: { 
      type: String, 
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    trackingNumber: { type: String },
    carrier: { type: String },
    deliveredAt: { type: Date },
    notes: { type: String },
  },
  { 
    timestamps: true,
    collection: 'orders'
  }
);

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    
    // Find the last order number for today
    const lastOrder = await mongoose.model('Order').findOne({
      orderNumber: new RegExp(`^MDD${year}${month}`)
    }).sort({ orderNumber: -1 });
    
    let sequence = 1;
    if (lastOrder && lastOrder.orderNumber) {
      const lastSequence = parseInt(lastOrder.orderNumber.slice(-4));
      sequence = lastSequence + 1;
    }
    
    this.orderNumber = `MDD${year}${month}${sequence.toString().padStart(4, '0')}`;
  }
  next();
});

// Indexes for common queries
orderSchema.index({ user: 1, status: 1, createdAt: -1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ createdAt: -1 });

export const Order = mongoose.model<IOrder>('Order', orderSchema);
