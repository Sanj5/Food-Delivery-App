"""
Frontend Application (Flask)
Communicates with Gateway Server on Port 3000
User Interface for Food Delivery System
"""

from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import requests
import json

import os

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'your-secret-key-here')

# Use environment variable for gateway URL, default to localhost for development
GATEWAY_URL = os.environ.get('GATEWAY_URL', 'http://localhost:3000/api')

# ==================== ROUTES ====================

@app.route('/')
def index():
    """Home/Landing Page"""
    if 'user_id' in session:
        return redirect(url_for('select_location'))
    if 'admin_id' in session:
        return redirect(url_for('admin_dashboard'))
    return render_template('home.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    """User Registration"""
    if request.method == 'POST':
        data = {
            'email': request.form.get('email'),
            'password': request.form.get('password'),
            'name': request.form.get('name'),
            'phone': request.form.get('phone'),
            'location': ''  # Location will be selected after registration
        }
        
        try:
            response = requests.post(f'{GATEWAY_URL}/auth/register', json=data, timeout=15)
            
            if response.status_code == 201:
                result = response.json()
                session['user_id'] = result.get('user_id')
                session['email'] = data['email']
                session['name'] = data['name']
                return redirect(url_for('select_location'))
            else:
                error = response.json().get('error', 'Registration failed')
                return render_template('register.html', error=error)
        except Exception as e:
            return render_template('register.html', error=f'Error: {str(e)}')
    
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    """User Login"""
    if request.method == 'POST':
        data = {
            'email': request.form.get('email'),
            'password': request.form.get('password')
        }
        
        try:
            response = requests.post(f'{GATEWAY_URL}/auth/login', json=data, timeout=5)
            
            if response.status_code == 200:
                result = response.json()
                session['user_id'] = result.get('user_id')
                session['email'] = data['email']
                session['name'] = result.get('name', 'User')
                return redirect(url_for('select_location'))
            else:
                error = response.json().get('error', 'Login failed')
                return render_template('login.html', error=error)
        except Exception as e:
            return render_template('login.html', error=f'Error: {str(e)}')
    
    return render_template('login.html')

@app.route('/select-location', methods=['GET', 'POST'])
def select_location():
    """Select Delivery Location"""
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    # Fetch available locations from backend
    locations = []
    try:
        response = requests.get(f'{GATEWAY_URL}/locations', timeout=5)
        locations = response.json().get('locations', []) if response.status_code == 200 else []
    except:
        locations = []
    
    if request.method == 'POST':
        location = request.form.get('location')
        if location:
            session['location'] = location
            return redirect(url_for('restaurants'))
    
    return render_template('select_location.html', user_name=session.get('name'), locations=locations)

@app.route('/restaurants')
def restaurants():
    """List All Restaurants - with Location Filter"""
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    try:
        user_location = session.get('location')
        params = {'location': user_location} if user_location else {}
        response = requests.get(f'{GATEWAY_URL}/restaurants', params=params, timeout=5)
        restaurants_data = response.json().get('restaurants', []) if response.status_code == 200 else []
    except:
        restaurants_data = []
    
    return render_template('restaurants.html', 
                         restaurants=restaurants_data, 
                         user_name=session.get('name'),
                         user_location=session.get('location'))

@app.route('/restaurant/<restaurant_id>')
def restaurant_menu(restaurant_id):
    """View Restaurant Menu"""
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    try:
        response = requests.get(f'{GATEWAY_URL}/restaurants/{restaurant_id}/menu', timeout=5)
        menu_data = response.json().get('menu', []) if response.status_code == 200 else []
        
        rest_response = requests.get(f'{GATEWAY_URL}/restaurants/{restaurant_id}', timeout=5)
        restaurant = rest_response.json() if rest_response.status_code == 200 else {}
    except:
        menu_data = []
        restaurant = {}
    
    return render_template('menu.html', restaurant=restaurant, menu=menu_data, user_name=session.get('name'))

@app.route('/cart')
def cart():
    """View Shopping Cart"""
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    return render_template('cart.html', user_name=session.get('name'))

@app.route('/order', methods=['GET', 'POST'])
def create_order():
    """Create Order"""
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    if request.method == 'POST':
        try:
            items_str = request.form.get('items', '[]')
            total_str = request.form.get('total', '0')
            
            # Parse items and total
            items = json.loads(items_str) if items_str else []
            total = float(total_str) if total_str else 0
            
            if not items or total <= 0:
                return render_template('order.html', error='Cart is empty or invalid')
            
            data = {
                'user_id': session['user_id'],
                'restaurant_id': request.form.get('restaurant_id'),
                'items': items,
                'total': total
            }
            
            print(f"DEBUG: Sending order data: {data}")
            
            response = requests.post(f'{GATEWAY_URL}/orders', json=data, timeout=10)
            print(f"DEBUG: Gateway response: {response.status_code} - {response.text}")
            
            if response.status_code == 201:
                result = response.json()
                return redirect(url_for('order_details', order_id=result.get('order_id')))
            else:
                error = response.json().get('error', 'Order creation failed')
                return render_template('order.html', error=error)
        except json.JSONDecodeError as e:
            print(f"JSON Decode Error: {e}")
            return render_template('order.html', error='Invalid cart data format')
        except requests.exceptions.RequestException as e:
            print(f"Request Error: {e}")
            return render_template('order.html', error=f'Server error: {str(e)}')
        except Exception as e:
            print(f"Unexpected Error: {e}")
            return render_template('order.html', error=f'Error: {str(e)}')
    
    return render_template('order.html')

@app.route('/orders')
def user_orders():
    """View User Orders"""
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    try:
        response = requests.get(f'{GATEWAY_URL}/orders?user_id={session["user_id"]}', timeout=5)
        orders = response.json().get('orders', []) if response.status_code == 200 else []
    except:
        orders = []
    
    return render_template('orders.html', orders=orders, user_name=session.get('name'))

@app.route('/order/<order_id>')
def order_details(order_id):
    """View Order Details"""
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    try:
        response = requests.get(f'{GATEWAY_URL}/orders/{order_id}', timeout=5)
        order = response.json() if response.status_code == 200 else {}
    except:
        order = {}
    
    return render_template('order_details.html', order=order, user_name=session.get('name'))

@app.route('/logout')
def logout():
    """User Logout"""
    session.clear()
    return redirect(url_for('index'))

# ==================== ADMIN ROUTES ====================

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """Admin Login"""
    if request.method == 'POST':
        data = {
            'email': request.form.get('email'),
            'password': request.form.get('password')
        }
        
        try:
            response = requests.post(f'{GATEWAY_URL}/admin/login', json=data, timeout=5)
            
            if response.status_code == 200:
                result = response.json()
                session['admin_id'] = result.get('admin_id')
                session['admin_name'] = result.get('name')
                session['is_admin'] = True
                return redirect(url_for('admin_dashboard'))
            else:
                error = response.json().get('error', 'Login failed')
                return render_template('admin_login.html', error=error)
        except Exception as e:
            return render_template('admin_login.html', error=f'Error: {str(e)}')
    
    return render_template('admin_login.html')

@app.route('/admin/dashboard')
def admin_dashboard():
    """Admin Dashboard - View and Update Orders"""
    if 'admin_id' not in session:
        return redirect(url_for('admin_login'))
    
    try:
        response = requests.get(f'{GATEWAY_URL}/admin/orders', timeout=5)
        orders = response.json().get('orders', []) if response.status_code == 200 else []
    except:
        orders = []
    
    return render_template('admin_dashboard.html', 
                         orders=orders, 
                         admin_name=session.get('admin_name'))

@app.route('/admin/order/<order_id>/status', methods=['POST'])
def admin_update_order_status(order_id):
    """Update Order Status (Admin)"""
    if 'admin_id' not in session:
        return redirect(url_for('admin_login'))
    
    try:
        new_status = request.form.get('status')
        data = {'status': new_status}
        
        response = requests.put(f'{GATEWAY_URL}/admin/orders/{order_id}/status', 
                              json=data, timeout=5)
        
        if response.status_code == 200:
            return redirect(url_for('admin_dashboard'))
        else:
            return redirect(url_for('admin_dashboard'))
    except Exception as e:
        return redirect(url_for('admin_dashboard'))

@app.route('/admin/logout')
def admin_logout():
    """Admin Logout"""
    session.clear()
    return redirect(url_for('index'))

# ==================== RESTAURANT MANAGER ROUTES ====================

@app.route('/restaurant/login', methods=['GET', 'POST'])
def restaurant_login():
    """Restaurant Manager Login"""
    if request.method == 'POST':
        data = {
            'email': request.form.get('email'),
            'password': request.form.get('password')
        }
        
        try:
            response = requests.post(f'{GATEWAY_URL}/restaurant/login', json=data, timeout=5)
            
            if response.status_code == 200:
                result = response.json()
                session['restaurant_id'] = result.get('restaurant_id')
                session['restaurant_name'] = result.get('restaurant_name')
                session['restaurant_email'] = data['email']
                session['is_restaurant'] = True
                return redirect(url_for('restaurant_dashboard'))
            else:
                error = response.json().get('error', 'Login failed')
                return render_template('restaurant_login.html', error=error)
        except Exception as e:
            return render_template('restaurant_login.html', error=f'Error: {str(e)}')
    
    return render_template('restaurant_login.html')

@app.route('/restaurant/register', methods=['GET', 'POST'])
def restaurant_register():
    """Register New Restaurant"""
    if request.method == 'POST':
        data = {
            'name': request.form.get('name'),
            'email': request.form.get('email'),
            'password': request.form.get('password'),
            'cuisine': request.form.get('cuisine'),
            'address': request.form.get('address'),
            'location': request.form.get('location'),
            'phone': request.form.get('phone')
        }
        
        try:
            response = requests.post(f'{GATEWAY_URL}/restaurant/register', json=data, timeout=5)
            
            if response.status_code == 201:
                result = response.json()
                session['restaurant_id'] = result.get('restaurant_id')
                session['restaurant_name'] = data['name']
                session['restaurant_email'] = data['email']
                session['is_restaurant'] = True
                return redirect(url_for('restaurant_dashboard'))
            else:
                error = response.json().get('error', 'Registration failed')
                return render_template('restaurant_register.html', error=error)
        except Exception as e:
            return render_template('restaurant_register.html', error=f'Error: {str(e)}')
    
    return render_template('restaurant_register.html')

@app.route('/restaurant/dashboard')
def restaurant_dashboard():
    """Restaurant Manager Dashboard"""
    if 'restaurant_id' not in session:
        return redirect(url_for('restaurant_login'))
    
    try:
        response = requests.get(f'{GATEWAY_URL}/restaurant/{session["restaurant_id"]}/orders', timeout=5)
        orders = response.json().get('orders', []) if response.status_code == 200 else []
    except:
        orders = []
    
    return render_template('restaurant_dashboard.html', 
                         restaurant_name=session.get('restaurant_name'),
                         orders=orders)

@app.route('/restaurant/menu', methods=['GET', 'POST'])
def restaurant_menu_manage():
    """Manage Restaurant Menu"""
    if 'restaurant_id' not in session:
        return redirect(url_for('restaurant_login'))
    
    if request.method == 'POST':
        action = request.form.get('action')
        
        try:
            if action == 'add':
                # Generate proper image URL for deployment
                image_url = url_for('static', filename='images/food.jpg', _external=True)
                data = {
                    'restaurant_id': session['restaurant_id'],
                    'item_name': request.form.get('item_name'),
                    'price': float(request.form.get('price', 0)),
                    'description': request.form.get('description'),
                    'image_url': image_url
                }
                response = requests.post(f'{GATEWAY_URL}/restaurant/menu/add', json=data, timeout=5)
                
                if response.status_code == 201:
                    return redirect(url_for('restaurant_menu_manage'))
                else:
                    error = response.json().get('error', 'Failed to add item')
                    
            elif action == 'delete':
                item_id = request.form.get('item_id')
                response = requests.delete(f'{GATEWAY_URL}/restaurant/menu/{item_id}', timeout=5)
                
                if response.status_code == 200:
                    return redirect(url_for('restaurant_menu_manage'))
                else:
                    error = response.json().get('error', 'Failed to delete item')
        except Exception as e:
            error = f'Error: {str(e)}'
    
    # Get current menu
    try:
        response = requests.get(f'{GATEWAY_URL}/restaurant/{session["restaurant_id"]}/menu', timeout=5)
        menu = response.json().get('menu', []) if response.status_code == 200 else []
    except:
        menu = []
    
    return render_template('restaurant_menu.html', 
                         restaurant_name=session.get('restaurant_name'),
                         menu=menu,
                         error=error if 'error' in locals() else None)

@app.route('/restaurant/order/<order_id>/status', methods=['POST'])
def restaurant_update_order_status(order_id):
    """Update Order Status (Restaurant)"""
    if 'restaurant_id' not in session:
        return redirect(url_for('restaurant_login'))
    
    try:
        new_status = request.form.get('status')
        action = request.form.get('action')  # 'accept' or 'reject'
        
        data = {'status': new_status, 'action': action}
        
        response = requests.put(f'{GATEWAY_URL}/restaurant/orders/{order_id}/status', 
                              json=data, timeout=5)
        
        if response.status_code == 200:
            return redirect(url_for('restaurant_dashboard'))
        else:
            return redirect(url_for('restaurant_dashboard'))
    except Exception as e:
        return redirect(url_for('restaurant_dashboard'))

@app.route('/restaurant/logout')
def restaurant_logout():
    """Restaurant Manager Logout"""
    session.clear()
    return redirect(url_for('index'))

@app.route('/health')
def health():
    """Health Check"""
    return jsonify({'status': 'Frontend Healthy'})

if __name__ == '__main__':
    print("""
╔════════════════════════════════════════╗
║    🚀 Food Delivery Frontend           ║
║    Port: 5000                          ║
║    Gateway: http://localhost:3000      ║
╚════════════════════════════════════════╝
    """)
    app.run(host='0.0.0.0', port=5000, debug=True)
