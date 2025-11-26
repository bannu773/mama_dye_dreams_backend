import express, { Request, Response } from 'express';
import { Cart } from '../models/Cart.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';

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
 * GET /api/cart
 * Get user's cart
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

    let cart = await Cart.findOne({ user: mongoUser._id }).populate({
      path: 'items.product',
      select: 'name slug price images colors sizes inventory'
    });

    // Create cart if it doesn't exist
    if (!cart) {
      cart = await Cart.create({ user: mongoUser._id, items: [] });
    }

    res.json({
      success: true,
      data: {
        cart: {
          _id: cart._id,
          items: cart.items,
          itemCount: cart.itemCount,
          subtotal: cart.subtotal
        }
      }
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch cart' 
    });
  }
});

/**
 * POST /api/cart/add
 * Add item to cart
 */
router.post('/add', requireAuth, async (req: Request, res: Response) => {
  try {
    // Get MongoDB user
    const mongoUser = await User.findOne({ email: req.session.user!.email.toLowerCase() });
    if (!mongoUser) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const { productId, color, size, quantity = 1 } = req.body;

    // Validation
    if (!productId || !color || !size) {
      return res.status(400).json({ 
        success: false,
        error: 'Product ID, color, and size are required' 
      });
    }

    if (quantity < 1 || quantity > 10) {
      return res.status(400).json({ 
        success: false,
        error: 'Quantity must be between 1 and 10' 
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false,
        error: 'Product not found' 
      });
    }

    // Check if product has the requested color and size
    if (!product.colors.includes(color)) {
      return res.status(400).json({ 
        success: false,
        error: `Color '${color}' is not available for this product` 
      });
    }

    if (!product.sizes.some(s => s.name === size)) {
      return res.status(400).json({ 
        success: false,
        error: `Size '${size}' is not available for this product` 
      });
    }

    // Check stock availability
    const stockAvailable = await product.checkStock(color, size, quantity);
    if (!stockAvailable) {
      return res.status(400).json({ 
        success: false,
        error: 'Insufficient stock for the requested quantity' 
      });
    }

    // Get or create cart
    let cart = await Cart.findOne({ user: mongoUser._id });
    if (!cart) {
      cart = await Cart.create({ user: mongoUser._id, items: [] });
    }

    // Add item to cart
    await cart.addItem(productId, color, size, quantity, product.price);

    // Populate product details
    await cart.populate({
      path: 'items.product',
      select: 'name slug price images colors sizes inventory'
    });

    res.json({
      success: true,
      message: 'Item added to cart',
      data: {
        cart: {
          _id: cart._id,
          items: cart.items,
          itemCount: cart.itemCount,
          subtotal: cart.subtotal
        }
      }
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to add item to cart' 
    });
  }
});

/**
 * PUT /api/cart/update
 * Update item quantity in cart
 */
router.put('/update', requireAuth, async (req: Request, res: Response) => {
  try {
    // Get MongoDB user
    const mongoUser = await User.findOne({ email: req.session.user!.email.toLowerCase() });
    if (!mongoUser) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const { productId, color, size, quantity } = req.body;

    // Validation
    if (!productId || !color || !size || quantity === undefined) {
      return res.status(400).json({ 
        success: false,
        error: 'Product ID, color, size, and quantity are required' 
      });
    }

    if (quantity < 0 || quantity > 10) {
      return res.status(400).json({ 
        success: false,
        error: 'Quantity must be between 0 and 10' 
      });
    }

    const cart = await Cart.findOne({ user: mongoUser._id });
    if (!cart) {
      return res.status(404).json({ 
        success: false,
        error: 'Cart not found' 
      });
    }

    // If quantity is 0, remove the item
    if (quantity === 0) {
      await cart.removeItem(productId, color, size);
    } else {
      // Check stock availability
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ 
          success: false,
          error: 'Product not found' 
        });
      }

      const stockAvailable = await product.checkStock(color, size, quantity);
      if (!stockAvailable) {
        return res.status(400).json({ 
          success: false,
          error: 'Insufficient stock for the requested quantity' 
        });
      }

      await cart.updateItemQuantity(productId, color, size, quantity);
    }

    // Populate product details
    await cart.populate({
      path: 'items.product',
      select: 'name slug price images colors sizes inventory'
    });

    res.json({
      success: true,
      message: 'Cart updated successfully',
      data: {
        cart: {
          _id: cart._id,
          items: cart.items,
          itemCount: cart.itemCount,
          subtotal: cart.subtotal
        }
      }
    });
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update cart' 
    });
  }
});

/**
 * DELETE /api/cart/remove
 * Remove item from cart
 */
router.delete('/remove', requireAuth, async (req: Request, res: Response) => {
  try {
    // Get MongoDB user
    const mongoUser = await User.findOne({ email: req.session.user!.email.toLowerCase() });
    if (!mongoUser) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const { productId, color, size } = req.body;

    // Validation
    if (!productId || !color || !size) {
      return res.status(400).json({ 
        success: false,
        error: 'Product ID, color, and size are required' 
      });
    }

    const cart = await Cart.findOne({ user: mongoUser._id });
    if (!cart) {
      return res.status(404).json({ 
        success: false,
        error: 'Cart not found' 
      });
    }

    await cart.removeItem(productId, color, size);

    // Populate product details
    await cart.populate({
      path: 'items.product',
      select: 'name slug price images colors sizes inventory'
    });

    res.json({
      success: true,
      message: 'Item removed from cart',
      data: {
        cart: {
          _id: cart._id,
          items: cart.items,
          itemCount: cart.itemCount,
          subtotal: cart.subtotal
        }
      }
    });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to remove item from cart' 
    });
  }
});

/**
 * DELETE /api/cart/clear
 * Clear entire cart
 */
router.delete('/clear', requireAuth, async (req: Request, res: Response) => {
  try {
    // Get MongoDB user
    const mongoUser = await User.findOne({ email: req.session.user!.email.toLowerCase() });
    if (!mongoUser) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const cart = await Cart.findOne({ user: mongoUser._id });
    if (!cart) {
      return res.status(404).json({ 
        success: false,
        error: 'Cart not found' 
      });
    }

    await cart.clearCart();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: {
        cart: {
          _id: cart._id,
          items: [],
          itemCount: 0,
          subtotal: 0
        }
      }
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to clear cart' 
    });
  }
});

export default router;
