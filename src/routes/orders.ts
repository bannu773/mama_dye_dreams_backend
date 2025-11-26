import express, { Request, Response } from 'express';
import { Order } from '../models/Order.js';
import { Cart } from '../models/Cart.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { sendEmail } from '../config/ses.js';

const router = express.Router();

// Middleware to check authentication
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.session?.user?.userId) {
    return res.status(401).json({ 
      success: false,
      error: 'Authentication required' 
    });
  }
  next();
};

// Middleware to check admin role
const requireAdmin = (req: Request, res: Response, next: Function) => {
  if (!req.session?.user?.userId || !req.session?.user?.isAdmin) {
    return res.status(403).json({ 
      success: false,
      error: 'Admin access required' 
    });
  }
  next();
};

/**
 * POST /api/orders
 * Create a new order from cart
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    // Get MongoDB user
    const mongoUser = await User.findOne({ email: req.session.user!.email.toLowerCase() });
    if (!mongoUser) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const { shippingAddress, billingAddress, useSameAddress = true } = req.body;

    // Comprehensive validation for shipping address
    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        error: 'Shipping address is required'
      });
    }

    // Validate required address fields
    const requiredFields = ['fullName', 'phone', 'addressLine1', 'city', 'state', 'pincode'];
    const missingFields = requiredFields.filter(field => !shippingAddress[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate pincode format (Indian pincode)
    if (!/^\d{6}$/.test(shippingAddress.pincode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pincode format. Must be 6 digits.'
      });
    }

    // Validate phone format
    const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
    const cleanPhone = shippingAddress.phone.replace(/\s+/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
    }

    // Sanitize string inputs
    shippingAddress.fullName = shippingAddress.fullName.trim();
    shippingAddress.addressLine1 = shippingAddress.addressLine1.trim();
    shippingAddress.city = shippingAddress.city.trim();
    shippingAddress.state = shippingAddress.state.trim();
    if (shippingAddress.addressLine2) {
      shippingAddress.addressLine2 = shippingAddress.addressLine2.trim();
    }

    // Get user's cart
    const cart = await Cart.findOne({ user: mongoUser._id }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cart is empty'
      });
    }

    // Verify stock availability for all items
    for (const item of cart.items) {
      const product = item.product as any;
      const stockAvailable = await product.checkStock(item.color, item.size, item.quantity);
      
      if (!stockAvailable) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for ${product.name} - ${item.color} - ${item.size}`
        });
      }
    }

    // Calculate totals
    const subtotal = cart.subtotal;
    const freeShippingThreshold = Number(process.env.FREE_SHIPPING_THRESHOLD) || 2000;
    const shippingCost = subtotal >= freeShippingThreshold ? 0 : 100;
    const taxRate = Number(process.env.TAX_RATE) || 18;
    const taxAmount = Math.round((subtotal * taxRate) / 100);
    const totalAmount = subtotal + shippingCost + taxAmount;

    // Generate unique order number with retry logic
    let orderNumber = '';
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      try {
        orderNumber = await generateOrderNumber();
        
        // Verify uniqueness before using
        const exists = await Order.findOne({ orderNumber }).lean();
        if (!exists) {
          break; // Successfully generated unique order number
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('Failed to generate unique order number after multiple attempts');
        }
        
        // Small delay to avoid race conditions
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (err) {
        if (attempts >= maxAttempts - 1) {
          throw new Error('Order number generation failed: ' + (err as Error).message);
        }
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // Prepare order items with all required fields
    const orderItems = cart.items.map(item => {
      const product = item.product as any;
      
      // Find SKU from product inventory
      const inventoryItem = product.inventory?.find(
        (inv: any) => inv.color === item.color && inv.size === item.size
      );
      const sku = inventoryItem?.sku || `${product.slug}-${item.color}-${item.size}`.toUpperCase().replace(/\s+/g, '-');
      
      return {
        product: product._id,
        productName: product.name,
        productImage: product.images[0] || '/placeholder.svg',
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        price: item.price,
        sku: sku
      };
    });

    // Create order with all required fields
    const order = await Order.create({
      orderNumber,
      user: mongoUser._id,
      items: orderItems,
      subtotal,
      shippingCost,
      tax: taxRate,
      taxAmount,
      discount: 0,
      total: totalAmount,
      totalAmount,
      shippingAddress,
      billingAddress: useSameAddress ? shippingAddress : billingAddress,
      payment: {
        method: 'cod', // Default, will be updated when payment is processed
        status: 'pending'
      },
      status: 'pending',
      orderStatus: 'pending',
      paymentStatus: 'pending'
    });

    // Clear cart after order creation
    await cart.clearCart();

    // Populate order details
    await order.populate('user', 'email name');

    // Log successful order creation for monitoring
    console.log(`✅ Order created successfully: ${orderNumber} for user ${mongoUser.email}`);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order }
    });
  } catch (error: any) {
    console.error('Error creating order:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }
    
    // Handle duplicate order number (race condition)
    if (error.code === 11000 && error.keyPattern?.orderNumber) {
      return res.status(409).json({
        success: false,
        error: 'Order number conflict. Please try again.'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/orders
 * Get user's orders
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    // Get MongoDB user
    const mongoUser = await User.findOne({ email: req.session.user!.email.toLowerCase() });
    if (!mongoUser) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const { page = 1, limit = 10, status } = req.query;

    // Build filter
    const filter: any = { user: mongoUser._id };
    if (status) {
      filter.orderStatus = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('items.product', 'name slug images'),
      Order.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

/**
 * GET /api/orders/:id
 * Get single order by ID
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get MongoDB user
    const mongoUser = await User.findOne({ email: req.session.user!.email.toLowerCase() });
    if (!mongoUser) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const order = await Order.findById(id)
      .populate('user', 'email name')
      .populate('items.product', 'name slug images');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if user owns this order or is admin
    if (order.user._id.toString() !== String(mongoUser._id) && !req.session?.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { order }
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order'
    });
  }
});

/**
 * PUT /api/orders/:id/status
 * Update order status (Admin only)
 */
router.put('/:id/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { orderStatus, trackingNumber, carrier } = req.body;

    if (!orderStatus) {
      return res.status(400).json({
        success: false,
        error: 'Order status is required'
      });
    }

    const validStatuses = [
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'out-for-delivery',
      'delivered',
      'cancelled',
      'refunded',
      'return-requested'
    ];

    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order status'
      });
    }

    const order = await Order.findById(id).populate('user', 'email name');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Update order status
    order.orderStatus = orderStatus;

    // Update tracking info if provided
    if (trackingNumber) {
      order.trackingNumber = trackingNumber;
    }
    if (carrier) {
      order.carrier = carrier;
    }

    // Update delivered date if status is delivered
    if (orderStatus === 'delivered') {
      order.deliveredAt = new Date();
    }

    await order.save();

    // Send email notification based on status
    const userEmail = (order.user as any).email;
    const userName = (order.user as any).name || 'Customer';

    if (orderStatus === 'confirmed') {
      // Send order confirmation email
      await sendOrderConfirmationEmail(order, userEmail, userName);
    } else if (orderStatus === 'shipped' && trackingNumber) {
      // Send shipping notification
      await sendShippingNotificationEmail(order, userEmail, userName, trackingNumber, carrier);
    } else if (orderStatus === 'delivered') {
      // Send delivery confirmation
      await sendDeliveryConfirmationEmail(order, userEmail, userName);
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: { order }
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status'
    });
  }
});

/**
 * POST /api/orders/:id/cancel
 * Cancel an order (User can cancel if not shipped)
 */
router.post('/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get MongoDB user
    const mongoUser = await User.findOne({ email: req.session.user!.email.toLowerCase() });
    if (!mongoUser) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if user owns this order
    if (order.user.toString() !== String(mongoUser._id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Check if order can be cancelled
    if (['shipped', 'out-for-delivery', 'delivered'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Order cannot be cancelled at this stage'
      });
    }

    if (order.orderStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Order is already cancelled'
      });
    }

    // Update order status
    order.orderStatus = 'cancelled';
    await order.save();

    // Restore stock for all items
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        const inventoryItem = product.inventory.find(
          inv => inv.color === item.color && inv.size === item.size
        );
        if (inventoryItem) {
          inventoryItem.stock += item.quantity;
          await product.save();
        }
      }
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: { order }
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order'
    });
  }
});

// Email helper functions
async function sendOrderConfirmationEmail(order: any, email: string, name: string) {
  const itemsHtml = order.items.map((item: any) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        ${item.name} (${item.color}, ${item.size})
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
        ${item.quantity}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
        ₹${item.price.toLocaleString('en-IN')}
      </td>
    </tr>
  `).join('');

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Order Confirmed!</h2>
      <p>Hi ${name},</p>
      <p>Thank you for your order. We're getting your items ready for shipment.</p>
      
      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Order Details</h3>
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f0f0f0;">
            <th style="padding: 10px; text-align: left;">Item</th>
            <th style="padding: 10px; text-align: center;">Quantity</th>
            <th style="padding: 10px; text-align: right;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="text-align: right; margin-top: 20px;">
        <p><strong>Subtotal:</strong> ₹${order.subtotal.toLocaleString('en-IN')}</p>
        <p><strong>Shipping:</strong> ₹${order.shippingCost.toLocaleString('en-IN')}</p>
        <p><strong>Tax:</strong> ₹${order.taxAmount.toLocaleString('en-IN')}</p>
        <p style="font-size: 18px; color: #4CAF50;"><strong>Total:</strong> ₹${order.totalAmount.toLocaleString('en-IN')}</p>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 14px;">
          You can track your order status in your account dashboard.
        </p>
      </div>
    </div>
  `;

  await sendEmail(
    email,
    `Order Confirmation - ${order.orderNumber}`,
    htmlBody,
    `Order Confirmation - Order Number: ${order.orderNumber}`
  );
}

async function sendShippingNotificationEmail(
  order: any,
  email: string,
  name: string,
  trackingNumber: string,
  carrier?: string
) {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Your Order is On Its Way! 📦</h2>
      <p>Hi ${name},</p>
      <p>Good news! Your order has been shipped and is on its way to you.</p>
      
      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Shipping Details</h3>
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
        ${carrier ? `<p><strong>Carrier:</strong> ${carrier}</p>` : ''}
      </div>

      <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; border-left: 4px solid #4CAF50;">
        <p style="margin: 0;">Expected delivery in 3-5 business days</p>
      </div>

      <div style="margin-top: 30px;">
        <p>You can track your shipment using the tracking number provided above.</p>
      </div>
    </div>
  `;

  await sendEmail(
    email,
    `Order Shipped - ${order.orderNumber}`,
    htmlBody,
    `Your order ${order.orderNumber} has been shipped. Tracking: ${trackingNumber}`
  );
}

async function sendDeliveryConfirmationEmail(order: any, email: string, name: string) {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4CAF50;">Order Delivered! ✅</h2>
      <p>Hi ${name},</p>
      <p>Your order has been delivered successfully.</p>
      
      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>Delivered On:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
      </div>

      <div style="margin-top: 30px;">
        <p>We hope you love your tie-dye creations! If you have any questions or concerns, please don't hesitate to contact us.</p>
        <p>Thank you for choosing Mama Dye Dreams! 🌈</p>
      </div>
    </div>
  `;

  await sendEmail(
    email,
    `Order Delivered - ${order.orderNumber}`,
    htmlBody,
    `Your order ${order.orderNumber} has been delivered.`
  );
}

// Helper function to generate unique order number
async function generateOrderNumber(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  
  // Find the last order number for this month with read lock
  const lastOrder = await Order.findOne({
    orderNumber: new RegExp(`^MDD${year}${month}`)
  }).sort({ orderNumber: -1 }).lean();
  
  let sequence = 1;
  if (lastOrder && lastOrder.orderNumber) {
    const lastSequence = parseInt(lastOrder.orderNumber.slice(-4));
    sequence = lastSequence + 1;
  }
  
  return `MDD${year}${month}${sequence.toString().padStart(4, '0')}`;
}

export default router;
