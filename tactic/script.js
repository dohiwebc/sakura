let currentMode = 'offense';
let layouts = { offense: {}, defense: {} };
let allPlayers = [];

const posConfig = {
    "内野アタッカー": { short: "AT", class: "pos-AT" },
    "内野守備":     { short: "DE", class: "pos-DE" },
    "カット":       { short: "PC", class: "pos-PC" },
    "外野":         { short: "OA", class: "pos-OA" }
};

function getRankData(total) {
    let rank = "C", rating = 0;
    if (total >= 1550) { rank = "SS"; rating = 101 + Math.floor((total - 1550) / 15); }
    else if (total >= 1400) { rank = "S"; rating = 91 + Math.floor((total - 1400) / 15); }
    else if (total >= 1150) { rank = "A"; rating = 81 + Math.floor((total - 1150) / 25); }
    else if (total >= 700) { rank = "B"; rating = 71 + Math.floor((total - 700) / 45); }
    else { rank = "C"; rating = Math.floor(total / 10); }
    return { rank, rating: Math.max(0, Math.min(110, rating)) };
}

function getTeamRank(totalScore, count) {
    if (count === 0) return { rank: "-", class: "rank-g" };
    
    let rank = "D";
    let cls = "rank-d";

    // 新しい判定基準（23項目合算・8人編成想定）
    if (totalScore >= 14000) { rank = "SSS"; cls = "rank-sss"; }
    else if (totalScore >= 13000) { rank = "SS"; cls = "rank-ss"; }
    else if (totalScore >= 12000) { rank = "S"; cls = "rank-s"; }
    else if (totalScore >= 10000) { rank = "A"; cls = "rank-a"; }
    else if (totalScore >= 8000) { rank = "B"; cls = "rank-b"; }
    else if (totalScore >= 5000) { rank = "C"; cls = "rank-c"; }
    else if (totalScore >= 1) { rank = "D"; cls = "rank-d"; }

    return { rank, class: cls };
}

window.onload = async () => {
    const { ref, onValue, get } = window.dbRefs;
    const db = window.db;

    onValue(ref(db, 'tactics/layouts'), (snapshot) => {
        const select = document.getElementById('tactic-list');
        const data = snapshot.val();
        select.innerHTML = '<option value="">-- 保存済みを選択 --</option>';
        if (data) Object.keys(data).forEach(name => {
            const opt = document.createElement('option');
            opt.value = name; opt.textContent = name;
            select.appendChild(opt);
        });
    });

    onValue(ref(db, 'players'), (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        allPlayers = Object.keys(data).map(key => {
            const p = data[key];
            if (key === "リセット" || p.deleted === true || typeof p !== 'object') return null;
            const s = p.scores || {};
            let total = 0;
            for (let k in s) { const v = parseFloat(s[k]); if (!isNaN(v)) total += v; }
            const rData = getRankData(total);
            const config = posConfig[String(p.mainPosition || "").trim()] || { short: "??", class: "" };
            return { id: key, name: p.name || key, totalScore: total, rankLabel: rData.rank + rData.rating, rankTextClass: `rank-text-${rData.rank}`, posClass: config.class, pos: config.short };
        }).filter(p => p !== null);
        renderAll();
    });
};

/**
 * 描画メイン処理（フォントサイズ調整ロジック含む）
 */
function renderAll() {
    const pool = document.getElementById('player-pool');
    const court = document.getElementById('court');
    const searchQuery = document.getElementById('player-search').value.toLowerCase();
    let totalScore = 0; let courtCount = 0;

    allPlayers.forEach(p => {
        const safeId = p.id.replace(/\s+/g, '');
        let card = document.getElementById(`p-${safeId}`);

        if (!card) {
            card = document.createElement('div');
            card.id = `p-${safeId}`;
            makeDraggable(card);
            card.ondblclick = () => { returnToBench(safeId); };
        }
        
        card.className = `player-card ${p.posClass}`;
        card.innerHTML = `
            <div class="card-rank-display ${p.rankTextClass}">${p.rankLabel}</div>
            <div class="card-pos">${p.pos}</div>
            <div class="card-name">${p.name}</div>
        `;

        // --- 名前のインパクト最大化ロジック ---
const nameEl = card.querySelector('.card-name');
const nameLen = p.name.length;

if (nameLen >= 5) {
    nameEl.style.fontSize = "13px";
    nameEl.style.transform = "scaleX(0.75)"; // 5文字はギュッと圧縮して塊にする
} else if (nameLen === 4) {
    nameEl.style.fontSize = "15px";
    nameEl.style.transform = "scaleX(0.85)";
} else {
    nameEl.style.fontSize = "18px"; // 3文字以下は圧倒的インパクト
    nameEl.style.transform = "scaleX(1)";
}
        // ------------------------------------------------

        const isMatch = p.name.toLowerCase().includes(searchQuery) || p.pos.toLowerCase().includes(searchQuery) || p.rankLabel.toLowerCase().includes(searchQuery);
        card.classList.toggle('filtered-out', !isMatch);

        if (card.getAttribute('data-dragging') === 'true') return;

        const thisPos = layouts[currentMode] && layouts[currentMode][safeId];

        if (thisPos) {
            if (card.parentElement !== court) court.appendChild(card);
            card.style.left = "0px"; card.style.top = "0px";
            card.style.transform = `translate3d(${thisPos.x}px, ${thisPos.y}px, 0)`;
            totalScore += p.totalScore; courtCount++;
        } else {
            if (card.parentElement !== pool) { card.style.transform = "none"; pool.appendChild(card); }
            else { pool.appendChild(card); }
        }
    });

    // --- ここから下を書き換え ---
    const cEl = document.getElementById('on-court-count');
    if (cEl) {
        cEl.textContent = courtCount;
        cEl.style.color = courtCount === 8 ? "#28a745" : (courtCount > 8 ? "#ff3e3e" : "#fff");
    }

    const sEl = document.getElementById('total-team-score');
    if (sEl) {
        // 23項目合計を表示（カンマ区切り）
        sEl.textContent = Math.floor(totalScore).toLocaleString();
    }

    // チームランクの判定と適用
    const tRank = getTeamRank(totalScore, courtCount);
    const rEl = document.getElementById('team-rank-display');
    
    if (rEl) {
        if (rEl.textContent !== tRank.rank) {
            rEl.textContent = tRank.rank;
            rEl.className = `team-rank ${tRank.class}`;
            
            // アニメーション発動（CSSで.animate-rankを定義している場合）
            rEl.classList.remove('animate-rank');
            void rEl.offsetWidth; 
            rEl.classList.add('animate-rank');
        }
    }
} // ← renderAll 関数の終わり

function returnToBench(safeId) {
    if (layouts[currentMode] && layouts[currentMode][safeId]) {
        delete layouts[currentMode][safeId];
        renderAll();
    }
}

function makeDraggable(el) {
    let startX, startY, initialX, initialY;
    let isFromBench = false;

    el.onmousedown = (e) => {
        if (e.button !== 0) return;
        const court = document.getElementById('court');
        const pool = document.getElementById('player-pool');
        const rect = el.getBoundingClientRect();
        const courtRect = court.getBoundingClientRect();
        
        isFromBench = (el.parentElement === pool);

        el.setAttribute('data-dragging', 'true');
        el.style.transition = "none";
        
        let curX = rect.left - courtRect.left;
        let curY = rect.top - courtRect.top;
        
        if (el.parentElement !== court) {
            el.style.left = "0px"; el.style.top = "0px";
            el.style.transform = `translate3d(${curX}px, ${curY}px, 0)`;
            court.appendChild(el);
        }
        
        startX = e.clientX; startY = e.clientY;
        initialX = curX; initialY = curY;

        const onMouseMove = (ev) => {
            el.style.transform = `translate3d(${initialX + ev.clientX - startX}px, ${initialY + ev.clientY - startY}px, 0)`;
        };

        const onMouseUp = (ev) => {
            el.removeAttribute('data-dragging');
            el.style.transition = "transform 0.5s cubic-bezier(0.2, 1, 0.2, 1)";
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            const fR = el.getBoundingClientRect();
            const cR = court.getBoundingClientRect();
            const myId = el.id.replace('p-', '');

            const centerX = fR.left + fR.width / 2;
            const centerY = fR.top + fR.height / 2;

            if (centerX > cR.left && centerX < cR.right && centerY > cR.top && centerY < cR.bottom) {
                const dropX = fR.left - cR.left;
                const dropY = fR.top - cR.top;

                if (!layouts[currentMode]) layouts[currentMode] = {};

                let targetId = null;
                Object.keys(layouts[currentMode]).forEach(otherId => {
                    if (otherId === myId) return;
                    const otherPos = layouts[currentMode][otherId];
                    const dist = Math.sqrt(Math.pow(otherPos.x - dropX, 2) + Math.pow(otherPos.y - dropY, 2));
                    if (dist < 45) { targetId = otherId; }
                });

                if (targetId) {
                    if (isFromBench) {
                        delete layouts[currentMode][targetId];
                        layouts[currentMode][myId] = { x: dropX, y: dropY };
                    } else {
                        const oldPosOfMe = { x: initialX, y: initialY };
                        const oldPosOfTarget = { x: layouts[currentMode][targetId].x, y: layouts[currentMode][targetId].y };
                        layouts[currentMode][myId] = oldPosOfTarget;
                        layouts[currentMode][targetId] = oldPosOfMe;
                    }
                } else {
                    layouts[currentMode][myId] = { x: dropX, y: dropY };
                }
            } else {
                if (layouts[currentMode]) delete layouts[currentMode][myId];
            }
            renderAll();
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
}

async function saveLayout() {
    const name = document.getElementById('tactic-name').value.trim();
    if (!name) return alert("陣形名を入力してください");
    await window.dbRefs.set(window.dbRefs.ref(window.db, `tactics/layouts/${name}`), layouts);
    alert(`陣形「${name}」を保存しました！`);
    document.getElementById('tactic-name').value = "";
}

async function loadSelectedLayout() {
    const name = document.getElementById('tactic-list').value;
    if (!name) return alert("陣形を選択してください");
    const snap = await window.dbRefs.get(window.dbRefs.ref(window.db, `tactics/layouts/${name}`));
    if (snap.exists()) {
        layouts = { offense: {}, defense: {} };
        layouts = snap.val();
        renderAll();
        alert(`陣形「${name}」を読み込みました！`);
    }
}

function deleteSelectedLayout() {
    const name = document.getElementById('tactic-list').value;
    if (!name) return alert("削除する陣形を選択してください");
    if (confirm(`「${name}」を削除しますか？`) && confirm(`本当に削除しますか？`)) {
        window.dbRefs.set(window.dbRefs.ref(window.db, `tactics/layouts/${name}`), null);
        layouts[currentMode] = {};
        renderAll();
        document.getElementById('tactic-list').value = "";
    }
}

function resetCurrentLayout() {
    if (confirm("現在の配置をリセットしますか？")) {
        layouts[currentMode] = {};
        renderAll();
    }
}

function switchMode(mode) {
    currentMode = mode;
    document.getElementById('btn-offense').classList.toggle('active', mode === 'offense');
    document.getElementById('btn-defense').classList.toggle('active', mode === 'defense');
    renderAll();
}

function sortPlayers(type) {
    if (type === 'rank') allPlayers.sort((a, b) => b.totalScore - a.totalScore);
    else if (type === 'pos') {
        const order = { "AT": 1, "DE": 2, "PC": 3, "OA": 4, "??": 5 };
        allPlayers.sort((a, b) => (order[a.pos] - order[b.pos]) || (b.totalScore - a.totalScore));
    }
    renderAll();
}

// モード切替（攻撃・守備）
window.switchMode = function(mode) {
    currentMode = mode;
    document.getElementById('btn-offense').classList.toggle('active', mode === 'offense');
    document.getElementById('btn-defense').classList.toggle('active', mode === 'defense');
    
    // 切り替えた瞬間に再描画することで、transition（アニメーション）が発動する
    renderAll();
};

// 読み込み処理
window.loadSelectedLayout = async function() {
    const name = document.getElementById('tactic-list').value;
    if (!name) return alert("陣形を選択してください");
    const snap = await window.dbRefs.get(window.dbRefs.ref(window.db, `tactics/layouts/${name}`));
    
    if (snap.exists()) {
        layouts = snap.val();
        // データを流し込んだ直後に再描画
        renderAll();
        alert(`陣形「${name}」を読み込みました`);
    }
};

// renderAllの中の「座標更新」部分の確認
// transformを直接いじることで、CSSのtransitionが反応します。
if (card.getAttribute('data-dragging') !== 'true') {
    const thisPos = layouts[currentMode] && layouts[currentMode][safeId];
    if (thisPos) {
        if (card.parentElement !== court) court.appendChild(card);
        // translate3dを使うとGPU加速が効くため、アニメーションがより滑らかになります
        card.style.transform = `translate3d(${thisPos.x}px, ${thisPos.y}px, 0)`;
    } else {
        // ベンチに戻る時もアニメーションさせたい場合はここを調整
        if (card.parentElement !== pool) {
            card.style.transform = "translate3d(0, 0, 0)"; 
            pool.appendChild(card);
        }
    }
}

