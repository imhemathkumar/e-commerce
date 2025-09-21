import React, { useState, useEffect } from 'react';
import { CreditCard, MapPin, Package, CheckCircle, ArrowLeft, Truck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/common/Layout';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { supabase } from '../lib/supabase';

const CheckoutPage = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [newOrderId, setNewOrderId] = useState(null);
  
  const { user } = useAuth();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const navigate = useNavigate();

  const [paymentForm, setPaymentForm] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardName: ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    if (cartItems.length === 0) {
      navigate('/cart');
      return;
    }

    loadAddresses();
  }, [user, cartItems, navigate]);

  const loadAddresses = async () => {
    try {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAddresses(data);
        // Auto-select default address
        const defaultAddress = data.find(addr => addr.is_default);
        if (defaultAddress) {
          setSelectedAddress(defaultAddress);
        }
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
    }
  };

  const handleAddressSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (!selectedAddress) {
      setError('Please select a shipping address');
      return;
    }
    setCurrentStep(2);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate payment form if card payment is selected
    if (paymentMethod === 'card') {
      if (!paymentForm.cardNumber.trim() || !paymentForm.expiryDate.trim() || 
          !paymentForm.cvv.trim() || !paymentForm.cardName.trim()) {
        setError('Please fill in all card details');
        setLoading(false);
        return;
      }
    }

    try {
      // Create order
      const orderData = {
        user_id: user.id,
        total_amount: getCartTotal() * 1.08, // Including tax
        shipping_amount: 0,
        tax_amount: getCartTotal() * 0.08,
        discount_amount: 0,
        currency: 'USD',
        shipping_address: {
          name: selectedAddress.name,
          address_line_1: selectedAddress.address_line_1,
          address_line_2: selectedAddress.address_line_2,
          city: selectedAddress.city,
          state: selectedAddress.state,
          postal_code: selectedAddress.postal_code,
          country: selectedAddress.country,
          phone: selectedAddress.phone
        },
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'cod' ? 'pending' : 'paid',
        status: 'confirmed'
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cartItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product.name,
        product_sku: item.product.sku,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Clear cart
      await clearCart();

      setNewOrderId(order.order_number);
      setOrderPlaced(true);
      setCurrentStep(3);
    } catch (error) {
      console.error('Error placing order:', error);
      setError(`Error placing order: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const subtotal = getCartTotal();
  const tax = subtotal * 0.08;
  const shipping = 0;
  const total = subtotal + tax + shipping;

  if (orderPlaced) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Order Placed Successfully!</h1>
            <p className="text-lg text-gray-600 mb-6">
              Thank you for your order. Your order number is <strong>#{newOrderId}</strong>
            </p>
            <p className="text-gray-600 mb-8">
              {paymentMethod === 'cod' 
                ? 'You have selected Cash on Delivery. Please keep the exact amount ready when your order arrives.'
                : 'You will receive an email confirmation shortly with your order details and tracking information.'
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/orders"
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Orders
              </Link>
              <Link
                to="/products"
                className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-8">
              {[
                { step: 1, title: 'Shipping', icon: MapPin },
                { step: 2, title: 'Payment', icon: CreditCard },
                { step: 3, title: 'Confirmation', icon: CheckCircle }
              ].map(({ step, title, icon: Icon }) => (
                <div key={step} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    currentStep >= step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`ml-2 font-medium ${
                    currentStep >= step ? 'text-blue-600' : 'text-gray-600'
                  }`}>
                    {title}
                  </span>
                  {step < 3 && <div className="w-16 h-0.5 bg-gray-300 ml-4"></div>}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                  {error}
                </div>
              )}

              {currentStep === 1 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Shipping Address</h2>
                  
                  {addresses.length === 0 ? (
                    <div className="text-center py-8">
                      <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">No saved addresses found.</p>
                      <Link
                        to="/addresses"
                        className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Add New Address
                      </Link>
                    </div>
                  ) : (
                    <form onSubmit={handleAddressSubmit}>
                      <div className="space-y-4 mb-6">
                        {addresses.map((address) => (
                          <label key={address.id} className="cursor-pointer">
                            <input
                              type="radio"
                              name="selectedAddress"
                              value={address.id}
                              checked={selectedAddress?.id === address.id}
                              onChange={() => setSelectedAddress(address)}
                              className="sr-only"
                            />
                            <div className={`p-4 border-2 rounded-lg ${
                              selectedAddress?.id === address.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                            }`}>
                              <div className="flex items-start justify-between">
                                <div>
                                  <h3 className="font-semibold text-gray-900">
                                    {address.name}
                                    {address.is_default && (
                                      <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                        Default
                                      </span>
                                    )}
                                  </h3>
                                  <p className="text-gray-600 mt-1">
                                    {address.address_line_1}
                                    {address.address_line_2 && `, ${address.address_line_2}`}
                                  </p>
                                  <p className="text-gray-600">
                                    {address.city}{address.state && `, ${address.state}`} {address.postal_code}
                                  </p>
                                  <p className="text-gray-600">{address.country}</p>
                                  {address.phone && (
                                    <p className="text-gray-600">Phone: {address.phone}</p>
                                  )}
                                </div>
                                <span className="text-sm text-gray-500 capitalize">
                                  {address.type}
                                </span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>

                      <div className="flex justify-between items-center">
                        <Link
                          to="/addresses"
                          className="text-blue-600 hover:text-blue-700 font-medium underline"
                        >
                          + Add New Address
                        </Link>
                        
                        <div className="flex space-x-4">
                          <Link
                            to="/cart"
                            className="flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Cart
                          </Link>
                          <button
                            type="submit"
                            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Continue to Payment
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {currentStep === 2 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Payment Information</h2>
                  
                  {/* Payment Method Selection */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-4">Select Payment Method</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="cursor-pointer">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="cod"
                          checked={paymentMethod === 'cod'}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="sr-only"
                        />
                        <div className={`p-4 border-2 rounded-lg flex items-center space-x-3 ${
                          paymentMethod === 'cod' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                        }`}>
                          <Truck className="h-5 w-5" />
                          <div>
                            <span className="font-medium">Cash on Delivery</span>
                            <p className="text-sm text-gray-600">Pay when you receive your order</p>
                          </div>
                        </div>
                      </label>

                      <label className="cursor-pointer">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="card"
                          checked={paymentMethod === 'card'}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="sr-only"
                        />
                        <div className={`p-4 border-2 rounded-lg flex items-center space-x-3 ${
                          paymentMethod === 'card' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                        }`}>
                          <CreditCard className="h-5 w-5" />
                          <div>
                            <span className="font-medium">Credit/Debit Card</span>
                            <p className="text-sm text-gray-600">Pay securely with your card</p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <form onSubmit={handlePaymentSubmit}>
                    {paymentMethod === 'card' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Card Number *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="1234 5678 9012 3456"
                            maxLength="19"
                            value={paymentForm.cardNumber}
                            onChange={(e) => {
                              // Format card number with spaces
                              const value = e.target.value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
                              setPaymentForm({...paymentForm, cardNumber: value});
                            }}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Expiry Date *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="MM/YY"
                            maxLength="5"
                            value={paymentForm.expiryDate}
                            onChange={(e) => {
                              // Format expiry date MM/YY
                              let value = e.target.value.replace(/\D/g, '');
                              if (value.length >= 2) {
                                value = value.substring(0, 2) + '/' + value.substring(2, 4);
                              }
                              setPaymentForm({...paymentForm, expiryDate: value});
                            }}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            CVV *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="123"
                            maxLength="4"
                            value={paymentForm.cvv}
                            onChange={(e) => {
                              // Only allow numbers
                              const value = e.target.value.replace(/\D/g, '');
                              setPaymentForm({...paymentForm, cvv: value});
                            }}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cardholder Name *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Enter cardholder name"
                            value={paymentForm.cardName}
                            onChange={(e) => setPaymentForm({...paymentForm, cardName: e.target.value})}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'cod' && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center">
                          <Truck className="h-5 w-5 text-yellow-600 mr-2" />
                          <div>
                            <h4 className="font-medium text-yellow-800">Cash on Delivery</h4>
                            <p className="text-sm text-yellow-700">
                              You will pay ${total.toFixed(2)} when your order is delivered to your address.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Shipping
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                        {loading ? 'Processing...' : 'Place Order'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h3>
                
                <div className="space-y-4 mb-6">
                  {cartItems.map((item) => {
                    const primaryImage = item.product.images?.find(img => img.is_primary) || item.product.images?.[0];
                    return (
                      <div key={item.id} className="flex items-center space-x-3">
                        <img
                          src={primaryImage?.image_url || 'https://images.pexels.com/photos/441923/pexels-photo-441923.jpeg'}
                          alt={item.product.name}
                          className="w-12 h-12 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{item.product.name}</h4>
                          <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                        </div>
                        <span className="font-medium">${(item.product.price * item.quantity).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3 border-t pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span className="font-medium text-green-600">Free</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium">${tax.toFixed(2)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>

                {selectedAddress && currentStep >= 1 && (
                  <div className="mt-6 pt-4 border-t">
                    <h4 className="font-medium text-gray-900 mb-2">Shipping to:</h4>
                    <div className="text-sm text-gray-600">
                      <p className="font-medium">{selectedAddress.name}</p>
                      <p>{selectedAddress.address_line_1}</p>
                      {selectedAddress.address_line_2 && <p>{selectedAddress.address_line_2}</p>}
                      <p>{selectedAddress.city}{selectedAddress.state && `, ${selectedAddress.state}`} {selectedAddress.postal_code}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CheckoutPage;