import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Product } from './src/models/Product.js';
import { connectDB } from './src/config/mongodb.js';

dotenv.config();

// Sample products data
const sampleProducts = [
  {
    name: 'Rainbow Tie-Dye T-Shirt',
    slug: 'rainbow-tie-dye-tshirt',
    description: 'Vibrant rainbow spiral tie-dye pattern on premium cotton t-shirt. Each piece is hand-dyed, making it unique.',
    category: 'T-Shirts',
    price: 899,
    compareAtPrice: 1299,
    images: [
      'https://via.placeholder.com/800x800/FF6B6B/FFFFFF?text=Rainbow+Tie+Dye',
      'https://via.placeholder.com/800x800/4ECDC4/FFFFFF?text=Back+View',
      'https://via.placeholder.com/800x800/45B7D1/FFFFFF?text=Detail'
    ],
    colors: ['Rainbow', 'Blue Spiral', 'Purple Burst'],
    sizes: [
      { name: 'S', measurements: { chest: 36, length: 26, shoulder: 16 } },
      { name: 'M', measurements: { chest: 38, length: 27, shoulder: 17 } },
      { name: 'L', measurements: { chest: 40, length: 28, shoulder: 18 } },
      { name: 'XL', measurements: { chest: 42, length: 29, shoulder: 19 } },
      { name: 'XXL', measurements: { chest: 44, length: 30, shoulder: 20 } }
    ],
    inventory: [
      { color: 'Rainbow', size: 'S', stock: 10, sku: 'RTD-RAIN-S-001' },
      { color: 'Rainbow', size: 'M', stock: 15, sku: 'RTD-RAIN-M-001' },
      { color: 'Rainbow', size: 'L', stock: 20, sku: 'RTD-RAIN-L-001' },
      { color: 'Rainbow', size: 'XL', stock: 12, sku: 'RTD-RAIN-XL-001' },
      { color: 'Rainbow', size: 'XXL', stock: 8, sku: 'RTD-RAIN-XXL-001' },
      { color: 'Blue Spiral', size: 'S', stock: 10, sku: 'RTD-BLUE-S-001' },
      { color: 'Blue Spiral', size: 'M', stock: 15, sku: 'RTD-BLUE-M-001' },
      { color: 'Blue Spiral', size: 'L', stock: 20, sku: 'RTD-BLUE-L-001' },
      { color: 'Blue Spiral', size: 'XL', stock: 12, sku: 'RTD-BLUE-XL-001' },
      { color: 'Blue Spiral', size: 'XXL', stock: 8, sku: 'RTD-BLUE-XXL-001' },
      { color: 'Purple Burst', size: 'S', stock: 10, sku: 'RTD-PURP-S-001' },
      { color: 'Purple Burst', size: 'M', stock: 15, sku: 'RTD-PURP-M-001' },
      { color: 'Purple Burst', size: 'L', stock: 20, sku: 'RTD-PURP-L-001' },
      { color: 'Purple Burst', size: 'XL', stock: 12, sku: 'RTD-PURP-XL-001' },
      { color: 'Purple Burst', size: 'XXL', stock: 8, sku: 'RTD-PURP-XXL-001' }
    ],
    isActive: true,
    isFeatured: true,
    tags: ['tie-dye', 'rainbow', 'colorful', 'cotton', 'casual', 'unisex']
  },
  {
    name: 'Sunset Tie-Dye Hoodie',
    slug: 'sunset-tie-dye-hoodie',
    description: 'Cozy hoodie with warm sunset colors. Perfect for chilly evenings. Hand-dyed with love.',
    category: 'Hoodies',
    price: 1499,
    compareAtPrice: 1999,
    images: [
      'https://via.placeholder.com/800x800/FF6B6B/FFFFFF?text=Sunset+Hoodie',
      'https://via.placeholder.com/800x800/FFA07A/FFFFFF?text=Back+View'
    ],
    colors: ['Sunset Orange', 'Pink Sunset', 'Red Sunset'],
    sizes: [
      { name: 'S', measurements: { chest: 38, length: 26, shoulder: 17 } },
      { name: 'M', measurements: { chest: 40, length: 27, shoulder: 18 } },
      { name: 'L', measurements: { chest: 42, length: 28, shoulder: 19 } },
      { name: 'XL', measurements: { chest: 44, length: 29, shoulder: 20 } },
      { name: 'XXL', measurements: { chest: 46, length: 30, shoulder: 21 } }
    ],
    inventory: [
      { color: 'Sunset Orange', size: 'S', stock: 8, sku: 'STD-ORAN-S-001' },
      { color: 'Sunset Orange', size: 'M', stock: 12, sku: 'STD-ORAN-M-001' },
      { color: 'Sunset Orange', size: 'L', stock: 15, sku: 'STD-ORAN-L-001' },
      { color: 'Sunset Orange', size: 'XL', stock: 10, sku: 'STD-ORAN-XL-001' },
      { color: 'Sunset Orange', size: 'XXL', stock: 6, sku: 'STD-ORAN-XXL-001' },
      { color: 'Pink Sunset', size: 'S', stock: 8, sku: 'STD-PINK-S-001' },
      { color: 'Pink Sunset', size: 'M', stock: 12, sku: 'STD-PINK-M-001' },
      { color: 'Pink Sunset', size: 'L', stock: 15, sku: 'STD-PINK-L-001' },
      { color: 'Pink Sunset', size: 'XL', stock: 10, sku: 'STD-PINK-XL-001' },
      { color: 'Pink Sunset', size: 'XXL', stock: 6, sku: 'STD-PINK-XXL-001' },
      { color: 'Red Sunset', size: 'S', stock: 8, sku: 'STD-RED-S-001' },
      { color: 'Red Sunset', size: 'M', stock: 12, sku: 'STD-RED-M-001' },
      { color: 'Red Sunset', size: 'L', stock: 15, sku: 'STD-RED-L-001' },
      { color: 'Red Sunset', size: 'XL', stock: 10, sku: 'STD-RED-XL-001' },
      { color: 'Red Sunset', size: 'XXL', stock: 6, sku: 'STD-RED-XXL-001' }
    ],
    isActive: true,
    isFeatured: true,
    tags: ['tie-dye', 'hoodie', 'sunset', 'warm', 'cozy', 'winter']
  },
  {
    name: 'Ocean Wave Tie-Dye Tank Top',
    slug: 'ocean-wave-tie-dye-tank',
    description: 'Cool ocean-inspired tie-dye tank top. Perfect for summer. Lightweight and breathable.',
    category: 'Tank Tops',
    price: 699,
    compareAtPrice: 999,
    images: [
      'https://via.placeholder.com/800x800/4ECDC4/FFFFFF?text=Ocean+Tank',
      'https://via.placeholder.com/800x800/45B7D1/FFFFFF?text=Side+View'
    ],
    colors: ['Ocean Blue', 'Turquoise', 'Sea Green'],
    sizes: [
      { name: 'S', measurements: { chest: 34, length: 24, shoulder: 14 } },
      { name: 'M', measurements: { chest: 36, length: 25, shoulder: 15 } },
      { name: 'L', measurements: { chest: 38, length: 26, shoulder: 16 } },
      { name: 'XL', measurements: { chest: 40, length: 27, shoulder: 17 } }
    ],
    inventory: [
      { color: 'Ocean Blue', size: 'S', stock: 12, sku: 'OTD-BLUE-S-001' },
      { color: 'Ocean Blue', size: 'M', stock: 18, sku: 'OTD-BLUE-M-001' },
      { color: 'Ocean Blue', size: 'L', stock: 20, sku: 'OTD-BLUE-L-001' },
      { color: 'Ocean Blue', size: 'XL', stock: 14, sku: 'OTD-BLUE-XL-001' },
      { color: 'Turquoise', size: 'S', stock: 12, sku: 'OTD-TURQ-S-001' },
      { color: 'Turquoise', size: 'M', stock: 18, sku: 'OTD-TURQ-M-001' },
      { color: 'Turquoise', size: 'L', stock: 20, sku: 'OTD-TURQ-L-001' },
      { color: 'Turquoise', size: 'XL', stock: 14, sku: 'OTD-TURQ-XL-001' },
      { color: 'Sea Green', size: 'S', stock: 12, sku: 'OTD-GREN-S-001' },
      { color: 'Sea Green', size: 'M', stock: 18, sku: 'OTD-GREN-M-001' },
      { color: 'Sea Green', size: 'L', stock: 20, sku: 'OTD-GREN-L-001' },
      { color: 'Sea Green', size: 'XL', stock: 14, sku: 'OTD-GREN-XL-001' }
    ],
    isActive: true,
    isFeatured: false,
    tags: ['tie-dye', 'tank-top', 'ocean', 'summer', 'beach', 'lightweight']
  },
  {
    name: 'Galaxy Tie-Dye Sweatshirt',
    slug: 'galaxy-tie-dye-sweatshirt',
    description: 'Deep space-inspired galaxy tie-dye sweatshirt. Comfortable and stylish. Perfect for stargazers.',
    category: 'Sweatshirts',
    price: 1299,
    compareAtPrice: 1799,
    images: [
      'https://via.placeholder.com/800x800/2C3E50/FFFFFF?text=Galaxy+Sweatshirt',
      'https://via.placeholder.com/800x800/34495E/FFFFFF?text=Back+View'
    ],
    colors: ['Deep Purple', 'Midnight Blue', 'Cosmic Black'],
    sizes: [
      { name: 'M', measurements: { chest: 40, length: 27, shoulder: 18 } },
      { name: 'L', measurements: { chest: 42, length: 28, shoulder: 19 } },
      { name: 'XL', measurements: { chest: 44, length: 29, shoulder: 20 } },
      { name: 'XXL', measurements: { chest: 46, length: 30, shoulder: 21 } }
    ],
    inventory: [
      { color: 'Deep Purple', size: 'M', stock: 10, sku: 'GTD-PURP-M-001' },
      { color: 'Deep Purple', size: 'L', stock: 15, sku: 'GTD-PURP-L-001' },
      { color: 'Deep Purple', size: 'XL', stock: 12, sku: 'GTD-PURP-XL-001' },
      { color: 'Deep Purple', size: 'XXL', stock: 8, sku: 'GTD-PURP-XXL-001' },
      { color: 'Midnight Blue', size: 'M', stock: 10, sku: 'GTD-BLUE-M-001' },
      { color: 'Midnight Blue', size: 'L', stock: 15, sku: 'GTD-BLUE-L-001' },
      { color: 'Midnight Blue', size: 'XL', stock: 12, sku: 'GTD-BLUE-XL-001' },
      { color: 'Midnight Blue', size: 'XXL', stock: 8, sku: 'GTD-BLUE-XXL-001' },
      { color: 'Cosmic Black', size: 'M', stock: 10, sku: 'GTD-BLCK-M-001' },
      { color: 'Cosmic Black', size: 'L', stock: 15, sku: 'GTD-BLCK-L-001' },
      { color: 'Cosmic Black', size: 'XL', stock: 12, sku: 'GTD-BLCK-XL-001' },
      { color: 'Cosmic Black', size: 'XXL', stock: 8, sku: 'GTD-BLCK-XXL-001' }
    ],
    isActive: true,
    isFeatured: true,
    tags: ['tie-dye', 'sweatshirt', 'galaxy', 'space', 'purple', 'blue']
  },
  {
    name: 'Pastel Dreams Crop Top',
    slug: 'pastel-dreams-crop-top',
    description: 'Soft pastel tie-dye crop top. Perfect for spring and summer. Delicate and trendy.',
    category: 'Crop Tops',
    price: 799,
    compareAtPrice: 1099,
    images: [
      'https://via.placeholder.com/800x800/FFB6C1/FFFFFF?text=Pastel+Crop',
      'https://via.placeholder.com/800x800/E6E6FA/FFFFFF?text=Side+View'
    ],
    colors: ['Pink Pastel', 'Lavender Dream', 'Mint Green'],
    sizes: [
      { name: 'XS', measurements: { chest: 32, length: 18, shoulder: 13 } },
      { name: 'S', measurements: { chest: 34, length: 19, shoulder: 14 } },
      { name: 'M', measurements: { chest: 36, length: 20, shoulder: 15 } },
      { name: 'L', measurements: { chest: 38, length: 21, shoulder: 16 } }
    ],
    inventory: [
      { color: 'Pink Pastel', size: 'XS', stock: 15, sku: 'PTD-PINK-XS-001' },
      { color: 'Pink Pastel', size: 'S', stock: 20, sku: 'PTD-PINK-S-001' },
      { color: 'Pink Pastel', size: 'M', stock: 18, sku: 'PTD-PINK-M-001' },
      { color: 'Pink Pastel', size: 'L', stock: 12, sku: 'PTD-PINK-L-001' },
      { color: 'Lavender Dream', size: 'XS', stock: 15, sku: 'PTD-LAV-XS-001' },
      { color: 'Lavender Dream', size: 'S', stock: 20, sku: 'PTD-LAV-S-001' },
      { color: 'Lavender Dream', size: 'M', stock: 18, sku: 'PTD-LAV-M-001' },
      { color: 'Lavender Dream', size: 'L', stock: 12, sku: 'PTD-LAV-L-001' },
      { color: 'Mint Green', size: 'XS', stock: 15, sku: 'PTD-MINT-XS-001' },
      { color: 'Mint Green', size: 'S', stock: 20, sku: 'PTD-MINT-S-001' },
      { color: 'Mint Green', size: 'M', stock: 18, sku: 'PTD-MINT-M-001' },
      { color: 'Mint Green', size: 'L', stock: 12, sku: 'PTD-MINT-L-001' }
    ],
    isActive: true,
    isFeatured: false,
    tags: ['tie-dye', 'crop-top', 'pastel', 'spring', 'summer', 'trendy']
  }
];

async function seedProducts() {
  try {
    console.log('🌱 Starting product seeding...');

    // Connect to MongoDB
    await connectDB();

    // Clear existing products (optional - comment out if you want to keep existing)
    await Product.deleteMany({});
    console.log('🗑️  Cleared existing products');

    // Insert sample products
    const products = await Product.insertMany(sampleProducts);
    console.log(`✅ Successfully seeded ${products.length} products`);

    // Display created products
    products.forEach(product => {
      console.log(`   - ${product.name} (${product.slug})`);
    });

    console.log('\n🎉 Seeding complete!');
    console.log('📊 You can now view products at: http://localhost:3001/api/products');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    process.exit(1);
  }
}

// Run the seeder
seedProducts();
