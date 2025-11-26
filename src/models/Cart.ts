import mongoose, { Schema, Document } from 'mongoose';

export interface ICartItem {
  product: mongoose.Types.ObjectId;
  color: string;
  size: string;
  quantity: number;
  price: number;
}

export interface ICart extends Document {
  user: mongoose.Types.ObjectId;
  items: ICartItem[];
  createdAt: Date;
  updatedAt: Date;
  itemCount: number;
  subtotal: number;
  addItem(
    productId: mongoose.Types.ObjectId,
    color: string,
    size: string,
    quantity: number,
    price: number
  ): Promise<ICart>;
  updateItemQuantity(
    productId: mongoose.Types.ObjectId,
    color: string,
    size: string,
    quantity: number
  ): Promise<ICart>;
  removeItem(
    productId: mongoose.Types.ObjectId,
    color: string,
    size: string
  ): Promise<ICart>;
  clearCart(): Promise<ICart>;
}

const cartItemSchema = new Schema<ICartItem>({
  product: { 
    type: Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  color: { 
    type: String, 
    required: true 
  },
  size: { 
    type: String, 
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true, 
    min: 1,
    default: 1
  },
  price: { 
    type: Number, 
    required: true, 
    min: 0 
  },
});

const cartSchema = new Schema<ICart>(
  {
    user: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true, 
      unique: true,
      index: true 
    },
    items: [cartItemSchema],
  },
  { 
    timestamps: true,
    collection: 'carts'
  }
);

// Virtual for total items count
cartSchema.virtual('itemCount').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for subtotal
cartSchema.virtual('subtotal').get(function() {
  return this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
});

// Method to add item to cart
cartSchema.methods.addItem = function(
  productId: mongoose.Types.ObjectId,
  color: string,
  size: string,
  quantity: number,
  price: number
) {
  const existingItemIndex = this.items.findIndex(
    item => 
      item.product.toString() === productId.toString() &&
      item.color === color &&
      item.size === size
  );

  if (existingItemIndex > -1) {
    // Update quantity if item exists
    this.items[existingItemIndex].quantity += quantity;
  } else {
    // Add new item
    this.items.push({
      product: productId,
      color,
      size,
      quantity,
      price,
    });
  }

  return this.save();
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = function(
  productId: mongoose.Types.ObjectId,
  color: string,
  size: string,
  quantity: number
) {
  const itemIndex = this.items.findIndex(
    item => 
      item.product.toString() === productId.toString() &&
      item.color === color &&
      item.size === size
  );

  if (itemIndex > -1) {
    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      this.items.splice(itemIndex, 1);
    } else {
      this.items[itemIndex].quantity = quantity;
    }
  }

  return this.save();
};

// Method to remove item from cart
cartSchema.methods.removeItem = function(
  productId: mongoose.Types.ObjectId,
  color: string,
  size: string
) {
  this.items = this.items.filter(
    item => !(
      item.product.toString() === productId.toString() &&
      item.color === color &&
      item.size === size
    )
  );

  return this.save();
};

// Method to clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
  return this.save();
};

export const Cart = mongoose.model<ICart>('Cart', cartSchema);
