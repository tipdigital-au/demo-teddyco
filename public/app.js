let menuData = []; // Will hold the parsed, flat list of items
let tray = {}; // { itemId: quantity }
let categories = [];

document.addEventListener('DOMContentLoaded', () => {
    setupModal();
    fetchMenu();
});

async function fetchMenu() {
    try {
        const response = await fetch('/menu_data.json');
        const data = await response.json();
        parseMenuData(data);
    } catch (error) {
        console.error("Failed to load menu data:", error);
        document.getElementById('menu-container').innerHTML = '<p class="loader">Failed to load menu. Please refresh.</p>';
    }
}

function parseMenuData(data) {
    const rawCategories = data.categories;
    menuData = [];
    categories = [];

    // Generate simple unique IDs based on item name to keep track in Tray
    const genId = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

    rawCategories.forEach(category => {
        categories.push(category.category_name);

        // Handle items directly in category
        if (category.items) {
            category.items.forEach(item => {
                if (item.base_price !== undefined || item.price_range) {
                    menuData.push({
                        id: genId(item.item_name),
                        category: category.category_name,
                        name: item.item_name,
                        price: item.base_price || 0,
                        priceStr: item.base_price !== undefined ? `$${item.base_price.toFixed(2)}` : `$${item.price_range}`,
                        desc: item.description || '', // if exists
                        modifiers: item.available_modifiers || []
                    });
                }
            });
        }

        // Handle nested subcategories
        if (category.subcategories) {
            category.subcategories.forEach(sub => {
                if (sub.items) {
                    sub.items.forEach(item => {
                        if (item.base_price !== undefined || item.price_range) {
                            menuData.push({
                                id: genId(item.item_name),
                                category: category.category_name,
                                subCategory: sub.subcategory_name,
                                name: item.item_name,
                                price: item.base_price || 0,
                                priceStr: item.base_price !== undefined ? `$${item.base_price.toFixed(2)}` : `$${item.price_range}`,
                                desc: item.description || sub.subcategory_name,
                                modifiers: item.available_modifiers || []
                            });
                        }
                    });
                }
            });
        }
    });

    renderMenu();
}

function renderMenu() {
    const container = document.getElementById('menu-container');
    container.innerHTML = '';

    if (menuData.length === 0) {
        container.innerHTML = '<p class="loader">No items found.</p>';
        return;
    }

    let currentCatRendered = '';
    let currentSubCatRendered = '';
    let currentCatContainer = null;

    menuData.forEach(item => {
        // Render section title when category changes
        if (item.category !== currentCatRendered) {
            currentCatRendered = item.category;
            currentSubCatRendered = ''; // Reset sub-category on new category

            const isWaffle = currentCatRendered.toLowerCase().includes('waffle');
            
            const titleEl = document.createElement('div');
            titleEl.className = 'section-title' + (isWaffle ? '' : ' folded');
            titleEl.id = `section-${currentCatRendered.replace(/[^a-z0-9]/gi, '')}`;
            titleEl.innerHTML = `
                <span>${currentCatRendered}</span>
                <span class="chevron">▼</span>
            `;
            container.appendChild(titleEl);

            currentCatContainer = document.createElement('div');
            currentCatContainer.className = 'category-content' + (isWaffle ? '' : ' folded');
            container.appendChild(currentCatContainer);

            const targetContainer = currentCatContainer;

            // Toggle logic
            titleEl.onclick = () => {
                titleEl.classList.toggle('folded');
                targetContainer.classList.toggle('folded');
            };
        }

        // Render sub-section title if exists
        if (item.subCategory && item.subCategory !== currentSubCatRendered) {
            currentSubCatRendered = item.subCategory;
            const subTitleEl = document.createElement('div');
            subTitleEl.className = 'sub-section-title';
            subTitleEl.textContent = currentSubCatRendered;
            currentCatContainer.appendChild(subTitleEl);
        }

        const qty = getItemQty(item.id);

        const el = document.createElement('div');
        el.className = 'menu-card';
        const iconSrc = getCategoryIcon(item.category);
        const imgHtml = `<img src="${iconSrc}" alt="${item.category}" class="menu-item-img menu-item-icon">`;
        el.innerHTML = `
            ${imgHtml}
            <div class="menu-card-content">
                <div class="item-info">
                    <div class="item-name">${item.name}</div>
                    ${!item.subCategory && item.desc ? `<div class="item-desc">${item.desc}</div>` : ''}
                </div>
                <div class="item-bottom">
                    <div class="item-price">${item.priceStr}</div>
                    <button id="add-btn-${item.id}" class="add-btn ${qty > 0 ? 'active-qty' : ''}" onclick="addToTray('${item.id}', event)">
                        ${qty > 0 ? `${qty} <span style="font-size:1.1rem; opacity:0.8;">+</span>` : '+'}
                    </button>
                </div>
            </div>
        `;
        currentCatContainer.appendChild(el);
    });
}

let currentAddonItem = null;

function getItemQty(baseId) {
    let qty = 0;
    Object.values(tray).forEach(cartItem => {
        if (cartItem.baseId === baseId) {
            qty += cartItem.qty;
        }
    });
    return qty;
}

function updateMenuQuantities() {
    menuData.forEach(item => {
        const qty = getItemQty(item.id);
        const btn = document.getElementById(`add-btn-${item.id}`);
        if (btn) {
            // Button is active if qty is visually pulsing or simply set
            if (qty > 0) {
                btn.innerHTML = `${qty} <span style="font-size:1.1rem; opacity:0.8;">+</span>`;
                btn.classList.add('active-qty');

                // Pop animation on update
                btn.style.transform = 'scale(1.15)';
                setTimeout(() => btn.style.transform = 'scale(1)', 200);
            } else {
                btn.innerHTML = '+';
                btn.classList.remove('active-qty');
            }
        }
    });
}

function addToTray(id, event) {
    const item = menuData.find(i => i.id === id);

    // If it has modifiers, open the customization modal
    if (item.modifiers && item.modifiers.length > 0) {
        openAddonModal(item);
        return;
    }

    addConfiguredItemToTray(id, []);
}

// imageMap is intentionally empty — no proprietary product photos are used
const imageMap = {};

// Returns a generic category icon path for display on menu cards
function getCategoryIcon(category) {
    if (!category) return '';
    const cat = category.toLowerCase();
    if (cat.includes('waffle')) return 'images/generic_waffle.svg';
    return 'images/generic_drink.svg'; // default for all drink categories
}

const layerZIndex = {
    "Extra Sauce (Chocolate)": 2,
    "Extra Sauce (Matcha)": 2,
    "Extra Fresh Fruits": 3,
    "Ice Cream Scoop (Vanilla)": 4,
    "Ice Cream Scoop (Matcha)": 4
};

function openAddonModal(item) {
    currentAddonItem = item;
    const modal = document.getElementById('addon-modal');
    document.getElementById('addon-item-name').textContent = item.name;
    document.getElementById('addon-item-desc').textContent = item.desc;

    const list = document.getElementById('addon-list');
    list.innerHTML = '';

    // VISUAL BUILDER LOGIC
    const builderContainer = document.getElementById('visual-builder-container');
    const visualBuilder = document.getElementById('visual-builder');
    visualBuilder.innerHTML = '';

    if (imageMap[item.name]) {
        builderContainer.classList.remove('hidden');
        // Add Base Layer
        const baseImg = document.createElement('img');
        baseImg.src = imageMap[item.name];
        baseImg.className = 'builder-layer base-layer active';
        baseImg.style.zIndex = 1;
        visualBuilder.appendChild(baseImg);
    } else {
        builderContainer.classList.add('hidden');
    }

    item.modifiers.forEach((mod, idx) => {
        let layerClass = '';
        
        // If it has an image map, inject it into visual builder but hidden
        if (imageMap[item.name] && imageMap[mod.name]) {
            const modImg = document.createElement('img');
            modImg.src = imageMap[mod.name];

            if (mod.name === "Ice Cream Scoop (Vanilla)" || mod.name === "Ice-cream Scoop (Vanilla)") {
                layerClass = ' mod-vanilla';
            } else if (mod.name === "Ice Cream Scoop (Matcha)" || mod.name === "Ice-cream Scoop (Matcha)") {
                layerClass = ' mod-matcha-icecream';
            } else if (mod.name === "Extra Sauce (Chocolate)") {
                layerClass = ' mod-choc-sauce';
            } else if (mod.name === "Extra Sauce (Matcha)") {
                layerClass = ' mod-matcha-sauce';
            } else if (mod.name.toLowerCase().includes("fruits")) {
                layerClass = ' layer-fruits';
            }

            modImg.className = 'builder-layer mod-layer-' + idx + layerClass;
            modImg.style.zIndex = layerZIndex[mod.name] || 5;
            visualBuilder.appendChild(modImg);
        }

        const row = document.createElement('label');
        row.className = 'modifier-row';
        row.innerHTML = `
            <div class="modifier-label">
                <input type="checkbox" class="modifier-checkbox" value="${idx}" onchange="updateAddonTotal()">
                ${mod.name}
            </div>
            <div class="modifier-price">+$${mod.price.toFixed(2)}</div>
        `;
        list.appendChild(row);
    });

    updateAddonTotal();
    modal.classList.remove('hidden');
    document.getElementById('addon-overlay').classList.remove('hidden');
}

function updateAddonTotal() {
    if (!currentAddonItem) return;
    let total = currentAddonItem.price;
    const checkboxes = document.querySelectorAll('.modifier-checkbox');

    checkboxes.forEach(cb => {
        const modLayer = document.querySelector('.mod-layer-' + cb.value);
        if (cb.checked) {
            total += currentAddonItem.modifiers[cb.value].price;
            if (modLayer) {
                modLayer.classList.add('active');
            }
        } else {
            if (modLayer) {
                modLayer.classList.remove('active');
            }
        }
    });
    document.getElementById('addon-total').textContent = total.toFixed(2);
}

function addConfiguredItemToTray(baseId, selectedMods) {
    // Generate unique cart item ID based on selected modifiers
    const modString = selectedMods.map(m => m.name).sort().join('|');
    const cartItemId = baseId + (modString ? '|' + modString : '');

    if (tray[cartItemId]) {
        tray[cartItemId].qty++;
    } else {
        tray[cartItemId] = {
            baseId: baseId,
            qty: 1,
            mods: selectedMods
        };
    }

    updateTrayCount();
    renderTrayItems();
    updateMenuQuantities();
}

function updateTray(cartItemId, delta) {
    if (!tray[cartItemId]) return;
    tray[cartItemId].qty += delta;
    if (tray[cartItemId].qty <= 0) delete tray[cartItemId];
    updateTrayCount();
    renderTrayItems();
    updateMenuQuantities();
}

function updateTrayCount() {
    const count = Object.values(tray).reduce((sum, item) => sum + item.qty, 0);
    const badge = document.getElementById('fab-count');
    const fab = document.getElementById('fab-tray');

    badge.textContent = count;

    if (count > 0) {
        fab.classList.remove('hidden');
        // Pop animation
        badge.classList.add('pop');
        setTimeout(() => badge.classList.remove('pop'), 300);
    } else {
        fab.classList.add('hidden');
        // Close modal if empty
        document.getElementById('tray-modal').classList.add('hidden');
        document.getElementById('modal-overlay').classList.add('hidden');
    }
}

function renderTrayItems() {
    const container = document.getElementById('tray-items');
    container.innerHTML = '';
    let total = 0;

    if (Object.keys(tray).length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:2rem;">Your list is empty.</p>';
        document.getElementById('tray-total').textContent = '0.00';
        return;
    }

    Object.keys(tray).forEach(cartItemId => {
        const cartItem = tray[cartItemId];
        const baseItem = menuData.find(i => i.id === cartItem.baseId);

        let unitPrice = baseItem.price;
        let modsHtml = '';
        if (cartItem.mods.length > 0) {
            cartItem.mods.forEach(m => {
                unitPrice += m.price;
                modsHtml += `<div style="font-size:0.85rem; color:var(--text-muted);">+ ${m.name}</div>`;
            });
        }

        total += unitPrice * cartItem.qty;

        const el = document.createElement('div');
        el.className = 'tray-item';
        el.innerHTML = `
            <div class="tray-item-info">
                <div class="tray-item-title">${baseItem.name}</div>
                ${modsHtml}
                <div class="tray-item-price">$${unitPrice.toFixed(2)}</div>
            </div>
            <div class="qty-controls">
                <button class="qty-btn" onclick="updateTray('${cartItemId.replace(/'/g, "\\'")}', -1)">-</button>
                <span style="font-weight:bold; width: 1.5rem; text-align:center;">${cartItem.qty}</span>
                <button class="qty-btn" onclick="updateTray('${cartItemId.replace(/'/g, "\\'")}', 1)">+</button>
            </div>
        `;
        container.appendChild(el);
    });

    document.getElementById('tray-total').textContent = total.toFixed(2);
}

function setupModal() {
    const modal = document.getElementById('tray-modal');
    const fabBtn = document.getElementById('fab-tray');
    const closeBtn = document.getElementById('close-modal');
    const overlay = document.getElementById('modal-overlay');

    fabBtn.onclick = () => {
        renderTrayItems();
        modal.classList.remove('hidden');
        overlay.classList.remove('hidden');
    };

    const closeModal = () => {
        modal.classList.add('hidden');
        overlay.classList.add('hidden');
    };
    closeBtn.onclick = closeModal;
    overlay.onclick = closeModal;

    setupAddonModal();
}

function setupAddonModal() {
    const modal = document.getElementById('addon-modal');
    const closeBtn = document.getElementById('close-addon');
    const overlay = document.getElementById('addon-overlay');
    const addBtn = document.getElementById('addon-add-btn');

    const closeAddon = () => {
        modal.classList.add('hidden');
        overlay.classList.add('hidden');
        currentAddonItem = null;
    };

    if (closeBtn) closeBtn.onclick = closeAddon;
    if (overlay) overlay.onclick = closeAddon;

    if (addBtn) {
        addBtn.onclick = () => {
            if (!currentAddonItem) return;
            const selectedMods = [];
            const checkboxes = document.querySelectorAll('.modifier-checkbox:checked');
            checkboxes.forEach(cb => {
                selectedMods.push(currentAddonItem.modifiers[cb.value]);
            });

            addConfiguredItemToTray(currentAddonItem.id, selectedMods);

            // visual feedback on Add button
            const oldHtml = addBtn.innerHTML;
            addBtn.innerHTML = '✓ Added';
            setTimeout(() => {
                addBtn.innerHTML = oldHtml;
                closeAddon();
            }, 400);
        };
    }
}
