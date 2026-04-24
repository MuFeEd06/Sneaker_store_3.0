
/* =================================================
   IMAGEKIT URL HELPER
   Rewrites an IK URL's tr= params for a new width/quality.
   Safe to call on non-IK URLs — returns them unchanged.
================================================= */
function ikResize(url, width, quality) {
    if (!url || !url.includes("ik.imagekit.io")) return url;
    const base = url.split("?")[0];
    return `${base}?tr=w-${width},q-${quality},f-webp,c-at_max`;
}

/* =================================================
   NEW ARRIVALS CAROUSEL
================================================= */
async function renderNewArrivals() {
    const wrap  = document.getElementById("new-arrivals-wrap");
    const track = document.getElementById("new-arrivals-track");
    if (!wrap || !track) return;

    try {
        // Reuse the shared fetchProducts() cache — no separate API call needed
        const allProducts = await fetchProducts();
        const data = allProducts.filter(p => p.tag === "new");
        if (!data || data.length === 0) {
            // Hide section if no new products
            const section = document.getElementById("new-arrivals");
            if (section) section.style.display = "none";
            return;
        }

        track.innerHTML = "";
        data.forEach(shoe => {
            const deal  = getDeal(shoe);
            const oos   = shoe.out_of_stock === true;
            const img   = shoe.image
                ? ikResize(shoe.image.startsWith("http") ? shoe.image : "/static/" + shoe.image, 400, 75)
                : "https://placehold.co/300x300/eaf3fa/2B9FD8?text=No+Image";

            const card = document.createElement("div");
            card.className = "new-arrivals-card";
            card.innerHTML = `
                <div class="na-card-img-wrap">
                    <img src="${img}" alt="${shoe.name}"
                         loading="lazy"
                         onerror="this.src='https://placehold.co/300x300/eaf3fa/2B9FD8?text=No+Image'">
                </div>
                <span class="na-card-badge">New</span>
                <div class="na-card-body">
                    <div class="na-card-brand">${shoe.brand}</div>
                    <div class="na-card-name">${shoe.name}</div>
                    <div class="na-card-price">
                        ${formatPrice(shoe.price)}
                        ${deal ? `<span class="na-card-orig">${formatPrice(deal.origPrice)}</span>` : ""}
                    </div>
                </div>
            `;
            if (!oos) {
                card.addEventListener("click", () => openProduct(shoe.id));
            } else {
                card.style.opacity = "0.55";
            }
            track.appendChild(card);
        });

        // ── Drag-to-scroll (mouse) ──────────────────────────────────────────
        let isDragging = false, startX = 0, scrollStart = 0;

        wrap.addEventListener("mousedown", e => {
            isDragging  = true;
            startX      = e.pageX;
            scrollStart = wrap.scrollLeft;
            wrap.classList.add("dragging");
        });
        window.addEventListener("mousemove", e => {
            if (!isDragging) return;
            wrap.scrollLeft = scrollStart - (e.pageX - startX);
        });
        window.addEventListener("mouseup", () => {
            isDragging = false;
            wrap.classList.remove("dragging");
        });

        // ── Touch scroll is native via overflow-x:auto ──────────────────────
        // Prevent accidental card tap after a drag
        let touchStartX = 0;
        wrap.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; }, { passive: true });
        wrap.addEventListener("touchend",   e => {
            const delta = Math.abs(e.changedTouches[0].clientX - touchStartX);
            if (delta > 8) {
                // Was a swipe — prevent the click from firing
                wrap.querySelectorAll(".new-arrivals-card").forEach(c => {
                    c.style.pointerEvents = "none";
                    setTimeout(() => c.style.pointerEvents = "", 200);
                });
            }
        }, { passive: true });

    } catch(e) {
        console.error("New arrivals failed:", e);
    }
}

/* =================================================
   BRAND DEFINITIONS — local logo images
   All logos served from ImageKit CDN — no Flask calls
================================================= */
const BRANDS = [
    { name: "Nike",          slug: "Nike",          color: "#FF6B35", logo: "https://ik.imagekit.io/yocxectr4/logos/brands/nike.png?tr=w-80,q-80,f-webp" },
    { name: "Adidas",        slug: "Adidas",        color: "#00B4D8", logo: "https://ik.imagekit.io/yocxectr4/logos/brands/adidas.png?tr=w-80,q-80,f-webp" },
    { name: "New Balance",   slug: "New Balance",   color: "#4CAF50", logo: "https://ik.imagekit.io/yocxectr4/logos/brands/newbalance.png?tr=w-80,q-80,f-webp" },
    { name: "Vans",          slug: "Vans",          color: "#FF3CAC", logo: "https://ik.imagekit.io/yocxectr4/logos/brands/vans.png?tr=w-80,q-80,f-webp" },
    { name: "Converse",      slug: "Converse",      color: "#F72585", logo: "https://ik.imagekit.io/yocxectr4/logos/brands/converse.png?tr=w-80,q-80,f-webp" },
    { name: "Puma",          slug: "Puma",          color: "#FFD60A", logo: "https://ik.imagekit.io/yocxectr4/logos/brands/puma.png?tr=w-80,q-80,f-webp" },
    { name: "Reebok",        slug: "Reebok",        color: "#7B2FBE", logo: "https://ik.imagekit.io/yocxectr4/logos/brands/reebok.png?tr=w-80,q-80,f-webp" },
    { name: "Asics",         slug: "Asics",         color: "#E63946", logo: "https://ik.imagekit.io/yocxectr4/logos/brands/asics.png?tr=w-80,q-80,f-webp" },
    { name: "Sketchers",     slug: "Sketchers",     color: "#2EC4B6", logo: "https://ik.imagekit.io/yocxectr4/logos/brands/sketchers.png?tr=w-80,q-80,f-webp" },
    { name: "On",            slug: "On",            color: "#F4A261", logo: "https://ik.imagekit.io/yocxectr4/logos/brands/on.png?tr=w-80,q-80,f-webp" },
    { name: "Onitsuka",      slug: "Onitsuka",      color: "#C77DFF", logo: "https://ik.imagekit.io/yocxectr4/logos/brands/onitsuka.png?tr=w-80,q-80,f-webp" },
    { name: "Lacoste",       slug: "Lacoste",       color: "#52B788", logo: "https://ik.imagekit.io/yocxectr4/logos/brands/lacoste.png?tr=w-80,q-80,f-webp" },
    { name: "Brooks",        slug: "Brooks",        color: "#FF6B6B", logo: "https://ik.imagekit.io/yocxectr4/logos/brands/brooks.png?tr=w-80,q-80,f-webp" },
    { name: "Timb",          slug: "Timb",          color: "#D4A373", logo: "https://ik.imagekit.io/yocxectr4/logos/brands/timb.png?tr=w-80,q-80,f-webp" },
    { name: "Brik",          slug: "Brik",          color: "#ADB5BD", logo: "https://ik.imagekit.io/yocxectr4/logos/brands/brik.png?tr=w-80,q-80,f-webp" },
    { name: "Alo",           slug: "Alo",           color: "#9BF5C8", logo: "https://ik.imagekit.io/yocxectr4/logos/brands/alo.png?tr=w-80,q-80,f-webp" },
    { name: "Louis Vuitton", slug: "Louis Vuitton", color: "#C9A84C", logo: "https://ik.imagekit.io/yocxectr4/logos/brands/louisvuitton.png?tr=w-80,q-80,f-webp" },
];

function getBrandConfig(name) {
    return BRANDS.find(b => b.slug.toLowerCase() === name.toLowerCase())
        || { initials: name.slice(0,2).toUpperCase(), color: "#7CFFB2" };
}


/* =================================================
   CART SYSTEM — localStorage persistence
================================================= */

const WHATSAPP_NUMBER = "919645087584"; // ← change to your number

function getCart() {
    return JSON.parse(localStorage.getItem("calvac_cart") || "[]");
}

function saveCart(cart) {
    localStorage.setItem("calvac_cart", JSON.stringify(cart));
    updateCartBadge();
}

function updateCartBadge() {
    const cart = getCart();
    const total = cart.reduce((sum, item) => sum + item.qty, 0);
    document.querySelectorAll("#cart-count").forEach(el => el.textContent = total);
}

/* helper — get currently selected color name */
function getSelectedColor() {
    const active = document.querySelector(".color-swatch.active");
    return active ? active.title : "";
}

/* helper — read live displayed price (updates when color changes) */
function getCurrentPrice() {
    const raw = document.getElementById("product-price")?.innerText || "₹0";
    return parseInt(raw.replace(/[^0-9]/g, "")) || 0;
}

function addToCartWithSize() {
    const size = document.getElementById("size-select").value;
    if (!size) { showToast("Please select a size first 👆"); return; }

    const id    = parseInt(localStorage.getItem("productId"));
    const name  = document.getElementById("product-name")?.innerText || "";
    const image = document.getElementById("product-img")?.src || "";
    const brand = name.split(" ")[0];
    const color = getSelectedColor();
    const numericPrice = getCurrentPrice(); // reads live color price

    const cart     = getCart();
    const existing = cart.find(i => i.id === id && i.size === size && i.color === color);

    if (existing) {
        existing.qty++;
    } else {
        cart.push({ id, name, brand, price: numericPrice, image, size, color, qty: 1 });
    }

    saveCart(cart);
    showToast(`Added to cart — ${size}${color ? " · " + color : ""}`);
}

/* Buy Now — add to cart then go straight to cart page */
function buyNow() {
    const size = document.getElementById("size-select").value;
    if (!size) { showToast("Please select a size first 👆"); return; }

    const id    = parseInt(localStorage.getItem("productId"));
    const name  = document.getElementById("product-name")?.innerText || "";
    const image = document.getElementById("product-img")?.src || "";
    const brand = name.split(" ")[0];
    const color = getSelectedColor();
    const numericPrice = getCurrentPrice();

    const cart     = getCart();
    const existing = cart.find(i => i.id === id && i.size === size && i.color === color);

    if (existing) {
        existing.qty++;
    } else {
        cart.push({ id, name, brand, price: numericPrice, image, size, color, qty: 1 });
    }

    saveCart(cart);
    window.location.href = "/cart";
}

/* ── TOAST ── */
function showToast(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
}

/* ── FORMAT PRICE ── */
function formatPrice(num) {
    return "₹" + num.toLocaleString("en-IN");
}

/* =================================================
   CART PAGE RENDERING
================================================= */
function renderCartPage() {
    const listEl      = document.getElementById("cart-items-list");
    const emptyEl     = document.getElementById("cart-empty");
    const layoutEl    = document.getElementById("cart-layout");
    const subtitleEl  = document.getElementById("cart-subtitle");

    if (!listEl) return; // Not on cart page

    const cart = getCart();
    updateCartBadge();

    if (cart.length === 0) {
        emptyEl.style.display  = "block";
        layoutEl.style.display = "none";
        if (subtitleEl) subtitleEl.textContent = "";
        return;
    }

    emptyEl.style.display  = "none";
    layoutEl.style.display = "grid";

    const totalItems = cart.reduce((s, i) => s + i.qty, 0);
    if (subtitleEl) subtitleEl.textContent = `${totalItems} item${totalItems !== 1 ? "s" : ""} in your cart`;

    listEl.innerHTML = "";
    cart.forEach((item, idx) => {
        const row = document.createElement("div");
        row.className = "cart-item fade-in";

        const colorChip = item.color
            ? `<span class="cart-item-color">
                   <span class="cart-color-dot" style="background:${getColorHex(item.color)}"></span>
                   ${item.color}
               </span>`
            : "";

        row.innerHTML = `
            <img class="cart-item-img"
                 src="${item.image}"
                 alt="${item.name}"
                 onerror="this.src='https://placehold.co/90x90/eaf3fa/2B9FD8?text=👟'">

            <div class="cart-item-details">
                <span class="cart-item-brand">${item.brand}</span>
                <span class="cart-item-name">${item.name}</span>
                <span class="cart-item-size">Size: <span>${item.size}</span></span>
                ${colorChip}
                <span class="cart-item-price">${formatPrice(item.price)}</span>
            </div>

            <div class="cart-item-controls">
                <div class="qty-control">
                    <button class="qty-btn" onclick="changeQty(${idx}, -1)">−</button>
                    <span class="qty-value">${item.qty}</span>
                    <button class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
                </div>
                <button class="remove-btn" onclick="removeItem(${idx})">Remove</button>
            </div>
        `;
        listEl.appendChild(row);
    });

    updateSummary(cart);
    initScrollAnimation();
}

function changeQty(idx, delta) {
    const cart = getCart();
    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    saveCart(cart);
    renderCartPage();
}

function removeItem(idx) {
    const cart = getCart();
    const removed = cart.splice(idx, 1)[0];
    saveCart(cart);
    showToast(`${removed.name} removed`);
    renderCartPage();
}

/* helper — get color hex from cached products for cart color dot */
function getColorHex(colorName) {
    try {
        const cached = JSON.parse(localStorage.getItem("claxxic_products") || "[]");
        for (const p of cached) {
            if (!p.colors) continue;
            const match = p.colors.find(c => c.name === colorName);
            if (match) return match.hex;
        }
    } catch {}
    return "#aaa";
}

function updateSummary(cart) {
    const subtotal   = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const totalItems = cart.reduce((sum, i) => sum + i.qty, 0);

    const countEl    = document.getElementById("summary-count");
    const subtotalEl = document.getElementById("summary-subtotal");
    const totalEl    = document.getElementById("summary-total");
    const waBtn      = document.getElementById("whatsapp-checkout");
    const noteEl     = document.getElementById("address-required-note");

    if (countEl)    countEl.textContent    = totalItems;
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (totalEl)    totalEl.textContent    = formatPrice(subtotal);

    // Always re-render address display
    const addr = getSavedAddress();
    renderAddressDisplay(addr);

    if (waBtn) {
        if (!addr) {
            // No address — block WhatsApp button
            waBtn.style.opacity       = "0.45";
            waBtn.style.pointerEvents = "none";
            waBtn.style.cursor        = "not-allowed";
            if (noteEl) noteEl.style.display = "block";
        } else {
            waBtn.style.opacity       = "1";
            waBtn.style.pointerEvents = "auto";
            waBtn.style.cursor        = "pointer";
            if (noteEl) noteEl.style.display = "none";

            // Rich WhatsApp message with color + image + address
            let msg = "🛒 *New Order — CALVAC*\n\n";
            msg += "👟 *Items Ordered:*\n";
            cart.forEach((item, i) => {
                msg += `\n${i + 1}. *${item.name}*\n`;
                msg += `   Brand: ${item.brand}\n`;
                msg += `   Size: ${item.size}\n`;
                if (item.color) msg += `   Color: ${item.color}\n`;
                msg += `   Qty: ${item.qty}\n`;
                msg += `   Price: ${formatPrice(item.price * item.qty)}\n`;
                if (item.image) {
                    const imgUrl = item.image.startsWith("http")
                        ? item.image
                        : `${window.location.origin}${item.image}`;
                    msg += `   🖼 Image: ${imgUrl}\n`;
                }
            });
            msg += `\n━━━━━━━━━━━━━\n`;
            msg += `💰 *Total: ${formatPrice(subtotal)}*\n`;
            msg += `🚚 Shipping: FREE\n\n`;
            msg += `📍 *Delivery Address:*\n`;
            msg += `${addr.name}\n`;
            msg += `${addr.phone}\n`;
            msg += `${addr.line1}${addr.line2 ? ", " + addr.line2 : ""}\n`;
            msg += `${addr.city}, ${addr.state} — ${addr.pin}\n`;
            if (addr.landmark) msg += `Landmark: ${addr.landmark}\n`;
            msg += `\nPlease confirm my order! 🙏`;

            const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
            waBtn.href = waUrl;

            // Also intercept click to save order to database first
            waBtn.onclick = async function(e) {
                e.preventDefault();
                await saveOrderToServer(cart, addr, subtotal);
                window.open(waUrl, "_blank");
            };
        }
    }
}


/* =================================================
   SAVE ORDER TO SERVER (Phase 2)
   Called when customer clicks Order via WhatsApp
================================================= */
async function saveOrderToServer(cart, addr, total) {
    try {
        await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: addr, items: cart, total })
        });
    } catch (e) {
        console.warn("Could not save order to server:", e);
        // Still let WhatsApp open even if server save fails
    }
}


/* =================================================
   ADDRESS SYSTEM — localStorage
================================================= */
function getSavedAddress() {
    try {
        const raw = localStorage.getItem("claxxic_address");
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function saveAddress() {
    const get = id => document.getElementById(id)?.value.trim() || "";
    const name     = get("addr-name");
    const phone    = get("addr-phone");
    const line1    = get("addr-line1");
    const line2    = get("addr-line2");
    const city     = get("addr-city");
    const state    = get("addr-state");
    const pin      = get("addr-pin");
    const landmark = get("addr-landmark");

    if (!name || !phone || !line1 || !city || !state || !pin) {
        showToast("Please fill all required (*) fields");
        return;
    }
    localStorage.setItem("claxxic_address", JSON.stringify(
        { name, phone, line1, line2, city, state, pin, landmark }
    ));
    document.getElementById("address-form")?.classList.remove("open");
    showToast("✓ Address saved");
    updateSummary(getCart());
}

function renderAddressDisplay(addr) {
    const displayEl = document.getElementById("address-display");
    const editBtn   = document.getElementById("address-edit-btn");
    if (!displayEl) return;
    if (!addr) {
        displayEl.innerHTML = `<p class="address-missing">No address saved. Add your delivery address to place an order.</p>`;
        if (editBtn) editBtn.textContent = "+ Add Address";
    } else {
        displayEl.innerHTML = `
            <div class="address-display">
                <strong>${addr.name} &nbsp;·&nbsp; ${addr.phone}</strong>
                ${addr.line1}${addr.line2 ? ", " + addr.line2 : ""}<br>
                ${addr.city}, ${addr.state} — ${addr.pin}
                ${addr.landmark ? `<br><span style="color:var(--text-light);font-size:0.82rem;">Near: ${addr.landmark}</span>` : ""}
            </div>`;
        if (editBtn) editBtn.textContent = "✏️ Edit";
    }
}

function toggleAddressForm() {
    const form = document.getElementById("address-form");
    if (!form) return;
    const isOpen = form.classList.contains("open");
    if (!isOpen) {
        const addr = getSavedAddress();
        if (addr) {
            document.getElementById("addr-name").value     = addr.name     || "";
            document.getElementById("addr-phone").value    = addr.phone    || "";
            document.getElementById("addr-line1").value    = addr.line1    || "";
            document.getElementById("addr-line2").value    = addr.line2    || "";
            document.getElementById("addr-city").value     = addr.city     || "";
            document.getElementById("addr-state").value    = addr.state    || "";
            document.getElementById("addr-pin").value      = addr.pin      || "";
            document.getElementById("addr-landmark").value = addr.landmark || "";
        }
        form.classList.add("open");
    } else {
        form.classList.remove("open");
    }
}


/* =================================================
   THREE.JS 3D SNEAKER SCENE (HOMEPAGE ONLY)
   Settings loaded from /api/site-settings
================================================= */
const container = document.getElementById("sneaker-container");

if (container) {
    fetchSiteSettings()
        .then(cfg => initThreeScene(cfg))
        .catch(() => initThreeScene({}));
}

function initThreeScene(cfg) {
    const container = document.getElementById("sneaker-container");
    if (!container) return;

    const rawPath = cfg.model_path || "sneaker.glb";
    // GLB served from GitHub CDN — bypasses Flask entirely
    const MODEL_PATH  = rawPath.startsWith("http") ? rawPath : "https://ik.imagekit.io/yocxectr4/models/sneaker.glb";
    const MODEL_SCALE = parseFloat(cfg.model_scale)   || 3;
    const MODEL_Y     = parseFloat(cfg.model_y)       || 0.8;
    const MODEL_SPEED = parseFloat(cfg.model_speed)   || 0.006;

    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, precision: "mediump" });

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    let sneaker;
    const loader = new THREE.GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(MODEL_PATH,
        gltf => {
            sneaker = gltf.scene;
            sneaker.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
            scene.add(sneaker);
        },
        undefined,
        err => console.error("Model loading error:", err)
    );

    camera.position.set(0, MODEL_Y, 12);
    let introAnimation = true, introProgress = 0, floatTime = 0;
    let mouseX = 0, mouseY = 0;

    document.addEventListener("mousemove", e => {
        const rect = container.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) / rect.width) - 0.5;
        mouseY = ((e.clientY - rect.top)  / rect.height) - 0.5;
    });

    function animate() {
        requestAnimationFrame(animate);
        if (sneaker) {
            if (introAnimation) {
                introProgress += 0.02;
                camera.position.z = 12 - introProgress * 8;
                sneaker.rotation.y += MODEL_SPEED;
                if (camera.position.z <= 4) { camera.position.z = 4; introAnimation = false; }
            } else {
                sneaker.rotation.y += MODEL_SPEED * 0.17 + mouseX * 0.02;
                sneaker.rotation.x  = -mouseY * 0.2;
                floatTime += 0.03;
                sneaker.position.y  = Math.sin(floatTime) * 0.15;
            }
        }
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener("resize", () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}


function getBrandConfig(name) {
    return BRANDS.find(b => b.slug.toLowerCase() === name.toLowerCase())
        || { logo: null, color: "#2B9FD8", name };
}

/* =================================================
   BRAND TILES (HOMEPAGE)
================================================= */
function renderBrandTiles() {
    const grid = document.getElementById("brand-tiles-grid");
    if (!grid) return;
    grid.innerHTML = "";

    // Read hidden brands from section data attribute (set by Jinja2)
    const section = document.getElementById("collections");
    const hiddenRaw = section?.dataset.hiddenBrands || "";
    const hiddenSet = new Set(
        hiddenRaw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
    );

    const visibleBrands = BRANDS.filter(b =>
        !hiddenSet.has(b.slug.toLowerCase()) &&
        !hiddenSet.has(b.name.toLowerCase())
    );

    visibleBrands.forEach((brand, i) => {
        const tile = document.createElement("a");
        tile.className = "brand-tile fade-in";
        tile.href = `/brand?brand=${encodeURIComponent(brand.slug)}`;
        tile.style.transitionDelay = `${i * 0.04}s`;

        const initials = brand.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

        tile.innerHTML = `
            <div class="brand-tile-icon" style="border:1.5px solid ${brand.color}44;">
                <img src="${brand.logo}"
                     alt="${brand.name}"
                     class="brand-logo-img"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <span class="brand-logo-fallback" style="display:none; color:${brand.color}; font-weight:900; font-size:1.1rem; background:${brand.color}18; width:100%; height:100%; border-radius:10px;">
                    ${initials}
                </span>
            </div>
            <span class="brand-tile-name">${brand.name}</span>
            <span class="brand-tile-arrow" style="color:${brand.color}80">→</span>
        `;
        grid.appendChild(tile);
    });


    initScrollAnimation();
}


/* =================================================
   PRODUCT UTILITIES
================================================= */
// Singleton — all sections share one fetch per page load, reducing API calls & egress
// Singleton + localStorage TTL cache (12hr matches server CDN cache)
// Avoids hitting /api/products on every page load for repeat visitors
// Singleton + localStorage TTL cache for site settings (12hr)
const _SETTINGS_TTL = 12 * 60 * 60 * 1000;
let _settingsPromise = null;

async function fetchSiteSettings() {
    if (_settingsPromise) return _settingsPromise;
    try {
        const cached = localStorage.getItem("calvac_settings_v2");
        if (cached) {
            const { ts, data } = JSON.parse(cached);
            if (Date.now() - ts < _SETTINGS_TTL) {
                _settingsPromise = Promise.resolve(data);
                return _settingsPromise;
            }
        }
    } catch {}
    _settingsPromise = fetch("/api/site-settings")
        .then(r => r.json())
        .then(data => {
            try {
                localStorage.setItem("calvac_settings_v2",
                    JSON.stringify({ ts: Date.now(), data }));
            } catch {}
            return data;
        })
        .catch(e => { _settingsPromise = null; return {}; });
    return _settingsPromise;
}

const _PRODUCTS_TTL = 12 * 60 * 60 * 1000; // 12 hours in ms
let _productsPromise = null;

async function fetchProducts() {
    // 1. In-memory singleton — shared across all sections on same page load
    if (_productsPromise) return _productsPromise;

    // 2. localStorage cache — valid for 12hr (matches CDN TTL)
    try {
        const cached = localStorage.getItem("calvac_products_v2");
        if (cached) {
            const { ts, data } = JSON.parse(cached);
            if (Date.now() - ts < _PRODUCTS_TTL) {
                _productsPromise = Promise.resolve(data);
                return _productsPromise;
            }
        }
    } catch {}

    // 3. Fetch from API and cache
    _productsPromise = fetch("/api/products")
        .then(r => r.json())
        .then(data => {
            try {
                localStorage.setItem("calvac_products_v2",
                    JSON.stringify({ ts: Date.now(), data }));
            } catch {}
            return data;
        })
        .catch(e => { _productsPromise = null; throw e; });
    return _productsPromise;
}

/* =================================================
   RATING SYSTEM
   Deterministic per product ID so rating stays
   consistent across page visits
================================================= */
function getRating(id) {
    // Seeded pseudo-random so same product always gets same rating
    const seed  = (id * 9301 + 49297) % 233280;
    const rand  = seed / 233280;
    // Score between 3.5 and 5.0, one decimal place
    const score = Math.round((3.5 + rand * 1.5) * 10) / 10;
    // Review count between 18 and 420
    const count = 18 + Math.floor(((id * 6271 + 28411) % 233280) / 233280 * 402);
    return { score, count };
}

function buildStars(score, size = "sm") {
    const full  = Math.floor(score);
    const half  = score % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    const cls   = `star star-${size}`;
    let html = "";
    for (let i = 0; i < full;  i++) html += `<span class="${cls} star-full">★</span>`;
    if (half)                        html += `<span class="${cls} star-half">★</span>`;
    for (let i = 0; i < empty; i++) html += `<span class="${cls} star-empty">★</span>`;
    return html;
}


/* =================================================
   DEAL PRICE GENERATOR
   Deterministic per product so same shoe = same deal every visit.
   Returns null if no deal, or { dealPrice, origPrice, pct, label }
================================================= */
function getDeal(shoe) {
    // Use admin-set original_price (MRP) if available
    const mrp  = shoe.original_price || 0;
    const orig = shoe.price;

    if (mrp > orig && mrp > 0) {
        const saved = mrp - orig;
        const pct   = Math.round((saved / mrp) * 100);
        return { dealPrice: orig, origPrice: mrp, pct, label: "Special Price" };
    }
    return null;  // no deal — admin didn't set an MRP
}

function formatDeal(deal) {
    if (!deal) return "";
    return `
        <div class="deal-wrap">
            <span class="deal-original">${formatPrice(deal.origPrice)}</span>
            <span class="deal-tag">${deal.pct}% OFF</span>
            <span class="deal-tag deal-tag-green">${deal.label}</span>
        </div>`;
}

function buildProductCard(shoe) {
    const { score, count } = getRating(shoe.id);
    const oos = shoe.out_of_stock === true;
    return `
    <div class="card fade-in" style="${oos ? 'opacity:0.75;' : ''}">
        <div style="position:relative;">
            <img src="${shoe.image}" alt="${shoe.name}"
                 loading="lazy"
                 onerror="this.src='https://placehold.co/280x180/eaf3fa/2B9FD8?text=No+Image'">
            ${oos ? '<div style="position:absolute;top:8px;left:8px;background:#e53e3e;color:#fff;font-size:0.65rem;font-weight:800;padding:3px 8px;border-radius:20px;letter-spacing:0.5px;text-transform:uppercase;">Out of Stock</div>' : ''}
        </div>
        <div class="card-info">
            <p class="brand-label">${shoe.brand}</p>
            <h3>${shoe.name}</h3>
            <div class="card-rating">
                <div class="stars">${buildStars(score, "sm")}</div>
                <span class="card-rating-score">${score} (${count})</span>
            </div>
            <span class="price">${formatPrice(shoe.price)}</span>
            ${!oos ? formatDeal(getDeal(shoe)) : ""}
            <button onclick="openProduct(${shoe.id})" ${oos ? 'style="background:#aaa;border-color:#aaa;cursor:not-allowed;"' : ''}>
                ${oos ? "Out of Stock" : "View Product"}
            </button>
        </div>
    </div>`;
}


/* =================================================
   TRENDING PRODUCTS (HOMEPAGE)
================================================= */
async function renderTrendingShoes() {
    const grid = document.getElementById("main-product-grid");
    if (!grid) return;

    try {
        const products = await fetchProducts();
        const trending = products.filter(p => p.tag === "trending");
        grid.innerHTML = "";
        trending.forEach(shoe => { grid.innerHTML += buildProductCard(shoe); });
        initScrollAnimation();
    } catch (err) {
        console.error("Failed to load trending shoes:", err);
    }
}


/* =================================================
   BRAND PAGE
================================================= */
async function renderBrandPage() {
    const monogramEl   = document.getElementById("brand-monogram");
    const titleEl      = document.getElementById("brand-title");
    const countEl      = document.getElementById("brand-count");
    const sectionTitle = document.getElementById("brand-section-title");
    const grid         = document.getElementById("brand-product-grid");
    if (!grid) return;

    const params    = new URLSearchParams(window.location.search);
    const brandName = params.get("brand") || "";
    const searchQ   = params.get("q") || "";   // from global search
    const brandCfg  = getBrandConfig(brandName);

    document.title = `${brandName} — CALVAC`;

    // Show logo in hero
    if (monogramEl) {
        const initials = brandName.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
        monogramEl.style.background = `${brandCfg.color}18`;
        monogramEl.style.border     = `1px solid ${brandCfg.color}44`;
        monogramEl.style.padding    = "14px";
        monogramEl.innerHTML = brandCfg.logo
            ? `<img src="${brandCfg.logo}" alt="${brandName}"
                    style="width:100%;height:100%;object-fit:contain;"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
               <span style="display:none;font-weight:900;color:${brandCfg.color};font-size:1.4rem;">${initials}</span>`
            : `<span style="font-weight:900;color:${brandCfg.color};font-size:1.4rem;">${initials}</span>`;
    }
    if (titleEl)       titleEl.textContent      = brandName;
    if (sectionTitle)  sectionTitle.textContent = `All ${brandName} Styles`;

    try {
        const products = await fetchProducts();
        // Normalize function — strips spaces/special chars, lowercases
        function norm(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, ""); }

        let filtered = [];
        let pageTitle = brandName;

        if (searchQ) {
            // Global search mode — fuzzy match name OR brand
            const q = norm(searchQ);
            filtered = products.filter(p =>
                norm(p.name).includes(q) ||
                norm(p.brand).includes(q) ||
                p.name.toLowerCase().includes(searchQ.toLowerCase()) ||
                p.brand.toLowerCase().includes(searchQ.toLowerCase())
            );
            pageTitle = `Search: "${searchQ}"`;
            if (titleEl) titleEl.textContent = searchQ;
            if (sectionTitle) sectionTitle.textContent = `Results for "${searchQ}"`;
            if (countEl) countEl.textContent = filtered.length;
            // Update monogram for search mode
            if (monogramEl) {
                monogramEl.style.background = "rgba(43,159,216,0.12)";
                monogramEl.style.border = "1px solid rgba(43,159,216,0.3)";
                monogramEl.innerHTML = `<span style="font-size:2rem;">🔍</span>`;
            }
            document.title = `${searchQ} — CALVAC`;
        } else if (params.get("tag")) {
            // Tag filter — boots/crocs/girls use category field; others use tag field
            const tag       = params.get("tag");
            const tagLabel  = { boots:"Boots", crocs:"Crocs", girls:"Girls", new:"New Arrivals",
                                sale:"Sale", trending:"Trending", luxury:"Luxury" }[tag] || tag;
            const CAT_TAGS  = new Set(["boots","crocs","girls"]);
            filtered = CAT_TAGS.has(tag)
                ? products.filter(p => p.category === tag)   // category column
                : products.filter(p => p.tag === tag);        // tag column
            pageTitle = tagLabel;
            document.title = `${tagLabel} — CALVAC`;
            if (titleEl)      titleEl.textContent      = tagLabel;
            if (sectionTitle) sectionTitle.textContent = `All ${tagLabel} Products`;
            if (monogramEl) {
                const em = { boots:"👢", crocs:"🥿", girls:"👟", new:"✨",
                             sale:"🏷️", trending:"🔥", luxury:"💎" }[tag] || "🛍️";
                monogramEl.style.background = "rgba(43,159,216,0.12)";
                monogramEl.style.border     = "1px solid rgba(43,159,216,0.3)";
                monogramEl.innerHTML        = `<span style="font-size:2.4rem;">${em}</span>`;
            }

        } else if (params.get("min_price")) {
            // Price floor filter: Premium (above min price)
            const min     = parseInt(params.get("min_price"));
            const label   = `Premium (Above ₹${min.toLocaleString("en-IN")})`;
            filtered  = products.filter(p => p.price >= min);
            pageTitle = "Premium";
            document.title = `Premium — CALVAC`;
            if (titleEl)      titleEl.textContent      = "Premium";
            if (sectionTitle) sectionTitle.textContent = `Shoes Above ₹${min.toLocaleString("en-IN")}`;
            if (countEl)      countEl.textContent       = filtered.length;
            if (monogramEl) {
                monogramEl.style.background = "rgba(43,159,216,0.12)";
                monogramEl.style.border     = "1px solid rgba(43,159,216,0.3)";
                monogramEl.innerHTML        = `<span style="font-size:2.4rem;">💎</span>`;
            }

        } else if (params.get("max_price")) {
            // Price ceiling filter: Under 1000 / 1500 / 2500
            const max     = parseInt(params.get("max_price"));
            const label   = `Under ₹${max.toLocaleString("en-IN")}`;
            filtered  = products.filter(p => p.price <= max);
            pageTitle = label;
            document.title = `${label} — CALVAC`;
            if (titleEl)      titleEl.textContent      = label;
            if (sectionTitle) sectionTitle.textContent = `Shoes Priced ${label}`;
            if (monogramEl) {
                monogramEl.style.background = "rgba(43,159,216,0.12)";
                monogramEl.style.border     = "1px solid rgba(43,159,216,0.3)";
                monogramEl.innerHTML        = `<span style="font-size:2.4rem;">💰</span>`;
            }

        } else if (params.get("sale")) {
            // Sale filter: products with original_price set and above sale price
            filtered  = products.filter(p =>
                p.original_price && p.original_price > p.price && p.original_price > 0
            );
            pageTitle = "Sale";
            document.title = `Sale — CALVAC`;
            if (titleEl)      titleEl.textContent      = "Sale";
            if (sectionTitle) sectionTitle.textContent = "Products On Sale";
            if (monogramEl) {
                monogramEl.style.background = "rgba(229,62,62,0.12)";
                monogramEl.style.border     = "1px solid rgba(229,62,62,0.3)";
                monogramEl.innerHTML        = `<span style="font-size:2.4rem;">🏷️</span>`;
            }

        } else if (brandName) {
            // Brand page: fuzzy match on brand name
            const qb  = norm(brandName);
            filtered  = products.filter(p => norm(p.brand) === qb || norm(p.brand).includes(qb));
            pageTitle = brandName;
        } else {
            // No filter params — "All Shoes" shows everything
            filtered  = [...products];
            pageTitle = "All Shoes";
            document.title = "All Shoes — CALVAC";
            if (titleEl)      titleEl.textContent      = "All Shoes";
            if (sectionTitle) sectionTitle.textContent = "All Styles";
            if (monogramEl) {
                monogramEl.style.background = "rgba(43,159,216,0.12)";
                monogramEl.style.border     = "1px solid rgba(43,159,216,0.3)";
                monogramEl.innerHTML        = `<span style="font-size:2.4rem;">👟</span>`;
            }
        }

        if (countEl) countEl.textContent = filtered.length;

        grid.innerHTML = "";
        if (filtered.length === 0) {
            grid.innerHTML = `<p style="color:var(--text-muted);text-align:center;grid-column:1/-1;padding:60px 20px;">
                No products found. Try a different filter.
            </p>`;
            return;
        }
        filtered.forEach(shoe => { grid.innerHTML += buildProductCard(shoe); });
        initScrollAnimation();
    } catch (err) {
        console.error("Failed to load brand products:", err);
    }
}


/* =================================================
   PRODUCT DESCRIPTION GENERATOR
   Deterministic per product ID — same shoe always
   gets the same description across visits
================================================= */

const DESC_TEMPLATES = {

    comfort: [
        "engineered with responsive foam cushioning that absorbs impact and returns energy with every step",
        "built on a plush midsole that cradles your foot in cloud-like comfort all day long",
        "featuring a padded collar and cushioned insole that keep fatigue at bay during long wear",
        "designed with multi-zone cushioning that adapts to your stride for a personalised fit",
        "equipped with a contoured footbed that provides arch support and all-day softness",
        "constructed with a lightweight foam base that delivers a barely-there feel without sacrificing support",
        "lined with breathable mesh padding that wicks moisture and keeps your feet fresh for hours",
        "built for maximum underfoot comfort with a dual-density midsole that softens every landing",
    ],

    material: [
        "crafted from premium full-grain leather upper that ages beautifully and resists daily wear",
        "made with engineered mesh that offers superior breathability while keeping its structure",
        "constructed from high-abrasion rubber on the outsole for lasting grip on any surface",
        "featuring a reinforced toe cap and heel counter built to handle the demands of daily use",
        "assembled with vulcanised rubber and canvas that deliver timeless durability",
        "built with a seamless knit upper that moves with your foot and resists tearing",
        "using premium suede panels and tonal stitching that speak to quality in every detail",
        "finished with a textured rubber outsole that bites into surfaces for confident traction",
    ],

    style: [
        "its clean silhouette and tonal colourway make it an effortless match for any outfit",
        "the bold profile and contrasting sole unit command attention on the street and off it",
        "a minimalist design language keeps it versatile enough to pair with casual or smart looks",
        "retro-inspired lines and modern proportions give it a timeless appeal that never goes out of style",
        "the sleek low-profile shape transitions seamlessly from the gym to the streets",
        "subtle branding and a refined palette keep the aesthetic understated yet distinctive",
        "oversized panels and a chunky outsole lean into the premium streetwear aesthetic",
        "clean toe box and tonal eyelets give the silhouette a polished, put-together finish",
    ],
};

// Seeded pick — deterministic so same product = same description
function seededPick(arr, seed) {
    return arr[seed % arr.length];
}

function getProductDescription(shoe) {
    const id = shoe.id;

    // Three different seeds for three different template pools
    const s1 = (id * 7919)  % 233280;
    const s2 = (id * 6271 + 1000) % 233280;
    const s3 = (id * 9301 + 49297) % 233280;

    const comfort  = seededPick(DESC_TEMPLATES.comfort,  s1);
    const material = seededPick(DESC_TEMPLATES.material, s2);
    const style    = seededPick(DESC_TEMPLATES.style,    s3);

    // Combine into two natural sentences
    const sentence1 = `The ${shoe.name} is ${comfort}, while ${material}.`;
    const sentence2 = `${style.charAt(0).toUpperCase() + style.slice(1)} — making it a standout addition to any rotation.`;

    return `${sentence1} ${sentence2}`;
}


/* =================================================
   PRODUCT DETAIL PAGE
================================================= */
async function loadProductPage() {
    const nameEl  = document.getElementById("product-name");
    const priceEl = document.getElementById("product-price");
    const imgEl   = document.getElementById("product-img");
    if (!nameEl || !priceEl || !imgEl) return;

    const id = parseInt(localStorage.getItem("productId"));
    try {
        // Fetch single product directly — avoids loading all products for 1 item
        let shoe;
        try {
            const res = await fetch(`/api/products/${id}`);
            if (!res.ok) throw new Error("not found");
            shoe = await res.json();
        } catch {
            // Fallback to full list if single fetch fails
            const products = await fetchProducts();
            shoe = products.find(p => p.id === id);
        }
        if (!shoe) { nameEl.innerText = "Product not found"; return; }

        window._currentShoe = shoe;  // store for size chip re-render on colour change
        nameEl.innerText  = shoe.name;
        priceEl.innerText = formatPrice(shoe.price);
        imgEl.src         = ikResize(shoe.image, 800, 85);

        // Show deal price on product page if applicable
        const deal = getDeal(shoe);
        const existingDeal = document.getElementById("product-deal-wrap");
        if (deal) {
            const dealEl = document.createElement("div");
            dealEl.id = "product-deal-wrap";
            dealEl.innerHTML = formatDeal(deal);
            dealEl.style.marginBottom = "8px";
            priceEl.insertAdjacentElement("afterend", dealEl);
        }
        imgEl.onerror     = () => imgEl.src = "https://placehold.co/400x300/eaf3fa/2B9FD8?text=No+Image";

        // Update page title
        document.title = `${shoe.name} — CALVAC`;

        // Inject rating
        const { score, count } = getRating(shoe.id);
        const starsEl  = document.getElementById("rating-stars");
        const scoreEl  = document.getElementById("rating-score");
        const countEl  = document.getElementById("rating-count");
        if (starsEl) starsEl.innerHTML = buildStars(score, "lg");
        if (scoreEl) scoreEl.textContent = score.toFixed(1);
        if (countEl) countEl.textContent = `(${count.toLocaleString()} reviews)`;

        // Inject description
        const descEl = document.querySelector(".description");
        if (descEl) descEl.textContent = getProductDescription(shoe);

        // ── Render specifications ──────────────────────────────────────────
        const existingSpecs = document.getElementById("product-specs-block");
        if (existingSpecs) existingSpecs.remove();
        if (shoe.specs && shoe.specs.trim()) {
            const lines = shoe.specs.trim().split("\n").filter(l => l.trim());
            const rows  = lines.map(line => {
                const idx = line.indexOf(":");
                if (idx > 0) {
                    const k = line.slice(0, idx).trim();
                    const v = line.slice(idx + 1).trim();
                    return `<tr><td class="spec-key">${k}</td><td class="spec-val">${v}</td></tr>`;
                }
                return `<tr><td colspan="2" class="spec-val">${line}</td></tr>`;
            }).join("");

            const specsBlock = document.createElement("div");
            specsBlock.id        = "product-specs-block";
            specsBlock.className = "product-specs";
            specsBlock.innerHTML = `
                <div class="specs-header" onclick="toggleSpecs(this)">
                    📋 Specifications <span class="specs-arrow" style="display:inline-block;transition:transform 0.25s;float:right;">▾</span>
                </div>
                <div class="specs-body">
                    <table class="specs-table">${rows}</table>
                </div>`;
            if (descEl && descEl.parentNode) {
                descEl.insertAdjacentElement("afterend", specsBlock);
            }
        }

        // Render color swatches
        renderColorSwatches(shoe);

        // Render size chips
        renderSizeChips(shoe);

        // Out of stock banner on product page
        if (shoe.out_of_stock) {
            const btnGroup = document.querySelector(".product-btn-group");
            if (btnGroup) {
                btnGroup.innerHTML = `<div style="background:#fff5f5;border:1.5px solid #fed7d7;border-radius:10px;padding:16px;text-align:center;color:#e53e3e;font-weight:700;font-size:1rem;">
                    😔 This product is currently out of stock
                </div>`;
            }
        }

        // Load full product list lazily for "You May Also Like" section
        // Uses cache if available, otherwise fetches in background
        fetchProducts().then(products => {
            renderSimilarProducts(shoe, products);
        }).catch(() => {});

    } catch (err) {
        console.error("Failed to load product:", err);
        if (nameEl) nameEl.innerText = "Error loading product";
    }
}


/* =================================================
   SIZE CHIPS — product page
   ================================================= */
// Sizes are stored directly as "UK 8" or "EU 42" — no conversion needed
// Just display as-is
function getSizeLabel(size) {
    return { primary: size, secondary: "" };
}


/* =================================================
   CATEGORY QUICK LINKS — infinite drag scroll
================================================= */
// Categories defined per-button (slug matches site_settings key)
const CATEGORIES = [
    { label:"Boots",      slug:"boots",      emoji:"👢", url:"/brand?tag=boots"       },
    { label:"Crocs",      slug:"crocs",      emoji:"🥿", url:"/brand?tag=crocs"       },
    { label:"Girls",      slug:"girls",      emoji:"👟", url:"/brand?tag=girls"       },
    { label:"Sale",       slug:"sale",       emoji:"🏷️", url:"/brand?sale=1"          },
    { label:"Under 1000", slug:"under1000",  emoji:"💰", url:"/brand?max_price=1000"  },
    { label:"Under 1500", slug:"under1500",  emoji:"💸", url:"/brand?max_price=1500"  },
    { label:"Under 2500", slug:"under2500",  emoji:"🛍️", url:"/brand?max_price=2500"  },
    { label:"New",        slug:"new",        emoji:"✨", url:"/brand?tag=new"          },
    { label:"Premium",    slug:"premium",    emoji:"💎", url:"/brand?min_price=2500"  },
    { label:"All Shoes",  slug:"all",        emoji:"👟", url:"/brand"                 },
];

function buildCatCard(cat) {
    const a = document.createElement("a");
    a.className    = "na-cat-card";   // reuse new-arrivals card sizing
    a.href         = cat.url;
    a.draggable    = false;

    const imgWrap  = document.createElement("div");
    imgWrap.className = "na-cat-img-wrap";

    const img = document.createElement("img");
    img.src       = "https://ik.imagekit.io/yocxectr4/logos/categories/" + cat.slug + ".png";
    img.alt       = cat.label;
    img.loading   = "lazy";
    img.className = "na-cat-logo";
    img.onerror   = function() {
        this.style.display = "none";
        const em = document.createElement("span");
        em.className = "na-cat-emoji";
        em.textContent = cat.emoji;
        imgWrap.appendChild(em);
    };
    imgWrap.appendChild(img);

    const lbl = document.createElement("span");
    lbl.className   = "na-cat-label";
    lbl.textContent = cat.label;

    a.appendChild(imgWrap);
    a.appendChild(lbl);
    return a;
}

async function initCategoryScroll() {
    const wrap  = document.getElementById("cat-scroll-outer");
    const track = document.getElementById("cat-track");
    if (!wrap || !track) return;

    // Load which buttons are enabled from site settings
    let enabled = {};
    try {
        const cfg  = await fetchSiteSettings();
        if (cfg.show_categories === false) {
            const section = document.getElementById("cat-scroll-section");
            if (section) section.style.display = "none";
            return;
        }
        CATEGORIES.forEach(c => { enabled[c.slug] = cfg["cat_" + c.slug] !== false; });
    } catch(e) {
        CATEGORIES.forEach(c => { enabled[c.slug] = true; });
    }

    const visible = CATEGORIES.filter(c => enabled[c.slug]);
    if (visible.length === 0) {
        const section = document.getElementById("cat-scroll-section");
        if (section) section.style.display = "none";
        return;
    }

    // Build track — duplicate for seamless loop feel (used with drag, not CSS anim)
    const all = [...visible, ...visible];
    track.innerHTML = "";
    all.forEach(cat => track.appendChild(buildCatCard(cat)));

    // ── Drag-to-scroll with momentum (same as New Arrivals) ──────────────────
    let isDragging = false, startX = 0, scrollStart = 0, velX = 0, lastX = 0, lastT = 0, rafId = null;

    wrap.addEventListener("mousedown", e => {
        isDragging = true;
        startX = e.pageX; scrollStart = wrap.scrollLeft;
        lastX = e.pageX; lastT = Date.now(); velX = 0;
        wrap.classList.add("dragging");
        cancelAnimationFrame(rafId);
    });
    window.addEventListener("mousemove", e => {
        if (!isDragging) return;
        wrap.scrollLeft = scrollStart - (e.pageX - startX);
        const now = Date.now();
        velX = (e.pageX - lastX) / Math.max(1, now - lastT) * 16;
        lastX = e.pageX; lastT = now;
    });
    window.addEventListener("mouseup", () => {
        if (!isDragging) return;
        isDragging = false;
        wrap.classList.remove("dragging");
        (function glide() {
            if (Math.abs(velX) < 0.5) return;
            wrap.scrollLeft -= velX; velX *= 0.92;
            rafId = requestAnimationFrame(glide);
        })();
    });

    // Prevent tap-as-click after drag
    let _catDragDist = 0;
    wrap.addEventListener("mousedown", e => { _catDragDist = 0; });
    window.addEventListener("mousemove", e => { if (isDragging) _catDragDist += Math.abs(e.movementX); });
    wrap.addEventListener("click", e => { if (_catDragDist > 6) e.preventDefault(); }, true);

    // Touch: native scroll
    let touchX0 = 0;
    wrap.addEventListener("touchstart", e => { touchX0 = e.touches[0].clientX; }, { passive: true });
    wrap.addEventListener("touchend", e => {
        const delta = Math.abs(e.changedTouches[0].clientX - touchX0);
        if (delta > 8) {
            wrap.querySelectorAll(".na-cat-card").forEach(c => {
                c.style.pointerEvents = "none";
                setTimeout(() => c.style.pointerEvents = "", 200);
            });
        }
        // Loop reset when dragged past halfway
        const half = track.scrollWidth / 2;
        if (wrap.scrollLeft >= half) wrap.scrollLeft -= half;
        if (wrap.scrollLeft <= 0)   wrap.scrollLeft += half;
    }, { passive: true });

    // Mouse loop reset
    wrap.addEventListener("scroll", () => {
        if (!isDragging) return;
        const half = track.scrollWidth / 2;
        if (wrap.scrollLeft >= half) wrap.scrollLeft -= half;
        if (wrap.scrollLeft <= 0)   wrap.scrollLeft += half;
    }, { passive: true });
}

/* =================================================
   SIZE SYSTEM
   Sizes are ALWAYS stored as UK in the database.
   Display is controlled by _sizeUnit preference.
================================================= */
const UK_TO_EU = {
    "UK 3":"EU 35",  "UK 3.5":"EU 36", "UK 4":"EU 37",
    "UK 5":"EU 38",  "UK 6":"EU 39",   "UK 6.5":"EU 40",
    "UK 7":"EU 41",  "UK 8":"EU 42",   "UK 9":"EU 43",
    "UK 10":"EU 44", "UK 11":"EU 45",  "UK 11.5":"EU 46", "UK 12":"EU 47"
};
const EU_TO_UK = Object.fromEntries(Object.entries(UK_TO_EU).map(([k,v])=>[v,k]));

let _sizeUnit = "uk";  // "uk" | "euro" — no both option

async function loadSizeUnit() {
    try {
        const data = await fetchSiteSettings();
        _sizeUnit  = (data.size_unit === "euro") ? "euro" : "uk";
    } catch(e) { _sizeUnit = "both"; }
}

function getDisplayLabel(ukSize) {
    const eu = UK_TO_EU[ukSize] || "";
    if (_sizeUnit === "euro" && eu) return { primary: eu,     secondary: "" };
    return { primary: ukSize, secondary: "" };  // "uk" — no secondary label
}

function getSizeUnitHeaderLabel() {
    return _sizeUnit === "euro" ? "EU Sizes" : "UK Sizes";
}

function renderSizeChips(shoe) {
    const wrap    = document.getElementById("size-chips-wrap");
    const hidden  = document.getElementById("size-select");
    const unitLbl = document.getElementById("size-unit-label");
    if (!wrap || !shoe.sizes) return;

    if (unitLbl) unitLbl.textContent = getSizeUnitHeaderLabel();

    const stock = shoe.stock || {};
    wrap.innerHTML = "";

    shoe.sizes.forEach(rawSize => {
        // Normalise — sizes in DB are UK, but handle legacy EU values too
        const ukSize = rawSize.startsWith("EU") ? (EU_TO_UK[rawSize] || rawSize) : rawSize;

        const activeColor = document.querySelector(".color-swatch.active")?.title || "default";
        const qty = stock[`${activeColor}|${ukSize}`] !== undefined
                  ? stock[`${activeColor}|${ukSize}`]
                  : stock[`default|${ukSize}`] !== undefined
                  ? stock[`default|${ukSize}`]
                  : null;

        const oos      = qty !== null && qty <= 0;
        const lowStock = qty !== null && qty > 0 && qty <= 5;

        const { primary, secondary } = getDisplayLabel(ukSize);

        const chip = document.createElement("div");
        chip.className    = "size-chip-btn" + (oos ? " oos" : "");
        chip.dataset.size = ukSize;   // ALWAYS store UK value
        chip.title        = oos ? "Sold Out" : (lowStock ? `${qty} left` : `${ukSize} / ${UK_TO_EU[ukSize] || ""}`);

        chip.innerHTML = `
            <span class="size-chip-uk">${primary}</span>
            ${secondary ? `<span class="size-chip-eu">${secondary}</span>` : ""}
            ${lowStock ? '<span class="stock-dot"></span>' : ""}
        `;

        if (!oos) {
            chip.addEventListener("click", () => {
                wrap.querySelectorAll(".size-chip-btn").forEach(c => c.classList.remove("selected"));
                chip.classList.add("selected");
                hidden.value = ukSize;  // always UK
            });
        }
        wrap.appendChild(chip);
    });
}

/* =================================================
   COLOR SWATCHES
================================================= */
function renderColorSwatches(shoe) {
    const section     = document.getElementById("color-section");
    const swatchesEl  = document.getElementById("color-swatches");
    const colorNameEl = document.getElementById("selected-color-name");
    const imgEl       = document.getElementById("product-img");
    const priceEl     = document.getElementById("product-price");

    if (!section || !swatchesEl || !shoe.colors || shoe.colors.length === 0) {
        if (section) section.style.display = "none";
        return;
    }

    section.style.display = "block";
    swatchesEl.innerHTML  = "";

    // Set first color as default — update name + price
    const firstColor = shoe.colors[0];
    if (colorNameEl) colorNameEl.textContent = firstColor.name;
    if (priceEl && firstColor.price) {
        priceEl.textContent = formatPrice(firstColor.price);
    }

    shoe.colors.forEach((color, i) => {
        const swatch = document.createElement("button");
        swatch.className = "color-swatch" + (i === 0 ? " active" : "");
        swatch.title     = color.name;
        swatch.style.setProperty("--swatch-color", color.hex);

        // Show price badge on swatch if different from base price
        const hasDifferentPrice = color.price && color.price !== shoe.price;

        const isLight = ["#ffffff","#fff","#f5f5f5","#fafafa","#f0f0f0"].includes(color.hex.toLowerCase());
        if (isLight) swatch.classList.add("color-swatch-light");

        swatch.addEventListener("click", () => {
            // Update active swatch
            swatchesEl.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"));
            swatch.classList.add("active");

            // Update color name label
            if (colorNameEl) colorNameEl.textContent = color.name;

            // Update price — use color's price if set, else fall back to base
            if (priceEl) {
                const newPrice = color.price || shoe.price;
                // Animate price change
                priceEl.style.transform = "scale(1.12)";
                priceEl.style.color     = "var(--primary)";
                priceEl.textContent     = formatPrice(newPrice);
                setTimeout(() => {
                    priceEl.style.transform = "scale(1)";
                }, 250);
            }

            // Swap image with smooth fade
            if (imgEl) {
                imgEl.style.opacity   = "0";
                imgEl.style.transform = "scale(0.97)";
                setTimeout(() => {
                    imgEl.src = ikResize(color.image, 800, 85);
                    imgEl.onerror = () => imgEl.src = "https://placehold.co/400x300/eaf3fa/2B9FD8?text=No+Image";
                    imgEl.style.opacity   = "1";
                    imgEl.style.transform = "scale(1)";
                }, 200);
            }
        });

        swatchesEl.appendChild(swatch);
    });
}

/* =================================================
   SIMILAR PRODUCTS
   Logic: same brand first, then fill with similar
   price range (±₹2000), excluding current product,
   max 4 cards total
================================================= */
function renderSimilarProducts(current, allProducts) {
    const section    = document.getElementById("similar-section");
    const grid       = document.getElementById("similar-grid");
    const subtitleEl = document.getElementById("similar-subtitle");
    if (!section || !grid) return;

    const PRICE_RANGE = 2000;
    const MAX = 8;

    // 1. Same brand, exclude current
    const sameBrand = allProducts.filter(p =>
        p.id !== current.id &&
        p.brand.toLowerCase() === current.brand.toLowerCase()
    );

    // 2. Similar price range, exclude current & already picked
    const sameBrandIds = new Set(sameBrand.map(p => p.id));
    const similarPrice = allProducts.filter(p =>
        p.id !== current.id &&
        !sameBrandIds.has(p.id) &&
        Math.abs(p.price - current.price) <= PRICE_RANGE
    );

    // 3. If still not enough, grab any other products as fallback
    const pickedIds = new Set([current.id, ...sameBrand.map(p => p.id), ...similarPrice.map(p => p.id)]);
    const fallback  = allProducts.filter(p => !pickedIds.has(p.id));

    // 4. Shuffle each group so it feels fresh every visit
    const shuffle = arr => arr.sort(() => Math.random() - 0.5);

    // Fill up to MAX: same brand → price similar → fallback
    const picked = [
        ...shuffle(sameBrand),
        ...shuffle(similarPrice),
        ...shuffle(fallback)
    ].slice(0, MAX);

    if (picked.length === 0) return; // nothing to show

    // Subtitle tells the user why these were picked
    const brandCount = picked.filter(p => p.brand === current.brand).length;
    if (subtitleEl) {
        if (brandCount === picked.length) {
            subtitleEl.textContent = `More from ${current.brand}`;
        } else if (brandCount === 0) {
            subtitleEl.textContent = `Similar price range`;
        } else {
            subtitleEl.textContent = `More from ${current.brand} & similar picks`;
        }
    }

    grid.innerHTML = "";
    picked.forEach(shoe => { grid.innerHTML += buildProductCard(shoe); });

    section.style.display = "block";
    initScrollAnimation();
}


/* =================================================
   SCROLL ANIMATION
================================================= */
function initScrollAnimation() {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("show"); });
    });
    document.querySelectorAll(".fade-in").forEach(el => observer.observe(el));
}

function openProduct(id) {
    localStorage.setItem("productId", id);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Small delay so scroll feels intentional before page reload
    setTimeout(() => { window.location.href = "/product"; }, 150);
}

/* =================================================
   PAGE INITIALIZATION
================================================= */
document.addEventListener("DOMContentLoaded", () => {
    initScrollAnimation();
    updateCartBadge(); // always sync cart count in header

    const onHome    = !!document.getElementById("brand-tiles-grid");
    const onBrand   = !!document.getElementById("brand-product-grid");
    const onProduct = !!document.getElementById("product-name");
    const onCart    = !!document.getElementById("cart-items-list");

    if (onHome)    { renderNewArrivals(); renderBrandTiles(); initCategoryScroll(); renderTrendingShoes(); }
    if (onBrand)   renderBrandPage();
    if (onProduct) { loadSizeUnit().then(loadProductPage); }
    if (onCart)    renderCartPage();
});

/* =================================================
   GLOBAL HEADER SEARCH
================================================= */
let _searchTimer = null;

async function handleHeaderSearch(q) {
    const dropdown = document.getElementById('search-dropdown');
    if (!dropdown) return;

    q = q.trim();
    if (q.length < 2) {
        dropdown.classList.remove('open');
        dropdown.innerHTML = '';
        return;
    }

    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(async () => {
        try {
            const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            renderSearchDropdown(data, q);
        } catch(e) {
            dropdown.classList.remove('open');
        }
    }, 220);
}

function renderSearchDropdown(results, q) {
    const dropdown = document.getElementById("search-dropdown");
    if (!dropdown) return;

    if (!results || results.length === 0) {
        dropdown.innerHTML = `<div class="search-no-results">No results for "<strong>${q}</strong>"</div>`;
        dropdown.classList.add("open");
        return;
    }

    dropdown.innerHTML = results.slice(0, 6).map(p => `
        <div class="search-result-item" onclick="openProduct(${p.id})">
            <img class="search-result-img"
                 src="${p.image}"
                 alt="${p.name}"
                 onerror="this.src='https://placehold.co/40x40/eaf3fa/2B9FD8?text=👟'">
            <div class="search-result-info">
                <span class="search-result-name">${p.name}</span>
                <span class="search-result-brand">${p.brand}</span>
            </div>
            <span class="search-result-price">${formatPrice(p.price)}</span>
        </div>
    `).join('');

    // Add "See all results" footer
    dropdown.innerHTML += `<div class="search-result-item" style="border-top:1px solid var(--border);justify-content:center;color:var(--primary);font-weight:700;font-size:0.82rem;" onclick="submitHeaderSearch()">
        See all results for "${q}" →
    </div>`;

    dropdown.classList.add("open");
}

function submitHeaderSearch() {
    const q = document.getElementById("header-search")?.value.trim();
    if (!q) return;
    // Check if q exactly matches a brand name (fuzzy)
    function norm(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, ""); }
    const match = BRANDS.find(b => norm(b.name) === norm(q));
    if (match) {
        window.location.href = `/brand?brand=${encodeURIComponent(match.slug)}`;
    } else {
        window.location.href = `/brand?q=${encodeURIComponent(q)}`;
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', e => {
    const wrap = document.getElementById('header-search-wrap');
    if (wrap && !wrap.contains(e.target)) {
        const dd = document.getElementById('search-dropdown');
        if (dd) dd.classList.remove('open');
    }
});

// Pre-fill search if coming from search redirect
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    const input = document.getElementById('header-search');
    if (q && input) input.value = q;
});
