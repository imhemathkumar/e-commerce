/*
  # Fix Database Schema - Add Missing Tables

  1. New Tables
    - `addresses` - User addresses for shipping/billing
    - Ensure all tables exist and are properly configured
    
  2. Security
    - Enable RLS on all tables
    - Add proper policies for user access
    
  3. Features
    - Complete e-commerce functionality
    - Address management
    - Order processing
*/

-- Create addresses table
CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text DEFAULT 'home' CHECK (type IN ('home', 'work', 'other')),
  name text NOT NULL,
  address_line_1 text NOT NULL,
  address_line_2 text,
  city text NOT NULL,
  state text,
  postal_code text NOT NULL,
  country text NOT NULL DEFAULT 'United States',
  phone text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- Addresses policies
CREATE POLICY "Users can manage own addresses" ON addresses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_default ON addresses(user_id, is_default);

-- Function to ensure only one default address per user
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE addresses 
    SET is_default = false 
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for default address
CREATE TRIGGER ensure_single_default_address_trigger
  BEFORE INSERT OR UPDATE ON addresses
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_address();

-- 7. IMPORTANT: Refresh Supabase schema cache so API sees the table
NOTIFY pgrst, 'reload schema';

-- Ensure all other required tables exist with proper structure

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  phone text,
  address text,
  city text,
  postal_code text,
  country text DEFAULT 'United States',
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  slug text NOT NULL UNIQUE,
  image_url text,
  parent_id uuid REFERENCES categories(id),
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  short_description text,
  sku text UNIQUE,
  price decimal(10,2) NOT NULL DEFAULT 0,
  compare_price decimal(10,2),
  cost_price decimal(10,2),
  category_id uuid REFERENCES categories(id),
  inventory_quantity integer DEFAULT 0,
  track_inventory boolean DEFAULT true,
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  weight decimal(8,2),
  dimensions jsonb,
  meta_title text,
  meta_description text,
  tags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Product images table
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  image_url text NOT NULL,
  alt_text text,
  sort_order integer DEFAULT 0,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Cart items table
CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  total_amount decimal(10,2) NOT NULL DEFAULT 0,
  shipping_amount decimal(10,2) DEFAULT 0,
  tax_amount decimal(10,2) DEFAULT 0,
  discount_amount decimal(10,2) DEFAULT 0,
  currency text DEFAULT 'USD',
  shipping_address jsonb NOT NULL,
  billing_address jsonb,
  payment_method text,
  payment_id text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) NOT NULL,
  product_name text NOT NULL,
  product_sku text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price decimal(10,2) NOT NULL DEFAULT 0,
  total_price decimal(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  comment text,
  is_verified boolean DEFAULT false,
  is_approved boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, user_id)
);

-- Wishlists table
CREATE TABLE IF NOT EXISTS wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
DO $$ 
BEGIN
  -- Profiles policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can read all profiles') THEN
    CREATE POLICY "Users can read all profiles" ON profiles FOR SELECT TO authenticated USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
  END IF;

  -- Categories policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Anyone can read active categories') THEN
    CREATE POLICY "Anyone can read active categories" ON categories FOR SELECT USING (is_active = true OR auth.role() = 'authenticated');
  END IF;

  -- Products policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Anyone can read active products') THEN
    CREATE POLICY "Anyone can read active products" ON products FOR SELECT USING (is_active = true OR auth.role() = 'authenticated');
  END IF;

  -- Product images policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_images' AND policyname = 'Anyone can read product images') THEN
    CREATE POLICY "Anyone can read product images" ON product_images FOR SELECT USING (true);
  END IF;

  -- Cart policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cart_items' AND policyname = 'Users can manage own cart') THEN
    CREATE POLICY "Users can manage own cart" ON cart_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Orders policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Users can read own orders') THEN
    CREATE POLICY "Users can read own orders" ON orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Users can create own orders') THEN
    CREATE POLICY "Users can create own orders" ON orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Order items policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'Users can read own order items') THEN
    CREATE POLICY "Users can read own order items" ON order_items FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'Users can create order items') THEN
    CREATE POLICY "Users can create order items" ON order_items FOR INSERT TO authenticated WITH CHECK (
      EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
    );
  END IF;

  -- Reviews policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Anyone can read approved reviews') THEN
    CREATE POLICY "Anyone can read approved reviews" ON reviews FOR SELECT USING (is_approved = true OR auth.role() = 'authenticated');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Users can create own reviews') THEN
    CREATE POLICY "Users can create own reviews" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Users can update own reviews') THEN
    CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Wishlists policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wishlists' AND policyname = 'Users can manage own wishlist') THEN
    CREATE POLICY "Users can manage own wishlist" ON wishlists FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);

-- Create order number generation function
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                        LPAD((
                          SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 14) AS INTEGER)), 0) + 1
                          FROM orders 
                          WHERE order_number LIKE 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-%'
                        )::TEXT, 4, '0');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order number if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_order_number_trigger'
  ) THEN
    CREATE TRIGGER set_order_number_trigger
      BEFORE INSERT ON orders
      FOR EACH ROW
      EXECUTE FUNCTION set_order_number();
  END IF;
END $$;

-- Insert sample data if tables are empty
DO $$
BEGIN
  -- Insert categories if none exist
  IF NOT EXISTS (SELECT 1 FROM categories LIMIT 1) THEN
    INSERT INTO categories (name, description, slug) VALUES
      ('Electronics', 'Electronic devices and gadgets', 'electronics'),
      ('Clothing', 'Fashion and apparel', 'clothing'),
      ('Home & Garden', 'Home improvement and gardening', 'home-garden'),
      ('Sports & Outdoors', 'Sports equipment and outdoor gear', 'sports-outdoors'),
      ('Books', 'Books and literature', 'books'),
      ('Toys & Games', 'Toys and games for all ages', 'toys-games');
  END IF;

  -- Insert products if none exist
  IF NOT EXISTS (SELECT 1 FROM products LIMIT 1) THEN
    INSERT INTO products (name, description, short_description, sku, price, compare_price, category_id, inventory_quantity, is_featured) VALUES
      ('Wireless Bluetooth Headphones', 'Premium quality wireless headphones with noise cancellation and 30-hour battery life.', 'Premium wireless headphones with noise cancellation', 'WBH-001', 199.99, 249.99, (SELECT id FROM categories WHERE slug = 'electronics'), 50, true),
      ('Smart Fitness Watch', 'Advanced fitness tracking with heart rate monitor, GPS, and smartphone integration.', 'Advanced fitness tracking watch', 'SFW-002', 299.99, 349.99, (SELECT id FROM categories WHERE slug = 'electronics'), 30, true),
      ('Organic Cotton T-Shirt', 'Comfortable 100% organic cotton t-shirt available in multiple colors.', '100% organic cotton comfort tee', 'OCT-003', 29.99, 39.99, (SELECT id FROM categories WHERE slug = 'clothing'), 100, false),
      ('Ergonomic Office Chair', 'Adjustable office chair with lumbar support and breathable mesh back.', 'Ergonomic chair with lumbar support', 'EOC-004', 249.99, 299.99, (SELECT id FROM categories WHERE slug = 'home-garden'), 25, true),
      ('Professional Chef Knife Set', 'High-quality stainless steel knife set with wooden block holder.', 'Professional grade knife set', 'CKS-005', 149.99, 199.99, (SELECT id FROM categories WHERE slug = 'home-garden'), 40, false),
      ('Yoga Mat Premium', 'Non-slip yoga mat with superior grip and extra cushioning for comfort.', 'Premium non-slip yoga mat', 'YMP-006', 79.99, 99.99, (SELECT id FROM categories WHERE slug = 'sports-outdoors'), 60, false),
      ('Hiking Backpack 40L', 'Durable hiking backpack with multiple compartments and rain cover.', 'Durable 40L hiking backpack', 'HBP-007', 129.99, 159.99, (SELECT id FROM categories WHERE slug = 'sports-outdoors'), 35, true),
      ('Mystery Novel Collection', 'Bestselling mystery novel series - complete collection of 5 books.', 'Complete mystery novel series', 'MNC-008', 49.99, 74.99, (SELECT id FROM categories WHERE slug = 'books'), 80, false),
      ('Educational Building Blocks', 'Creative building blocks set for developing problem-solving skills.', 'Educational STEM building blocks', 'EBB-009', 39.99, 49.99, (SELECT id FROM categories WHERE slug = 'toys-games'), 75, true),
      ('Wireless Phone Charger', 'Fast wireless charging pad compatible with all Qi-enabled devices.', 'Fast wireless charging pad', 'WPC-010', 34.99, 49.99, (SELECT id FROM categories WHERE slug = 'electronics'), 90, false),
      ('Denim Jacket Classic', 'Classic denim jacket made from high-quality cotton denim.', 'Classic cotton denim jacket', 'DJC-011', 89.99, 119.99, (SELECT id FROM categories WHERE slug = 'clothing'), 45, false),
      ('Smart Home Security Camera', 'HD security camera with night vision, motion detection, and mobile alerts.', 'Smart HD security camera', 'SHSC-012', 179.99, 219.99, (SELECT id FROM categories WHERE slug = 'electronics'), 55, true);
  END IF;

  -- Insert product images if none exist
  IF NOT EXISTS (SELECT 1 FROM product_images LIMIT 1) THEN
    INSERT INTO product_images (product_id, image_url, alt_text, is_primary) VALUES
      ((SELECT id FROM products WHERE sku = 'WBH-001'), 'https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg', 'Wireless Bluetooth Headphones', true),
      ((SELECT id FROM products WHERE sku = 'SFW-002'), 'https://images.pexels.com/photos/437037/pexels-photo-437037.jpeg', 'Smart Fitness Watch', true),
      ((SELECT id FROM products WHERE sku = 'OCT-003'), 'https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg', 'Organic Cotton T-Shirt', true),
      ((SELECT id FROM products WHERE sku = 'EOC-004'), 'https://images.pexels.com/photos/6443060/pexels-photo-6443060.jpeg', 'Ergonomic Office Chair', true),
      ((SELECT id FROM products WHERE sku = 'CKS-005'), 'https://images.pexels.com/photos/2983101/pexels-photo-2983101.jpeg', 'Professional Chef Knife Set', true),
      ((SELECT id FROM products WHERE sku = 'YMP-006'), 'https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg', 'Yoga Mat Premium', true),
      ((SELECT id FROM products WHERE sku = 'HBP-007'), 'https://images.pexels.com/photos/1365425/pexels-photo-1365425.jpeg', 'Hiking Backpack', true),
      ((SELECT id FROM products WHERE sku = 'MNC-008'), 'https://images.pexels.com/photos/1370295/pexels-photo-1370295.jpeg', 'Mystery Novel Collection', true),
      ((SELECT id FROM products WHERE sku = 'EBB-009'), 'https://images.pexels.com/photos/298825/pexels-photo-298825.jpeg', 'Educational Building Blocks', true),
      ((SELECT id FROM products WHERE sku = 'WPC-010'), 'https://images.pexels.com/photos/4792720/pexels-photo-4792720.jpeg', 'Wireless Phone Charger', true),
      ((SELECT id FROM products WHERE sku = 'DJC-011'), 'https://images.pexels.com/photos/1082529/pexels-photo-1082529.jpeg', 'Denim Jacket Classic', true),
      ((SELECT id FROM products WHERE sku = 'SHSC-012'), 'https://images.pexels.com/photos/430208/pexels-photo-430208.jpeg', 'Smart Security Camera', true);
  END IF;
END $$;