// ===== VARIABEL GLOBAL =====
let myBalance = 50000;
let accountName = "Jirun";
let targetUser = "";
let selectedTarget = null;   // data target terpilih {id, name, displayName}
let lastSearchResults = [];  // hasil search terakhir
let searchTimeout;
let uploadedAvatarData = null;

// ===== MUAT SETTINGAN TERSIMPAN =====
try {
    const savedName = localStorage.getItem('rbx_name');
    const savedBalance = localStorage.getItem('rbx_balance_v2');
    const savedAvatar = localStorage.getItem('rbx_avatar');
    if (savedName) accountName = savedName;
    if (savedBalance && !isNaN(parseInt(savedBalance, 10))) myBalance = parseInt(savedBalance, 10);
    if (savedAvatar) {
        const img = document.getElementById('header-avatar');
        img.src = savedAvatar;
        img.style.display = 'block';
    }
} catch(e) {}

document.getElementById('header-username').innerText = accountName;
document.getElementById('avatar-initial').innerText = accountName.charAt(0).toUpperCase();

function formatNum(num) { return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

function updateBalances() {
    document.getElementById('nav-balance').innerText = formatNum(myBalance);
    document.getElementById('modal-balance').innerText = formatNum(myBalance);
}
updateBalances();

/* ============================================
   PENGATURAN
   ============================================ */
function openSettings() {
    document.getElementById('settings-name').value = accountName;
    document.getElementById('settings-balance').value = formatNum(myBalance);
    document.getElementById('settings-avatar-initial').innerText = accountName.charAt(0).toUpperCase();

    const headerImg = document.getElementById('header-avatar');
    const preview = document.getElementById('settings-avatar-preview');
    if (headerImg.style.display !== 'none' && headerImg.src) {
        preview.src = headerImg.src;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }

    uploadedAvatarData = null;
    document.getElementById('settings-modal').style.display = 'flex';
}

function closeSettings() {
    document.getElementById('settings-modal').style.display = 'none';
    uploadedAvatarData = null;
}

function previewAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        uploadedAvatarData = e.target.result;
        const preview = document.getElementById('settings-avatar-preview');
        preview.src = uploadedAvatarData;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function resetAvatar() {
    uploadedAvatarData = null;
    document.getElementById('settings-avatar-preview').src = "https://tr.rbxcdn.com/f9518844856f70c53d5a37f5b82a7a40/150/150/AvatarHeadshot/Png";
    document.getElementById('settings-avatar-preview').style.display = 'block';
    try { localStorage.removeItem('rbx_avatar'); } catch(e) {}
}

function saveSettings() {
    const newName = document.getElementById('settings-name').value.trim();
    if (newName) {
        accountName = newName;
        document.getElementById('header-username').innerText = accountName;
        document.getElementById('avatar-initial').innerText = accountName.charAt(0).toUpperCase();
    }

    const newBalance = parseInt(document.getElementById('settings-balance').value.replace(/,/g, ''), 10);
    if (!isNaN(newBalance) && newBalance >= 0) {
        myBalance = newBalance;
        updateBalances();
    }

    if (uploadedAvatarData) {
        const img = document.getElementById('header-avatar');
        img.src = uploadedAvatarData;
        img.style.display = 'block';
    }

    try {
        localStorage.setItem('rbx_name', accountName);
        localStorage.setItem('rbx_balance_v2', myBalance);
        if (uploadedAvatarData) localStorage.setItem('rbx_avatar', uploadedAvatarData);
    } catch(e) {}

    closeSettings();
}

document.getElementById('settings-balance').addEventListener('input', function() {
    let value = this.value.replace(/[^0-9]/g, '');
    if (value === '') { this.value = ''; return; }
    this.value = parseInt(value, 10).toLocaleString('en-US');
});

/* ============================================
   DETEKSI TARGET — METODE SEARCH ROBLOX
   ============================================ */
const amountInput = document.getElementById('amount-input');
const sendBtn = document.getElementById('send-btn');
const usernameInput = document.getElementById('username-input');
const suggestionsBox = document.getElementById('suggestions-box');
const searchStatus = document.getElementById('search-status');
const searchBtn = document.getElementById('search-btn');

// Ambil avatar untuk beberapa user sekaligus (batch)
async function fetchAvatarMap(userIds) {
    const map = {};
    if (!userIds.length) return map;
    const url = `https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${userIds.join(',')}&size=150x150&format=Png&isCircular=true`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.data) {
            data.data.forEach(d => { if (d.state === 'Completed') map[d.targetId] = d.imageUrl; });
        }
    } catch(e) {}
    return map;
}

// SEARCH USERS — metode yang sama dengan halaman search Roblox
async function searchUsers(keyword) {
    const proxyList = [
        'https://users.roproxy.com/v1/users/search?keyword=' + encodeURIComponent(keyword) + '&limit=10',
        'https://corsproxy.io/?' + encodeURIComponent('https://users.roblox.com/v1/users/search?keyword=' + encodeURIComponent(keyword) + '&limit=10')
    ];

    for (let proxyUrl of proxyList) {
        try {
            const res = await fetch(proxyUrl);
            const data = await res.json();
            if (data.data && data.data.length > 0) return data.data;
        } catch (e) {}
    }
    return [];
}

// Fallback: exact match via usernames/users
async function exactMatchUser(keyword) {
    const proxyList = [
        'https://users.roproxy.com/v1/usernames/users',
        'https://corsproxy.io/?https://users.roblox.com/v1/usernames/users'
    ];

    for (let proxyUrl of proxyList) {
        try {
            const res = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernames: [keyword], excludeBannedUsers: false })
            });
            const data = await res.json();
            if (data.data && data.data.length > 0) return data.data[0];
        } catch (e) {}
    }
    return null;
}

// Ambil data user langsung dari USER ID
async function getUserById(id) {
    const proxyList = [
        'https://users.roproxy.com/v1/users/' + id,
        'https://corsproxy.io/?' + encodeURIComponent('https://users.roblox.com/v1/users/' + id)
    ];
    for (let proxyUrl of proxyList) {
        try {
            const res = await fetch(proxyUrl);
            if (!res.ok) continue;
            const data = await res.json();
            if (data && data.id && data.name) {
                return { id: data.id, name: data.name, displayName: data.displayName || data.name };
            }
        } catch (e) {}
    }
    return null;
}

// Bersihkan input paste (@, spasi, link profil Roblox, user ID)
function parsePastedInput(raw) {
    let text = (raw || '').trim();

    // Link profil: roblox.com/users/123456/profile → ambil ID-nya
    const urlMatch = text.match(/roblox\.com\/users\/(\d+)/i);
    if (urlMatch) return { id: parseInt(urlMatch[1], 10), keyword: urlMatch[1] };

    // Angka murni 4+ digit → kemungkinan user ID
    if (/^\d{4,}$/.test(text)) return { id: parseInt(text, 10), keyword: text };

    // Username biasa — buang @ di depan & spasi
    return { keyword: text.replace(/^@+/, '').trim() };
}

// ===== Paste langsung → search langsung tanpa delay =====
usernameInput.addEventListener('paste', function() {
    setTimeout(() => handleInputSearch(true), 50);
});

// ===== Tekan Enter → langsung search =====
usernameInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleInputSearch(true);
    }
});

function hideSuggestions() {
    suggestionsBox.style.display = 'none';
    suggestionsBox.innerHTML = '';
}

// Tampilkan daftar saran users live (dengan avatar asli)
async function showSuggestions(results) {
    if (!results.length) { hideSuggestions(); return; }

    const avatarMap = await fetchAvatarMap(results.map(u => u.id));

    suggestionsBox.innerHTML = results.map(u => {
        const ava = avatarMap[u.id] || '';
        return `<div class="suggestion-item" onclick="pickSuggestion(${u.id}, '${u.name.replace(/'/g, "\\'")}', '${(u.displayName || u.name).replace(/'/g, "\\'")}', '${ava}')">
            <img src="${ava}" alt="" onerror="this.style.visibility='hidden'">
            <div class="suggestion-info">
                <div class="suggestion-name">${(u.displayName || u.name).replace(/</g, '&lt;')}</div>
                <div class="suggestion-username">@${u.name.replace(/</g, '&lt;')}</div>
            </div>
        </div>`;
    }).join('');

    suggestionsBox.style.display = 'block';
}

// Klik salah satu saran → langsung jadi target
function pickSuggestion(id, name, displayName, avatarUrl) {
    selectedTarget = { id: id, name: name, displayName: displayName };
    targetUser = name;
    usernameInput.value = name;
    hideSuggestions();
    searchStatus.innerText = "✓ " + displayName + " (@" + name + ")";
    searchStatus.style.color = "#00b06f";
    searchBtn.disabled = false;
}

// Live search saat mengetik / paste (immediate = true → tanpa delay)
function handleInputSearch(immediate) {
    const parsed = parsePastedInput(usernameInput.value);
    const input = parsed.keyword;

    clearTimeout(searchTimeout);
    searchBtn.disabled = true;
    selectedTarget = null;

    if (!input || input.length < 3) {
        searchStatus.innerText = "";
        hideSuggestions();
        return;
    }

    searchStatus.innerText = "Searching...";
    searchStatus.style.color = "var(--text-muted)";

    const doSearch = async () => {
        // 1) Kalau paste berisi user ID / link profil → ambil user langsung dari ID
        if (parsed.id) {
            const user = await getUserById(parsed.id);
            if (user) {
                selectedTarget = user;
                lastSearchResults = [user];
                usernameInput.value = user.name;
                showSuggestions([user]);
                searchStatus.innerText = "✓ " + user.displayName + " (@" + user.name + ")";
                searchStatus.style.color = "#00b06f";
                searchBtn.disabled = false;
                return;
            }
            // ID tidak ketemu → lanjut cari sebagai keyword di bawah
        }

        // 2) METODE UTAMA: search users (seperti roblox.com/id/search/users)
        const results = await searchUsers(input);
        lastSearchResults = results;

        if (results.length > 0) {
            showSuggestions(results);
            searchStatus.innerText = results.length + " user ditemukan — klik salah satu atau tekan Next";
            searchStatus.style.color = "var(--text-muted)";
            searchBtn.disabled = false;
        } else {
            // FALLBACK: exact match
            const exact = await exactMatchUser(input);
            if (exact) {
                selectedTarget = exact;
                searchStatus.innerText = "✓ " + (exact.displayName || exact.name) + " (@" + exact.name + ")";
                searchStatus.style.color = "#00b06f";
                searchBtn.disabled = false;
            } else {
                selectedTarget = { id: null, name: input, displayName: input };
                searchStatus.innerText = "⚠ User tidak ditemukan — Next untuk lanjut";
                searchStatus.style.color = "#e6a817";
                searchBtn.disabled = false;
            }
        }
    };

    if (immediate) doSearch();
    else searchTimeout = setTimeout(doSearch, 500);
}

/* ============================================
   MODAL SEND ROBUX
   ============================================ */
function showStep(stepId) {
    ['step-1', 'step-2', 'step-loading', 'step-3'].forEach(id => {
        document.getElementById(id).style.display = (id === stepId) ? 'block' : 'none';
    });
}

function openModal() {
    document.getElementById('modal').style.display = 'flex';
    usernameInput.value = '';
    searchStatus.innerText = '';
    searchBtn.disabled = true;
    selectedTarget = null;
    lastSearchResults = [];
    hideSuggestions();
    document.getElementById('real-avatar').style.display = 'none';
    document.getElementById('avatar-fallback').style.display = 'block';
    showStep('step-1');
}

function closeModal() { document.getElementById('modal').style.display = 'none'; }

// Tekan Next → konfirmasi target terpilih → lanjut ke jumlah
async function goToStep2() {
    const input = usernameInput.value.trim();

    if (!selectedTarget) {
        if (lastSearchResults.length > 0) {
            selectedTarget = lastSearchResults.find(u => u.name.toLowerCase() === input.toLowerCase()) || lastSearchResults[0];
        } else {
            selectedTarget = { id: null, name: input, displayName: input };
        }
    }

    targetUser = selectedTarget.name;

    // Tampilkan data target
    document.getElementById('display-name-text').innerText = selectedTarget.displayName || selectedTarget.name;
    document.getElementById('username-tag-text').innerText = "@" + selectedTarget.name;
    document.getElementById('real-avatar').style.display = 'none';
    document.getElementById('avatar-fallback').style.display = 'block';
    document.getElementById('avatar-fallback').innerText = selectedTarget.name.charAt(0).toUpperCase();

    // Ambil avatar asli via user ID (akurat)
    if (selectedTarget.id) {
        try {
            const res = await fetch(`https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${selectedTarget.id}&size=150x150&format=Png&isCircular=true`);
            const data = await res.json();
            if (data.data && data.data.length > 0 && data.data[0].state === 'Completed') {
                document.getElementById('real-avatar').src = data.data[0].imageUrl;
                document.getElementById('real-avatar').style.display = "block";
                document.getElementById('avatar-fallback').style.display = "none";
            }
        } catch(e) {}
    }

    // Jumlah mulai dari 0
    amountInput.value = '';
    clearPresetHighlight();
    updateSendBtnState();
    showStep('step-2');
}

// Format angka sambil diketik + status tombol kirim
amountInput.addEventListener('input', function() {
    let value = this.value.replace(/[^0-9]/g, '');
    if(value === '') { this.value = ''; updateSendBtnState(); clearPresetHighlight(); return; }
    this.value = parseInt(value, 10).toLocaleString('en-US');
    updateSendBtnState();
    clearPresetHighlight();
});

function getRawAmount() { return parseInt(amountInput.value.replace(/,/g, ''), 10) || 0; }

function updateSendBtnState() {
    const amount = getRawAmount();
    sendBtn.disabled = !(amount > 0 && amount <= myBalance);
}

function clearPresetHighlight() {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
}

function setAmount(val) {
    amountInput.value = formatNum(val);
    clearPresetHighlight();
    const btn = document.querySelector('.preset-btn[data-val="' + val + '"]');
    if (btn) btn.classList.add('selected');
    updateSendBtnState();
}

function sendRobux() {
    let amount = getRawAmount();
    if (isNaN(amount) || amount <= 0) return alert("Please enter a valid amount.");
    if (amount > myBalance) return alert("Not enough Robux!");

    document.getElementById('loading-text').innerHTML = "Sending " + formatNum(amount) + " Robux<br><span style='font-size:13px;color:var(--text-muted);font-weight:600;'>" + targetUser + "</span>";
    showStep('step-loading');

    setTimeout(() => {
        myBalance -= amount;
        updateBalances();
        try { localStorage.setItem('rbx_balance_v2', myBalance); } catch(e) {}
        document.getElementById('success-text').innerText = "Sent " + formatNum(amount) + " Robux to @" + targetUser;
        showStep('step-3');
    }, 1500);
}

// Tutup daftar saran kalau klik di luar
document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-wrap')) hideSuggestions();
});
