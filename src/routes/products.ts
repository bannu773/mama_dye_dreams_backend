import express, { Request, Response } from 'express';
import { Product } from '../models/Product.js';

const router = express.Router();

/**
 * GET /api/products
 * Get all products with filtering, sorting, and pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      color,
      size,
      minPrice,
      maxPrice,
      search,
      sort = '-createdAt'
    } = req.query;

    // Build filter query
    const filter: any = { isActive: true };

    if (category) {
      filter.category = category;
    }

    if (color) {
      filter.colors = color;
    }

    if (size) {
      filter.sizes = size;
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (search) {
      filter.$text = { $search: search as string };
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Execute query
    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sort as string)
        .skip(skip)
        .limit(Number(limit))
        .select('-inventory'),
      Product.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
});

/**
 * GET /api/products/:slug
 * Get single product by slug
 */
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({ slug, isActive: true });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: { product }
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
});

/**
 * GET /api/products/:id/check-stock
 * Check stock availability for a specific variant
 */
router.get('/:id/check-stock', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { color, size, quantity = 1 } = req.query;

    if (!color || !size) {
      return res.status(400).json({
        success: false,
        error: 'Color and size are required'
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const available = await product.checkStock(
      color as string,
      size as string,
      Number(quantity)
    );

    // Get actual stock quantity
    const inventoryItem = product.inventory.find(
      item => item.color === color && item.size === size
    );

    res.json({
      success: true,
      data: {
        available,
        quantity: inventoryItem?.stock || 0,
        sku: inventoryItem?.sku || null
      }
    });
  } catch (error) {
    console.error('Error checking stock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check stock'
    });
  }
});

/**
 * GET /api/products/category/:category
 * Get products by category
 */
router.get('/category/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 12, sort = '-createdAt' } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const [products, total] = await Promise.all([
      Product.find({ category, isActive: true })
        .sort(sort as string)
        .skip(skip)
        .limit(Number(limit))
        .select('-inventory'),
      Product.countDocuments({ category, isActive: true })
    ]);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching products by category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
});

export default router;
