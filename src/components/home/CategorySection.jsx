import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const CategorySection = () => {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .limit(6);

      if (!error && data) {
        setCategories(data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const categoryImages = {
    'electronics': 'https://images.pexels.com/photos/356036/pexels-photo-356036.jpeg',
    'clothing': 'https://images.pexels.com/photos/934070/pexels-photo-934070.jpeg',
    'home-garden': 'https://images.pexels.com/photos/6032370/pexels-photo-6032370.jpeg',
    'sports-outdoors': 'https://images.pexels.com/photos/863988/pexels-photo-863988.jpeg',
    'books': 'https://images.pexels.com/photos/1370295/pexels-photo-1370295.jpeg',
    'toys-games': 'https://images.pexels.com/photos/163064/play-stone-network-networked-interactive-163064.jpeg'
  };

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Shop by Category
          </h2>
          <p className="text-lg text-gray-600">
            Find exactly what you're looking for in our organized categories
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/category/${category.slug}`}
              className="group relative overflow-hidden rounded-lg bg-white shadow-md hover:shadow-xl transition-shadow duration-300"
            >
              <div className="aspect-w-16 aspect-h-9 overflow-hidden">
                <img
                  src={category.image_url || categoryImages[category.slug] || 'https://images.pexels.com/photos/441923/pexels-photo-441923.jpeg'}
                  alt={category.name}
                  className="w-full h-32 md:h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              
              <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                <div className="text-center text-white">
                  <h3 className="text-lg md:text-xl font-bold mb-2">
                    {category.name}
                  </h3>
                  {category.description && (
                    <p className="text-sm opacity-90 px-2">
                      {category.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="absolute inset-0 bg-blue-600 bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300"></div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategorySection;