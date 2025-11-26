import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { razorpayInstance as razorpay } from '../config/razorpay.js';
import { Order } from '../models/Order.js';
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

/**
 * POST /api/payment/create-order
 * Create Razorpay order for payment
 */
router.post('/create-order', requireAuth, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }

    // Get MongoDB user
    const mongoUser = await User.findOne({ email: req.session.user!.email.toLowerCase() });
    if (!mongoUser) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Find the order
    const order = await Order.findById(orderId);

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

    // Check if order is already paid
    if (order.paymentStatus === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Order is already paid'
      });
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: order.totalAmount * 100, // Amount in paise
      currency: 'INR',
      receipt: order.orderNumber,
      notes: {
        orderId: String(order._id),
        orderNumber: order.orderNumber
      }
    });

    // Update order with Razorpay order ID
    if (!order.payment) {
      order.payment = {
        method: 'razorpay',
        status: 'pending'
      };
    }
    order.payment.razorpayOrderId = razorpayOrder.id;
    order.paymentStatus = 'pending';
    await order.save();

    res.json({
      success: true,
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        orderNumber: order.orderNumber
      }
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment order'
    });
  }
});

/**
 * POST /api/payment/verify
 * Verify Razorpay payment signature
 */
router.post('/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      return res.status(400).json({
        success: false,
        error: 'Missing payment verification parameters'
      });
    }

    // Get MongoDB user
    const mongoUser = await User.findOne({ email: req.session.user!.email.toLowerCase() });
    if (!mongoUser) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Find the order
    const order = await Order.findById(orderId).populate('user', 'email name');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if user owns this order
    if (order.user._id.toString() !== String(mongoUser._id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Verify signature
    const secret = process.env.RAZORPAY_KEY_SECRET!;
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    // Update order payment status
    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.payment.status = 'completed';
    order.payment.paidAt = new Date();
    order.paymentStatus = 'completed';
    order.orderStatus = 'confirmed';
    await order.save();

    // Update product stock
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        await product.updateStock(item.color, item.size, item.quantity);
      }
    }

    // Send order confirmation email
    const userEmail = (order.user as any).email;
    const userName = (order.user as any).name || 'Customer';
    await sendOrderConfirmationEmail(order, userEmail, userName);

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus
      }
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
});

/**
 * POST /api/payment/webhook
 * Razorpay webhook handler
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'] as string;

    if (!webhookSecret) {
      console.error('Webhook secret not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body;

    // Handle different event types
    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment.entity);
        break;

      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity);
        break;

      case 'refund.created':
        await handleRefundCreated(event.payload.refund.entity);
        break;

      default:
        console.log('Unhandled event type:', event.event);
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/payment/cod
 * Process Cash on Delivery order
 */
router.post('/cod', requireAuth, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }

    // Get MongoDB user
    const mongoUser = await User.findOne({ email: req.session.user!.email.toLowerCase() });
    if (!mongoUser) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Find the order
    const order = await Order.findById(orderId).populate('user', 'email name');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if user owns this order
    if (order.user._id.toString() !== String(mongoUser._id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Check if order is already confirmed
    if (order.orderStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Order is already processed'
      });
    }

    // Update order for COD
    order.payment = {
      method: 'cod',
      status: 'pending'
    };
    order.paymentStatus = 'pending';
    order.orderStatus = 'confirmed';
    await order.save();

    // Update product stock
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        await product.updateStock(item.color, item.size, item.quantity);
      }
    }

    // Send order confirmation email
    const userEmail = (order.user as any).email;
    const userName = (order.user as any).name || 'Customer';
    await sendOrderConfirmationEmail(order, userEmail, userName);

    res.json({
      success: true,
      message: 'Cash on Delivery order confirmed',
      data: {
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentMethod: 'cod'
      }
    });
  } catch (error) {
    console.error('Error processing COD order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process COD order'
    });
  }
});

// Helper functions
async function handlePaymentCaptured(payment: any) {
  try {
    const orderId = payment.notes?.orderId;
    if (!orderId) return;

    const order = await Order.findById(orderId);
    if (!order) return;

    order.payment.razorpayPaymentId = payment.id;
    order.payment.status = 'completed';
    order.payment.paidAt = new Date();
    order.paymentStatus = 'completed';
    order.orderStatus = 'confirmed';
    await order.save();

    console.log(`Payment captured for order ${order.orderNumber}`);
  } catch (error) {
    console.error('Error handling payment captured:', error);
  }
}

async function handlePaymentFailed(payment: any) {
  try {
    const orderId = payment.notes?.orderId;
    if (!orderId) return;

    const order = await Order.findById(orderId);
    if (!order) return;

    order.payment.status = 'failed';
    order.paymentStatus = 'failed';
    await order.save();

    console.log(`Payment failed for order ${order.orderNumber}`);
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

async function handleRefundCreated(refund: any) {
  try {
    const paymentId = refund.payment_id;
    
    const order = await Order.findOne({
      'payment.razorpayPaymentId': paymentId
    });

    if (!order) return;

    order.payment.status = 'refunded';
    order.paymentStatus = 'refunded';
    order.orderStatus = 'refunded';
    await order.save();

    console.log(`Refund created for order ${order.orderNumber}`);
  } catch (error) {
    console.error('Error handling refund created:', error);
  }
}

async function sendOrderConfirmationEmail(order: any, email: string, name: string) {
  try {
    const itemsHtml = order.items.map((item: any) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          ${item.name || item.productName} (${item.color}, ${item.size})
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
        <h2 style="color: #333;">Order Confirmed! 🎉</h2>
        <p>Hi ${name},</p>
        <p>Thank you for your order. We're getting your items ready for shipment.</p>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Order Details</h3>
          <p><strong>Order Number:</strong> ${order.orderNumber}</p>
          <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
          <p><strong>Payment Method:</strong> ${order.payment.method === 'cod' ? 'Cash on Delivery' : 'Razorpay'}</p>
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
            We'll send you another email once your order ships.
          </p>
          <p style="color: #666; font-size: 14px;">
            Thank you for choosing Mama Dye Dreams! 🌈
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
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
  }
}

export default router;
