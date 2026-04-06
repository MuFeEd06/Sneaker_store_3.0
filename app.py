"""
CALVAC — Flask Backend (Vercel + Supabase Edition)
Key fix: DB init is lazy (before_request) not at import time — required for Vercel serverless
"""

from flask import (Flask, jsonify, render_template, request,
                   abort, session, redirect, url_for)
from flask_cors import CORS
from models import db, Product, Setting, Order, OrderItem
import json, os, copy, re
from collections import defaultdict
import time as _time
import urllib.request, urllib.error
from datetime import datetime, timedelta
from functools import wraps
from werkzeug.utils import secure_filename

app = Flask(__name__,
            static_folder=os.path.join(os.path.dirname(__file__), "static"),
            template_folder=os.path.join(os.path.dirname(__file__), "templates"))
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "https://calvac.in",
            "https://www.calvac.in",
            "https://claxxic-india.vercel.app",
        ],
        "methods": ["GET","POST","PUT","DELETE"],
        "allow_headers": ["Content-Type"],
        "supports_credentials": True,
    }
})

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

USE_DB = bool(DATABASE_URL)

# ── SQLAlchemy config — no connection at import time (Vercel requirement) ──────
if USE_DB:
    app.config["SQLALCHEMY_DATABASE_URI"]   = DATABASE_URL
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle":  300,
        "pool_size":     1,
        "max_overflow":  0,
        "connect_args":  {"connect_timeout": 10},
    }
else:
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
_secret = os.environ.get("SECRET_KEY", "")
if not _secret or _secret == "claxxic-secret-2026":
    import secrets as _sec
    _secret = _sec.token_hex(32)  # random per cold start — sessions won't survive restarts
    print("[calvac] ⚠️  SECRET_KEY not set — using random key. Set SECRET_KEY env var in Vercel!")
app.config["SECRET_KEY"] = _secret
app.config["SESSION_COOKIE_SECURE"]          = True
app.config["SESSION_COOKIE_HTTPONLY"]        = True
app.config["SESSION_COOKIE_SAMESITE"]        = "Lax"
app.config["PERMANENT_SESSION_LIFETIME"]     = timedelta(hours=12)
app.config["MAX_CONTENT_LENGTH"]             = 5 * 1024 * 1024

db.init_app(app)

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "claxxic@admin")
ALLOWED_EXT    = {"png", "jpg", "jpeg", "webp"}

# ── LOGIN RATE LIMITING (in-memory, resets on cold start) ─────────────────────
_login_attempts  = defaultdict(list)   # ip → [timestamps]
_MAX_ATTEMPTS    = 2
_WINDOW_SECONDS  = 300   # 5 minute window
_LOCKOUT_SECONDS = 900   # 15 minute lockout after max attempts

def _check_rate_limit(ip: str) -> tuple[bool, int]:
    """Returns (is_locked_out, seconds_remaining). Cleans old entries."""
    now = _time.time()
    attempts = _login_attempts[ip]
    # Remove attempts older than lockout window
    _login_attempts[ip] = [t for t in attempts if now - t < _LOCKOUT_SECONDS]
    recent = [t for t in _login_attempts[ip] if now - t < _WINDOW_SECONDS]
    if len(recent) >= _MAX_ATTEMPTS:
        wait = int(_LOCKOUT_SECONDS - (now - recent[0]))
        return True, max(0, wait)
    return False, 0

def _record_attempt(ip: str):
    _login_attempts[ip].append(_time.time())

# ── SUPABASE STORAGE CONFIG ───────────────────────────────────────────────────
# Extract project ref and service key from env vars
SUPABASE_URL     = os.environ.get("SUPABASE_URL", "")          # e.g. https://xxxx.supabase.co
SUPABASE_KEY     = os.environ.get("SUPABASE_ANON_KEY", "")    # anon/public key from Supabase API settings
STORAGE_BUCKET   = "product-images"                             # bucket name in Supabase Storage

def _supabase_upload(file_bytes, content_type, storage_path):
    """Upload bytes to Supabase Storage using urllib (no requests dep), return public URL."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY env vars not set")

    url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{storage_path}"
    req = urllib.request.Request(
        url,
        data    = file_bytes,
        method  = "POST",
        headers = {
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type":  content_type,
            "x-upsert":      "true",
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            if resp.status not in (200, 201):
                raise RuntimeError(f"Supabase upload failed: {resp.status}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase upload failed: {e.code} {body}")

    return f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{storage_path}"

# ── LAZY DB INIT — runs on first request, not at module load ──────────────────
_db_ready = False

@app.after_request
def add_security_headers(response):
    """Add security headers to every response."""
    response.headers["X-Content-Type-Options"]    = "nosniff"
    response.headers["X-Frame-Options"]           = "SAMEORIGIN"
    response.headers["Referrer-Policy"]           = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"]        = "geolocation=(), microphone=(), camera=()"
    # Only add HSTS on HTTPS (Vercel handles this but belt+suspenders)
    if request.is_secure:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

@app.before_request
def ensure_db():
    global _db_ready, USE_DB
    if _db_ready:
        return
    _db_ready = True
    try:
        db.create_all()
        print("[calvac] ✅ DB tables ready")
    except Exception as e:
        print(f"[calvac] ❌ DB init failed: {e}")
        USE_DB = False


# ── HELPERS ───────────────────────────────────────────────────────────────────

def get_offer():
    _blank = {"active": False, "text": "", "bg_color": "#FF6B35",
              "text_color": "#ffffff", "show_logo": True}
    if not USE_DB:
        return _blank
    try:
        row = Setting.query.get("offer")
        if row:
            saved = json.loads(row.value)
            saved.setdefault("show_logo", True)
            return saved
    except: pass
    return _blank

def set_offer(data):
    row = Setting.query.get("offer")
    if row: row.value = json.dumps(data)
    else: db.session.add(Setting(key="offer", value=json.dumps(data)))
    db.session.commit()


# ── COLOUR DERIVATION HELPERS ──────────────────────────────────────────────────

def _hex_to_rgb(hex_color):
    h = (hex_color or "#2B9FD8").lstrip("#")
    if len(h) == 3: h = h[0]*2 + h[1]*2 + h[2]*2
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def _darken(hex_color, factor=0.72):
    r, g, b = _hex_to_rgb(hex_color)
    return "#{:02x}{:02x}{:02x}".format(int(r*factor), int(g*factor), int(b*factor))

def _lighten(hex_color, alpha=0.12):
    r, g, b = _hex_to_rgb(hex_color)
    nr = int(r + (255 - r) * (1 - alpha))
    ng = int(g + (255 - g) * (1 - alpha))
    nb = int(b + (255 - b) * (1 - alpha))
    return "#{:02x}{:02x}{:02x}".format(nr, ng, nb)

def _rgba(hex_color, alpha):
    r, g, b = _hex_to_rgb(hex_color)
    return f"rgba({r},{g},{b},{alpha})"

def build_theme_vars(primary):
    """Return dict of all CSS variables derived from primary colour."""
    return {
        "primary":       primary,
        "primary_dark":  _darken(primary, 0.72),
        "primary_light": _lighten(primary, 0.12),
        "rgba_008":      _rgba(primary, 0.08),
        "rgba_010":      _rgba(primary, 0.10),
        "rgba_018":      _rgba(primary, 0.18),
        "rgba_022":      _rgba(primary, 0.22),
        "rgba_025":      _rgba(primary, 0.25),
        "rgba_020":      _rgba(primary, 0.20),
        "rgba_004":      _rgba(primary, 0.04),
    }

DEFAULT_SITE_SETTINGS = {
    "primary_color":    "#2B9FD8",
    "hero_font":        "default",
    "model_path":       "sneaker.glb",
    "model_scale":      3.0,
    "model_y":          0.8,
    "model_speed":      0.006,
    # Hero text
    "hero_eyebrow":       "New Collection 2026",
    "hero_headline":      "Step Into",
    "hero_highlight":     "Premium",
    "hero_headline2":     "Comfort",
    "hero_sub":           "",
    "hero_cta":           "Shop Now",
    "hero_cta_color":     "#2B9FD8",
    "hero_eyebrow_color": "#2B9FD8",
    "hero_text_color":    "#ffffff",
    "hero_sub_color":     "rgba(255,255,255,0.72)",
    # Stat pills (3 pills)
    "stat1_num":   "56+",  "stat1_label": "Styles",
    "stat2_num":   "17",   "stat2_label": "Brands",
    "stat3_num":   "Free", "stat3_label": "Shipping",
    # Feature tags (4 right-side tags)
    "tag1_icon":  "☁️", "tag1_title": "Ultra Comfort",  "tag1_sub": "Cloud-foam cushioning",
    "tag2_icon":  "⚡", "tag2_title": "Lightweight",     "tag2_sub": "Barely-there feel",
    "tag3_icon":  "🎨", "tag3_title": "Smart Design",    "tag3_sub": "Modern sportswear style",
    "tag4_icon":  "🔒", "tag4_title": "Maximum Grip",    "tag4_sub": "Advanced traction sole",
    # Brand section visibility
    "hidden_brands": "",
    "show_brands_section": True,
    # New Arrivals section
    "show_new_arrivals": True,
    # Category quick links section
    "show_categories": True,
    "cat_boots":       True,
    "cat_crocs":       True,
    "cat_girls":       True,
    "cat_sale":        True,
    "cat_under1000":   True,
    "cat_under1500":   True,
    "cat_under2500":   True,
    "cat_new":         True,
    "size_unit": "uk",   # "uk" or "euro" — no both option
    # Policy pages content (markdown/HTML stored as plain text)
    "policy_privacy":  "# Privacy Policy\n\nYour privacy is important to us. We do not share your personal data with third parties.",
    "policy_return":   "# Return Policy\n\nWe accept returns within 7 days of delivery. Items must be unused and in original packaging.",
    "policy_shipping": "# Shipping Policy\n\nWe ship across India. Standard delivery takes 3–7 business days. Free shipping on all orders.",
}

def _build_theme(hex_color):
    """Convert a hex colour into rgba variants for CSS injection."""
    try:
        h = hex_color.lstrip("#")
        r, g, b = int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
    except Exception:
        r, g, b = 43, 159, 216  # fallback to default blue
    def rgba(a): return f"rgba({r},{g},{b},{a})"
    # Derive darker/lighter shades
    rd = max(0, r-40); gd = max(0, g-40); bd = max(0, b-40)
    rl = min(255,r+180); gl = min(255,g+180); bl = min(255,b+180)
    return {
        "primary":       hex_color,
        "primary_dark":  f"#{rd:02x}{gd:02x}{bd:02x}",
        "primary_light": f"#{rl:02x}{gl:02x}{bl:02x}",
        "rgba_004":      rgba(0.04),
        "rgba_008":      rgba(0.08),
        "rgba_010":      rgba(0.10),
        "rgba_018":      rgba(0.18),
        "rgba_020":      rgba(0.20),
        "rgba_022":      rgba(0.22),
        "rgba_025":      rgba(0.25),
    }

def get_site_settings():
    defaults = DEFAULT_SITE_SETTINGS.copy()
    if not USE_DB:
        defaults["offer"] = get_offer()
        defaults["theme"] = _build_theme(defaults["primary_color"])
        return defaults
    try:
        row = Setting.query.get("site_settings")
        if row and row.value:
            saved = json.loads(row.value)
            for k, v in saved.items():
                if v is not None:
                    defaults[k] = v
            # Normalise legacy "both" → "uk" (we removed the both option)
            if defaults.get("size_unit") == "both":
                defaults["size_unit"] = "uk"
    except Exception as e:
        print(f"[calvac] get_site_settings parse error: {e}")
    defaults["offer"] = get_offer()
    defaults["theme"] = _build_theme(defaults.get("primary_color","#2B9FD8"))
    return defaults

def save_site_settings(data):
    row = Setting.query.get("site_settings")
    # Load existing saved values first
    existing = {}
    if row and row.value:
        try:
            existing = json.loads(row.value)
        except Exception:
            existing = {}
    # Merge: new data overrides existing, skip "offer" key
    merged = {**existing, **{k: v for k, v in data.items() if k != "offer"}}
    # Normalise: no "both" size_unit — treat as "uk"
    if merged.get("size_unit") == "both":
        merged["size_unit"] = "uk"
    if row:
        row.value = json.dumps(merged)
    else:
        db.session.add(Setting(key="site_settings", value=json.dumps(merged)))
    db.session.commit()

@app.context_processor
def inject_site_settings():
    """Makes site_settings + theme CSS vars available in every template"""
    try:
        s = get_site_settings()
        s["theme"] = build_theme_vars(s.get("primary_color", "#2B9FD8"))
        return {"site_settings": s}
    except:
        s = DEFAULT_SITE_SETTINGS.copy()
        s["offer"] = {"active": False, "text": "", "bg_color": "#FF6B35", "text_color": "#ffffff"}
        s["theme"] = build_theme_vars("#2B9FD8")
        return {"site_settings": s}

def fix_image_paths(products_list):
    result = copy.deepcopy(products_list)
    for p in result:
        if p.get("image") and not p["image"].startswith(("/static/", "http")):
            p["image"] = "/static/" + p["image"]
        for c in p.get("colors", []):
            if c.get("image") and not c["image"].startswith(("/static/", "http")):
                c["image"] = "/static/" + c["image"]
    return result

ALLOWED_MIMES = {"image/jpeg","image/png","image/webp","image/gif"}

def allowed_file(f): return "." in f and f.rsplit(".",1)[1].lower() in ALLOWED_EXT

def allowed_mime(file_storage):
    """Check actual MIME type of uploaded file, not just extension."""
    # Read first 12 bytes to check magic numbers
    header = file_storage.read(12)
    file_storage.seek(0)
    # JPEG: FF D8 FF | PNG: 89 50 4E 47 | WEBP: 52 49 46 46...57 45 42 50
    if header[:3] == b"\xff\xd8\xff": return True
    if header[:4] == b"\x89PNG":       return True
    if header[:4] == b"RIFF" and header[8:12] == b"WEBP": return True
    return False
def slugify(t): return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")
def format_inr(n): return f"₹{int(n):,}"

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("admin_logged_in"):
            return redirect(url_for("admin_login"))
        return f(*args, **kwargs)
    return decorated


# ── PAGE ROUTES ───────────────────────────────────────────────────────────────

@app.route("/")
def index(): return render_template("index.html")
@app.route("/product")
def product(): return render_template("product.html")
@app.route("/brand")
def brand(): return render_template("brand.html")
@app.route("/cart")
def cart(): return render_template("cart.html")


# ── OLD ADMIN URL — return 404 so path is not guessable ──────────────────────
@app.route("/admin", methods=["GET","POST"])
@app.route("/admin/dashboard")
@app.route("/admin/products")
@app.route("/admin/site-settings")
@app.route("/admin/logout")
def old_admin_redirect():
    abort(404)

# ── ADMIN AUTH ────────────────────────────────────────────────────────────────

@app.route("/manage-store-x9k2", methods=["GET", "POST"])
def admin_login():
    error = None
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "unknown").split(",")[0].strip()

    if request.method == "POST":
        locked, wait = _check_rate_limit(client_ip)
        if locked:
            error = f"Too many attempts. Try again in {wait // 60 + 1} minutes."
            return render_template("admin_login.html", error=error)

        if request.form.get("password") == ADMIN_PASSWORD:
            # Clear attempts on success
            _login_attempts.pop(client_ip, None)
            session.permanent = True
            session["admin_logged_in"] = True
            return redirect(url_for("admin_dashboard"))
        else:
            _record_attempt(client_ip)
            locked, wait = _check_rate_limit(client_ip)
            if locked:
                error = f"Too many failed attempts. Locked out for {wait // 60 + 1} minutes."
            else:
                remaining = _MAX_ATTEMPTS - len([t for t in _login_attempts[client_ip]
                                                  if _time.time() - t < _WINDOW_SECONDS])
                error = f"Incorrect password. {remaining} attempt(s) remaining."

    return render_template("admin_login.html", error=error)

@app.route("/manage-store-x9k2/logout")
def admin_logout():
    session.clear()
    return redirect(url_for("admin_login"))


# ── ADMIN DASHBOARD ───────────────────────────────────────────────────────────

@app.route("/manage-store-x9k2/dashboard")
@admin_required
def admin_dashboard():
    if USE_DB:
        sf = request.args.get("status", "all")
        q  = Order.query.order_by(Order.created_at.desc())
        if sf != "all": q = q.filter_by(status=sf)
        orders     = q.all()
        all_orders   = Order.query.all()
        # Revenue: exclude Cancelled orders — they should not count
        active_orders = [o for o in all_orders if o.status != "Cancelled"]
        total_rev     = sum(o.total for o in active_orders)
        return render_template("admin.html",
            orders=orders, status_filter=sf,
            total_orders=len(all_orders), total_rev=format_inr(total_rev),
            pending=Order.query.filter_by(status="Pending").count(),
            confirmed=Order.query.filter_by(status="Confirmed").count(),
            shipped=Order.query.filter_by(status="Shipped").count(),
            delivered=Order.query.filter_by(status="Delivered").count(),
            cancelled=Order.query.filter_by(status="Cancelled").count(),
            active_count=len(active_orders),
            offer=get_offer())
    return render_template("admin.html",
        orders=[], status_filter="all", total_orders=0, total_rev="₹0",
        pending=0, confirmed=0, shipped=0, delivered=0, offer=get_offer())


# ── ADMIN PRODUCTS ────────────────────────────────────────────────────────────


@app.route("/manage-store-x9k2/site-settings")
@admin_required
def admin_site_settings_page():
    return render_template("admin_site_settings.html",
        site_settings=get_site_settings(),
        offer=get_offer())


@app.route("/contact")
def page_contact():
    return render_template("contact.html")

@app.route("/privacy")
def page_privacy():
    s = get_site_settings()
    return render_template("policy.html",
        title="Privacy Policy",
        content=s.get("policy_privacy",""),
        active="privacy")

@app.route("/return")
def page_return():
    s = get_site_settings()
    return render_template("policy.html",
        title="Return Policy",
        content=s.get("policy_return",""),
        active="return")

@app.route("/shipping")
def page_shipping():
    s = get_site_settings()
    return render_template("policy.html",
        title="Shipping Policy",
        content=s.get("policy_shipping",""),
        active="shipping")

@app.route("/manage-store-x9k2/products")
@admin_required
def admin_products():
    products = [p.to_dict() for p in Product.query.order_by(Product.brand, Product.name).all()] if USE_DB else []
    brands   = sorted(set(p["brand"] for p in products))
    return render_template("admin_products.html", products=products, brands=brands, offer=get_offer())


# ── PUBLIC API ────────────────────────────────────────────────────────────────

@app.route("/api/products")
def get_products():
    if not USE_DB: return jsonify([])
    query     = Product.query
    brand     = request.args.get("brand")
    tag       = request.args.get("tag")
    min_price = request.args.get("min_price", type=int)
    max_price = request.args.get("max_price", type=int)
    search    = request.args.get("q", "").lower().strip()
    sale      = request.args.get("sale")
    category  = request.args.get("category")
    # boots/crocs/girls can be passed as ?tag= (legacy) or ?category=
    CATEGORY_TAGS = {"boots", "crocs", "girls"}
    if brand:     query = query.filter(db.func.lower(Product.brand) == brand.lower())
    if tag:
        if tag in CATEGORY_TAGS:
            # Filter by category column for these
            query = query.filter(Product.category == tag)
        else:
            query = query.filter(Product.tag == tag)
    if category:  query = query.filter(Product.category == category)
    if min_price: query = query.filter(Product.price >= min_price)
    if max_price: query = query.filter(Product.price <= max_price)
    if sale:      query = query.filter(Product.original_price > Product.price, Product.original_price > 0)
    if search:    query = query.filter(db.or_(
        Product.name.ilike(f"%{search}%"), Product.brand.ilike(f"%{search}%")))
    return jsonify(fix_image_paths([p.to_dict() for p in query.distinct(Product.id).all()]))

@app.route("/api/products/trending")
def get_trending():
    if not USE_DB: return jsonify([])
    return jsonify(fix_image_paths([p.to_dict() for p in Product.query.filter_by(tag="trending").all()]))

@app.route("/api/products/<int:product_id>")
def get_product(product_id):
    if not USE_DB: abort(404)
    p = Product.query.get(product_id)
    if not p: abort(404)
    return jsonify(fix_image_paths([p.to_dict()])[0])

@app.route("/api/brands")
def get_brands():
    if not USE_DB: return jsonify([])
    from sqlalchemy import func
    rows = db.session.query(Product.brand, func.count(Product.id)).group_by(Product.brand).all()
    return jsonify([{"name": b, "count": c} for b, c in rows])

@app.route("/api/search")
def search_products():
    q = request.args.get("q", "").lower().strip()
    if not q or not USE_DB: return jsonify([])
    products = Product.query.filter(db.or_(
        Product.name.ilike(f"%{q}%"), Product.brand.ilike(f"%{q}%"))).all()
    return jsonify(fix_image_paths([p.to_dict() for p in products]))

@app.route("/api/offer")
def api_get_offer(): return jsonify(get_offer())

@app.route("/api/site-settings")
def api_public_site_settings():
    s = get_site_settings()
    return jsonify({
        "primary_color": s.get("primary_color","#2B9FD8"),
        "hero_font":     s.get("hero_font","default"),
        "model_path":    s.get("model_path","sneaker.glb"),
        "model_scale":   s.get("model_scale",3.0),
        "model_y":       s.get("model_y",0.8),
        "model_speed":   s.get("model_speed",0.006),
        "size_unit":         s.get("size_unit","uk"),
        "show_new_arrivals": s.get("show_new_arrivals", True),
        "show_categories":  s.get("show_categories", True),
        "cat_boots":        s.get("cat_boots",     True),
        "cat_crocs":        s.get("cat_crocs",     True),
        "cat_girls":        s.get("cat_girls",     True),
        "cat_sale":         s.get("cat_sale",      True),
        "cat_under1000":    s.get("cat_under1000", True),
        "cat_under1500":    s.get("cat_under1500", True),
        "cat_under2500":    s.get("cat_under2500", True),
        "cat_new":          s.get("cat_new",       True),
    })


# ── ADMIN API ─────────────────────────────────────────────────────────────────

@app.route("/api/x9k2/products", methods=["POST"])
@admin_required
def api_add_product():
    if not USE_DB: return jsonify({"error": "No database"}), 503
    data  = request.get_json(force=True)
    name  = data.get("name","").strip()
    brand = data.get("brand","").strip()
    price = int(data.get("price", 0))
    if not name or not brand or not price:
        return jsonify({"error": "name, brand and price are required"}), 400

    # Dedup guard — prevent double-submit from creating duplicate rows
    existing = Product.query.filter(
        db.func.lower(Product.name)  == name.lower(),
        db.func.lower(Product.brand) == brand.lower(),
        Product.price == price
    ).first()
    if existing:
        # Return the existing product instead of creating a duplicate
        return jsonify({"success": True, "product": existing.to_dict(),
                        "note": "Product already exists — returning existing"}), 200

    p = Product(name=name, brand=brand, price=price,
                image=data.get("image",""), tag=data.get("tag",""),
                sizes=json.dumps(data.get("sizes",[])),
                colors=json.dumps(data.get("colors",[])))
    # stock column — only set if it exists in the model
    try:
        if hasattr(p, 'stock'):
            p.stock = json.dumps(data.get("stock",{}))
    except Exception:
        pass
    # specs field
    try:
        if hasattr(p, 'specs'):
            p.specs = data.get("specs", "")
    except Exception:
        pass
    # original_price (MRP / strikethrough price)
    try:
        if hasattr(p, 'original_price'):
            op = int(data.get("original_price") or 0)
            p.original_price = op if op > 0 else 0
    except Exception:
        pass
    # category field (boots / crocs / girls)
    try:
        if hasattr(p, 'category'):
            p.category = data.get("category", "")
    except Exception:
        pass
    db.session.add(p)
    db.session.commit()
    return jsonify({"success": True, "product": p.to_dict()}), 201

@app.route("/api/x9k2/products/<int:product_id>", methods=["PUT"])
@admin_required
def api_update_product(product_id):
    if not USE_DB: return jsonify({"error": "No database"}), 503
    p = Product.query.get(product_id)
    if not p: return jsonify({"error": "Not found"}), 404
    data = request.get_json(force=True)
    p.name   = data.get("name",   p.name)
    p.brand  = data.get("brand",  p.brand)
    p.price  = int(data.get("price", p.price))
    p.image  = data.get("image",  p.image)
    p.tag    = data.get("tag",    p.tag or "")
    p.sizes  = json.dumps(data.get("sizes",  json.loads(p.sizes  or "[]")))
    p.colors = json.dumps(data.get("colors", json.loads(p.colors or "[]")))
    if "stock" in data:
        try:
            if hasattr(p, 'set_stock'):
                p.set_stock(data["stock"])
            elif hasattr(p, 'stock'):
                p.stock = json.dumps(data["stock"])
        except Exception as e:
            print(f"[calvac] stock update skipped: {e}")
    if "specs" in data:
        try:
            if hasattr(p, 'specs'):
                p.specs = data.get("specs", "")
        except Exception as e:
            print(f"[calvac] specs update skipped: {e}")
    if "original_price" in data:
        try:
            if hasattr(p, 'original_price'):
                op = int(data.get("original_price") or 0)
                p.original_price = op if op > 0 else 0
        except Exception as e:
            print(f"[calvac] original_price update skipped: {e}")
    if "category" in data:
        try:
            if hasattr(p, 'category'):
                p.category = data.get("category", "")
        except Exception as e:
            print(f"[calvac] category update skipped: {e}")
    db.session.commit()
    return jsonify({"success": True, "product": p.to_dict()})

@app.route("/api/x9k2/products/<int:product_id>", methods=["DELETE"])
@admin_required
def api_delete_product(product_id):
    if not USE_DB: return jsonify({"error": "No database"}), 503
    p = Product.query.get(product_id)
    if not p: return jsonify({"error": "Not found"}), 404
    db.session.delete(p)
    db.session.commit()
    return jsonify({"success": True})

@app.route("/api/x9k2/upload-image", methods=["POST"])
@admin_required
def api_upload_image():
    if "image" not in request.files: return jsonify({"error": "No file"}), 400
    file  = request.files["image"]
    brand = request.form.get("brand", "misc")
    if not file or not file.filename:
        return jsonify({"error": "No file provided"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type. Use JPG, PNG or WEBP"}), 400

    brand_slug    = slugify(brand)
    filename      = secure_filename(file.filename)
    # Add timestamp prefix to avoid filename collisions
    import time as _t
    ts = int(_t.time())
    name_parts = filename.rsplit(".", 1)
    filename   = f"{name_parts[0]}_{ts}.{name_parts[1]}" if len(name_parts) == 2 else f"{filename}_{ts}"
    storage_path  = f"shoes/{brand_slug}/{filename}"
    file_bytes    = file.read()
    content_type  = file.content_type or "image/jpeg"

    try:
        public_url = _supabase_upload(file_bytes, content_type, storage_path)
        return jsonify({"success": True, "path": public_url, "url": public_url})
    except Exception as e:
        print(f"[calvac] Upload error: {e}")
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500

@app.route("/api/x9k2/offer", methods=["POST"])
@admin_required
def api_save_offer():
    if not USE_DB: return jsonify({"error": "No database"}), 503
    data  = request.get_json(force=True)
    offer = {"active":    bool(data.get("active", False)),
             "text":      data.get("text","").strip(),
             "bg_color":  data.get("bg_color","#FF6B35"),
             "text_color":data.get("text_color","#ffffff"),
             "show_logo": bool(data.get("show_logo", True))}
    set_offer(offer)
    return jsonify({"success": True, "offer": offer})

@app.route("/api/x9k2/site-settings", methods=["GET"])
@admin_required
def api_get_site_settings():
    return jsonify(get_site_settings())

@app.route("/api/x9k2/site-settings", methods=["POST"])
@admin_required
def api_save_site_settings():
    if not USE_DB: return jsonify({"error": "No database"}), 503
    data = request.get_json(force=True)
    allowed_keys = {
        "primary_color","hero_font","model_path","model_scale","model_y","model_speed",
        "hero_eyebrow","hero_headline","hero_highlight","hero_headline2","hero_sub","hero_cta",
        "hero_cta_color","hero_eyebrow_color","hero_text_color","hero_sub_color",
        "stat1_num","stat1_label","stat2_num","stat2_label","stat3_num","stat3_label",
        "tag1_icon","tag1_title","tag1_sub","tag2_icon","tag2_title","tag2_sub",
        "tag3_icon","tag3_title","tag3_sub","tag4_icon","tag4_title","tag4_sub",
        "hidden_brands","show_brands_section",
        "show_new_arrivals",
        "show_categories",
        "cat_boots","cat_crocs","cat_girls","cat_sale",
        "cat_under1000","cat_under1500","cat_under2500","cat_new",
        "size_unit",
        "policy_privacy","policy_return","policy_shipping",
    }
    clean = {k: v for k, v in data.items() if k in allowed_keys}
    save_site_settings(clean)
    return jsonify({"success": True, "settings": clean})

@app.route("/api/x9k2/upload-model", methods=["POST"])
@admin_required
def api_upload_model():
    if "model" not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files["model"]
    if not file or not file.filename.lower().endswith(".glb"):
        return jsonify({"error": "Only .glb files allowed"}), 400

    filename     = secure_filename(file.filename)
    storage_path = f"models/{filename}"
    file_bytes   = file.read()

    try:
        public_url = _supabase_upload(file_bytes, "model/gltf-binary", storage_path)
        return jsonify({"success": True, "path": public_url, "url": public_url})
    except Exception as e:
        print(f"[calvac] Model upload error: {e}")
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500


# ── ORDERS ────────────────────────────────────────────────────────────────────

@app.route("/api/orders", methods=["POST"])
def create_order():
    if not USE_DB: return jsonify({"success": True, "order_id": 0})
    data  = request.get_json(force=True)
    addr  = data.get("address",{})
    items = data.get("items",[])
    total = data.get("total",0)
    if not addr or not items: return jsonify({"error": "Missing address or items"}), 400
    try:
        order = Order(name=addr.get("name",""), phone=addr.get("phone",""),
                      line1=addr.get("line1",""), line2=addr.get("line2",""),
                      city=addr.get("city",""), state=addr.get("state",""),
                      pin=addr.get("pin",""), landmark=addr.get("landmark",""),
                      total=total, status="Pending")
        db.session.add(order)
        db.session.flush()
        for item in items:
            db.session.add(OrderItem(
                order_id=order.id, product_id=item.get("id",0),
                name=item.get("name",""), brand=item.get("brand",""),
                size=item.get("size",""), color=item.get("color",""),
                qty=item.get("qty",1), price=item.get("price",0),
                image=item.get("image","")))
        db.session.commit()
        return jsonify({"success": True, "order_id": order.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

def _adjust_stock(order, delta):
    """delta=-1 to decrement (Delivered), delta=+1 to restore (Cancelled)."""
    try:
        for item in order.items:
            product = Product.query.get(item.product_id)
            if not product or not hasattr(product, 'get_stock'): continue
            stock = product.get_stock()
            if not stock: continue
            color_key = item.color or "default"
            size_key  = item.size  or "default"
            key = f"{color_key}|{size_key}"
            if key in stock:
                stock[key] = max(0, stock[key] + (delta * item.qty))
                product.set_stock(stock)
        db.session.commit()
    except Exception as e:
        print(f"[calvac] Stock adjust error: {e}")

@app.route("/api/orders/<int:order_id>/status", methods=["PATCH"])
@admin_required
def update_order_status(order_id):
    if not USE_DB: return jsonify({"error": "No DB"}), 503
    order      = Order.query.get_or_404(order_id)
    new_status = request.get_json(force=True).get("status")
    valid      = ["Pending","Confirmed","Shipped","Delivered","Cancelled"]
    if new_status not in valid:
        return jsonify({"error": "Invalid status"}), 400

    old_status = order.status

    # Stock management
    if new_status == "Delivered" and old_status != "Delivered":
        _adjust_stock(order, -1)   # decrement stock on delivery
    elif old_status == "Delivered" and new_status == "Cancelled":
        _adjust_stock(order, +1)   # restore stock if delivered→cancelled
    elif new_status == "Cancelled" and old_status not in ("Delivered","Cancelled"):
        pass  # no stock change needed (stock only deducted at Delivered)

    order.status     = new_status
    order.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"success": True, "status": new_status})

@app.route("/api/orders/<int:order_id>/notes", methods=["PATCH"])
@admin_required
def update_order_notes(order_id):
    if not USE_DB: return jsonify({"error": "No DB"}), 503
    order = Order.query.get_or_404(order_id)
    order.notes = request.get_json(force=True).get("notes","")
    order.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"success": True})


# ── ERRORS ────────────────────────────────────────────────────────────────────


@app.route("/api/x9k2/products/<int:product_id>/stock", methods=["GET"])
@admin_required
def api_get_stock(product_id):
    if not USE_DB: return jsonify({}), 503
    p = Product.query.get_or_404(product_id)
    return jsonify(p.get_stock())

@app.route("/api/x9k2/products/<int:product_id>/stock", methods=["POST"])
@admin_required
def api_set_stock(product_id):
    if not USE_DB: return jsonify({"error": "No DB"}), 503
    p    = Product.query.get_or_404(product_id)
    data = request.get_json(force=True)
    p.set_stock(data)
    db.session.commit()
    return jsonify({"success": True, "stock": p.get_stock()})

@app.errorhandler(404)
def not_found(e): return jsonify({"error": str(e)}), 404
@app.errorhandler(500)
def server_error(e): return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
