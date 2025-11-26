import express from 'express';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';

const router = express.Router();

// Apply auth and admin middleware to all routes
router.use(requireAuth as any);
router.use(requireAdmin as any);

/**
 * GET /api/admin/analytics/dashboard
 * Get dashboard statistics
 */
router.get('/dashboard', async (req: AuthenticatedRequest, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get product statistics
    const [
      totalProducts,
      activeProducts,
      featuredProducts,
      lowStockProducts,
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ isFeatured: true }),
      Product.countDocuments({
        'inventory.stock': { $lte: 5 },
        isActive: true,
      }),
    ]);

    // Get order statistics
    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      completedOrders,
      cancelledOrders,
      ordersThisMonth,
      ordersLastMonth,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ orderStatus: 'pending' }),
      Order.countDocuments({ orderStatus: { $in: ['confirmed', 'processing', 'shipped'] } }),
      Order.countDocuments({ orderStatus: 'delivered' }),
      Order.countDocuments({ orderStatus: 'cancelled' }),
      Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Order.countDocuments({
        createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
      }),
    ]);

    // Calculate revenue
    const revenueData = await Order.aggregate([
      {
        $match: {
          orderStatus: { $nin: ['cancelled'] },
          'payment.status': 'completed',
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          avgOrderValue: { $avg: '$totalAmount' },
        },
      },
    ]);

    const revenueThisMonth = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth },
          orderStatus: { $nin: ['cancelled'] },
          'payment.status': 'completed',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
        },
      },
    ]);

    const revenueLastMonth = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
          orderStatus: { $nin: ['cancelled'] },
          'payment.status': 'completed',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
        },
      },
    ]);

    // Calculate growth percentages
    const ordersGrowth = ordersLastMonth > 0
      ? ((ordersThisMonth - ordersLastMonth) / ordersLastMonth) * 100
      : 0;

    const revenueGrowth = revenueLastMonth[0]?.total > 0
      ? ((revenueThisMonth[0]?.total || 0 - revenueLastMonth[0]?.total) / revenueLastMonth[0]?.total) * 100
      : 0;

    res.json({
      success: true,
      data: {
        products: {
          total: totalProducts,
          active: activeProducts,
          featured: featuredProducts,
          lowStock: lowStockProducts,
        },
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          processing: processingOrders,
          completed: completedOrders,
          cancelled: cancelledOrders,
          thisMonth: ordersThisMonth,
          lastMonth: ordersLastMonth,
          growth: Math.round(ordersGrowth * 10) / 10,
        },
        revenue: {
          total: revenueData[0]?.totalRevenue || 0,
          avgOrderValue: revenueData[0]?.avgOrderValue || 0,
          thisMonth: revenueThisMonth[0]?.total || 0,
          lastMonth: revenueLastMonth[0]?.total || 0,
          growth: Math.round(revenueGrowth * 10) / 10,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard analytics',
    });
  }
});

/**
 * GET /api/admin/analytics/sales
 * Get sales data for charts
 */
router.get('/sales', async (req: AuthenticatedRequest, res) => {
  try {
    const { period = '30days' } = req.query;

    let startDate = new Date();
    let groupBy: any = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };

    switch (period) {
      case '7days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        groupBy = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          orderStatus: { $nin: ['cancelled'] },
        },
      },
      {
        $group: {
          _id: groupBy,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          avgOrderValue: { $avg: '$totalAmount' },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.json({
      success: true,
      data: { sales: salesData },
    });
  } catch (error: any) {
    console.error('Error fetching sales analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales analytics',
    });
  }
});

/**
 * GET /api/admin/analytics/top-products
 * Get top-selling products
 */
router.get('/top-products', async (req: AuthenticatedRequest, res) => {
  try {
    const { limit = 10 } = req.query;

    const topProducts = await Order.aggregate([
      {
        $match: {
          orderStatus: { $nin: ['cancelled'] },
        },
      },
      {
        $unwind: '$items',
      },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          orderCount: { $sum: 1 },
        },
      },
      {
        $sort: { totalRevenue: -1 },
      },
      {
        $limit: parseInt(limit as string),
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      {
        $unwind: '$productDetails',
      },
      {
        $project: {
          _id: 1,
          name: '$productDetails.name',
          slug: '$productDetails.slug',
          image: { $arrayElemAt: ['$productDetails.images', 0] },
          totalQuantity: 1,
          totalRevenue: 1,
          orderCount: 1,
        },
      },
    ]);

    res.json({
      success: true,
      data: { products: topProducts },
    });
  } catch (error: any) {
    console.error('Error fetching top products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top products',
    });
  }
});

/**
 * GET /api/admin/analytics/low-stock
 * Get low stock products
 */
router.get('/low-stock', async (req: AuthenticatedRequest, res) => {
  try {
    const { threshold = 5, limit = 20 } = req.query;

    const lowStockProducts = await Product.aggregate([
      {
        $match: {
          isActive: true,
        },
      },
      {
        $unwind: '$inventory',
      },
      {
        $match: {
          'inventory.stock': { $lte: parseInt(threshold as string) },
        },
      },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          slug: { $first: '$slug' },
          image: { $first: { $arrayElemAt: ['$images', 0] } },
          totalStock: { $sum: '$inventory.stock' },
          lowStockVariants: {
            $push: {
              color: '$inventory.color',
              size: '$inventory.size',
              stock: '$inventory.stock',
              sku: '$inventory.sku',
            },
          },
        },
      },
      {
        $sort: { totalStock: 1 },
      },
      {
        $limit: parseInt(limit as string),
      },
    ]);

    res.json({
      success: true,
      data: { products: lowStockProducts },
    });
  } catch (error: any) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch low stock products',
    });
  }
});

/**
 * GET /api/admin/analytics/categories
 * Get category distribution
 */
router.get('/categories', async (req: AuthenticatedRequest, res) => {
  try {
    const categoryStats = await Product.aggregate([
      {
        $match: {
          isActive: true,
        },
      },
      {
        $group: {
          _id: '$category',
          productCount: { $sum: 1 },
          avgPrice: { $avg: '$price' },
        },
      },
      {
        $sort: { productCount: -1 },
      },
    ]);

    res.json({
      success: true,
      data: { categories: categoryStats },
    });
  } catch (error: any) {
    console.error('Error fetching category analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category analytics',
    });
  }
});

/**
 * GET /api/admin/analytics/recent-orders
 * Get recent orders
 */
router.get('/recent-orders', async (req: AuthenticatedRequest, res) => {
  try {
    const { limit = 10 } = req.query;

    const recentOrders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .select('orderNumber totalAmount orderStatus payment.method createdAt');

    res.json({
      success: true,
      data: { orders: recentOrders },
    });
  } catch (error: any) {
    console.error('Error fetching recent orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent orders',
    });
  }
});

export default router;
