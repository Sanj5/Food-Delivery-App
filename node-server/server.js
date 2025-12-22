/**
 * Node Backend Server (Express.js)
 * Port: 5002
 * Handles Users and Restaurants
 * Communicates with Frontend via Gateway
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const {
  db,
  seedAdmin,
  seedRestaurants,
  getUserByEmail,
  getUserById,
  createUser,
  getAdminByEmailAndPassword,
  listRestaurants,
  listAvailableLocations,
  getRestaurantById,
  getMenuByRestaurantId,
  createRestaurant,
  getRestaurantByEmailAndPassword,
  createRestaurantCredentials,
  insertNotification,
  listNotifications
} = require('./db');

const app = express();
const PORT = process.env.PORT || 5002;
const PYTHON_SERVER_URL = process.env.PYTHON_SERVER_URL || 'http://localhost:5001'; // Direct Python Server communication

// Middleware
app.use(express.json());
app.use(cors());

// ==================== SAMPLE DATA (for seeding) ====================
function getSampleRestaurants() {
  const sampleRestaurants = [
    // Mumbai Restaurants
    {
      id: uuidv4(),
      name: 'Tandoori Palace',
      cuisine: 'North Indian',
      address: '123 Marine Drive, Colaba',
      location: 'Mumbai',
      rating: 4.8,
      menu: [
        { item_id: uuidv4(), item_name: 'Tandoori Chicken', price: 450, description: 'Smoky tandoori chicken with spices' },
        { item_id: uuidv4(), item_name: 'Butter Chicken', price: 500, description: 'Creamy tomato-based curry' },
        { item_id: uuidv4(), item_name: 'Naan Bread', price: 80, description: 'Soft Indian bread' }
      ]
    },
    {
      id: uuidv4(),
      name: 'Maharaja Bhog',
      cuisine: 'Gujarati',
      address: '456 Bandra West',
      location: 'Mumbai',
      rating: 4.6,
      menu: [
        { item_id: uuidv4(), item_name: 'Dhokla', price: 120, description: 'Steamed gram flour cake' },
        { item_id: uuidv4(), item_name: 'Fafda Jalebi', price: 150, description: 'Crispy gram flour snack with sweet' },
        { item_id: uuidv4(), item_name: 'Undhiyu', price: 280, description: 'Mixed vegetable delicacy' }
      ]
    },
    {
      id: uuidv4(),
      name: 'Seafood Paradise',
      cuisine: 'Coastal/Seafood',
      address: '789 Worli Sea Face',
      location: 'Mumbai',
      rating: 4.7,
      menu: [
        { item_id: uuidv4(), item_name: 'Surmai Fry', price: 520, description: 'Pan-fried kingfish' },
        { item_id: uuidv4(), item_name: 'Crab Ghee Roast', price: 580, description: 'Fresh crab with ghee' },
        { item_id: uuidv4(), item_name: 'Prawn Koliwada', price: 450, description: 'Village-style prawns' }
      ]
    },

    // Delhi Restaurants
    {
      id: uuidv4(),
      name: 'Delhi Darbar',
      cuisine: 'Delhi Street Food',
      address: '654 Chandni Chowk',
      location: 'Delhi',
      rating: 4.6,
      menu: [
        { item_id: uuidv4(), item_name: 'Chole Bhature', price: 180, description: 'Spiced chickpeas with fried bread' },
        { item_id: uuidv4(), item_name: 'Nihari', price: 280, description: 'Slow-cooked meat stew' },
        { item_id: uuidv4(), item_name: 'Chaat Masala Fries', price: 120, description: 'Crispy fries with tangy spices' }
      ]
    },
    {
      id: uuidv4(),
      name: 'Mughal Express',
      cuisine: 'Mughlai',
      address: '321 Connaught Place',
      location: 'Delhi',
      rating: 4.7,
      menu: [
        { item_id: uuidv4(), item_name: 'Biryani', price: 380, description: 'Fragrant rice with meat' },
        { item_id: uuidv4(), item_name: 'Shahi Tukda', price: 200, description: 'Royal dessert with bread and cream' },
        { item_id: uuidv4(), item_name: 'Galauti Kebab', price: 350, description: 'Melt-in-mouth meat kebab' }
      ]
    },
    {
      id: uuidv4(),
      name: 'Punjab Palace',
      cuisine: 'Punjabi',
      address: '987 Karol Bagh',
      location: 'Delhi',
      rating: 4.5,
      menu: [
        { item_id: uuidv4(), item_name: 'Sarson Ka Saag', price: 220, description: 'Mustard greens with butter' },
        { item_id: uuidv4(), item_name: 'Tandoori Paneer', price: 320, description: 'Grilled cottage cheese' },
        { item_id: uuidv4(), item_name: 'Makki Di Roti', price: 100, description: 'Cornmeal bread' }
      ]
    },

    // Bangalore Restaurants
    {
      id: uuidv4(),
      name: 'South Indian Café',
      cuisine: 'South Indian',
      address: '789 MG Road',
      location: 'Bangalore',
      rating: 4.6,
      menu: [
        { item_id: uuidv4(), item_name: 'Dosa', price: 120, description: 'Crispy rice and lentil crepe' },
        { item_id: uuidv4(), item_name: 'Idli Sambar', price: 100, description: 'Steamed rice cakes with lentil stew' },
        { item_id: uuidv4(), item_name: 'Uttapam', price: 140, description: 'Thick pancake with toppings' }
      ]
    },
    {
      id: uuidv4(),
      name: 'Spice Garden',
      cuisine: 'Chettinad',
      address: '456 Indiranagar',
      location: 'Bangalore',
      rating: 4.7,
      menu: [
        { item_id: uuidv4(), item_name: 'Chettinad Chicken', price: 380, description: 'Spicy chicken curry' },
        { item_id: uuidv4(), item_name: 'Pepper Rasam', price: 80, description: 'Spicy lentil soup' },
        { item_id: uuidv4(), item_name: 'Appam', price: 130, description: 'Coconut rice pancake' }
      ]
    },
    {
      id: uuidv4(),
      name: 'Udupi Hotel',
      cuisine: 'Udupi',
      address: '321 Whitefield',
      location: 'Bangalore',
      rating: 4.5,
      menu: [
        { item_id: uuidv4(), item_name: 'Masala Dosa', price: 140, description: 'Crispy dosa with potato' },
        { item_id: uuidv4(), item_name: 'Upma', price: 90, description: 'Savory semolina dish' },
        { item_id: uuidv4(), item_name: 'Ragi Mudde', price: 150, description: 'Finger millet dumpling' }
      ]
    },

    // Chennai Restaurants
    {
      id: uuidv4(),
      name: 'Coastal Flavors',
      cuisine: 'Coastal/Seafood',
      address: '321 Beach Road, Fort Kochi',
      location: 'Chennai',
      rating: 4.5,
      menu: [
        { item_id: uuidv4(), item_name: 'Fish Curry', price: 480, description: 'Spiced fish in coconut gravy' },
        { item_id: uuidv4(), item_name: 'Crab Masala', price: 550, description: 'Fresh crab with aromatic spices' },
        { item_id: uuidv4(), item_name: 'Prawn Biryani', price: 420, description: 'Fragrant rice with prawns' }
      ]
    },
    {
      id: uuidv4(),
      name: 'Saravana Bhavan',
      cuisine: 'South Indian Vegetarian',
      address: '654 Anna Salai',
      location: 'Chennai',
      rating: 4.8,
      menu: [
        { item_id: uuidv4(), item_name: 'Rava Dosa', price: 100, description: 'Crispy semolina dosa' },
        { item_id: uuidv4(), item_name: 'Sambhar Rice', price: 110, description: 'Rice with lentil stew' },
        { item_id: uuidv4(), item_name: 'Pongal', price: 120, description: 'Rice and lentil dish' }
      ]
    },
    {
      id: uuidv4(),
      name: 'Pearl Biryani House',
      cuisine: 'Biryani',
      address: '987 Mylapore',
      location: 'Chennai',
      rating: 4.6,
      menu: [
        { item_id: uuidv4(), item_name: 'Chennai Biryani', price: 350, description: 'Local biryani specialty' },
        { item_id: uuidv4(), item_name: 'Dum Biryani', price: 380, description: 'Slow-cooked biryani' },
        { item_id: uuidv4(), item_name: 'Raita', price: 60, description: 'Yogurt side dish' }
      ]
    },

    // Hyderabad Restaurants
    {
      id: uuidv4(),
      name: 'Biryani House',
      cuisine: 'Hyderabadi',
      address: '456 Charminar Road',
      location: 'Hyderabad',
      rating: 4.7,
      menu: [
        { item_id: uuidv4(), item_name: 'Hyderabadi Biryani', price: 380, description: 'Fragrant rice with meat' },
        { item_id: uuidv4(), item_name: 'Dum Pukht', price: 420, description: 'Slow-cooked delicacy' },
        { item_id: uuidv4(), item_name: 'Halim', price: 250, description: 'Traditional meat and wheat dish' }
      ]
    },
    {
      id: uuidv4(),
      name: 'Karachi Bakery',
      cuisine: 'Hyderabadi/Baked',
      address: '123 Laad Bazaar',
      location: 'Hyderabad',
      rating: 4.6,
      menu: [
        { item_id: uuidv4(), item_name: 'Double Ka Meetha', price: 80, description: 'Bread pudding dessert' },
        { item_id: uuidv4(), item_name: 'Sheermal', price: 60, description: 'Sweet saffron bread' },
        { item_id: uuidv4(), item_name: 'Kulcha', price: 50, description: 'Stuffed bread' }
      ]
    },
    {
      id: uuidv4(),
      name: 'Spicy Aroma',
      cuisine: 'Hyderabadi Non-Veg',
      address: '789 Secunderabad',
      location: 'Hyderabad',
      rating: 4.5,
      menu: [
        { item_id: uuidv4(), item_name: 'Nihari', price: 320, description: 'Slow-cooked meat curry' },
        { item_id: uuidv4(), item_name: 'Khichdi', price: 200, description: 'Meat and rice mixture' },
        { item_id: uuidv4(), item_name: 'Kebab', price: 280, description: 'Spiced meat kebab' }
      ]
    },

    // Kolkata Restaurants
    {
      id: uuidv4(),
      name: 'Bengal Sweet House',
      cuisine: 'Bengali',
      address: '987 Rabindra Sarovar',
      location: 'Kolkata',
      rating: 4.4,
      menu: [
        { item_id: uuidv4(), item_name: 'Fish Fry', price: 350, description: 'Crispy mustard fish' },
        { item_id: uuidv4(), item_name: 'Luchi Aloo', price: 150, description: 'Fried bread with potato curry' },
        { item_id: uuidv4(), item_name: 'Rasgulla', price: 80, description: 'Sweet cheese balls in syrup' }
      ]
    },
    {
      id: uuidv4(),
      name: 'Nizam\'s Kitchen',
      cuisine: 'Bengali Non-Veg',
      address: '321 Park Circus',
      location: 'Kolkata',
      rating: 4.6,
      menu: [
        { item_id: uuidv4(), item_name: 'Kosha Mangsho', price: 380, description: 'Slow-cooked meat' },
        { item_id: uuidv4(), item_name: 'Chingri Malai Curry', price: 420, description: 'Prawns in cream' },
        { item_id: uuidv4(), item_name: 'Teesta Biryani', price: 350, description: 'Local biryani style' }
      ]
    },
    {
      id: uuidv4(),
      name: 'Sweet Nostalgia',
      cuisine: 'Bengali Sweets',
      address: '654 College Street',
      location: 'Kolkata',
      rating: 4.7,
      menu: [
        { item_id: uuidv4(), item_name: 'Sandesh', price: 70, description: 'Traditional cheese sweet' },
        { item_id: uuidv4(), item_name: 'Rosogolla', price: 60, description: 'Spongy cheese balls' },
        { item_id: uuidv4(), item_name: 'Mishti Doi', price: 100, description: 'Caramelized yogurt' }
      ]
    }
  ];

  return sampleRestaurants;
}

// Seed admin + restaurants into SQLite if empty
seedAdmin();
seedRestaurants(getSampleRestaurants());

// ==================== ROUTES ====================

/**
 * Redirect root and /login to Frontend
 */
app.get('/', (req, res) => {
  res.redirect('http://localhost:5000/');
});

app.get('/login', (req, res) => {
  res.redirect('http://localhost:5000/');
});

/**
 * GET /health - Health Check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'Node Server Healthy', timestamp: new Date().toISOString() });
});

// ==================== USER ROUTES ====================

/**
 * POST /users/register - Register User
 */
app.post('/users/register', (req, res) => {
  try {
    const { email, password, name, phone, location } = req.body;

    // Check if user exists
    getUserByEmail(email)
      .then(existing => {
        if (existing) {
          return res.status(400).json({ error: 'Email already registered' });
        }
        return createUser({ email, name, phone, location });
      })
      .then(({ id }) => {
        console.log(`✅ User registered: ${id}`);
        return res.status(201).json({
          message: 'User registered successfully',
          user_id: id,
          name: name,
          location: location
        });
      })
      .catch(error => {
        return res.status(500).json({ error: error.message });
      });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /users/login - Login User
 */
app.post('/users/login', (req, res) => {
  try {
    const { email, password } = req.body;
    getUserByEmail(email)
      .then(user => {
        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        console.log(`✅ User logged in: ${email}`);
        return res.json({
          message: 'Login successful',
          user_id: user.id,
          name: user.name
        });
      })
      .catch(error => {
        return res.status(500).json({ error: error.message });
      });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /users/:id - Get User Profile
 */
app.get('/users/:id', (req, res) => {
  try {
    getUserById(req.params.id)
      .then(user => {
        if (!user) return res.status(404).json({ error: 'User not found' });
        return res.json(user);
      })
      .catch(error => {
        return res.status(500).json({ error: error.message });
      });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== ADMIN ROUTES ====================

/**
 * POST /admin/login - Admin Login
 */
app.post('/admin/login', (req, res) => {
  try {
    const { email, password } = req.body;
    getAdminByEmailAndPassword(email, password)
      .then(admin => {
        if (!admin) return res.status(401).json({ error: 'Invalid admin credentials' });
        console.log(`✅ Admin logged in: ${email}`);
        return res.json({
          message: 'Admin login successful',
          admin_id: admin.id,
          name: admin.name
        });
      })
      .catch(error => {
        return res.status(500).json({ error: error.message });
      });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /admin/orders - Get All Orders (Admin Only)
 */
// Placeholder: orders are managed by Python server. This route remains for compatibility.
app.get('/admin/orders', (req, res) => {
  try {
    return res.json({ orders: [] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /admin/orders/:order_id/status - Update Order Status (Admin Only)
 */
app.put('/admin/orders/:order_id/status', (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.order_id;

    // Note: In production, verify admin authorization here
    // For now, we're storing orders from the Python server
    // We need to pass this through the gateway to the Python server

    return res.json({
      message: 'Order status updated',
      order_id: orderId,
      new_status: status
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== INTER-SERVICE COMMUNICATION ENDPOINTS ====================

/**
 * POST /notifications/order-status-update - Receive order status notifications from Python
 */
app.post('/notifications/order-status-update', (req, res) => {
  try {
    const notification = req.body;
    insertNotification(notification)
      .then(({ id }) => {
        console.log(`📡 RECEIVED NOTIFICATION FROM PYTHON SERVER`);
        console.log(`   Order ID: ${notification.order_id}`);
        console.log(`   New Status: ${notification.status}`);
        console.log(`   Message: ${notification.message}`);
        return res.status(200).json({ message: 'Notification received', notification_id: id });
      })
      .catch(error => {
        console.error('❌ Error processing notification:', error.message);
        return res.status(500).json({ error: error.message });
      });
  } catch (error) {
    console.error('❌ Error processing notification:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /notifications - Get all notifications received from Python
 */
app.get('/notifications', (req, res) => {
  try {
    listNotifications()
      .then(notifications => {
        return res.json({ notifications, total: notifications.length });
      })
      .catch(error => {
        return res.status(500).json({ error: error.message });
      });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /interservice/verify-user - Verify user exists (called by Python if needed)
 */
app.post('/interservice/verify-user', (req, res) => {
  try {
    const { user_id } = req.body;
    getUserById(user_id)
      .then(user => {
        if (user) {
          console.log(`✅ User verification from Python: ${user_id} EXISTS`);
          return res.json({
            exists: true,
            user: { id: user.id, name: user.name, email: user.email }
          });
        } else {
          console.log(`⚠️ User verification from Python: ${user_id} NOT FOUND`);
          return res.json({ exists: false });
        }
      })
      .catch(error => {
        return res.status(500).json({ error: error.message });
      });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== RESTAURANT ROUTES ====================

/**
 * GET /restaurants - List All Restaurants
 */
app.get('/restaurants', (req, res) => {
  try {
    const location = req.query.location;
    listRestaurants(location)
      .then(restaurants => res.json({ restaurants }))
      .catch(error => res.status(500).json({ error: error.message }));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /restaurants - List All Restaurants
 */
app.get('/restaurants', (req, res) => {
  try {
    const location = req.query.location;
    console.log(`📤 GET /restaurants${location ? `?location=${location}` : ''} → Filtering by location`);
    listRestaurants(location)
      .then(restaurants => {
        return res.json({ restaurants });
      })
      .catch(error => res.status(500).json({ error: error.message }));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /locations - Get Available Locations
 */
app.get('/locations', (req, res) => {
  try {
    console.log('📤 GET /locations → Fetching available locations');
    listAvailableLocations()
      .then(locations => {
        return res.json({ locations });
      })
      .catch(error => res.status(500).json({ error: error.message }));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /restaurants/:id - Get Restaurant Details
 */
app.get('/restaurants/:id', (req, res) => {
  try {
    getRestaurantById(req.params.id)
      .then(restaurant => {
        if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
        return res.json(restaurant);
      })
      .catch(error => res.status(500).json({ error: error.message }));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /restaurants/:id/menu - Get Restaurant Menu
 */
app.get('/restaurants/:id/menu', (req, res) => {
  try {
    getMenuByRestaurantId(req.params.id)
      .then(menu => {
        // Ensure each item has a web image URL; fallback to Unsplash based on item name
        const enhanced = (menu || []).map(item => ({
          ...item,
          image_url: item.image_url || `https://source.unsplash.com/400x250/?${encodeURIComponent(item.item_name)}%20food`
        }));
        return res.json({ menu: enhanced });
      })
      .catch(error => res.status(500).json({ error: error.message }));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /restaurants - Create Restaurant (Admin)
 */
app.post('/restaurants', (req, res) => {
  try {
    const { name, cuisine, address, location, rating } = req.body;
    createRestaurant({ name, cuisine, address, location, rating })
      .then(({ id }) => {
        console.log(`✅ Restaurant created: ${id}`);
        return res.status(201).json({ message: 'Restaurant created successfully', restaurant_id: id });
      })
      .catch(error => res.status(500).json({ error: error.message }));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== RESTAURANT MANAGER ROUTES ====================

/**
 * POST /restaurant/register - Register New Restaurant
 */
app.post('/restaurant/register', (req, res) => {
  try {
    const { name, email, password, cuisine, address, location, phone } = req.body;
    
    // Check if email already exists in restaurant_credentials
    getRestaurantByEmailAndPassword(email, password).then(existing => {
      if (existing) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      
      // Create restaurant record
      createRestaurant({ name, cuisine, address, location, rating: 4.0 })
        .then(({ id }) => {
          // Create credentials for restaurant
          return createRestaurantCredentials({ restaurant_id: id, email, password })
            .then(() => {
              console.log(`✅ Restaurant registered: ${id}`);
              res.status(201).json({
                message: 'Restaurant registered successfully',
                restaurant_id: id,
                restaurant_name: name
              });
            });
        })
        .catch(error => res.status(500).json({ error: error.message }));
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /restaurant/login - Restaurant Manager Login
 */
app.post('/restaurant/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    getRestaurantByEmailAndPassword(email, password)
      .then(restaurant => {
        if (!restaurant) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log(`✅ Restaurant logged in: ${email}`);
        res.json({
          message: 'Login successful',
          restaurant_id: restaurant.restaurant_id,
          restaurant_name: restaurant.restaurant_name
        });
      })
      .catch(error => res.status(500).json({ error: error.message }));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /restaurant/:id/menu - Get Restaurant Menu
 */
app.get('/restaurant/:id/menu', (req, res) => {
  try {
    getMenuByRestaurantId(req.params.id)
      .then(menu => {
        const enhanced = (menu || []).map(item => ({
          ...item,
          image_url: item.image_url || `https://source.unsplash.com/400x250/?${encodeURIComponent(item.item_name)}%20food`
        }));
        return res.json({ menu: enhanced });
      })
      .catch(error => res.status(500).json({ error: error.message }));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /restaurant/menu/add - Add Menu Item
 */
app.post('/restaurant/menu/add', (req, res) => {
  try {
    const { restaurant_id, item_name, price, description, image_url } = req.body;
    
    const itemId = uuidv4();
    const menuId = uuidv4();
    
    db.run(
      'INSERT INTO restaurant_menu (id, restaurant_id, item_id, item_name, price, description, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [menuId, restaurant_id, itemId, item_name, price, description || '', image_url || 'http://localhost:5000/static/images/food.jpg'],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to add menu item' });
        }
        console.log(`✅ Menu item added: ${item_name}`);
        res.status(201).json({
          message: 'Menu item added successfully',
          item_id: itemId
        });
      }
    );
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /restaurant/menu/:item_id - Delete Menu Item
 */
app.delete('/restaurant/menu/:item_id', (req, res) => {
  try {
    db.run(
      'DELETE FROM restaurant_menu WHERE item_id = ?',
      [req.params.item_id],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to delete menu item' });
        }
        console.log(`✅ Menu item deleted: ${req.params.item_id}`);
        res.json({ message: 'Menu item deleted successfully' });
      }
    );
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /restaurant/:id/orders - Get Restaurant Orders
 */
app.get('/restaurant/:id/orders', (req, res) => {
  try {
    // This will be handled by gateway forwarding to Python server
    axios.get(`http://localhost:5001/restaurant/${req.params.id}/orders`)
      .then(response => res.json(response.data))
      .catch(error => res.status(500).json({ error: 'Failed to fetch orders' }));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /restaurant/orders/:order_id/status - Update Order Status
 */
app.put('/restaurant/orders/:order_id/status', (req, res) => {
  try {
    const { status, action } = req.body;
    
    // Forward to Python server
    axios.put(`http://localhost:5001/restaurant/orders/${req.params.order_id}/status`, { status, action })
      .then(response => res.json(response.data))
      .catch(error => res.status(500).json({ error: 'Failed to update order status' }));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== ERROR HANDLER ====================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🚀 Node Backend Server Started        ║
║    Port: ${PORT}                        ║
║    Service: Users & Restaurants        ║
╚════════════════════════════════════════╝
  `);
});
