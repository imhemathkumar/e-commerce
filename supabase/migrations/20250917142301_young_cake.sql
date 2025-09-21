/*
  # Create order number function

  1. Functions
    - `set_order_number()` - Automatically generates order numbers
    
  2. Security
    - Function is secure and only used by triggers
*/

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate order number in format: ORD-YYYYMMDD-XXXX
  NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                      LPAD((
                        SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 14) AS INTEGER)), 0) + 1
                        FROM orders 
                        WHERE order_number LIKE 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-%'
                      )::TEXT, 4, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;