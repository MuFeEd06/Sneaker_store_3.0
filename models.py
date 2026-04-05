"""
Claxxic India — Database Models
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()


class Product(db.Model):
    __tablename__ = "products"

    id      = db.Column(db.Integer, primary_key=True)
    name    = db.Column(db.String(200), nullable=False)
    brand   = db.Column(db.String(100), nullable=False)
    price   = db.Column(db.Integer,     nullable=False)
    image   = db.Column(db.String(300), nullable=True)
    tag     = db.Column(db.String(50),  nullable=True, default="")
    sizes   = db.Column(db.Text, nullable=True, default="[]")
    colors  = db.Column(db.Text, nullable=True, default="[]")
    # ── INVENTORY ────────────────────────────────────────────────
    stock   = db.Column(db.Text, nullable=True, default="{}")
    # ── SPECIFICATIONS ────────────────────────────────────────────
    # Plain text, "Key: Value" per line
    specs    = db.Column(db.Text,      nullable=True, default="")
    category = db.Column(db.String(50), nullable=True, default="")

    def get_stock(self):
        try: return json.loads(self.stock or "{}")
        except: return {}

    def set_stock(self, d):
        self.stock = json.dumps(d)

    def total_stock(self):
        return sum(self.get_stock().values())

    def is_out_of_stock(self):
        try:
            s = self.get_stock()
            return len(s) > 0 and all(v <= 0 for v in s.values())
        except Exception:
            return False

    def to_dict(self):
        try:
            stock = self.get_stock()
        except Exception:
            stock = {}
        return {
            "id":             self.id,
            "name":           self.name,
            "brand":          self.brand,
            "price":          self.price,
            "image":          self.image,
            "tag":            self.tag or "",
            "sizes":          json.loads(self.sizes  or "[]"),
            "colors":         json.loads(self.colors or "[]"),
            "stock":          stock,
            "total_stock":    sum(stock.values()) if stock else None,
            "out_of_stock":   self.is_out_of_stock() if stock else False,
            "specs":          self.specs or "",
            "original_price": self.original_price or 0,
            "category":       self.category or "",
        }


class Setting(db.Model):
    __tablename__ = "settings"
    key   = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.Text, nullable=True)


class Order(db.Model):
    __tablename__ = "orders"

    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(100), nullable=False)
    phone      = db.Column(db.String(20),  nullable=False)
    line1      = db.Column(db.String(120), nullable=False)
    line2      = db.Column(db.String(120), nullable=True)
    city       = db.Column(db.String(60),  nullable=False)
    state      = db.Column(db.String(60),  nullable=False)
    pin        = db.Column(db.String(12),  nullable=False)
    landmark   = db.Column(db.String(100), nullable=True)
    total      = db.Column(db.Float,       nullable=False)
    status     = db.Column(db.String(20),  nullable=False, default="Pending")
    notes      = db.Column(db.Text,        nullable=True)
    created_at = db.Column(db.DateTime,    default=datetime.utcnow)
    updated_at = db.Column(db.DateTime,    default=datetime.utcnow, onupdate=datetime.utcnow)

    items = db.relationship("OrderItem", backref="order", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id":         self.id,
            "name":       self.name,
            "phone":      self.phone,
            "address":    f"{self.line1}{', ' + self.line2 if self.line2 else ''}, {self.city}, {self.state} — {self.pin}",
            "landmark":   self.landmark,
            "total":      self.total,
            "status":     self.status,
            "notes":      self.notes,
            "created_at": self.created_at.strftime("%d %b %Y, %I:%M %p"),
            "items":      [i.to_dict() for i in self.items],
        }


class OrderItem(db.Model):
    __tablename__ = "order_items"

    id         = db.Column(db.Integer, primary_key=True)
    order_id   = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False)
    product_id = db.Column(db.Integer, nullable=False)
    name       = db.Column(db.String(150), nullable=False)
    brand      = db.Column(db.String(80),  nullable=False)
    size       = db.Column(db.String(20),  nullable=False)
    color      = db.Column(db.String(60),  nullable=True)
    qty        = db.Column(db.Integer,     nullable=False, default=1)
    price      = db.Column(db.Float,       nullable=False)
    image      = db.Column(db.String(300), nullable=True)

    def to_dict(self):
        return {
            "product_id": self.product_id,
            "name":       self.name,
            "brand":      self.brand,
            "size":       self.size,
            "color":      self.color,
            "qty":        self.qty,
            "price":      self.price,
            "image":      self.image,
        }
