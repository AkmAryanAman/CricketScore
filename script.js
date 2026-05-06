let rawHistory = [], isNBActive = false, pendingWin = false;
let resultModal, inningModal, confirmModal, matchSetupModal; // Bootstrap Modal Instances

let seriesData = {
    t1Name: "Team 1", t2Name: "Team 2", t1Wins: 0, t2Wins: 0, 
    oversLimit: 5, playersLimit: 11, matchesPlayed: [],
    activeMatch: { inning1Runs: 0, currentInning: 1, isMatchOver: false, firstBatting: 1 }
};

const save = () => localStorage.setItem('cricketMasterSave', JSON.stringify({ rawHistory, seriesData, pendingWin }));

window.onload = () => {
    // Initialize all Bootstrap Modals
    resultModal = new bootstrap.Modal(document.getElementById('resultModal'));
    inningModal = new bootstrap.Modal(document.getElementById('inningModal'));
    confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    matchSetupModal = new bootstrap.Modal(document.getElementById('matchSetupModal'));
    
    const saved = localStorage.getItem('cricketMasterSave');
    if (saved) {
        const parsed = JSON.parse(saved);
        rawHistory = parsed.rawHistory || [];
        seriesData = parsed.seriesData;
        pendingWin = parsed.pendingWin || false;
        document.getElementById('setup-overlay').style.display = 'none';
        updateOverlayNames();
        calculateScore();
    }
};

function resetSeries() {
    const bodyText = document.getElementById('confirmBodyText');
    const confirmBtn = document.getElementById('globalConfirmBtn');
    const header = document.getElementById('confirmHeader');

    header.className = "modal-header border-0 bg-danger text-white justify-content-center";
    bodyText.innerText = "Are you sure you want to wipe all series data and restart?";
    
    confirmBtn.onclick = () => {
        localStorage.clear();
        location.reload();
    };
    
    confirmModal.show();
}

function updateOverlayNames() {
    document.getElementById('next-bat-t1-btn').innerText = seriesData.t1Name;
    document.getElementById('next-bat-t2-btn').innerText = seriesData.t2Name;
}

function startSeries() {
    seriesData.t1Name = document.getElementById('t1-name-input').value || "Team 1";
    seriesData.t2Name = document.getElementById('t2-name-input').value || "Team 2";
    seriesData.oversLimit = parseInt(document.getElementById('overs-limit-input').value) || 5;
    seriesData.playersLimit = parseInt(document.getElementById('players-limit-input').value) || 11;
    seriesData.activeMatch.firstBatting = parseInt(document.getElementById('first-bat-input').value);
    
    document.getElementById('setup-overlay').style.display = 'none';
    updateOverlayNames();
    save();
    calculateScore();
}

function toggleNoBall() {
    isNBActive = !isNBActive;
    document.getElementById('nb-btn').classList.toggle('nb-active', isNBActive);
    document.getElementById('nb-status').style.display = isNBActive ? 'block' : 'none';
}

function processInput(val) {
    if (pendingWin || seriesData.activeMatch.isMatchOver) return;
    rawHistory.push(isNBActive ? { type: 'NB', runs: val } : val);
    if (isNBActive) toggleNoBall();
    calculateScore();
    save();
}

function undoLast() {
    if (rawHistory.length > 0) {
        rawHistory.pop();
        pendingWin = false; // Important: unlock input on undo
        seriesData.activeMatch.isMatchOver = false;
        calculateScore();
        save();
    }
}

function resetSeries() {
    if(confirm("Wipe all data and restart?")) {
        localStorage.clear();
        location.reload();
    }
}

// 1ST INNING ENDS -> SHOW POPUP
function triggerInningSwitchPopup() {
    const stats = getCurrentStats();
    const t1 = seriesData.t1Name, t2 = seriesData.t2Name, batId = seriesData.activeMatch.firstBatting;
    const teamName = (batId === 1 ? t1 : t2);
    
    document.getElementById('inningModalText').innerHTML = `<b>${teamName}</b> finished at <b>${stats.runs}/${stats.wickets}</b>.`;
    inningModal.show();
}

// USER CONFIRMS -> START 2ND INNING (THE FIX IS HERE)
function confirmInningSwitch() {
    const stats = getCurrentStats();
    seriesData.activeMatch.inning1Runs = stats.runs;
    seriesData.activeMatch.currentInning = 2;
    rawHistory = [];
    pendingWin = false;
    inningModal.hide();
    save();
    calculateScore();
}

function announceWinner() {
    const i1 = seriesData.activeMatch.inning1Runs;
    const i2 = getCurrentStats().runs;
    const t1 = seriesData.t1Name, t2 = seriesData.t2Name, batId = seriesData.activeMatch.firstBatting;
    const name1 = (batId === 1 ? t1 : t2), name2 = (batId === 1 ? t2 : t1);
    
    let winStr = (i2 > i1) ? name2 : ((i1 > i2) ? name1 : "Tie");

    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    
    document.getElementById('modalBody').innerHTML = `
        <h1 class="text-primary fw-bold mb-0">${winStr === 'Tie' ? "DRAW!" : "WINNER!"}</h1>
        <h2 class="display-6 mt-0 mb-4">${winStr !== 'Tie' ? winStr : ""}</h2>
        <div class="d-flex justify-content-around bg-light p-3 rounded shadow-sm">
            <div><small class="text-muted">${name1}</small><br><b class="fs-4">${i1}</b></div>
            <div class="vr"></div>
            <div><small class="text-muted">${name2}</small><br><b class="fs-4">${i2}</b></div>
        </div>`;
    
    document.getElementById('modalConfirmBtn').onclick = () => {
        if (winStr !== 'Tie') {
            if (winStr === t1) seriesData.t1Wins++; else if (winStr === t2) seriesData.t2Wins++;
        }
        seriesData.matchesPlayed.push({ winner: winStr, t1: name1, s1: i1, t2: name2, s2: i2 });
        resultModal.hide();
        openMatchSetup(winStr);
        save();
    };
    resultModal.show();
}

function prepareNextMatch(batId) {
    seriesData.activeMatch = { inning1Runs: 0, currentInning: 1, isMatchOver: false, firstBatting: batId };
    rawHistory = [];
    pendingWin = false;
    document.getElementById('next-match-overlay').style.display = 'none';
    calculateScore();
    save();
}

function getCurrentStats() {
    let runs = 0, wickets = 0, balls = 0, log = [];
    rawHistory.forEach(input => {
        let ballEvent = "";
        let isIllegal = false;

        if (typeof input === 'number') {
            runs += input;
            balls++; 
            ballEvent = input === 0 ? "Dot Ball" : `${input} Run(s)`;
        } else if (input === 'WD') {
            runs += 1;
            ballEvent = "Wide";
            isIllegal = true;
        } else if (input === 'W') {
            wickets++;
            balls++; 
            ballEvent = "Wicket";
        } else if (input.type === 'NB') {
            let r = (typeof input.runs === 'number' ? input.runs : 0);
            runs += r;
            ballEvent = `No Ball (+${r})`;
            isIllegal = true;
        }

        // Fix: Logic to start from 0.1
        let overNum = Math.floor((balls - 1) / 6);
        let ballNum = ((balls - 1) % 6) + 1;

        log.push({
            ball: isIllegal ? "Extra" : `${overNum}.${ballNum}`,
            event: ballEvent,
            score: `${runs}/${wickets}`
        });
    });
    return { runs, wickets, balls, log };
}

function calculateScore() {
    const stats = getCurrentStats(), match = seriesData.activeMatch;
    const t1 = seriesData.t1Name, t2 = seriesData.t2Name, batId = match.firstBatting;
    const battingTeam = match.currentInning === 1 ? (batId === 1 ? t1 : t2) : (batId === 1 ? t2 : t1);

    // Scoreboard Updates
    document.getElementById('current-batting-name').innerText = battingTeam;
    document.getElementById('score-text').innerText = `${stats.runs} - ${stats.wickets}`;
    document.getElementById('over-text').innerText = `Overs: ${Math.floor(stats.balls/6)}.${stats.balls%6}`;
    document.getElementById('series-display').innerText = `${t1} ${seriesData.t1Wins} - ${seriesData.t2Wins} ${t2}`;
    document.getElementById('info-bar').innerText = `Overs Limit: ${seriesData.oversLimit} | P: ${seriesData.playersLimit}`;

    const targetDiv = document.getElementById('target-display');

    if (match.currentInning === 1 && !pendingWin) {
        targetDiv.style.display = "none";
        if (stats.balls >= (seriesData.oversLimit * 6) || stats.wickets >= (seriesData.playersLimit - 1)) {
            pendingWin = true; 
            triggerInningSwitchPopup();
        }
    } else if (match.currentInning === 2 && !pendingWin) {
        const target = match.inning1Runs + 1;
        targetDiv.style.display = "block";
        targetDiv.innerText = `TARGET: ${target}`;
        
        if (stats.runs >= target || stats.wickets >= (seriesData.playersLimit - 1) || stats.balls >= (seriesData.oversLimit * 6)) {
            pendingWin = true;
            announceWinner();
        }
    }

    // --- CLEAN HISTORY LOG (NO DUPLICATES) ---
    const seriesLog = document.getElementById('series-log');

    if (seriesData.matchesPlayed.length > 0) {
        seriesLog.innerHTML = seriesData.matchesPlayed.map((m, index) => {
            const isLatest = index === seriesData.matchesPlayed.length - 1;
            var isTie = false;
            if(m.winner !== 'Tie'){
                m.winner = m.winner + " Won";
                isTie = true;
            }
            return `
                <div class="p-3 bg-white border rounded shadow-sm mb-2" 
                     style="border-left: 5px solid ${isLatest ? '#27ae60' : '#2c3e50'} !important;">
                    <div class="d-flex justify-content-between align-items-center">
                        <span>
                            ${isLatest ? '<span class="badge bg-success mb-1">LATEST RESULT</span><br>' : ''}
                            <b>Match #${index + 1}</b>
                        </span>
                        <span class="${isTie ? 'text-success' : 'text-warning'} fw-bold">${m.winner}</span>
                    </div>
                    <div class="d-flex justify-content-between small text-muted mt-1">
                        <span>${m.t1}: <b>${m.s1}</b></span>
                        <span>vs</span>
                        <span>${m.t2}: <b>${m.s2}</b></span>
                    </div>
                </div>`;
        }).reverse().join('');
    } else {
        seriesLog.innerHTML = `<div class="text-muted text-center py-3">No matches played yet.</div>`;
    }

    // Ball Log Sidebar
    document.getElementById('history-list').innerHTML = stats.log.reverse().map(e => `
        <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-white m-2 rounded shadow-sm border-start border-primary border-4">
            <div><span class="text-muted small">Ball ${e.ball}</span><br><b>${e.event}</b></div>
            <span class="badge bg-primary px-3 py-2">${e.score}</span>
        </div>`).join('');
}

function openMatchSetup(lastWinner) {
    // Update button labels with team names[cite: 2]
    document.getElementById('setup-bat-t1').innerText = seriesData.t1Name;
    document.getElementById('setup-bat-t2').innerText = seriesData.t2Name;
    
    // Set default overs to the series default[cite: 2]
    document.getElementById('next-overs-input').value = seriesData.oversLimit;
    
    // Note: You can optionally display the lastWinner name in the UI here if needed[cite: 2]
    matchSetupModal.show();
}

// New: Finalizes the overs and batting for the new match[cite: 2]
function finalizeNextMatch(batId) {
    const newOvers = parseInt(document.getElementById('next-overs-input').value);
    
    // Update overs for only this match if desired, or update series default[cite: 2]
    seriesData.oversLimit = newOvers; 
    
    seriesData.activeMatch = { 
        inning1Runs: 0, 
        currentInning: 1, 
        isMatchOver: false, 
        firstBatting: batId 
    };
    
    rawHistory = [];
    pendingWin = false;
    
    matchSetupModal.hide();
    save(); // Persist changes[cite: 2]
    calculateScore(); // Refresh UI[cite: 2]
}
