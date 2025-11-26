import express from 'express';
import { Product } from '../models/Product.js';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';

const router = express.Router();

// Apply auth and admin middleware to all routes
router.use(requireAuth as any);
router.use(requireAdmin as any);

/**
 * GET /api/admin/products
 * Get all products with pagination and filters (admin view)
 */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      isActive,
      isFeatured,
      sort = '-createdAt',
    } = req.query;

    const query: any = {};

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search as string, 'i')] } },
      ];
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Active filter
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Featured filter
    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured === 'true';
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort(sort as string)
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: { products },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error fetching admin products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
    });
  }
});

/**
 * GET /api/admin/products/:id
 * Get single product by ID (admin view)
 */
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    res.json({
      success: true,
      data: { product },
    });
  } catch (error: any) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product',
    });
  }
});

/**
 * POST /api/admin/products
 * Create new product
 */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const {
      name,
      description,
      category,
      price,
      compareAtPrice,
      images,
      colors,
      sizes,
      inventory,
      isActive,
      isFeatured,
      tags,
    } = req.body;

    // Validate required fields
    if (!name || !description || !category || !price || !images || !colors || !sizes) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if slug already exists
    const existingProduct = await Product.findOne({ slug });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        error: 'Product with this name already exists',
      });
    }

    // Calculate discount percentage
    let discountPercentage = 0;
    if (compareAtPrice && compareAtPrice > price) {
      discountPercentage = Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
    }

    const product = new Product({
      name,
      slug,
      description,
      category,
      price,
      compareAtPrice,
      images,
      colors,
      sizes,
      inventory: inventory || [],
      isActive: isActive !== false,
      isFeatured: isFeatured || false,
      tags: tags || [],
    });

    await product.save();

    res.status(201).json({
      success: true,
      data: { product },
      message: 'Product created successfully',
    });
  } catch (error: any) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create product',
    });
  }
});

/**
 * PUT /api/admin/products/:id
 * Update existing product
 */
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const {
      name,
      description,
      category,
      price,
      compareAtPrice,
      images,
      colors,
      sizes,
      inventory,
      isActive,
      isFeatured,
      tags,
    } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    // Update slug if name changed
    if (name && name !== product.name) {
      const newSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Check if new slug already exists
      const existingProduct = await Product.findOne({
        slug: newSlug,
        _id: { $ne: req.params.id },
      });

      if (existingProduct) {
        return res.status(400).json({
          success: false,
          error: 'Product with this name already exists',
        });
      }

      product.slug = newSlug;
    }

    // Calculate discount percentage
    let discountPercentage = 0;
    const newPrice = price !== undefined ? price : product.price;
    const newCompareAtPrice = compareAtPrice !== undefined ? compareAtPrice : product.compareAtPrice;

    if (newCompareAtPrice && newCompareAtPrice > newPrice) {
      discountPercentage = Math.round(((newCompareAtPrice - newPrice) / newCompareAtPrice) * 100);
    }

    // Update fields
    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (category !== undefined) product.category = category;
    if (price !== undefined) product.price = price;
    if (compareAtPrice !== undefined) product.compareAtPrice = compareAtPrice;
    if (images !== undefined) product.images = images;
    if (colors !== undefined) product.colors = colors;
    if (sizes !== undefined) product.sizes = sizes;
    if (inventory !== undefined) product.inventory = inventory;
    if (isActive !== undefined) product.isActive = isActive;
    if (isFeatured !== undefined) product.isFeatured = isFeatured;
    if (tags !== undefined) product.tags = tags;

    await product.save();

    res.json({
      success: true,
      data: { product },
      message: 'Product updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product',
    });
  }
});

/**
 * DELETE /api/admin/products/:id
 * Delete product (soft delete by setting isActive to false)
 */
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    // Soft delete by setting isActive to false
    product.isActive = false;
    await product.save();

    res.json({
      success: true,
      data: { product },
      message: 'Product deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product',
    });
  }
});

/**
 * DELETE /api/admin/products/:id/permanent
 * Permanently delete product
 */
router.delete('/:id/permanent', async (req: AuthenticatedRequest, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    res.json({
      success: true,
      message: 'Product permanently deleted',
    });
  } catch (error: any) {
    console.error('Error permanently deleting product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to permanently delete product',
    });
  }
});

/**
 * PATCH /api/admin/products/:id/inventory
 * Update product inventory
 */
router.patch('/:id/inventory', async (req: AuthenticatedRequest, res) => {
  try {
    const { color, size, stock, sku, operation = 'set' } = req.body;

    if (!color || !size) {
      return res.status(400).json({
        success: false,
        error: 'Color and size are required',
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    // Find existing inventory item
    const inventoryIndex = product.inventory.findIndex(
      (item: any) => item.color === color && item.size === size
    );

    if (inventoryIndex >= 0) {
      // Update existing inventory
      const currentStock = product.inventory[inventoryIndex].stock;

      switch (operation) {
        case 'add':
          product.inventory[inventoryIndex].stock = currentStock + (stock || 0);
          break;
        case 'remove':
          product.inventory[inventoryIndex].stock = Math.max(0, currentStock - (stock || 0));
          break;
        case 'set':
        default:
          product.inventory[inventoryIndex].stock = stock !== undefined ? stock : currentStock;
          break;
      }

      if (sku) {
        product.inventory[inventoryIndex].sku = sku;
      }
    } else {
      // Add new inventory item
      product.inventory.push({
        color,
        size,
        stock: stock || 0,
        sku: sku || `${product.slug}-${color}-${size}`.toUpperCase(),
      });
    }

    await product.save();

    res.json({
      success: true,
      data: { product },
      message: 'Inventory updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating inventory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update inventory',
    });
  }
});

/**
 * PATCH /api/admin/products/:id/toggle-active
 * Toggle product active status
 */
router.patch('/:id/toggle-active', async (req: AuthenticatedRequest, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    product.isActive = !product.isActive;
    await product.save();

    res.json({
      success: true,
      data: { product },
      message: `Product ${product.isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error: any) {
    console.error('Error toggling product status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle product status',
    });
  }
});

/**
 * PATCH /api/admin/products/:id/toggle-featured
 * Toggle product featured status
 */
router.patch('/:id/toggle-featured', async (req: AuthenticatedRequest, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    product.isFeatured = !product.isFeatured;
    await product.save();

    res.json({
      success: true,
      data: { product },
      message: `Product ${product.isFeatured ? 'marked as featured' : 'unmarked as featured'} successfully`,
    });
  } catch (error: any) {
    console.error('Error toggling featured status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle featured status',
    });
  }
});

export default router;
