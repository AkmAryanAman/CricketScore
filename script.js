// --- DATA PERSISTENCE HELPERS ---
function saveToStorage() {
    const data = { rawHistory, seriesData, pendingWin };
    localStorage.setItem('cricketMasterSave', JSON.stringify(data));
}

function loadFromStorage() {
    const saved = localStorage.getItem('cricketMasterSave');
    if (saved) {
        const parsed = JSON.parse(saved);
        rawHistory = parsed.rawHistory || [];
        seriesData = parsed.seriesData;
        pendingWin = parsed.pendingWin || false;
        return true;
    }
    return false;
}

let rawHistory = [];
let isNBActive = false;
let pendingWin = false;
let seriesData = {
    t1Name: "Team 1", t2Name: "Team 2", t1Wins: 0, t2Wins: 0, matchesPlayed: [],
    activeMatch: { inning1Runs: 0, inning1Balls: 0, inning1Overs: 0, currentInning: 1, isMatchOver: false, firstBatting: 1 }
};
let confirmModal;

window.onload = () => {
    confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    if (loadFromStorage()) {
        document.getElementById('setup-overlay').style.display = 'none';
        updateOverlayNames();
        calculateScore();
    }
};

function updateOverlayNames() {
    document.getElementById('next-bat-t1-btn').innerText = seriesData.t1Name;
    document.getElementById('next-bat-t2-btn').innerText = seriesData.t2Name;
}

function startSeries() {
    seriesData.t1Name = document.getElementById('t1-name-input').value || "Team 1";
    seriesData.t2Name = document.getElementById('t2-name-input').value || "Team 2";
    seriesData.activeMatch.firstBatting = parseInt(document.getElementById('first-bat-input').value);
    document.getElementById('setup-overlay').style.display = 'none';
    updateOverlayNames();
    saveToStorage(); 
    calculateScore();
}

function toggleNoBall() {
    isNBActive = !isNBActive;
    const btn = document.getElementById('nb-btn');
    const status = document.getElementById('nb-status');
    if(isNBActive) { btn.classList.add('nb-active'); status.style.display = 'block'; }
    else { btn.classList.remove('nb-active'); status.style.display = 'none'; }
}

function processInput(val) {
    if (seriesData.activeMatch.isMatchOver) return;
    if (isNBActive) { rawHistory.push({ type: 'NB', runs: val }); toggleNoBall(); }
    else { rawHistory.push(val); }
    
    calculateScore();
    saveToStorage(); 
}

function undoLast() {
    if (rawHistory.length > 0) {
        rawHistory.pop();
        seriesData.activeMatch.isMatchOver = false;
        pendingWin = false;
        calculateScore();
        saveToStorage();
    }
}

function showConfirmModal(type) {
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const btn = document.getElementById('modalConfirmBtn');
    const cBtn = document.getElementById('modalCancelBtn');
    cBtn.style.display = "inline-block";
    if (type === 'endInning') {
        title.innerText = "Manual Finish";
        body.innerText = "Finish this inning now?";
        btn.onclick = () => { endInning(); confirmModal.hide(); };
    } else if (type === 'resetSeries') {
        title.innerText = "Reset Portal";
        body.innerText = "Delete all series data permanently?";
        btn.onclick = () => { localStorage.clear(); location.reload(); };
    }
    confirmModal.show();
}

function endInning() {
    let match = seriesData.activeMatch;
    if (match.currentInning === 1) {
        const stats = getCurrentStats();
        match.inning1Runs = stats.totalRuns;
        match.inning1Balls = stats.totalBalls;
        match.inning1Overs = parseFloat(`${Math.floor(stats.totalBalls / 6)}.${stats.totalBalls % 6}`);
        match.currentInning = 2;
        rawHistory = [];
        calculateScore();
        saveToStorage();
    } else {
        pendingWin = true;
        announceWinner();
    }
}

function announceWinner() {
    const i1 = seriesData.activeMatch.inning1Runs;
    const i2 = getCurrentStats().totalRuns;
    let winnerStr = "";
    const t1 = seriesData.t1Name; const t2 = seriesData.t2Name;
    const batFirstId = seriesData.activeMatch.firstBatting;
    
    const team1Info = { name: (batFirstId === 1 ? t1 : t2), score: i1 };
    const team2Info = { name: (batFirstId === 1 ? t2 : t1), score: i2 };

    if (i2 > i1) winnerStr = team2Info.name;
    else if (i1 > i2) winnerStr = team1Info.name;
    else winnerStr = "Tie";

    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    document.getElementById('modalTitle').innerText = "Match Result";
    document.getElementById('modalBody').innerHTML = `
        <h2 class="text-success">${winnerStr === 'Tie' ? "Match Draw!" : winnerStr + " Wins!"}</h2>
        <hr><p>${team1Info.name}: <strong>${team1Info.score}</strong><br>${team2Info.name}: <strong>${team2Info.score}</strong></p>`;
    
    document.getElementById('modalConfirmBtn').innerText = "Finalize Match";
    document.getElementById('modalConfirmBtn').onclick = () => {
        if (winnerStr === t1) seriesData.t1Wins++;
        else if (winnerStr === t2) seriesData.t2Wins++;
        
        seriesData.matchesPlayed.push({
            winner: winnerStr,
            team1: team1Info.name, team1Score: team1Info.score,
            team2: team2Info.name, team2Score: team2Info.score
        });
        
        confirmModal.hide();
        document.getElementById('next-match-overlay').style.display = 'flex';
        saveToStorage();
    };
    confirmModal.show();
}

function prepareNextMatch(battingFirstId) {
    seriesData.activeMatch = { 
        inning1Runs: 0, inning1Balls: 0, inning1Overs: 0, 
        currentInning: 1, isMatchOver: false, 
        firstBatting: battingFirstId 
    };
    rawHistory = []; pendingWin = false;
    document.getElementById('next-match-overlay').style.display = 'none';
    calculateScore();
    saveToStorage();
}

function getCurrentStats() {
    let totalRuns = 0, wickets = 0, totalBalls = 0, historyLog = [];
    rawHistory.forEach((input) => {
        let ballLabel = `${Math.floor(totalBalls / 6)}.${(totalBalls % 6) + 1}`;
        let desc = "";
        if (typeof input === 'number') { totalRuns += input; totalBalls++; desc = `${input} Run(s)`; }
        else if (input === 'WD') { totalRuns += 1; desc = "Wide"; }
        else if (input === 'W') { wickets++; totalBalls++; desc = "Wicket"; }
        else if (typeof input === 'object' && input.type === 'NB') {
            let r = (typeof input.runs === 'number') ? input.runs : 0;
            totalRuns += r; desc = `NB (+${r})`;
        }
        historyLog.push({ ball: ballLabel, desc, score: `${totalRuns}/${wickets}` });
    });
    return { totalRuns, wickets, totalBalls, historyLog };
}

function calculateScore() {
    const stats = getCurrentStats();
    const match = seriesData.activeMatch;
    const t1 = seriesData.t1Name; const t2 = seriesData.t2Name;
    const batFirstId = match.firstBatting;
    const battingTeam = (match.currentInning === 1) ? (batFirstId === 1 ? t1 : t2) : (batFirstId === 1 ? t2 : t1);
    
    document.getElementById('current-batting-name').innerText = battingTeam;
    document.getElementById('score-text').innerText = `${stats.totalRuns} - ${stats.wickets}`;
    document.getElementById('over-text').innerText = `Overs: ${Math.floor(stats.totalBalls / 6)}.${stats.totalBalls % 6}`;
    document.getElementById('series-display').innerText = `${t1} ${seriesData.t1Wins} - ${seriesData.t2Wins} ${t2}`;

    if (match.currentInning === 2) {
        const target = match.inning1Runs + 1;
        document.getElementById('target-display').innerText = `Target: ${target} (Max: ${match.inning1Overs} ovs)`;
        if ((stats.totalRuns >= target || stats.wickets >= 10 || stats.totalBalls >= match.inning1Balls) && !match.isMatchOver && !pendingWin) {
            pendingWin = true; setTimeout(announceWinner, 500);
        }
    } else { document.getElementById('target-display').innerText = ""; }

    document.getElementById('series-log').innerHTML = seriesData.matchesPlayed.map((m, i) => `
        <div class="match-card">
            <div class="fw-bold text-dark">Match #${i+1}: ${m.winner === 'Tie' ? "Draw" : m.winner + " Won"}</div>
            <div class="d-flex justify-content-between mt-1">
                <span>${m.team1}: <strong>${m.team1Score}</strong></span>
                <span>${m.team2}: <strong>${m.team2Score}</strong></span>
            </div>
        </div>
    `).join('') || "No series history yet.";

    document.getElementById('history-list').innerHTML = stats.historyLog.reverse().map(e => `<div class="card p-2 mb-1 shadow-sm border-start border-success border-4">Ball ${e.ball}: <strong>${e.desc}</strong> <span class="float-end text-muted small">${e.score}</span></div>`).join('');
    document.querySelectorAll('.input-control').forEach(b => b.disabled = match.isMatchOver);
}