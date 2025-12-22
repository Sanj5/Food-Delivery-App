// SQLite database setup for Node Server (Users & Restaurants)
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const DB_PATH = path.join(__dirname, 'food_delivery_node.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
  
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    phone TEXT,
    location TEXT,
    created_at TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS restaurants (
    id TEXT PRIMARY KEY,
    name TEXT,
    cuisine TEXT,
    address TEXT,
    location TEXT,
    rating REAL,
    created_at TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS restaurant_credentials (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    created_at TEXT,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS restaurant_menu (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT,
    item_id TEXT UNIQUE,
    item_name TEXT,
    price REAL,
    description TEXT,
    image_url TEXT,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
  )`);

  // Lightweight migration: ensure image_url column exists
  db.all('PRAGMA table_info(restaurant_menu)', (err, rows) => {
    if (!err) {
      const hasImageUrl = rows.some(r => r.name === 'image_url');
      if (!hasImageUrl) {
        db.run('ALTER TABLE restaurant_menu ADD COLUMN image_url TEXT', (e) => {
          if (e) console.warn('⚠️ Could not add image_url column (it may already exist).');
          else console.log('✅ Added image_url column to restaurant_menu');
        });
      }
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    status TEXT,
    message TEXT,
    received_at TEXT
  )`);
});

// Admin seeding
function seedAdmin() {
  db.get('SELECT COUNT(*) AS count FROM admins', (err, row) => {
    if (err) return console.error('Admin seed error:', err);
    if (row.count === 0) {
      const adminId = uuidv4();
      db.run(
        'INSERT INTO admins (id, email, password, name) VALUES (?, ?, ?, ?)',
        [adminId, 'admin@fooddelivery.com', 'admin123', 'Admin User'],
        (err2) => {
          if (err2) console.error('Admin insert error:', err2);
          else console.log('✅ Admin account initialized (admin@fooddelivery.com / admin123)');
        }
      );
    }
  });
}

// Restaurants seeding
function seedRestaurants(sampleRestaurants) {
  db.get('SELECT COUNT(*) AS count FROM restaurants', (err, row) => {
    if (err) return console.error('Restaurant seed error:', err);
    if (row.count === 0) {
      const stmtRest = db.prepare('INSERT INTO restaurants (id, name, cuisine, address, location, rating, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const stmtMenu = db.prepare('INSERT INTO restaurant_menu (id, restaurant_id, item_id, item_name, price, description, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)');
      sampleRestaurants.forEach(rest => {
        stmtRest.run(rest.id, rest.name, rest.cuisine, rest.address, rest.location, rest.rating || 4.0, new Date().toISOString());
        (rest.menu || []).forEach(mi => {
          const imageUrl = 'http://localhost:5000/static/images/food.jpg';
          stmtMenu.run(uuidv4(), rest.id, mi.item_id, mi.item_name, mi.price, mi.description || '', imageUrl);
        });
      });
      stmtRest.finalize();
      stmtMenu.finalize();
      console.log('✅ Sample data initialized in SQLite');
    }
  });
}

// Users
function getUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function getUserById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function createUser({ email, name, phone, location }) {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    db.run(
      'INSERT INTO users (id, email, name, phone, location, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, email, name, phone, location || 'Not specified', new Date().toISOString()],
      (err) => {
        if (err) return reject(err);
        resolve({ id });
      }
    );
  });
}

// Admins
function getAdminByEmailAndPassword(email, password) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM admins WHERE email = ? AND password = ?', [email, password], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

// Restaurant Credentials
function getRestaurantByEmailAndPassword(email, password) {
  return new Promise((resolve, reject) => {
    db.get('SELECT rc.*, r.name as restaurant_name FROM restaurant_credentials rc JOIN restaurants r ON rc.restaurant_id = r.id WHERE rc.email = ? AND rc.password = ?', [email, password], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function createRestaurantCredentials({ restaurant_id, email, password }) {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    db.run(
      'INSERT INTO restaurant_credentials (id, restaurant_id, email, password, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, restaurant_id, email, password, new Date().toISOString()],
      (err) => {
        if (err) return reject(err);
        resolve({ id });
      }
    );
  });
}

// Restaurants
function listRestaurants(location) {
  return new Promise((resolve, reject) => {
    const baseQuery = 'SELECT id, name, cuisine, address, location, rating FROM restaurants';
    const params = [];
    let query = baseQuery;
    if (location) {
      query += ' WHERE LOWER(location) = LOWER(?)';
      params.push(location);
    }
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function listAvailableLocations() {
  return new Promise((resolve, reject) => {
    db.all('SELECT DISTINCT location FROM restaurants ORDER BY location', [], (err, rows) => {
      if (err) return reject(err);
      const locations = rows ? rows.map(r => r.location) : [];
      resolve(locations);
    });
  });
}

function getRestaurantById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, name, cuisine, address, location, rating FROM restaurants WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function getMenuByRestaurantId(id) {
  return new Promise((resolve, reject) => {
    db.all('SELECT item_id, item_name, price, description, image_url FROM restaurant_menu WHERE restaurant_id = ?', [id], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function createRestaurant({ name, cuisine, address, location, rating }) {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    db.run(
      'INSERT INTO restaurants (id, name, cuisine, address, location, rating, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, cuisine, address, location || 'Unknown', rating || 4.0, new Date().toISOString()],
      (err) => {
        if (err) return reject(err);
        resolve({ id });
      }
    );
  });
}

// Notifications
function insertNotification({ order_id, status, message }) {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    db.run(
      'INSERT INTO notifications (id, order_id, status, message, received_at) VALUES (?, ?, ?, ?, ?)',
      [id, order_id, status, message, new Date().toISOString()],
      (err) => {
        if (err) return reject(err);
        resolve({ id });
      }
    );
  });
}

function listNotifications() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM notifications ORDER BY received_at DESC', [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

module.exports = {
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
};
