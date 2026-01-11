import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ============================================
// Better Auth Tables (required for auth)
// ============================================

// Users table - matches Better Auth schema
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  // Custom fields for our app
  role: text('role').default('customer'), // 'customer' | 'admin'
  phone: text('phone'),
});

// Sessions table - matches Better Auth schema
export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

// Account table - for OAuth providers (Better Auth)
export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'), // For email/password auth
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Verification tokens - for email verification (Better Auth)
export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Aliases for backward compatibility
export const users = user;
export const sessions = session;

// Product categories
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
});

// Products table
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  shortDescription: text('short_description'),
  price: real('price').notNull(),
  compareAtPrice: real('compare_at_price'), // For showing discounts
  categoryId: text('category_id').references(() => categories.id),
  imageUrl: text('image_url'),
  images: text('images'), // JSON array of additional images
  isVegan: integer('is_vegan', { mode: 'boolean' }).default(false),
  isFeatured: integer('is_featured', { mode: 'boolean' }).default(false),
  isAvailable: integer('is_available', { mode: 'boolean' }).default(true),
  requiresDeposit: integer('requires_deposit', { mode: 'boolean' }).default(false), // For custom cakes
  depositPercent: integer('deposit_percent').default(50), // 50% for custom cakes
  leadTimeDays: integer('lead_time_days').default(1), // 1 day for cheesecakes, 5 for custom
  minOrderAmount: real('min_order_amount'), // $50 for cheesecakes, $120 for custom
  servings: text('servings'), // e.g., "8-10 slices"
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Orders table
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(), // Human-readable order number
  userId: text('user_id').references(() => users.id),
  guestEmail: text('guest_email'), // For guest checkout
  guestName: text('guest_name'),
  guestPhone: text('guest_phone'),
  status: text('status').notNull().default('pending'), // pending, deposit_paid, confirmed, preparing, ready, delivered, cancelled
  subtotal: real('subtotal').notNull(),
  depositAmount: real('deposit_amount'),
  depositPaid: integer('deposit_paid', { mode: 'boolean' }).default(false),
  totalAmount: real('total_amount').notNull(),
  amountPaid: real('amount_paid').default(0),
  paymentMethod: text('payment_method'), // 'stripe' | 'paypal'
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  paypalOrderId: text('paypal_order_id'),
  deliveryBorough: text('delivery_borough'), // Manhattan, Brooklyn, Queens, Bronx, Staten Island
  deliveryAddress: text('delivery_address'), // JSON
  deliveryDate: text('delivery_date'),
  deliveryTime: text('delivery_time'),
  specialInstructions: text('special_instructions'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Order items
export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(), // Snapshot at time of order
  quantity: integer('quantity').notNull().default(1),
  priceAtPurchase: real('price_at_purchase').notNull(),
  customizations: text('customizations'), // JSON for cake customizations
});

// Shopping carts (for logged-in users)
export const carts = sqliteTable('carts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  items: text('items').notNull().default('[]'), // JSON array of cart items
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Reviews
export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id),
  authorName: text('author_name').notNull(),
  rating: integer('rating').notNull(), // 1-5
  title: text('title'),
  content: text('content'),
  isVerifiedPurchase: integer('is_verified_purchase', { mode: 'boolean' }).default(false),
  isApproved: integer('is_approved', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Gallery images
export const galleryImages = sqliteTable('gallery_images', {
  id: text('id').primaryKey(),
  imageUrl: text('image_url').notNull(),
  title: text('title'),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Types for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Review = typeof reviews.$inferSelect;
