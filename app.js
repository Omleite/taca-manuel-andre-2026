'use strict';

// ============================================================
//  TAÇA MANUEL ANDRÉ 2026 – Lógica da Aplicação
// ============================================================

const STORAGE_KEY = 'taca-manuel-andre-2026';
const AUTH_KEY    = 'tma-2026-auth';
const AUTH_SESSION_KEY = 'tma-2026-auth-session';
const GITHUB_TOKEN_SESSION_KEY = 'tma-2026-gh-token';
const SALT        = 'egc:tma:2026:estela';
const EMERGENCY_ADMIN_USERNAME = 'admin';
const EMERGENCY_ADMIN_PASSWORD = 'estela2026';

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

// Recalcular todos os HCP de Jogo baseado no WHS
function recalculateAllGameHandicaps() {
    state.players.forEach(p => {
        p.handicap = calculateGameHandicap(p.handicapWhs, p.genero);
    });
}

// ════════════════════════════════════════════════════════════
//  ESTADO
// ════════════════════════════════════════════════════════════

let state = {
    players: [],
    teams: [],
    strokeIndex: [...DEFAULT_SI],
    gameResults: [],  // Array de resultados de jogos
    calendar: [],     // Calendário editável de jogos
    roundDates: {}    // Datas editáveis por ronda
};

let authState = {
    currentUser: null,
    users: []
};

let teamNavReturnTab = null;
let teamNavTargetTeamId = null;
const TEAM_NAV_RETURN_LABELS = {
    calendario: 'Voltar ao Calendário',
    grupos: 'Voltar aos Grupos',
    classificacao: 'Voltar à Classificação'
};
const TEAM_NAV_RETURN_SHORT_LABELS = {
    calendario: '← Calendário',
    grupos: '← Grupos',
    classificacao: '← Classificação'
};

const ROLES = {
    TOURNAMENT_ADMIN: 'tournament_admin',
    TOURNAMENT_MANAGER: 'tournament_manager',
    SCORING_OFFICIAL: 'scoring_official'
};

const ROLE_LABELS = {
    [ROLES.TOURNAMENT_ADMIN]: 'Tournament Admin',
    [ROLES.TOURNAMENT_MANAGER]: 'Tournament Manager',
    [ROLES.SCORING_OFFICIAL]: 'Scoring Official'
};


const PERMISSIONS = {
    users_manage: [ROLES.TOURNAMENT_ADMIN],
    players_manage: [ROLES.TOURNAMENT_ADMIN, ROLES.TOURNAMENT_MANAGER],
    teams_manage: [ROLES.TOURNAMENT_ADMIN, ROLES.TOURNAMENT_MANAGER],
    groups_manage: [ROLES.TOURNAMENT_ADMIN, ROLES.TOURNAMENT_MANAGER],
    classification_manage: [ROLES.TOURNAMENT_ADMIN, ROLES.TOURNAMENT_MANAGER, ROLES.SCORING_OFFICIAL],
    calendar_manage: [ROLES.TOURNAMENT_ADMIN, ROLES.TOURNAMENT_MANAGER],
    handicaps_global_manage: [ROLES.TOURNAMENT_ADMIN],
    handicaps_operational_manage: [ROLES.TOURNAMENT_ADMIN, ROLES.TOURNAMENT_MANAGER],
    data_manage: [ROLES.TOURNAMENT_ADMIN],
    players_view: [ROLES.TOURNAMENT_ADMIN, ROLES.TOURNAMENT_MANAGER, ROLES.SCORING_OFFICIAL],
    config_view: [ROLES.TOURNAMENT_ADMIN, ROLES.TOURNAMENT_MANAGER, ROLES.SCORING_OFFICIAL]
};

// ════════════════════════════════════════════════════════════
//  AUTENTICAÇÃO
// ════════════════════════════════════════════════════════════

function loadAuth() {
    try {
        const raw = localStorage.getItem(AUTH_KEY);
        if (raw) {
            const p = JSON.parse(raw);
            authState.users = Array.isArray(p.users) ? p.users : [];
        }
        authState.users = authState.users.map(u => ({
            ...u,
            role: normalizeRole(u.role),
            mustResetPassword: !!u.mustResetPassword
        }));
        ensureDefaultAdminUser();

        // Sessão autenticada vive apenas durante a sessão do browser.
        authState.currentUser = null;
        const sessionRaw = sessionStorage.getItem(AUTH_SESSION_KEY);
        if (sessionRaw) {
            const sessionUser = JSON.parse(sessionRaw);
            const found = authState.users.find(u =>
                (sessionUser.id && u.id === sessionUser.id) ||
                (sessionUser.username && normalizeUsername(u.username) === normalizeUsername(sessionUser.username))
            );
            if (found) {
                authState.currentUser = {
                    id: found.id,
                    username: found.username,
                    displayName: found.displayName,
                    role: normalizeRole(found.role),
                    mustResetPassword: !!found.mustResetPassword
                };
            }
        }
    } catch (e) { console.error('loadAuth:', e); }
}

function saveAuth() {
    const authToStore = {
        users: authState.users
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(authToStore));

    if (authState.currentUser) {
        sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(authState.currentUser));
    } else {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
    }
}

function hashPassword(password) {
    const input = `${SALT}:${password}`;
    let h = 5381;
    for (let i = 0; i < input.length; i++) {
        h = ((h << 5) + h) + input.charCodeAt(i);
        h |= 0;
    }
    return (h >>> 0).toString(16);
}

function normalizeUsername(username) {
    return (username || '').trim().toLowerCase();
}

function normalizeRole(role) {
    const r = (role || '').toString().trim().toLowerCase();
    if (r === ROLES.TOURNAMENT_ADMIN || r === 'admin') return ROLES.TOURNAMENT_ADMIN;
    if (r === ROLES.SCORING_OFFICIAL || r === 'scoring') return ROLES.SCORING_OFFICIAL;
    if (r === ROLES.TOURNAMENT_MANAGER || r === 'manager' || r === 'user') return ROLES.TOURNAMENT_MANAGER;
    return ROLES.TOURNAMENT_MANAGER;
}

function roleLabel(role) {
    return ROLE_LABELS[normalizeRole(role)] || ROLE_LABELS[ROLES.TOURNAMENT_MANAGER];
}

function can(permission) {
    if (!authState.currentUser) return false;
    const allowedRoles = PERMISSIONS[permission] || [];
    return allowedRoles.includes(normalizeRole(authState.currentUser.role));
}

function canAccessTab(tabName) {
    if (tabName === 'jogadores') return can('players_view');
    if (tabName === 'configuracoes') return can('config_view');
    return true;
}

function ensureDefaultAdminUser() {
    const existingAdmin = authState.users.find(u => normalizeUsername(u.username) === EMERGENCY_ADMIN_USERNAME);
    if (existingAdmin) {
        if (!existingAdmin.passwordHash) {
            existingAdmin.passwordHash = hashPassword(EMERGENCY_ADMIN_PASSWORD);
            existingAdmin.mustResetPassword = true;
        }
        existingAdmin.displayName = existingAdmin.displayName || 'Administrador';
        existingAdmin.role = ROLES.TOURNAMENT_ADMIN;
        return;
    }

    authState.users.push({
        id: 'admin-default',
        username: EMERGENCY_ADMIN_USERNAME,
        displayName: 'Administrador',
        role: ROLES.TOURNAMENT_ADMIN,
        passwordHash: hashPassword(EMERGENCY_ADMIN_PASSWORD),
        mustResetPassword: true
    });
    saveAuth();
}

function getUsersBackupSnapshot() {
    return authState.users
        .map(u => ({
            id: u.id || genId(),
            username: normalizeUsername(u.username),
            displayName: (u.displayName || u.username || 'Utilizador').trim(),
            role: normalizeRole(u.role),
            // Permite mobilidade entre dispositivos sem guardar password em claro.
            passwordHash: u.passwordHash || null,
            mustResetPassword: !!u.mustResetPassword
        }))
        .filter(u => !!u.username);
}

function hydrateUsersFromBackup(rawUsers) {
    if (!Array.isArray(rawUsers)) return [];
    return rawUsers
        .map(u => ({
            id: u.id || genId(),
            username: normalizeUsername(u.username),
            displayName: (u.displayName || u.username || 'Utilizador').trim(),
            role: normalizeRole(u.role),
            passwordHash: typeof u.passwordHash === 'string' && u.passwordHash.trim() ? u.passwordHash : null,
            mustResetPassword: typeof u.mustResetPassword === 'boolean' ? u.mustResetPassword : !(typeof u.passwordHash === 'string' && u.passwordHash.trim())
        }))
        .filter(u => !!u.username);
}

function getUserByUsername(username) {
    const uname = normalizeUsername(username);
    return authState.users.find(u => normalizeUsername(u.username) === uname) || null;
}

const isLoggedIn = () => !!authState.currentUser;
const isAdmin    = () => can('users_manage');

function doLogin(username, password) {
    const user = getUserByUsername(username);
    if (user && user.passwordHash && user.passwordHash === hashPassword(password)) {
        authState.currentUser = {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role,
            mustResetPassword: !!user.mustResetPassword
        };
        saveAuth();
        return true;
    }
    return false;
}

function doLogout() {
    authState.currentUser = null;
    saveAuth();
    
    // Esconder imediatamente formulários de edição
    document.getElementById('playerForm').classList.add('hidden');
    document.getElementById('teamForm').classList.add('hidden');
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
    
    updateAuthUI();
    showToast('Sessão terminada.');
    // Reload após logout para esconder elementos admin-only
    setTimeout(() => location.reload(), 500);
}

// ── UI Auth ──────────────────────────────────────────────────

function updateAuthUI() {
    const logged = isLoggedIn();
    const isTournamentAdmin = isAdmin();

    // Nav
    document.getElementById('btnOpenLogin').classList.toggle('hidden', logged);
    document.getElementById('navUser').classList.toggle('hidden', !logged);
    if (logged) {
        const displayName = (authState.currentUser.displayName || '').trim();
        const roleText = roleLabel(authState.currentUser.role);
        const usernameEl = document.getElementById('navUsername');

        usernameEl.textContent = displayName;
        // Evita informação redundante quando nome e função são iguais.
        const duplicatedLabel = displayName.toLowerCase() === roleText.toLowerCase();
        usernameEl.classList.toggle('hidden', duplicatedLabel);
    }

    // Botões de adicionar conforme permissões
    const addPlayerBtn = document.getElementById('btnShowPlayerForm');
    const addTeamBtn   = document.getElementById('btnShowTeamForm');
    addPlayerBtn.classList.toggle('hidden', !can('players_manage'));
    addTeamBtn.classList.toggle('hidden', !can('teams_manage'));

    // Esconder formulários se não tiver permissão de edição
    if (!can('players_manage')) {
        document.getElementById('playerForm').classList.add('hidden');
    }
    if (!can('teams_manage')) {
        document.getElementById('teamForm').classList.add('hidden');
    }

    // Secções admin-only
    const adminOnlyEls = document.querySelectorAll('.admin-only');
    adminOnlyEls.forEach(el => {
        el.classList.toggle('hidden', !isTournamentAdmin);
    });

    // Secções auth-only
    document.querySelectorAll('.auth-only').forEach(el => {
        el.classList.toggle('hidden', !logged);
    });

    // Tabs por permissão
    const tabJogadoresBtn = document.querySelector('.tab-btn[data-tab="jogadores"]');
    const tabConfigBtn = document.querySelector('.tab-btn[data-tab="configuracoes"]');
    if (tabJogadoresBtn) tabJogadoresBtn.classList.toggle('hidden', !canAccessTab('jogadores'));
    if (tabConfigBtn) tabConfigBtn.classList.toggle('hidden', !canAccessTab('configuracoes'));

    const tabJogadoresPane = document.getElementById('tab-jogadores');
    const tabConfigPane = document.getElementById('tab-configuracoes');
    if (tabJogadoresPane) tabJogadoresPane.classList.toggle('hidden', !canAccessTab('jogadores'));
    if (tabConfigPane) tabConfigPane.classList.toggle('hidden', !canAccessTab('configuracoes'));

    const activeBtn = document.querySelector('.tab-btn.active');
    if (activeBtn && !canAccessTab(activeBtn.dataset.tab)) {
        const fallbackBtn = document.querySelector('.tab-btn[data-tab="classificacao"]');
        if (fallbackBtn) fallbackBtn.click();
    }

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
            if (authState.currentUser.mustResetPassword) {
                showToast('Password de recuperação ativa. Altere a password em Configurações.', 'warn');
            }
            // Reload após login bem-sucedido para mostrar elementos admin-only
            setTimeout(() => location.reload(), 500);
        } else {
            const foundUser = getUserByUsername(username);
            errEl.textContent = (foundUser && !foundUser.passwordHash)
                ? 'Utilizador sem password definida. Peça reset ao administrador.'
                : 'Utilizador ou palavra-passe incorrectos.';
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
    // Token só vive na sessão atual do browser (não persiste após fechar).
    document.getElementById('githubToken').value = sessionStorage.getItem(GITHUB_TOKEN_SESSION_KEY) || '';
    // Limpa token legado guardado em localStorage (versões antigas).
    localStorage.removeItem('gh-token');
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

        // Guardar token apenas na sessão atual
        sessionStorage.setItem(GITHUB_TOKEN_SESSION_KEY, token);

        // Sincronizar dados
        saveState();
        saveGameResults();
        saveCalendar();
        saveRoundDates();
        saveAuth();

        const usersSnapshot = getUsersBackupSnapshot();

        const dataToExport = {
            players: state.players,
            teams: state.teams,
            gameResults: state.gameResults,
            calendar: state.calendar,
            roundDates: state.roundDates,
            auth: {
                users: usersSnapshot
            },
            // Compatibilidade com versões antigas
            users: usersSnapshot
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
function renderUsers() {
    if (!isAdmin()) return;

    const list = document.getElementById('usersList');
    if (!list) return;

    const sorted = [...authState.users].sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt'));

    if (!sorted.length) {
        list.innerHTML = `<div class="empty-state"><p>Sem utilizadores configurados.</p></div>`;
        return;
    }

    list.innerHTML = sorted.map(u => {
        const isCurrent = authState.currentUser && authState.currentUser.username === u.username;
        const canDelete = normalizeUsername(u.username) !== 'admin' && !isCurrent;
        const adminCount = authState.users.filter(x => normalizeRole(x.role) === ROLES.TOURNAMENT_ADMIN).length;
        const role = normalizeRole(u.role);
        const canDemote = !(role === ROLES.TOURNAMENT_ADMIN && adminCount <= 1);

        return `
            <div class="user-item">
                <div class="user-info">
                    <span class="user-name">${esc(u.displayName)}</span>
                    <span class="user-meta">@${esc(u.username)} ${isCurrent ? '<span class="current-user-tag">(sessão atual)</span>' : ''}</span>
                    ${!u.passwordHash ? '<span class="current-user-tag">Reset de password pendente</span>' : ''}
                </div>
                <div class="user-actions">
                    <select class="role-select" data-user-id="${u.id}" ${isCurrent ? 'disabled' : ''}>
                        <option value="${ROLES.TOURNAMENT_MANAGER}" ${role === ROLES.TOURNAMENT_MANAGER ? 'selected' : ''}>Tournament Manager</option>
                        <option value="${ROLES.SCORING_OFFICIAL}" ${role === ROLES.SCORING_OFFICIAL ? 'selected' : ''}>Scoring Official</option>
                        <option value="${ROLES.TOURNAMENT_ADMIN}" ${role === ROLES.TOURNAMENT_ADMIN ? 'selected' : ''}>Tournament Admin</option>
                    </select>
                    <button class="btn btn-sm btn-ghost btn-reset-user-pwd" data-user-id="${u.id}">Definir Password</button>
                    <button class="btn btn-sm btn-danger btn-delete-user" data-user-id="${u.id}" ${canDelete ? '' : 'disabled'}>Remover</button>
                    ${canDemote ? '' : '<span class="current-user-tag">Admin obrigatório</span>'}
                </div>
            </div>`;
    }).join('');

    list.querySelectorAll('.role-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            updateUserRole(e.target.dataset.userId, e.target.value);
        });
    });

    list.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            deleteUser(e.target.dataset.userId);
        });
    });

    list.querySelectorAll('.btn-reset-user-pwd').forEach(btn => {
        btn.addEventListener('click', (e) => {
            resetUserPassword(e.target.dataset.userId);
        });
    });
}

function resetUserPassword(userId) {
    if (!can('users_manage')) return;
    const user = authState.users.find(u => u.id === userId);
    if (!user) return;

    const newPwd = prompt(`Nova password para ${user.displayName} (mínimo 6 caracteres):`);
    if (newPwd === null) return;

    const next = newPwd.trim();
    if (next.length < 6) {
        showToast('A password deve ter pelo menos 6 caracteres.', 'error');
        return;
    }

    user.passwordHash = hashPassword(next);
    user.mustResetPassword = false;

    if (authState.currentUser && authState.currentUser.id === user.id) {
        authState.currentUser.mustResetPassword = false;
    }

    saveAuth();
    renderUsers();
    showToast('Password redefinida com sucesso.');
}

function saveNewUser() {
    if (!can('users_manage')) return;

    const displayName = document.getElementById('inputNewDisplayName').value.trim();
    const username = normalizeUsername(document.getElementById('inputNewUsername').value);
    const password = document.getElementById('inputNewPassword').value;
    const role = normalizeRole(document.getElementById('inputNewRole').value);

    if (!displayName || !username || !password) {
        showToast('Preencha nome, utilizador e palavra-passe.', 'error');
        return;
    }
    if (!/^[a-z0-9._-]{3,}$/.test(username)) {
        showToast('Utilizador inválido (mín. 3, apenas a-z, 0-9, . _ -).', 'error');
        return;
    }
    if (password.length < 6) {
        showToast('A palavra-passe deve ter pelo menos 6 caracteres.', 'error');
        return;
    }
    if (getUserByUsername(username)) {
        showToast('Já existe um utilizador com esse nome.', 'error');
        return;
    }

    authState.users.push({
        id: genId(),
        username,
        displayName,
        role,
        passwordHash: hashPassword(password),
        mustResetPassword: false
    });

    saveAuth();
    document.getElementById('newUserForm').classList.add('hidden');
    document.getElementById('inputNewDisplayName').value = '';
    document.getElementById('inputNewUsername').value = '';
    document.getElementById('inputNewPassword').value = '';
    document.getElementById('inputNewRole').value = ROLES.TOURNAMENT_MANAGER;
    renderUsers();
    showToast('Utilizador criado com sucesso.');
}

function updateUserRole(userId, nextRole) {
    if (!can('users_manage')) return;
    const user = authState.users.find(u => u.id === userId);
    if (!user) return;

    const role = normalizeRole(nextRole);
    if (user.role === role) return;

    const adminCount = authState.users.filter(u => normalizeRole(u.role) === ROLES.TOURNAMENT_ADMIN).length;
    if (normalizeRole(user.role) === ROLES.TOURNAMENT_ADMIN && role !== ROLES.TOURNAMENT_ADMIN && adminCount <= 1) {
        showToast('Tem de existir pelo menos um administrador.', 'error');
        renderUsers();
        return;
    }

    user.role = role;

    if (authState.currentUser && authState.currentUser.id === user.id) {
        authState.currentUser.role = role;
    }

    saveAuth();
    updateAuthUI();
    renderUsers();
    showToast('Função atualizada.');
}

function deleteUser(userId) {
    if (!can('users_manage')) return;
    const user = authState.users.find(u => u.id === userId);
    if (!user) return;

    if (normalizeUsername(user.username) === 'admin') {
        showToast('O utilizador admin base não pode ser removido.', 'error');
        return;
    }

    if (authState.currentUser && authState.currentUser.id === userId) {
        showToast('Não pode remover o utilizador com sessão ativa.', 'error');
        return;
    }

    if (!confirm(`Remover o utilizador ${user.displayName}?`)) return;

    authState.users = authState.users.filter(u => u.id !== userId);
    saveAuth();
    renderUsers();
    showToast('Utilizador removido.');
}

function changeOwnPassword() {
    if (!isLoggedIn()) return;

    const currentPwd = document.getElementById('inputCurrentPwd').value;
    const newPwd = document.getElementById('inputNewPwd').value;
    const confirmPwd = document.getElementById('inputConfirmPwd').value;

    if (!currentPwd || !newPwd || !confirmPwd) {
        showToast('Preencha todos os campos da palavra-passe.', 'error');
        return;
    }
    if (newPwd.length < 6) {
        showToast('A nova palavra-passe deve ter pelo menos 6 caracteres.', 'error');
        return;
    }
    if (newPwd !== confirmPwd) {
        showToast('A confirmação da palavra-passe não coincide.', 'error');
        return;
    }

    const currentUser = authState.users.find(u => u.id === authState.currentUser.id);
    if (!currentUser) {
        showToast('Utilizador atual não encontrado.', 'error');
        return;
    }

    if (currentUser.passwordHash !== hashPassword(currentPwd)) {
        showToast('Palavra-passe atual incorreta.', 'error');
        return;
    }

    currentUser.passwordHash = hashPassword(newPwd);
    currentUser.mustResetPassword = false;
    if (authState.currentUser && authState.currentUser.id === currentUser.id) {
        authState.currentUser.mustResetPassword = false;
    }

    saveAuth();
    document.getElementById('inputCurrentPwd').value = '';
    document.getElementById('inputNewPwd').value = '';
    document.getElementById('inputConfirmPwd').value = '';
    showToast('Palavra-passe alterada com sucesso.');
}

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
        // SI é fixo do Estela Golf Club (não editável via JSON)
        state.strokeIndex = [...DEFAULT_SI];
    } catch (e) { console.error('Erro ao carregar dados:', e); }
}

async function loadDataBackup() {
    // Sempre tenta carregar o backup mais recente do servidor
    try {
        const response = await fetch('data-backup.json?t=' + Date.now()); // Cache busting
        if (!response.ok) return false;
        
        const data = await response.json();
        if (data.players && data.teams) {
            const importedRoundDates = data.roundDates && typeof data.roundDates === 'object'
                ? data.roundDates
                : { ...DEFAULT_RONDA_DATES };

            const importedUsersRaw = Array.isArray(data.auth?.users)
                ? data.auth.users
                : (Array.isArray(data.users) ? data.users : []);
            const importedUsers = hydrateUsersFromBackup(importedUsersRaw);

            // Carregar dados do servidor (sem permitir SI customizado)
            const sanitizedData = {
                players: data.players,
                teams: data.teams,
                gameResults: data.gameResults || [],
                calendar: data.calendar || [],
                roundDates: importedRoundDates
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedData));
            localStorage.setItem(STORAGE_KEY + '-results', JSON.stringify(data.gameResults || []));
            localStorage.setItem(STORAGE_KEY + '-calendar', JSON.stringify(data.calendar || []));
            localStorage.setItem(STORAGE_KEY + '-round-dates', JSON.stringify(importedRoundDates));

            if (importedUsers.length) {
                const authPayload = {
                    currentUser: null,
                    users: importedUsers
                };
                localStorage.setItem(AUTH_KEY, JSON.stringify(authPayload));
            }

            state.players = data.players;
            state.teams = data.teams;
            state.strokeIndex = [...DEFAULT_SI];
            state.gameResults = data.gameResults || [];
            state.calendar = data.calendar || [];
            state.roundDates = importedRoundDates;
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
    const dataToSave = {
        players: state.players,
        teams: state.teams,
        gameResults: state.gameResults,
        calendar: state.calendar
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
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
            if (!canAccessTab(target)) {
                showToast('Sem permissões para aceder a este separador.', 'error');
                return;
            }
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${target}`).classList.add('active');
            if (target === 'calcular') refreshCalcSelects();
            if (target === 'regulamento') { renderSIGrids(); }
            if (target === 'configuracoes' && can('users_manage')) { renderUsers(); }
            if (target === 'grupos')   { renderGrupos(); }
            if (target === 'equipas') renderTeams();
            if (target === 'calendario') renderCalendario();
            if (target === 'classificacao') { 
                const val = document.getElementById('selRondaClass').value;
                renderClassificacao(val === 'total' ? 'total' : (parseInt(val, 10) || 1));
            }
            if (target !== 'equipas') {
                teamNavReturnTab = null;
                teamNavTargetTeamId = null;
            }
        });
    });
}

function getTeamReturnLabel(compact = false) {
    if (compact) {
        return TEAM_NAV_RETURN_SHORT_LABELS[teamNavReturnTab] || TEAM_NAV_RETURN_SHORT_LABELS.calendario;
    }
    return TEAM_NAV_RETURN_LABELS[teamNavReturnTab] || TEAM_NAV_RETURN_LABELS.calendario;
}

function returnFromTeamNavigation() {
    const targetTab = teamNavReturnTab || 'calendario';
    const targetTabBtn = document.querySelector(`.tab-btn[data-tab="${targetTab}"]`);
    if (!targetTabBtn) return;

    teamNavReturnTab = null;
    teamNavTargetTeamId = null;
    renderTeams();
    targetTabBtn.click();
}

// ════════════════════════════════════════════════════════════
//  JOGADORES
// ════════════════════════════════════════════════════════════

function renderPlayers() {
    const el = document.getElementById('playersList');
    if (!state.players.length) {
        el.innerHTML = `<div class="empty-state">
            <p>Nenhum jogador registado.</p>
            <p class="empty-hint">${can('players_manage') ? 'Clique em "+ Adicionar Jogador" para começar.' : 'Sem permissões para gerir jogadores.'}</p>
        </div>`;
        return;
    }
    const sorted = [...state.players].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    el.innerHTML = sorted.map(p => `
        <div class="card player-card">
            <div class="player-info">
                <span class="player-name">${esc(p.name)} <span class="player-gender-symbol">${p.genero === 'M' ? '♂' : p.genero === 'F' ? '♀' : ''}</span></span>
                <span class="player-fednum">${p.numeroFederado ? `FPG: ${esc(p.numeroFederado)}` : '—'}</span>
                <div class="player-handicaps">
                    <span class="player-hcp">WHS: <strong>${p.handicapWhs !== undefined && p.handicapWhs !== null && p.handicapWhs !== '' ? parseFloat(p.handicapWhs).toFixed(1) : '—'}</strong></span>
                    <span class="player-hcp">Jogo: <strong>${p.handicap}</strong></span>
                </div>
            </div>
            ${can('players_manage') ? `
            <div class="player-actions">
                <button class="btn btn-sm btn-ghost" onclick="openEditPlayer('${p.id}')">Editar</button>
                <button class="btn btn-sm btn-danger" onclick="deletePlayer('${p.id}')">✕</button>
            </div>` : ''}
        </div>
    `).join('');
}

function openAddPlayer() {
    if (!isLoggedIn()) { openLoginModal(); return; }
    if (!can('players_manage')) { showToast('Sem permissões para gerir jogadores.', 'error'); return; }
    document.getElementById('playerFormTitle').textContent = 'Novo Jogador';
    document.getElementById('inputPlayerName').value = '';
    document.getElementById('inputPlayerName').value = '';
    document.getElementById('inputPlayerNumFederado').value = '';
    document.getElementById('inputPlayerHcpWhs').value = '';
    document.getElementById('inputPlayerGenero').value = '';
    document.getElementById('playerEditId').value    = '';
    document.getElementById('displayPlayerHcp').textContent = '—';
    document.getElementById('playerForm').classList.remove('hidden');
    document.getElementById('inputPlayerName').focus();
}

function openEditPlayer(id) {
    if (!isLoggedIn()) { openLoginModal(); return; }
    if (!can('players_manage')) { showToast('Sem permissões para editar jogadores.', 'error'); return; }
    const p = getPlayer(id);
    if (!p) return;
    document.getElementById('playerFormTitle').textContent = 'Editar Jogador';
    document.getElementById('inputPlayerName').value = p.name;
    document.getElementById('inputPlayerNumFederado').value = p.numeroFederado || '';
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
    if (!can('players_manage')) { showToast('Sem permissões para guardar jogadores.', 'error'); return; }
    const name           = document.getElementById('inputPlayerName').value.trim();
    const numeroFederado = document.getElementById('inputPlayerNumFederado').value.trim();
    const hcpWhsRaw      = document.getElementById('inputPlayerHcpWhs').value;
    const genero         = document.getElementById('inputPlayerGenero').value;
    const hcpWhs         = parseFloat(hcpWhsRaw);
    const editId         = document.getElementById('playerEditId').value;

    if (!name)                            { showToast('Insira o nome do jogador.', 'error');              return; }
    if (hcpWhsRaw === '' || isNaN(hcpWhs))   { showToast('Insira o Handicap WHS válido.', 'error');       return; }
    if (!genero)                         { showToast('Selecione o gênero do jogador.', 'error');       return; }
    if (hcpWhs < -10 || hcpWhs > 54)     { showToast('Handicap WHS deve estar entre -10 e 54.', 'error'); return; }

    // Calcular HCP de Jogo automaticamente
    const hcpJogo = calculateGameHandicap(hcpWhs, genero);

    if (editId) {
        const p = getPlayer(editId);
        if (p) { p.name = name; p.numeroFederado = numeroFederado; p.handicapWhs = hcpWhs; p.handicap = hcpJogo; p.genero = genero; }
    } else {
        state.players.push({ id: genId(), name, numeroFederado, handicapWhs: hcpWhs, handicap: hcpJogo, genero });
    }
    saveState();
    document.getElementById('playerForm').classList.add('hidden');
    renderPlayers();
    showToast(editId ? 'Jogador actualizado.' : 'Jogador adicionado.');
}

function deletePlayer(id) {
    if (!can('players_manage')) return;
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
            <p class="empty-hint">${can('teams_manage') ? 'Clique em "+ Nova Equipa" para criar uma equipa.' : 'Sem permissões para gerir equipas.'}</p>
        </div>`;
        return;
    }
    const sortedTeams = [...state.teams].sort((a, b) => {
        const playersA = (a.playerIds || []).map(pid => getPlayer(pid)).filter(Boolean);
        const playersB = (b.playerIds || []).map(pid => getPlayer(pid)).filter(Boolean);

        const avgA = playersA.length ? playersA.reduce((sum, p) => sum + Number(p.handicap || 0), 0) / playersA.length : Number.POSITIVE_INFINITY;
        const avgB = playersB.length ? playersB.reduce((sum, p) => sum + Number(p.handicap || 0), 0) / playersB.length : Number.POSITIVE_INFINITY;

        if (avgA !== avgB) return avgA - avgB;
        return a.name.localeCompare(b.name, 'pt');
    });

    el.innerHTML = sortedTeams.map(t => {
        const allPlayers = (t.playerIds || []).map(pid => getPlayer(pid)).filter(Boolean);
        
        // Separa o capitão dos outros
        const captain = allPlayers.find(p => p.id === t.captainId);
        const otherPlayers = allPlayers.filter(p => p.id !== t.captainId);
        
        // Ordena os outros alfabeticamente
        otherPlayers.sort((a, b) => a.name.localeCompare(b.name, 'pt'));
        
        // Coloca o capitão primeiro
        const sortedPlayers = captain ? [captain, ...otherPlayers] : otherPlayers;
        
        // Calcular HCP Equipa (média dos HCP de Campo)
        const teamHcp = sortedPlayers.length > 0 
            ? (sortedPlayers.reduce((sum, p) => sum + p.handicap, 0) / sortedPlayers.length).toFixed(1)
            : '—';
        
        const rows = sortedPlayers.length
            ? sortedPlayers.map(p => {
                const isCaptain = p.id === t.captainId;
                return `<li class="team-player-item ${isCaptain ? 'is-captain' : ''}">
                    <span class="name">${isCaptain ? '⭐ ' : ''}${esc(p.name)}</span>
                    <span class="hcp">HCP Campo ${p.handicap}</span>
                </li>`;
            }).join('')
            : '<li class="team-player-item"><span style="color:#9ca3af">Sem jogadores associados</span></li>';

        const showReturnButton = !!teamNavReturnTab && teamNavTargetTeamId === t.id;
        const returnButtonHtml = showReturnButton
            ? `<button class="btn btn-sm btn-ghost team-nav-back-btn" onclick="returnFromTeamNavigation()">${esc(getTeamReturnLabel(true))}</button>`
            : '';
        const managementButtons = can('teams_manage')
            ? `<button class="btn btn-sm btn-ghost" onclick="openEditTeam('${t.id}')">Editar</button>
               <button class="btn btn-sm btn-danger" onclick="deleteTeam('${t.id}')">✕</button>`
            : '';
        const teamActions = (returnButtonHtml || managementButtons)
            ? `<div class="team-actions">${returnButtonHtml}${managementButtons}</div>`
            : '';

        return `
            <div class="card team-card" id="team-card-${t.id}" data-team-id="${t.id}">
                <div class="team-card-header">
                    <div class="team-header-info">
                        <span class="team-name">${esc(t.name)}</span>
                        <span class="team-hcp">HCP Médio: ${teamHcp}</span>
                    </div>
                    ${teamActions}
                </div>
                <ul class="team-players-list">${rows}</ul>
            </div>`;
    }).join('');
}

function openTeamFromClassification(teamId, sourceTab = 'calendario') {
    if (!teamId) return;

    teamNavReturnTab = sourceTab;
    teamNavTargetTeamId = teamId;

    const tabBtn = document.querySelector('.tab-btn[data-tab="equipas"]');
    if (!tabBtn) return;

    tabBtn.click();
    renderTeams();

    let attempts = 0;
    const maxAttempts = 8;
    const tryFocus = () => {
        const card = document.getElementById(`team-card-${teamId}`);
        if (!card) {
            attempts += 1;
            if (attempts < maxAttempts) setTimeout(tryFocus, 70);
            return;
        }

        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('team-highlight');
        setTimeout(() => card.classList.remove('team-highlight'), 1400);
    };

    setTimeout(tryFocus, 50);
}

function openAddTeam() {
    if (!isLoggedIn()) { openLoginModal(); return; }
    if (!can('teams_manage')) { showToast('Sem permissões para gerir equipas.', 'error'); return; }
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
    if (!can('teams_manage')) { showToast('Sem permissões para editar equipas.', 'error'); return; }
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
    if (!can('teams_manage')) { showToast('Sem permissões para guardar equipas.', 'error'); return; }
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
    if (!can('teams_manage')) return;
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

    const teamAId = document.getElementById('selTeamA').value;
    const teamBId = document.getElementById('selTeamB').value;
    const teamA = state.teams.find(t => t.id === teamAId);
    const teamB = state.teams.find(t => t.id === teamBId);
    const pA1 = getPlayer(document.getElementById('selA1').value);
    const pA2 = getPlayer(document.getElementById('selA2').value);
    const pB1 = getPlayer(document.getElementById('selB1').value);
    const pB2 = getPlayer(document.getElementById('selB2').value);

    // Tenta identificar a ronda/par no calendário para as duas equipas selecionadas.
    const match = state.calendar.find(g =>
        (g.home === teamA?.name && g.away === teamB?.name) ||
        (g.home === teamB?.name && g.away === teamA?.name)
    );

    const roundText = match?.ronda ? `${match.ronda}ª Ronda` : 'Ronda: não definida';
    const groupText = match?.grupo ? `Grupo ${match.grupo}` : 'Grupo: —';
    const parText = match?.par ? `Par ${match.par}` : 'Par: —';
    const teamAText = teamA?.name || '—';
    const teamBText = teamB?.name || '—';
    const pairAText = pA1 && pA2 ? `${pA1.name} e ${pA2.name}` : '—';
    const pairBText = pB1 && pB2 ? `${pB1.name} e ${pB2.name}` : '—';
    
    // Clonar a tabela para não modificar a original
    const tableClone = table.cloneNode(true);
    const tableHtml = tableClone.outerHTML;
    
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
                .match-meta { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; margin: 12px 0 14px; background: #f8fafc; }
                .match-meta p { margin: 4px 0; font-size: 12px; color: #334155; }
                .match-meta strong { color: #0f172a; }
                .print-ticket { margin-bottom: 18px; }
                .cut-line {
                    margin: 16px 0 18px;
                    border-top: 2px dashed #9ca3af;
                    text-align: center;
                    color: #6b7280;
                    font-size: 11px;
                    padding-top: 6px;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                }
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
                    .print-ticket { break-inside: avoid; }
                    .cut-line { break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <section class="print-ticket">
                <h1>⛳ Distribuição por Buracos</h1>
                <div class="print-info">Taça Manuel André 2026 · Estela Golf Club</div>
                <div class="match-meta">
                    <p><strong>${roundText}</strong> · <strong>${groupText}</strong> · <strong>${parText}</strong></p>
                    <p><strong>Equipa A:</strong> ${esc(teamAText)} | <strong>Par A:</strong> ${esc(pairAText)}</p>
                    <p><strong>Equipa B:</strong> ${esc(teamBText)} | <strong>Par B:</strong> ${esc(pairBText)}</p>
                </div>
                ${tableHtml}
                <p style="margin-top: 20px; font-size: 11px; color: #666;">
                    <strong>Legenda:</strong> Os buracos a verde (●) recebem pancada(s) de abono. Múltiplos pontos (●●) indicam múltiplas pancadas no mesmo buraco.
                </p>
            </section>

            <div class="cut-line">Linha de recorte</div>

            <section class="print-ticket">
                <h1>⛳ Distribuição por Buracos</h1>
                <div class="print-info">Taça Manuel André 2026 · Estela Golf Club</div>
                <div class="match-meta">
                    <p><strong>${roundText}</strong> · <strong>${groupText}</strong> · <strong>${parText}</strong></p>
                    <p><strong>Equipa A:</strong> ${esc(teamAText)} | <strong>Par A:</strong> ${esc(pairAText)}</p>
                    <p><strong>Equipa B:</strong> ${esc(teamBText)} | <strong>Par B:</strong> ${esc(pairBText)}</p>
                </div>
                ${tableHtml}
                <p style="margin-top: 20px; font-size: 11px; color: #666;">
                    <strong>Legenda:</strong> Os buracos a verde (●) recebem pancada(s) de abono. Múltiplos pontos (●●) indicam múltiplas pancadas no mesmo buraco.
                </p>
            </section>
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
    return `<div class="si-cell"><span class="hole-num">B${idx+1}</span><input type="number" value="${state.strokeIndex[idx]}" min="1" max="18" disabled></div>`;
}

// ════════════════════════════════════════════════════════════
//  EXPORTAR / IMPORTAR / LIMPAR (admin only)
// ════════════════════════════════════════════════════════════

function exportData() {
    if (!can('data_manage')) return;
    // Sincroniza o state com localStorage antes de exportar
    saveState();
    saveGameResults();
    saveCalendar();
    saveRoundDates();
    saveAuth();

    const usersSnapshot = getUsersBackupSnapshot();
    
    // Exporta o state completo incluindo calendar e gameResults
    const dataToExport = {
        players: state.players,
        teams: state.teams,
        gameResults: state.gameResults,
        calendar: state.calendar,
        roundDates: state.roundDates,
        auth: {
            users: usersSnapshot
        },
        // Compatibilidade com versões antigas
        users: usersSnapshot
    };
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {href:url, download:'taca-manuel-andre-2026.json'});
    a.click(); URL.revokeObjectURL(url);
    showToast('Dados exportados.');
}

function importData(file) {
    if (!can('data_manage') || !file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const p = JSON.parse(e.target.result);

            if (Array.isArray(p.players)) state.players = p.players;
            if (Array.isArray(p.teams)) state.teams = p.teams;
            if (Array.isArray(p.gameResults)) state.gameResults = p.gameResults;
            if (Array.isArray(p.calendar)) state.calendar = p.calendar;
            if (p.roundDates && typeof p.roundDates === 'object') state.roundDates = p.roundDates;

            const importedUsersRaw = Array.isArray(p.auth?.users)
                ? p.auth.users
                : (Array.isArray(p.users) ? p.users : null);

            if (importedUsersRaw) {
                authState.users = hydrateUsersFromBackup(importedUsersRaw);
            }

            if (authState.currentUser) {
                const refreshedCurrent = authState.users.find(u => normalizeUsername(u.username) === normalizeUsername(authState.currentUser.username));
                authState.currentUser = refreshedCurrent
                    ? {
                        id: refreshedCurrent.id,
                        username: refreshedCurrent.username,
                        displayName: refreshedCurrent.displayName,
                        role: normalizeRole(refreshedCurrent.role),
                        mustResetPassword: !!refreshedCurrent.mustResetPassword
                    }
                    : null;
            }

            ensureDefaultAdminUser();
            state.strokeIndex = [...DEFAULT_SI];
            initializeRoundDates();
            initializeCalendar();

            saveAuth();
            saveGameResults();
            saveCalendar();
            saveRoundDates();

            saveState();
            renderPlayers();
            renderTeams();
            renderSIGrids();
            renderUsers();
            renderCalendario();

            const selectedRound = document.getElementById('selRondaClass')?.value || 'total';
            renderClassificacao(selectedRound === 'total' ? 'total' : parseInt(selectedRound, 10));
            updateAuthUI();
            showToast('Dados importados com sucesso.');
        } catch { showToast('Ficheiro inválido ou corrompido.', 'error'); }
    };
    reader.readAsText(file);
}

function clearAll() {
    if (!can('data_manage')) return;
    if (!confirm('Apagar todos os dados do torneio?\nEsta acção não pode ser desfeita.')) return;
    state = {
        players: [],
        teams: [],
        strokeIndex: [...DEFAULT_SI],
        gameResults: [],
        calendar: CALENDAR_DATA.map(g => ({ ...g })),
        roundDates: { ...DEFAULT_RONDA_DATES }
    };
    saveCalendar();
    saveRoundDates();
    saveState(); renderPlayers(); renderTeams(); renderSIGrids();
    document.getElementById('calcResult').classList.add('hidden');
    showToast('Todos os dados foram apagados.');
}

// ════════════════════════════════════════════════════════════
//  CLASSIFICAÇÃO
// ════════════════════════════════════════════════════════════

// Datas de cada ronda
const DEFAULT_RONDA_DATES = {
    1: '2026-06-21',
    2: '2026-07-26',
    3: '2026-08-30',
    4: '2026-09-27',
    5: '2026-10-25',
    6: '2026-11-15',
    7: '2026-11-29',
    8: '2026-12-13'
};

const ROUND_DATE_ORDER = [1, 2, 3, 4, 5, 6, 7, 8];
const MONTHS_PT = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function normalizeMonthName(value) {
    return (value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function parseLegacyRoundDateToISO(value) {
    const cleaned = (value || '').trim().replace(/^ate\s+/i, '');
    const m = cleaned.match(/(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]+)/i);
    if (!m) return null;

    const day = parseInt(m[1], 10);
    const monthName = normalizeMonthName(m[2]);
    const monthIdx = MONTHS_PT.indexOf(monthName);
    if (!day || monthIdx < 0) return null;

    const mm = String(monthIdx + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `2026-${mm}-${dd}`;
}

function normalizeRoundDateValue(ronda, value) {
    const raw = (value || '').trim();
    if (!raw) return DEFAULT_RONDA_DATES[ronda];
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return parseLegacyRoundDateToISO(raw) || DEFAULT_RONDA_DATES[ronda];
}

function formatRoundDateLabel(ronda, isoDate) {
    const normalized = normalizeRoundDateValue(ronda, isoDate);
    const d = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '';

    const day = d.getDate();
    const month = MONTHS_PT[d.getMonth()];
    const text = `${day} de ${month}`;
    return ronda <= 5 ? `Até ${text}` : text;
}

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

function saveRoundDates() {
    localStorage.setItem(STORAGE_KEY + '-round-dates', JSON.stringify(state.roundDates));
}

function loadRoundDates() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY + '-round-dates');
        state.roundDates = { ...DEFAULT_RONDA_DATES };
        if (!raw) return;

        const parsed = JSON.parse(raw);
        ROUND_DATE_ORDER.forEach(r => {
            if (typeof parsed[r] === 'string' && parsed[r].trim()) {
                state.roundDates[r] = normalizeRoundDateValue(r, parsed[r]);
            }
        });
    } catch (e) {
        console.error('loadRoundDates:', e);
        state.roundDates = { ...DEFAULT_RONDA_DATES };
    }
}

function initializeCalendar() {
    if (!state.calendar.length) {
        state.calendar = CALENDAR_DATA.map(g => ({ ...g }));
        saveCalendar();
    }
}

function initializeRoundDates() {
    if (!state.roundDates || !Object.keys(state.roundDates).length) {
        state.roundDates = { ...DEFAULT_RONDA_DATES };
        saveRoundDates();
        return;
    }
    ROUND_DATE_ORDER.forEach(r => {
        state.roundDates[r] = normalizeRoundDateValue(r, state.roundDates[r]);
    });
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
    // Segurança: só perfis com permissão podem alterar resultados.
    if (!can('classification_manage')) return false;

    const existing = getGameResult(ronda, par, home, away);
    if (existing) {
        existing.result = result;
    } else {
        state.gameResults.push({ ronda, par, home, away, result });
    }
    saveGameResults();
    return true;
}

function setParScore(ronda, par, home, away, score) {
    if (!can('classification_manage')) return false;
    const existing = getGameResult(ronda, par, home, away);
    if (existing) {
        existing.score = score;
    } else {
        state.gameResults.push({ ronda, par, home, away, result: null, score });
    }
    saveGameResults();
    return true;
}

// Guarda todos os scores visíveis antes de qualquer re-render
function saveAllPendingScores() {
    if (!can('classification_manage')) return;
    document.querySelectorAll('.group-score-input, .elim-score-input').forEach(input => {
        const ronda = parseInt(input.dataset.ronda, 10);
        const par = parseInt(input.dataset.par, 10);
        const home = input.dataset.home;
        const away = input.dataset.away;
        const score = input.value.trim();
        const existing = getGameResult(ronda, par, home, away);
        if (existing) {
            existing.score = score;
        } else if (score) {
            state.gameResults.push({ ronda, par, home, away, result: null, score });
        }
    });
    saveGameResults();
}

function parseScoreXY(scoreStr) {
    if (!scoreStr) return 0;
    const s = scoreStr.trim();
    if (s === '1') return 1;
    if (s === '2') return 2;
    const m = s.match(/^(\d+)&(\d+)$/);
    if (m) return parseInt(m[1], 10) + parseInt(m[2], 10);
    return 0;
}

function isValidScore(v) {
    if (!v) return false;
    const s = v.trim();
    if (s === '1' || s === '2') return true;
    const m = s.match(/^(\d+)&(\d+)$/);
    if (m) {
        const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
        return a >= 1 && a <= 10 && b >= 0 && b <= 8;
    }
    return false;
}

function validateScoreInput(input) {
    const rb = input.closest('.result-buttons');
    if (!rb) return;
    const hasActive = !!rb.querySelector('.btn-result.active');
    input.classList.toggle('score-input-error', hasActive && !isValidScore(input.value.trim()));
}

function isGroupStageGame(game) {
    return game && game.ronda >= 1 && game.ronda <= 5 && ['A', 'B', 'C', 'D'].includes(game.grupo);
}

function resultPoints(result) {
    if (result === 'home') return { home: 3, away: 0 };
    if (result === 'away') return { home: 0, away: 3 };
    if (result === 'draw') return { home: 1, away: 1 };
    return { home: 0, away: 0 };
}

function getTeamAverageHandicap(teamName) {
    const team = state.teams.find(t => t.name === teamName);
    if (!team || !team.playerIds || team.playerIds.length === 0) return 999; // Fallback
    
    const handicaps = team.playerIds
        .map(playerId => state.players.find(p => p.id === playerId))
        .filter(p => p && p.handicapWhs)
        .map(p => p.handicapWhs);
    
    if (handicaps.length === 0) return 999;
    return handicaps.reduce((sum, h) => sum + h, 0) / handicaps.length;
}

function applyGroupTieBreak(groupTeams, group, gamesForScope) {
    const pointBuckets = new Map();

    groupTeams.forEach(team => {
        if (!pointBuckets.has(team.points)) pointBuckets.set(team.points, []);
        pointBuckets.get(team.points).push(team);
    });

    const orderedPoints = [...pointBuckets.keys()].sort((a, b) => b - a);
    const ranked = [];

    orderedPoints.forEach(pointsValue => {
        const bucket = [...pointBuckets.get(pointsValue)];
        if (bucket.length === 1) {
            ranked.push(bucket[0]);
            return;
        }

        const tiedNames = new Set(bucket.map(t => t.name));
        const h2h = {};
        bucket.forEach(t => {
            h2h[t.name] = { points: 0, diff: 0 };
        });

        gamesForScope.forEach(game => {
            if (game.grupo !== group) return;
            if (!tiedNames.has(game.home) || !tiedNames.has(game.away)) return;
            const gameResult = getGameResult(game.ronda, game.par, game.home, game.away);
            if (!gameResult || !gameResult.result) return;

            const pts = resultPoints(gameResult.result);
            h2h[game.home].points += pts.home;
            h2h[game.away].points += pts.away;
            h2h[game.home].diff += (pts.home - pts.away);
            h2h[game.away].diff += (pts.away - pts.home);
        });

        bucket.sort((a, b) => {
            if (h2h[b.name].points !== h2h[a.name].points) return h2h[b.name].points - h2h[a.name].points;
            if (h2h[b.name].diff !== h2h[a.name].diff) return h2h[b.name].diff - h2h[a.name].diff;
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.scoreXY !== a.scoreXY) return b.scoreXY - a.scoreXY;
            if (b.draws !== a.draws) return b.draws - a.draws;

            // Tiebreaker: Lower average handicap wins
            const avgHandicapA = getTeamAverageHandicap(a.name);
            const avgHandicapB = getTeamAverageHandicap(b.name);
            return avgHandicapA - avgHandicapB; // Lower handicap wins (comes first)
        });

        ranked.push(...bucket);
    });

    return ranked;
}

function isGroupStageFullyScored() {
    const groupStageGames = state.calendar.filter(isGroupStageGame);
    if (!groupStageGames.length) return false;
    return groupStageGames.every(game => {
        const result = getGameResult(game.ronda, game.par, game.home, game.away);
        return !!(result && result.result);
    });
}

// Get winner of a playoff match by searching game results directly
function getEliminationMatchWinner(ronda, matchNo, home, away) {
    if (!home || !away) return null;
    if (home.startsWith('Vencedor') || away.startsWith('Vencedor')) return null;
    
    // Count wins and accumulate X+Y for each team
    let homeWins = 0, awayWins = 0;
    let homeXY = 0, awayXY = 0;
    for (let par = 1; par <= 2; par++) {
        const result = getGameResult(ronda, par, home, away);
        if (result && result.result) {
            if (result.result === 'home') { homeWins++; homeXY += parseScoreXY(result.score); }
            if (result.result === 'away') { awayWins++; awayXY += parseScoreXY(result.score); }
        }
    }
    
    if (homeWins > awayWins) return home;
    if (awayWins > homeWins) return away;
    // 1-1: tiebreaker by X+Y sum
    if (homeXY > awayXY) return home;
    if (awayXY > homeXY) return away;
    return null;
}

// Build playoff schedule without recursion
function buildPlayoffScheduleEntriesUncached() {
    // Always calculate standings even if group stage isn't fully scored
    // This allows teams to advance as results come in
    const standings = calculateStandings(5, true);

    const a1 = standings?.A?.[0]?.name || '1ºA';
    const a2 = standings?.A?.[1]?.name || '2ºA';
    const b1 = standings?.B?.[0]?.name || '1ºB';
    const b2 = standings?.B?.[1]?.name || '2ºB';
    const c1 = standings?.C?.[0]?.name || '1ºC';
    const c2 = standings?.C?.[1]?.name || '2ºC';
    const d1 = standings?.D?.[0]?.name || '1ºD';
    const d2 = standings?.D?.[1]?.name || '2ºD';

    // Get winners from quarter-finals (ronda 6) - pass explicit names
    const w1 = getEliminationMatchWinner(6, 1, a1, b2) || 'Vencedor 1';
    const w2 = getEliminationMatchWinner(6, 2, b1, a2) || 'Vencedor 2';
    const w3 = getEliminationMatchWinner(6, 3, c1, d2) || 'Vencedor 3';
    const w4 = getEliminationMatchWinner(6, 4, d1, c2) || 'Vencedor 4';
    
    // Get winners from semi-finals (ronda 7)
    const w5 = getEliminationMatchWinner(7, 5, w1, w3) || 'Vencedor 5';
    const w6 = getEliminationMatchWinner(7, 6, w2, w4) || 'Vencedor 6';

    const finalMatches = [
        { ronda: 6, grupo: '1', matchNo: 1, home: a1, away: b2 },
        { ronda: 6, grupo: '2', matchNo: 2, home: b1, away: a2 },
        { ronda: 6, grupo: '3', matchNo: 3, home: c1, away: d2 },
        { ronda: 6, grupo: '4', matchNo: 4, home: d1, away: c2 },
        { ronda: 7, grupo: '5', matchNo: 5, home: w1, away: w3 },
        { ronda: 7, grupo: '6', matchNo: 6, home: w2, away: w4 },
        { ronda: 8, grupo: '7', matchNo: 7, home: w5, away: w6 }
    ];

    const entries = [];
    finalMatches.forEach(match => {
        entries.push({ ...match, par: 1 });
        entries.push({ ...match, par: 2 });
    });

    return entries;
}

function buildPlayoffScheduleEntries() {
    return buildPlayoffScheduleEntriesUncached();
}

function getRoundLabel(ronda) {
    if (ronda === 6) return 'Quartos de Final';
    if (ronda === 7) return 'Meias-finais';
    if (ronda === 8) return 'Final';
    return `${ronda}ª Ronda`;
}

function renderRoundDatesEditor() {
    if (!can('calendar_manage')) return '';

    const rows = ROUND_DATE_ORDER.map(ronda => `
        <div class="form-field" style="margin-bottom:.4rem;">
            <label for="roundDate-${ronda}">${getRoundLabel(ronda)}</label>
            <input id="roundDate-${ronda}" type="date" value="${esc(state.roundDates[ronda] || DEFAULT_RONDA_DATES[ronda] || '')}">
        </div>
    `).join('');

    return `
        <div class="card" style="margin-bottom:1.25rem;">
            <h3>Datas das Rondas</h3>
            <p class="config-desc">Admin e Tournament Manager podem editar as datas da fase de grupos e fase final.</p>
            <div class="form-grid">${rows}</div>
            <div class="form-footer">
                <button class="btn btn-primary" id="btnSaveRoundDates">Guardar Datas</button>
                <button class="btn btn-ghost" id="btnResetRoundDates">Repor Padrão</button>
            </div>
        </div>
    `;
}

function bindRoundDatesEditorEvents() {
    const btnSave = document.getElementById('btnSaveRoundDates');
    const btnReset = document.getElementById('btnResetRoundDates');
    if (!btnSave || !btnReset) return;

    btnSave.addEventListener('click', () => {
        ROUND_DATE_ORDER.forEach(ronda => {
            const input = document.getElementById(`roundDate-${ronda}`);
            const v = (input?.value || '').trim();
            state.roundDates[ronda] = normalizeRoundDateValue(ronda, v);
        });
        saveRoundDates();
        renderCalendario();
        showToast('Datas atualizadas.');
    });

    btnReset.addEventListener('click', () => {
        state.roundDates = { ...DEFAULT_RONDA_DATES };
        saveRoundDates();
        renderCalendario();
        showToast('Datas repostas para o padrão.');
    });
}

function buildEliminationClassificationHtml(ronda) {
    const games = buildPlayoffScheduleEntries().filter(g => g.ronda === ronda);
    const grouped = new Map();

    games.forEach(game => {
        if (!grouped.has(game.grupo)) grouped.set(game.grupo, []);
        grouped.get(game.grupo).push(game);
    });

    let html = `
        <div class="ronda-block-highlight ronda-block-elim ronda-block-r${ronda}">
            <h3 class="class-title">${getRoundLabel(ronda)}</h3>
    `;

    [...grouped.keys()].sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).forEach(matchNo => {
        const matchGames = grouped.get(matchNo).sort((a, b) => a.par - b.par);
        if (!matchGames.length) return;

        const home = matchGames[0].home;
        const away = matchGames[0].away;

        let homeWins = 0;
        let awayWins = 0;
        let hasAnyResult = false;
        const canManageClassification = can('classification_manage');

        matchGames.forEach(g => {
            const res = getGameResult(g.ronda, g.par, g.home, g.away);
            if (!res || !res.result) return;
            hasAnyResult = true;
            if (res.result === 'home') homeWins++;
            if (res.result === 'away') awayWins++;
        });

        const matchComplete = homeWins + awayWins > 0;
        const winner = homeWins > awayWins ? home : (awayWins > homeWins ? away : null);
        const nextRoundLabel = getRoundLabel(ronda + 1);
        
        // For final, use different language
        const progressLabel = ronda === 8 ? '🏆 CAMPEÃ!' : `Apurada para ${nextRoundLabel}`;

        html += `
            <div class="card elim-match-card">
                <h4 class="elim-match-title">Match ${matchNo}: ${esc(home)} vs ${esc(away)}</h4>
                <div class="games-input elim-games-input">
        `;

        matchGames.forEach(game => {
            const result = getGameResult(game.ronda, game.par, game.home, game.away);
            html += `
                <div class="game-result-row elim-game-result-row">
                    <span class="team-name elim-par-label">Par ${game.par}</span>
                    <span class="team-name elim-team-name">${esc(game.home)}</span>
                    <div class="result-buttons${canManageClassification ? '' : ' result-buttons-readonly'}">
                        ${canManageClassification ? `
                        <button class="btn-result ${result && result.result === 'home' ? 'active' : ''}" data-ronda="${game.ronda}" data-par="${game.par}" data-home="${game.home}" data-away="${game.away}" data-result="home">Vence</button>
                        <button class="btn-result btn-result-draw ${result && result.result === 'draw' ? 'active' : ''}" data-ronda="${game.ronda}" data-par="${game.par}" data-home="${game.home}" data-away="${game.away}" data-result="draw">A/S</button>
                        <button class="btn-result ${result && result.result === 'away' ? 'active' : ''}" data-ronda="${game.ronda}" data-par="${game.par}" data-home="${game.home}" data-away="${game.away}" data-result="away">Perde</button>
                        <input type="text" class="elim-score-input${result && result.result === 'draw' ? ' score-input-na' : (result && result.result) && !isValidScore(result && result.score ? result.score : '') ? ' score-input-error' : ''}" data-ronda="${game.ronda}" data-par="${game.par}" data-home="${game.home}" data-away="${game.away}" placeholder="${result && result.result === 'draw' ? 'N/A' : 'ex: 3&2'}" value="${result && result.result === 'draw' ? '' : esc(result && result.score ? result.score : '')}" ${result && result.result === 'draw' ? 'disabled' : ''} maxlength="10">
                        <button class="btn-result-clear" data-ronda="${game.ronda}" data-par="${game.par}" data-home="${game.home}" data-away="${game.away}">Del</button>
                        ` : (result && result.score ? `<span class="elim-score-display">${esc(result.score)}</span>` : '')}
                    </div>
                    <span class="team-name elim-team-name">${esc(game.away)}</span>
                </div>
            `;
        });

        // Add winner/progress section
        if (matchComplete && winner) {
            html += `
                <div class="elim-match-result">
                    <div class="winner-badge">${progressLabel}</div>
            `;
            
            // Special celebration for final
            if (ronda === 8) {
                html += `
                    <div class="celebration-text">CAMPEÃO DE MATCH PLAY DA TAÇA MANUEL ANDRÉ 2026!</div>
                    <div class="final-celebration">
                        <div class="celebration-emojis">🎉 🏆</div>
                        <div class="winner-name-celebration">${esc(winner)}</div>
                        <div class="celebration-emojis">🏆 🎊</div>
                    </div>
                `;
            } else {
                html += `
                    <div class="winner-name">${esc(winner)}</div>
                `;
            }
            
            html += `
                </div>
            `;
        }

        html += `
                </div>
            </div>
        `;
    });

    html += '</div>';
    return html;
}

function buildEliminationBlockHtml() {
    return `
        <div class="class-group" style="margin-top:2rem;">
            <h3 class="class-title">Fase a Eliminar</h3>
            <p class="class-desc" style="margin-bottom:1rem;">Resultados dos Quartos de Final, Meias-finais e Final.</p>
        </div>
        ${buildEliminationClassificationHtml(6)}
        ${buildEliminationClassificationHtml(7)}
        ${buildEliminationClassificationHtml(8)}
    `;
}

function calculateStandings(ronda, accumulate) {
    // ronda: número da ronda; accumulate: true = soma todas as rondas até ronda
    
    const standings = { A: [], B: [], C: [], D: [] };
    
    // Inicializar com equipas que têm grupo definido
    state.teams.forEach(team => {
        if (team.grupo && ['A', 'B', 'C', 'D'].includes(team.grupo)) {
            standings[team.grupo].push({
                id: team.id,
                name: team.name,
                grupo: team.grupo,
                points: 0,
                pointsFor: 0,
                pointsAgainst: 0,
                played: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                scoreXY: 0
            });
        }
    });
    
    // Calcular pontos baseado nos resultados
    // accumulate=true: todas as rondas até ronda; false: só a ronda exacta
    const games = state.calendar.filter(g => {
        if (!isGroupStageGame(g)) return false;
        return accumulate ? g.ronda <= ronda : g.ronda === ronda;
    });
    
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
                    homeTeam.pointsFor += 3;
                    homeTeam.pointsAgainst += 0;
                    homeTeam.scoreXY += parseScoreXY(gameResult.score);
                    awayTeam.pointsFor += 0;
                    awayTeam.pointsAgainst += 3;
                    awayTeam.losses++;
                } else if (result === 'away') {
                    awayTeam.wins++;
                    awayTeam.points += 3;
                    awayTeam.pointsFor += 3;
                    awayTeam.pointsAgainst += 0;
                    awayTeam.scoreXY += parseScoreXY(gameResult.score);
                    homeTeam.pointsFor += 0;
                    homeTeam.pointsAgainst += 3;
                    homeTeam.losses++;
                } else if (result === 'draw') {
                    homeTeam.draws++;
                    homeTeam.points += 1;
                    homeTeam.pointsFor += 1;
                    homeTeam.pointsAgainst += 1;
                    awayTeam.draws++;
                    awayTeam.points += 1;
                    awayTeam.pointsFor += 1;
                    awayTeam.pointsAgainst += 1;
                }
            }
        }
    });
    
    // Ordenar por pontos + desempate (fase de grupos)
    Object.keys(standings).forEach(grupo => {
        standings[grupo] = applyGroupTieBreak(standings[grupo], grupo, games);
    });
    
    return standings;
}

function renderClassificacao(ronda) {
    // Recarregar resultados do localStorage
    loadGameResults();
    const showScheduledGamesColumn = can('classification_manage');

    const rondaNum = parseInt(ronda, 10);
    if (ronda !== 'total' && !isNaN(rondaNum) && rondaNum >= 6) {
        document.getElementById('classificacaoContainer').innerHTML = buildEliminationClassificationHtml(rondaNum);

        if (can('classification_manage')) {
            document.querySelectorAll('.btn-result').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const rr = parseInt(e.target.dataset.ronda, 10);
                    const par = parseInt(e.target.dataset.par, 10);
                    const home = e.target.dataset.home;
                    const away = e.target.dataset.away;
                    const result = e.target.dataset.result;

                    saveAllPendingScores();
                    if (!setGameResult(rr, par, home, away, result)) return;
                    const selectedView = document.getElementById('selRondaClass').value;
                    renderClassificacao(selectedView === 'total' ? 'total' : parseInt(selectedView, 10));
                    showToast(`Resultado registado - Par ${par}: ${home} vs ${away}`);
                });
            });

            document.querySelectorAll('.btn-result-clear').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const rr = parseInt(e.target.dataset.ronda, 10);
                    const par = parseInt(e.target.dataset.par, 10);
                    const home = e.target.dataset.home;
                    const away = e.target.dataset.away;

                    saveAllPendingScores();
                    if (!setGameResult(rr, par, home, away, null)) return;
                    const selectedView = document.getElementById('selRondaClass').value;
                    renderClassificacao(selectedView === 'total' ? 'total' : parseInt(selectedView, 10));
                    showToast(`Resultado limpo - Par ${par}: ${home} vs ${away}`);
                });
            });

            document.querySelectorAll('.elim-score-input').forEach(input => {
                if (input.disabled) return;
                input.addEventListener('input', (e) => {
                    const target = e.target;
                    if (isValidScore(target.value.trim())) {
                        target.classList.remove('score-input-error');
                        clearTimeout(target._validTimer);
                    } else {
                        clearTimeout(target._validTimer);
                        target._validTimer = setTimeout(() => validateScoreInput(target), 600);
                    }
                });
                input.addEventListener('change', (e) => {
                    const rr = parseInt(e.target.dataset.ronda, 10);
                    const par = parseInt(e.target.dataset.par, 10);
                    const home = e.target.dataset.home;
                    const away = e.target.dataset.away;
                    const score = e.target.value.trim();
                    setParScore(rr, par, home, away, score);
                    const selView = document.getElementById('selRondaClass').value;
                    renderClassificacao(selView === 'total' ? 'total' : parseInt(selView, 10));
                });
            });
        }
        return;
    }
    
    // Se ronda === 'total', calcular soma das 5 rondas (acumulado)
    // Convert ronda to number for comparison (dropdown sends strings like '1', '2', etc.)
    const standings = ronda === 'total' ? calculateStandings(5, true) : calculateStandings(parseInt(ronda, 10), false);
    let html = '';
    
    Object.keys(standings).sort().forEach(grupo => {
        const teams = standings[grupo];
        // Total: acumula todas as rondas; ronda específica: só jogos dessa ronda
        let groupGames = ronda === 'total'
            ? state.calendar.filter(g => g.grupo === grupo)
            : state.calendar.filter(g => g.ronda === ronda && g.grupo === grupo);
        
        // Agrupar por match (mesmas equipas)
        const matchGroups = new Map();
        groupGames.forEach(game => {
            const matchKey = [game.home, game.away].sort().join('|');
            if (!matchGroups.has(matchKey)) matchGroups.set(matchKey, []);
            matchGroups.get(matchKey).push(game);
        });
        
        // Ordenar dentro de cada grupo por par, depois ordenar grupos por ronda e matchKey
        groupGames = Array.from(matchGroups.entries())
            .sort((a, b) => {
                const gamesA = a[1], gamesB = b[1];
                if (ronda === 'total') {
                    if (gamesA[0].ronda !== gamesB[0].ronda) return gamesA[0].ronda - gamesB[0].ronda;
                }
                return a[0].localeCompare(b[0]);
            })
            .flatMap(([, games]) => games.sort((a, b) => a.par - b.par));
        
        html += `
        <div class="class-group">
            <h3 class="class-title">Grupo ${grupo}</h3>
            <table class="class-table">
                <thead>
                    <tr>
                        <th style="width:5%">Pos</th>
                        <th style="width:40%">Equipa</th>
                        ${showScheduledGamesColumn ? '<th style="width:12%" title="Soma X+Y das vitórias (desempate)">X&amp;Y</th>' : ''}
                        <th style="width:12%">V</th>
                        <th style="width:12%">E</th>
                        <th style="width:12%">D</th>
                        <th style="width:10%">Pts</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        teams.forEach((team, idx) => {
            const isQualified = ronda === 'total' && idx < 2; // First 2 teams in group stage qualify
            const rowClass = isQualified ? 'class-row-qualified' : '';
            const teamNameStyle = isQualified ? 'style="color: #b8860b; font-weight: bold; font-size: 1.05rem;"' : '';
            
            html += `
                    <tr class="${rowClass}">
                        <td>${idx + 1}</td>
                        <td><button type="button" class="class-team-link" data-team-id="${team.id}" ${teamNameStyle}><strong>${esc(team.name)}</strong></button></td>
                        ${showScheduledGamesColumn ? `<td>${team.scoreXY}</td>` : ''}
                        <td>${team.wins}</td>
                        <td>${team.draws}</td>
                        <td>${team.losses}</td>
                        <td><strong>${team.points}</strong></td>
                    </tr>
            `;
        });
        
        // Mostrar equipas em folga (0 jogos nesta ronda/total)
        const teamsResting = teams.filter(t => t.played === 0);
        
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
        if (can('classification_manage')) {
            html += `
            <div class="games-input" style="margin-top:1.5rem;">
                <h4 style="margin-bottom:0.75rem; color:var(--primary);">Registar Resultados dos Jogos:</h4>
            `;
            
            let lastRonda = null;
            groupGames.forEach(game => {
                // Adicionar cabeçalho quando muda de ronda (modo total)
                if (ronda === 'total' && game.ronda !== lastRonda) {
                    if (lastRonda !== null) html += `</div>`; // Fechar div anterior
                    html += `<div style="margin-top:1rem; padding-top:0.75rem; border-top:2px solid var(--border);"><h5 style="margin:0 0 0.75rem 0; color:var(--primary); font-size:0.95rem;">Ronda ${game.ronda}</h5>`;
                    lastRonda = game.ronda;
                }
                const result = getGameResult(game.ronda, game.par, game.home, game.away);
                const isKnockoutRound = game.ronda >= 6;
                const homeTeam = state.teams.find(t => t.name === game.home);
                const awayTeam = state.teams.find(t => t.name === game.away);
                const homeLabel = homeTeam
                    ? `<button type="button" class="class-team-link" data-team-id="${homeTeam.id}">${esc(game.home)}</button>`
                    : esc(game.home);
                const awayLabel = awayTeam
                    ? `<button type="button" class="class-team-link" data-team-id="${awayTeam.id}">${esc(game.away)}</button>`
                    : esc(game.away);
                const resultHtml = `
                <div class="game-result-row">
                    <span class="team-name result-par-label">Par ${game.par}</span>
                    <span class="team-name result-team-a"><span class="team-ab-label">A:</span>${homeLabel}</span>
                    <div class="result-buttons">
                        <button class="btn-result ${result && result.result === 'home' ? 'active' : ''}" data-ronda="${game.ronda}" data-par="${game.par}" data-home="${game.home}" data-away="${game.away}" data-result="home">Vence A</button>
                        <button class="btn-result btn-result-draw ${result && result.result === 'draw' ? 'active' : ''}" data-ronda="${game.ronda}" data-par="${game.par}" data-home="${game.home}" data-away="${game.away}" data-result="draw">A/S</button>
                        <button class="btn-result ${result && result.result === 'away' ? 'active' : ''}" data-ronda="${game.ronda}" data-par="${game.par}" data-home="${game.home}" data-away="${game.away}" data-result="away">Vence B</button>
                        <input type="text" class="group-score-input${result && result.result === 'draw' ? ' score-input-na' : (result && result.result) && !isValidScore(result && result.score ? result.score : '') ? ' score-input-error' : ''}" data-ronda="${game.ronda}" data-par="${game.par}" data-home="${game.home}" data-away="${game.away}" placeholder="${result && result.result === 'draw' ? 'N/A' : '2&1'}" value="${result && result.result === 'draw' ? '' : esc(result && result.score ? result.score : '')}" ${result && result.result === 'draw' ? 'disabled' : ''} maxlength="10">
                        <button class="btn-result-clear btn-del" data-ronda="${game.ronda}" data-par="${game.par}" data-home="${game.home}" data-away="${game.away}">Del</button>
                    </div>
                    <span class="team-name result-team-b"><span class="team-ab-label">B:</span>${awayLabel}</span>
                </div>
                `;
                html += resultHtml;
            });
            
            if (ronda === 'total' && lastRonda !== null) html += `</div>`;
            
            html += `
            </div>
            `;
        }
        
        html += `
        </div>
        `;
    });
    
    if (ronda === 'total') {
        html += buildEliminationBlockHtml();
    }

    document.getElementById('classificacaoContainer').innerHTML = html;

    document.querySelectorAll('.class-team-link[data-team-id]').forEach(link => {
        link.addEventListener('click', () => {
            openTeamFromClassification(link.dataset.teamId, 'classificacao');
        });
    });
    
    // Adicionar listeners aos botões de resultado (apenas se admin)
    if (can('classification_manage')) {
        document.querySelectorAll('.btn-result').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ronda = parseInt(e.target.dataset.ronda, 10);
                const par = parseInt(e.target.dataset.par, 10);
                const home = e.target.dataset.home;
                const away = e.target.dataset.away;
                const result = e.target.dataset.result;
                
                saveAllPendingScores();
                if (!setGameResult(ronda, par, home, away, result)) return;
                const selectedView = document.getElementById('selRondaClass').value;
                renderClassificacao(selectedView === 'total' ? 'total' : parseInt(selectedView, 10));
                showToast(`Resultado registado - Par ${par}: ${home} vs ${away}`);
            });
        });
        
        // Adicionar listeners ao botão "Del"
        document.querySelectorAll('.btn-result-clear').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ronda = parseInt(e.target.dataset.ronda, 10);
                const par = parseInt(e.target.dataset.par, 10);
                const home = e.target.dataset.home;
                const away = e.target.dataset.away;
                
                saveAllPendingScores();
                if (!setGameResult(ronda, par, home, away, null)) return;
                const selectedView = document.getElementById('selRondaClass').value;
                renderClassificacao(selectedView === 'total' ? 'total' : parseInt(selectedView, 10));
                showToast(`Resultado limpo - Par ${par}: ${home} vs ${away}`);
            });
        });

        document.querySelectorAll('.group-score-input').forEach(input => {
            if (input.disabled) return;
            input.addEventListener('input', (e) => {
                const target = e.target;
                if (isValidScore(target.value.trim())) {
                    target.classList.remove('score-input-error');
                    clearTimeout(target._validTimer);
                } else {
                    clearTimeout(target._validTimer);
                    target._validTimer = setTimeout(() => validateScoreInput(target), 600);
                }
            });
            input.addEventListener('change', (e) => {
                const ronda = parseInt(e.target.dataset.ronda, 10);
                const par = parseInt(e.target.dataset.par, 10);
                const home = e.target.dataset.home;
                const away = e.target.dataset.away;
                const score = e.target.value.trim();
                setParScore(ronda, par, home, away, score);
                const selView = document.getElementById('selRondaClass').value;
                renderClassificacao(selView === 'total' ? 'total' : parseInt(selView, 10));
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
    const isAdminUser = can('groups_manage');
    
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
                        <button type="button" class="grupo-team-link" data-team-id="${team.id}">${esc(team.name)}</button>
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
                        <button type="button" class="grupo-team-link" data-team-id="${team.id}">${esc(team.name)}</button>
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

    container.querySelectorAll('.grupo-team-link[data-team-id]').forEach(link => {
        link.addEventListener('click', () => {
            openTeamFromClassification(link.dataset.teamId, 'grupos');
        });
    });
    
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

    const calendarEntries = [...state.calendar.filter(isGroupStageGame), ...buildPlayoffScheduleEntries()];
    const rondes = [...new Set(calendarEntries.map(g => g.ronda))].sort((a, b) => a - b);
    let html = '';

    rondes.forEach(ronda => {
        const rondaGames = calendarEntries.filter(g => g.ronda === ronda);
        if (!rondaGames.length) return;

        const gruposDaRonda = ronda <= 5
            ? ['A', 'B', 'C', 'D']
            : [...new Set(rondaGames.map(g => g.grupo))].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

        const extraRoundClass = ronda === 7
            ? ' ronda-block-highlight ronda-block-semi'
            : ronda === 8
                ? ' ronda-block-highlight ronda-block-final'
                : '';

        html += `<div class="ronda-block${extraRoundClass}">
            <div class="ronda-header">
                <span class="ronda-num">${getRoundLabel(ronda)}</span>
                <span class="ronda-date">${formatRoundDateLabel(ronda, state.roundDates[ronda])}</span>
            </div>
            <div class="grupos-grid">`;

        gruposDaRonda.forEach(grupo => {
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
                <h4 class="grupo-title">${ronda <= 5 ? `Grupo ${grupo}` : `Match ${grupo}`}</h4>
                <ul class="jogos-list">`;

            matchups.forEach((games, key) => {
                const [home, away] = key.split('|||');
                const shouldValidateTeams = ronda <= 5;
                const homeExists = !shouldValidateTeams || state.teams.some(t => t.name === home);
                const awayExists = !shouldValidateTeams || state.teams.some(t => t.name === away);
                const invalid = shouldValidateTeams && (!homeExists || !awayExists);
                const homeTeam = state.teams.find(t => t.name === home);
                const awayTeam = state.teams.find(t => t.name === away);

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

                const scoreLabel = hasAnyResult
                    ? `<span class="jogo-score${isDraw ? ' score-draw' : ''}">${homeScore}–${awayScore}</span>`
                    : `<span class="jogo-vs">VS</span>`;

                const homeClass = hasAnyResult ? (homeWins ? ' team-winner' : isDraw ? '' : ' team-loser') : '';
                const awayClass = hasAnyResult ? (awayWins ? ' team-winner' : isDraw ? '' : ' team-loser') : '';
                const homeLabel = homeTeam
                    ? `<button type="button" class="calendar-team-link team-home${homeClass}" data-team-id="${homeTeam.id}">${esc(home)}</button>`
                    : `<span class="team-home${homeClass}">${esc(home)}</span>`;
                const awayLabel = awayTeam
                    ? `<button type="button" class="calendar-team-link team-away${awayClass}" data-team-id="${awayTeam.id}">${esc(away)}</button>`
                    : `<span class="team-away${awayClass}">${esc(away)}</span>`;

                html += `<li class="jogo${invalid ? ' jogo-invalid' : ''}${hasAnyResult ? ' jogo-done' : ''}">
                    <div class="jogo-teams">
                        ${homeLabel}
                        ${scoreLabel}
                        ${awayLabel}
                        ${invalid ? '<span class="jogo-warning" title="Uma ou ambas as equipas não existem">⚠️</span>' : ''}
                        ${(can('calendar_manage') && ronda <= 5) ? `<button class="btn-del-match" data-ronda="${ronda}" data-home="${esc(home)}" data-away="${esc(away)}">✕</button>` : ''}
                    </div>
                </li>`;
            });

            html += `</ul></div>`;
        });

        html += `</div></div>`;
    });

    // Adicionar Datas das Rondas no final
    html += renderRoundDatesEditor();

    if (!html) {
        html = `<div class="empty-state"><p>Calendário vazio. ${can('calendar_manage') ? 'Use o formulário abaixo para adicionar jogos.' : ''}</p></div>`;
    }

    container.innerHTML = html;
    bindRoundDatesEditorEvents();

    container.querySelectorAll('.calendar-team-link[data-team-id]').forEach(link => {
        link.addEventListener('click', () => {
            openTeamFromClassification(link.dataset.teamId, 'calendario');
        });
    });

    // Listeners para remover jogos (admin)
    if (can('calendar_manage')) {
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
    if (!can('calendar_manage')) return;
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
    loadRoundDates();
    // Recalcular todos os handicaps de jogo baseado no WHS
    recalculateAllGameHandicaps();
    loadAuth();
    initializeTestData();
    initializeCalendar();
    initializeRoundDates();
    // ensureDefaultAdmin() removed - using fixed admin credentials

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
    renderUsers();
    updateAuthUI();
});
