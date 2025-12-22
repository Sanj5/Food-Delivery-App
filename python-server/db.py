# SQLite database helpers for Python Orders Server
import sqlite3
import json
from datetime import datetime
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'food_delivery_py.db')

conn = sqlite3.connect(DB_PATH, check_same_thread=False)
conn.execute('PRAGMA foreign_keys = ON')

conn.execute(
    '''CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        user_id TEXT,
        restaurant_id TEXT,
        restaurant_name TEXT,
        items_json TEXT,
        total REAL,
        status TEXT,
        created_at TEXT,
        updated_at TEXT
    )'''
)

# Light migration: add image_url column if it doesn't exist
try:
    conn.execute('ALTER TABLE orders ADD COLUMN items_with_images_json TEXT')
except sqlite3.OperationalError:
    pass  # Column already exists or table doesn't support it

conn.commit()


def create_order(order):
    conn.execute(
        'INSERT INTO orders (order_id, user_id, restaurant_id, restaurant_name, items_json, total, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (
            order['order_id'],
            order['user_id'],
            order['restaurant_id'],
            order['restaurant_name'],
            json.dumps(order.get('items', [])),
            float(order.get('total', 0)),
            order.get('status', 'pending'),
            order['created_at'],
            order.get('updated_at')
        )
    )
    conn.commit()


def get_orders_by_user(user_id):
    cur = conn.execute('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', (user_id,))
    rows = cur.fetchall()
    return [
        {
            'order_id': r[0], 'user_id': r[1], 'restaurant_id': r[2], 'restaurant_name': r[3],
            'items': json.loads(r[4] or '[]'), 'total': r[5], 'status': r[6],
            'created_at': r[7], 'updated_at': r[8]
        }
        for r in rows
    ]


def get_order(order_id):
    cur = conn.execute('SELECT * FROM orders WHERE order_id = ?', (order_id,))
    r = cur.fetchone()
    if not r:
        return None
    return {
        'order_id': r[0], 'user_id': r[1], 'restaurant_id': r[2], 'restaurant_name': r[3],
        'items': json.loads(r[4] or '[]'), 'total': r[5], 'status': r[6],
        'created_at': r[7], 'updated_at': r[8]
    }


def update_order_status(order_id, new_status):
    ts = datetime.now().isoformat()
    conn.execute('UPDATE orders SET status = ?, updated_at = ? WHERE order_id = ?', (new_status, ts, order_id))
    conn.commit()
    return get_order(order_id)


def get_all_orders():
    cur = conn.execute('SELECT * FROM orders ORDER BY created_at DESC')
    rows = cur.fetchall()
    return [
        {
            'order_id': r[0], 'user_id': r[1], 'restaurant_id': r[2], 'restaurant_name': r[3],
            'items': json.loads(r[4] or '[]'), 'total': r[5], 'status': r[6],
            'created_at': r[7], 'updated_at': r[8]
        }
        for r in rows
    ]
