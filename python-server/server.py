"""
Python Backend Server (Flask)
Port: 5001
Handles Orders and Payments
Communicates with Frontend via Gateway & Node Server
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import uuid
from datetime import datetime
import requests
import os
from db import (
    create_order as db_create_order,
    get_orders_by_user as db_get_orders_by_user,
    get_order as db_get_order,
    update_order_status as db_update_order_status,
    get_all_orders as db_get_all_orders,
)

app = Flask(__name__)
CORS(app)

PORT = int(os.environ.get('PORT', 5001))
NODE_SERVER_URL = os.environ.get('NODE_SERVER_URL', 'http://localhost:5002')  # Direct Node Server communication

# Orders are persisted in SQLite via db.py

# ==================== ROUTES ====================

@app.route('/health', methods=['GET'])
def health():
    """Health Check"""
    return jsonify({'status': 'Python Server Healthy', 'timestamp': datetime.now().isoformat()})

@app.route('/orders', methods=['POST'])
def create_order():
    """
    Create Order
    Fetches restaurant details from Node Server
    Expected: {
        "user_id": "...",
        "restaurant_id": "...",
        "items": [...],
        "total": 50.00
    }
    """
    try:
        data = request.json
        print(f'📥 Received order request: {data}')
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # ========== INTER-SERVICE COMMUNICATION ==========
        # Fetch restaurant details from Node Server
        restaurant_id = data.get('restaurant_id')
        try:
            restaurant_response = requests.get(
                f'{NODE_SERVER_URL}/restaurants/{restaurant_id}',
                timeout=5
            )
            if restaurant_response.status_code == 200:
                restaurant = restaurant_response.json()
                print(f'📡 Fetched restaurant from Node Server: {restaurant.get("name")}')
            else:
                print(f'⚠️ Could not fetch restaurant from Node Server')
                restaurant = None
        except Exception as e:
            print(f'❌ Node Server communication error: {e}')
            restaurant = None
        
        # Fetch menu items with images from Node Server
        menu_items_map = {}
        try:
            menu_response = requests.get(
                f'{NODE_SERVER_URL}/restaurants/{restaurant_id}/menu',
                timeout=5
            )
            if menu_response.status_code == 200:
                menu = menu_response.json().get('menu', [])
                # Build map of item_id -> image_url
                for menu_item in menu:
                    menu_items_map[menu_item.get('item_id')] = menu_item.get('image_url')
                print(f'📡 Fetched menu with {len(menu)} items from Node Server')
        except Exception as e:
            print(f'⚠️ Could not fetch menu images: {e}')
        
        items_with_images = []
        for item in data.get('items', []):
            item_id = item.get('item_id')
            item_name = item.get('item_name', 'Item')
            quantity = item.get('quantity', 1)
            
            # Use fetched image or fallback to Unsplash
            image_url = menu_items_map.get(item_id) or f"https://source.unsplash.com/400x250/?{item_name.replace(' ', '%20')}%20food"
            
            items_with_images.append({
                'item_id': item_id,
                'item_name': item_name,
                'quantity': quantity,
                'image_url': image_url
            })
        # ================================================
        
        order_id = str(uuid.uuid4())
        
        order = {
            'order_id': order_id,
            'user_id': data.get('user_id'),
            'restaurant_id': restaurant_id,
            'restaurant_name': restaurant.get('name') if restaurant else 'Unknown',
            'items': items_with_images,
            'total': data.get('total'),
            'status': 'pending',
            'created_at': datetime.now().isoformat()
        }
        
        db_create_order(order)
        print(f'✅ Order created: {order_id}')
        return jsonify(order), 201
    except Exception as e:
        print(f'❌ Error creating order: {e}')
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/orders', methods=['GET'])
def get_user_orders():
    """Get Orders by User"""
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'orders': []}), 200
        
        return jsonify({'orders': db_get_orders_by_user(user_id)}), 200
    except Exception as e:
        print(f'❌ Error getting orders: {e}')
        return jsonify({'error': str(e), 'orders': []}), 500

@app.route('/orders/<order_id>', methods=['GET'])
def get_order(order_id):
    """Get Order Details"""
    try:
        order = db_get_order(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        return jsonify(order), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/orders/<order_id>', methods=['PUT'])
def update_order(order_id):
    """Update Order Status"""
    try:
        data = request.json
        new_status = data.get('status')
        order = db_update_order_status(order_id, new_status)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        print(f'✅ Order {order_id} updated to {order["status"]}')
        return jsonify(order), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== ADMIN ROUTES ====================

@app.route('/admin/orders', methods=['GET'])
def admin_get_all_orders():
    """Get All Orders (Admin)"""
    try:
        return jsonify({'orders': db_get_all_orders()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/orders/<order_id>/status', methods=['PUT'])
def admin_update_order_status(order_id):
    """Update Order Status (Admin Only) and notify Node Server"""
    try:
        data = request.json
        order = db_get_order(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        new_status = data.get('status')
        if new_status:
            order = db_update_order_status(order_id, new_status)
            print(f'✅ Admin updated order {order_id} to {new_status}')
            # Notify Node Server about status update
            try:
                notification = {
                    'order_id': order_id,
                    'status': new_status,
                    'updated_at': order['updated_at'],
                    'message': f'Order {order_id} status changed to {new_status}'
                }
                node_response = requests.post(
                    f'{NODE_SERVER_URL}/notifications/order-status-update',
                    json=notification,
                    timeout=5
                )
                if node_response.status_code == 200:
                    print('📡 Notified Node Server about status update')
                else:
                    print('⚠️ Node Server notification failed')
            except Exception as e:
                print(f'⚠️ Could not notify Node Server: {e}')
        return jsonify(order), 200
    except Exception as e:
        print(f'❌ Error updating order: {e}')
        return jsonify({'error': str(e)}), 500

# ==================== RESTAURANT MANAGER ROUTES ====================

@app.route('/restaurant/<restaurant_id>/orders', methods=['GET'])
def restaurant_get_orders(restaurant_id):
    """Get Orders for Restaurant"""
    try:
        orders = db_get_all_orders()
        # Filter orders for this restaurant
        restaurant_orders = [o for o in orders if o.get('restaurant_id') == restaurant_id]
        return jsonify({'orders': restaurant_orders}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/restaurant/orders/<order_id>/status', methods=['PUT'])
def restaurant_update_order_status(order_id):
    """Update Order Status (Restaurant Manager)"""
    try:
        data = request.json
        order = db_get_order(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        
        new_status = data.get('status')
        action = data.get('action')  # 'accept', 'reject', or 'update'
        
        # Map actions to statuses
        status_map = {
            'accept': 'PREPARING',
            'reject': 'REJECTED',
            'update': new_status
        }
        
        final_status = status_map.get(action, new_status)
        order = db_update_order_status(order_id, final_status)
        
        print(f'✅ Restaurant updated order {order_id} to {final_status}')
        
        # Notify Node Server about status update
        try:
            notification = {
                'order_id': order_id,
                'status': final_status,
                'message': f'Order status: {final_status}'
            }
            requests.post(
                f'{NODE_SERVER_URL}/notifications/order-status-update',
                json=notification,
                timeout=5
            )
        except Exception as e:
            print(f'⚠️ Could not notify Node Server: {e}')
        
        return jsonify(order), 200
    except Exception as e:
        print(f'❌ Error updating order: {e}')
        return jsonify({'error': str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    print(f"""
╔════════════════════════════════════════╗
║    🚀 Python Backend Server Started    ║
║    Port: {PORT}                        ║
║    Service: Orders & Payments          ║
╚════════════════════════════════════════╝
    """)
    app.run(host='0.0.0.0', port=PORT, debug=True, use_reloader=False)
