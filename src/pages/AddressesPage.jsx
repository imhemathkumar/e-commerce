import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, MapPin, Home, Building, Check } from 'lucide-react';
import Layout from '../components/common/Layout';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const AddressesPage = () => {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    type: 'home',
    name: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'United States',
    phone: '',
    is_default: false
  });

  // Helper: map Supabase/PostgREST errors to friendly user messages
  const formatSupabaseError = (error) => {
    const raw = (error && (error.message || error.error || error.msg)) || String(error || '');
    // Network fetch failure (CORS, wrong URL, offline)
    if (/failed to fetch/i.test(raw) || /network request failed/i.test(raw)) {
      return 'Network error: failed to contact Supabase. Check your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, network connection, and CORS settings (Supabase project settings).';
    }
    // Specific PostgREST schema cache missing-table error
    if (/Could not find the table \'public\.addresses\' in the schema cache/i.test(raw)) {
      return 'Address service is not available. Please apply the database migrations (see `supabase/migrations/20250917164827_super_band.sql`) and reload the Supabase schema cache.';
    }
    // Generic fallback: prefer error.message if available
    if (error && error.message) return error.message;
    return 'An unexpected error occurred. Please try again.';
  };

  useEffect(() => {
    if (user) {
      loadAddresses();
    }
  }, [user]);

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
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
      setMessage(`Error: ${formatSupabaseError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      // Validate required fields
      if (!formData.name.trim() || !formData.address_line_1.trim() || 
          !formData.city.trim() || !formData.postal_code.trim()) {
        throw new Error('Please fill in all required fields');
      }

      if (editingAddress) {
        // Update existing address
        const { error } = await supabase
          .from('addresses')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingAddress.id);

        if (error) throw error;
        setMessage('Address updated successfully!');
      } else {
        // Create new address
        const { error } = await supabase
          .from('addresses')
          .insert({
            ...formData,
            user_id: user.id
          });

        if (error) throw error;
        setMessage('Address added successfully!');
      }

      setShowForm(false);
      setEditingAddress(null);
      resetForm();
      loadAddresses();
    } catch (error) {
  console.error('Error saving address:', error);
  setMessage(`Error: ${formatSupabaseError(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'home',
      name: '',
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'United States',
      phone: '',
      is_default: false
    });
  };

  const handleEdit = (address) => {
    setEditingAddress(address);
    setFormData({
      type: address.type,
      name: address.name,
      address_line_1: address.address_line_1,
      address_line_2: address.address_line_2 || '',
      city: address.city,
      state: address.state || '',
      postal_code: address.postal_code,
      country: address.country,
      phone: address.phone || '',
      is_default: address.is_default
    });
    setShowForm(true);
  };

  const handleDelete = async (addressId) => {
    if (window.confirm('Are you sure you want to delete this address?')) {
      try {
        const { error } = await supabase
          .from('addresses')
          .delete()
          .eq('id', addressId);

        if (error) throw error;
        
        setMessage('Address deleted successfully!');
        loadAddresses();
      } catch (error) {
  console.error('Error deleting address:', error);
  setMessage(`Error: ${formatSupabaseError(error)}`);
        }
    }
  };

  const setAsDefault = async (addressId) => {
    try {
      // First, unset all default addresses for this user
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Then set the selected address as default
      const { error } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', addressId);

      if (error) throw error;
      
      setMessage('Default address updated successfully!');
      loadAddresses();
    } catch (error) {
  console.error('Error setting default address:', error);
  setMessage(`Error: ${formatSupabaseError(error)}`);
    }
  };

  const getAddressIcon = (type) => {
    switch (type) {
      case 'home':
        return Home;
      case 'work':
        return Building;
      default:
        return MapPin;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16">
          <div className="flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">My Addresses</h1>
            <button
              onClick={() => {
                resetForm();
                setEditingAddress(null);
                setMessage('');
                setShowForm(true);
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Address
            </button>
          </div>

          {/* Success/Error Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.includes('Error') 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {message}
            </div>
          )}

          {/* Address List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {addresses.map((address) => {
              const IconComponent = getAddressIcon(address.type);
              return (
                <div key={address.id} className="bg-white rounded-lg shadow-md p-6 relative">
                  {address.is_default && (
                    <div className="absolute top-4 right-4">
                      <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full flex items-center">
                        <Check className="h-3 w-3 mr-1" />
                        Default
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <IconComponent className="h-5 w-5 text-blue-600" />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {address.type.charAt(0).toUpperCase() + address.type.slice(1)}
                      </h3>
                      <p className="font-medium text-gray-900">{address.name}</p>
                      <p className="text-gray-600 text-sm mt-1">
                        {address.address_line_1}
                      </p>
                      {address.address_line_2 && (
                        <p className="text-gray-600 text-sm">
                          {address.address_line_2}
                        </p>
                      )}
                      <p className="text-gray-600 text-sm">
                        {address.city}{address.state && `, ${address.state}`} {address.postal_code}
                      </p>
                      <p className="text-gray-600 text-sm">{address.country}</p>
                      {address.phone && (
                        <p className="text-gray-600 text-sm mt-1">
                          Phone: {address.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-gray-200">
                    {!address.is_default && (
                      <button
                        onClick={() => setAsDefault(address.id)}
                        className="flex items-center px-3 py-1 text-green-600 hover:bg-green-50 rounded transition-colors text-sm"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(address)}
                      className="flex items-center px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors text-sm"
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(address.id)}
                      className="flex items-center px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors text-sm"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {addresses.length === 0 && (
            <div className="text-center py-12">
              <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">No addresses saved</h2>
              <p className="text-gray-600 mb-8">Add your first address to make checkout faster.</p>
            </div>
          )}

          {/* Address Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingAddress ? 'Edit Address' : 'Add New Address'}
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Address Type
                      </label>
                      <div className="flex space-x-4">
                        {[
                          { value: 'home', label: 'Home', icon: Home },
                          { value: 'work', label: 'Work', icon: Building },
                          { value: 'other', label: 'Other', icon: MapPin }
                        ].map(({ value, label, icon: Icon }) => (
                          <label key={value} className="cursor-pointer">
                            <input
                              type="radio"
                              name="type"
                              value={value}
                              checked={formData.type === value}
                              onChange={(e) => setFormData({...formData, type: e.target.value})}
                              className="sr-only"
                            />
                            <div className={`flex items-center space-x-2 px-4 py-2 border-2 rounded-lg ${
                              formData.type === value ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                            }`}>
                              <Icon className="h-4 w-4" />
                              <span>{label}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter full name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter phone number"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Address Line 1 *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.address_line_1}
                        onChange={(e) => setFormData({...formData, address_line_1: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Street address"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Address Line 2
                      </label>
                      <input
                        type="text"
                        value={formData.address_line_2}
                        onChange={(e) => setFormData({...formData, address_line_2: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Apartment, suite, etc. (optional)"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        City *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.city}
                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter city"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        State/Province
                      </label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => setFormData({...formData, state: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="State/Province"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Postal Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.postal_code}
                        onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Postal/ZIP code"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Country *
                      </label>
                      <select
                        required
                        value={formData.country}
                        onChange={(e) => setFormData({...formData, country: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="United States">United States</option>
                        <option value="Canada">Canada</option>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="Australia">Australia</option>
                        <option value="India">India</option>
                        <option value="Germany">Germany</option>
                        <option value="France">France</option>
                        <option value="Japan">Japan</option>
                        <option value="Brazil">Brazil</option>
                        <option value="Mexico">Mexico</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.is_default}
                          onChange={(e) => setFormData({...formData, is_default: e.target.checked})}
                          className="mr-2"
                        />
                        Set as default address
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4 mt-8">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEditingAddress(null);
                        setMessage('');
                        resetForm();
                      }}
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : (editingAddress ? 'Update Address' : 'Save Address')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AddressesPage;