/*
 * OMC Friends Pro Max - content.js
 *
 * Design:
 * - NEVER replace tbody.innerHTML (React owns those nodes)
 * - In normal mode: highlight friend rows, hide nothing
 * - In friends-only mode: hide ALL original rows (display:none), inject ALL friends sorted by rank
 * - Only re-inject when collectedFriends actually changes (prevent flicker)
 * - Use document-level MutationObserver to init without depending on focused tab
 */

'use strict';

let friendsOnlyMode = false;
let isFetching = false;
let isRendering = false;
let collectedFriends = {}; // { cleanName: { name, rank, rowHtml } }
let lastInjectedNames = ''; // serialised key to skip re-injection when nothing changed

// ── 1. Utils ─────────────────────────────────────────────────────────────

function clean(s) {
    return s ? s.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() : '';
}

function extractUsername(linkEl) {
    if (!linkEl) return '';
    const clone = linkEl.cloneNode(true);
    clone.querySelectorAll('.omc-s-btn').forEach(n => n.remove());
    return clean(clone.textContent);
}

async function getFriends() {
    try {
        if (!chrome.runtime?.id) return [];
        const res = await chrome.storage.local.get(['omc_friends']);
        return (res.omc_friends || []).map(f => clean(f));
    } catch { return []; }
}

function getContestId() {
    const m = location.pathname.match(/\/contests\/([^\/]+)/);
    return m ? m[1] : null;
}

// ── 2. Inject friends sorted by rank ─────────────────────────────────────

function fmtTime(seconds) {
    if (!seconds && seconds !== 0) return '-';
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}

// OMC uses CSS classes for rating colors on user links
function ratingLinkClass(rate) {
    if (!rate && rate !== 0) return 'user-link';
    if (rate >= 2800) return 'user-link user-link-red';
    if (rate >= 2400) return 'user-link user-link-orange';
    if (rate >= 2000) return 'user-link user-link-yellow';
    if (rate >= 1600) return 'user-link user-link-blue';
    if (rate >= 1200) return 'user-link user-link-cyan';
    if (rate >= 800) return 'user-link user-link-green';
    if (rate >= 400) return 'user-link user-link-brown';
    return 'user-link user-link-gray';
}

// OMC uses an SVG checkmark icon inside .standings-ac
const CHECK_SVG = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path fill="none" d="M0 0h24v24H0z"></path><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"></path></svg>`;

function buildRowHtml(f) {
    if (f.rowHtml) return f.rowHtml;
    // Friend found via API — build full row matching OMC's exact HTML structure
    const entry = f.apiEntry || {};
    const username = entry.user?.id || f.name;
    const rate = entry.user?.rate;
    const linkClass = ratingLinkClass(rate);
    const totalTime = fmtTime(entry.time);
    const tasks = entry.tasks || [];

    // Build per-problem cells using OMC's exact structure
    const taskCells = tasks.map(t => {
        if (!t.point) {
            return `<td><p>-</p></td>`;
        }
        const waClass = t.penalty > 0 ? ' table-danger' : '';
        const pen = t.penalty > 0 ? `<span class="standings-wa">+${t.penalty}</span>` : '';
        return `<td class="${waClass}"><p><span class="standings-ac">${CHECK_SVG}</span></p><p>${fmtTime(t.time)}${pen}</p></td>`;
    }).join('');

    return `<th>${f.rank}</th>
            <th><a href="/users/${username}" class="${linkClass}">${username}</a></th>
            <td><p><span class="standings-score">${entry.point ?? 0}</span></p><p>${totalTime}</p></td>
            ${taskCells}`;
}

function injectFriendRowsSorted() {
    if (!friendsOnlyMode) return;

    const sorted = Object.values(collectedFriends).sort((a, b) => a.rank - b.rank);
    const key = sorted.map(f => f.name + f.rank).join(',');

    const tbody = document.querySelector('#standings table tbody');
    if (!tbody) return;

    // Skip only if friends haven't changed AND the injected rows are still in the DOM.
    // If OMC's auto-reload wiped our rows, injectedCount will be 0 and we must re-inject.
    const injectedCount = tbody.querySelectorAll('.omc-injected').length;
    if (key === lastInjectedNames && injectedCount === sorted.length) return;
    lastInjectedNames = key;

    try {
        isRendering = true;
        tbody.querySelectorAll('.omc-injected').forEach(r => r.remove());
        sorted.forEach(f => {
            const tr = document.createElement('tr');
            tr.className = 'omc-injected';
            tr.style.cssText = 'background:rgba(241,196,15,0.1);border-left:5px solid #ffc107;';
            tr.innerHTML = buildRowHtml(f);
            tbody.appendChild(tr);
        });
    } finally {
        isRendering = false;
    }

    attachStars();
}


// ── 3. Filter / highlight current page ───────────────────────────────────

async function applyFilter() {
    if (isRendering) return;

    const friends = await getFriends();
    const rows = document.querySelectorAll('#standings table tbody tr');

    rows.forEach(row => {
        if (row.classList.contains('omc-injected')) return;

        const link = row.querySelector('a[href*="/users/"]');
        const isPureHeader = !link && row.querySelector('th');
        if (isPureHeader) return;

        if (link) {
            const name = extractUsername(link);
            const isFriend = friends.includes(name);

            if (friendsOnlyMode) {
                row.style.setProperty('display', 'none', 'important');
                // Collect friend data from current page
                if (isFriend && !collectedFriends[name]) {
                    collectedFriends[name] = {
                        name,
                        rank: parseInt(row.cells[0]?.innerText) || 9999,
                        rowHtml: row.innerHTML
                    };
                }
            } else {
                row.style.removeProperty('display');
                row.style.background = isFriend ? 'rgba(241,196,15,0.1)' : '';
                row.style.borderLeft = isFriend ? '5px solid #ffc107' : '';
            }
        } else {
            // Non-user rows
            if (friendsOnlyMode) {
                row.style.setProperty('display', 'none', 'important');
            } else {
                row.style.removeProperty('display');
            }
        }
    });

    if (friendsOnlyMode) injectFriendRowsSorted();
}

// ── 4. Stars ──────────────────────────────────────────────────────────────

async function attachStars() {
    if (!chrome.runtime?.id) return;
    let friends;
    try { friends = await getFriends(); } catch { return; }

    document.querySelectorAll('#standings a[href*="/users/"]').forEach(link => {
        const name = extractUsername(link);
        if (!name) return;
        const isF = friends.includes(name);

        // Avoid duplicating stars on injected copies
        if (link.querySelector('.omc-s-btn')) {
            const star = link.querySelector('.omc-s-btn');
            star.innerText = isF ? ' ⭐' : ' ☆';
            star.style.color = isF ? '#f1c40f' : '#ccc';
            return;
        }

        const star = document.createElement('span');
        star.className = 'omc-s-btn';
        star.style.cssText = 'cursor:pointer;margin-left:8px;font-weight:bold;';
        star.innerText = isF ? ' ⭐' : ' ☆';
        star.style.color = isF ? '#f1c40f' : '#ccc';
        star.onclick = async e => {
            e.preventDefault(); e.stopPropagation();
            if (!chrome.runtime?.id) return;
            try {
                const { omc_friends: list = [] } = await chrome.storage.local.get(['omc_friends']);
                const cleaned = list.map(f => clean(f));
                let newList;
                if (cleaned.includes(name)) {
                    newList = list.filter(f => clean(f) !== name);
                    delete collectedFriends[name];
                    lastInjectedNames = ''; // force re-injection
                } else {
                    newList = [...list, name];
                }
                await chrome.storage.local.set({ omc_friends: newList });
                await applyFilter();
                attachStars();
                if (friendsOnlyMode && !isFetching) startBackgroundFetch();
            } catch { /* context invalidated */ }
        };
        link.appendChild(star);
    });
}

// ── 5. Background fetch (single API call for all players) ─────────────────
// The OMC API returns ALL standings in one shot as JSON - no pagination needed.

async function startBackgroundFetch() {
    if (isFetching || !chrome.runtime?.id || !friendsOnlyMode) return;
    const contestId = getContestId();
    if (!contestId) return;

    isFetching = true;
    const friends = await getFriends();
    if (!friends.length) { isFetching = false; return; }

    let indicator = document.getElementById('omc-loading-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'omc-loading-indicator';
        indicator.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#007bff;color:#fff;padding:10px 15px;border-radius:5px;z-index:10000;font-family:sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.2);';
        document.body.appendChild(indicator);
    }
    indicator.innerText = 'Searching all pages for friends…';

    try {
        // One single API call returns ALL players (rated=0 → include unrated too)
        const r = await fetch(`/api/contests/${contestId}/standings?rated=0`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const entries = data.standings || [];

        let foundNew = false;
        entries.forEach(entry => {
            const username = entry.user?.id;
            if (!username) return;
            const name = clean(username);
            if (friends.includes(name) && !collectedFriends[name]) {
                // Build a minimal row HTML that looks natural in the table
                collectedFriends[name] = {
                    name,
                    rank: entry.rank || 9999,
                    // We store minimal info; the actual row HTML comes from the DOM when visible
                    rowHtml: null,
                    apiEntry: entry
                };
                foundNew = true;
            }
        });

        if (foundNew) {
            // Try to grab actual row HTML from the DOM for any friends we found
            enrichFromDom(friends);
            injectFriendRowsSorted();
        }
    } catch (e) {
        const ind = document.getElementById('omc-loading-indicator');
        if (ind) { ind.innerText = `Failed to search`; ind.style.background = '#dc3545'; setTimeout(() => ind.remove(), 3000); }
    } finally {
        isFetching = false;
    }

    const ind = document.getElementById('omc-loading-indicator');
    if (ind) {
        if (friendsOnlyMode) {
            ind.innerText = ` ${Object.keys(collectedFriends).length} friends found`;
            ind.style.background = '#28a745';
            setTimeout(() => ind.remove(), 3000);
        } else {
            ind.remove();
        }
    }
}

// Enrich collectedFriends with actual DOM row HTML for friends currently visible on page
function enrichFromDom(friends) {
    document.querySelectorAll('#standings table tbody tr').forEach(row => {
        if (row.classList.contains('omc-injected')) return;
        const link = row.querySelector('a[href*="/users/"]');
        if (!link) return;
        const name = extractUsername(link);
        if (friends.includes(name) && collectedFriends[name] && !collectedFriends[name].rowHtml) {
            collectedFriends[name].rowHtml = row.innerHTML;
        }
    });
}

// ── 6. Toggle UI ──────────────────────────────────────────────────────────

function createToggleUI() {
    if (document.getElementById('omc-friends-toggle')) return;
    const btn = document.createElement('button');
    btn.id = 'omc-friends-toggle';
    btn.innerText = 'Show friends only';
    btn.style.cssText = 'position:fixed;top:15px;left:50%;transform:translateX(-50%);z-index:10001;padding:10px 20px;background:#6c757d;color:#fff;border-radius:30px;border:none;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,.3);';
    btn.onclick = async () => {
        friendsOnlyMode = !friendsOnlyMode;
        if (friendsOnlyMode) {
            btn.innerText = 'Show all users';
            btn.style.background = '#007bff';
            collectedFriends = {};
            lastInjectedNames = '';
            isFetching = false;
            await applyFilter();
            startBackgroundFetch();
        } else {
            btn.innerText = 'Show friends only';
            btn.style.background = '#6c757d';
            location.reload();
        }
    };
    document.body.appendChild(btn);
}

// ── 7. Init with document-level MutationObserver ──────────────────────────
// Use a document observer to detect when #standings appears — this works
// even in background tabs (unlike throttled setTimeout polling).

let standingsObserver = null;
let debounceTimer;

function setupStandingsObserver() {
    standingsObserver = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            if (isRendering || !chrome.runtime?.id) return;
            try {
                await applyFilter();
                attachStars();
            } catch { /* context invalidated */ }
        }, 100);
    });
    standingsObserver.observe(
        document.querySelector('#standings'),
        { childList: true, subtree: true }
    );
}

function init() {
    const standings = document.querySelector('#standings');
    if (!standings) {
        // Wait for #standings to appear using a document-level observer
        // This is NOT throttled by Chrome in background tabs (unlike setTimeout)
        const waitObserver = new MutationObserver(() => {
            if (document.querySelector('#standings')) {
                waitObserver.disconnect();
                init();
            }
        });
        waitObserver.observe(document.body, { childList: true, subtree: true });
        return;
    }

    createToggleUI();
    setupStandingsObserver();
    applyFilter();
    attachStars();
}

// Start immediately when this script runs
if (document.body) {
    init();
} else {
    document.addEventListener('DOMContentLoaded', init);
}