'use strict';

// ============================================================
//  TAÇA MANUEL ANDRÉ 2026 – Lógica da Aplicação
// ============================================================

const STORAGE_KEY = 'taca-manuel-andre-2026';
const AUTH_KEY    = 'tma-2026-auth';
const SALT        = 'egc:tma:2026:estela';

// Stroke Index predefinido - Estela Golf Club
const DEFAULT_SI = [13, 17, 1, 7, 4, 2, 11, 15, 12, 5, 16, 10, 14, 9, 3, 8, 18, 6];

// ════════════════════════════════════════════════════════════
//  CÁLCULO DE HCP DE JOGO (fórmula WHS oficial)
// ════════════════════════════════════════════════════════════
//  HCP Jogo = round(WHS × SR/113 + (CR − Par))  — capped a 36
//
//  Estela · Homens  · Amarelas  CR: 71,2  SR: 128  Par: 72
//  Estela · Senhoras· Vermelhas CR: 73,7  SR: 126  Par: 72

function calculateGameHandicap(whs, genero) {
    if (whs === null || whs === undefined || isNaN(whs)) return 0;
    const whsNum = parseFloat(whs);
    let ph;
    if (genero === 'F') {
        // Vermelhas: CR 73,7 / SR 126 / Par 72
        ph = Math.round(whsNum * (126 / 113) + (73.7 - 72));
    } else {
        // Amarelas: CR 71,2 / SR 128 / Par 72
        ph = Math.round(whsNum * (128 / 113) + (71.2 - 72));
    }
    return Math.min(ph, 36); // Máximo 36 neste torneio
}

// ════════════════════════════════════════════════════════════
//  ESTADO
// ════════════════════════════════════════════════════════════

let state = {
    players: [],
    teams: [],
    strokeIndex: [...DEFAULT_SI],
    gameResults: [],  // Array de resultados de jogos
    calendar: []      // Calendário editável de jogos
};

let authState = {
    currentUser: null,
    adminPassword: 'estela2026'  // Password fixo para admin
};

// ════════════════════════════════════════════════════════════
//  AUTENTICAÇÃO
// ════════════════════════════════════════════════════════════

function loadAuth() {
    try {
        const raw = localStorage.getItem(AUTH_KEY);
        if (raw) {
            const p = JSON.parse(raw);
            authState.currentUser = p.currentUser || null;
        }
    } catch (e) { console.error('loadAuth:', e); }
}

function saveAuth() {
    localStorage.setItem(AUTH_KEY, JSON.stringify(authState));
}

const isLoggedIn = () => !!authState.currentUser;
const isAdmin    = () => isLoggedIn();

function doLogin(username, password) {
    if (username === 'admin' && password === authState.adminPassword) {
        authState.currentUser = { username: 'admin', displayName: 'Administrador', role: 'admin' };
        saveAuth();
        return true;
    }
    return false;
}

function doLogout() {
    authState.currentUser = null;
    saveAuth();
    updateAuthUI();
    showToast('Sessão terminada.');
}

// ── UI Auth ──────────────────────────────────────────────────

function updateAuthUI() {
    const admin = isAdmin();

    // Nav
    document.getElementById('btnOpenLogin').classList.toggle('hidden', admin);
    document.getElementById('navUser').classList.toggle('hidden', !admin);
    if (admin) {
        document.getElementById('navUsername').textContent = authState.currentUser.displayName;
    }

    // Botões de adicionar: só para admin
    const addPlayerBtn = document.getElementById('btnShowPlayerForm');
    const addTeamBtn   = document.getElementById('btnShowTeamForm');
    addPlayerBtn.classList.toggle('hidden', !admin);
    addTeamBtn.classList.toggle('hidden', !admin);

    // Esconder formulários se logout
    if (!admin) {
        document.getElementById('playerForm').classList.add('hidden');
        document.getElementById('teamForm').classList.add('hidden');
    }

    // Secções admin-only
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !admin));

    // Re-render listas para actualizar botões editar/apagar
    renderPlayers();
    renderTeams();
}

// ── Modal Login ───────────────────────────────────────────────

function openLoginModal() {
    document.getElementById('loginModal').classList.remove('hidden');
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').classList.add('hidden');
    document.getElementById('loginError').textContent = '';
    setTimeout(() => document.getElementById('loginUsername').focus(), 50);
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.add('hidden');
}

function handleLogin(e) {
    e.preventDefault();
    const username  = document.getElementById('loginUsername').value.trim();
    const password  = document.getElementById('loginPassword').value;
    const errEl     = document.getElementById('loginError');
    const submitBtn = document.getElementById('btnLoginSubmit');

    errEl.classList.add('hidden');

    if (!username || !password) {
        errEl.textContent = 'Preencha o utilizador e a palavra-passe.';
        errEl.classList.remove('hidden');
        return;
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = 'A verificar…';

    try {
        const ok = doLogin(username, password);
        if (ok) {
            closeLoginModal();
            updateAuthUI();
            showToast(`Bem-vindo, ${authState.currentUser.displayName}!`);
        } else {
            errEl.textContent = 'Utilizador ou palavra-passe incorrectos.';
            errEl.classList.remove('hidden');
            document.getElementById('loginPassword').value = '';
            document.getElementById('loginPassword').focus();
        }
    } finally {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Entrar';
    }
}

// ── Modal Sincronização GitHub ────────────────────────────────

function openGithubSyncModal() {
    document.getElementById('githubSyncModal').classList.remove('hidden');
    document.getElementById('githubToken').value = localStorage.getItem('gh-token') || '';
    document.getElementById('githubSyncError').classList.add('hidden');
    document.getElementById('githubSyncError').textContent = '';
    setTimeout(() => document.getElementById('githubToken').focus(), 50);
}

function closeGithubSyncModal() {
    document.getElementById('githubSyncModal').classList.add('hidden');
}

async function handleGithubSync(e) {
    e.preventDefault();
    const token = document.getElementById('githubToken').value.trim();
    const errEl = document.getElementById('githubSyncError');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    errEl.classList.add('hidden');

    if (!token) {
        errEl.textContent = 'Introduza um GitHub Personal Access Token.';
        errEl.classList.remove('hidden');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'A sincronizar…';

    try {
        // Suporta tokens clássicos (ghp_) e fine-grained (github_pat_)
        // GitHub aceita tanto "token" como "Bearer" mas fine-grained requer "Bearer"
        const authHeader = `Bearer ${token}`;

        // Verificar se o token é válido
        const validRes = await fetch('https://api.github.com/user', {
            headers: { 
                'Authorization': authHeader,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!validRes.ok) {
            throw new Error('Token inválido ou expirado. Crie um novo em https://github.com/settings/tokens');
        }

        // Guardar token no localStorage
        localStorage.setItem('gh-token', token);

        // Sincronizar dados
        saveState();
        saveGameResults();
        saveCalendar();

        const dataToExport = {
            players: state.players,
            teams: state.teams,
            strokeIndex: state.strokeIndex,
            gameResults: state.gameResults,
            calendar: state.calendar
        };

        const content = JSON.stringify(dataToExport, null, 2);
        const encoded = btoa(unescape(encodeURIComponent(content))); // Base64 encode com UTF-8

        // GitHub API - actualizar ficheiro
        const repo = 'Omleite/taca-manuel-andre-2026';
        const filePath = 'data-backup.json';
        const branch = 'master';

        // Obter SHA do ficheiro atual - forçar sem cache
        let sha = null;
        const shaRes = await fetch(
            `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}&t=${Date.now()}`,
            {
                headers: { 
                    'Authorization': authHeader,
                    'Accept': 'application/vnd.github.v3+json',
                    'Cache-Control': 'no-cache'
                }
            }
        );

        if (shaRes.status === 200) {
            const shaData = await shaRes.json();
            sha = shaData.sha;
        } else if (shaRes.status === 404) {
            sha = null; // Ficheiro não existe, será criado
        } else {
            const shaErr = await shaRes.json().catch(() => ({}));
            throw new Error(`Erro ao obter SHA do ficheiro (${shaRes.status}): ${shaErr.message || ''}`);
        }

        // Preparar body do commit
        const body = {
            message: `Sincronizar dados: ${new Date().toLocaleString('pt-PT')}`,
            content: encoded,
            branch: branch
        };
        if (sha) body.sha = sha;

        // Fazer commit
        const commitRes = await fetch(
            `https://api.github.com/repos/${repo}/contents/${filePath}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify(body)
            }
        );

        if (!commitRes.ok) {
            const error = await commitRes.json().catch(() => ({}));
            let msg = error.message || 'Erro desconhecido';
            
            if (msg.includes('not accessible') || commitRes.status === 403) {
                throw new Error('Token sem permissões. Selecione "Contents: Read and write" ao criar o token.');
            }
            if (msg.includes('sha') || msg.includes('does not match')) {
                throw new Error('Conflito de versão. Tente novamente - o ficheiro foi alterado entretanto.');
            }
            
            throw new Error(`GitHub API (${commitRes.status}): ${msg}`);
        }

        closeGithubSyncModal();
        showToast('✅ Dados sincronizados com sucesso!');
    } catch (err) {
        errEl.textContent = `Erro: ${err.message}`;
        errEl.classList.remove('hidden');
        console.error('GitHub sync error:', err);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sincronizar';
    }
}

// ── Gestão de utilizadores (admin) ───────────────────────────

// (Gestão de users removida - apenas admin fixo)

// ════════════════════════════════════════════════════════════
//  PERSISTÊNCIA (dados do torneio)
// ════════════════════════════════════════════════════════════

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        state.players     = Array.isArray(parsed.players) ? parsed.players : [];
        state.teams       = Array.isArray(parsed.teams)   ? parsed.teams   : [];
        state.strokeIndex = Array.isArray(parsed.strokeIndex) && parsed.strokeIndex.length === 18
            ? parsed.strokeIndex : [...DEFAULT_SI];
    } catch (e) { console.error('Erro ao carregar dados:', e); }
}

async function loadDataBackup() {
    // Sempre tenta carregar o backup mais recente do servidor
    try {
        const response = await fetch('data-backup.json?t=' + Date.now()); // Cache busting
        if (!response.ok) return false;
        
        const data = await response.json();
        if (data.players && data.teams) {
            // Carregar dados do servidor
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            state.players = data.players;
            state.teams = data.teams;
            state.strokeIndex = data.strokeIndex || [...DEFAULT_SI];
            state.gameResults = data.gameResults || [];
            state.calendar = data.calendar || [];
            console.log('✓ Dados carregados do backup no servidor.');
            return true;
        }
    } catch (e) { console.error('✗ Erro ao carregar backup:', e); }
    return false;
}

function initializeTestData() {
    // Cria dados de teste se a aplicação estiver vazia
    if (state.players.length === 0) {
        // Dados das 18 equipas do torneio (Jacaré desistiu)
        const touramentTeams = [
            { name: 'CGGG', players: ['Charles Mc Donald (C)', 'Guy Xie', 'Gabriel Guerreiro', 'Gabriel Macedo'] },
            { name: 'Os Craques', players: ['Higino Moreira (C)', 'António Casanova', 'Franquelim Moreira', 'Paulo Cubal'] },
            { name: 'Os Golfinhos', players: ['José Luís Veloso (C)', 'Amílcar Neiva', 'Adelaide Figueiredo', 'Paulo Pereira'] },
            { name: 'Estela Birdies', players: ['Alberto Quintas', 'Filipe Quintas', 'Luís Amorim Teixeira (C)', 'Nuno Poiarez'] },
            { name: 'Piratas', players: ['Isaque Guimarães', 'Alexandre Melo', 'Tiago Rocha', 'Pedro Moutinho (C)'] },
            { name: 'Golfistas da Madrugada', players: ['Luís Costa (C)', 'Natália Pereira', 'José António Pereira', 'Isaque Guimarães Jr'] },
            { name: 'Green Legends', players: ['Adelino Caldeira', 'Moura Gonçalves', 'Vasco Costa', 'Jorge Aires (C)'] },
            { name: 'Masters', players: ['José Correia (C)', 'Carlos Corte-Real', 'José Vale', 'Filipe Costa'] },
            { name: 'EMJC', players: ['Elisabete Teles', 'Maria do Carmo', 'José Vila', 'Carlos Figueiredo da Silva (C)'] },
            { name: 'Red Hot Chilli Putters', players: ['Hélder Ferreira (C)', 'José Rui Rodrigues', 'Orlando Leite', 'José Santos'] },
            { name: 'Equipa Eleven', players: ['Manuel Rodrigues', 'Rui Feijóo', 'Manuel Rodrigues Jr (C)', 'Luís Perez'] },
            { name: 'School', players: ['Manuel Castro (C)', 'Afonso Poiarez', 'Edgar Gomes', 'André Von Hafe'] },
            { name: '4 no Buraco', players: ['Afonso Polery (C)', 'Tó Júlio Brito', 'Gabriel Guimarães'] },
            { name: 'Old Fashion Team', players: ['Carlos Silva Santos (C)', 'Manuel Pereira Mendes', 'Henrique Sampaio', 'José Eduardo Rocha Almeida'] },
            { name: 'MMLH', players: ['Martim Quintas (C)', 'Miguel Ramos', 'Lourenço Araújo', 'Henrique Araújo'] },
            { name: 'Os Últimos', players: ['Luís Paupério', 'Jorge Moura (C)', 'Manuel Rodrigues', 'Sérgio Lopes'] },
            { name: 'Birdies e Boggies', players: ['Luísa Carrilho (C)', 'Maria de Fátima Costa', 'Mário Paiva', 'David Angelis'] },
            { name: 'V.T.F.', players: ['José Nogueira (C)', 'Alberto Amaral', 'Jorge Martins', 'Ruben Santos'] }
        ];

        // Extrai todos os jogadores únicos
        const playerMap = new Map(); // nome -> id
        touramentTeams.forEach(team => {
            team.players.forEach(playerStr => {
                const cleanName = playerStr.replace(' (C)', '').trim();
                if (!playerMap.has(cleanName)) {
                    const playerId = genId();
                    playerMap.set(cleanName, playerId);
                    // Handicaps aleatórios entre -10 e 30
                    const hcpWhs = Math.floor(Math.random() * 40) - 10;
                    const hcpJogo = hcpWhs + Math.floor(Math.random() * 5);
                    state.players.push({
                        id: playerId,
                        name: cleanName,
                        handicapWhs: hcpWhs,
                        handicap: hcpJogo
                    });
                }
            });
        });

        // Cria as equipas
        state.teams = touramentTeams.map(team => {
            // Encontra o ID do capitão
            const captainName = team.players.find(p => p.includes('(C)'))?.replace(' (C)', '').trim();
            const captainId = captainName ? playerMap.get(captainName) : null;
            
            return {
                id: genId(),
                name: team.name,
                playerIds: team.players
                    .map(playerStr => playerStr.replace(' (C)', '').trim())
                    .map(cleanName => playerMap.get(cleanName))
                    .filter(id => id !== undefined),
                captainId: captainId
            };
        });

        saveState();
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ════════════════════════════════════════════════════════════
//  UTILITÁRIOS
// ════════════════════════════════════════════════════════════

function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getPlayer(id) {
    return state.players.find(p => p.id === id) || null;
}

function showToast(msg, type = 'success') {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2800);
}

// ════════════════════════════════════════════════════════════
//  NAVEGAÇÃO POR SEPARADORES
// ════════════════════════════════════════════════════════════

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${target}`).classList.add('active');
            if (target === 'calcular') refreshCalcSelects();
            if (target === 'config')   { renderSIGrids(); if (isAdmin()) renderUsers(); }
            if (target === 'grupos')   { renderGrupos(); }
            if (target === 'calendario') renderCalendario();
            if (target === 'classificacao') { 
                const val = document.getElementById('selRondaClass').value;
                renderClassificacao(val === 'total' ? 'total' : (parseInt(val, 10) || 1));
            }
        });
    });
}

// ════════════════════════════════════════════════════════════
//  JOGADORES
// ════════════════════════════════════════════════════════════

function renderPlayers() {
    const el = document.getElementById('playersList');
    if (!state.players.length) {
        el.innerHTML = `<div class="empty-state">
            <p>Nenhum jogador registado.</p>
            <p class="empty-hint">${isLoggedIn() ? 'Clique em "+ Adicionar Jogador" para começar.' : 'Entre com a sua conta para adicionar jogadores.'}</p>
        </div>`;
        return;
    }
    const sorted = [...state.players].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    el.innerHTML = sorted.map(p => `
        <div class="card player-card">
            <div class="player-info">
                <span class="player-name">${esc(p.name)}</span>
                <div class="player-genero">
                    <span class="player-gender-badge">${p.genero === 'M' ? '♂ Masculino' : p.genero === 'F' ? '♀ Feminino' : '—'}</span>
                </div>
                <div class="player-handicaps">
                    <span class="player-hcp">WHS: <strong>${p.handicapWhs !== undefined && p.handicapWhs !== null && p.handicapWhs !== '' ? parseFloat(p.handicapWhs).toFixed(1) : '—'}</strong></span>
                    <span class="player-hcp">Jogo: <strong>${p.handicap}</strong></span>
                </div>
            </div>
            ${isLoggedIn() ? `
            <div class="player-actions">
                <button class="btn btn-sm btn-ghost" onclick="openEditPlayer('${p.id}')">Editar</button>
                <button class="btn btn-sm btn-danger" onclick="deletePlayer('${p.id}')">✕</button>
            </div>` : ''}
        </div>
    `).join('');
}

function openAddPlayer() {
    if (!isLoggedIn()) { openLoginModal(); return; }
    document.getElementById('playerFormTitle').textContent = 'Novo Jogador';
    document.getElementById('inputPlayerName').value = '';
    document.getElementById('inputPlayerHcpWhs').value = '';
    document.getElementById('inputPlayerGenero').value = '';
    document.getElementById('playerEditId').value    = '';
    document.getElementById('displayPlayerHcp').textContent = '—';
    document.getElementById('playerForm').classList.remove('hidden');
    document.getElementById('inputPlayerName').focus();
}

function openEditPlayer(id) {
    if (!isLoggedIn()) { openLoginModal(); return; }
    const p = getPlayer(id);
    if (!p) return;
    document.getElementById('playerFormTitle').textContent = 'Editar Jogador';
    document.getElementById('inputPlayerName').value = p.name;
    document.getElementById('inputPlayerHcpWhs').value = p.handicapWhs || '';
    document.getElementById('inputPlayerGenero').value = p.genero || '';
    const calculatedHcp = calculateGameHandicap(p.handicapWhs, p.genero);
    document.getElementById('displayPlayerHcp').textContent = calculatedHcp !== 0 || p.handicapWhs == 0 ? calculatedHcp : '—';
    document.getElementById('inputPlayerGenero').value = p.genero || '';
    document.getElementById('playerEditId').value    = id;
    document.getElementById('playerForm').classList.remove('hidden');
    document.getElementById('inputPlayerName').focus();
}

function savePlayer() {
    if (!isLoggedIn()) { openLoginModal(); return; }
    const name      = document.getElementById('inputPlayerName').value.trim();
    const hcpWhsRaw = document.getElementById('inputPlayerHcpWhs').value;
    const genero    = document.getElementById('inputPlayerGenero').value;
    const hcpWhs    = parseFloat(hcpWhsRaw);
    const editId    = document.getElementById('playerEditId').value;

    if (!name)                            { showToast('Insira o nome do jogador.', 'error');              return; }
    if (hcpWhsRaw === '' || isNaN(hcpWhs))   { showToast('Insira o Handicap WHS válido.', 'error');       return; }
    if (!genero)                         { showToast('Selecione o gênero do jogador.', 'error');       return; }
    if (hcpWhs < -10 || hcpWhs > 54)     { showToast('Handicap WHS deve estar entre -10 e 54.', 'error'); return; }

    // Calcular HCP de Jogo automaticamente
    const hcpJogo = calculateGameHandicap(hcpWhs, genero);

    if (editId) {
        const p = getPlayer(editId);
        if (p) { p.name = name; p.handicapWhs = hcpWhs; p.handicap = hcpJogo; p.genero = genero; }
    } else {
        state.players.push({ id: genId(), name, handicapWhs: hcpWhs, handicap: hcpJogo, genero });
    }
    saveState();
    document.getElementById('playerForm').classList.add('hidden');
    renderPlayers();
    showToast(editId ? 'Jogador actualizado.' : 'Jogador adicionado.');
}

function deletePlayer(id) {
    if (!isLoggedIn()) return;
    if (!confirm('Remover este jogador? Será também removido das equipas.')) return;
    state.players = state.players.filter(p => p.id !== id);
    state.teams.forEach(t => { t.playerIds = (t.playerIds || []).filter(pid => pid !== id); });
    saveState();
    renderPlayers();
    renderTeams();
    showToast('Jogador removido.');
}

// ════════════════════════════════════════════════════════════
//  EQUIPAS
// ════════════════════════════════════════════════════════════

function renderTeams() {
    const el = document.getElementById('teamsList');
    if (!state.teams.length) {
        el.innerHTML = `<div class="empty-state">
            <p>Nenhuma equipa criada.</p>
            <p class="empty-hint">${isLoggedIn() ? 'Clique em "+ Nova Equipa" para criar uma equipa.' : 'Entre com a sua conta para criar equipas.'}</p>
        </div>`;
        return;
    }
    el.innerHTML = state.teams.map(t => {
        const allPlayers = (t.playerIds || []).map(pid => getPlayer(pid)).filter(Boolean);
        
        // Separa o capitão dos outros
        const captain = allPlayers.find(p => p.id === t.captainId);
        const otherPlayers = allPlayers.filter(p => p.id !== t.captainId);
        
        // Ordena os outros alfabeticamente
        otherPlayers.sort((a, b) => a.name.localeCompare(b.name, 'pt'));
        
        // Coloca o capitão primeiro
        const sortedPlayers = captain ? [captain, ...otherPlayers] : otherPlayers;
        
        const rows = sortedPlayers.length
            ? sortedPlayers.map(p => {
                const isCaptain = p.id === t.captainId;
                return `<li class="team-player-item ${isCaptain ? 'is-captain' : ''}">
                    <span class="name">${isCaptain ? '⭐ ' : ''}${esc(p.name)}</span>
                    <span class="hcp">HCP Campo ${p.handicap}</span>
                </li>`;
            }).join('')
            : '<li class="team-player-item"><span style="color:#9ca3af">Sem jogadores associados</span></li>';
        return `
            <div class="card team-card">
                <div class="team-card-header">
                    <span class="team-name">${esc(t.name)}</span>
                    ${isLoggedIn() ? `
                    <div class="team-actions">
                        <button class="btn btn-sm btn-ghost" onclick="openEditTeam('${t.id}')">Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteTeam('${t.id}')">✕</button>
                    </div>` : ''}
                </div>
                <ul class="team-players-list">${rows}</ul>
            </div>`;
    }).join('');
}

function openAddTeam() {
    if (!isLoggedIn()) { openLoginModal(); return; }
    if (!state.players.length) { showToast('Adicione jogadores antes de criar equipas.', 'warn'); return; }
    document.getElementById('teamFormTitle').textContent = 'Nova Equipa';
    document.getElementById('inputTeamName').value = '';
    document.getElementById('inputTeamCaptain').value = '';
    document.getElementById('teamEditId').value    = '';
    renderTeamPicker([], null);
    document.getElementById('teamForm').classList.remove('hidden');
}

function openEditTeam(id) {
    if (!isLoggedIn()) { openLoginModal(); return; }
    const t = state.teams.find(t => t.id === id);
    if (!t) return;
    document.getElementById('teamFormTitle').textContent = 'Editar Equipa';
    document.getElementById('inputTeamName').value = t.name;
    document.getElementById('inputTeamCaptain').value = t.captainId || '';
    document.getElementById('teamEditId').value    = id;
    renderTeamPicker(t.playerIds || [], t.captainId || null);
    document.getElementById('teamForm').classList.remove('hidden');
}

function renderTeamPicker(selected, captainId) {
    const editId = document.getElementById('teamEditId').value;
    const editingTeam = editId ? state.teams.find(t => t.id === editId) : null;
    
    // Jogadores que já estão em outras equipas (exceto a equipa que estamos a editar)
    const occupiedPlayerIds = new Set();
    state.teams.forEach(t => {
        if (!editingTeam || t.id !== editingTeam.id) {
            (t.playerIds || []).forEach(pid => occupiedPlayerIds.add(pid));
        }
    });
    
    // Renderizar select de capitão com todos os jogadores disponíveis
    const sorted = [...state.players].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    const captainSelect = document.getElementById('inputTeamCaptain');
    captainSelect.innerHTML = '<option value="">— Sem capitão —</option>' + sorted.map(p => 
        `<option value="${p.id}" ${captainId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`
    ).join('');
    
    // Renderizar picker de jogadores (apenas os não ocupados)
    const el = document.getElementById('teamPlayerPicker');
    el.innerHTML = sorted.map(p => {
        const isOccupied = occupiedPlayerIds.has(p.id);
        const isSelected = selected.includes(p.id);
        const isDisabled = isOccupied && !isSelected; // Desabilitar apenas se não estiver selecionado
        
        return `
            <label class="picker-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}">
                <input type="checkbox" value="${p.id}" ${isSelected ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
                <span>${esc(p.name)}</span>
                <span class="picker-hcp">HCP ${p.handicap}</span>
            </label>
        `;
    }).join('');
    
    updatePickerHint();
    el.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach(cb => {
        cb.addEventListener('change', e => {
            e.target.closest('.picker-item').classList.toggle('selected', e.target.checked);
            updatePickerHint();
        });
    });
}

function updatePickerHint() {
    const count = document.querySelectorAll('#teamPlayerPicker input:checked').length;
    const hint  = document.getElementById('pickerHint');
    hint.textContent = `${count}/4 jogadores seleccionados`;
    hint.style.color = count === 4 ? 'var(--green-ok)' : 'var(--txt-light)';
}

function getCheckedPlayerIds() {
    return [...document.querySelectorAll('#teamPlayerPicker input:checked')].map(cb => cb.value);
}

function saveTeam() {
    if (!isLoggedIn()) { openLoginModal(); return; }
    const name      = document.getElementById('inputTeamName').value.trim();
    const playerIds = getCheckedPlayerIds();
    const captainId = document.getElementById('inputTeamCaptain').value || null;
    const editId    = document.getElementById('teamEditId').value;
    
    if (!name)                   { showToast('Insira o nome da equipa.', 'error');                return; }
    if (playerIds.length !== 4)  { showToast('Seleccione exactamente 4 jogadores.', 'error');    return; }
    
    if (editId) {
        const t = state.teams.find(t => t.id === editId);
        if (t) { t.name = name; t.playerIds = playerIds; t.captainId = captainId; }
    } else {
        state.teams.push({ id: genId(), name, playerIds, captainId });
    }
    saveState();
    document.getElementById('teamForm').classList.add('hidden');
    renderTeams();
    showToast(editId ? 'Equipa actualizada.' : 'Equipa criada.');
}

function deleteTeam(id) {
    if (!isLoggedIn()) return;
    if (!confirm('Remover esta equipa?')) return;
    state.teams = state.teams.filter(t => t.id !== id);
    saveState();
    renderTeams();
    showToast('Equipa removida.');
}

// ════════════════════════════════════════════════════════════
//  CALCULAR HANDICAP
// ════════════════════════════════════════════════════════════

function refreshCalcSelects() {
    // Preencher e filtrar os selects de equipa
    updateTeamSelects();
}

function updateTeamSelects() {
    // Filtrar equipas para evitar duplicatas
    const teamAId = document.getElementById('selTeamA').value;
    const teamBId = document.getElementById('selTeamB').value;
    
    // Atualizar selTeamA
    const optsA = `<option value="">-- Seleccionar Equipa A --</option>` +
        state.teams.map(t => `<option value="${t.id}" ${teamBId && t.id === teamBId ? 'disabled' : ''}>${esc(t.name)}</option>`).join('');
    document.getElementById('selTeamA').innerHTML = optsA;
    if (teamAId && state.teams.some(t => t.id === teamAId)) document.getElementById('selTeamA').value = teamAId;
    
    // Atualizar selTeamB
    const optsB = `<option value="">-- Seleccionar Equipa B --</option>` +
        state.teams.map(t => `<option value="${t.id}" ${teamAId && t.id === teamAId ? 'disabled' : ''}>${esc(t.name)}</option>`).join('');
    document.getElementById('selTeamB').innerHTML = optsB;
    if (teamBId && state.teams.some(t => t.id === teamBId)) document.getElementById('selTeamB').value = teamBId;
}

function updateCalcPlayerSelects() {
    // Obter equipa A e equipa B selecionadas
    const teamAId = document.getElementById('selTeamA').value;
    const teamBId = document.getElementById('selTeamB').value;
    const teamA = state.teams.find(t => t.id === teamAId);
    const teamB = state.teams.find(t => t.id === teamBId);
    
    // Atualizar títulos com nomes das equipas
    document.getElementById('parATitle').textContent = teamA ? `${esc(teamA.name)}` : 'Par A';
    document.getElementById('parBTitle').textContent = teamB ? `${esc(teamB.name)}` : 'Par B';
    
    // Jogadores da equipa A (sem filtro global, apenas com desabilitar duplicatas internas)
    const playersA = teamA ? (teamA.playerIds || []).map(pid => getPlayer(pid)).filter(Boolean).sort((a,b) => a.name.localeCompare(b.name, 'pt')) : [];
    
    // Jogadores da equipa B (sem filtro global, apenas com desabilitar duplicatas internas)
    const playersB = teamB ? (teamB.playerIds || []).map(pid => getPlayer(pid)).filter(Boolean).sort((a,b) => a.name.localeCompare(b.name, 'pt')) : [];
    
    // Construir opções para Par A (remover duplicatas dentro de Par A)
    const buildPlayerOptionsA = () => {
        const selA1Val = document.getElementById('selA1').value;
        const selA2Val = document.getElementById('selA2').value;
        
        const optsA1 = '<option value="">-- Seleccionar --</option>' + 
            playersA.map(p => {
                const disabled = selA2Val && p.id === selA2Val ? 'disabled' : '';
                return `<option value="${p.id}" ${disabled}>${esc(p.name)} (HCP ${p.handicap})</option>`;
            }).join('');
        
        const optsA2 = '<option value="">-- Seleccionar --</option>' + 
            playersA.map(p => {
                const disabled = selA1Val && p.id === selA1Val ? 'disabled' : '';
                return `<option value="${p.id}" ${disabled}>${esc(p.name)} (HCP ${p.handicap})</option>`;
            }).join('');
        
        return { optsA1, optsA2 };
    };
    
    // Construir opções para Par B (remover duplicatas dentro de Par B)
    const buildPlayerOptionsB = () => {
        const selB1Val = document.getElementById('selB1').value;
        const selB2Val = document.getElementById('selB2').value;
        
        const optsB1 = '<option value="">-- Seleccionar --</option>' + 
            playersB.map(p => {
                const disabled = selB2Val && p.id === selB2Val ? 'disabled' : '';
                return `<option value="${p.id}" ${disabled}>${esc(p.name)} (HCP ${p.handicap})</option>`;
            }).join('');
        
        const optsB2 = '<option value="">-- Seleccionar --</option>' + 
            playersB.map(p => {
                const disabled = selB1Val && p.id === selB1Val ? 'disabled' : '';
                return `<option value="${p.id}" ${disabled}>${esc(p.name)} (HCP ${p.handicap})</option>`;
            }).join('');
        
        return { optsB1, optsB2 };
    };
    
    const { optsA1, optsA2 } = buildPlayerOptionsA();
    const { optsB1, optsB2 } = buildPlayerOptionsB();
    
    // Atualizar selects de Par A (preservar seleção se ainda válida)
    const selA1 = document.getElementById('selA1');
    const curA1 = selA1.value;
    selA1.innerHTML = optsA1;
    if (playersA.some(p => p.id === curA1)) selA1.value = curA1;
    
    const selA2 = document.getElementById('selA2');
    const curA2 = selA2.value;
    selA2.innerHTML = optsA2;
    if (playersA.some(p => p.id === curA2)) selA2.value = curA2;
    
    // Atualizar selects de Par B (preservar seleção se ainda válida)
    const selB1 = document.getElementById('selB1');
    const curB1 = selB1.value;
    selB1.innerHTML = optsB1;
    if (playersB.some(p => p.id === curB1)) selB1.value = curB1;
    
    const selB2 = document.getElementById('selB2');
    const curB2 = selB2.value;
    selB2.innerHTML = optsB2;
    if (playersB.some(p => p.id === curB2)) selB2.value = curB2;
    
    updateParTotals();
}

function updateParTotals() {
    updateOnePar('selA1', 'selA2', 'parATotal');
    updateOnePar('selB1', 'selB2', 'parBTotal');
}

function updateOnePar(id1, id2, totalId) {
    const p1 = getPlayer(document.getElementById(id1).value);
    const p2 = getPlayer(document.getElementById(id2).value);
    document.getElementById(totalId).querySelector('strong').textContent = (p1 && p2) ? (p1.handicap + p2.handicap) : '—';
}

function calculate() {
    const teamAId = document.getElementById('selTeamA').value;
    const teamBId = document.getElementById('selTeamB').value;
    const teamA = state.teams.find(t => t.id === teamAId);
    const teamB = state.teams.find(t => t.id === teamBId);
    
    if (!teamAId || !teamBId) { showToast('Seleccione as duas equipas.', 'error'); return; }
    if (teamAId === teamBId) { showToast('Seleccione duas equipas diferentes.', 'error'); return; }
    
    const pA1 = getPlayer(document.getElementById('selA1').value);
    const pA2 = getPlayer(document.getElementById('selA2').value);
    const pB1 = getPlayer(document.getElementById('selB1').value);
    const pB2 = getPlayer(document.getElementById('selB2').value);
    if (!pA1 || !pA2 || !pB1 || !pB2) { showToast('Seleccione todos os jogadores nos dois pares.', 'error'); return; }
    const ids = [pA1.id, pA2.id, pB1.id, pB2.id];
    if (new Set(ids).size < 4) { showToast('Um jogador não pode pertencer a dois pares em simultâneo.', 'error'); return; }
    const totalA  = pA1.handicap + pA2.handicap;
    const totalB  = pB1.handicap + pB2.handicap;
    const diff    = Math.abs(totalA - totalB);
    const strokes = Math.round(diff * 0.75);
    const higherPar = totalA > totalB ? 'A' : (totalB > totalA ? 'B' : null);
    document.getElementById('parATotal').querySelector('strong').textContent = totalA;
    document.getElementById('parBTotal').querySelector('strong').textContent = totalB;
    renderResultSummary(pA1, pA2, pB1, pB2, totalA, totalB, diff, strokes, higherPar);
    renderStrokeTable(strokes, higherPar, teamA?.name, teamB?.name);
    document.getElementById('calcResult').classList.remove('hidden');
    setTimeout(() => document.getElementById('calcResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}

function renderResultSummary(pA1, pA2, pB1, pB2, totalA, totalB, diff, strokes, higherPar) {
    const el = document.getElementById('resultSummary');
    if (!higherPar) {
        el.innerHTML = `<div class="result-equal">⚖️ Os dois pares têm o mesmo handicap total (${totalA}).<br>Nenhum par recebe pancadas de abono — jogo a zero.</div>`;
        return;
    }
    const wLabel = `Par ${higherPar}`;
    const lLabel = higherPar === 'A' ? 'Par B' : 'Par A';
    const wPlayers = higherPar === 'A' ? `${esc(pA1.name)} &amp; ${esc(pA2.name)}` : `${esc(pB1.name)} &amp; ${esc(pB2.name)}`;
    el.innerHTML = `
        <div class="result-row"><span class="lbl">Par A — ${esc(pA1.name)} &amp; ${esc(pA2.name)}</span><span class="val" style="color:var(--blue)">Total: <strong>${totalA}</strong></span></div>
        <div class="result-row"><span class="lbl">Par B — ${esc(pB1.name)} &amp; ${esc(pB2.name)}</span><span class="val" style="color:var(--red)">Total: <strong>${totalB}</strong></span></div>
        <div class="result-row"><span class="lbl">Diferença de handicap</span><span class="val">${diff}</span></div>
        <div class="result-row"><span class="lbl">¾ da diferença <span style="font-size:.78rem;color:var(--txt-light)">(arredondado)</span></span><span class="val">${strokes} pancada${strokes !== 1 ? 's' : ''}</span></div>
        <div class="result-winner">
            <span>➡️ <span class="winner-name">${wLabel}</span> recebe ${strokes} pancada${strokes !== 1 ? 's' : ''} de abono<br><small style="font-weight:400;color:var(--txt-light)">${wPlayers}</small></span>
            <span class="winner-val">+${strokes}</span>
        </div>
        <div class="result-row" style="color:var(--txt-light);font-size:.85rem"><span>${lLabel} joga sem pancadas de abono</span><span>0</span></div>`;
}

function renderStrokeTable(strokes, higherPar, teamAName, teamBName) {
    // Criar um mapa de quantas pancadas cada buraco recebe
    const strokeMap = {};
    for (let i = 1; i <= 18; i++) strokeMap[i] = 0;
    
    // Distribuir as pancadas aos buracos com menor SI (mais fáceis)
    const holesWithSI = state.strokeIndex.map((si, i) => ({ hole: i + 1, si }));
    const sortedByEasiness = [...holesWithSI].sort((a, b) => a.si - b.si);
    
    for (let i = 0; i < strokes; i++) {
        const hole = sortedByEasiness[i % 18].hole;
        strokeMap[hole]++;
    }
    
    const front = [1,2,3,4,5,6,7,8,9];
    const back  = [10,11,12,13,14,15,16,17,18];
    const thead = document.querySelector('#strokeTable thead');
    const tbody = document.querySelector('#strokeTable tbody');
    
    thead.innerHTML = `<tr><th class="col-label">Buraco</th>${front.map(h=>`<th>${h}</th>`).join('')}<th class="col-divider">OUT</th>${back.map(h=>`<th>${h}</th>`).join('')}<th class="col-divider">IN</th><th class="col-divider">TOT</th></tr>`;
    
    // SI row
    const siCells = front.map(h=>`<td>${state.strokeIndex[h-1]}</td>`).join('') + `<td class="col-divider">—</td>` + back.map(h=>`<td>${state.strokeIndex[h-1]}</td>`).join('') + `<td class="col-divider">—</td><td class="col-divider">—</td>`;
    
    let fc=0, bc=0;
    
    // Abono row - mostrar múltiplos pontos se necessário
    const fCells = front.map(h => { 
        const strk = strokeMap[h];
        if (strk > 0) { 
            fc += strk; 
            return `<td class="cell-stroke">${'●'.repeat(strk)}</td>`;
        }
        return `<td class="cell-empty">—</td>`;
    }).join('');
    
    const bCells = back.map(h => { 
        const strk = strokeMap[h];
        if (strk > 0) { 
            bc += strk; 
            return `<td class="cell-stroke">${'●'.repeat(strk)}</td>`;
        }
        return `<td class="cell-empty">—</td>`;
    }).join('');
    
    // Usar o nome da equipa em vez de "Par A" ou "Par B"
    let label = 'Abono';
    if (higherPar === 'A' && teamAName) {
        label = `Abono ${esc(teamAName)}`;
    } else if (higherPar === 'B' && teamBName) {
        label = `Abono ${esc(teamBName)}`;
    }
    
    tbody.innerHTML = `<tr><td class="row-label">SI</td>${siCells}</tr><tr><td class="row-label">${label}</td>${fCells}<td class="col-divider"><strong>${fc}</strong></td>${bCells}<td class="col-divider"><strong>${bc}</strong></td><td class="col-divider"><strong>${strokes}</strong></td></tr>`;
}

function printStrokeTable() {
    const table = document.querySelector('#strokeTable');
    if (!table) { showToast('Tabela não encontrada.', 'error'); return; }
    
    // Clonar a tabela para não modificar a original
    const tableClone = table.cloneNode(true);
    
    // Criar uma nova janela
    const printWindow = window.open('', '', 'width=1000,height=600');
    
    // Escrever o conteúdo HTML para impressão
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Distribuição por Buracos - Taça Manuel André 2026</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Montserrat, Arial, sans-serif; padding: 20px; background: white; }
                h1 { text-align: center; margin-bottom: 20px; color: #2d5016; font-size: 24px; }
                .print-info { text-align: center; color: #666; font-size: 12px; margin-bottom: 15px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #999; padding: 8px; text-align: center; font-size: 12px; }
                th { background-color: #e8f5e9; font-weight: bold; color: #2d5016; }
                td { background-color: white; }
                .row-label { font-weight: bold; background-color: #f0f0f0; text-align: left; padding-left: 12px; }
                .col-divider { background-color: #f5f5f5; font-weight: bold; }
                .cell-stroke { background-color: #c8e6c9; }
                .cell-empty { background-color: #fafafa; }
                @media print {
                    body { padding: 0; }
                    table { margin-top: 10px; }
                    th, td { padding: 6px; font-size: 11px; }
                }
            </style>
        </head>
        <body>
            <h1>⛳ Distribuição por Buracos</h1>
            <div class="print-info">Taça Manuel André 2026 · Estela Golf Club</div>
    `);
    
    // Adicionar a tabela
    printWindow.document.write(tableClone.outerHTML);
    
    printWindow.document.write(`
            <p style="margin-top: 20px; font-size: 11px; color: #666;">
                <strong>Legenda:</strong> Os buracos a verde (●) recebem pancada(s) de abono. Múltiplos pontos (●●) indicam múltiplas pancadas no mesmo buraco.
            </p>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    
    // Abrir a caixa de diálogo de impressão após um pequeno delay
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

// ════════════════════════════════════════════════════════════
//  CONFIGURAÇÕES — SI (admin only)
// ════════════════════════════════════════════════════════════

function renderSIGrids() {
    document.getElementById('siGridFront').innerHTML = Array.from({length:9},(_,i)=>siCell(i)).join('');
    document.getElementById('siGridBack').innerHTML  = Array.from({length:9},(_,i)=>siCell(i+9)).join('');
}

function siCell(idx) {
    return `<div class="si-cell"><span class="hole-num">B${idx+1}</span><input type="number" id="si-${idx}" value="${state.strokeIndex[idx]}" min="1" max="18"></div>`;
}

function saveSI() {
    if (!isAdmin()) return;
    const vals = [];
    for (let i = 0; i < 18; i++) {
        const v = parseInt(document.getElementById(`si-${i}`).value, 10);
        if (isNaN(v) || v < 1 || v > 18) { showToast(`Valor inválido no buraco ${i+1}. Use 1 a 18.`, 'error'); return; }
        vals.push(v);
    }
    if (new Set(vals).size !== 18) { showToast('Os valores de SI devem ser todos diferentes (1 a 18).', 'error'); return; }
    state.strokeIndex = vals;
    saveState();
    showToast('Stroke Index guardado.');
}

function resetSI() {
    if (!isAdmin()) return;
    if (!confirm('Repor o Stroke Index para os valores predefinidos?')) return;
    state.strokeIndex = [...DEFAULT_SI];
    saveState();
    renderSIGrids();
    showToast('Stroke Index reposto.');
}

// ════════════════════════════════════════════════════════════
//  EXPORTAR / IMPORTAR / LIMPAR (admin only)
// ════════════════════════════════════════════════════════════

function exportData() {
    if (!isAdmin()) return;
    // Sincroniza o state com localStorage antes de exportar
    saveState();
    saveGameResults();
    saveCalendar();
    
    // Exporta o state completo incluindo calendar e gameResults
    const dataToExport = {
        players: state.players,
        teams: state.teams,
        strokeIndex: state.strokeIndex,
        gameResults: state.gameResults,
        calendar: state.calendar
    };
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {href:url, download:'taca-manuel-andre-2026.json'});
    a.click(); URL.revokeObjectURL(url);
    showToast('Dados exportados.');
}

function importData(file) {
    if (!isAdmin() || !file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const p = JSON.parse(e.target.result);
            if (p.players)     state.players     = p.players;
            if (p.teams)       state.teams       = p.teams;
            if (p.strokeIndex) state.strokeIndex = p.strokeIndex;
            saveState(); renderPlayers(); renderTeams(); renderSIGrids();
            showToast('Dados importados com sucesso.');
        } catch { showToast('Ficheiro inválido ou corrompido.', 'error'); }
    };
    reader.readAsText(file);
}

function clearAll() {
    if (!isAdmin()) return;
    if (!confirm('Apagar todos os dados do torneio?\nEsta acção não pode ser desfeita.')) return;
    state = { players:[], teams:[], strokeIndex:[...DEFAULT_SI], gameResults:[] };
    saveState(); renderPlayers(); renderTeams(); renderSIGrids();
    document.getElementById('calcResult').classList.add('hidden');
    showToast('Todos os dados foram apagados.');
}

// ════════════════════════════════════════════════════════════
//  CLASSIFICAÇÃO
// ════════════════════════════════════════════════════════════

// Datas de cada ronda
const RONDA_DATES = {
    1: 'Até 21 de Junho',
    2: 'Até 26 de Julho',
    3: 'Até 30 de Agosto',
    4: 'Até 27 de Setembro',
    5: 'Até 25 de Outubro'
};

// Calendário inicial predefinido (seed) — editável pelo admin
const CALENDAR_DATA = [
    // Ronda 1
    { ronda: 1, grupo: 'A', par: 1, home: 'Os Craques', away: 'LJMS' },
    { ronda: 1, grupo: 'A', par: 2, home: 'Os Craques', away: 'LJMS' },
    { ronda: 1, grupo: 'A', par: 1, home: 'Os 4 no Buraco', away: 'Estela Birdies' },
    { ronda: 1, grupo: 'A', par: 2, home: 'Os 4 no Buraco', away: 'Estela Birdies' },
    { ronda: 1, grupo: 'B', par: 1, home: 'AMVJ', away: 'V.T.F.' },
    { ronda: 1, grupo: 'B', par: 2, home: 'AMVJ', away: 'V.T.F.' },
    { ronda: 1, grupo: 'B', par: 1, home: 'Equipa Eleven', away: 'EMJC' },
    { ronda: 1, grupo: 'B', par: 2, home: 'Equipa Eleven', away: 'EMJC' },
    { ronda: 1, grupo: 'C', par: 1, home: 'Birdies e Boggies', away: 'Jacaré' },
    { ronda: 1, grupo: 'C', par: 2, home: 'Birdies e Boggies', away: 'Jacaré' },
    { ronda: 1, grupo: 'C', par: 1, home: 'Os Golfinhos', away: 'Piratas' },
    { ronda: 1, grupo: 'C', par: 2, home: 'Os Golfinhos', away: 'Piratas' },
    { ronda: 1, grupo: 'D', par: 1, home: 'MMLH', away: 'School' },
    { ronda: 1, grupo: 'D', par: 2, home: 'MMLH', away: 'School' },
    { ronda: 1, grupo: 'D', par: 1, home: 'Golfistas da Madrugada', away: 'Old Fashion Team' },
    { ronda: 1, grupo: 'D', par: 2, home: 'Golfistas da Madrugada', away: 'Old Fashion Team' },
    // Ronda 2
    { ronda: 2, grupo: 'A', par: 1, home: 'Os Craques', away: 'Os 4 no Buraco' },
    { ronda: 2, grupo: 'A', par: 2, home: 'Os Craques', away: 'Os 4 no Buraco' },
    { ronda: 2, grupo: 'A', par: 1, home: 'CGGG', away: 'LJMS' },
    { ronda: 2, grupo: 'A', par: 2, home: 'CGGG', away: 'LJMS' },
    { ronda: 2, grupo: 'B', par: 1, home: 'AMVJ', away: 'Equipa Eleven' },
    { ronda: 2, grupo: 'B', par: 2, home: 'AMVJ', away: 'Equipa Eleven' },
    { ronda: 2, grupo: 'B', par: 1, home: 'V.T.F.', away: 'Red Hot Chilli Putters' },
    { ronda: 2, grupo: 'B', par: 2, home: 'V.T.F.', away: 'Red Hot Chilli Putters' },
    { ronda: 2, grupo: 'C', par: 1, home: 'Birdies e Boggies', away: 'Os Golfinhos' },
    { ronda: 2, grupo: 'C', par: 2, home: 'Birdies e Boggies', away: 'Os Golfinhos' },
    { ronda: 2, grupo: 'C', par: 1, home: 'Masters', away: 'Jacaré' },
    { ronda: 2, grupo: 'C', par: 2, home: 'Masters', away: 'Jacaré' },
    { ronda: 2, grupo: 'D', par: 1, home: 'MMLH', away: 'Golfistas da Madrugada' },
    { ronda: 2, grupo: 'D', par: 2, home: 'MMLH', away: 'Golfistas da Madrugada' },
    { ronda: 2, grupo: 'D', par: 1, home: 'School', away: 'Old Fashion Team' },
    { ronda: 2, grupo: 'D', par: 2, home: 'School', away: 'Old Fashion Team' },
    // Ronda 3
    { ronda: 3, grupo: 'A', par: 1, home: 'Os Craques', away: 'Estela Birdies' },
    { ronda: 3, grupo: 'A', par: 2, home: 'Os Craques', away: 'Estela Birdies' },
    { ronda: 3, grupo: 'A', par: 1, home: 'Os 4 no Buraco', away: 'CGGG' },
    { ronda: 3, grupo: 'A', par: 2, home: 'Os 4 no Buraco', away: 'CGGG' },
    { ronda: 3, grupo: 'B', par: 1, home: 'AMVJ', away: 'EMJC' },
    { ronda: 3, grupo: 'B', par: 2, home: 'AMVJ', away: 'EMJC' },
    { ronda: 3, grupo: 'B', par: 1, home: 'Equipa Eleven', away: 'Red Hot Chilli Putters' },
    { ronda: 3, grupo: 'B', par: 2, home: 'Equipa Eleven', away: 'Red Hot Chilli Putters' },
    { ronda: 3, grupo: 'C', par: 1, home: 'Birdies e Boggies', away: 'Piratas' },
    { ronda: 3, grupo: 'C', par: 2, home: 'Birdies e Boggies', away: 'Piratas' },
    { ronda: 3, grupo: 'C', par: 1, home: 'Masters', away: 'Os Golfinhos' },
    { ronda: 3, grupo: 'C', par: 2, home: 'Masters', away: 'Os Golfinhos' },
    { ronda: 3, grupo: 'D', par: 1, home: 'MMLH', away: 'Old Fashion Team' },
    { ronda: 3, grupo: 'D', par: 2, home: 'MMLH', away: 'Old Fashion Team' },
    { ronda: 3, grupo: 'D', par: 1, home: 'School', away: 'Golfistas da Madrugada' },
    { ronda: 3, grupo: 'D', par: 2, home: 'School', away: 'Golfistas da Madrugada' },
    // Ronda 4
    { ronda: 4, grupo: 'A', par: 1, home: 'Os Craques', away: 'CGGG' },
    { ronda: 4, grupo: 'A', par: 2, home: 'Os Craques', away: 'CGGG' },
    { ronda: 4, grupo: 'A', par: 1, home: 'LJMS', away: 'Estela Birdies' },
    { ronda: 4, grupo: 'A', par: 2, home: 'LJMS', away: 'Estela Birdies' },
    { ronda: 4, grupo: 'B', par: 1, home: 'AMVJ', away: 'Red Hot Chilli Putters' },
    { ronda: 4, grupo: 'B', par: 2, home: 'AMVJ', away: 'Red Hot Chilli Putters' },
    { ronda: 4, grupo: 'B', par: 1, home: 'V.T.F.', away: 'EMJC' },
    { ronda: 4, grupo: 'B', par: 2, home: 'V.T.F.', away: 'EMJC' },
    { ronda: 4, grupo: 'C', par: 1, home: 'Birdies e Boggies', away: 'Masters' },
    { ronda: 4, grupo: 'C', par: 2, home: 'Birdies e Boggies', away: 'Masters' },
    { ronda: 4, grupo: 'C', par: 1, home: 'Jacaré', away: 'Piratas' },
    { ronda: 4, grupo: 'C', par: 2, home: 'Jacaré', away: 'Piratas' },
    // Ronda 5
    { ronda: 5, grupo: 'A', par: 1, home: 'LJMS', away: 'Os 4 no Buraco' },
    { ronda: 5, grupo: 'A', par: 2, home: 'LJMS', away: 'Os 4 no Buraco' },
    { ronda: 5, grupo: 'A', par: 1, home: 'Estela Birdies', away: 'CGGG' },
    { ronda: 5, grupo: 'A', par: 2, home: 'Estela Birdies', away: 'CGGG' },
    { ronda: 5, grupo: 'B', par: 1, home: 'V.T.F.', away: 'Equipa Eleven' },
    { ronda: 5, grupo: 'B', par: 2, home: 'V.T.F.', away: 'Equipa Eleven' },
    { ronda: 5, grupo: 'B', par: 1, home: 'EMJC', away: 'Red Hot Chilli Putters' },
    { ronda: 5, grupo: 'B', par: 2, home: 'EMJC', away: 'Red Hot Chilli Putters' },
    { ronda: 5, grupo: 'C', par: 1, home: 'Jacaré', away: 'Os Golfinhos' },
    { ronda: 5, grupo: 'C', par: 2, home: 'Jacaré', away: 'Os Golfinhos' },
    { ronda: 5, grupo: 'C', par: 1, home: 'Piratas', away: 'Masters' },
    { ronda: 5, grupo: 'C', par: 2, home: 'Piratas', away: 'Masters' }
];

function saveCalendar() {
    localStorage.setItem(STORAGE_KEY + '-calendar', JSON.stringify(state.calendar));
}

function loadCalendar() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY + '-calendar');
        if (raw) state.calendar = JSON.parse(raw);
    } catch (e) { console.error('loadCalendar:', e); }
}

function initializeCalendar() {
    if (!state.calendar.length) {
        state.calendar = CALENDAR_DATA.map(g => ({ ...g }));
        saveCalendar();
    }
}

function saveGameResults() {
    localStorage.setItem(STORAGE_KEY + '-results', JSON.stringify(state.gameResults));
}

function loadGameResults() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY + '-results');
        if (raw) state.gameResults = JSON.parse(raw);
    } catch (e) { console.error('loadGameResults:', e); }
}

function getGameResult(ronda, par, home, away) {
    return state.gameResults.find(r => r.ronda === ronda && r.par === par && r.home === home && r.away === away);
}

function setGameResult(ronda, par, home, away, result) {
    const existing = getGameResult(ronda, par, home, away);
    if (existing) {
        existing.result = result;
    } else {
        state.gameResults.push({ ronda, par, home, away, result });
    }
    saveGameResults();
}

function calculateStandings(ronda, accumulate) {
    // ronda: número da ronda; accumulate: true = soma todas as rondas até ronda
    console.log(`calculateStandings called: ronda=${ronda} (type: ${typeof ronda}), accumulate=${accumulate}`);
    
    const standings = { A: [], B: [], C: [], D: [] };
    
    // Inicializar com equipas que têm grupo definido
    state.teams.forEach(team => {
        if (team.grupo && ['A', 'B', 'C', 'D'].includes(team.grupo)) {
            standings[team.grupo].push({
                id: team.id,
                name: team.name,
                grupo: team.grupo,
                points: 0,
                played: 0,
                wins: 0,
                draws: 0,
                losses: 0
            });
        }
    });
    
    // Calcular pontos baseado nos resultados
    // accumulate=true: todas as rondas até ronda; false: só a ronda exacta
    const games = accumulate
        ? state.calendar.filter(g => g.ronda <= ronda)
        : state.calendar.filter(g => g.ronda === ronda);
    
    games.forEach(game => {
        const homeTeam = standings[game.grupo].find(t => t.name === game.home);
        const awayTeam = standings[game.grupo].find(t => t.name === game.away);
        
        // Só processar se ambas as equipas existem em state.teams
        if (homeTeam && awayTeam) {
            const gameResult = getGameResult(game.ronda, game.par, game.home, game.away);
            
            homeTeam.played++;
            awayTeam.played++;
            
            if (gameResult && gameResult.result) {
                const result = gameResult.result;
                if (result === 'home') {
                    homeTeam.wins++;
                    homeTeam.points += 3;
                    awayTeam.losses++;
                } else if (result === 'away') {
                    awayTeam.wins++;
                    awayTeam.points += 3;
                    homeTeam.losses++;
                } else if (result === 'draw') {
                    homeTeam.draws++;
                    homeTeam.points += 1;
                    awayTeam.draws++;
                    awayTeam.points += 1;
                }
            }
        }
    });
    
    // Ordenar por pontos (decrescente)
    Object.keys(standings).forEach(grupo => {
        standings[grupo].sort((a, b) => b.points - a.points);
    });
    
    return standings;
}

function renderClassificacao(ronda) {
    // Recarregar resultados do localStorage
    loadGameResults();
    
    // Se ronda === 'total', calcular soma das 5 rondas (acumulado)
    const standings = ronda === 'total' ? calculateStandings(5, true) : calculateStandings(ronda, false);
    let html = '';
    
    Object.keys(standings).sort().forEach(grupo => {
        const teams = standings[grupo];
        // Total: acumula todas as rondas; ronda específica: só jogos dessa ronda
        const groupGames = ronda === 'total'
            ? state.calendar.filter(g => g.grupo === grupo)
            : state.calendar.filter(g => g.ronda === ronda && g.grupo === grupo);
        
        html += `
        <div class="class-group">
            <h3 class="class-title">Grupo ${grupo}</h3>
            <table class="class-table">
                <thead>
                    <tr>
                        <th style="width:5%">Pos</th>
                        <th style="width:40%">Equipa</th>
                        <th style="width:15%">Jogos</th>
                        <th style="width:12%">V</th>
                        <th style="width:12%">E</th>
                        <th style="width:12%">D</th>
                        <th style="width:10%">Pts</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        teams.forEach((team, idx) => {
            html += `
                    <tr>
                        <td>${idx + 1}</td>
                        <td><strong>${esc(team.name)}</strong></td>
                        <td>${team.played}</td>
                        <td>${team.wins}</td>
                        <td>${team.draws}</td>
                        <td>${team.losses}</td>
                        <td><strong>${team.points}</strong></td>
                    </tr>
            `;
        });
        
        // Mostrar equipas em folga (0 jogos nesta ronda/total)
        const teamsResting = teams.filter(t => t.played === 0);
        console.log(`DEBUG Grupo ${grupo} Ronda ${ronda}: teamsResting =`, teamsResting.map(t => t.name));
        
        html += `
                </tbody>
            </table>
        `;
        
        if (teamsResting.length > 0) {
            html += `<div style="margin-top:0.75rem; padding:0.75rem; background:#fef3c7; border-left:3px solid #f59e0b; font-size:0.9rem; color:#78350f;">
                <strong>Folga:</strong> ${teamsResting.map(t => esc(t.name)).join(', ')}
            </div>`;
        }
        
        // Mostrar secção de edição de resultados apenas para administrador
        if (isAdmin()) {
            html += `
            <div class="games-input" style="margin-top:1.5rem;">
                <h4 style="margin-bottom:0.75rem; color:var(--primary);">Registar Resultados dos Jogos:</h4>
            `;
            
            groupGames.forEach(game => {
                const result = getGameResult(game.ronda, game.par, game.home, game.away);
                const resultHtml = `
                <div class="game-result-row">
                    <span class="team-name" style="font-size: 0.85rem; color: var(--txt-light);">Par ${game.par}</span>
                    <span class="team-name">${esc(game.home)}</span>
                    <div class="result-buttons">
                        <button class="btn-result ${result && result.result === 'home' ? 'active' : ''}" data-ronda="${game.ronda}" data-par="${game.par}" data-home="${game.home}" data-away="${game.away}" data-result="home">Vence</button>
                        <button class="btn-result ${result && result.result === 'draw' ? 'active' : ''}" data-ronda="${game.ronda}" data-par="${game.par}" data-home="${game.home}" data-away="${game.away}" data-result="draw">Empate</button>
                        <button class="btn-result ${result && result.result === 'away' ? 'active' : ''}" data-ronda="${game.ronda}" data-par="${game.par}" data-home="${game.home}" data-away="${game.away}" data-result="away">Perde</button>
                        <button class="btn-result-clear" data-ronda="${game.ronda}" data-par="${game.par}" data-home="${game.home}" data-away="${game.away}">Limpar</button>
                    </div>
                    <span class="team-name">${esc(game.away)}</span>
                </div>
                `;
                html += resultHtml;
            });
            
            html += `
            </div>
            `;
        }
        
        html += `
        </div>
        `;
    });
    
    document.getElementById('classificacaoContainer').innerHTML = html;
    
    // Adicionar listeners aos botões de resultado (apenas se admin)
    if (isAdmin()) {
        document.querySelectorAll('.btn-result').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ronda = parseInt(e.target.dataset.ronda, 10);
                const par = parseInt(e.target.dataset.par, 10);
                const home = e.target.dataset.home;
                const away = e.target.dataset.away;
                const result = e.target.dataset.result;
                
                setGameResult(ronda, par, home, away, result);
                renderClassificacao(ronda);
                showToast(`Resultado registado - Par ${par}: ${home} vs ${away}`);
            });
        });
        
        // Adicionar listeners ao botão "Limpar"
        document.querySelectorAll('.btn-result-clear').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ronda = parseInt(e.target.dataset.ronda, 10);
                const par = parseInt(e.target.dataset.par, 10);
                const home = e.target.dataset.home;
                const away = e.target.dataset.away;
                
                setGameResult(ronda, par, home, away, null);
                renderClassificacao(ronda);
                showToast(`Resultado limpo - Par ${par}: ${home} vs ${away}`);
            });
        });
    }
}

// ════════════════════════════════════════════════════════════
//  GESTÃO DE GRUPOS
// ════════════════════════════════════════════════════════════

function renderGrupos() {
    const container = document.getElementById('gruposContainer');
    const grupos = ['A', 'B', 'C', 'D'];
    const isAdminUser = isAdmin();
    
    let html = '';
    grupos.forEach(g => {
        const teamsInGrupo = state.teams.filter(t => t.grupo === g);
        
        // MODO ADMIN: Com controles de edição
        if (isAdminUser) {
            html += `<div class="grupo-edit-card">
                <div class="grupo-edit-title">Grupo ${g}</div>`;
            
            if (teamsInGrupo.length > 0) {
                html += `<div class="grupo-teams-list">`;
                teamsInGrupo.forEach(team => {
                    html += `<div class="grupo-team-item" data-team-id="${team.id}">
                        <span class="grupo-team-name">${team.name}</span>
                        <div class="grupo-team-actions">
                            <button class="btn-grupo-remove" data-team-id="${team.id}" data-grupo="${g}">Remover</button>
                        </div>
                    </div>`;
                });
                html += `</div>`;
            } else {
                html += `<div class="grupo-empty-msg">Nenhuma equipa neste grupo</div>`;
            }
            
            // Dropdown para adicionar
            html += `<div class="grupo-add-team">
                <select class="sel-add-team" data-grupo="${g}">
                    <option value="">+ Adicionar Equipa</option>`;
            
            const teamsSemGrupo = state.teams.filter(t => t.grupo !== g);
            teamsSemGrupo.forEach(team => {
                html += `<option value="${team.id}">${team.name}</option>`;
            });
            
            html += `</select></div></div>`;
        } 
        // MODO VISUALIZAÇÃO: Apenas mostrar (sem edição)
        else {
            html += `<div class="grupo-view-card">
                <div class="grupo-view-title">Grupo ${g}</div>`;
            
            if (teamsInGrupo.length > 0) {
                html += `<div class="grupo-teams-list">`;
                teamsInGrupo.forEach(team => {
                    html += `<div class="grupo-team-item view-only">
                        <span class="grupo-team-name">${team.name}</span>
                    </div>`;
                });
                html += `</div>`;
            } else {
                html += `<div class="grupo-empty-msg">Nenhuma equipa neste grupo</div>`;
            }
            
            html += `</div>`;
        }
    });
    
    container.innerHTML = html;
    
    // Event listeners APENAS se for admin
    if (isAdminUser) {
        // Event listeners para remover
        container.querySelectorAll('.btn-grupo-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const teamId = btn.dataset.teamId;
                const team = state.teams.find(t => t.id === teamId);
                if (team) {
                    team.grupo = '';
                    saveState();
                    renderGrupos();
                    showToast(`${team.name} removida do grupo`);
                }
            });
        });
        
        // Event listeners para adicionar
        container.querySelectorAll('.sel-add-team').forEach(sel => {
            sel.addEventListener('change', () => {
                const teamId = sel.value;
                const grupo = sel.dataset.grupo;
                if (teamId) {
                    const team = state.teams.find(t => t.id === teamId);
                    if (team) {
                        team.grupo = grupo;
                        saveState();
                        renderGrupos();
                        showToast(`${team.name} adicionada ao Grupo ${grupo}`);
                    }
                }
            });
        });
    }
}

// ════════════════════════════════════════════════════════════
//  CALENDÁRIO — Interface dinâmica
// ════════════════════════════════════════════════════════════

function renderCalendario() {
    const container = document.getElementById('calendarioContainer');
    if (!container) return;

    const rondes = [1, 2, 3, 4, 5];
    let html = '';

    rondes.forEach(ronda => {
        const rondaGames = state.calendar.filter(g => g.ronda === ronda);
        if (!rondaGames.length) return;

        html += `<div class="ronda-block">
            <div class="ronda-header">
                <span class="ronda-num">${ronda}ª Ronda</span>
                <span class="ronda-date">${RONDA_DATES[ronda] || ''}</span>
            </div>
            <div class="grupos-grid">`;

        ['A', 'B', 'C', 'D'].forEach(grupo => {
            const grupoGames = rondaGames.filter(g => g.grupo === grupo);
            if (!grupoGames.length) return;

            // Agrupar por confronto (home + away) — cada confronto tem Par 1 e Par 2
            const matchups = new Map();
            grupoGames.forEach(g => {
                const key = g.home + '|||' + g.away;
                if (!matchups.has(key)) matchups.set(key, []);
                matchups.get(key).push(g);
            });

            html += `<div class="grupo-card">
                <h4 class="grupo-title">Grupo ${grupo}</h4>
                <ul class="jogos-list">`;

            matchups.forEach((games, key) => {
                const [home, away] = key.split('|||');
                const homeExists = state.teams.some(t => t.name === home);
                const awayExists = state.teams.some(t => t.name === away);
                const invalid = !homeExists || !awayExists;

                // Calcular resultado total do confronto (soma dos 2 pares)
                const results = games.map(g =>
                    state.gameResults.find(r => r.ronda === ronda && r.par === g.par && r.home === home && r.away === away)
                ).filter(Boolean);

                const hasAnyResult = results.some(r => r.result);

                // Calcular score total (nº pares ganhos por cada equipa)
                let homeScore = 0, awayScore = 0, drawCount = 0;
                results.forEach(r => {
                    if (r.result === 'home') homeScore++;
                    else if (r.result === 'away') awayScore++;
                    else if (r.result === 'draw') drawCount++;
                });
                const isDraw = hasAnyResult && homeScore === awayScore;
                const homeWins = homeScore > awayScore;
                const awayWins = awayScore > homeScore;

                // Badges por par (lado esquerdo = home, lado direito = away)
                const parBadges = games.sort((a, b) => a.par - b.par).map(g => {
                    const res = state.gameResults.find(r => r.ronda === ronda && r.par === g.par && r.home === home && r.away === away);
                    if (!res || !res.result) return `<span class="par-badge par-pending">Par ${g.par}</span><span class="par-badge par-pending">Par ${g.par}</span>`;
                    if (res.result === 'home') return `<span class="par-badge par-home-win">✓ Par ${g.par}</span><span class="par-badge par-pending">Par ${g.par}</span>`;
                    if (res.result === 'away') return `<span class="par-badge par-pending">Par ${g.par}</span><span class="par-badge par-away-win">✓ Par ${g.par}</span>`;
                    if (res.result === 'draw')  return `<span class="par-badge par-draw">= Par ${g.par}</span><span class="par-badge par-draw">= Par ${g.par}</span>`;
                    return '';
                }).join('');

                const scoreLabel = hasAnyResult
                    ? `<span class="jogo-score${isDraw ? ' score-draw' : ''}">${homeScore}–${awayScore}</span>`
                    : `<span class="jogo-vs">VS</span>`;

                const homeClass = hasAnyResult ? (homeWins ? ' team-winner' : isDraw ? '' : ' team-loser') : '';
                const awayClass = hasAnyResult ? (awayWins ? ' team-winner' : isDraw ? '' : ' team-loser') : '';

                html += `<li class="jogo${invalid ? ' jogo-invalid' : ''}${hasAnyResult ? ' jogo-done' : ''}">
                    <div class="jogo-teams">
                        <span class="team-home${homeClass}">${esc(home)}</span>
                        ${scoreLabel}
                        <span class="team-away${awayClass}">${esc(away)}</span>
                        ${invalid ? '<span class="jogo-warning" title="Uma ou ambas as equipas não existem">⚠️</span>' : ''}
                        ${isAdmin() ? `<button class="btn-del-match" data-ronda="${ronda}" data-home="${esc(home)}" data-away="${esc(away)}">✕</button>` : ''}
                    </div>
                    ${hasAnyResult ? `<div class="jogo-pars">${parBadges}</div>` : ''}
                </li>`;
            });

            html += `</ul></div>`;
        });

        html += `</div></div>`;
    });

    if (!html) {
        html = `<div class="empty-state"><p>Calendário vazio. ${isAdmin() ? 'Use o formulário abaixo para adicionar jogos.' : ''}</p></div>`;
    }

    container.innerHTML = html;

    // Listeners para remover jogos (admin)
    if (isAdmin()) {
        container.querySelectorAll('.btn-del-match').forEach(btn => {
            btn.addEventListener('click', () => {
                const ronda = parseInt(btn.dataset.ronda, 10);
                const home = btn.dataset.home;
                const away = btn.dataset.away;
                if (!confirm(`Remover "${home} VS ${away}" da Ronda ${ronda}?\n(Remove Par 1 e Par 2)`)) return;
                state.calendar = state.calendar.filter(
                    g => !(g.ronda === ronda && g.home === home && g.away === away)
                );
                saveCalendar();
                renderCalendario();
                showToast(`Jogo removido: ${home} vs ${away}`);
            });
        });

        // Actualizar dropdowns do formulário
        updateAddMatchDropdowns();

        // Mostrar painel de adicionar
        const panel = document.getElementById('addMatchPanel');
        if (panel) panel.classList.remove('hidden');
    } else {
        const panel = document.getElementById('addMatchPanel');
        if (panel) panel.classList.add('hidden');
    }
}

function updateAddMatchDropdowns() {
    const grupoEl = document.getElementById('addMatchGrupo');
    const homeEl  = document.getElementById('addMatchHome');
    const awayEl  = document.getElementById('addMatchAway');
    if (!grupoEl || !homeEl || !awayEl) return;

    const grupo = grupoEl.value;
    const teams = grupo
        ? state.teams.filter(t => t.grupo === grupo)
        : state.teams;

    const opts = `<option value="">-- Selecionar --</option>` +
        teams.map(t => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join('');
    homeEl.innerHTML = opts;
    awayEl.innerHTML = opts;
}

function addCalendarMatch() {
    if (!isAdmin()) return;
    const ronda = parseInt(document.getElementById('addMatchRonda').value, 10);
    const grupo = document.getElementById('addMatchGrupo').value;
    const home  = document.getElementById('addMatchHome').value;
    const away  = document.getElementById('addMatchAway').value;

    if (!home || !away) { showToast('Selecione as duas equipas.', 'error'); return; }
    if (home === away)  { showToast('As equipas têm de ser diferentes.', 'error'); return; }

    const exists = state.calendar.some(
        g => g.ronda === ronda && g.home === home && g.away === away
    );
    if (exists) { showToast('Este jogo já existe no calendário.', 'error'); return; }

    state.calendar.push({ ronda, grupo, par: 1, home, away });
    state.calendar.push({ ronda, grupo, par: 2, home, away });
    saveCalendar();
    renderCalendario();
    showToast(`Jogo adicionado: ${home} vs ${away} (Par 1 + Par 2)`);
}

// ════════════════════════════════════════════════════════════
//  INICIALIZAÇÃO
// ════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
    // Carregar o backup do servidor PRIMEIRO
    const hasBackupData = await loadDataBackup();
    // Se não conseguiu carregar do servidor, tenta dados locais
    if (!hasBackupData) {
        loadState();
        loadGameResults();
        loadCalendar();
    }
    loadAuth();
    initializeTestData();
    initializeCalendar();
    await ensureDefaultAdmin();

    initTabs();
    // Renderizar classificação na página inicial (tab por defeito)
    renderClassificacao('total');

    // Menu burger
    const burger   = document.getElementById('navBurger');
    const navLinks = document.getElementById('navLinks');
    burger.addEventListener('click', () => navLinks.classList.toggle('open'));
    navLinks.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => navLinks.classList.remove('open')));

    // Auth
    document.getElementById('btnOpenLogin').addEventListener('click', openLoginModal);
    document.getElementById('btnCloseLogin').addEventListener('click', closeLoginModal);
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('btnLogout').addEventListener('click', doLogout);

    // Mostrar/ocultar palavra-passe no modal
    document.getElementById('btnTogglePwd').addEventListener('click', () => {
        const inp = document.getElementById('loginPassword');
        inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    // Fechar modal ao clicar no overlay
    document.getElementById('loginModal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeLoginModal();
    });

    // GitHub Sync
    document.getElementById('btnSyncGithub').addEventListener('click', openGithubSyncModal);
    document.getElementById('btnCloseGithubSync').addEventListener('click', closeGithubSyncModal);
    document.getElementById('btnCancelGithubSync').addEventListener('click', closeGithubSyncModal);
    document.getElementById('btnExportAndClose').addEventListener('click', () => { exportData(); closeGithubSyncModal(); });
    document.getElementById('githubSyncModal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeGithubSyncModal();
    });

    // Jogadores
    document.getElementById('btnShowPlayerForm').addEventListener('click', openAddPlayer);
    document.getElementById('btnCancelPlayer').addEventListener('click', () => document.getElementById('playerForm').classList.add('hidden'));
    document.getElementById('btnSavePlayer').addEventListener('click', savePlayer);
    document.getElementById('inputPlayerName').addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('inputPlayerHcpWhs').focus(); });
    
    // Recalcular HCP de Jogo quando WHS ou Gênero muda
    function recalcHcp() {
        const whsRaw = document.getElementById('inputPlayerHcpWhs').value;
        const generoVal = document.getElementById('inputPlayerGenero').value;
        if (whsRaw === '' || isNaN(parseFloat(whsRaw))) {
            document.getElementById('displayPlayerHcp').textContent = '—';
            return;
        }
        const calculatedHcp = calculateGameHandicap(parseFloat(whsRaw), generoVal);
        document.getElementById('displayPlayerHcp').textContent = calculatedHcp;
    }
    document.getElementById('inputPlayerHcpWhs').addEventListener('input', recalcHcp);
    document.getElementById('inputPlayerGenero').addEventListener('change', recalcHcp);
    document.getElementById('inputPlayerHcpWhs').addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('inputPlayerGenero').focus(); });
    document.getElementById('inputPlayerGenero').addEventListener('keydown',  e => { if (e.key==='Enter') savePlayer(); });

    // Equipas
    document.getElementById('btnShowTeamForm').addEventListener('click', openAddTeam);
    document.getElementById('btnCancelTeam').addEventListener('click', () => document.getElementById('teamForm').classList.add('hidden'));
    document.getElementById('btnSaveTeam').addEventListener('click', saveTeam);

    // Calcular
    document.getElementById('selTeamA').addEventListener('change', () => { updateTeamSelects(); updateCalcPlayerSelects(); });
    document.getElementById('selTeamB').addEventListener('change', () => { updateTeamSelects(); updateCalcPlayerSelects(); });
    ['selA1','selA2','selB1','selB2'].forEach(id => document.getElementById(id).addEventListener('change', () => { updateCalcPlayerSelects(); updateParTotals(); }));
    document.getElementById('btnCalculate').addEventListener('click', calculate);
    document.getElementById('btnPrintStroke').addEventListener('click', printStrokeTable);

    // Classificação
    document.getElementById('selRondaClass').addEventListener('change', (e) => {
        const val = e.target.value;
        renderClassificacao(val === 'total' ? 'total' : parseInt(val, 10));
    });

    // Calendário — formulário de adicionar jogo (admin)
    const addMatchGrupoEl = document.getElementById('addMatchGrupo');
    if (addMatchGrupoEl) {
        addMatchGrupoEl.addEventListener('change', updateAddMatchDropdowns);
    }
    const btnAddMatch = document.getElementById('btnAddMatch');
    if (btnAddMatch) {
        btnAddMatch.addEventListener('click', addCalendarMatch);
    }

    // Configurações
    document.getElementById('btnSaveSI').addEventListener('click', saveSI);
    document.getElementById('btnResetSI').addEventListener('click', resetSI);
    document.getElementById('btnExport').addEventListener('click', exportData);
    document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', e => { importData(e.target.files[0]); e.target.value=''; });
    document.getElementById('btnClearAll').addEventListener('click', clearAll);

    // Gestão utilizadores (admin)
    document.getElementById('btnShowNewUser').addEventListener('click', () => document.getElementById('newUserForm').classList.remove('hidden'));
    document.getElementById('btnCancelNewUser').addEventListener('click', () => document.getElementById('newUserForm').classList.add('hidden'));
    document.getElementById('btnSaveNewUser').addEventListener('click', saveNewUser);

    // Alterar palavra-passe
    document.getElementById('btnChangePwd').addEventListener('click', changeOwnPassword);

    // Render inicial
    renderPlayers();
    renderTeams();
    renderSIGrids();
    refreshCalcSelects();
    updateAuthUI();
});
