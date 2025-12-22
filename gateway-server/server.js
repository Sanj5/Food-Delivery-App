/**
 * Gateway Server - Load Balancer & Request Router
 * Port: 3000
 * Routes requests between Frontend and Backend Services
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// ==================== BACKEND SERVERS CONFIG ====================
const backends = [
  { id: 1, url: process.env.PYTHON_SERVER_URL || 'http://localhost:5001', name: 'Python Server (Orders)', type: 'python', healthy: true },
  { id: 2, url: process.env.NODE_SERVER_URL || 'http://localhost:5002', name: 'Node Server (Users/Restaurants)', type: 'node', healthy: true }
];

let roundRobinIndex = 0;

// ==================== LOAD BALANCER ====================

/**
 * Round-Robin Load Balancing
 */
function getNextBackend() {
  const healthyBackends = backends.filter(b => b.healthy);
  if (healthyBackends.length === 0) {
    throw new Error('No healthy backends available');
  }
  const backend = healthyBackends[roundRobinIndex % healthyBackends.length];
  roundRobinIndex++;
  return backend;
}

/**
 * Get specific backend by type
 */
function getBackendByType(type) {
  const backend = backends.find(b => b.type === type && b.healthy);
  if (!backend) throw new Error(`${type} backend unavailable`);
  return backend;
}

/**
 * Health Check
 */
async function checkHealthStatus() {
  for (let backend of backends) {
    try {
      const response = await axios.get(`${backend.url}/health`, { timeout: 5000 });
      backend.healthy = response.status === 200;
      console.log(`✅ ${backend.name} is healthy`);
    } catch (error) {
      backend.healthy = false;
      console.warn(`❌ ${backend.name} is unavailable`);
    }
  }
}

// Run health checks every 30 seconds
setInterval(checkHealthStatus, 30000);

// Initial health check
checkHealthStatus();

// ==================== API ROUTES ====================

/**
 * Redirects for root and login to Frontend
 */
app.get('/', (req, res) => {
  res.redirect('http://localhost:5000/');
});

app.get('/login', (req, res) => {
  res.redirect('http://localhost:5000/');
});

/**
 * GET /health - Gateway Health Check
 */
app.get('/health', (req, res) => {
  const status = backends.map(b => ({ name: b.name, healthy: b.healthy }));
  res.json({ status: 'Gateway Healthy', backends: status, timestamp: new Date() });
});

// ==================== AUTHENTICATION ROUTES ====================

/**
 * POST /api/auth/register
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('📤 POST /api/auth/register → Node Server (5002)');
    const backend = getBackendByType('node');
    const response = await axios.post(`${backend.url}/users/register`, req.body);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Register error:', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('📤 POST /api/auth/login → Node Server (5002)');
    const backend = getBackendByType('node');
    const response = await axios.post(`${backend.url}/users/login`, req.body);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ==================== RESTAURANT ROUTES ====================

/**
 * GET /api/restaurants
 */
app.get('/api/restaurants', async (req, res) => {
  try {
    const location = req.query.location;
    console.log('📤 GET /api/restaurants → Node Server (5002)');
    const backend = getBackendByType('node');
    const url = location ? `${backend.url}/restaurants?location=${location}` : `${backend.url}/restaurants`;
    const response = await axios.get(url);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Get restaurants error:', error.message);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

/**
 * GET /api/restaurants/:id
 */
app.get('/api/restaurants/:id', async (req, res) => {
  try {
    console.log(`📤 GET /api/restaurants/${req.params.id} → Node Server (5002)`);
    const backend = getBackendByType('node');
    const response = await axios.get(`${backend.url}/restaurants/${req.params.id}`);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Get restaurant error:', error.message);
    res.status(500).json({ error: 'Restaurant not found' });
  }
});

/**
 * GET /api/restaurants/:id/menu
 */
app.get('/api/restaurants/:id/menu', async (req, res) => {
  try {
    console.log(`📤 GET /api/restaurants/${req.params.id}/menu → Node Server (5002)`);
    const backend = getBackendByType('node');
    const response = await axios.get(`${backend.url}/restaurants/${req.params.id}/menu`);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Get menu error:', error.message);
    res.status(500).json({ error: 'Menu not found' });
  }
});

/**
 * GET /api/locations - Get Available Locations
 */
app.get('/api/locations', async (req, res) => {
  try {
    console.log('📤 GET /api/locations → Node Server (5002)');
    const backend = getBackendByType('node');
    const response = await axios.get(`${backend.url}/locations`);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Get locations error:', error.message);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// ==================== ORDER ROUTES ====================

/**
 * POST /api/orders - Create Order
 */
app.post('/api/orders', async (req, res) => {
  try {
    console.log('📤 POST /api/orders → Python Server (5001)');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const backend = getBackendByType('python');
    const response = await axios.post(`${backend.url}/orders`, req.body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    console.log('✅ Response:', response.status, response.data);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Create order error:', error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Order creation failed: ' + error.message });
    }
  }
});

/**
 * GET /api/orders - Get User Orders
 */
app.get('/api/orders', async (req, res) => {
  try {
    const userId = req.query.user_id;
    console.log(`📤 GET /api/orders?user_id=${userId} → Python Server (5001)`);
    const backend = getBackendByType('python');
    const response = await axios.get(`${backend.url}/orders?user_id=${userId}`);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Get orders error:', error.message);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * GET /api/orders/:id - Get Order Details
 */
app.get('/api/orders/:id', async (req, res) => {
  try {
    console.log(`📤 GET /api/orders/${req.params.id} → Python Server (5001)`);
    const backend = getBackendByType('python');
    const response = await axios.get(`${backend.url}/orders/${req.params.id}`);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Get order error:', error.message);
    res.status(500).json({ error: 'Order not found' });
  }
});

// ==================== ADMIN ROUTES ====================

/**
 * POST /api/admin/login
 */
app.post('/api/admin/login', async (req, res) => {
  try {
    console.log('📤 POST /api/admin/login → Node Server (5002)');
    const backend = getBackendByType('node');
    const response = await axios.post(`${backend.url}/admin/login`, req.body);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Admin login error:', error.message);
    res.status(401).json({ error: 'Admin login failed' });
  }
});

/**
 * GET /api/admin/orders - Get All Orders
 */
app.get('/api/admin/orders', async (req, res) => {
  try {
    console.log('📤 GET /api/admin/orders → Python Server (5001)');
    const backend = getBackendByType('python');
    const response = await axios.get(`${backend.url}/admin/orders`);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Get all orders error:', error.message);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * PUT /api/admin/orders/:order_id/status - Update Order Status
 */
app.put('/api/admin/orders/:order_id/status', async (req, res) => {
  try {
    const orderId = req.params.order_id;
    console.log(`📤 PUT /api/admin/orders/${orderId}/status → Python Server (5001)`);
    const backend = getBackendByType('python');
    const response = await axios.put(`${backend.url}/admin/orders/${orderId}/status`, req.body);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Update order status error:', error.message);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ==================== RESTAURANT MANAGER ROUTES ====================

/**
 * POST /api/restaurant/register - Register Restaurant
 */
app.post('/api/restaurant/register', async (req, res) => {
  try {
    console.log('📤 POST /api/restaurant/register → Node Server (5002)');
    const backend = getBackendByType('node');
    const response = await axios.post(`${backend.url}/restaurant/register`, req.body);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Restaurant register error:', error.message);
    res.status(400).json({ error: error.response?.data?.error || 'Registration failed' });
  }
});

/**
 * POST /api/restaurant/login - Restaurant Login
 */
app.post('/api/restaurant/login', async (req, res) => {
  try {
    console.log('📤 POST /api/restaurant/login → Node Server (5002)');
    const backend = getBackendByType('node');
    const response = await axios.post(`${backend.url}/restaurant/login`, req.body);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Restaurant login error:', error.message);
    res.status(401).json({ error: error.response?.data?.error || 'Login failed' });
  }
});

/**
 * GET /api/restaurant/:id/menu - Get Restaurant Menu (for management)
 */
app.get('/api/restaurant/:id/menu', async (req, res) => {
  try {
    console.log(`📤 GET /api/restaurant/${req.params.id}/menu → Node Server (5002)`);
    const backend = getBackendByType('node');
    const response = await axios.get(`${backend.url}/restaurant/${req.params.id}/menu`);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Get restaurant menu error:', error.message);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

/**
 * POST /api/restaurant/menu/add - Add Menu Item
 */
app.post('/api/restaurant/menu/add', async (req, res) => {
  try {
    console.log('📤 POST /api/restaurant/menu/add → Node Server (5002)');
    const backend = getBackendByType('node');
    const response = await axios.post(`${backend.url}/restaurant/menu/add`, req.body);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Add menu item error:', error.message);
    res.status(500).json({ error: error.response?.data?.error || 'Failed to add menu item' });
  }
});

/**
 * DELETE /api/restaurant/menu/:item_id - Delete Menu Item
 */
app.delete('/api/restaurant/menu/:item_id', async (req, res) => {
  try {
    console.log(`📤 DELETE /api/restaurant/menu/${req.params.item_id} → Node Server (5002)`);
    const backend = getBackendByType('node');
    const response = await axios.delete(`${backend.url}/restaurant/menu/${req.params.item_id}`);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Delete menu item error:', error.message);
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

/**
 * GET /api/restaurant/:id/orders - Get Restaurant Orders
 */
app.get('/api/restaurant/:id/orders', async (req, res) => {
  try {
    console.log(`📤 GET /api/restaurant/${req.params.id}/orders → Python Server (5001)`);
    const backend = getBackendByType('python');
    const response = await axios.get(`${backend.url}/restaurant/${req.params.id}/orders`);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Get restaurant orders error:', error.message);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * PUT /api/restaurant/orders/:order_id/status - Update Order Status (Restaurant)
 */
app.put('/api/restaurant/orders/:order_id/status', async (req, res) => {
  try {
    const orderId = req.params.order_id;
    console.log(`📤 PUT /api/restaurant/orders/${orderId}/status → Python Server (5001)`);
    const backend = getBackendByType('python');
    const response = await axios.put(`${backend.url}/restaurant/orders/${orderId}/status`, req.body);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ Update restaurant order status error:', error.message);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ==================== ERROR HANDLER ====================

app.use((err, req, res, next) => {
  console.error('Gateway error:', err);
  res.status(500).json({ error: 'Internal gateway error' });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║    🚀 Gateway Server Started               ║
║    Port: ${PORT}                            ║
║    Load Balancer: Round-Robin              ║
║    Health Check: Every 30 seconds          ║
╚════════════════════════════════════════════╝
  `);
});
