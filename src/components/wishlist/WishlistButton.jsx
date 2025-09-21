import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const WishlistButton = ({ productId, className = '' }) => {
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user && productId) {
      checkWishlistStatus();
    }
  }, [user, productId]);

  const checkWishlistStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('wishlists')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .single();

      if (!error && data) {
        setIsInWishlist(true);
      }
    } catch (error) {
      // Item not in wishlist
      setIsInWishlist(false);
    }
  };

  const toggleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) return;
    
    setLoading(true);
    
    try {
      if (isInWishlist) {
        // Remove from wishlist
        const { error } = await supabase
          .from('wishlists')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId);

        if (!error) {
          setIsInWishlist(false);
        }
      } else {
        // Add to wishlist
        const { error } = await supabase
          .from('wishlists')
          .insert({
            user_id: user.id,
            product_id: productId
          });

        if (!error) {
          setIsInWishlist(true);
        }
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <button
      onClick={toggleWishlist}
      disabled={loading}
      className={`p-2 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors ${className}`}
    >
      <Heart 
        className={`h-4 w-4 ${
          isInWishlist ? 'text-red-500 fill-current' : 'text-gray-600'
        } ${loading ? 'opacity-50' : ''}`} 
      />
    </button>
  );
};

export default WishlistButton;