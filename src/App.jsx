import { useState, useEffect, useMemo, useCallback } from "react";

// ── SUPABASE CONFIG ───────────────────────────────────────────────────────────
const SB_URL = "https://eiihpyzihiqhhwirqwxe.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpaWhweXppaGlxaGh3aXJxd3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3ODA4MTUsImV4cCI6MjA4OTM1NjgxNX0.7DBHSMAOBUcrEPbpWIq9z87SQlXyxFbV2i98a2boW_s";

const sbFetch = async (path, opts = {}) => {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      "apikey": SB_KEY,
      "Authorization": `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      "Prefer": opts.prefer || "return=representation",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || res.statusText);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const db = {
  getUsers:       ()         => sbFetch("usuarios?select=*&order=criado_em.asc"),
  getUserByEmail: (email)    => sbFetch(`usuarios?email=eq.${encodeURIComponent(email)}&select=*`),
  insertUser:     (u)        => sbFetch("usuarios", { method: "POST", body: JSON.stringify(u) }),
  updateUser:     (id, data) => sbFetch(`usuarios?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteUser:     (id)       => sbFetch(`usuarios?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }),
  getProdutos:    ()         => sbFetch("produtos_catalogo?select=*&order=nome.asc"),
  insertProduto:  (p)        => sbFetch("produtos_catalogo", { method: "POST", body: JSON.stringify(p) }),
  updateProduto:  (id, data) => sbFetch(`produtos_catalogo?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProduto:  (id)       => sbFetch(`produtos_catalogo?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer: "return=minimal" }),
  getCategorias:              ()        => sbFetch("categorias_produto?ativo=eq.true&select=*&order=nome.asc"),
  insertCategoria:            (data)    => sbFetch("categorias_produto", { method:"POST", body:JSON.stringify(data) }),
  getSolicitacoesCategorias:  ()        => sbFetch("solicitacoes_categoria?select=*&order=criado_em.desc"),
  insertSolicitacaoCategoria: (data)    => sbFetch("solicitacoes_categoria", { method:"POST", body:JSON.stringify(data) }),
  updateSolicitacaoCategoria: (id,data) => sbFetch(`solicitacoes_categoria?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),
  getProdutosByPrefixo:       (prefix)  => sbFetch(`produtos_catalogo?id=like.${encodeURIComponent(prefix+'*')}&select=id&order=id.desc`),
  getRegistros:   (userId)   => sbFetch(`registros?or=(user_id.eq.${encodeURIComponent(userId)},compartilhado.is.true)&select=*&order=criado_em.desc`)
    .then(rows=>(rows||[]).map(r=>({id:r.id,nome:r.nome,pastaId:r.pasta_id??null,compartilhado:!!r.compartilhado,userId:r.user_id,data:new Date(r.criado_em).toLocaleString("pt-BR"),d:r.dados?.d,calcs:r.dados?.calcs}))),
  getPastasRegistros: (userId) => sbFetch(`pastas_registros?or=(user_id.eq.${encodeURIComponent(userId)},compartilhado.is.true)&select=*&order=nome.asc`)
    .then(rows=>(rows||[]).map(p=>({id:p.id,nome:p.nome,pai:p.pai_id??null,compartilhado:!!p.compartilhado,userId:p.user_id}))),
  insertRegistro: (userId, nome, pastaId, compartilhado, d, calcs) => sbFetch("registros", { method:"POST", body:JSON.stringify({user_id:String(userId),nome,pasta_id:pastaId||null,compartilhado:!!compartilhado,dados:{d,calcs}}) }),
  updateRegistro: (id, data) => sbFetch(`registros?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),
  deleteRegistro: (id)       => sbFetch(`registros?id=eq.${id}`, { method:"DELETE", prefer:"return=minimal" }),
  insertPastaRegistro: (userId, nome, paiId, compartilhado) => sbFetch("pastas_registros", { method:"POST", body:JSON.stringify({user_id:String(userId),nome,pai_id:paiId||null,compartilhado:!!compartilhado}) }),
  updatePastaRegistro: (id, data) => sbFetch(`pastas_registros?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(data) }),
  deletePastaRegistro: (id)       => sbFetch(`pastas_registros?id=eq.${id}`, { method:"DELETE", prefer:"return=minimal" }),
};

// ── STORAGE (sessão local apenas) ─────────────────────────────────────────────
const KEYS = { session: "ptc_session", perfis: "ptc_perfis" };

// ── MÓDULOS disponíveis no sistema ──
const MODULOS = [
  { id: "precificacao", label: "Precificação Completa", icone: "🧮", desc: "Calculadora tributária completa — todos os tabs e campos.", ativo: true },
  { id: "relatorios",   label: "Relatórios",            icone: "📈", desc: "Em desenvolvimento.", ativo: false },
  { id: "cadastro",     label: "Cadastro de Produtos",  icone: "📦", desc: "Cadastro de produtos com índices padrão.", ativo: true },
  { id: "sap",          label: "Interface SAP",         icone: "🔗", desc: "Em desenvolvimento.", ativo: false },
];

const PERFIS_DEFAULT = [
  { id: "admin",    label: "Administrador",       icone: "⚙️",  cor: "#0047BB", desc: "Acesso total ao sistema. Gerencia usuários e perfis.", modulos: ["precificacao","cadastro"], sistema: true  },
  { id: "custos",   label: "Depto. de Custos",    icone: "📊", cor: "#059669", desc: "Acesso completo à calculadora.", modulos: ["precificacao"], sistema: false },
];

const loadPerfis = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(KEYS.perfis) || "null");
    if (!stored) return PERFIS_DEFAULT;
    // Perfis sistema sempre usam a definição do código (garante módulos atualizados após deploy)
    const sistemaMap = Object.fromEntries(PERFIS_DEFAULT.filter(p => p.sistema).map(p => [p.id, p]));
    const storedIds = stored.map(p => p.id);
    const updated = stored.map(p => sistemaMap[p.id] ? { ...p, ...sistemaMap[p.id] } : p);
    const missing = PERFIS_DEFAULT.filter(p => p.sistema && !storedIds.includes(p.id));
    return missing.length > 0 ? [...updated, ...missing] : updated;
  } catch { return PERFIS_DEFAULT; }
};
const savePerfis = (p) => localStorage.setItem(KEYS.perfis, JSON.stringify(p));
const getPerfisMap = (list) => Object.fromEntries((list||[]).map(p => [p.id, p]));
const PERFIS = getPerfisMap(PERFIS_DEFAULT);

const loadSession  = () => { try { return JSON.parse(localStorage.getItem(KEYS.session) || "null"); } catch { return null; } };
const saveSession  = (s) => s ? localStorage.setItem(KEYS.session, JSON.stringify(s)) : localStorage.removeItem(KEYS.session);

// ── HELPERS ──────────────────────────────────────────────────────────────────
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
const initials = (nome) => nome ? nome.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase() : "?";

// ── CSS ──────────────────────────────────────────────────────────────────────
const CSS_AUTH = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#2C2A29;color:#f0f0f0;font-family:'Montserrat',Arial,Helvetica,sans-serif;min-height:100vh;overflow-x:hidden}
input,select,textarea,button{font-family:inherit}

/* ── TOKENS ── */
:root{
  --bg:       #2C2A29;
  --surface:  #201f1e;
  --card:     #252322;
  --border:   rgba(255,255,255,.08);
  --border2:  rgba(255,255,255,.13);
  --text:     #f0f0f0;
  --muted:    #A7A8AA;
  --blue:     #3CDBC0;
  --blue2:    #2bc4ab;
  --blue-glow:rgba(60,219,192,.25);
}

/* ── LAYOUT ── */
.root{min-height:100vh;display:flex;flex-direction:column}

/* ── AUTH SCREEN ── */
.auth-wrap{
  min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(ellipse 80% 60% at 50% 0%, rgba(60,219,192,.12) 0%, transparent 70%),
             radial-gradient(ellipse 40% 40% at 80% 80%, rgba(60,219,192,.05) 0%, transparent 60%),
             #2C2A29;
  padding:24px;
}
.auth-box{
  width:100%;max-width:420px;
  background:rgba(37,35,34,.92);
  border:1px solid var(--border2);
  backdrop-filter:blur(20px);
  padding:0;
  position:relative;
  overflow:hidden;
  animation:fadeUp .4s ease;
}
.auth-box::before{
  content:'';position:absolute;top:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg,#3CDBC0,#2bc4ab,#3CDBC0);
}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}

.auth-head{padding:32px 32px 0;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}
.auth-logo{display:flex;align-items:center;gap:10px}
.auth-mark{width:36px;height:36px;background:#3CDBC0;display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-size:18px;font-weight:800;color:#2C2A29}
.auth-brand{font-family:'Montserrat',sans-serif;font-size:20px;font-weight:800;color:#fff;letter-spacing:.5px}
.auth-title{font-family:'Montserrat',sans-serif;font-size:22px;font-weight:700;color:#fff;margin-top:8px}
.auth-sub{font-size:13px;color:var(--muted);line-height:1.5}

.auth-body{padding:28px 32px 32px;display:flex;flex-direction:column;gap:16px}
.auth-tabs{display:flex;border:1px solid var(--border);background:rgba(255,255,255,.03);margin-bottom:4px}
.auth-tab{flex:1;padding:10px;background:none;border:none;color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;transition:.15s;letter-spacing:.3px}
.auth-tab.on{background:var(--blue);color:#2C2A29}
.auth-tab:hover:not(.on){color:var(--text);background:rgba(255,255,255,.04)}

.fld{display:flex;flex-direction:column;gap:6px}
.fld label{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.8px}
.fld input,.fld select{
  background:#2C2A29;border:1px solid var(--border2);color:var(--text);
  padding:11px 14px;font-size:14px;outline:none;transition:.15s;
  font-family:'Montserrat',sans-serif;
}
.fld input:focus,.fld select:focus{border-color:#3CDBC0;box-shadow:0 0 0 3px var(--blue-glow)}
.fld input::placeholder{color:#53565A}

.btn-primary{
  width:100%;padding:13px;background:#3CDBC0;border:none;color:#2C2A29;
  font-family:'Montserrat',sans-serif;font-size:14px;font-weight:700;letter-spacing:.5px;
  cursor:pointer;transition:.15s;text-transform:uppercase;
}
.btn-primary:hover{background:#2bc4ab}
.btn-primary:disabled{opacity:.45;cursor:not-allowed}

.auth-msg{padding:10px 14px;font-size:13px;line-height:1.5;border-left:3px solid}
.auth-msg.err{background:rgba(220,38,38,.1);border-color:#dc2626;color:#f87171}
.auth-msg.ok{background:rgba(5,150,105,.1);border-color:#059669;color:#34d399}
.auth-msg.warn{background:rgba(217,119,6,.1);border-color:#d97706;color:#fbbf24}

/* ── DASHBOARD ── */
.dash{display:flex;flex-direction:column;min-height:100vh}
.topbar{
  background:var(--surface);border-bottom:1px solid var(--border);
  padding:0 28px;height:58px;display:flex;align-items:center;gap:16px;
  position:sticky;top:0;z-index:100;flex-shrink:0;
}
.topbar-logo{display:flex;align-items:center;gap:9px;flex-shrink:0}
.topbar-mark{width:30px;height:30px;background:#3CDBC0;display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-size:14px;font-weight:800;color:#2C2A29;flex-shrink:0}
.topbar-name{font-family:'Montserrat',sans-serif;font-size:15px;font-weight:700;color:#fff}
.topbar-divider{width:1px;height:24px;background:var(--border);flex-shrink:0}
.topbar-title{font-size:13px;color:var(--muted);font-weight:500}
.topbar-spacer{flex:1}
.topbar-user{display:flex;align-items:center;gap:10px}
.topbar-avatar{width:32px;height:32px;border-radius:50%;background:#3CDBC0;display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;color:#2C2A29;flex-shrink:0}
.topbar-uname{font-size:13px;font-weight:600;color:var(--text)}
.topbar-uperfil{font-size:11px;color:var(--muted)}
.btn-logout{padding:7px 14px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;transition:.15s;letter-spacing:.3px}
.btn-logout:hover{border-color:var(--border2);color:var(--text)}

.dash-body{display:flex;flex:1;min-height:0}
.sidebar{width:220px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);padding:0;display:flex;flex-direction:column;gap:2px;overflow-y:auto;transition:width .2s}
.sidebar.collapsed{width:50px;overflow:visible}
.snav-item{display:flex;align-items:center;gap:11px;padding:10px 20px;cursor:pointer;color:var(--muted);font-size:13px;font-weight:500;transition:.15s;border-left:3px solid transparent;position:relative;white-space:nowrap}
.sidebar:not(.collapsed) .snav-item{overflow:hidden}
.sidebar.collapsed .snav-item{padding:10px 0;justify-content:center;gap:0;overflow:visible}
.sidebar.collapsed .snav-label{display:none}
.sidebar.collapsed .snav-item:hover::after{content:attr(data-label);position:absolute;left:54px;top:50%;transform:translateY(-50%);background:#1e2840;border:1px solid rgba(255,255,255,.18);color:#f0f0f0;font-size:11px;font-weight:600;padding:5px 12px;border-radius:4px;white-space:nowrap;z-index:9999;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,.4)}
.snav-item:hover{background:rgba(255,255,255,.03);color:var(--text)}
.snav-item.on{border-left-color:#3CDBC0;background:rgba(60,219,192,.1);color:#3CDBC0;font-weight:600}
.snav-icon{font-size:16px;flex-shrink:0;width:22px;text-align:center}
.snav-toggle{padding:9px 0;display:flex;justify-content:center;cursor:pointer;color:var(--muted);font-size:13px;border-bottom:1px solid var(--border);transition:.15s;flex-shrink:0}
.snav-toggle:hover{background:rgba(255,255,255,.04);color:var(--text)}
.snav-sep{height:1px;background:var(--border);margin:8px 16px}

.main-content{flex:1;padding:28px;overflow-y:auto;background:var(--bg);min-height:0}

/* ── CARDS ── */
.page-title{font-family:'Montserrat',sans-serif;font-size:24px;font-weight:800;color:#fff;margin-bottom:6px}
.page-sub{font-size:13px;color:var(--muted);margin-bottom:24px}

.stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px}
.stat-card{background:var(--card);border:1px solid var(--border);padding:18px;display:flex;flex-direction:column;gap:6px}
.stat-label{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.8px}
.stat-val{font-family:'Montserrat',sans-serif;font-size:30px;font-weight:800;color:#fff;line-height:1}
.stat-sub{font-size:11px;color:var(--muted)}
.stat-card.blue{border-color:rgba(60,219,192,.3);background:rgba(60,219,192,.08)}
.stat-card.blue .stat-val{color:#3CDBC0}
.stat-card.green{border-color:rgba(5,150,105,.3);background:rgba(5,150,105,.08)}
.stat-card.green .stat-val{color:#34d399}
.stat-card.amber{border-color:rgba(217,119,6,.3);background:rgba(217,119,6,.08)}
.stat-card.amber .stat-val{color:#fbbf24}
.stat-card.red{border-color:rgba(220,38,38,.3);background:rgba(220,38,38,.08)}
.stat-card.red .stat-val{color:#f87171}

/* ── TABLE ── */
.tbl-wrap{background:var(--card);border:1px solid var(--border);overflow:hidden}
.tbl-head{padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px}
.tbl-head-title{font-family:'Montserrat',sans-serif;font-size:14px;font-weight:700;color:#fff}
.tbl-search{background:#2C2A29;border:1px solid var(--border);color:var(--text);padding:7px 12px;font-size:13px;outline:none;min-width:200px;transition:.15s}
.tbl-search:focus{border-color:#3CDBC0}
.tbl-search::placeholder{color:#53565A}
table{width:100%;border-collapse:collapse}
th{padding:10px 18px;text-align:left;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid var(--border);background:rgba(255,255,255,.02)}
td{padding:13px 18px;font-size:13px;color:var(--text);border-bottom:1px solid rgba(255,255,255,.04)}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(255,255,255,.02)}

/* ── BADGES ── */
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;font-size:11px;font-weight:700;letter-spacing:.4px;border-radius:20px}
.badge-ativo{background:rgba(5,150,105,.15);color:#34d399;border:1px solid rgba(5,150,105,.3)}
.badge-pendente{background:rgba(217,119,6,.15);color:#fbbf24;border:1px solid rgba(217,119,6,.3)}
.badge-rejeitado{background:rgba(220,38,38,.15);color:#f87171;border:1px solid rgba(220,38,38,.3)}
.badge-inativo{background:rgba(122,127,150,.15);color:#7a7f96;border:1px solid rgba(122,127,150,.3)}

/* ── PERFIL BADGE ── */
.perfil-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;font-size:11px;font-weight:600;border:1px solid;border-radius:2px;opacity:.9}

/* ── ACTIONS ── */
.act-row{display:flex;gap:6px;align-items:center}
.btn-sm{padding:5px 12px;font-size:12px;font-weight:600;border:1px solid;cursor:pointer;transition:.15s;letter-spacing:.2px}
.btn-approve{background:rgba(5,150,105,.1);border-color:rgba(5,150,105,.4);color:#34d399}
.btn-approve:hover{background:rgba(5,150,105,.2)}
.btn-reject{background:rgba(220,38,38,.1);border-color:rgba(220,38,38,.4);color:#f87171}
.btn-reject:hover{background:rgba(220,38,38,.2)}
.btn-edit{background:rgba(60,219,192,.1);border-color:rgba(60,219,192,.4);color:#3CDBC0}
.btn-edit:hover{background:rgba(60,219,192,.2)}
.btn-disable{background:rgba(122,127,150,.1);border-color:rgba(122,127,150,.3);color:#7a7f96}
.btn-disable:hover{background:rgba(122,127,150,.2);color:var(--text)}

/* ── AVATAR TABLE ── */
.usr-cell{display:flex;align-items:center;gap:10px}
.usr-av{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;color:#2C2A29;flex-shrink:0}
.usr-nome{font-weight:600;color:#fff}
.usr-email{font-size:11px;color:var(--muted)}

/* ── MODAL ── */
.modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}
.modal-box{background:var(--card);border:1px solid var(--border2);width:100%;max-width:460px;max-height:90vh;overflow-y:auto;animation:fadeUp .25s ease}
.modal-head{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--card);z-index:1}
.modal-title{font-family:'Montserrat',sans-serif;font-size:16px;font-weight:700;color:#fff}
.modal-close{background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;padding:2px 6px;line-height:1;transition:.15s}
.modal-close:hover{color:var(--text)}
.modal-body{padding:22px;display:flex;flex-direction:column;gap:14px}
.modal-foot{padding:14px 22px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end}
.btn-cancel{padding:9px 18px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;transition:.15s}
.btn-cancel:hover{color:var(--text);border-color:var(--border2)}
.btn-confirm{padding:9px 20px;background:#3CDBC0;border:none;color:#2C2A29;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:.15s;letter-spacing:.3px}
.btn-confirm:hover{background:#2bc4ab}
.btn-confirm.danger{background:#dc2626}
.btn-confirm.danger:hover{background:#b91c1c}

/* ── PERFIL SELECT ── */
.perfil-grid{display:flex;flex-direction:column;gap:8px}
.perfil-opt{display:flex;align-items:center;gap:12px;padding:12px 14px;border:2px solid var(--border);cursor:pointer;transition:.15s;background:rgba(255,255,255,.02)}
.perfil-opt:hover{border-color:var(--border2)}
.perfil-opt.sel{border-color:#3CDBC0;background:rgba(60,219,192,.1)}
.perfil-opt-icon{font-size:18px;width:28px;text-align:center}
.perfil-opt-info{flex:1}
.perfil-opt-label{font-size:13px;font-weight:600;color:#fff}
.perfil-opt-desc{font-size:11px;color:var(--muted);margin-top:2px}
.perfil-opt-radio{width:16px;height:16px;border:2px solid var(--border2);border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:.15s}
.perfil-opt.sel .perfil-opt-radio{border-color:#3CDBC0;background:#3CDBC0}
.perfil-opt.sel .perfil-opt-radio::after{content:'';width:6px;height:6px;border-radius:50%;background:#fff}

/* ── EMPTY STATE ── */
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:52px 20px;gap:10px;color:var(--muted)}
.empty-icon{font-size:36px;opacity:.4}
.empty-text{font-size:14px;font-weight:500}
.empty-sub{font-size:12px}

/* ── WELCOME ── */
.welcome-card{background:linear-gradient(135deg,rgba(60,219,192,.15),rgba(60,219,192,.04));border:1px solid rgba(60,219,192,.2);padding:24px;margin-bottom:24px}
.welcome-greeting{font-family:'Montserrat',sans-serif;font-size:22px;font-weight:800;color:#fff;margin-bottom:4px}
.welcome-sub{font-size:13px;color:#3CDBC0}

/* ── PENDING ROW ── */
.pending-row{background:rgba(217,119,6,.04);border-left:3px solid rgba(217,119,6,.5)}
.pending-row td:first-child{padding-left:15px}

/* ── SCROLLBAR ── */
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:#3CDBC0}

/* ── PERFIS DINÂMICOS ── */
.pfcard{background:var(--card);border:1px solid var(--border);padding:18px;border-radius:4px;display:flex;flex-direction:column;gap:10px;transition:border-color .15s}
.pfcard:hover{border-color:var(--border2)}
.pfcard.sistema{opacity:.7}
.pfcard-head{display:flex;align-items:center;gap:10px}
.pfcard-icon{font-size:20px;width:32px;text-align:center}
.pfcard-name{font-family:'Montserrat',sans-serif;font-size:15px;font-weight:700;color:#fff;flex:1}
.pfcard-actions{display:flex;gap:6px}
.pfcard-desc{font-size:12px;color:var(--muted);line-height:1.5}
.pfcard-mods{display:flex;flex-wrap:wrap;gap:5px}
.mod-chip{padding:3px 9px;font-size:11px;font-weight:600;border-radius:20px;border:1px solid}
.mod-chip.on{background:rgba(60,219,192,.15);border-color:rgba(60,219,192,.4);color:#3CDBC0}
.mod-chip.off{background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.08);color:var(--muted);text-decoration:line-through;opacity:.5}
.pfcard-count{font-size:11px;color:var(--muted);font-weight:500}

/* ── MODAL PERFIL ── */
.mod-toggle{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);cursor:pointer;transition:all .15s;border-radius:3px}
.mod-toggle:hover{border-color:var(--border2)}
.mod-toggle.on{border-color:rgba(60,219,192,.4);background:rgba(60,219,192,.08)}
.mod-toggle.disabled-mod{opacity:.4;cursor:not-allowed}
.mod-toggle-icon{font-size:16px;width:24px;text-align:center}
.mod-toggle-info{flex:1}
.mod-toggle-label{font-size:13px;font-weight:600;color:#fff}
.mod-toggle-desc{font-size:11px;color:var(--muted);margin-top:1px}
.mod-toggle-check{width:18px;height:18px;border:2px solid var(--border2);border-radius:3px;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:.15s;font-size:11px;color:transparent}
.mod-toggle.on .mod-toggle-check{background:#3CDBC0;border-color:#3CDBC0;color:#2C2A29}
.cor-grid{display:flex;gap:6px;flex-wrap:wrap}
.cor-dot{width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:.15s}
.cor-dot.sel{border-color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.3)}
.icone-grid{display:flex;gap:4px;flex-wrap:wrap}
.icone-opt{width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;border:1px solid var(--border);border-radius:3px;transition:.15s}
.icone-opt:hover{border-color:var(--border2)}
.icone-opt.sel{border-color:#3CDBC0;background:rgba(60,219,192,.15)}
.btn-add-perfil{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;border:2px dashed rgba(60,219,192,.3);background:rgba(60,219,192,.04);color:#A7A8AA;font-size:13px;font-weight:600;cursor:pointer;transition:.15s;border-radius:4px}
.btn-add-perfil:hover{border-color:rgba(60,219,192,.6);color:#3CDBC0;background:rgba(60,219,192,.08)}
`;

// ── COMPONENTS ───────────────────────────────────────────────────────────────

function PerfilBadge({ perfil }) {
  const perfisMap = getPerfisMap(loadPerfis());
  const p = perfisMap[perfil] || { label: perfil, cor: "#7a7f96", icone: "?" };
  return (
    <span className="perfil-badge" style={{ borderColor: p.cor + "55", color: p.cor, background: p.cor + "15" }}>
      {p.icone} {p.label}
    </span>
  );
}

// ── MODAL CRIAR/EDITAR PERFIL ─────────────────────────────────────────────────
const CORES_OPCOES = ["#0047BB","#059669","#7c3aed","#d97706","#dc2626","#0891b2","#be185d","#4f46e5","#16a34a","#9333ea","#ea580c","#0d9488"];
const ICONES_OPCOES = ["👥","📊","📦","🏷️","🔄","📐","💼","🔐","🧮","📈","🔗","📋","💡","🎯","⚡","🛠️","📌","🔑"];

function ModalPerfil({ perfil, onClose, onSave, users }) {
  const isNew = !perfil;
  const [form, setForm] = useState(perfil ? { ...perfil } : {
    id: "", label: "", icone: "👥", cor: "#0047BB", desc: "", modulos: ["precificacao"], sistema: false
  });
  const [erro, setErro] = useState("");
  const F = k => v => setForm(p => ({ ...p, [k]: v }));

  const toggleMod = (mid) => {
    setForm(p => ({
      ...p,
      modulos: p.modulos.includes(mid) ? p.modulos.filter(m => m !== mid) : [...p.modulos, mid]
    }));
  };

  const handleSave = () => {
    setErro("");
    if (!form.label.trim()) return setErro("Informe o nome do perfil.");
    if (isNew && !form.id.trim()) return setErro("Informe o ID do perfil (ex: comercial).");
    if (isNew && !/^[a-z0-9_]+$/.test(form.id)) return setErro("ID deve conter apenas letras minúsculas, números e _");
    if (form.modulos.length === 0) return setErro("Selecione ao menos um módulo.");
    onSave({ ...form, id: form.id.toLowerCase().trim() });
  };

  const usersCount = users.filter(u => u.perfil === form.id && u.status === "ativo").length;

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{isNew ? "Novo Perfil" : `Editar — ${perfil.label}`}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {erro && <div className="auth-msg err">{erro}</div>}

          {/* Preview */}
          <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px",
            background: form.cor+"15", border:`1px solid ${form.cor}44`, borderRadius:4 }}>
            <span style={{ fontSize:24 }}>{form.icone}</span>
            <div>
              <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, color:"#fff", fontSize:15 }}>{form.label||"Nome do perfil"}</div>
              <div style={{ fontSize:11, color:form.cor, fontWeight:600 }}>
                {!isNew && usersCount > 0 ? `${usersCount} usuário${usersCount!==1?"s":""} ativo${usersCount!==1?"s":""}` : "Novo perfil"}
              </div>
            </div>
          </div>

          {isNew && (
            <div className="fld">
              <label>ID do perfil <span style={{color:"var(--muted)",fontWeight:400}}>(slug único, ex: comercial)</span></label>
              <input placeholder="comercial" value={form.id} onChange={e=>F("id")(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))}/>
            </div>
          )}

          <div className="fld">
            <label>Nome do perfil</label>
            <input placeholder="Ex: Depto. Comercial" value={form.label} onChange={e=>F("label")(e.target.value)}/>
          </div>

          <div className="fld">
            <label>Descrição</label>
            <input placeholder="O que este perfil pode fazer..." value={form.desc} onChange={e=>F("desc")(e.target.value)}/>
          </div>

          {/* Ícone */}
          <div className="fld">
            <label>Ícone</label>
            <div className="icone-grid">
              {ICONES_OPCOES.map(ic => (
                <div key={ic} className={`icone-opt ${form.icone===ic?"sel":""}`} onClick={()=>F("icone")(ic)}>{ic}</div>
              ))}
            </div>
          </div>

          {/* Cor */}
          <div className="fld">
            <label>Cor de identificação</label>
            <div className="cor-grid">
              {CORES_OPCOES.map(cor => (
                <div key={cor} className={`cor-dot ${form.cor===cor?"sel":""}`}
                  style={{ background:cor }} onClick={()=>F("cor")(cor)}/>
              ))}
            </div>
          </div>

          {/* Módulos */}
          <div className="fld">
            <label>Módulos habilitados</label>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {MODULOS.map(m => {
                const isOn = form.modulos.includes(m.id);
                const isDisabled = !m.ativo;
                return (
                  <div key={m.id} className={`mod-toggle ${isOn&&m.ativo?"on":""} ${isDisabled?"disabled-mod":""}`}
                    onClick={() => !isDisabled && toggleMod(m.id)}>
                    <span className="mod-toggle-icon">{m.icone}</span>
                    <div className="mod-toggle-info">
                      <div className="mod-toggle-label">{m.label} {isDisabled&&<span style={{fontSize:10,color:"var(--muted)",fontWeight:400}}>(em desenvolvimento)</span>}</div>
                      <div className="mod-toggle-desc">{m.desc}</div>
                    </div>
                    <div className="mod-toggle-check">{isOn&&m.ativo?"✓":""}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn-confirm" onClick={handleSave}>{isNew?"Criar perfil":"Salvar alterações"}</button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { ativo: ["badge-ativo","● Ativo"], pendente: ["badge-pendente","◉ Pendente"], rejeitado: ["badge-rejeitado","✕ Rejeitado"], inativo: ["badge-inativo","○ Inativo"] };
  const [cls, label] = map[status] || ["badge-inativo", status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

// ── LOGIN / REGISTRO ──────────────────────────────────────────────────────────

function AuthScreen({ onLogin }) {
  const [aba, setAba] = useState("login");
  const [form, setForm] = useState({ email: "", senha: "", nome: "", confirma: "", perfil: "custos" });
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const F = k => v => setForm(p => ({ ...p, [k]: v }));

  const handleLogin = async () => {
    setMsg(null); setLoading(true);
    try {
      const rows = await db.getUserByEmail(form.email.toLowerCase().trim());
      const user = rows?.[0];
      if (!user) return setMsg({ type: "err", text: "E-mail não encontrado." });
      if (user.senha !== form.senha) return setMsg({ type: "err", text: "Senha incorreta." });
      if (user.status === "pendente") return setMsg({ type: "warn", text: "Sua conta ainda não foi aprovada pelo administrador." });
      if (user.status === "rejeitado") return setMsg({ type: "err", text: "Acesso negado. Entre em contato com o administrador." });
      if (user.status === "inativo") return setMsg({ type: "err", text: "Conta inativa. Entre em contato com o administrador." });
      saveSession(user);
      onLogin(user);
    } catch(e) {
      setMsg({ type: "err", text: "Erro de conexão. Tente novamente." });
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    setMsg(null);
    if (!form.nome.trim()) return setMsg({ type: "err", text: "Informe seu nome completo." });
    if (!form.email.includes("@")) return setMsg({ type: "err", text: "Informe um e-mail válido." });
    if (form.senha.length < 6) return setMsg({ type: "err", text: "Senha deve ter ao menos 6 caracteres." });
    if (form.senha !== form.confirma) return setMsg({ type: "err", text: "As senhas não conferem." });
    setLoading(true);
    try {
      const existing = await db.getUserByEmail(form.email.toLowerCase().trim());
      if (existing?.length > 0) return setMsg({ type: "err", text: "Este e-mail já está cadastrado." });
      await db.insertUser({
        nome: form.nome.trim(),
        email: form.email.toLowerCase().trim(),
        senha: form.senha,
        perfil: form.perfil,
        status: "pendente",
      });
      setMsg({ type: "ok", text: "Cadastro realizado! Aguarde aprovação do administrador." });
      setForm(p => ({ ...p, senha: "", confirma: "", nome: "" }));
      setTimeout(() => setAba("login"), 2500);
    } catch(e) {
      setMsg({ type: "err", text: "Erro ao cadastrar. Tente novamente." });
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-wrap">
      <style>{CSS_AUTH}</style>
      <div className="auth-box">
        <div className="auth-head">
          <div className="auth-logo">
              <img src="/logo-positivo-tecnologIA-mai-25.png" alt="Positivo Tecnologia" style={{height:40,objectFit:"contain"}}/>
          </div>
          <div>
            <div className="auth-title">Calculadora Tributária</div>
            <div className="auth-sub">Sistema de precificação industrial</div>
          </div>
        </div>

        <div className="auth-body">
          <div className="auth-tabs">
            <button className={`auth-tab ${aba === "login" ? "on" : ""}`} onClick={() => { setAba("login"); setMsg(null); }}>Entrar</button>
            <button className={`auth-tab ${aba === "reg" ? "on" : ""}`} onClick={() => { setAba("reg"); setMsg(null); }}>Solicitar Acesso</button>
          </div>

          {msg && <div className={`auth-msg ${msg.type}`}>{msg.text}</div>}

          {aba === "login" ? <>
            <div className="fld">
              <label>E-mail</label>
              <input placeholder="seu@email.com.br" value={form.email} onChange={e => F("email")(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} autoComplete="username"/>
            </div>
            <div className="fld">
              <label>Senha</label>
              <input type="password" placeholder="••••••••" value={form.senha} onChange={e => F("senha")(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} autoComplete="current-password"/>
            </div>
            <button className="btn-primary" onClick={handleLogin} disabled={loading}>{loading?"Entrando...":"Entrar"}</button>
            <div style={{ textAlign: "center", fontSize: 11, color: "var(--muted)" }}>
              Acesso inicial: admin@positec.com.br / Positec@2026
            </div>
          </> : <>
            <div className="fld">
              <label>Nome completo</label>
              <input placeholder="João Silva" value={form.nome} onChange={e => F("nome")(e.target.value)}/>
            </div>
            <div className="fld">
              <label>E-mail corporativo</label>
              <input placeholder="joao@positec.com.br" value={form.email} onChange={e => F("email")(e.target.value)} autoComplete="username"/>
            </div>
            <div className="fld">
              <label>Perfil solicitado</label>
              <select value={form.perfil} onChange={e => F("perfil")(e.target.value)}>
                {loadPerfis().filter(p => p.id !== "admin").map(p =>
                  <option key={p.id} value={p.id}>{p.icone} {p.label}</option>
                )}
              </select>
            </div>
            <div className="fld">
              <label>Senha</label>
              <input type="password" placeholder="Mínimo 6 caracteres" value={form.senha} onChange={e => F("senha")(e.target.value)} autoComplete="new-password"/>
            </div>
            <div className="fld">
              <label>Confirmar senha</label>
              <input type="password" placeholder="Repita a senha" value={form.confirma} onChange={e => F("confirma")(e.target.value)}/>
            </div>
            <button className="btn-primary" onClick={handleRegister} disabled={loading}>{loading?"Enviando...":"Solicitar Acesso"}</button>
            <div style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
              Seu cadastro será analisado pelo administrador.<br/>Você receberá confirmação após aprovação.
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

// ── MODAL EDITAR USUÁRIO ──────────────────────────────────────────────────────

function ModalEditUser({ user, onClose, onSave }) {
  const [perfil, setPerfil] = useState(user.perfil);
  const [status, setStatus] = useState(user.status);
  const perfisLista = loadPerfis();
  const perfisMap = getPerfisMap(perfisLista);

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">Editar usuário</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(255,255,255,.03)", border: "1px solid var(--border)" }}>
            <div className="usr-av" style={{ background: (perfisMap[user.perfil]?.cor) || "#0047BB", width: 38, height: 38, fontSize: 14 }}>{initials(user.nome)}</div>
            <div>
              <div style={{ fontWeight: 600, color: "#fff", fontSize: 14 }}>{user.nome}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{user.email}</div>
            </div>
          </div>

          <div className="fld">
            <label>Status da conta</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="rejeitado">Rejeitado</option>
            </select>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".8px" }}>Perfil de acesso</div>
          <div className="perfil-grid">
            {perfisLista.filter(p => user.id !== "master" || p.id === "admin").map(p => (
              <div key={p.id} className={`perfil-opt ${perfil === p.id ? "sel" : ""}`} onClick={() => setPerfil(p.id)}>
                <span className="perfil-opt-icon">{p.icone}</span>
                <div className="perfil-opt-info">
                  <div className="perfil-opt-label">{p.label}</div>
                  <div className="perfil-opt-desc">{p.desc}</div>
                </div>
                <div className="perfil-opt-radio"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn-confirm" onClick={() => onSave({ ...user, perfil, status })}>Salvar alterações</button>
        </div>
      </div>
    </div>
  );
}

// ── MODAL APROVAR ──────────────────────────────────────────────────────────────

function ModalAprovar({ user, currentUser, onClose, onSave }) {
  const [perfil, setPerfil] = useState(user.perfil);
  const [action, setAction] = useState("aprovar");

  const handleConfirm = () => {
    if (action === "aprovar") {
      onSave({ ...user, perfil, status: "ativo", aprovadoEm: new Date().toISOString(), aprovadoPor: currentUser.nome });
    } else {
      onSave({ ...user, status: "rejeitado", aprovadoEm: new Date().toISOString(), aprovadoPor: currentUser.nome });
    }
  };

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">Analisar solicitação</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ padding: "12px 14px", background: "rgba(217,119,6,.08)", border: "1px solid rgba(217,119,6,.25)" }}>
            <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 8 }}>Solicitação pendente</div>
            <div style={{ fontWeight: 600, color: "#fff", marginBottom: 2 }}>{user.nome}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{user.email}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Solicitado em: {fmtDate(user.criadoEm)}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Perfil solicitado: <PerfilBadge perfil={user.perfil}/></div>
          </div>

          <div className="fld">
            <label>Decisão</label>
            <select value={action} onChange={e => setAction(e.target.value)}>
              <option value="aprovar">✓ Aprovar acesso</option>
              <option value="rejeitar">✕ Rejeitar solicitação</option>
            </select>
          </div>

          {action === "aprovar" && <>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".8px" }}>Confirmar perfil de acesso</div>
            <div className="perfil-grid">
              {loadPerfis().filter(p => p.id !== "admin").map(p => (
                <div key={p.id} className={`perfil-opt ${perfil === p.id ? "sel" : ""}`} onClick={() => setPerfil(p.id)}>
                  <span className="perfil-opt-icon">{p.icone}</span>
                  <div className="perfil-opt-info">
                    <div className="perfil-opt-label">{p.label}</div>
                    <div className="perfil-opt-desc">{p.desc}</div>
                  </div>
                  <div className="perfil-opt-radio"></div>
                </div>
              ))}
            </div>
          </>}

          {action === "rejeitar" && (
            <div className="auth-msg err">O usuário será notificado de que o acesso foi negado e não poderá fazer login.</div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button className={`btn-confirm ${action === "rejeitar" ? "danger" : ""}`} onClick={handleConfirm}>
            {action === "aprovar" ? "✓ Aprovar acesso" : "✕ Rejeitar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── VIEW PERFIS ───────────────────────────────────────────────────────────────
function ViewPerfis({ users }) {
  const [perfisLista, setPerfisLista] = useState(loadPerfis);
  const [modalPerfil, setModalPerfil] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const salvarPerfil = (p) => {
    const nova = perfisLista.find(x=>x.id===p.id)
      ? perfisLista.map(x=>x.id===p.id?p:x)
      : [...perfisLista, p];
    savePerfis(nova); setPerfisLista(nova); setModalPerfil(null);
  };
  const deletarPerfil = (id) => {
    const nova = perfisLista.filter(p=>p.id!==id);
    savePerfis(nova); setPerfisLista(nova); setConfirmDel(null);
  };

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <div className="page-title">Perfis de Acesso</div>
          <div className="page-sub">Crie e gerencie perfis — defina nome, ícone e módulos habilitados</div>
        </div>
        <button className="btn-confirm" style={{padding:"9px 18px",borderRadius:3}}
          onClick={()=>setModalPerfil("novo")}>+ Novo Perfil</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
        {perfisLista.map(p=>{
          const count=users.filter(u=>u.perfil===p.id&&u.status==="ativo").length;
          const isAdmin=p.id==="admin";
          return(
            <div key={p.id} className={`pfcard ${p.sistema?"sistema":""}`}
              style={{borderColor:p.cor+"33"}}>
              <div className="pfcard-head">
                <span className="pfcard-icon">{p.icone}</span>
                <div style={{flex:1}}>
                  <div className="pfcard-name">{p.label}</div>
                  <div className="pfcard-count" style={{color:p.cor}}>
                    {count} usuário{count!==1?"s":""} ativo{count!==1?"s":""}
                  </div>
                </div>
                <div className="pfcard-actions">
                  {!isAdmin&&<button className="btn-sm btn-edit" onClick={()=>setModalPerfil(p)}>✎ Editar</button>}
                  {!isAdmin&&(
                    confirmDel===p.id
                      ? <>
                          <button className="btn-sm btn-reject" onClick={()=>deletarPerfil(p.id)}>Confirmar</button>
                          <button className="btn-sm btn-disable" onClick={()=>setConfirmDel(null)}>Cancelar</button>
                        </>
                      : <button className="btn-sm btn-reject"
                          style={{opacity:count>0?.4:1,cursor:count>0?"not-allowed":"pointer"}}
                          title={count>0?"Mova os usuários antes de deletar":"Deletar perfil"}
                          onClick={()=>count===0&&setConfirmDel(p.id)}>✕</button>
                  )}
                  {isAdmin&&<span style={{fontSize:11,color:"var(--muted)",fontStyle:"italic",padding:"4px 8px"}}>sistema</span>}
                </div>
              </div>
              {p.desc&&<div className="pfcard-desc">{p.desc}</div>}
              <div className="pfcard-mods">
                {MODULOS.map(m=>(
                  <span key={m.id} className={`mod-chip ${p.modulos?.includes(m.id)?"on":"off"}`}>
                    {m.icone} {m.label}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        <div className="btn-add-perfil" onClick={()=>setModalPerfil("novo")}>
          <span style={{fontSize:22}}>+</span> Criar novo perfil
        </div>
      </div>

      {modalPerfil&&(
        <ModalPerfil
          perfil={modalPerfil==="novo"?null:modalPerfil}
          users={users}
          onClose={()=>setModalPerfil(null)}
          onSave={salvarPerfil}/>
      )}
    </div>
  );
}

// ── PAINEL ADMIN ──────────────────────────────────────────────────────────────

function PainelAdmin({ currentUser }) {
  const [view, setView] = useState("pendentes");
  const [users, setUsers] = useState([]);
  const [solCats, setSolCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [u, sc] = await Promise.all([db.getUsers(), db.getSolicitacoesCategorias()]);
      setUsers(u);
      setSolCats(sc||[]);
    }
    catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const saveUser = async (updated) => {
    try {
      const { id, ...data } = updated;
      await db.updateUser(id, {
        nome: data.nome, email: data.email, perfil: data.perfil,
        status: data.status, aprovado_em: data.aprovadoEm || data.aprovado_em,
        aprovado_por: data.aprovadoPor || data.aprovado_por,
      });
      await refresh();
    } catch(e) { alert("Erro ao salvar: " + e.message); }
    setModal(null);
  };

  const deleteUser = async (id) => {
    if (!confirm("Excluir este usuário?")) return;
    try { await db.deleteUser(id); await refresh(); }
    catch(e) { alert("Erro ao excluir: " + e.message); }
  };

  // normaliza campos snake_case do Supabase para camelCase
  const norm = u => ({
    ...u,
    criadoEm: u.criado_em || u.criadoEm,
    aprovadoEm: u.aprovado_em || u.aprovadoEm,
    aprovadoPor: u.aprovado_por || u.aprovadoPor,
  });

  const allUsers = users.map(norm);
  const pendentes = allUsers.filter(u => u.status === "pendente");
  const todos = allUsers.filter(u => {
    const q = search.toLowerCase();
    return !q || u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const stats = {
    total: allUsers.length,
    ativos: allUsers.filter(u => u.status === "ativo").length,
    pendentes: pendentes.length,
    inativos: allUsers.filter(u => u.status === "inativo" || u.status === "rejeitado").length,
  };

  const solCatsPendentes = solCats.filter(s=>!s.status||s.status==="pendente");

  const NAV = [
    { id: "calc",       icon: "🧮", label: "Calculadora" },
    { id: "sep" },
    { id: "pendentes",  icon: "⏳", label: "Pendentes", badge: pendentes.length },
    { id: "usuarios",   icon: "👥", label: "Usuários" },
    { id: "perfis",     icon: "🔐", label: "Perfis" },
    { id: "categorias", icon: "📦", label: "Categorias", badge: solCatsPendentes.length },
    { id: "canais",     icon: "🏪", label: "Canais" },
  ];

  // Se view === "calc", renderiza a Calculadora inline
  if (view === "calc") {
    return (
      <>
        <div className="sidebar">
          {NAV.filter(n=>n.id!=="sep").map(n => (
            <div key={n.id} className={`snav-item ${view === n.id ? "on" : ""}`} onClick={() => setView(n.id)}>
              <span className="snav-icon">{n.icon}</span>
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.badge > 0 && <span style={{ background: "#d97706", color: "#fff", borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "1px 7px" }}>{n.badge}</span>}
            </div>
          ))}
        </div>
        <div style={{flex:1,display:"flex",overflow:"hidden"}}>
          <Calculadora user={currentUser}/>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="sidebar">
        {NAV.map(n => n.id === "sep"
          ? <div key="sep" className="snav-sep"/>
          : (
            <div key={n.id} className={`snav-item ${view === n.id ? "on" : ""}`} onClick={() => setView(n.id)}>
              <span className="snav-icon">{n.icon}</span>
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.badge > 0 && <span style={{ background: "#d97706", color: "#fff", borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "1px 7px" }}>{n.badge}</span>}
            </div>
          )
        )}
      </div>

      <div className="main-content">
        {/* STATS */}
        <div className="stats-row">
          <div className="stat-card blue"><div className="stat-label">Total</div><div className="stat-val">{stats.total}</div><div className="stat-sub">usuários cadastrados</div></div>
          <div className="stat-card green"><div className="stat-label">Ativos</div><div className="stat-val">{stats.ativos}</div><div className="stat-sub">com acesso liberado</div></div>
          <div className="stat-card amber"><div className="stat-label">Pendentes</div><div className="stat-val">{stats.pendentes}</div><div className="stat-sub">aguardando aprovação</div></div>
          <div className="stat-card red"><div className="stat-label">Inativos</div><div className="stat-val">{stats.inativos}</div><div className="stat-sub">sem acesso</div></div>
        </div>

        {/* PENDENTES */}
        {view === "pendentes" && (
          <div className="tbl-wrap">
            <div className="tbl-head">
              <span className="tbl-head-title">⏳ Solicitações Pendentes</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{pendentes.length} aguardando análise</span>
            </div>
            {pendentes.length === 0
              ? <div className="empty"><div className="empty-icon">✓</div><div className="empty-text">Nenhuma pendência</div><div className="empty-sub">Todas as solicitações foram analisadas</div></div>
              : <table>
                  <thead><tr>
                    <th>Usuário</th><th>Perfil Solicitado</th><th>Solicitado em</th><th>Ações</th>
                  </tr></thead>
                  <tbody>
                    {pendentes.map(u => (
                      <tr key={u.id} className="pending-row">
                        <td><div className="usr-cell">
                          <div className="usr-av" style={{ background: getPerfisMap(loadPerfis())[u.perfil]?.cor || "#7a7f96" }}>{initials(u.nome)}</div>
                          <div><div className="usr-nome">{u.nome}</div><div className="usr-email">{u.email}</div></div>
                        </div></td>
                        <td><PerfilBadge perfil={u.perfil}/></td>
                        <td style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 12, color: "var(--muted)" }}>{fmtDate(u.criadoEm)}</td>
                        <td><div className="act-row">
                          <button className="btn-sm btn-approve" onClick={() => setModal({ type: "aprovar", user: u })}>✓ Analisar</button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        )}

        {/* TODOS USUÁRIOS */}
        {view === "usuarios" && (
          <div className="tbl-wrap">
            <div className="tbl-head">
              <span className="tbl-head-title">👥 Todos os Usuários</span>
              <input className="tbl-search" placeholder="Buscar por nome ou e-mail..." value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <table>
              <thead><tr>
                <th>Usuário</th><th>Perfil</th><th>Status</th><th>Criado em</th><th>Aprovado por</th><th>Ações</th>
              </tr></thead>
              <tbody>
                {todos.map(u => (
                  <tr key={u.id}>
                    <td><div className="usr-cell">
                      <div className="usr-av" style={{ background: getPerfisMap(loadPerfis())[u.perfil]?.cor || "#7a7f96" }}>{initials(u.nome)}</div>
                      <div><div className="usr-nome">{u.nome}</div><div className="usr-email">{u.email}</div></div>
                    </div></td>
                    <td><PerfilBadge perfil={u.perfil}/></td>
                    <td><StatusBadge status={u.status}/></td>
                    <td style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 11, color: "var(--muted)" }}>{fmtDate(u.criadoEm)}</td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>{u.aprovadoPor || "—"}</td>
                    <td><div className="act-row">
                      {u.perfil !== "admin" && <>
                        <button className="btn-sm btn-edit" onClick={() => setModal({ type: "edit", user: u })}>✎ Editar</button>
                        {u.status === "ativo" && <button className="btn-sm btn-disable" onClick={() => saveUser({ ...u, status: "inativo" })}>Desativar</button>}
                        {u.status === "inativo" && <button className="btn-sm btn-approve" onClick={() => saveUser({ ...u, status: "ativo" })}>Reativar</button>}
                        {u.status === "pendente" && <button className="btn-sm btn-approve" onClick={() => setModal({ type: "aprovar", user: u })}>Analisar</button>}
                        <button className="btn-sm btn-reject" onClick={() => deleteUser(u.id)}>Excluir</button>
                      </>}
                      {u.perfil === "admin" && <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>admin</span>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PERFIS */}
        {view === "perfis" && <ViewPerfis users={users}/>}

        {/* CANAIS */}
        {view === "canais" && <ViewCanais/>}

        {/* CATEGORIAS */}
        {view === "categorias" && (
          <div className="tbl-wrap">
            <div className="tbl-head">
              <span className="tbl-head-title">📦 Solicitações de Categoria</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{solCatsPendentes.length} pendente{solCatsPendentes.length!==1?"s":""}</span>
            </div>
            {solCats.length === 0
              ? <div className="empty"><div className="empty-icon">📦</div><div className="empty-text">Nenhuma solicitação</div><div className="empty-sub">Nenhuma solicitação de categoria recebida</div></div>
              : <table>
                  <thead><tr>
                    <th>Categoria</th><th>Prefixo</th><th>Solicitado por</th><th>Descrição</th><th>Status</th><th>Ações</th>
                  </tr></thead>
                  <tbody>
                    {solCats.map(sol => {
                      const isPendente = !sol.status || sol.status === "pendente";
                      return (
                        <tr key={sol.id} className={isPendente?"pending-row":""}>
                          <td style={{ fontWeight: 600, color: "#fff" }}>{sol.nome_categoria}</td>
                          <td><code style={{ fontSize: 12, color: "#93c5fd" }}>{sol.prefixo}</code></td>
                          <td>
                            <div style={{ fontSize: 13 }}>{sol.user_nome||"—"}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(sol.criado_em)}</div>
                          </td>
                          <td style={{ fontSize: 12, color: "var(--muted)", maxWidth: 200 }}>{sol.descricao||"—"}</td>
                          <td>
                            {sol.status==="aprovado"&&<span className="badge badge-ativo">✓ Aprovado</span>}
                            {sol.status==="rejeitado"&&<span className="badge badge-rejeitado">✕ Rejeitado</span>}
                            {isPendente&&<span className="badge badge-pendente">◉ Pendente</span>}
                          </td>
                          <td>
                            {isPendente && (
                              <div className="act-row">
                                <button className="btn-sm btn-approve" onClick={async()=>{
                                  try{
                                    await db.insertCategoria({id:sol.prefixo,nome:sol.nome_categoria,ativo:true});
                                    await db.updateSolicitacaoCategoria(sol.id,{status:"aprovado"});
                                    await refresh();
                                  }catch(e){alert("Erro ao aprovar: "+e.message);}
                                }}>✓ Aprovar</button>
                                <button className="btn-sm btn-reject" onClick={async()=>{
                                  try{
                                    await db.updateSolicitacaoCategoria(sol.id,{status:"rejeitado"});
                                    await refresh();
                                  }catch(e){alert("Erro ao rejeitar: "+e.message);}
                                }}>✕ Rejeitar</button>
                              </div>
                            )}
                            {!isPendente && <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>finalizado</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            }
          </div>
        )}
      </div>

      {modal?.type === "edit" && <ModalEditUser user={modal.user} onClose={() => setModal(null)} onSave={saveUser}/>}
      {modal?.type === "aprovar" && <ModalAprovar user={modal.user} currentUser={currentUser} onClose={() => setModal(null)} onSave={saveUser}/>}
    </>
  );
}

// ── DASHBOARD USUÁRIO ─────────────────────────────────────────────────────────

// ── ViewCanais — editor de taxas por canal × categoria ───────────────────────
const VC_FIELDS = [
  { id:"comis",  label:"Comissão" },
  { id:"mkt",    label:"Marketing" },
  { id:"rebate", label:"Rebate" },
  { id:"pdd",    label:"PDD" },
  { id:"vpc",    label:"VPC" },
];

function ViewCanais() {
  const [taxas, setTaxas] = useState(loadCanaisTaxas);
  const [openCanal, setOpenCanal] = useState({});

  const persistir = t => { saveCanaisTaxas(t); setTaxas({...t}); };

  const setRate = (canalId, catId, field, raw) => {
    const num = parseFloat(raw);
    const t = JSON.parse(JSON.stringify(taxas));
    if(!t[canalId]) t[canalId]={};
    if(!t[canalId][catId]) t[canalId][catId]={};
    if(isNaN(num)) delete t[canalId][catId][field];
    else t[canalId][catId][field]=num;
    if(!Object.keys(t[canalId][catId]).length) delete t[canalId][catId];
    if(!Object.keys(t[canalId]).length) delete t[canalId];
    persistir(t);
  };

  const resetCanal = canalId => {
    const t = {...taxas}; delete t[canalId]; persistir(t);
  };

  const thS={padding:"6px 10px",textAlign:"right",fontSize:10,fontWeight:700,color:"var(--muted)",
    textTransform:"uppercase",letterSpacing:".8px",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap"};
  const tdS={padding:"4px 8px",borderBottom:"1px solid rgba(255,255,255,.04)",textAlign:"right"};

  return(
    <div className="tbl-wrap">
      <div className="tbl-head">
        <span className="tbl-head-title">🏪 Taxas por Canal × Categoria</span>
        <span style={{fontSize:12,color:"var(--muted)"}}>Valores em destaque = personalizados por categoria</span>
      </div>
      <div style={{padding:12,display:"flex",flexDirection:"column",gap:6}}>
        {CANAIS.filter(c=>c.default).map(canal=>{
          const isOpen=openCanal[canal.id];
          const hasOv=!!(taxas[canal.id]&&Object.keys(taxas[canal.id]).length);
          return(
            <div key={canal.id} style={{border:"1px solid rgba(255,255,255,.08)",borderRadius:6,overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px",
                background:"rgba(255,255,255,.02)",cursor:"pointer",userSelect:"none"}}
                onClick={()=>setOpenCanal(p=>({...p,[canal.id]:!p[canal.id]}))}>
                <span style={{fontSize:9,color:"#5a6a84",width:10}}>{isOpen?"▾":"▸"}</span>
                <span style={{flex:1,fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,color:"#f0f4ff"}}>{canal.label}</span>
                <span style={{fontSize:10,color:"#5a6a84",fontFamily:"'Montserrat',sans-serif"}}>
                  {VC_FIELDS.map(f=>`${f.label.slice(0,3)}: ${canal.default[f.id]}%`).join(" · ")}
                </span>
                {hasOv&&<span style={{fontSize:9,background:"rgba(60,219,192,.15)",color:"#3CDBC0",
                  padding:"2px 7px",borderRadius:10,fontWeight:700,marginLeft:4}}>personalizado</span>}
                {hasOv&&<button style={{fontSize:10,color:"#f87171",background:"none",
                  border:"1px solid rgba(248,113,113,.3)",borderRadius:3,padding:"2px 7px",cursor:"pointer",marginLeft:4}}
                  onClick={e=>{e.stopPropagation();resetCanal(canal.id);}}>↺ reset</button>}
              </div>
              {isOpen&&(
                <div style={{padding:"10px 12px",background:"rgba(0,0,0,.15)"}}>
                  <div style={{marginBottom:8,fontSize:10,color:"#5a6a84"}}>
                    Deixe igual ao padrão para usar o valor default. Campos em <span style={{color:"#3CDBC0"}}>verde</span> têm override ativo.
                  </div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead>
                        <tr>
                          <th style={{...thS,textAlign:"left",minWidth:140}}>Categoria</th>
                          {VC_FIELDS.map(f=><th key={f.id} style={{...thS,minWidth:80}}>{f.label} %</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {CATS.map(cat=>(
                          <tr key={cat.id} style={{transition:"background .1s"}}>
                            <td style={{...tdS,textAlign:"left",paddingLeft:10}}>
                              <span style={{fontWeight:600,color:"#c8d6e8"}}>{cat.icon} {cat.label}</span>
                            </td>
                            {VC_FIELDS.map(f=>{
                              const ov=taxas[canal.id]?.[cat.id]?.[f.id];
                              const isOv=ov!==undefined;
                              const val=isOv?ov:canal.default[f.id];
                              return(
                                <td key={f.id} style={tdS}>
                                  <input type="number" step="0.01" min="0"
                                    value={val}
                                    onChange={e=>setRate(canal.id,cat.id,f.id,e.target.value)}
                                    onFocus={e=>{if(!isOv)setRate(canal.id,cat.id,f.id,canal.default[f.id]);}}
                                    style={{width:68,textAlign:"right",
                                      background:isOv?"rgba(60,219,192,.08)":"rgba(255,255,255,.03)",
                                      border:`1px solid ${isOv?"rgba(60,219,192,.35)":"rgba(255,255,255,.08)"}`,
                                      borderRadius:3,color:isOv?"#3CDBC0":"#6b7280",
                                      padding:"4px 6px",fontSize:11,outline:"none",
                                      fontFamily:"'Montserrat',sans-serif"}}/>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ── PRODUTOS — NCM base sem fábrica ──────────────────────────────────────────
// uf/ipi/pcBase são definidos dinamicamente pela origem escolhida pelo usuário
// Padrões por categoria (fontes: planilhas abr/2026 — Informática, Mobilidade, SmartHome, PosiSeg):
//   cfixoPad: custo fixo | royalPad: royalties | scrapPad: quebra/refugo
//   fretePad: frete venda | bkpPad: backup/custódia (% sobre VPL)
const PRODUTOS = [
  //                                                                                cfixo  royal  scrap  frete  bkp
  {id:"pos",  cat:"pos",         ncm:"8470.50.10", nome:"Terminal de Pagamento",         cfixoPad:4.34, royalPad:0,    scrapPad:0.71, fretePad:1.20, bkpPad:2.54, mva:0,   aliqST:0,   fti:2.2, ipiMAO:0,    ipiIOS:0,    ipiCWB:0,    credMAO:12, credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:4 },
  {id:"nb12", cat:"informatica", ncm:"8471.30.12", nome:'Notebook/Tablet 8"-14"',        cfixoPad:4.34, royalPad:0,    scrapPad:0.71, fretePad:2.18, bkpPad:2.54, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:15,   ipiCWB:15,   credMAO:12, credIOS:12, credCWB:7,  icmsMAO:12, icmsIOS:12, icmsCWB:7 },
  {id:"nb19", cat:"informatica", ncm:"8471.30.19", nome:'Notebook/Tablet 15"+',          cfixoPad:4.34, royalPad:0,    scrapPad:0.71, fretePad:2.18, bkpPad:2.54, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:15,   ipiCWB:15,   credMAO:12, credIOS:12, credCWB:7,  icmsMAO:12, icmsIOS:12, icmsCWB:7 },
  {id:"tab7", cat:"informatica", ncm:"8471.30.11", nome:'Tablet 7"',                     cfixoPad:4.76, royalPad:2.49, scrapPad:0.91, fretePad:1.70, bkpPad:2.54, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:15,   ipiCWB:15,   credMAO:12, credIOS:12, credCWB:7,  icmsMAO:12, icmsIOS:12, icmsCWB:7 },
  {id:"cpu",  cat:"informatica", ncm:"8471.50.10", nome:"CPU Pequena Capacidade",        cfixoPad:4.34, royalPad:0,    scrapPad:0.71, fretePad:1.65, bkpPad:2.54, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:9.75, ipiCWB:9.75, credMAO:12, credIOS:12, credCWB:4,  icmsMAO:12, icmsIOS:12, icmsCWB:4 },
  {id:"aio",  cat:"informatica", ncm:"8471.49.00", nome:"All In One / Servidor",         cfixoPad:4.34, royalPad:0,    scrapPad:0.71, fretePad:1.65, bkpPad:2.54, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:9.75, ipiCWB:9.75, credMAO:12, credIOS:12, credCWB:4,  icmsMAO:12, icmsIOS:12, icmsCWB:4 },
  {id:"smt",  cat:"smartphones", ncm:"8517.13.00", nome:"Smartphone",                    cfixoPad:4.76, royalPad:2.01, scrapPad:1.12, fretePad:0.72, bkpPad:1.50, mva:25,  aliqST:19,  fti:2.2, ipiMAO:0,    ipiIOS:15,   ipiCWB:15,   credMAO:12, credIOS:12, credCWB:4,  icmsMAO:12, icmsIOS:12, icmsCWB:4 },
  {id:"fp",   cat:"smartphones", ncm:"8517.14.31", nome:"Feature Phone (linha P)",       cfixoPad:2.00, royalPad:0,    scrapPad:0.51, fretePad:1.54, bkpPad:1.50, mva:25,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:11.25,ipiCWB:11.25,credMAO:12, credIOS:0,  credCWB:4,  icmsMAO:12, icmsIOS:12, icmsCWB:4 },
  {id:"vpc",  cat:"smarthome",   ncm:"8517.62.77", nome:"Smart Video Porteiro",          cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:2.48, mva:37,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:15,   ipiCWB:15,   credMAO:12, credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:7 },
  {id:"rtr",  cat:"smarthome",   ncm:"8517.62.41", nome:"Router Mesh",                   cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:2.48, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:15,   ipiCWB:15,   credMAO:12, credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:4 },
  {id:"gw",   cat:"smarthome",   ncm:"8517.62.94", nome:"Smart Central/Gateway",         cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:2.48, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:9.75, ipiCWB:9.75, credMAO:12, credIOS:0,  credCWB:4,  icmsMAO:12, icmsIOS:12, icmsCWB:4 },
  {id:"cam",  cat:"smarthome",   ncm:"8525.89.29", nome:"Smart Camera WiFi",             cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:2.48, mva:35,  aliqST:19,  fti:2.2, ipiMAO:0,    ipiIOS:15,   ipiCWB:15,   credMAO:12, credIOS:12, credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:7 },
  {id:"mon",  cat:"informatica", ncm:"8528.52.00", nome:"Monitor PPB",                   cfixoPad:4.34, royalPad:0,    scrapPad:0.71, fretePad:1.65, bkpPad:2.54, mva:25,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:0,    ipiCWB:0,    credMAO:12, credIOS:12, credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:7 },
  {id:"kbd",  cat:"informatica", ncm:"8471.60.52", nome:"Teclado Importação Direta",     cfixoPad:4.34, royalPad:0,    scrapPad:0.71, fretePad:2.18, bkpPad:2.54, mva:35,  aliqST:19,  fti:0,   ipiMAO:9.75, ipiIOS:9.75, ipiCWB:9.75, credMAO:3,  credIOS:3,  credCWB:0,  icmsMAO:4,  icmsIOS:12, icmsCWB:4 },
  {id:"tot",  cat:"informatica", ncm:"8471.60.80", nome:"Totem",                         cfixoPad:4.34, royalPad:0,    scrapPad:0.71, fretePad:1.20, bkpPad:2.54, mva:0,   aliqST:0,   fti:0,   ipiMAO:0,    ipiIOS:9.75, ipiCWB:9.75, credMAO:12, credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:7 },
  {id:"spk",  cat:"smarthome",   ncm:"8518.22.00", nome:"Caixa de Som Bluetooth",        cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:2.48, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:15,   ipiCWB:15,   credMAO:12, credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:4 },
  {id:"chr",  cat:"mobilidade",  ncm:"8504.40.10", nome:"Carregador Celular",            cfixoPad:4.76, royalPad:0,    scrapPad:0.51, fretePad:1.54, bkpPad:1.50, mva:50,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:5,    ipiCWB:5,    credMAO:12, credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:4 },
  {id:"lmp",  cat:"smarthome",   ncm:"8539.52.00", nome:"Smart Lâmpada WiFi",            cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:1.28, mva:63.67,aliqST:19, fti:0,   ipiMAO:0,    ipiIOS:6.5,  ipiCWB:6.5,  credMAO:12, credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:4 },
  {id:"rob",  cat:"smarthome",   ncm:"8508.11.00", nome:"Smart Robô Aspirador",          cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:2.72, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:6.5,  ipiCWB:6.5,  credMAO:12, credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:4 },
  {id:"spg",  cat:"smarthome",   ncm:"8536.50.90", nome:"Smart Plug WiFi",               cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:1.76, mva:38,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:3.25, ipiCWB:3.25, credMAO:12, credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:7 },
  // ── SmartHome — iluminação extra ─────────────────────────────────────────
  {id:"lum1", cat:"smarthome",   ncm:"9405.11.90", nome:"Smart Luminária Painel/Embutir",cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:1.84, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:9.75, ipiCWB:9.75, credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  {id:"lum2", cat:"smarthome",   ncm:"9405.21.00", nome:"Smart Luminária de Mesa",       cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:1.84, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:9.75, ipiCWB:9.75, credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  {id:"fled", cat:"smarthome",   ncm:"9405.42.00", nome:"Smart Fita LED",                cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:1.84, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:0,    ipiCWB:0,    credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  // ── SmartHome — acessórios aspirador / casa ──────────────────────────────
  {id:"rasp", cat:"smarthome",   ncm:"8508.70.00", nome:"Acessório Robô (tanque/filtro)",cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:1.84, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:6.5,  ipiCWB:6.5,  credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  {id:"petf", cat:"smarthome",   ncm:"8509.80.90", nome:"Alimentador PET / Robô Laser",  cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:1.84, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:6.5,  ipiCWB:6.5,  credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  {id:"ctrl", cat:"smarthome",   ncm:"8543.70.99", nome:"Sensor / Controle Eletrônico",  cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:1.84, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:6.5,  ipiCWB:6.5,  credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  {id:"hepa", cat:"smarthome",   ncm:"8421.39.90", nome:"Filtro HEPA",                   cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:1.84, mva:0,   aliqST:0,   fti:0,   ipiMAO:0,    ipiIOS:0,    ipiCWB:0,    credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  {id:"brs",  cat:"smarthome",   ncm:"9603.50.00", nome:"Escova / Acessório Aspirador",  cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:1.84, mva:0,   aliqST:0,   fti:0,   ipiMAO:0,    ipiIOS:0,    ipiCWB:0,    credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  {id:"mop",  cat:"smarthome",   ncm:"6307.10.00", nome:"Mop / Pano (acessório)",        cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:1.84, mva:0,   aliqST:0,   fti:0,   ipiMAO:0,    ipiIOS:0,    ipiCWB:0,    credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:4,  icmsIOS:4,  icmsCWB:4 },
  {id:"bag",  cat:"smarthome",   ncm:"6307.90.10", nome:"Saco de Poeira (acessório)",    cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:1.84, mva:0,   aliqST:0,   fti:0,   ipiMAO:0,    ipiIOS:0,    ipiCWB:0,    credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:4,  icmsIOS:4,  icmsCWB:4 },
  {id:"lock", cat:"smarthome",   ncm:"8301.40.00", nome:"Fechadura Eletrônica",          cfixoPad:7.14, royalPad:0,    scrapPad:1.09, fretePad:2.45, bkpPad:2.72, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:0,    ipiCWB:0,    credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  // ── Mobilidade ───────────────────────────────────────────────────────────
  {id:"wtch", cat:"mobilidade",  ncm:"9102.12.20", nome:"Smartwatch",                    cfixoPad:2.00, royalPad:0,    scrapPad:0.51, fretePad:1.54, bkpPad:1.50, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:15,   ipiCWB:15,   credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  // ── PosiSeg — CFTV ───────────────────────────────────────────────────────
  {id:"nvr",  cat:"posiseg",     ncm:"8521.90.00", nome:"DVR / XVR / NVR Gravador",     cfixoPad:30.32,royalPad:0,    scrapPad:2.00, fretePad:1.09, bkpPad:1.20, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:15,   ipiCWB:15,   credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  {id:"caip", cat:"posiseg",     ncm:"8525.89.13", nome:"Câmera IP / Analógica Básica",  cfixoPad:30.32,royalPad:0,    scrapPad:2.00, fretePad:1.09, bkpPad:1.20, mva:0,   aliqST:0,   fti:0,   ipiMAO:0,    ipiIOS:13,   ipiCWB:13,   credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  // ── PosiSeg — Redes ──────────────────────────────────────────────────────
  {id:"swt",  cat:"posiseg",     ncm:"8517.62.34", nome:"Switch PoE Ethernet",           cfixoPad:30.32,royalPad:0,    scrapPad:2.00, fretePad:1.09, bkpPad:1.20, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:9.75, ipiCWB:9.75, credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  {id:"hdmx", cat:"posiseg",     ncm:"8517.62.59", nome:"Extensor HDMI",                 cfixoPad:30.32,royalPad:0,    scrapPad:2.00, fretePad:1.09, bkpPad:1.20, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:15,   ipiCWB:15,   credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  // ── PosiSeg — Controle de Acesso ─────────────────────────────────────────
  {id:"rfid", cat:"posiseg",     ncm:"8471.90.19", nome:"Leitor RFID / Facial",          cfixoPad:30.32,royalPad:0,    scrapPad:2.00, fretePad:1.09, bkpPad:1.20, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:9.75, ipiCWB:9.75, credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  {id:"prox", cat:"posiseg",     ncm:"8523.52.10", nome:"Cartão Proximity / RFID",       cfixoPad:30.32,royalPad:0,    scrapPad:2.00, fretePad:1.09, bkpPad:1.20, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:6.5,  ipiCWB:6.5,  credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  // ── PosiSeg — Intrusão ───────────────────────────────────────────────────
  {id:"alrm", cat:"posiseg",     ncm:"8531.10.90", nome:"Central de Alarme",             cfixoPad:30.32,royalPad:0,    scrapPad:2.00, fretePad:1.09, bkpPad:1.20, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:9.75, ipiCWB:9.75, credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  // ── PosiSeg — Balun / Conectividade ─────────────────────────────────────
  {id:"bln",  cat:"posiseg",     ncm:"8504.40.21", nome:"Balun / Power Balun",           cfixoPad:30.32,royalPad:0,    scrapPad:2.00, fretePad:1.09, bkpPad:1.20, mva:48,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:3.75, ipiCWB:3.75, credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
  // ── PosiSeg — Armazenamento ──────────────────────────────────────────────
  {id:"hddx", cat:"posiseg",     ncm:"8471.70.10", nome:"HDD (Disco Rígido)",            cfixoPad:30.32,royalPad:0,    scrapPad:2.00, fretePad:1.09, bkpPad:1.20, mva:35,  aliqST:19,  fti:0,   ipiMAO:0,    ipiIOS:10,   ipiCWB:10,   credMAO:0,  credIOS:0,  credCWB:0,  icmsMAO:12, icmsIOS:12, icmsCWB:12},
];

// Converte produto do catálogo (snake_case) → shape da calculadora (camelCase)
const normalizeProdutoDB = r => {
  // Tributos: usar tabela PRODUTOS hardcoded por NCM (perfil tributário por regime/planta)
  // Fallback para os valores do catálogo se o NCM não existir na tabela
  const base = PRODUTOS.find(p => p.ncm === r.ncm) ?? {};
  return {
    id: r.id, ncm: r.ncm||"", nome: r.nome||"",
    // Tributos — PRODUTOS por NCM é fonte primária; catálogo só como fallback
    mva:    base.mva     ?? r.mva     ?? 0,
    aliqST: base.aliqST  ?? r.aliq_st ?? 0,
    ipiMAO: base.ipiMAO  ?? r.ipi_mao ?? 0,
    ipiIOS: base.ipiIOS  ?? r.ipi_ios ?? 0,
    ipiCWB: base.ipiCWB  ?? r.ipi_cwb ?? 0,
    credMAO: base.credMAO ?? r.cred_mao ?? 0,
    credIOS: base.credIOS ?? r.cred_ios ?? 0,
    credCWB: base.credCWB ?? r.cred_cwb ?? 0,
    icmsMAO: base.icmsMAO ?? r.icms_mao ?? 0,
    icmsIOS: base.icmsIOS ?? r.icms_ios ?? 0,
    icmsCWB: base.icmsCWB ?? r.icms_cwb ?? 0,
    // Índices — sempre do catálogo (valores inseridos por produto)
    fti: r.fti ?? 0,
    cfixoPad: base.cfixoPad ?? r.cfixo_pad ?? 0,
    royalPad: base.royalPad ?? r.royal_pad ?? 0,
    scrapPad: base.scrapPad ?? r.scrap_pad ?? 0,
    fretePad: base.fretePad ?? r.frete_pad ?? 0,
    bkpPad:   base.bkpPad   ?? r.bkp_pad   ?? 0,
  };
};

// ── ORIGENS e MODALIDADES ─────────────────────────────────────────────────────
// footprint: custo/benefício operacional da fábrica (% sobre pF) — CKD/SKD apenas
// pdPad: alíquota padrão P&D para CKD (confirmada pelas planilhas abr/2026)
const ORIGENS = [
  { id:"MAO", label:"MAO — Manaus",       uf:"AM", zmf:true,  footprint:-0.71, pdPad:2.55 },
  { id:"IOS", label:"IOS — Ilhéus (BA)",  uf:"BA", zmf:false, footprint: 1.00, pdPad:3.48 },
  { id:"CWB", label:"CWB — Curitiba (PR)",uf:"PR", zmf:false, footprint: 0,    pdPad:3.48 },
];
const MODALIDADES = [
  { id:"CKD", label:"CKD — Componentes importados + produção nacional",
    desc:"Importação de componentes desagregados. PPB obrigatório aplicável." },
  { id:"SKD", label:"SKD — Semi knocked down (placa importada)",
    desc:"Placa principal importada já montada. Produção parcial nacional." },
  { id:"CBU", label:"CBU — Produto acabado importado",
    desc:"Produto 100% importado pronto para comercialização. PPB não se aplica." },
];

// ── CATEGORIAS DE PRODUTO ─────────────────────────────────────────────────────
const CATS = [
  { id:"informatica", label:"Informática",              icon:"💻" },
  { id:"smartphones",  label:"Smartphones",              icon:"📱" },
  { id:"mobilidade",   label:"Mobilidade",               icon:"⌚" },
  { id:"smarthome",    label:"Smart Home",               icon:"🏠" },
  { id:"posiseg",      label:"PosiSeg (Segurança)",      icon:"🔒" },
  { id:"pos",          label:"Terminais de Pagamento",   icon:"💳" },
];

// ── CANAIS — presets comerciais (fontes: planilhas abr/2026) ──────────────────
// Taxas padrão em `default`. Overrides por categoria ficam em localStorage.
// getCanalRates(canalId, cat) → resolve: override salvo → default do canal
const CANAIS_TAXAS_KEY = "canais_taxas_v1";
const loadCanaisTaxas = () => { try{ return JSON.parse(localStorage.getItem(CANAIS_TAXAS_KEY))||{}; }catch{ return {}; } };
const saveCanaisTaxas = v => localStorage.setItem(CANAIS_TAXAS_KEY, JSON.stringify(v));
const getCanalRates = (canalId, cat) => {
  const canal = CANAIS.find(c=>c.id===canalId);
  if(!canal||!canal.default) return null;
  const saved = loadCanaisTaxas();
  return { ...canal.default, ...(saved[canalId]?.[cat]||{}) };
};

const CANAIS = [
  { id:"",        label:"— Canal (opcional) —", comis:null },
  { id:"t1t2",    label:"T1/T2 Varejo",               default:{ comis:0,    mkt:1.50, rebate:3.00, pdd:2.5, vpc:0    } },
  { id:"t3",      label:"T3 / Distribuidor",           default:{ comis:0.98, mkt:1.50, rebate:1.65, pdd:2.5, vpc:0    } },
  { id:"corp",    label:"Canais / Corporativo",        default:{ comis:2.98, mkt:1.40, rebate:0,    pdd:2.5, vpc:0    } },
  { id:"amzn",    label:"Amazon",                      default:{ comis:3.25, mkt:3.74, rebate:1.00, pdd:2.5, vpc:5.84 } },
  { id:"meli",    label:"MercadoLivre (Ebazar)",       default:{ comis:2.17, mkt:4.00, rebate:1.00, pdd:2.5, vpc:3.70 } },
  { id:"magalu",  label:"Magazine Luiza",              default:{ comis:0,    mkt:1.50, rebate:1.00, pdd:2.5, vpc:0    } },
  { id:"csbahia", label:"Grupo Casas Bahia",           default:{ comis:0,    mkt:1.50, rebate:1.00, pdd:2.5, vpc:0.30 } },
  { id:"ameri",   label:"Americanas",                  default:{ comis:0,    mkt:1.50, rebate:1.00, pdd:2.5, vpc:2.00 } },
  { id:"carref",  label:"Carrefour",                   default:{ comis:0,    mkt:1.50, rebate:1.00, pdd:2.5, vpc:7.81 } },
  { id:"cencosud",label:"Cencosud",                    default:{ comis:0,    mkt:1.50, rebate:1.00, pdd:2.5, vpc:4.20 } },
  { id:"leroy",   label:"Leroy Merlin",                default:{ comis:3.25, mkt:2.00, rebate:1.00, pdd:2.5, vpc:3.20 } },
  { id:"telef",   label:"Telefônica / TIM",            default:{ comis:2.44, mkt:2.00, rebate:1.00, pdd:2.5, vpc:5.40 } },
  { id:"vd",      label:"Venda Direta (site próprio)", default:{ comis:0,    mkt:1.50, rebate:0,    pdd:2.5, vpc:0    } },
  { id:"pseg",    label:"PosiSeg B2B (direto)",        default:{ comis:0,    mkt:4.00, rebate:0,    pdd:2.5, vpc:0    } },
];

// Resolve atributos do produto baseado em origem + modalidade
const getProdAtributos = (prod, origem, modalidade) => {
  const o = ORIGENS.find(x=>x.id===origem) || ORIGENS[0];
  const isCBU = modalidade === "CBU";
  const k = origem.toLowerCase(); // "mao" | "ios" | "cwb"

  // CBU: todos os impostos de importação cheios, sem isenções ZFM
  // CKD/SKD em MAO: isenções ZFM
  // CKD/SKD em IOS/CWB: impostos cheios (CWB tem ICMS com possível deságio 35%)
  return {
    uf: o.uf,
    // CBU: produto importado pronto — nunca tem isenção ZFM de IPI; usa alíquota cheia (ipiIOS ou ipiCWB)
    ipi:  isCBU ? (prod.ipiIOS || prod.ipiCWB || prod[`ipi${origem}`] || 0) : prod[`ipi${origem}`],
    pcBase: o.zmf && !isCBU ? "zmf" : 9.25,
    icms: prod[`icms${origem}`],
    // CBU: sem crédito presumido na venda (crédito presumido é benefício de fabricação, não de importação direta)
    cred: isCBU ? 0 : prod[`cred${origem}`],
    mva:  prod.mva,
    aliqST: prod.aliqST,
    fti:  o.zmf && !isCBU ? prod.fti : 0,
    cat:      prod.cat      || "",
    cfixoPad: prod.cfixoPad ?? 0,
    royalPad: prod.royalPad ?? 0,
    scrapPad: prod.scrapPad ?? 0,
    fretePad: prod.fretePad ?? 0,
    bkpPad:   prod.bkpPad   ?? 0,
    // CBU: PIS/COFINS cheio (pcBase vira 9.25 acima), sem FTI
    // CBU: ICMS da UF importadora (SP por padrão, editável)
    isCBU,
    isZFM: o.zmf && !isCBU,
  };
};

const PC_ZFM = [
  {k:"dentro_zmf",   label:"Comprador dentro da ZFM",pct:0,
   sub:"PJ ou PF nos municipios de Manaus, Pres. Figueiredo ou Rio Preto da Eva.",
   base:"Despacho MF S/N de 13.11.2017 / Parecer PGFN 1743/2016"},
  {k:"nao_cumulativo",label:"Lucro Real (100% nao-cumulativo)",pct:3.65,
   sub:"PJ fora da ZFM com 100% das receitas no regime nao-cumulativo.",
   base:"Lei 10.637/02, art. 2o, par.4o, I,b | Lei 10.833/03, art. 2o, par.5o, I,b"},
  {k:"cumulativo",   label:"Lucro Presumido / Simples / Misto / Orgao Publico",pct:7.30,
   sub:"Lucro Presumido, Simples Nacional, Lucro Real parcial e adm. publica.",
   base:"Lei 10.637/02, art. 2o, par.4o, II | Lei 10.833/03, art. 2o, par.5o"},
  {k:"outros",       label:"ONG / Entidade sem fins lucrativos / PF",pct:9.25,
   sub:"Sistema S (Sesi, Senai), APAE, APM, pessoa fisica fora da ZFM.",
   base:"Lei 10.637/02, art. 2o, caput | Lei 10.833/03, art. 2o, caput"},
];

const UFS=["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
const MX={
  AC:[19,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  AL:[12,21.5,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  AM:[12,12,20,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  AP:[12,12,12,18,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  BA:[12,12,12,12,20.5,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  CE:[12,12,12,12,12,20,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  DF:[12,12,12,12,12,12,20,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  ES:[12,12,12,12,12,12,12,17,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  GO:[12,12,12,12,12,12,12,12,19,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  MA:[12,12,12,12,12,12,12,12,12,23,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  MG:[7,7,7,7,7,7,7,7,7,7,18,7,7,7,7,7,7,12,12,7,7,7,12,12,7,12,7],
  MS:[12,12,12,12,12,12,12,12,12,12,12,17,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  MT:[12,12,12,12,12,12,12,12,12,12,12,12,17,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  PA:[12,12,12,12,12,12,12,12,12,12,12,12,12,19,12,12,12,12,12,12,12,12,12,12,12,12,12],
  PB:[12,12,12,12,12,12,12,12,12,12,12,12,12,12,20,12,12,12,12,12,12,12,12,12,12,12,12],
  PE:[12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,20.5,12,12,12,12,12,12,12,12,12,12,12],
  PI:[12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,22.5,12,12,12,12,12,12,12,12,12,12],
  PR:[7,7,7,7,7,7,7,7,7,7,12,7,7,7,7,7,7,19.5,12,7,7,7,12,12,7,12,7],
  RJ:[7,7,7,7,7,7,7,7,7,7,12,7,7,7,7,7,7,12,22,7,7,7,12,12,7,12,7],
  RN:[12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,20,12,12,12,12,12,12,12],
  RO:[12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,19.5,12,12,12,12,12,12],
  RR:[12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,20,12,12,12,12,12],
  RS:[7,7,7,7,7,7,7,7,7,7,12,7,7,7,7,7,7,12,12,7,7,7,17,12,7,12,7],
  SC:[7,7,7,7,7,7,7,7,7,7,12,7,7,7,7,7,7,12,12,7,7,7,12,17,12,12,7],
  SE:[12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,20,12,12],
  SP:[7,7,7,7,7,7,7,7,7,7,12,7,7,7,7,7,7,12,12,7,7,7,12,12,7,18,7],
  TO:[12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,20],
};
const ALIQ_INT={AC:19,AL:21.5,AM:20,AP:18,BA:20.5,CE:20,DF:20,ES:17,GO:19,MA:23,MG:18,MS:17,MT:17,PA:19,PB:20,PE:20.5,PI:22.5,PR:19.5,RJ:22,RN:20,RO:19.5,RR:20,RS:17,SC:17,SE:20,SP:18,TO:20};
const FCP={AL:1,MG:1,RJ:2,SE:1};
const getICMS=(o,d)=>{if(o===d)return ALIQ_INT[o]||18;const r=MX[o],i=UFS.indexOf(d);return(r&&i>=0)?r[i]:12;};

const PPB_ITEMS=[
  {id:"injecao",label:"Injecao Plastica"},{id:"bateria",label:"Bateria"},
  {id:"carregador",label:"Carregador"},{id:"memoria",label:"Memoria"},
  {id:"cabo",label:"Cabo"},{id:"placa",label:"Producao da Placa (PCB)"},
];

const brl=v=>(!isFinite(v)||isNaN(v))?"":v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const usd=v=>(!isFinite(v)||isNaN(v))?"":"USD "+v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=v=>`${(+v||0).toFixed(3).replace(/\.?0+$/,"").replace(".",",")}%`;
const n3=v=>(+v||0).toFixed(3).replace(/\.?0+$/,"").replace(".",",");
const parse=s=>parseFloat(String(s).replace(",","."))||0;

const DEF={
  prodId:"pos", origem:"MAO", modalidade:"CKD",
  pcZfmKey:"nao_cumulativo",regimeVendedor:"real",
  tipoComprador:"contrib",destinacaoCliente:"revenda",ufDestino:"SP",
  icmsDiferimento:0,
  fobUSD:0,freteUSD:0,ptax:5.31,seguroBRL:0,aliqII:0,
  despesas:0,despesasPct:0,despesasModo:"pct",
  cfImp:0,cra:0,
  conteudoLocal:0, plmPct:0,
  ppbAtivos:{injecao:false,bateria:false,carregador:false,memoria:false,cabo:false,placa:false},
  ppbVals:{injecao:0,bateria:0,carregador:0,memoria:0,cabo:0,placa:0},
  producao:0,garantia:0,bkpPct:0,outrosBRL:0,embalagem:0,ftiAtivo:false,
  pd:0,cfixo:0,scrap:0,royal:0,cfVenda:0,frete:0,
  comis:0,comisX:0,mkt:0,rebate:0,pdd:2.5,vbExtra:0,vpc:0,margem:0,
  canalId:"",
  cartaoAtivo:false,
  margGer:0,margGerAtivo:false,
  royalModo:"pct",royalUSD:0,
  ptaxPreco:0,
  stAtivo:false,mva:0,icmsDestST:18,precoAlvo:0,
  modoCalc:"preco", precoSugerido:0,
  moedaCusto:"BRL",
  vplModo:"estimado", vplManual:0,
};

const CALC_DEF={
  frete:{sUSD:0,aUSD:0,saUSD:0,pS:100,pA:0,pSA:0,applied:false},
  cfImp:{tr:30,pp:-30,tx:0.8,applied:false},
  pcb:{tl:0,vol:1000,tempo:0,pctFob:0},
  cfVenda:{prazo:60,taxa:1.14,applied:false},
};

// ── Storage de Registros ──────────────────────────────────────────────────────
const STORAGE_KEY = "positec_calc_registros";
const STORAGE_PASTAS = "positec_calc_pastas";
const loadRegistros = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); } catch { return []; } };
const saveRegistros = (list) => localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
const loadPastas = () => { try { return JSON.parse(localStorage.getItem(STORAGE_PASTAS)||"[]"); } catch { return []; } };
const savePastas = (list) => localStorage.setItem(STORAGE_PASTAS, JSON.stringify(list));

// ── NInput ────────────────────────────────────────────────────────────────────
function NInput({value,onChange,readOnly,width=80}){
  const [raw,setRaw]=useState(String(value).replace(".",","));
  const [lastProp,setLastProp]=useState(value);
  const [focused,setFocused]=useState(false);
  // Sincroniza raw quando value muda externamente (calculadora PCB, frete, etc.)
  if(!focused&&value!==lastProp){
    setLastProp(value);
    setRaw(String(+value||0).replace(".",","));
  }
  const shown=readOnly?String(+value||0).replace(".",","):raw;
  return(
    <input type="text" inputMode="decimal" value={shown} readOnly={!!readOnly}
      style={{background:"none",border:"none",outline:"none",fontFamily:"'Montserrat',sans-serif",
        fontSize:11,fontWeight:500,color:"#f1f5f9",padding:"5px 8px",width,textAlign:"right"}}
      onFocus={()=>setFocused(true)}
      onChange={e=>{
        if(readOnly)return;
        const v=e.target.value;
        if(/^-?\d*[,.]?\d{0,3}$/.test(v)||v===""||v==="-"){setRaw(v);onChange(parse(v));}
      }}
      onBlur={()=>{setFocused(false);if(!readOnly){const n=parse(raw);setRaw(String(n).replace(".",","));}}}
    />
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({label,value,onChange,sfx="",hint,note,readOnly,action,locked,onUnlock}){
  const isRO=readOnly||locked;
  return(
    <div style={{display:"flex",alignItems:"flex-start",gap:8,justifyContent:"space-between"}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",gap:2}}>
        <span style={{fontSize:12,fontWeight:600,color:"#f0f0f0",letterSpacing:".3px"}}>{label}</span>
        {hint&&<span style={{fontSize:10,color:"#A7A8AA",fontFamily:"'Montserrat',sans-serif"}}>{hint}</span>}
        {note&&<span style={{fontSize:10,color:"#f87171",fontFamily:"'Montserrat',sans-serif"}}>{note}</span>}
      </div>
      <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
        <div className={`fw ${isRO?"fro":""} ${locked?"flocked":""}`}>
          {sfx&&<span className="fpre">{sfx}</span>}
          <NInput value={value} onChange={onChange||(()=>{})} readOnly={isRO}/>
        </div>
        {locked&&onUnlock&&(
          <button className="cbtn cunlock" title="Desvincular calculadora — editar manualmente" onClick={onUnlock}>↩</button>
        )}
        {action}
      </div>
    </div>
  );
}

function RG({label,val,onChange,opts}){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {label&&<div style={{fontSize:12,fontWeight:600,color:"#f0f0f0",letterSpacing:".3px"}}>{label}</div>}
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {opts.map(o=><button key={o.v} className={`rgb ${val===o.v?"on":""}`} onClick={()=>onChange(o.v)}>{o.l}</button>)}
      </div>
    </div>
  );
}
function Tog({label,val,onChange,hint}){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
      <div style={{flex:1}}>
        <div style={{fontSize:12,fontWeight:600,color:"#f0f0f0",letterSpacing:".3px"}}>{label}</div>
        {hint&&<div style={{fontSize:10,color:"#A7A8AA",fontFamily:"'Montserrat',sans-serif"}}>{hint}</div>}
      </div>
      <button className={`tog ${val?"on":""}`} onClick={()=>onChange(!val)}><span className="tknob"/></button>
    </div>
  );
}
function Box({children,t="warn"}){return <div className={`ib ${t}`}>{children}</div>;}
function DR({label,value,accent,bold,sep}){
  return(
    <div className={`dr ${bold?"drb":""} ${sep?"drs":""} ${accent||""}`}>
      <span>{label}</span><span className="dv">{value}</span>
    </div>
  );
}
function WF({label,val,total,color,isT,sub}){
  const p=total>0?(Math.abs(val)/total)*100:0;
  return(
    <div className={`wfr ${isT?"wft":""} ${sub?"wfs":""}`}>
      <span className="wfl">{label}</span>
      <div className="wftr"><div className="wff" style={{width:`${Math.min(100,p)}%`,background:color}}/></div>
      <span className="wfp">{pct(p)}</span>
      <span className="wfv">{brl(val)}</span>
    </div>
  );
}
function Sec({title,tag,children,hl}){
  return(
    <div className={`sec ${hl?"hl":""}`}>
      <div className="sech">
        <span className="sect">{title}</span>
        {tag&&<span className="sectag">{tag}</span>}
      </div>
      <div className="secb">{children}</div>
    </div>
  );
}
function MI({val,onChange,sfx="USD",width=60}){
  const [r,setR]=useState(String(val).replace(".",","));
  return(
    <div className="fw" style={{minWidth:88}}>
      <span className="fpre">{sfx}</span>
      <input type="text" inputMode="decimal" value={r}
        style={{background:"none",border:"none",outline:"none",fontFamily:"'Montserrat',sans-serif",
          fontSize:11,fontWeight:500,color:"#f1f5f9",padding:"5px 6px",width,textAlign:"right"}}
        onChange={e=>{const v=e.target.value;if(/^-?\d*[,.]?\d{0,3}$/.test(v)||v===""){setR(v);onChange(parse(v));}}}
        onBlur={()=>{const n=parse(r);setR(String(n).replace(".",","));}}/>
    </div>
  );
}

// ── Modal CF Importação ───────────────────────────────────────────────────────
// Formula: FOB * ((1+taxa_mensal)^(dias/30) - 1)
// taxa em % a.m. (ex: 0,8% a.m.)  |  prazo negativo = antecipacao
function ModalCF({onClose,onApply,fobUSD,ptax,data,setData}){
  const dias=data.tr+data.pp;
  const cfFactor=Math.pow(1+data.tx/100,dias/30)-1;
  const cfUSD=fobUSD*cfFactor;
  const cfBRL=cfUSD*ptax;
  return(
    <div className="ov">
      <div className="mb" onClick={e=>e.stopPropagation()}>
        <div className="mh"><span className="mt">Custo Financeiro de Importacao</span><button className="mc" onClick={onClose}>x</button></div>
        <div className="mbody">
          <Box t="blue">{"Formula: FOB x ((1+taxa_mensal)^(dias/30) - 1)\nTaxa em % a.m. (ex: 0,8% a.m.) | Prazo negativo = antecipacao = reducao de custo."}</Box>
          <div className="pbase"><span>FOB de referencia</span><span>{usd(fobUSD)}</span></div>
          <Field label="Transit Time" sfx="dias" value={data.tr} onChange={v=>setData({...data,tr:v})} hint="Dias embarque ate chegada no porto"/>
          <Field label="Prazo de Pagamento ao Fornecedor" sfx="dias" value={data.pp} onChange={v=>setData({...data,pp:v})} hint="Negativo = antecipacao (ex: -30 dias)"/>
          <Field label="Taxa Financeira Mensal" sfx="%" value={data.tx} onChange={v=>setData({...data,tx:v})} hint="Custo do capital mensal (ex: 0,8% a.m.)"/>
          <div className="pdecomp">
            <div><span>Total dias financiados</span><span style={{color:dias<0?"#4ade80":"#94a3b8"}}>{dias} dias {dias<0?"(credito)":""}</span></div>
            <div><span>Fator total ({n3(dias/30)} meses)</span><span>{n3(cfFactor*100)}%</span></div>
            <div><span>CF em USD</span><span style={{color:cfUSD<0?"#4ade80":"#94a3b8"}}>{usd(cfUSD)}</span></div>
            <div><span>PTAX</span><span>R$ {n3(ptax)}</span></div>
          </div>
          <div className="pres" style={{borderColor:cfBRL<0?"#16a34a":"#3CDBC0"}}>
            <span style={{color:cfBRL<0?"#4ade80":"#93c5fd"}}>Custo Financeiro (BRL)</span>
            <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,color:cfBRL<0?"#4ade80":"#3CDBC0"}}>{brl(cfBRL)}</span>
          </div>
          {cfBRL<0&&<Box t="ok">Antecipacao gera reducao de custo. O valor negativo sera subtraido do CMV.</Box>}
          <button className="mapp" onClick={()=>onApply(parseFloat(cfBRL.toFixed(3)))}>Aplicar ao campo CF Importacao</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Frete Ponderado ─────────────────────────────────────────────────────
function ModalFrete({onClose,onApply,data,setData}){
  const tot=data.pS+data.pA+data.pSA;
  const fp=data.sUSD*(data.pS/100)+data.aUSD*(data.pA/100)+data.saUSD*(data.pSA/100);
  const ok=Math.abs(tot-100)<0.001;
  return(
    <div className="ov">
      <div className="mb" onClick={e=>e.stopPropagation()}>
        <div className="mh"><span className="mt">Frete Internacional Ponderado</span><button className="mc" onClick={onClose}>x</button></div>
        <div className="mbody">
          <Box t="blue">{"SEA x %SEA + AIR x %AIR + SEA+AIR x %SEA+AIR\nCusto por modal (USD/un) x percentual de utilizacao."}</Box>
          <div className="ftable">
            <div className="fth"><span>Modal</span><span>USD / un</span><span>% embarques</span></div>
            {[{k:"s",label:"SEA (maritimo)"},{k:"a",label:"AIR (aereo)"},{k:"sa",label:"SEA+AIR (combinado)"}].map(({k,label})=>(
              <div key={k} className="ftr">
                <span style={{fontSize:10,fontWeight:600,color:"#64748b"}}>{label}</span>
                <MI val={data[k+"USD"]} onChange={v=>setData({...data,[k+"USD"]:v})}/>
                <MI val={data["p"+k.toUpperCase()]} onChange={v=>setData({...data,["p"+k.toUpperCase()]:v})} sfx="%"/>
              </div>
            ))}
          </div>
          <div className={`ftot ${ok?"ftok":"ftwarn"}`}>
            <span>Soma: <strong>{n3(tot)}%</strong></span>
            {!ok&&<span style={{fontSize:9,marginLeft:6}}> — deve somar 100%</span>}
          </div>
          <div className="pres"><span>Frete ponderado</span><span>{usd(fp)}</span></div>
          <button className="mapp" disabled={!ok} style={{opacity:ok?1:0.4,cursor:ok?"pointer":"not-allowed"}}
            onClick={()=>onApply(parseFloat(fp.toFixed(3)))}>Aplicar ao campo Frete Internacional</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal PCB ─────────────────────────────────────────────────────────────────
function ModalPCB({onClose,onApply,cfrImp,data,setData}){
  const custo=useMemo(()=>(data.tl/Math.max(1,data.vol))+(data.tempo*1.40)+((data.pctFob/100)*cfrImp*0.01)+1.00,[data,cfrImp]);
  return(
    <div className="ov">
      <div className="mb" onClick={e=>e.stopPropagation()}>
        <div className="mh"><span className="mt">Producao da Placa (PCB)</span><button className="mc" onClick={onClose}>x</button></div>
        <div className="mbody">
          <Box t="blue">{"Formula: (Tooling / Vol.) + (Tempo x R$1,40/min) + (% PCB no FOB x CFR x 1%) + R$1,00"}</Box>
          <Field label="Custo de Tooling" sfx="R$" value={data.tl} onChange={v=>setData({...data,tl:v})}/>
          <Field label="Volume previsto" sfx="un" value={data.vol} onChange={v=>setData({...data,vol:v})}/>
          <Field label="Tempo de fabricacao" sfx="min" value={data.tempo} onChange={v=>setData({...data,tempo:v})} hint="Minutos por unidade — custo: R$1,40/min"/>
          <Field label="% da placa no FOB" sfx="%" value={data.pctFob} onChange={v=>setData({...data,pctFob:v})} hint="% do FOB referente a componentes PCB"/>
          <div className="pbase"><span>CFR importacao (base)</span><span>{brl(cfrImp)}</span></div>
          <div className="pdecomp">
            <div><span>Tooling / vol.</span><span>{brl(data.tl/Math.max(1,data.vol))}</span></div>
            <div><span>Fabricacao ({n3(data.tempo)} min x R$1,40)</span><span>{brl(data.tempo*1.40)}</span></div>
            <div><span>% PCB ({n3(data.pctFob)}%) x CFR x 1%</span><span>{brl((data.pctFob/100)*cfrImp*0.01)}</span></div>
            <div><span>Fixo</span><span>R$ 1,00</span></div>
          </div>
          <div className="pres"><span>Custo unitario da placa</span><span>{brl(custo)}</span></div>
          <button className="mapp" onClick={()=>onApply(parseFloat(custo.toFixed(3)))}>Aplicar ao PPB - Placa</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal CRA / Crédito Federal ──────────────────────────────────────────────
function ModalCRA({onClose, onApply, origem, c, d, prodAtrib}){
  const [aba, setAba] = useState(origem==="IOS"?"ios":"mao");
  const [conteudoLocal, setConteudoLocal] = useState(d.conteudoLocal||0);
  const [plmPct, setPlmPct] = useState(d.plmPct||0);

  // CRA (MAO)
  const iiUSD = d.ptax>0 ? c.iiV/d.ptax : 0;
  const craUSD = useMemo(()=>-((conteudoLocal/100)*iiUSD),[conteudoLocal,iiUSD]);

  // Crédito Federal (IOS)
  const cfImpUSD = d.ptax>0 ? d.cfImp/d.ptax : 0;
  const despesasUSD = d.ptax>0 ? (d.despesasModo==="pct"?c.cfrBRL*d.despesasPct/100:d.despesas)/d.ptax : 0;
  const seguroUSD = d.ptax>0 ? d.seguroBRL/d.ptax : 0;
  const cfrExpandidoUSD = d.fobUSD + d.freteUSD + iiUSD + despesasUSD + cfImpUSD + seguroUSD;
  const ppbPlacaUSD = d.ptax>0 ? (d.ppbVals?.placa||0)/d.ptax : 0;
  const ppbMemoriaUSD = d.ptax>0 ? (d.ppbVals?.memoria||0)/d.ptax : 0;
  const basePlacaUSD = useMemo(()=>(plmPct/100*cfrExpandidoUSD)+ppbPlacaUSD+ppbMemoriaUSD,[plmPct,cfrExpandidoUSD,ppbPlacaUSD,ppbMemoriaUSD]);
  const fatorImposto = (-prodAtrib.ipi/100 + prodAtrib.icms/100*0.073);
  const creditoIOS = useMemo(()=>fatorImposto*basePlacaUSD*(1+conteudoLocal/100),[fatorImposto,basePlacaUSD,conteudoLocal]);

  const valor = aba==="mao" ? craUSD : creditoIOS;
  const valorBRL = valor*(d.ptax||0);

  return(
    <div className="ov">
      <div className="mb" onClick={e=>e.stopPropagation()}>
        <div className="mh"><span className="mt">CRA / Crédito de Impostos</span><button className="mc" onClick={onClose}>x</button></div>
        <div className="mbody">
          {/* Tabs */}
          <div style={{display:"flex",gap:4,marginBottom:12}}>
            {[["mao","CRA (MAO)"],["ios","Crédito Federal (IOS)"]].map(([k,l])=>(
              <button key={k} onClick={()=>setAba(k)}
                style={{flex:1,padding:"6px",fontSize:11,fontWeight:700,cursor:"pointer",borderRadius:4,border:"1px solid",transition:".15s",
                  background:aba===k?"rgba(60,219,192,.25)":"rgba(255,255,255,.04)",
                  borderColor:aba===k?"#3CDBC0":"rgba(255,255,255,.1)",
                  color:aba===k?"#93c5fd":"#7a90b0"}}>{l}</button>
            ))}
          </div>

          {/* CRA — MAO */}
          {aba==="mao"&&<>
            <Box t="blue">{"CRA = % Conteúdo Local × II (USD)"}</Box>
            <Field label="% Conteúdo Local" sfx="%" value={conteudoLocal} onChange={v=>setConteudoLocal(parseFloat(v)||0)}
              hint="% de insumos nacionais sobre o produto"/>
            <div className="pbase"><span>II (base)</span><span>{usd(iiUSD)}</span></div>
            <div className="pdecomp">
              <div><span>II (USD)</span><span>{usd(iiUSD)}</span></div>
              <div><span>× {n3(conteudoLocal)}% (conteúdo local)</span><span>{usd(conteudoLocal/100*iiUSD)}</span></div>
            </div>
            <div className="pres"><span>CRA calculado</span><span>{usd(craUSD)}</span></div>
          </>}

          {/* Crédito Federal — IOS */}
          {aba==="ios"&&<>
            <Box t="blue">{"(-IPI% + ICMS%×7,3%) × (PLM%×CFRexp + PCB + Mem) × (1+%CL)"}</Box>
            <Field label="% PLM sobre FOB" sfx="%" value={plmPct} onChange={v=>setPlmPct(parseFloat(v)||0)}
              hint="Representatividade dos componentes da placa no FOB"/>
            <Field label="% Conteúdo Local" sfx="%" value={conteudoLocal} onChange={v=>setConteudoLocal(parseFloat(v)||0)}/>
            <div className="pbase"><span>CFR Expandido (base)</span><span>{usd(cfrExpandidoUSD)}</span></div>
            <div className="pdecomp">
              <div><span>FOB + Frete + II + Desp. + CF + Seguro</span><span>{usd(cfrExpandidoUSD)}</span></div>
              <div><span>PLM ({n3(plmPct)}%) × CFR exp.</span><span>{usd(plmPct/100*cfrExpandidoUSD)}</span></div>
              <div><span>+ PCB (PPB Placa)</span><span>{usd(ppbPlacaUSD)}</span></div>
              <div><span>+ Memória (PPB Memória)</span><span>{usd(ppbMemoriaUSD)}</span></div>
              <div><span>= Base Placa</span><span>{usd(basePlacaUSD)}</span></div>
              <div><span>Fator (-{pct(prodAtrib.ipi)} + {pct(prodAtrib.icms)}×7,3%)</span><span>{n3(fatorImposto*100)}%</span></div>
              <div><span>× (1 + {n3(conteudoLocal)}% CL)</span><span>{n3(1+conteudoLocal/100)}</span></div>
            </div>
            <div className="pres"><span>Crédito calculado</span><span>{usd(creditoIOS)}</span></div>
          </>}

          <div style={{fontSize:10,color:"#5a6a84",textAlign:"right",marginTop:4}}>= {brl(valorBRL)}</div>
          <button className="mapp" onClick={()=>{onApply(valor, conteudoLocal, plmPct);}}>
            Aplicar ao campo CRA / Créditos
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal CF Venda ────────────────────────────────────────────────────────────
// Formula: (1 + taxa/30)^(prazo + 10) - 1
// taxa em % (ex: 1.14 = 1,14% a.m.)
function ModalCFVenda({onClose,onApply,data,setData}){
  const cfPct=(Math.pow(1+data.taxa/100/30,data.prazo+10)-1)*100;
  return(
    <div className="ov">
      <div className="mb" onClick={e=>e.stopPropagation()}>
        <div className="mh"><span className="mt">Custo Financeiro de Venda</span><button className="mc" onClick={onClose}>x</button></div>
        <div className="mbody">
          <Box t="blue">{"Formula: (1 + taxa/30)^(prazo + 10) - 1\nResultado como % sobre o preco de venda."}</Box>
          <Field label="Prazo de pagamento do cliente" sfx="dias" value={data.prazo} onChange={v=>setData({...data,prazo:v})} hint="Dias de prazo concedidos ao cliente"/>
          <Field label="Taxa financeira (a.m.)" sfx="%" value={data.taxa} onChange={v=>setData({...data,taxa:v})} hint="Padrao: 1,14% a.m."/>
          <div className="pdecomp">
            <div><span>Expoente (prazo + 10)</span><span>{data.prazo+10}</span></div>
            <div><span>Base (1 + taxa/30)</span><span>{n3(1+data.taxa/100/30)}</span></div>
            <div><span>Resultado (decimal)</span><span>{n3(cfPct/100)}</span></div>
          </div>
          <div className="pres"><span>CF Venda (% sobre preco)</span><span>{pct(cfPct)}</span></div>
          <button className="mapp" onClick={()=>onApply(parseFloat(cfPct.toFixed(3)))}>Aplicar ao indice CF Venda</button>
        </div>
      </div>
    </div>
  );
}

function ModalRegistros({onClose, onLoad, currentD, currentCalcs, prodNome, user}){
  const [registros, setRegistros] = useState([]);
  const [pastas, setPastas]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [nome, setNome]           = useState(prodNome||"");
  const [compartilhado, setCompartilhado] = useState(false);
  const [pastaAtual, setPastaAtual] = useState(null);
  const [view, setView]           = useState("lista");
  const [nomePasta, setNomePasta] = useState("");
  const [pastaPaiCriacao, setPastaPaiCriacao] = useState(null);
  const [registroMover, setRegistroMover] = useState(null);
  const [confirmDel, setConfirmDel]         = useState(null);
  const [confirmDelPasta, setConfirmDelPasta] = useState(null);
  const [editNome, setEditNome]   = useState(null);
  const [editVal, setEditVal]     = useState("");
  const [sobrescrever, setSobrescrever] = useState(null);
  const [erro, setErro]           = useState(null);
  const [migrando, setMigrando]   = useState(false);
  const [migMsg, setMigMsg]       = useState(null);

  const canManageShared = user?.perfil === "admin" || user?.perfil === "custos";

  const localCount = () => {
    try { return JSON.parse(localStorage.getItem("positec_calc_registros")||"[]").length; } catch { return 0; }
  };

  const handleMigrar = async () => {
    setMigrando(true); setMigMsg(null); setErro(null);
    try {
      const regsLocal  = JSON.parse(localStorage.getItem("positec_calc_registros")||"[]");
      const pastasLocal = JSON.parse(localStorage.getItem("positec_calc_pastas")||"[]");
      if(regsLocal.length===0){ setMigMsg("Nenhum registro local encontrado."); return; }

      // Cria pastas em ordem topológica (raiz primeiro) e mapeia id antigo → novo
      const idMap = {};
      const ordered = [];
      const add = (p) => { if(idMap[p.id]!==undefined||ordered.includes(p)) return; if(p.pai) { const pai=pastasLocal.find(x=>x.id===p.pai); if(pai) add(pai); } ordered.push(p); };
      pastasLocal.forEach(add);

      for(const p of ordered){
        const novoId = (await db.insertPastaRegistro(user.id, p.nome, p.pai ? (idMap[p.pai]??null) : null, false))?.[0]?.id;
        if(novoId) idMap[p.id] = novoId;
      }

      // Cria registros
      let ok=0, fail=0;
      for(const r of regsLocal){
        try {
          await db.insertRegistro(user.id, r.nome, r.pastaId ? (idMap[r.pastaId]??null) : null, false, r.d, r.calcs);
          ok++;
        } catch { fail++; }
      }

      setMigMsg(`✓ ${ok} registro${ok!==1?"s":""} migrado${ok!==1?"s":""}${fail?` · ${fail} falhou`:""}. Pode limpar o armazenamento local se quiser.`);
      await reload();
    } catch(e) { setErro("Erro na migração: "+e.message); }
    finally { setMigrando(false); }
  };

  const reload = async () => {
    setLoading(true); setErro(null);
    try {
      const [regs, pas] = await Promise.all([db.getRegistros(user.id), db.getPastasRegistros(user.id)]);
      setRegistros(regs||[]); setPastas(pas||[]);
    } catch(e) { setErro("Erro ao carregar: "+e.message); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ reload(); }, []);

  const breadcrumb = (pastaId) => {
    const path=[]; let cur=pastaId; const visited=new Set();
    while(cur!==null&&cur!==undefined){ if(visited.has(cur))break; visited.add(cur); const p=pastas.find(x=>x.id===cur); if(!p)break; path.unshift(p); cur=p.pai??null; }
    return path;
  };
  const caminho = breadcrumb(pastaAtual);
  const subpastasAtuais = pastas.filter(p=>(p.pai??null)===pastaAtual);
  const regsNaPasta     = registros.filter(r=>(r.pastaId??null)===pastaAtual);

  const handleSave = async () => {
    const label = nome.trim() || prodNome || "Sem nome";
    setErro(null); setSaving(true);
    try {
      if(sobrescrever){
        const reg = registros.find(r=>r.id===sobrescrever);
        if(reg?.compartilhado && !canManageShared){ setErro("Sem permissão para sobrescrever registros compartilhados."); return; }
        await db.updateRegistro(sobrescrever, { nome:label, dados:{d:currentD,calcs:currentCalcs} });
        setSobrescrever(null);
      } else {
        await db.insertRegistro(user.id, label, pastaAtual, compartilhado, currentD, currentCalcs);
      }
      setNome(""); setCompartilhado(false); await reload();
    } catch(e) { setErro("Erro ao salvar: "+e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    const reg = registros.find(r=>r.id===id);
    if(reg?.compartilhado && !canManageShared){ setErro("Sem permissão para excluir registros compartilhados."); setConfirmDel(null); return; }
    try { await db.deleteRegistro(id); await reload(); } catch(e) { setErro("Erro: "+e.message); }
    setConfirmDel(null);
  };

  const handleDeletePasta = async (id) => {
    try {
      const regsNesta = registros.filter(r=>r.pastaId===id);
      const subps = pastas.filter(p=>p.pai===id);
      await Promise.all([
        ...regsNesta.map(r=>db.updateRegistro(r.id,{pasta_id:null})),
        ...subps.map(p=>db.updatePastaRegistro(p.id,{pai_id:null})),
      ]);
      await db.deletePastaRegistro(id);
      if(pastaAtual===id) setPastaAtual(null);
      await reload();
    } catch(e) { setErro("Erro: "+e.message); }
    setConfirmDelPasta(null);
  };

  const handleCriarPasta = async () => {
    if(!nomePasta.trim()) return;
    try {
      await db.insertPastaRegistro(user.id, nomePasta.trim(), pastaPaiCriacao??pastaAtual??null, false);
      setNomePasta(""); setView("lista"); setPastaPaiCriacao(null); await reload();
    } catch(e) { setErro("Erro: "+e.message); }
  };

  const handleMover = async (pastaDestino) => {
    try { await db.updateRegistro(registroMover,{pasta_id:pastaDestino}); setRegistroMover(null); setView("lista"); await reload(); }
    catch(e) { setErro("Erro: "+e.message); }
  };

  const handleRenomear = async (id) => {
    if(!editVal.trim()) return;
    try { await db.updateRegistro(id,{nome:editVal.trim()}); setEditNome(null); await reload(); }
    catch(e) { setErro("Erro: "+e.message); }
  };

  const btnStyle = (active) => ({
    padding:"4px 10px", fontSize:10, fontWeight:700, cursor:"pointer", borderRadius:20,
    border:"1px solid", flexShrink:0,
    background:active?"rgba(60,219,192,.25)":"rgba(255,255,255,.04)",
    borderColor:active?"#3CDBC0":"rgba(255,255,255,.12)",
    color:active?"#93c5fd":"#7a90b0"
  });

  // dropdown sobrescrever: só mostra registros que o usuário pode sobrescrever
  const regsParaSobrescrever = canManageShared ? registros : registros.filter(r=>!r.compartilhado);

  // ── Tela de mover ──────────────────────────────────────────────────────────
  if(view==="mover") return(
    <div className="ov">
      <div className="mb" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
        <div className="mh">
          <span className="mt">Mover para pasta</span>
          <button className="mc_btn" onClick={()=>setView("lista")}>×</button>
        </div>
        <div className="mbody">
          <div style={{fontSize:11,color:"#A7A8AA",marginBottom:12}}>
            Registro: <strong style={{color:"#f0f0f0"}}>{registros.find(r=>r.id===registroMover)?.nome}</strong>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <div onClick={()=>handleMover(null)}
              style={{padding:"10px 14px",background:"#302e2d",border:"1px solid rgba(255,255,255,.1)",borderRadius:4,cursor:"pointer",fontSize:12,color:"#f0f0f0",display:"flex",alignItems:"center",gap:8}}>
              <span>🏠</span> Raiz (sem pasta)
            </div>
            {pastas.map(p=>(
              <div key={p.id} onClick={()=>handleMover(p.id)}
                style={{padding:"10px 14px",background:"#302e2d",border:"1px solid rgba(255,255,255,.1)",borderRadius:4,cursor:"pointer",fontSize:12,color:"#f0f0f0",display:"flex",alignItems:"center",gap:8,
                  paddingLeft: p.pai ? 28 : 14}}>
                <span>{p.pai?"└ 📂":"📁"}</span>
                {p.pai ? (pastas.find(x=>x.id===p.pai)?.nome||"") + " / " : ""}{p.nome}
                <span style={{fontSize:10,color:"#5a6a84",marginLeft:"auto"}}>{registros.filter(r=>r.pastaId===p.id).length} reg.</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ── Tela principal ─────────────────────────────────────────────────────────
  return (
    <div className="ov">
      <div className="mb" style={{maxWidth:580}} onClick={e=>e.stopPropagation()}>
        <div className="mh">
          <span className="mt">📋 Registros</span>
          <button className="mc_btn" onClick={onClose}>×</button>
        </div>
        <div className="mbody">

          {erro&&<div style={{padding:"8px 12px",background:"rgba(220,38,38,.1)",border:"1px solid rgba(220,38,38,.3)",borderRadius:4,fontSize:11,color:"#f87171",marginBottom:8}}>{erro}</div>}

          {/* ── Migração local → nuvem ── */}
          {localCount()>0&&!migMsg&&(
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"rgba(217,119,6,.08)",border:"1px solid rgba(217,119,6,.25)",borderRadius:4,marginBottom:10}}>
              <span style={{fontSize:11,color:"#fbbf24",flex:1}}>📦 {localCount()} registro{localCount()!==1?"s":""} local{localCount()!==1?"is":""} encontrado{localCount()!==1?"s":""}. Migrar para a nuvem?</span>
              <button onClick={handleMigrar} disabled={migrando}
                style={{padding:"4px 12px",background:"rgba(217,119,6,.2)",border:"1px solid rgba(217,119,6,.4)",color:"#fbbf24",fontSize:11,fontWeight:700,cursor:"pointer",borderRadius:3,flexShrink:0}}>
                {migrando?"Migrando...":"⬆ Migrar"}
              </button>
            </div>
          )}
          {migMsg&&<div style={{padding:"8px 12px",background:"rgba(5,150,105,.1)",border:"1px solid rgba(5,150,105,.3)",borderRadius:4,fontSize:11,color:"#34d399",marginBottom:8}}>{migMsg}</div>}

          {/* ── Salvar ── */}
          <div style={{background:"rgba(60,219,192,.08)",border:"1px solid rgba(60,219,192,.25)",padding:"10px 14px",borderRadius:4,marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:700,color:"#3CDBC0",marginBottom:8,letterSpacing:.5,textTransform:"uppercase"}}>
              Salvar em: {caminho.length>0 ? caminho.map(p=>p.nome).join(" / ") : "Raiz"}
            </div>
            <div style={{display:"flex",gap:8,marginBottom:6}}>
              <div className="fw" style={{flex:1}}>
                <input type="text" placeholder={prodNome||"Nome do registro"} value={nome}
                  onChange={e=>setNome(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&handleSave()}
                  style={{background:"none",border:"none",outline:"none",fontFamily:"'Montserrat',sans-serif",fontSize:12,color:"#f0f0f0",padding:"7px 10px",width:"100%"}}/>
              </div>
              <button className="mapp" style={{padding:"7px 16px",borderRadius:4,fontSize:12,flexShrink:0}} onClick={handleSave} disabled={saving}>
                {saving ? "..." : sobrescrever ? "↺ Sobrescrever" : "💾 Salvar novo"}
              </button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:6}}>
              <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:11,color:compartilhado?"#93c5fd":"#7a90b0",userSelect:"none"}}>
                <input type="checkbox" checked={compartilhado} onChange={e=>setCompartilhado(e.target.checked)}
                  style={{accentColor:"#3CDBC0",cursor:"pointer"}}/>
                🌐 Compartilhar com todos
              </label>
            </div>
            {/* Sobrescrever dropdown */}
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:10,color:"#5a6a84",flexShrink:0}}>Ou sobrescrever:</span>
              <select value={sobrescrever||""}
                onChange={e=>setSobrescrever(e.target.value ? Number(e.target.value) : null)}
                style={{flex:1,background:"#201f1e",border:"1px solid rgba(255,255,255,.12)",color:sobrescrever?"#fbbf24":"#7a90b0",padding:"4px 8px",fontSize:11,borderRadius:3,outline:"none"}}>
                <option value="">— selecionar registro —</option>
                {regsParaSobrescrever.map(r=>(
                  <option key={r.id} value={r.id}>{r.compartilhado?"🌐 ":""}{r.nome} ({r.data})</option>
                ))}
              </select>
              {sobrescrever&&<button onClick={()=>setSobrescrever(null)}
                style={{padding:"3px 8px",background:"none",border:"1px solid rgba(255,255,255,.1)",color:"#A7A8AA",fontSize:10,cursor:"pointer",borderRadius:3}}>✕</button>}
            </div>
          </div>

          {/* ── Navegação de pastas com breadcrumb ── */}
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,flexWrap:"wrap"}}>
            <button style={btnStyle(pastaAtual===null)} onClick={()=>setPastaAtual(null)}>🏠</button>
            {caminho.map((p,i)=>(
              <span key={p.id} style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{color:"#3d5070",fontSize:10}}>/</span>
                <button style={btnStyle(i===caminho.length-1)} onClick={()=>setPastaAtual(p.id)}>
                  📂 {p.nome}
                </button>
              </span>
            ))}
            {subpastasAtuais.map(p=>(
              <button key={p.id} style={btnStyle(false)} onClick={()=>setPastaAtual(p.id)}>
                {p.compartilhado?"🌐":"📁"} {p.nome}
                <span style={{fontSize:9,marginLeft:3,opacity:.6}}>{registros.filter(r=>r.pastaId===p.id).length}</span>
              </button>
            ))}
            {view==="nova-pasta"
              ? <div style={{display:"flex",gap:4,alignItems:"center"}}>
                  <input autoFocus type="text" placeholder="Nome da pasta" value={nomePasta}
                    onChange={e=>setNomePasta(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter")handleCriarPasta();if(e.key==="Escape"){setView("lista");setNomePasta("");}}}
                    style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.15)",color:"#f0f0f0",padding:"4px 8px",fontSize:11,borderRadius:4,outline:"none",width:110}}/>
                  <button onClick={handleCriarPasta} style={{...btnStyle(true),padding:"3px 8px"}}>✓</button>
                  <button onClick={()=>{setView("lista");setNomePasta("");}} style={{...btnStyle(false),padding:"3px 8px"}}>✕</button>
                </div>
              : <button style={{...btnStyle(false),borderStyle:"dashed"}}
                  onClick={()=>{setPastaPaiCriacao(pastaAtual);setView("nova-pasta");}}>
                  + {pastaAtual ? "Subpasta" : "Pasta"}
                </button>
            }
            {pastaAtual!==null&&(
              confirmDelPasta===pastaAtual
                ? <div style={{display:"flex",gap:4,alignItems:"center",marginLeft:"auto"}}>
                    <span style={{fontSize:10,color:"#f87171"}}>Excluir?</span>
                    <button onClick={()=>handleDeletePasta(pastaAtual)} style={{padding:"3px 8px",background:"#dc2626",border:"none",color:"#fff",fontSize:10,cursor:"pointer",borderRadius:3}}>Sim</button>
                    <button onClick={()=>setConfirmDelPasta(null)} style={{padding:"3px 8px",background:"transparent",border:"1px solid rgba(255,255,255,.15)",color:"#94a3b8",fontSize:10,cursor:"pointer",borderRadius:3}}>Não</button>
                  </div>
                : <button onClick={()=>setConfirmDelPasta(pastaAtual)}
                    style={{marginLeft:"auto",padding:"3px 8px",background:"rgba(220,38,38,.1)",border:"1px solid rgba(220,38,38,.25)",color:"#f87171",fontSize:10,cursor:"pointer",borderRadius:3}}>
                    🗑
                  </button>
            )}
          </div>

          {/* ── Lista de registros ── */}
          {loading
            ? <div style={{textAlign:"center",padding:"24px 0",fontSize:12,color:"#5a6a84"}}>Carregando...</div>
            : regsNaPasta.length===0&&subpastasAtuais.length===0
              ? <div style={{textAlign:"center",padding:"24px 0",fontFamily:"'Montserrat',sans-serif",fontSize:11,color:"#5a6a84"}}>
                  {pastaAtual ? "Pasta vazia." : "Nenhum registro salvo ainda."}
                </div>
              : <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:340,overflowY:"auto"}}>
                  {regsNaPasta.map(r=>(
                    <div key={r.id} style={{padding:"9px 12px",background:"#302e2d",border:"1px solid rgba(255,255,255,.08)",borderRadius:4}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {editNome===r.id
                          ? <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)}
                              onKeyDown={e=>{if(e.key==="Enter")handleRenomear(r.id);if(e.key==="Escape")setEditNome(null);}}
                              style={{flex:1,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.2)",color:"#f0f0f0",padding:"4px 8px",fontSize:12,borderRadius:3,outline:"none"}}/>
                          : <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:700,color:"#f0f0f0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                                {r.compartilhado&&<span title="Compartilhado" style={{marginRight:4}}>🌐</span>}{r.nome}
                              </div>
                              <div style={{fontSize:10,fontFamily:"'Montserrat',sans-serif",color:"#5a6a84",marginTop:2}}>
                                {r.data} · {r.d?.ufDestino||""} · MC {r.calcs?.mc!=null ? pct(r.calcs.mc) : `${r.d?.margem||0}%`}
                              </div>
                            </div>
                        }
                        {confirmDel===r.id
                          ? <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
                              <span style={{fontSize:10,color:"#f87171"}}>Excluir?</span>
                              <button onClick={()=>handleDelete(r.id)} style={{padding:"4px 8px",background:"#dc2626",border:"none",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",borderRadius:3}}>Sim</button>
                              <button onClick={()=>setConfirmDel(null)} style={{padding:"4px 8px",background:"transparent",border:"1px solid rgba(255,255,255,.15)",color:"#94a3b8",fontSize:11,cursor:"pointer",borderRadius:3}}>Não</button>
                            </div>
                          : <div style={{display:"flex",gap:3,flexShrink:0}}>
                              <button onClick={()=>{onLoad(r.d,r.calcs,r.nome);onClose();}}
                                style={{padding:"5px 11px",background:"#3CDBC0",border:"none",color:"#2C2A29",fontSize:11,fontWeight:700,cursor:"pointer",borderRadius:3}}>↩ Carregar</button>
                              <button onClick={()=>{setEditNome(r.id);setEditVal(r.nome);}}
                                title="Renomear"
                                style={{padding:"5px 8px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.12)",color:"#a8b5cc",fontSize:11,cursor:"pointer",borderRadius:3}}>✎</button>
                              <button onClick={()=>{setRegistroMover(r.id);setView("mover");}}
                                title="Mover"
                                style={{padding:"5px 8px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.12)",color:"#a8b5cc",fontSize:11,cursor:"pointer",borderRadius:3}}>📁</button>
                              {(r.userId===String(user?.id)||canManageShared)&&
                                <button onClick={()=>setConfirmDel(r.id)}
                                  style={{padding:"5px 8px",background:"rgba(220,38,38,.1)",border:"1px solid rgba(220,38,38,.25)",color:"#f87171",fontSize:11,cursor:"pointer",borderRadius:3}}>✕</button>
                              }
                            </div>
                        }
                      </div>
                    </div>
                  ))}
                </div>
          }
        </div>
      </div>
    </div>
  );
}

function BreakdownPanel({c,d,prod,ppbTot,calcs}){
  const [open,setOpen]=useState({imp:false,ppb:false,local:false,impvenda:false,iger:false,icom:false,res:false});
  const tog=k=>setOpen(p=>({...p,[k]:!p[k]}));

  const fobBRL=d.fobUSD*d.ptax;
  const freteBRL=d.freteUSD*d.ptax;
  const totalImpVenda=c.cargaTot+(c.ftiPct>0?c.ftiV:0)+(c.fcpPct>0?c.fcpV:0);
  const totalIndGer=c.pdV+c.scV+c.ryV+c.frV+(c.footprintV||0);
  const totalIndCom=c.cfnV+c.cmV+(c.mktV||0)+(c.rebateV||0)+(c.pddV||0)+(c.vbExtraV||0)+(c.vpcV||0);
  const mcV=c.margV+c.cfxV;

  // Linha item
  const Row=({l,v,acc,indent,dual,sub,showPct})=>{
    const vPct=showPct&&c.pF>0?pct(Math.abs(v)/c.pF*100):null;
    return(
      <div className={`bdr ${acc||""} ${sub?"bdsub":""}`} style={indent?{paddingLeft:20}:undefined}>
        <span className="bdl">{l}</span>
        <span className="bdv">
          {dual&&<span className="bdv2">{dual}</span>}
          {vPct&&<span className="bdv2">{vPct}</span>}
          <span style={acc==="red"?{color:"#f87171"}:acc==="green"?{color:"#4ade80"}:acc==="blue"?{color:"#3CDBC0"}:acc==="warn"?{color:"#fbbf24"}:{}}>{brl(v)}</span>
        </span>
      </div>
    );
  };

  // Linha de subtotal no fundo de cada grupo expandido
  const SubTot=({label,v,color})=>(
    <div className="bd-subtot" style={{borderTop:`1px solid ${color||"rgba(255,255,255,.12)"}44`}}>
      <span className="bd-subtot-lbl">{label}</span>
      <span className="bd-subtot-pct">{c.pF>0?pct(Math.abs(v)/c.pF*100):"—"}</span>
      <span className="bd-subtot-val">{brl(v)}</span>
    </div>
  );

  // Grupo colapsável: clique no header expande/recolhe; quando fechado mostra só o total
  const Grp=({id,label,total,color,accentColor,children,totLabel})=>{
    const isOpen=open[id];
    const pctVal=c.pF>0?((Math.abs(total)/c.pF)*100):0;
    return(
      <div className="bd-grp">
        <div className="bd-grp-hd" onClick={()=>tog(id)} style={{borderLeft:`3px solid ${color}`}}>
          <span className="bd-chevron">{isOpen?"▾":"▸"}</span>
          <span className="bd-grp-lbl">{label}</span>
          <div className="bd-grp-bar">
            <div style={{height:"100%",width:`${Math.min(100,pctVal)}%`,background:color,borderRadius:3,opacity:.8,transition:"width .3s"}}/>
          </div>
          <span className="bd-grp-pct" style={{color}}>{pctVal>=0.1?pct(pctVal):"—"}</span>
          <span className="bd-grp-val" style={{color:isOpen?"#dce7f7":accentColor||color}}>{brl(total)}</span>
        </div>
        {isOpen&&<div className="bd-grp-body">{children}<SubTot label={totLabel||label} v={total} color={color}/></div>}
      </div>
    );
  };

  // Linha totalizadora fixa (não colapsável)
  const Tot=({label,v,color})=>(
    <div className="bd-tot" style={{borderLeft:`3px solid ${color}`}}>
      <span className="bd-tot-lbl">{label}</span>
      <span className="bd-tot-pct" style={{color}}>{c.pF>0?pct((v/c.pF)*100):"—"}</span>
      <span className="bd-tot-val" style={{color}}>{brl(v)}</span>
    </div>
  );

  return(
    <div className="bd-wrap">

      {/* IMPORTAÇÃO */}
      <Grp id="imp" label="Importação" total={c.cmvImp} color="#3b82f6" totLabel="Total Importação">
        <Row l="FOB" v={fobBRL} dual={usd(d.fobUSD)} showPct/>
        <Row l="Frete Internacional" v={freteBRL} dual={usd(d.freteUSD)} indent showPct/>
        <Row l={`II (${pct(d.aliqII)})`} v={c.iiV} acc="red" indent showPct/>
        <Row l="Seguro" v={d.seguroBRL} indent showPct/>
        <Row l={`Despesas${d.despesasModo==="pct"?" "+pct(d.despesasPct)+" CFR":""}`} v={c.despesas} acc="red" indent showPct/>
        {d.cfImp!==0&&<Row l="CF Importação" v={d.cfImp} acc={d.cfImp<0?"green":"blue"} indent showPct/>}
      </Grp>

      {/* PPB */}
      {ppbTot>0&&(
        <Grp id="ppb" label="PPB" total={ppbTot} color="#8b5cf6" totLabel="Total PPB">
          {Object.entries(d.ppbAtivos).filter(([,v])=>v).map(([k])=>(
            <Row key={k} l={PPB_ITEMS.find(i=>i.id===k)?.label||k} v={d.ppbVals[k]||0} indent showPct/>
          ))}
          {(d.cra||0)>0&&<Row l="CRA / Créditos" v={d.cra} acc="green" indent showPct/>}
        </Grp>
      )}

      {/* VPL — totalizador fixo */}
      <Tot label={d.vplModo==="real"&&d.vplReal>0?"VPL — Real":"VPL"} v={c.vpl} color="#2563eb"/>

      {/* CUSTOS LOCAIS */}
      <Grp id="local" label="Despesas Locais" total={d.garantia+c.bkpV+d.producao+d.outrosBRL} color="#0ea5e9" totLabel="Total Despesas Locais">
        <Row l="Garantia" v={d.garantia} showPct/>
        <Row l={`BKP (${pct(d.bkpPct)} × VPL)`} v={c.bkpV} indent sub showPct/>
        <Row l="Produção / Montagem" v={d.producao} showPct/>
        <Row l="Embalagem" v={d.embalagem||0} indent sub showPct/>
        <Row l="Outros Custos" v={d.outrosBRL} indent sub showPct/>
      </Grp>

      {/* CUSTO TOTAL — fixo */}
      <Tot label="CUSTO TOTAL" v={c.cmvTotal} color="#3CDBC0"/>

      {/* IMPOSTOS DA VENDA */}
      <Grp id="impvenda" label="Impostos da Venda" total={totalImpVenda} color="#ef4444" totLabel="Total Impostos">
        {c.ipi>0&&<Row l={`IPI (${pct(c.ipi)})`} v={c.ipiV} acc="red" showPct/>}
        {c.ipiCreditoV>0&&<Row l={`  ↳ Crédito IPI IOS (-${pct(c.ipiCreditoIOSPct)})`} v={-c.ipiCreditoV} acc="green" indent sub showPct/>}
        <Row l={`P/C efetivo (${pct(c.pcEf)})`} v={c.pcV} acc="red" showPct/>
        {c.pcSubvPct>0.001&&<Row l={`P/C subvenção (${pct(c.pcSubvPct)})`} v={c.pcSubvV} acc="red" indent sub showPct/>}
        {c.icmsEfPct>0&&<Row l={`ICMS efetivo (${pct(c.icmsEfPct)})`} v={c.icmsEfV} acc="red" showPct/>}
        {c.difal>0&&<Row l={`DIFAL (${pct(c.difal)})`} v={c.difalV} acc="red" showPct/>}
        {c.stV>0&&<Row l="ICMS-ST" v={c.stV} acc="warn" showPct/>}
        {c.ftiPct>0&&<Row l={`FTI/UEA-AM (${pct(c.ftiPct)})`} v={c.ftiV} acc="red" showPct/>}
        {c.fcpPct>0&&<Row l={`Fundo Pobreza ${d.ufDestino}`} v={c.fcpV} acc="warn" showPct/>}
      </Grp>

      {/* ÍNDICES GERAIS */}
      <Grp id="iger" label="Índices Gerais" total={totalIndGer} color="#6b7280" totLabel="Total Índices Gerais">
        <Row l={`P&D (${pct(d.pd)})`} v={c.pdV} showPct/>
        <Row l={`Scrap (${pct(d.scrap)})`} v={c.scV} showPct/>
        <Row l={`Royalties (${pct(d.royal)})`} v={c.ryV} showPct/>
        <Row l={`Frete venda (${pct(d.frete)})`} v={c.frV} showPct/>
        {c.footprintPct!==0&&<Row l={`Footprint ${d.origem} (${pct(c.footprintPct)})`} v={c.footprintV} acc={c.footprintPct<0?"green":"red"} showPct/>}
      </Grp>

      {/* ÍNDICES COMERCIAIS */}
      <Grp id="icom" label="Índices Comerciais" total={totalIndCom} color="#d97706" totLabel="Total Comercial">
        <Row l={`CF Venda (${pct(c.cfVendaEf)}${c.cartaoPct>0?" c/ cartão":""})`} v={c.cfnV} showPct/>
        <Row l={`Comissão+Enc. (${pct(d.comis+c.comisXPct)})`} v={c.cmV} showPct/>
        {(d.mkt||0)>0&&<Row l={`Marketing (${pct(d.mkt)})`} v={c.mktV||0} showPct/>}
        {(d.rebate||0)>0&&<Row l={`Rebate (${pct(d.rebate)})`} v={c.rebateV||0} showPct/>}
        {(d.pdd||0)>0&&<Row l={`PDD (${pct(d.pdd)})`} v={c.pddV||0} showPct/>}
        {(d.vbExtra||0)>0&&<Row l={`Verba Extra (${pct(d.vbExtra)})`} v={c.vbExtraV||0} showPct/>}
        {(d.vpc||0)>0&&<Row l={`VPC (${pct(d.vpc)})`} v={c.vpcV||0} showPct/>}
      </Grp>

      {/* RESULTADO */}
      <Grp id="res" label="Resultado" total={mcV} color="#2563eb" accentColor="#93c5fd" totLabel="MC Total">
        <Row l={`MC — Margem Contribuição${d.margGerAtivo&&d.margGer!==0?" (c/ MG)":""} (${pct(c.mc)})`} v={mcV} acc="green" showPct/>
        <Row l={`Custo Fixo (${pct(d.cfixo)})`} v={c.cfxV} indent sub showPct/>
        <Row l={`ML — Margem Líquida (${pct(c.margPct)})`} v={c.margV} acc="blue" showPct/>
        {d.margGer!==0&&<Row l={`  ↳ Margem Gerencial/Agnóstica (${pct(d.margGer)})`} v={c.margGerV} acc={d.margGer<0?"green":"red"} indent sub showPct/>}
      </Grp>

      {/* PREÇO FINAL — fixo */}
      <div className="bd-preco">
        <span>PREÇO FINAL</span>
        <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:800,color:"#3CDBC0"}}>{brl(c.pF)}</span>
      </div>
    </div>
  );
}

// ── Modal Gestão de Usuários ─────────────────────────────────────────────────
function ModalGestaoUsers({ onClose, currentUser }) {
  const [aba, setAba] = useState("pendentes");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [perfisLista, setPerfisLista] = useState(loadPerfis);
  const [modalPerfil, setModalPerfil] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setUsers((await db.getUsers()).map(u=>({...u,criadoEm:u.criado_em,aprovadoEm:u.aprovado_em,aprovadoPor:u.aprovado_por}))); }
    catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const saveUser = async (updated) => {
    try {
      await db.updateUser(updated.id, {
        nome: updated.nome, email: updated.email, perfil: updated.perfil,
        status: updated.status,
        aprovado_em: updated.aprovadoEm || null,
        aprovado_por: updated.aprovadoPor || null,
      });
      await refresh();
    } catch(e) { alert("Erro: " + e.message); }
    setModal(null);
  };

  const salvarPerfil = (p) => {
    const nova = perfisLista.find(x=>x.id===p.id)
      ? perfisLista.map(x=>x.id===p.id?p:x) : [...perfisLista, p];
    savePerfis(nova); setPerfisLista(nova); setModalPerfil(null);
  };
  const deletarPerfil = (id) => {
    const nova = perfisLista.filter(p=>p.id!==id);
    savePerfis(nova); setPerfisLista(nova); setConfirmDel(null);
  };

  const pendentes = users.filter(u => u.status === "pendente");
  const todos = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const btnStyle = (on) => ({
    padding:"7px 16px", background: on?"#3CDBC0":"rgba(255,255,255,.05)",
    border:`1px solid ${on?"#3CDBC0":"rgba(255,255,255,.1)"}`,
    color: on?"#fff":"var(--muted)", fontSize:12, fontWeight:700,
    cursor:"pointer", borderRadius:3, transition:".15s", letterSpacing:".3px"
  });

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" style={{maxWidth:760,width:"95vw"}} onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">👥 Gestão de Usuários e Perfis</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:4,padding:"10px 16px",borderBottom:"1px solid var(--border)",background:"rgba(255,255,255,.02)"}}>
          <button style={btnStyle(aba==="pendentes")} onClick={()=>setAba("pendentes")}>
            ⏳ Pendentes {pendentes.length>0&&<span style={{marginLeft:4,background:"#d97706",color:"#fff",borderRadius:20,padding:"0 6px",fontSize:10}}>{pendentes.length}</span>}
          </button>
          <button style={btnStyle(aba==="usuarios")} onClick={()=>setAba("usuarios")}>👥 Usuários</button>
          <button style={btnStyle(aba==="perfis")} onClick={()=>setAba("perfis")}>🔐 Perfis</button>
        </div>

        <div style={{padding:16,maxHeight:"70vh",overflowY:"auto"}}>

          {/* ABA PENDENTES */}
          {aba==="pendentes"&&(pendentes.length===0
            ? <div className="empty"><div className="empty-icon">✓</div><div className="empty-text">Nenhuma pendência</div></div>
            : <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>
                  {["Usuário","Perfil Solicitado","Data","Ação"].map(h=>(
                    <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".8px",borderBottom:"1px solid var(--border)"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {pendentes.map(u=>(
                    <tr key={u.id} style={{background:"rgba(217,119,6,.04)"}}>
                      <td style={{padding:"10px 12px"}}>
                        <div style={{fontWeight:600,color:"#fff"}}>{u.nome}</div>
                        <div style={{fontSize:11,color:"var(--muted)"}}>{u.email}</div>
                      </td>
                      <td style={{padding:"10px 12px"}}><PerfilBadge perfil={u.perfil}/></td>
                      <td style={{padding:"10px 12px",fontFamily:"'Montserrat',sans-serif",fontSize:11,color:"var(--muted)"}}>{fmtDate(u.criadoEm)}</td>
                      <td style={{padding:"10px 12px"}}>
                        <button className="btn-sm btn-approve" onClick={()=>setModal({type:"aprovar",user:u})}>✓ Analisar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          )}

          {/* ABA USUARIOS */}
          {aba==="usuarios"&&(
            <>
              <input className="tbl-search" placeholder="Buscar por nome ou e-mail..."
                value={search} onChange={e=>setSearch(e.target.value)}
                style={{width:"100%",marginBottom:12}}/>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>
                  {["Usuário","Perfil","Status","Ações"].map(h=>(
                    <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".8px",borderBottom:"1px solid var(--border)"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {todos.map(u=>{
                    const pm=getPerfisMap(loadPerfis());
                    return(
                    <tr key={u.id} style={{borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                      <td style={{padding:"10px 12px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:28,height:28,borderRadius:"50%",background:pm[u.perfil]?.cor||"#7a7f96",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0}}>{initials(u.nome)}</div>
                          <div>
                            <div style={{fontWeight:600,color:"#fff",fontSize:13}}>{u.nome}</div>
                            <div style={{fontSize:11,color:"var(--muted)"}}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{padding:"10px 12px"}}><PerfilBadge perfil={u.perfil}/></td>
                      <td style={{padding:"10px 12px"}}><StatusBadge status={u.status}/></td>
                      <td style={{padding:"10px 12px"}}>
                        <div style={{display:"flex",gap:5}}>
                          {u.id!=="master"&&<button className="btn-sm btn-edit" onClick={()=>setModal({type:"edit",user:u})}>✎</button>}
                          {u.id!=="master"&&u.status==="ativo"&&<button className="btn-sm btn-disable" onClick={()=>saveUser({...u,status:"inativo"})}>Desativar</button>}
                          {u.id!=="master"&&u.status==="inativo"&&<button className="btn-sm btn-approve" onClick={()=>saveUser({...u,status:"ativo"})}>Reativar</button>}
                          {u.id!=="master"&&u.status==="pendente"&&<button className="btn-sm btn-approve" onClick={()=>setModal({type:"aprovar",user:u})}>Analisar</button>}
                          {u.id==="master"&&<span style={{fontSize:11,color:"var(--muted)",fontStyle:"italic"}}>master</span>}
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </>
          )}

          {/* ABA PERFIS */}
          {aba==="perfis"&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"flex",justifyContent:"flex-end"}}>
                <button className="btn-confirm" style={{padding:"7px 16px",borderRadius:3}}
                  onClick={()=>setModalPerfil("novo")}>+ Novo Perfil</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
                {perfisLista.map(p=>{
                  const count=users.filter(u=>u.perfil===p.id&&u.status==="ativo").length;
                  const isAdminP=p.id==="admin";
                  return(
                    <div key={p.id} className="pfcard" style={{borderColor:p.cor+"33"}}>
                      <div className="pfcard-head">
                        <span className="pfcard-icon">{p.icone}</span>
                        <div style={{flex:1}}>
                          <div className="pfcard-name">{p.label}</div>
                          <div className="pfcard-count" style={{color:p.cor}}>{count} ativo{count!==1?"s":""}</div>
                        </div>
                        <div className="pfcard-actions">
                          {!isAdminP&&<button className="btn-sm btn-edit" onClick={()=>setModalPerfil(p)}>✎</button>}
                          {!isAdminP&&(confirmDel===p.id
                            ? <><button className="btn-sm btn-reject" onClick={()=>deletarPerfil(p.id)}>Sim</button>
                                <button className="btn-sm btn-disable" onClick={()=>setConfirmDel(null)}>Não</button></>
                            : <button className="btn-sm btn-reject" style={{opacity:count>0?.4:1}}
                                onClick={()=>count===0&&setConfirmDel(p.id)}>✕</button>
                          )}
                          {isAdminP&&<span style={{fontSize:10,color:"var(--muted)",fontStyle:"italic"}}>sistema</span>}
                        </div>
                      </div>
                      <div className="pfcard-mods">
                        {MODULOS.map(m=>(
                          <span key={m.id} className={`mod-chip ${p.modulos?.includes(m.id)?"on":"off"}`}>
                            {m.icone} {m.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {modalPerfil&&<ModalPerfil perfil={modalPerfil==="novo"?null:modalPerfil}
                users={users} onClose={()=>setModalPerfil(null)} onSave={salvarPerfil}/>}
            </div>
          )}
        </div>
      </div>
      {modal?.type==="edit"&&<ModalEditUser user={modal.user} onClose={()=>setModal(null)} onSave={saveUser}/>}
      {modal?.type==="aprovar"&&<ModalAprovar user={modal.user} currentUser={currentUser} onClose={()=>setModal(null)} onSave={saveUser}/>}
    </div>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#2C2A29;color:#f0f0f0;font-family:'Montserrat',Arial,Helvetica,sans-serif;min-height:100vh}
input::-webkit-inner-spin-button,input::-webkit-outer-spin-button{-webkit-appearance:none}
.app{display:flex;flex-direction:column;flex:1}
.hdr{background:#252322;color:#fff;padding:0 20px;display:flex;align-items:center;gap:16px;min-height:58px;border-bottom:3px solid #3CDBC0;flex-wrap:wrap}
.buf{padding:4px 10px;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:.5px;border-radius:20px}
.buf.zmf{background:rgba(60,219,192,.2);color:#3CDBC0;border:1px solid rgba(60,219,192,.4)}.buf.ios{background:rgba(60,219,192,.12);color:#3CDBC0;border:1px solid rgba(60,219,192,.3)}.buf.cwb{background:rgba(100,116,139,.2);color:#94a3b8;border:1px solid rgba(100,116,139,.3)}
.brt{padding:3px 9px;font-family:'Montserrat',sans-serif;font-size:9px;border:1px solid rgba(255,255,255,.12);color:#A7A8AA;border-radius:20px}
.bdf{padding:3px 9px;font-family:'Montserrat',sans-serif;font-size:9px;border-radius:20px;background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.25);color:#f87171}
.layout{display:grid;grid-template-columns:360px 1fr;flex:1}
.pleft{background:#201f1e;border-right:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column}
.tnav{display:flex;flex-wrap:nowrap;border-bottom:1px solid rgba(255,255,255,.08);background:#1a1918;flex-shrink:0;overflow-x:auto;scrollbar-width:none}.tnav::-webkit-scrollbar{display:none}
.tbtn{flex:0 0 auto;padding:9px 7px;background:none;border:none;border-bottom:2px solid transparent;color:#A7A8AA;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;cursor:pointer;transition:.15s;white-space:nowrap}
.tbtn.on{color:#3CDBC0;border-bottom-color:#3CDBC0;background:rgba(60,219,192,.1)}
.tbtn:hover:not(.on){color:#c4d4e8;background:rgba(255,255,255,.04)}
.pscroll{overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px}
.sec{border:1px solid rgba(255,255,255,.08);overflow:hidden;background:#252322;border-radius:6px}
.sec.hl{border-color:rgba(60,219,192,.5)}
.sech{padding:9px 13px;background:#302e2d;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;min-height:34px}
.sec.hl .sech{background:#3CDBC0}
.sect{font-family:'Montserrat',sans-serif;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#f0f4ff}
.sec.hl .sect{color:#2C2A29}
.sectag{font-family:'Montserrat',sans-serif;font-size:9px;color:#A7A8AA;padding:2px 7px;border:1px solid rgba(255,255,255,.1);border-radius:20px}
.sec.hl .sectag{color:rgba(44,42,41,.7);border-color:rgba(44,42,41,.3)}
.secb{padding:12px 13px;display:flex;flex-direction:column;gap:9px}
.fw{display:flex;align-items:center;border:1px solid rgba(255,255,255,.1);background:#201f1e;overflow:hidden;min-width:115px;flex-shrink:0;transition:.15s;border-radius:4px}
.fw:focus-within{border-color:#3CDBC0;box-shadow:0 0 0 2px rgba(60,219,192,.2)}
.fro{opacity:.45;pointer-events:none}
.flocked{border-color:rgba(60,219,192,.5)!important;background:rgba(60,219,192,.07)!important}
.fpre{padding:0 8px;font-family:'Montserrat',sans-serif;font-size:10px;color:#A7A8AA;background:#1a1918;border-right:1px solid rgba(255,255,255,.08);white-space:nowrap;align-self:stretch;display:flex;align-items:center}
.fsel{border:1px solid rgba(255,255,255,.1);background:#201f1e;padding:7px 8px;font-family:'Montserrat',sans-serif;font-size:11px;color:#f0f0f0;outline:none;min-width:115px;flex-shrink:0;cursor:pointer;border-radius:4px}
.fsel:focus{border-color:#3CDBC0}
.cbtn{width:28px;height:28px;background:#302e2d;border:1px solid rgba(255,255,255,.1);cursor:pointer;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:.15s;border-radius:4px;color:#A7A8AA;font-family:'Montserrat',sans-serif}
.cbtn:hover{border-color:#3CDBC0;background:rgba(60,219,192,.15);color:#3CDBC0}
.cbtn.cactive{border-color:#3CDBC0!important;color:#3CDBC0!important;background:rgba(60,219,192,.2)!important}
.cunlock{font-size:13px;color:#A7A8AA!important}
.cunlock:hover{color:#fbbf24!important;border-color:rgba(251,191,36,.4)!important;background:rgba(251,191,36,.08)!important}
.rgb{flex:1;padding:7px 8px;background:#201f1e;border:1px solid rgba(255,255,255,.1);color:#A7A8AA;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:.15s;min-width:60px;border-radius:3px}
.rgb.on{background:rgba(60,219,192,.15);border-color:rgba(60,219,192,.4);color:#3CDBC0;font-weight:600}
.rgb:hover:not(.on){border-color:rgba(255,255,255,.2);color:#c4d4e8}
.tog{width:40px;height:22px;background:#302e2d;border:1px solid rgba(255,255,255,.12);border-radius:11px;cursor:pointer;position:relative;transition:.2s;flex-shrink:0}
.tog.on{background:#3CDBC0;border-color:#3CDBC0}
.tknob{position:absolute;top:3px;left:3px;width:14px;height:14px;background:#A7A8AA;border-radius:50%;transition:.2s}
.tog.on .tknob{transform:translateX(18px);background:#2C2A29}
.ib{padding:8px 11px;font-size:11px;line-height:1.65;border-left:3px solid;white-space:pre-wrap;border-radius:0 4px 4px 0}
.ib.blue{background:rgba(60,219,192,.08);border-color:#3CDBC0;color:#3CDBC0}
.ib.gray{background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.1);color:#A7A8AA;font-family:'Montserrat',sans-serif;font-size:10px}
.ib.ok{background:rgba(22,163,74,.08);border-color:#16a34a;color:#4ade80}
.ib.warn{background:rgba(217,119,6,.08);border-color:#d97706;color:#fbbf24}
.dr{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;color:#A7A8AA}
.dr:last-child{border-bottom:none}.drb{font-weight:700;color:#f0f0f0}.drs{border-top:1px solid rgba(255,255,255,.08);margin-top:4px;padding-top:7px}
.dr.red .dv{color:#f87171;font-weight:600}.dr.green .dv{color:#4ade80;font-weight:600}.dr.blue .dv{color:#60a5fa;font-weight:600}.dr.warn .dv{color:#fbbf24;font-weight:600}
.dv{font-family:'Montserrat',sans-serif;font-size:12px;font-weight:500;color:#C8C9CA}
.drb .dv{color:#f0f0f0}
.psel{width:100%;padding:8px 10px;border:1px solid rgba(255,255,255,.1);background:#201f1e;font-family:'Montserrat',sans-serif;font-size:11px;color:#f0f0f0;outline:none;border-radius:4px}
.psel:focus{border-color:#3CDBC0}
.pgrid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:5px}
.pchip{background:#201f1e;border:1px solid rgba(255,255,255,.08);padding:6px 10px;border-radius:4px}
.pcl{display:block;font-size:9px;color:#3d5070;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;font-family:'Montserrat',sans-serif}
.pcv{font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;color:#f0f0f0}
.zmfi{display:flex;gap:8px;padding:9px 11px;border:1px solid rgba(255,255,255,.08);cursor:pointer;background:#201f1e;transition:.15s;border-radius:4px}
.zmfi.sel{border-color:rgba(60,219,192,.5);background:rgba(60,219,192,.08)}.zmfi:hover:not(.sel){border-color:rgba(255,255,255,.18)}
.rdot{width:13px;height:13px;border-radius:50%;border:2px solid rgba(255,255,255,.15);transition:.15s;margin-top:2px;flex-shrink:0}
.rdot.on{border-color:#3CDBC0;background:#3CDBC0;box-shadow:0 0 0 3px rgba(60,219,192,.2)}
.ppbi{border:1px solid rgba(255,255,255,.08);overflow:hidden;border-radius:5px}.ppbc{display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:pointer;background:#302e2d;width:100%}
.ppbc input[type=checkbox]{display:none}
.ppbcb{width:16px;height:16px;border:2px solid rgba(255,255,255,.15);flex-shrink:0;background:#201f1e;transition:.15s;position:relative;border-radius:3px}
.ppbc input:checked+.ppbcb{background:#3CDBC0;border-color:#3CDBC0}
.ppbc input:checked+.ppbcb::after{content:"v";position:absolute;top:-1px;left:2px;color:#2C2A29;font-size:10px;font-weight:700}
.ppbtot{display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:#3CDBC0;color:#2C2A29;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:700;margin-top:4px}
.cvres{display:flex;justify-content:space-between;align-items:center;padding:11px 13px;background:rgba(60,219,192,.08);border:1px solid rgba(60,219,192,.3);border-radius:4px}
.cvres span:first-child{font-size:12px;font-weight:600;color:#3CDBC0}
.txgrid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
.txc{padding:9px 11px;border:1px solid rgba(255,255,255,.08);background:#201f1e;border-radius:4px}
.txon{border-color:rgba(248,113,113,.25);background:rgba(220,38,38,.06)}.txok{border-color:rgba(74,222,128,.2);background:rgba(22,163,74,.06)}.txwn{border-color:rgba(251,191,36,.2);background:rgba(217,119,6,.06)}
.txl{font-size:9px;color:#5a6a84;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px;font-family:'Montserrat',sans-serif;line-height:1.3}
.txv{font-family:'Montserrat',sans-serif;font-size:14px;font-weight:700;color:#f0f0f0}
.txon .txv{color:#f87171}.txok .txv{color:#4ade80}
.pright{display:flex;flex-direction:column;background:#2C2A29}
.form-topbar{display:flex;align-items:center;border-bottom:1px solid rgba(255,255,255,.08);background:#1a1918;flex-shrink:0;min-height:40px}
.form-topbar .tnav{border-bottom:none;background:transparent}
.price-hero{background:linear-gradient(150deg,#1a2520 0%,#0d1a18 100%);padding:14px 16px;border:1px solid rgba(60,219,192,.15);border-bottom:3px solid #3CDBC0;border-radius:6px;margin-bottom:4px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.form-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.form-col{display:flex;flex-direction:column;gap:10px}
.hero{background:linear-gradient(135deg,#1a2520,#0d1a18);padding:18px 22px;display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;border:1px solid rgba(60,219,192,.15);border-bottom:3px solid #3CDBC0;border-radius:6px}
.kpi{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);padding:9px 14px;text-align:center;min-width:80px;border-radius:5px}
.kpi-red{border-color:rgba(248,113,113,.2);background:rgba(220,38,38,.06)}.kpi-green{border-color:rgba(74,222,128,.2);background:rgba(22,163,74,.06)}.kpi-blue{border-color:rgba(60,219,192,.2);background:rgba(60,219,192,.07)}
.kpi-red span:last-child{color:#f87171!important}.kpi-green span:last-child{color:#4ade80!important}.kpi-blue span:last-child{color:#3CDBC0!important}
.rcard{background:#252322;border:1px solid rgba(255,255,255,.08);padding:12px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;border-radius:6px}
.rlbl{font-family:'Montserrat',sans-serif;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#5a6a84;white-space:nowrap;flex-shrink:0}
.rbody{display:flex;align-items:center;gap:12px;flex:1;flex-wrap:wrap}
.riw{display:flex;align-items:center;border:1px solid rgba(255,255,255,.12);background:#201f1e;overflow:hidden;border-radius:4px}
.riw:focus-within{border-color:#3CDBC0}
.rpfx{padding:0 10px;font-family:'Montserrat',sans-serif;font-size:12px;color:#A7A8AA;background:#1a1918;border-right:1px solid rgba(255,255,255,.08);align-self:stretch;display:flex;align-items:center}
.ri{background:none;border:none;outline:none;font-family:'Montserrat',sans-serif;font-size:15px;font-weight:700;color:#f0f0f0;padding:8px 10px;width:160px;text-align:right}
.rcl{padding:0 9px;background:none;border:none;border-left:1px solid rgba(255,255,255,.08);color:#A7A8AA;font-size:12px;cursor:pointer;align-self:stretch;display:flex;align-items:center}
.rcl:hover{color:#f87171}
.rres{display:flex;flex-direction:column;gap:4px;flex:1}
.rrmain{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600;color:#C8C9CA}
.rrv{font-family:'Montserrat',sans-serif;font-size:20px;font-weight:800}
.rpos .rrv{color:#4ade80}.rneg .rrv{color:#f87171}
.rrsub{display:flex;flex-direction:column;gap:2px}
.rrsub span{font-family:'Montserrat',sans-serif;font-size:10px;color:#5a6a84}
.strip{display:flex;align-items:center;gap:3px;flex-wrap:wrap;background:#252322;border:1px solid rgba(255,255,255,.08);padding:10px 14px;border-radius:6px}
.sb{border:1px solid rgba(255,255,255,.08);padding:6px 10px;min-width:68px;text-align:center;background:#201f1e;border-radius:4px}
.sb.hl{border-color:rgba(255,255,255,.15);background:#302e2d}.sb.blue{border-color:rgba(60,219,192,.4);background:rgba(60,219,192,.1)}.sb.dk{border-color:rgba(255,255,255,.1);background:#201f1e}
.sbl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#5a6a84;margin-bottom:2px;font-family:'Montserrat',sans-serif}
.sbv{font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;color:#C8C9CA}
.sb.hl .sbv,.sb.dk .sbv{color:#f0f0f0}.sb.blue .sbv{color:#3CDBC0}
.wfc{background:#252322;border:1px solid rgba(255,255,255,.08);padding:14px;border-radius:6px}
.ctit{font-family:'Montserrat',sans-serif;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#f0f0f0;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #3CDBC0;display:inline-block}
.wfr{display:flex;align-items:center;gap:6px;padding:3px 0}
.wft .wfl{font-family:'Montserrat',sans-serif;font-size:12px;font-weight:800;color:#f0f0f0;text-transform:uppercase}
.wfs .wfl{color:#5a6a84;font-size:10px;padding-left:10px}
.wfl{width:195px;font-size:11px;font-weight:600;color:#A7A8AA;flex-shrink:0;line-height:1.3}
.wftr{flex:1;height:12px;background:#201f1e;overflow:hidden;border-radius:3px}
.wff{height:100%;transition:width .3s;opacity:.9}
.wfp{width:42px;text-align:right;font-family:'Montserrat',sans-serif;font-size:9px;color:#3d5070;flex-shrink:0}
.wfv{width:80px;text-align:right;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:500;color:#A7A8AA;flex-shrink:0}
.wft .wfv{font-size:13px;font-weight:700;color:#3CDBC0}
.dc{background:#252322;border:1px solid rgba(255,255,255,.08);padding:14px;border-radius:6px}
.ov{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px}
.mb{background:#252322;border:1.5px solid rgba(60,219,192,.4);width:100%;max-width:460px;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;border-radius:8px}
.mh{padding:13px 17px;background:#302e2d;border-bottom:1px solid rgba(60,219,192,.2);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:1;border-radius:8px 8px 0 0}
.mt{font-family:'Montserrat',sans-serif;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#f0f4ff}
.mc{background:none;border:none;color:#A7A8AA;font-size:18px;cursor:pointer;padding:2px 6px;line-height:1}
.mc_btn{background:none;border:none;color:#A7A8AA;font-size:18px;cursor:pointer;padding:2px 6px;line-height:1}
.mc:hover{color:#f0f0f0}
.mbody{padding:15px;display:flex;flex-direction:column;gap:10px}
.pbase{display:flex;justify-content:space-between;align-items:center;padding:7px 11px;background:#201f1e;border:1px solid rgba(255,255,255,.08);font-family:'Montserrat',sans-serif;font-size:11px;color:#A7A8AA;border-radius:4px}
.pbase span:last-child{color:#3CDBC0;font-weight:700}
.pdecomp{background:#201f1e;border:1px solid rgba(255,255,255,.08);padding:9px 11px;display:flex;flex-direction:column;gap:5px;border-radius:4px}
.pdecomp div{display:flex;justify-content:space-between;font-size:11px;font-family:'Montserrat',sans-serif;color:#A7A8AA;border-bottom:1px solid rgba(255,255,255,.04);padding-bottom:4px}
.pdecomp div:last-child{border-bottom:none;padding-bottom:0}
.pdecomp div span:last-child{color:#C8C9CA}
.pres{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;background:rgba(60,219,192,.08);border:1.5px solid rgba(60,219,192,.4);border-radius:4px}
.pres span:first-child{font-size:12px;font-weight:600;color:#3CDBC0}.pres span:last-child{font-family:'Montserrat',sans-serif;font-size:17px;font-weight:700;color:#3CDBC0}
.mapp{padding:11px;background:#3CDBC0;border:none;color:#2C2A29;cursor:pointer;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;transition:.15s}
.mapp:hover{background:#2bc4ab}
.ftable{display:flex;flex-direction:column;gap:3px}
.fth{display:grid;grid-template-columns:1fr 100px 100px;gap:6px;padding:4px 9px;font-family:'Montserrat',sans-serif;font-size:9px;color:#3d5070;text-transform:uppercase;letter-spacing:.5px}
.ftr{display:grid;grid-template-columns:1fr 100px 100px;gap:6px;align-items:center;padding:5px 9px;background:#201f1e;border:1px solid rgba(255,255,255,.05);border-radius:3px}
.ftot{display:flex;align-items:center;padding:7px 11px;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:600;border-radius:4px}
.ftok{background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.2);color:#4ade80}
.ftwarn{background:rgba(217,119,6,.08);border:1px solid rgba(217,119,6,.2);color:#fbbf24}
.desp-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.desp-modes{display:flex;gap:3px}
.moeda-toggle{display:flex;align-items:center;gap:7px;padding:7px 14px;border-bottom:1px solid rgba(255,255,255,.07);background:#2C2A29;flex-shrink:0}
.moeda-toggle span{font-size:10px;font-weight:700;color:#5a6a84;letter-spacing:.4px;text-transform:uppercase}
.moeda-toggle .rgb{flex:none;padding:4px 12px;font-size:11px}
.bdc{background:#252322;border:1px solid rgba(255,255,255,.08);border-radius:8px;overflow:hidden}
.bdr{display:flex;align-items:center;padding:4px 8px;gap:6px;border-bottom:1px solid rgba(255,255,255,.03)}
.bdr.bdsub .bdl{color:#5a6a84}
.bdl{flex:1;font-size:10px;color:#C8C9CA;line-height:1.3}
.bdv{width:80px;text-align:right;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:500;color:#C8C9CA;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:1px}
.bdv2{font-size:9px;color:#5a6a84;font-weight:400}

/* Breakdown grupos colapsáveis */
.bd-wrap{display:flex;flex-direction:column;gap:3px}
.bd-grp{background:#252322;border:1px solid rgba(255,255,255,.07);border-radius:5px;overflow:hidden}
.bd-grp-hd{display:flex;align-items:center;gap:5px;padding:7px 10px;cursor:pointer;user-select:none;transition:background .15s}
.bd-grp-hd:hover{background:rgba(255,255,255,.03)}
.bd-chevron{font-size:9px;color:#5a6a84;width:10px;flex-shrink:0}
.bd-grp-lbl{font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:.5px;color:#f0f4ff;white-space:nowrap;flex-shrink:0;min-width:100px}
.bd-grp-bar{flex:1;height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden;min-width:20px}
.bd-grp-pct{width:38px;text-align:right;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;flex-shrink:0}
.bd-grp-val{width:84px;text-align:right;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;flex-shrink:0}
.bd-grp-body{padding:4px 0 6px;border-top:1px solid rgba(255,255,255,.05)}
.bd-tot{display:flex;align-items:center;gap:4px;padding:7px 8px;background:#201f1e;border-radius:4px}
.bd-tot-lbl{flex:1;font-family:'Montserrat',sans-serif;font-size:13px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:#f0f0f0}
.bd-tot-pct{width:36px;text-align:right;font-family:'Montserrat',sans-serif;font-size:10px;color:#A7A8AA;flex-shrink:0}
.bd-tot-val{width:80px;text-align:right;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:800;flex-shrink:0}
.bd-preco{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:linear-gradient(135deg,#1a2520,#0d1a18);border:1px solid rgba(60,219,192,.25);border-radius:5px}
.bd-preco span:first-child{font-family:'Montserrat',sans-serif;font-size:11px;font-weight:800;letter-spacing:1.5px;color:#3CDBC0}
.bd-subtot{display:flex;align-items:center;gap:4px;padding:5px 8px 4px;margin:4px 6px 2px;background:rgba(255,255,255,.04);border-radius:3px}
.bd-subtot-lbl{flex:1;font-family:'Montserrat',sans-serif;font-size:9.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#7a8ba3}
.bd-subtot-pct{width:36px;text-align:right;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:600;color:#5a6a84;flex-shrink:0}
.bd-subtot-val{width:80px;text-align:right;font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;color:#c8d6e8;flex-shrink:0}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#2C2A29}::-webkit-scrollbar-thumb{background:#302e2d;border-radius:3px}::-webkit-scrollbar-thumb:hover{background:#3CDBC0}
`;

// ── APP ────────────────────────────────────────────────────────────────────────
function Calculadora({user:currentUser, isAdmin=false, nomeAba="", onRenomear=null, onCalcsChange=null}){
  const [d,setD]=useState(()=>({...DEF}));
  const [calcs,setCalcs]=useState(()=>({...CALC_DEF}));
  const [tab,setTab]=useState("perfil");
  const [modal,setModal]=useState(null);
  const [produtosDB,setProdutosDB]=useState([]);
  const [produtoDB,setProdutoDB]=useState(null);
  const [categoriasDB,setCategoriasDB]=useState([]);
  const [buscaProd,setBuscaProd]=useState("");
  const [editCadModal,setEditCadModal]=useState(false);
  const [editCadForm,setEditCadForm]=useState(null);
  const [editCadSalvando,setEditCadSalvando]=useState(false);

  // Escuta evento do botão Gestão no topbar
  useEffect(()=>{
    const handler = () => setModal("gestao");
    document.addEventListener("openGestao", handler);
    return () => document.removeEventListener("openGestao", handler);
  }, []);

  // Reset completo ao montar (novo login sempre começa zerado)
  useEffect(()=>{
    setD({...DEF});
    setCalcs({...CALC_DEF});
    setTab("perfil");
    setProdutoDB(null);
  },[currentUser?.id]);

  // Carrega catálogo de produtos e categorias do Supabase
  useEffect(()=>{
    db.getProdutos().then(rows=>{ if(rows&&rows.length) setProdutosDB(rows); }).catch(()=>{});
    db.getCategorias().then(rows=>{ if(rows&&rows.length) setCategoriasDB(rows); }).catch(()=>{});
  },[]);

  // Redireciona aba se vplModo mudar para não-estimado e aba for importacao/ppb
  useEffect(()=>{
    if(d.vplModo!=="estimado"&&(tab==="importacao"||tab==="ppb")) setTab("vpl");
  },[d.vplModo]);

  const S=k=>v=>setD(p=>({...p,[k]:v}));
  const SC=k=>v=>setCalcs(p=>({...p,[k]:{...p[k],...v}}));
  // ── Helpers de moeda (campos BRL que podem ser editados em USD) ──
  const isBRL=d.moedaCusto!=="USD";
  const toDisp=v=>isBRL?v:+(v/d.ptax).toFixed(4);
  const toStore=v=>isBRL?v:+(v*d.ptax).toFixed(4);
  const sfxM=isBRL?"R$":"USD";

  const prod=useMemo(()=>{
    if(produtosDB.length>0){
      const r=produtosDB.find(p=>p.id===d.prodId);
      if(r) return normalizeProdutoDB(r);
    }
    return PRODUTOS.find(p=>p.id===d.prodId)||PRODUTOS[0];
  },[d.prodId,produtosDB]);
  const prodAtrib=useMemo(()=>getProdAtributos(prod,d.origem||"MAO",d.modalidade||"CKD"),[prod,d.origem,d.modalidade]);
  const isZFM=prodAtrib.isZFM;
  const isCBU=prodAtrib.isCBU;
  const pcEntry=PC_ZFM.find(e=>e.k===d.pcZfmKey)||PC_ZFM[1];
  const temCadastro=useMemo(()=>{
    const pm=getPerfisMap(loadPerfis());
    return (pm[currentUser?.perfil]?.modulos||[]).includes("cadastro");
  },[currentUser?.perfil]);
  const setProd=id=>{
    const dbRec=produtosDB.find(x=>x.id===id)||null;
    setProdutoDB(dbRec);
    const p=dbRec?normalizeProdutoDB(dbRec):(PRODUTOS.find(x=>x.id===id)||PRODUTOS[0]);
    const defaults=dbRec?{
      producao:dbRec.producao||0,
      garantia:dbRec.garantia||0,
      bkpPct:dbRec.bkp_pct||0,
      embalagem:dbRec.embalagem||0,
      pd:dbRec.pd||0,
      scrap:dbRec.scrap||0,
      royal:dbRec.royal||0,
      frete:dbRec.frete_venda||0,
      margGer:dbRec.marg_ger||0,
      mkt:dbRec.mkt||0,
      rebate:dbRec.rebate||0,
    }:{};
    const vplModo=dbRec&&(dbRec.vpl_padrao||0)>0?"cadastrado":d.vplModo;
    // PDD: preenche 2,5% se zerado ao trocar de produto (padrão universal das planilhas)
    const pddAuto = !d.pdd ? 2.5 : d.pdd;
    setD(pv=>({...pv,prodId:id,stAtivo:p.mva>0,mva:p.mva,icmsDestST:p.aliqST,...defaults,vplModo,pdd:pddAuto}));
    if(d.modalidade==="CBU") aplicarIICBU(p.ncm);
  };
  // ── Tabela TEC local — II por NCM (valores verificados na Receita Federal) ───
  const TEC_II = {
    // ── Informática ──────────────────────────────────────────────────────────
    "8470.50.10": 20,     // Terminal de Pagamento
    "8471.30.11": 0,      // Tablet 7"
    "8471.30.12": 16,     // Notebook/Tablet 8"-14"
    "8471.30.19": 16,     // Notebook 15"+
    "8471.49.00": 25,     // All In One / Servidor
    "8471.50.10": 14.4,   // CPU Pequena Capacidade
    "8471.60.52": 10.8,   // Teclado
    "8471.60.80": 20,     // Totem
    "8471.70.10": 16,     // HDD (Disco Rígido)
    "8471.90.19": 16,     // Leitor RFID / Facial
    // ── Carregadores / Balun ─────────────────────────────────────────────────
    "8504.40.10": 18,     // Carregador Celular
    "8504.40.21": 16,     // Balun / Power Balun
    // ── Aspiradores / Casa ───────────────────────────────────────────────────
    "8508.11.00": 18,     // Robô Aspirador
    "8508.70.00": 18,     // Acessório Robô (tanque/filtro)
    "8509.80.90": 18,     // Alimentador PET / Robô Laser
    // ── Telecomunicações ─────────────────────────────────────────────────────
    "8517.13.00": 16,     // Smartphone
    "8517.14.31": 20,     // Feature Phone
    "8517.62.34": 16,     // Switch PoE Ethernet
    "8517.62.41": 16,     // Router Mesh
    "8517.62.59": 16,     // Extensor HDMI
    "8517.62.77": 20,     // Video Porteiro
    "8517.62.94": 16,     // Gateway / Hub
    // ── Áudio / Vídeo ────────────────────────────────────────────────────────
    "8518.22.00": 18,     // Caixa de Som Bluetooth
    "8521.90.00": 20,     // DVR / XVR / NVR Gravador
    "8523.52.10": 16,     // Cartão Proximity / RFID
    // ── Câmeras ──────────────────────────────────────────────────────────────
    "8525.89.13": 20,     // Câmera IP / Analógica Básica
    "8525.89.29": 20,     // Câmera IP PoE / Smart Camera WiFi
    "8528.52.00": 10.8,   // Monitor
    // ── Alarme / Segurança ───────────────────────────────────────────────────
    "8531.10.90": 16,     // Central de Alarme
    "8536.50.90": 16,     // Smart Plug / Interruptor
    // ── Lâmpadas / Iluminação ────────────────────────────────────────────────
    "8539.52.00": 10.8,   // Smart Lâmpada
    "8543.70.99": 16,     // Sensor / Controle Eletrônico
    // ── Fechaduras ───────────────────────────────────────────────────────────
    "8301.40.00": 16,     // Fechadura Eletrônica
    // ── Filtros ──────────────────────────────────────────────────────────────
    "8421.39.90": 10,     // Filtro HEPA
    // ── Smartwatch ───────────────────────────────────────────────────────────
    "9102.12.20": 20,     // Smartwatch
    "9102.12.90": 20,     // Smartwatch (variante)
    // ── Luminárias ───────────────────────────────────────────────────────────
    "9405.11.90": 18,     // Smart Luminária Painel/Embutir
    "9405.21.00": 18,     // Smart Luminária de Mesa
    "9405.42.00": 18,     // Smart Fita LED
    // ── Acessórios têxteis ───────────────────────────────────────────────────
    "6307.10.00": 35,     // Mop / Pano (acessório aspirador)
    "6307.90.10": 35,     // Saco de Poeira (acessório aspirador)
    // ── Escovas ──────────────────────────────────────────────────────────────
    "9603.50.00": 18,     // Escova / Acessório Aspirador
  };

  const setOrigem=origem=>setD(pv=>{
    const reset={};
    // CRA é exclusivo de MAO/ZFM; zerar ao sair de MAO
    if(pv.origem==="MAO" && origem!=="MAO") reset.cra=0;
    // cfImp é exclusivo de IOS; zerar ao sair de IOS
    if(pv.origem==="IOS" && origem!=="IOS") reset.cfImp=0;
    return {...pv,origem,...reset};
  });
  const setModalidade=modalidade=>{
    setD(pv=>({...pv,modalidade}));
    if(modalidade==="CBU") aplicarIICBU(prod.ncm);
  };

  const [iiStatus,setIiStatus]=useState(null);
  const aplicarIICBU=(ncm)=>{
    const ii = TEC_II[ncm];
    if(ii !== undefined){
      setD(pv=>({...pv,aliqII:ii}));
      setIiStatus("ok");
    } else {
      setIiStatus("err");
    }
  };
  const ppbTot=useMemo(()=>isCBU?0:PPB_ITEMS.reduce((s,i)=>s+(d.ppbAtivos[i.id]?+d.ppbVals[i.id]||0:0),0),[d.ppbAtivos,d.ppbVals,isCBU]);

  const c=useMemo(()=>{
    const cfrUSD=d.fobUSD+d.freteUSD;
    const cfrBRL=cfrUSD*d.ptax;
    const iiV=cfrBRL*(d.aliqII/100);
    const despesas=d.despesasModo==="pct"?cfrBRL*d.despesasPct/100:d.despesas;
    const cfrImp=cfrBRL+iiV+despesas;
    const cmvImp=cfrBRL+iiV+despesas+d.seguroBRL;

    // ── CRA (MAO) — % conteúdo local × II em USD ─────────────────────────────
    const iiUSD = d.ptax>0 ? iiV/d.ptax : 0;
    const craCalcMAO = d.origem==="MAO" ? -((d.conteudoLocal||0)/100 * iiUSD) : 0;

    // ── Crédito Federal (IOS) ─────────────────────────────────────────────────
    // CFR expandido em USD = FOB + Frete + II_USD + Despesas_USD + cfImp_USD + Seguro_USD
    const cfImpUSD = d.ptax>0 ? d.cfImp/d.ptax : 0;
    const despesasUSD = d.ptax>0 ? despesas/d.ptax : 0;
    const seguroUSD = d.ptax>0 ? d.seguroBRL/d.ptax : 0;
    const cfrExpandidoUSD = d.fobUSD + d.freteUSD + iiUSD + despesasUSD + cfImpUSD + seguroUSD;
    // base da placa = (% PLM × CFR expandido) + custo PCB (ppb placa) + custo Memória (ppb memoria)
    const ppbPlacaUSD = d.ptax>0 ? (d.ppbVals?.placa||0)/d.ptax : 0;
    const ppbMemoriaUSD = d.ptax>0 ? (d.ppbVals?.memoria||0)/d.ptax : 0;
    const basePlacaUSD = ((d.plmPct||0)/100 * cfrExpandidoUSD) + ppbPlacaUSD + ppbMemoriaUSD;
    // crédito = (-IPI% + ICMS% × 7,3%) × base_placa × (1 + % conteúdo local)
    const creditoCalcIOS = d.origem==="IOS"
      ? (-prodAtrib.ipi/100 + prodAtrib.icms/100 * 0.073) * basePlacaUSD * (1 + (d.conteudoLocal||0)/100)
      : 0;

    const vplEstimado=cmvImp+d.cfImp+ppbTot+d.cra;
    const vpl=d.vplModo==="estimado"?vplEstimado
             :d.vplModo==="manual"?(d.vplManual||0)
             :(produtoDB?.vpl_padrao||0);
    const bkpBase=vpl+(d.embalagem||0)+d.outrosBRL;
    const bkpV=bkpBase*(d.bkpPct/100);
    const cmvTotal=vpl+d.producao+d.garantia+bkpV+(d.embalagem||0)+d.outrosBRL;

    // IPI: para IOS a base de cálculo é sobre preço sem IPI → IPI ef = IPI% / (1 + IPI%)
    const ipi=prodAtrib.ipi;
    // IPI efetivo: cálculo "por dentro" aplica-se a IOS e a CBU (importado — base = preço sem IPI)
    const ipiEfPct = (d.origem==="IOS" || isCBU) && ipi>0 ? ipi/(1+ipi/100) : ipi;

    // P/C: para IOS base exclui IPI → pcEf = (9,25% × (1-ICMS%)) / (1+IPI%)
    // Para MAO/ZFM: usa lógica normal
    let pcPct,pcLabel;
    if(isZFM&&prodAtrib.pcBase==="zmf"){pcPct=pcEntry.pct;pcLabel=`ZFM ${pct(pcPct)}`;}
    else if(typeof prodAtrib.pcBase==="number"){pcPct=prodAtrib.pcBase;pcLabel=pct(pcPct);}
    else{pcPct=d.regimeVendedor==="presumido"?3.65:9.25;pcLabel=pct(pcPct);}

    const ufO=prodAtrib.uf,ufD=d.ufDestino,intra=ufO===ufD;
    const aliqInter=getICMS(ufO,ufD);
    const aliqDest=ALIQ_INT[ufD]||18;
    const icmsOrigemEf = prodAtrib.uf==="PR" ? prodAtrib.icms*(1-0.35) : prodAtrib.icms;
    const icmsImpEf = isCBU ? prodAtrib.icms*(1-(d.icmsDiferimento||0)/100) : icmsOrigemEf;
    const icmsEfPct=Math.max(0,aliqInter-prodAtrib.cred);
    let difal=0;
    const deveDifal=d.tipoComprador==="naocontrib"||(d.tipoComprador==="contrib"&&d.destinacaoCliente==="imobilizado");
    if(!intra&&deveDifal){const delta=aliqDest-aliqInter;if(delta>0)difal=(prodAtrib.aliqST>0&&delta<prodAtrib.aliqST)?0:delta;}

    // P/C efetivo:
    // IOS: (pcPct × (1 - aliqInter% - difal%)) / (1 + IPI%)  — base exclui IPI
    // Outros: pcPct × (1 - aliqInter% - difal%)
    const pcEfBase = pcPct*(1-(aliqInter+difal)/100);
    const pcEf = d.origem==="IOS" && ipi>0 ? pcEfBase/(1+ipi/100) : pcEfBase;

    // Subvenção:
    // IOS: 9,25% × (ICMS%/(1+IPI%) - 1,2%)  — 1,2% = coef. interno créditos acessórios
    // Outros: 9,25% × cred%
    const COEF_ACES_IOS = 1.2; // coeficiente interno de créditos de acessórios
    const pcSubvPct = d.origem==="IOS" && ipi>0 && prodAtrib.cred>0
      ? Math.max(0, +(9.25*(prodAtrib.cred/100/(1+ipi/100) - COEF_ACES_IOS/100)).toFixed(6))
      : prodAtrib.cred>0 ? +(9.25*(prodAtrib.cred/100)).toFixed(6) : 0;

    const ftiPct=(isZFM&&d.ftiAtivo)?prodAtrib.fti:0;
    const fcpPct=FCP[ufD]||0;

    // Crédito IPI IOS: -12,97% / (1+IPI%) como índice negativo no soma
    const ipiCreditoIOSPct = d.origem==="IOS" && ipi>0 ? 12.97/(1+ipi/100) : 0;
    const comisXPct=d.comis*(2/3);
    const cartaoPct=d.cartaoAtivo?2:0;
    const cfVendaEf=d.cfVenda+cartaoPct;
    // Footprint: custo/benefício operacional da fábrica — aplica só em CKD/SKD
    // MAO=-0,71% (benefício ZFM) | IOS=+1,00% (custo extra Ilhéus) | CWB=0%
    const oRef = ORIGENS.find(x=>x.id===d.origem)||ORIGENS[0];
    const footprintPct = !isCBU ? (oRef.footprint||0) : 0;
    const indPct=d.pd+d.cfixo+d.scrap+d.royal+cfVendaEf+d.frete+d.comis+comisXPct+d.mkt+d.rebate+(d.pdd||0)+(d.vbExtra||0)+(d.vpc||0)+footprintPct;
    // MG é um índice independente — entra no soma como os outros índices
    // Valor negativo = crédito = eleva o preço (denominador menor)
    const margGerPct=(d.margGer||0);
    // Para IOS com IPI > 0: todos os índices foram calculados como % do pF (Sell In com IPI).
    // O soma trabalha em % do pSI, então multiplica por (1+IPI%) para converter.
    // Para MAO/CWB (IPI=0): ipiF=1, sem alteração.
    const ipiF = d.origem==="IOS" && ipi>0 ? (1+ipi/100) : 1;
    const soma=ipiF*(pcEf+pcSubvPct+icmsEfPct+difal+ftiPct+fcpPct+indPct+margGerPct+d.margem-ipiCreditoIOSPct)/100;
    const pSI=soma<1?cmvTotal/(1-soma):cmvTotal*99;
    const ipiV=pSI*(ipi/100),pCI=pSI+ipiV;
    const icmsV=pSI*(aliqInter/100);
    const pcBaseRedPct=pcPct*(aliqInter/100);
    let stV=0,stBase=0;
    if(d.stAtivo&&d.mva>0){stBase=pCI*(1+d.mva/100);stV=Math.max(0,stBase*(d.icmsDestST/100)-icmsV);}
    const pF=pCI+stV;

    // Todos os valores monetários calculados sobre pF (preço final com IPI)
    const ipiCreditoV=pF*(ipiCreditoIOSPct/100);
    const pcV=pF*(pcEf/100),icmsEfV=pF*(icmsEfPct/100),difalV=pF*(difal/100);
    const pcSubvV=pF*(pcSubvPct/100);
    const ftiV=pF*(ftiPct/100),fcpV=pF*(fcpPct/100);
    const margGerV=pF*(margGerPct/100);
    const margV=pF*(d.margem/100);
    const pdV=pF*(d.pd/100),cfxV=pF*(d.cfixo/100);
    const scV=pF*(d.scrap/100),ryV=pF*(d.royal/100);
    const cfnV=pF*(cfVendaEf/100),frV=pF*(d.frete/100),cmV=pF*((d.comis+comisXPct)/100);
    const mktV=pF*(d.mkt/100),rebateV=pF*(d.rebate/100);
    const pUSD=(d.ptaxPreco||d.ptax)>0?pF/(d.ptaxPreco||d.ptax):0;
    const cargaTot=pcV+ipiV+icmsEfV+difalV+stV+fcpV;
    const cargaPct=pF>0?(cargaTot/pF)*100:0;
    const margPct=pF>0?(margV/pF)*100:0;
    // MC: toggle OFF → MG não entra na MC (abaixo da linha)
    //     toggle ON  → MG entra na MC junto com ML e CF
    const mc=pF>0?((margV+cfxV+(d.margGerAtivo?margGerV:0))/pF)*100:0;
    const mkp=cmvTotal>0?pF/cmvTotal:0;
    let margemAlvo=null;
    if(d.precoAlvo>0){
      const pSIa=d.precoAlvo/(1+ipi/100);
      const sfBase=pcEf+pcSubvPct+icmsEfPct+difal+ftiPct+fcpPct+indPct+margGerPct-ipiCreditoIOSPct;
      margemAlvo=pSIa>0?(1-cmvTotal/pSIa)*100/ipiF-sfBase:null;
    }

    // Modo margem: usa precoSugerido como pF base para todos os cálculos
    let margemSugerida=null;
    const pFfinal = d.modoCalc==="margem" && d.precoSugerido>0 ? d.precoSugerido : pF;
    if(d.modoCalc==="margem" && d.precoSugerido>0){
      const pSIs=d.precoSugerido/(1+ipi/100);
      const sfBase2=pcEf+pcSubvPct+icmsEfPct+difal+ftiPct+fcpPct+indPct+margGerPct-ipiCreditoIOSPct;
      margemSugerida=pSIs>0?(1-cmvTotal/pSIs)*100/ipiF-sfBase2:null;
    }

    // Se modo margem com preço sugerido, recalcula todos os valores monetários sobre pFfinal
    const pFbase = pFfinal;
    const ipiCreditoVf=pFbase*(ipiCreditoIOSPct/100);
    const pcVf=pFbase*(pcEf/100),icmsEfVf=pFbase*(icmsEfPct/100),difalVf=pFbase*(difal/100);
    const pcSubvVf=pFbase*(pcSubvPct/100);
    const ftiVf=pFbase*(ftiPct/100),fcpVf=pFbase*(fcpPct/100);
    const margGerVf=pFbase*(margGerPct/100);
    // No modo margem: ML real = margemSugerida (resultado do preço); no modo preço: ML = d.margem+margGerPct
    const margPctEf = (d.modoCalc==="margem" && margemSugerida!==null)
      ? margemSugerida
      : (d.margem+margGerPct);
    const margVf=pFbase*(margPctEf/100);
    const footprintVf=pFbase*(footprintPct/100);
    const pdVf=pFbase*(d.pd/100),cfxVf=pFbase*(d.cfixo/100);
    const scVf=pFbase*(d.scrap/100),ryVf=pFbase*(d.royal/100);
    const cfnVf=pFbase*(cfVendaEf/100),frVf=pFbase*(d.frete/100),cmVf=pFbase*((d.comis+comisXPct)/100);
    const mktVf=pFbase*(d.mkt/100),rebateVf=pFbase*(d.rebate/100);
    const pddVf=pFbase*((d.pdd||0)/100),vbExtraVf=pFbase*((d.vbExtra||0)/100),vpcVf=pFbase*((d.vpc||0)/100);
    const ipiVf=pFbase/(1+ipi/100)*(ipi/100); // ipiV sobre pSI derivado de pFfinal
    const pSIfinal = pFbase/(1+ipi/100);
    const cargaTotf=pcVf+ipiVf+icmsEfVf+difalVf+(stV||0)+fcpVf;
    const cargaPctf=pFbase>0?(cargaTotf/pFbase)*100:0;
    const margPctf=margPctEf;  // já é o valor correto para ambos os modos
    const mcf=pFbase>0?((margVf+cfxVf+(d.margGerAtivo?margGerVf:0))/pFbase)*100:0;
    const mkpf=cmvTotal>0?pFbase/cmvTotal:0;
    const pUSDf=(d.ptaxPreco||d.ptax)>0?pFbase/(d.ptaxPreco||d.ptax):0;
    return{cfrUSD,cfrBRL,iiV:iiV,iiUSD,vpl,vplEstimado,bkpV,bkpBase,cfrImp,cmvImp,cmvTotal,ppbTot,despesas,
      craCalcMAO,creditoCalcIOS,cfrExpandidoUSD,basePlacaUSD,
      pcPct,pcEf,pcLabel,pcV:pcVf,pcSubvPct,pcSubvV:pcSubvVf,pcBaseRedPct,aliqInter,aliqDest,icmsEfPct,icmsV,icmsEfV:icmsEfVf,
      difal,difalV:difalVf,ftiPct,ftiV:ftiVf,fcpPct,fcpV:fcpVf,ipi,ipiEfPct,ipiV:ipiVf,ipiCreditoV:ipiCreditoVf,ipiCreditoIOSPct,pSI:pSIfinal,pCI,
      margV:margVf,indPct,footprintPct,footprintV:footprintVf,pdPad:oRef.pdPad||0,
      cfixoPad:prodAtrib.cfixoPad||0,royalPad:prodAtrib.royalPad||0,
      scrapPad:prodAtrib.scrapPad||0,fretePad:prodAtrib.fretePad||0,bkpPad:prodAtrib.bkpPad||0,pdV:pdVf,cfxV:cfxVf,scV:scVf,ryV:ryVf,cfnV:cfnVf,cfVendaEf,cartaoPct,frV:frVf,cmV:cmVf,mktV:mktVf,rebateV:rebateVf,pddV:pddVf,vbExtraV:vbExtraVf,vpcV:vpcVf,stV,stBase,
      pF:pFfinal,pUSD:pUSDf,
      cargaTot:cargaTotf,cargaPct:cargaPctf,margPct:margPctf,mc:mcf,mkp:mkpf,ufO,intra,deveDifal,margemAlvo,margemSugerida,comisXPct,margGerPct,margGerV:margGerVf,
      // MC equivalente nos modos precoAlvo e margem (ML + CF + MG)
      mcAlvo:    margemAlvo    !== null ? margemAlvo    + d.cfixo + (d.margGerAtivo ? d.margGer : 0) : null,
      mcSugerida:margemSugerida!== null ? margemSugerida+ d.cfixo + (d.margGerAtivo ? d.margGer : 0) : null};
  },[d,prod,prodAtrib,isZFM,isCBU,pcEntry,ppbTot,produtoDB]);

  // Notifica o MultiTab sempre que os cálculos mudarem (para o painel comparativo)
  useEffect(()=>{
    if(onCalcsChange) onCalcsChange(c, d, prod.nome);
  },[c]);

  const TABS_ALL=["perfil","importacao","ppb","vpl","indices","venda","st"];
  const TLBL_ALL=["Perfil","Importação","PPB","VPL / Custos Locais","Índices","Venda","ST"];
  const TABS=d.vplModo==="estimado"?TABS_ALL:TABS_ALL.filter(t=>!["importacao","ppb"].includes(t));
  const TLBL=TABS_ALL.reduce((acc,t,i)=>{if(TABS.includes(t))acc.push(TLBL_ALL[i]);return acc;},[]);

  return(
    <>
    {modal==="cfImp"&&<ModalCF onClose={()=>setModal(null)} fobUSD={d.fobUSD} ptax={d.ptax}
      data={calcs.cfImp} setData={v=>SC("cfImp")(v)}
      onApply={v=>{setD(p=>({...p,cfImp:v}));SC("cfImp")({applied:true});setModal(null);}}/>}
    {modal==="cra"&&<ModalCRA onClose={()=>setModal(null)} origem={d.origem} c={c} d={d} prodAtrib={prodAtrib}
      onApply={(valorUSD, cl, plm)=>{
        const valorBRL = valorUSD*(d.ptax||0);
        setD(p=>({...p, cra: valorBRL, conteudoLocal: cl, plmPct: plm}));
        setModal(null);
      }}/>}
    {modal==="frete"&&<ModalFrete onClose={()=>setModal(null)}
      data={calcs.frete} setData={v=>SC("frete")(v)}
      onApply={v=>{setD(p=>({...p,freteUSD:v}));SC("frete")({applied:true});setModal(null);}}/>}
    {modal==="pcb"&&<ModalPCB onClose={()=>setModal(null)} cfrImp={c.cfrImp}
      data={calcs.pcb} setData={v=>SC("pcb")(v)}
      onApply={v=>{setD(p=>({...p,ppbAtivos:{...p.ppbAtivos,placa:true},ppbVals:{...p.ppbVals,placa:v}}));setModal(null);}}/>}
    {modal==="cfVenda"&&<ModalCFVenda onClose={()=>setModal(null)}
      data={calcs.cfVenda} setData={v=>SC("cfVenda")(v)}
      onApply={v=>{setD(p=>({...p,cfVenda:v}));SC("cfVenda")({applied:true});setModal(null);}}/>}
    {modal==="registros"&&<ModalRegistros
      onClose={()=>setModal(null)}
      currentD={d} currentCalcs={calcs}
      prodNome={nomeAba||prod.nome}
      user={currentUser}
      onLoad={(savedD, savedCalcs, nome)=>{
        const safeD={
          ...DEF,
          ...savedD,
          // campos aninhados: merge explícito para não perder sub-campos
          ppbAtivos:{...DEF.ppbAtivos,...(savedD?.ppbAtivos||{})},
          ppbVals:{...DEF.ppbVals,...(savedD?.ppbVals||{})},
          // campos que o DEF novo tem mas saves antigos podem não ter
          origem:savedD?.origem||savedD?.planta||DEF.origem,
          modalidade:savedD?.modalidade||DEF.modalidade,
          moedaCusto:savedD?.moedaCusto||DEF.moedaCusto,
          margGer:savedD?.margGer??DEF.margGer,
          margGerAtivo:savedD?.margGerAtivo??DEF.margGerAtivo,
          modoCalc:savedD?.modoCalc||DEF.modoCalc,
        };
        const safeCalcs={...CALC_DEF,...(savedCalcs||{})};
        setD(safeD);
        setCalcs(safeCalcs);
        if(onRenomear&&nome)onRenomear(nome);
      }}/>}
    {modal==="gestao"&&<ModalGestaoUsers onClose={()=>setModal(null)} currentUser={currentUser}/> }

    {/* Modal de edição rápida do cadastro do produto */}
    {editCadModal&&editCadForm&&(()=>{
      const F=k=>e=>setEditCadForm(p=>({...p,[k]:e.target.type==="number"?parseFloat(e.target.value)||0:e.target.value}));
      const salvar=async()=>{
        setEditCadSalvando(true);
        try{
          const {categoria,...dados}=editCadForm;
          await db.updateProduto(editCadForm.id,dados);
          const rows=await db.getProdutos();
          if(rows&&rows.length){
            setProdutosDB(rows);
            const novo=rows.find(r=>r.id===editCadForm.id)||null;
            setProdutoDB(novo);
          }
          setEditCadModal(false);
        }catch(e){alert("Erro ao salvar: "+e.message);}
        finally{setEditCadSalvando(false);}
      };
      const Campo=({label,k,sfx=""})=>(
        <div style={{display:"flex",flexDirection:"column",gap:2}}>
          <label style={{fontSize:9,fontWeight:700,color:"#A7A8AA",textTransform:"uppercase",letterSpacing:.5}}>
            {label}{sfx&&<span style={{color:"#636262",marginLeft:2}}>{sfx}</span>}
          </label>
          <input type="number" step="any" value={editCadForm[k]||0} onChange={F(k)}
            style={{background:"#201f1e",border:"1px solid rgba(255,255,255,.12)",color:"#f0f0f0",
              padding:"5px 8px",fontSize:12,outline:"none",borderRadius:3,width:"100%"}}/>
        </div>
      );
      return(
        <div className="ov" onClick={()=>setEditCadModal(false)}>
          <div className="mb" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}>
            <div className="mh">
              <span className="mt">✏ Editar cadastro — {editCadForm.nome}</span>
              <button className="mc" onClick={()=>setEditCadModal(false)}>×</button>
            </div>
            <div className="mbody" style={{gap:14}}>
              <div style={{fontSize:11,color:"#A7A8AA",padding:"6px 10px",background:"rgba(60,219,192,.06)",
                border:"1px solid rgba(60,219,192,.15)",borderRadius:4}}>
                <strong style={{color:"#3CDBC0"}}>{editCadForm.id}</strong>
                {" · NCM "}{editCadForm.ncm}
                {editCadForm.sku?<> · SKU {editCadForm.sku}</>:null}
              </div>

              <div style={{fontSize:10,fontWeight:700,color:"#A7A8AA",textTransform:"uppercase",letterSpacing:.8,borderBottom:"1px solid rgba(255,255,255,.06)",paddingBottom:4}}>Impostos</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                <Campo label="IPI MAO" k="ipi_mao" sfx="%"/>
                <Campo label="IPI IOS" k="ipi_ios" sfx="%"/>
                <Campo label="IPI CWB" k="ipi_cwb" sfx="%"/>
                <Campo label="Créd. MAO" k="cred_mao" sfx="%"/>
                <Campo label="Créd. IOS" k="cred_ios" sfx="%"/>
                <Campo label="Créd. CWB" k="cred_cwb" sfx="%"/>
                <Campo label="ICMS MAO" k="icms_mao" sfx="%"/>
                <Campo label="ICMS IOS" k="icms_ios" sfx="%"/>
                <Campo label="ICMS CWB" k="icms_cwb" sfx="%"/>
                <Campo label="MVA" k="mva" sfx="%"/>
                <Campo label="FTI/UEA" k="fti" sfx="%"/>
                <Campo label="Aliq. ST" k="aliq_st" sfx="%"/>
              </div>

              <div style={{fontSize:10,fontWeight:700,color:"#A7A8AA",textTransform:"uppercase",letterSpacing:.8,borderBottom:"1px solid rgba(255,255,255,.06)",paddingBottom:4}}>VPL e Custos</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                <Campo label="VPL Padrão" k="vpl_padrao" sfx="R$"/>
                <Campo label="Produção" k="producao" sfx="R$"/>
                <Campo label="Embalagem" k="embalagem" sfx="R$"/>
                <Campo label="Garantia" k="garantia" sfx="R$"/>
                <Campo label="BKP" k="bkp_pct" sfx="%"/>
                <Campo label="P&D" k="pd" sfx="%"/>
                <Campo label="Scrap" k="scrap" sfx="%"/>
                <Campo label="Royalties" k="royal" sfx="%"/>
                <Campo label="Frete Venda" k="frete_venda" sfx="%"/>
                <Campo label="Marg. Ger." k="marg_ger" sfx="%"/>
                <Campo label="Marketing" k="mkt" sfx="%"/>
                <Campo label="Rebate" k="rebate" sfx="%"/>
              </div>
            </div>
            <div style={{padding:"12px 15px",borderTop:"1px solid rgba(255,255,255,.07)",display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button className="btn-cancel" onClick={()=>setEditCadModal(false)}>Cancelar</button>
              <button className="btn-confirm" onClick={salvar} disabled={editCadSalvando}>
                {editCadSalvando?"Salvando...":"Salvar"}
              </button>
            </div>
          </div>
        </div>
      );
    })()}

    <div className="app">
    <style>{CSS}</style>

      {/* sub-header: badges de contexto + nome da aba + botões */}
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 16px",background:"#1e2a3d",borderBottom:"1px solid rgba(255,255,255,.07)",flexWrap:"wrap",flexShrink:0,flexBasis:"auto"}}>
        {isZFM&&<span className="buf zmf">ZFM / MAO</span>}
        {prodAtrib.uf==="BA"&&<span className="buf ios">IOS / BA</span>}
        {prodAtrib.uf==="PR"&&<span className="buf cwb">CWB / PR</span>}
        {isCBU&&<span className="buf" style={{background:"rgba(220,38,38,.15)",color:"#f87171",border:"1px solid rgba(220,38,38,.3)"}}>CBU</span>}
        <span className="brt">{c.ufO} → {d.ufDestino}</span>
        <span className="bdf">{c.difal>0?`DIFAL ${pct(c.difal)}`:"DIFAL 0%"}</span>
        {/* Nome do registro */}
        {nomeAba&&(
          <span style={{fontSize:11,fontWeight:600,color:"#3CDBC0",padding:"2px 8px",background:"rgba(60,219,192,.15)",borderRadius:20,border:"1px solid rgba(60,219,192,.3)"}}>
            {nomeAba}
          </span>
        )}
        <div style={{flex:1}}/>
        {/* Dólar Custo — PTAX para conversão de todos os custos USD */}
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"3px 10px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8}}>
          <span style={{fontSize:9,fontWeight:700,color:"#5a6a84",letterSpacing:.5,textTransform:"uppercase"}}>Dólar Custo</span>
          <span style={{fontSize:9,color:"#475569"}}>R$/USD</span>
          <input type="number" step="0.01" value={d.ptax} onChange={e=>S("ptax")(parseFloat(e.target.value)||0)}
            style={{background:"none",border:"none",outline:"none",fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,color:"#3CDBC0",width:52,textAlign:"right"}}/>
        </div>
        {/* Dólar Preço — cotação para precificação indexada em USD */}
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"3px 10px",background:"rgba(60,219,192,.06)",border:"1px solid rgba(60,219,192,.2)",borderRadius:8}}>
          <span style={{fontSize:9,fontWeight:700,color:"#5a6a84",letterSpacing:.5,textTransform:"uppercase"}}>Dólar Preço</span>
          <span style={{fontSize:9,color:"#475569"}}>R$/USD</span>
          <input type="number" step="0.01" value={d.ptaxPreco||d.ptax} onChange={e=>S("ptaxPreco")(parseFloat(e.target.value)||0)}
            style={{background:"none",border:"none",outline:"none",fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,color:"#60a5fa",width:52,textAlign:"right"}}/>
        </div>
        {/* Registros — Novo / Salvar / Carregar */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <span style={{fontSize:8,fontWeight:700,color:"#5a6a84",letterSpacing:.8,textTransform:"uppercase"}}>Registros</span>
          <div style={{display:"flex",gap:4}}>
            <button onClick={()=>{setD({...DEF});setCalcs({...CALC_DEF});setTab("perfil");setIiStatus(null);if(onRenomear)onRenomear("Nova Precificação");}}
              style={{padding:"4px 10px",background:"rgba(220,38,38,.15)",border:"1px solid rgba(220,38,38,.35)",color:"#f87171",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,letterSpacing:.5,cursor:"pointer",borderRadius:20}}>
              Novo
            </button>
            <button onClick={()=>setModal("registros")}
              style={{padding:"4px 10px",background:"rgba(60,219,192,.2)",border:"1px solid rgba(60,219,192,.45)",color:"#3CDBC0",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,letterSpacing:.5,cursor:"pointer",borderRadius:20}}>
              Salvar
            </button>
            <button onClick={()=>setModal("registros")}
              style={{padding:"4px 10px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.15)",color:"#a8b5cc",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,letterSpacing:.5,cursor:"pointer",borderRadius:20}}>
              Carregar
            </button>
          </div>
        </div>
        {isAdmin&&<button onClick={()=>setModal("gestao")}
          style={{padding:"4px 12px",background:"rgba(5,150,105,.15)",border:"1px solid rgba(5,150,105,.4)",color:"#34d399",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,letterSpacing:.5,cursor:"pointer",borderRadius:20,display:"flex",alignItems:"center",gap:5}}>
          👥 Gestão de Usuários
        </button>}
      </div>

      <div className="layout">
        <aside className="pleft">
          <div className="pscroll">
            <div className="price-hero">
              <div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:9,fontWeight:700,letterSpacing:2,color:"#A7A8AA",marginBottom:4}}>
                  {d.modoCalc==="margem"?"MC RESULTANTE":"PREÇO DE VENDA FINAL"}
                </div>
                {d.modoCalc==="margem"
                  ? <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:44,fontWeight:800,letterSpacing:-1.5,lineHeight:1,display:"flex",alignItems:"flex-end",gap:4,
                      color:c.mcSugerida!==null?(c.mcSugerida>=0?"#4ade80":"#f87171"):"#f1f5f9"}}>
                      {c.mcSugerida!==null?n3(c.mcSugerida):"—"}
                      <span style={{fontSize:18,fontWeight:400,marginBottom:6}}>%</span>
                    </div>
                  : <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:44,fontWeight:800,color:"#f1f5f9",letterSpacing:-1.5,lineHeight:1,display:"flex",alignItems:"flex-start",gap:4}}>
                      <span style={{fontSize:18,fontWeight:400,color:"#3CDBC0",marginTop:6}}>R$</span>{n3(c.pF)}
                    </div>
                }
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:9,color:"#5a6a84",marginTop:4,lineHeight:1.6}}>
                  {d.modoCalc==="margem"&&d.precoSugerido>0&&<span style={{color:"#34d399"}}>Preço: {brl(d.precoSugerido)} · </span>}
                  {c.ipi>0&&`s/IPI ${brl(c.pSI)} · IPI ef. ${brl(c.ipiV)} · `}
                  {c.stV>0&&`ST ${brl(c.stV)} · `}
                  {c.difal>0&&`DIFAL ${brl(c.difalV)} · `}
                  {(d.ptaxPreco||d.ptax)>0&&<span style={{color:"#3CDBC0"}}>{usd(c.pUSD)}{d.ptaxPreco>0&&<span style={{fontSize:9,color:"#5a6a84",marginLeft:3}}>×{n3(d.ptaxPreco)}</span>}</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8}}>
                {[["CARGA","kpi-red",pct(c.cargaPct)],["ML","kpi-blue",pct(c.margPct)],["MC","kpi-green",pct(c.mc)],["MKP","",n3(c.mkp)+"x"]].map(([l,cls,v])=>(
                  <div key={l} className={`kpi ${cls}`} style={{minWidth:60}}>
                    <span style={{display:"block",fontFamily:"'Montserrat',sans-serif",fontSize:7,fontWeight:700,letterSpacing:1,color:"#475569",marginBottom:2}}>{l}</span>
                    <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <RevCalc precoAlvo={d.precoAlvo} onChange={S("precoAlvo")} c={c} margem={d.margem}/>

            <BreakdownPanel c={c} d={d} prod={prod} ppbTot={ppbTot} calcs={calcs}/>
          </div>
        </aside>

        <main className="pright">
          <div className="form-topbar">
            <nav className="tnav" style={{flex:1,background:"transparent",borderBottom:"none"}}>
              {TABS.map((t,i)=><button key={t} className={`tbtn ${tab===t?"on":""}`} onClick={()=>setTab(t)}>{TLBL[i]}</button>)}
            </nav>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"0 12px",flexShrink:0}}>
              <span style={{fontSize:10,fontWeight:700,color:"#5a6a84",letterSpacing:".4px",textTransform:"uppercase"}}>Moeda</span>
              <button className={`rgb ${isBRL?"on":""}`} style={{padding:"3px 10px",fontSize:10}} onClick={()=>S("moedaCusto")("BRL")}>BRL</button>
              <button className={`rgb ${!isBRL?"on":""}`} style={{padding:"3px 10px",fontSize:10}} onClick={()=>S("moedaCusto")("USD")}>USD</button>
              {!isBRL&&<span style={{fontFamily:"'Montserrat',sans-serif",fontSize:9,color:"#A7A8AA"}}>×{n3(d.ptax)}</span>}
            </div>
          </div>
          <div className="pscroll">

          {tab==="perfil"&&<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <Sec title="Produto" tag={produtosDB.length>0?"Catálogo":"NCM / PLAN_TRIB"}>
                  {produtosDB.length>0&&(
                    <input
                      className="psel"
                      placeholder="🔍 Buscar por nome, NCM ou ID..."
                      value={buscaProd}
                      onChange={e=>setBuscaProd(e.target.value)}
                      style={{marginBottom:4,fontSize:11}}
                    />
                  )}
                  <select className="psel" value={d.prodId} onChange={e=>{setProd(e.target.value);setBuscaProd("");}}>
                    {produtosDB.length>0?(()=>{
                      const q=buscaProd.toLowerCase().trim();
                      const lista=q
                        ?produtosDB.filter(p=>
                            p.nome.toLowerCase().includes(q)||
                            (p.ncm||"").includes(q)||
                            p.id.toLowerCase().includes(q)
                          )
                        :produtosDB;
                      if(q){
                        // busca ativa: lista plana sem optgroups
                        return[
                          <option key="" value="">— Selecione o produto —</option>,
                          ...lista.map(p=><option key={p.id} value={p.id}>[{p.id}] {p.nome}</option>)
                        ];
                      }
                      // sem busca: agrupado por categoria
                      const grupos={};
                      lista.forEach(p=>{
                        const prefix=p.id.match(/^([A-Z]+)/)?.[1]||"?";
                        if(!grupos[prefix])grupos[prefix]=[];
                        grupos[prefix].push(p);
                      });
                      const catMap=Object.fromEntries(categoriasDB.map(c=>[c.id||c.prefixo,c.nome]));
                      return[
                        <option key="" value="">— Selecione o produto —</option>,
                        ...Object.entries(grupos)
                          .sort(([a],[b])=>(catMap[a]||a).localeCompare(catMap[b]||b))
                          .map(([prefix,prods])=>(
                            <optgroup key={prefix} label={catMap[prefix]||prefix}>
                              {prods.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
                            </optgroup>
                          ))
                      ];
                    })():PRODUTOS.map(p=><option key={p.id} value={p.id}>{p.ncm} — {p.nome}</option>)}
                  </select>
                  {d.prodId&&produtosDB.length>0&&(()=>{
                    const r=produtosDB.find(p=>p.id===d.prodId);
                    if(!r)return null;
                    return(
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:5}}>
                        <span style={{fontSize:10,color:"#A7A8AA"}}>
                          NCM {r.ncm}{r.sku?` · SKU ${r.sku}`:""}
                        </span>
                        {temCadastro&&(
                          <button
                            onClick={()=>{setEditCadForm({...r});setEditCadModal(true);}}
                            style={{padding:"2px 8px",fontSize:10,fontWeight:700,cursor:"pointer",
                              background:"rgba(60,219,192,.1)",border:"1px solid rgba(60,219,192,.3)",
                              color:"#3CDBC0",borderRadius:3}}>
                            ✏ Editar cadastro
                          </button>
                        )}
                      </div>
                    );
                  })()}
                  {/* Origem de Fabricação */}
                  <div style={{marginTop:6}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#5a6a84",textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>Origem de Fabricação</div>
                    <div style={{display:"flex",gap:6}}>
                      {ORIGENS.map(o=>(
                        <button key={o.id} onClick={()=>setOrigem(o.id)}
                          style={{flex:1,padding:"6px 4px",fontSize:10,fontWeight:700,cursor:"pointer",borderRadius:4,border:"1px solid",transition:".15s",
                            background:d.origem===o.id?"rgba(60,219,192,.25)":"rgba(255,255,255,.04)",
                            borderColor:d.origem===o.id?"#3CDBC0":"rgba(255,255,255,.1)",
                            color:d.origem===o.id?"#93c5fd":"#7a90b0"}}>
                          {o.id}
                        </button>
                      ))}
                    </div>
                    <div style={{fontSize:9,color:"#5a6a84",marginTop:4}}>{ORIGENS.find(o=>o.id===d.origem)?.label}</div>
                  </div>
                  {/* Modalidade de Importação */}
                  <div style={{marginTop:6}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#5a6a84",textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>Modalidade</div>
                    <div style={{display:"flex",gap:6}}>
                      {MODALIDADES.map(m=>(
                        <button key={m.id} onClick={()=>setModalidade(m.id)}
                          style={{flex:1,padding:"6px 4px",fontSize:10,fontWeight:700,cursor:"pointer",borderRadius:4,border:"1px solid",transition:".15s",
                            background:d.modalidade===m.id?(m.id==="CBU"?"rgba(220,38,38,.2)":m.id==="SKD"?"rgba(217,119,6,.2)":"rgba(60,219,192,.25)"):"rgba(255,255,255,.04)",
                            borderColor:d.modalidade===m.id?(m.id==="CBU"?"#dc2626":m.id==="SKD"?"#d97706":"#3CDBC0"):"rgba(255,255,255,.1)",
                            color:d.modalidade===m.id?(m.id==="CBU"?"#f87171":m.id==="SKD"?"#fbbf24":"#93c5fd"):"#7a90b0"}}>
                          {m.id}
                        </button>
                      ))}
                    </div>
                    <div style={{fontSize:9,color:"#5a6a84",marginTop:4}}>{MODALIDADES.find(m=>m.id===d.modalidade)?.desc}</div>
                    {d.modalidade==="SKD"&&(
                      <div style={{marginTop:6,padding:"8px 10px",background:"rgba(217,119,6,.1)",border:"1px solid rgba(217,119,6,.3)",borderRadius:4,fontSize:10,color:"#fbbf24",lineHeight:1.5}}>
                        ⚠️ <strong>SKD — confira o II:</strong> a alíquota de Imposto de Importação da placa pode ser diferente da do produto acabado. Verifique o NCM da placa e ajuste o campo II na aba Importação.
                      </div>
                    )}
                    {d.modalidade==="CBU"&&(
                      <div style={{marginTop:6,padding:"8px 10px",borderRadius:4,fontSize:10,lineHeight:1.5,
                        background: iiStatus==="ok"?"rgba(5,150,105,.1)":iiStatus==="err"?"rgba(220,38,38,.1)":"rgba(60,219,192,.08)",
                        border:`1px solid ${iiStatus==="ok"?"rgba(5,150,105,.3)":iiStatus==="err"?"rgba(220,38,38,.3)":"rgba(60,219,192,.2)"}`,
                        color: iiStatus==="ok"?"#34d399":iiStatus==="err"?"#f87171":"#93c5fd"}}>
                        {iiStatus==="ok"&&`✓ II preenchido automaticamente (${n3(d.aliqII)}%) pela tabela TEC — confira na aba Importação.`}
                        {iiStatus==="err"&&"⚠️ NCM não encontrado na tabela TEC local. Preencha o II manualmente na aba Importação."}
                        {!iiStatus&&"ℹ️ Selecione o produto para preencher o II automaticamente."}
                      </div>
                    )}
                  </div>
                  {/* Atributos calculados */}
                  <div className="pgrid" style={{marginTop:6}}>
                    {[["NCM",prod.ncm],["UF Origem",prodAtrib.uf],["IPI",pct(prodAtrib.ipi)],
                      ["P/C Base",prodAtrib.pcBase==="zmf"?"ZFM":pct(+prodAtrib.pcBase)],
                      ["ICMS NF",pct(prodAtrib.icms)],["Cred.Pres.",pct(prodAtrib.cred)],
                      ["MVA",prod.mva>0?pct(prod.mva):"N/A"],["FTI/UEA",prodAtrib.fti>0?pct(prodAtrib.fti):"--"],
                    ].map(([l,v])=>(
                      <div key={l} className="pchip"><span className="pcl">{l}</span><span className="pcv">{v}</span></div>
                    ))}
                  </div>
                  {isCBU&&(
                    <div style={{marginTop:6}}>
                      <Box t="warn">CBU — PPB desabilitado. ICMS importação pela UF do importador.</Box>
                      <Field label="Diferimento ICMS importação" sfx="%" value={d.icmsDiferimento||0} onChange={S("icmsDiferimento")} hint="0% = sem diferimento / 100% = diferimento total"/>
                    </div>
                  )}
                </Sec>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {isZFM&&prodAtrib.pcBase==="zmf"?(
              <Sec title="P/C ZFM — Regime do Comprador" tag="Lei 10.637/02">
                <Box t="blue">Regime do COMPRADOR determina a aliquota de P/C debitada pelo vendedor.</Box>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {PC_ZFM.map(e=>(
                    <div key={e.k} className={`zmfi ${d.pcZfmKey===e.k?"sel":""}`} onClick={()=>setD(p=>({...p,pcZfmKey:e.k}))}>
                      <div className={`rdot ${d.pcZfmKey===e.k?"on":""}`}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:10,fontWeight:600,color:d.pcZfmKey===e.k?"#93c5fd":"#94a3b8"}}>{e.label}</div>
                        <div style={{fontSize:9,color:"#475569",marginTop:2}}>{e.sub}</div>
                        <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:10,fontWeight:700,color:d.pcZfmKey===e.k?"#3CDBC0":"#2bc4ab",marginTop:3}}>
                          {e.pct===0?"Nao incidencia":pct(e.pct)+" debito vendedor"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Box t="gray"><em>{pcEntry.base}</em></Box>
              </Sec>
            ):(
              <Sec title="Regime do Vendedor" tag="P/C Saida">
                <Box t="gray">Para produtos fora da ZFM, o regime do vendedor determina a aliquota de P/C.</Box>
                <RG val={d.regimeVendedor} onChange={S("regimeVendedor")}
                  opts={[{v:"real",l:"Lucro Real — 9,25%"},{v:"presumido",l:"Lucro Presumido — 3,65%"}]}/>
              </Sec>
            )}
                <Sec title="Perfil do Comprador" tag="ICMS / DIFAL">
                  <RG label="Tipo de contribuinte" val={d.tipoComprador} onChange={S("tipoComprador")}
                    opts={[{v:"contrib",l:"Contribuinte ICMS"},{v:"naocontrib",l:"Nao-contribuinte"}]}/>
                  {d.tipoComprador==="contrib"&&(
                    <RG label="Destinacao" val={d.destinacaoCliente} onChange={S("destinacaoCliente")}
                      opts={[{v:"revenda",l:"Revenda"},{v:"imobilizado",l:"Ativo Imobilizado"}]}/>
                  )}
                  <Box t={c.difal>0?"warn":"ok"}>
                    {d.tipoComprador==="naocontrib"?"Nao-contribuinte: vendedor recolhe DIFAL (EC 87/2015)."
                      :d.destinacaoCliente==="imobilizado"?"Ativo imobilizado: vendedor recolhe DIFAL."
                      :"Revenda para contribuinte: DIFAL e responsabilidade do destinatario."}
                  </Box>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                    <span style={{fontSize:12,fontWeight:600,color:"#f0f0f0"}}>UF Destino</span>
                    <select className="fsel" value={d.ufDestino} onChange={e=>S("ufDestino")(e.target.value)}>
                      {UFS.map(u=><option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <DR label={`ICMS ${c.ufO} -> ${d.ufDestino}`} value={pct(c.aliqInter)} bold/>
                  <DR label={`ICMS interna ${d.ufDestino}`} value={pct(c.aliqDest)}/>
                  {c.difal>0&&<DR label={`DIFAL (${c.ufO}->${d.ufDestino})`} value={pct(c.difal)} accent="red" bold/>}
                  {c.deveDifal&&prodAtrib.aliqST>0&&c.difal===0&&(
                    <Box t="ok">DIFAL zerado: ST cobre.</Box>
                  )}
                </Sec>
              </div>
            </div>
          </>}

          {tab==="importacao"&&<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <Sec title="FOB + Frete" tag="USD → BRL">
                  <Box t="blue">CFR = FOB + Frete. Convertido pelo Dólar Custo.</Box>
                  <Field label="FOB" sfx="USD" value={d.fobUSD} onChange={S("fobUSD")}/>
                  <Field label="Frete Internacional" sfx="USD" value={d.freteUSD}
                    onChange={calcs.frete.applied?undefined:S("freteUSD")}
                    locked={calcs.frete.applied} onUnlock={()=>SC("frete")({applied:false})}
                    action={<button className={`cbtn ${calcs.frete.applied?"cactive":""}`}
                      title="Frete ponderado" onClick={()=>setModal("frete")}>+/-</button>}/>
                  <DR label="CFR (FOB+Frete)" value={usd(c.cfrUSD)} bold/>
                  <div className="cvres">
                    <span>CFR em BRL <span style={{fontSize:9,color:"#5a6a84"}}>× {n3(d.ptax)}</span></span>
                    <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,color:"#3CDBC0"}}>{brl(c.cfrBRL)}</span>
                  </div>
                </Sec>
                {isZFM&&<Sec title="Isenções ZFM" tag="Lei 8.387/91">
                  <Box t="ok">{"IPI = 0% · ICMS = 0% · PIS/COFINS Suspenso"}</Box>
                </Sec>}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <Sec title="Encargos de Importação" tag="II + Despesas">
                  <Field label="Alíquota II (TEC)" sfx="%" value={d.aliqII} onChange={S("aliqII")}
                    note={isZFM?"II incide mesmo na ZFM":undefined}/>
                  <DR label="II sobre CFR" value={brl(c.iiV)} accent="red"/>
                  <Field label={`Seguro (${sfxM})`} sfx={sfxM} value={toDisp(d.seguroBRL)} onChange={v=>S("seguroBRL")(toStore(v))}/>
                  <div className="desp-row">
                    <span style={{fontSize:11,fontWeight:600,color:"#f0f0f0"}}>Despesas Imp.</span>
                    <div className="desp-modes">
                      <button className={`rgb ${d.despesasModo==="pct"?"on":""}`} style={{padding:"3px 8px",fontSize:9}} onClick={()=>S("despesasModo")("pct")}>% CFR</button>
                      <button className={`rgb ${d.despesasModo==="manual"?"on":""}`} style={{padding:"3px 8px",fontSize:9}} onClick={()=>S("despesasModo")("manual")}>{sfxM}</button>
                    </div>
                  </div>
                  {d.despesasModo==="pct"
                    ?<><Field label="% sobre CFR" sfx="%" value={d.despesasPct} onChange={S("despesasPct")} hint="SISCOMEX+Despachante+Armazenagem"/>
                       <div className="pbase"><span>Despesas</span><span>{brl(c.despesas)}</span></div></>
                    :<Field label={`Despesas (${sfxM})`} sfx={sfxM} value={toDisp(d.despesas)} onChange={v=>S("despesas")(toStore(v))} hint="SISCOMEX+Despachante"/>
                  }
                </Sec>
                <Sec title="CF Importação" tag="→ VPL">
                  <Field label={`CF Importação (${sfxM})`} sfx={sfxM} value={toDisp(d.cfImp)}
                    onChange={calcs.cfImp.applied?undefined:v=>S("cfImp")(toStore(v))}
                    locked={calcs.cfImp.applied} onUnlock={()=>SC("cfImp")({applied:false})}
                    hint="Juros/IOF — entra no VPL"
                    action={<button className={`cbtn ${calcs.cfImp.applied?"cactive":""}`}
                      title="Calcular CF" onClick={()=>setModal("cfImp")}>$</button>}/>
                  <DR label="CMV Importação" value={brl(c.cmvImp)} bold sep/>
                  <DR label="VPL" value={brl(c.vpl)} bold accent="blue"/>
                </Sec>
              </div>
            </div>
          </>}

          {tab==="ppb"&&<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <Sec title="Itens de PPB" tag="Processo Produtivo">
                  {isCBU
                    ? <Box t="warn">Modalidade CBU — produto acabado importado. PPB não se aplica.</Box>
                    : <>
                  <Box t="blue">Marque os itens do PPB. Incorporados ao CMV e VPL.</Box>
                  {PPB_ITEMS.map(item=>(
                    <div key={item.id} className="ppbi">
                      <label className="ppbc">
                        <input type="checkbox" checked={d.ppbAtivos[item.id]||false}
                          onChange={e=>setD(p=>({...p,ppbAtivos:{...p.ppbAtivos,[item.id]:e.target.checked}}))}/>
                        <span className="ppbcb"/>
                        <span style={{fontSize:11,fontWeight:600,color:d.ppbAtivos[item.id]?"#93c5fd":"#64748b",flex:1}}>{item.label}</span>
                        {item.id==="placa"&&<button className="cbtn" onClick={e=>{e.preventDefault();setModal("pcb");}}>PCB</button>}
                      </label>
                      {d.ppbAtivos[item.id]&&(
                        <div style={{padding:"6px 10px",borderTop:"1px solid rgba(255,255,255,.08)",background:"#201f1e"}}>
                          <Field label="Custo unitario" sfx={sfxM} value={toDisp(d.ppbVals[item.id]||0)}
                            onChange={v=>setD(p=>({...p,ppbVals:{...p.ppbVals,[item.id]:toStore(v)}}))}/>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="ppbtot"><span>Total PPB</span><span>{brl(ppbTot)}</span></div>
                  </>}
                </Sec>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {isZFM&&<Sec title="FTI / UEA-AM" tag="Fundo Tecnologico">
                  <Tog label={`FTI/UEA-AM ativo (${prodAtrib.fti>0?pct(prodAtrib.fti):"0% — N/A"})`}
                    val={d.ftiAtivo} onChange={S("ftiAtivo")} hint="1% faturamento bruto + 10% credito estimulo"/>
                  {prodAtrib.fti===0&&d.ftiAtivo&&<Box t="warn">Produto sem FTI/UEA-AM na PLAN_TRIB.</Box>}
                </Sec>}
                <Sec title="Resumo PPB" hl>
                  <DR label="Total PPB" value={brl(ppbTot)} bold accent="blue"/>
                  <DR label="VPL (com PPB)" value={brl(c.vpl)} bold accent="blue" sep/>
                  {/* CRA / Crédito Federal — depende da origem */}
                  {!isCBU&&<>
                    <div style={{borderTop:"1px solid rgba(255,255,255,.06)",marginTop:6,paddingTop:6}}>
                      <Field label={`${d.origem==="IOS"?"Crédito Federal":"CRA / Créditos"} (${sfxM})`}
                        sfx={sfxM} value={toDisp(d.cra)} onChange={v=>S("cra")(toStore(v))}
                        hint={d.origem==="IOS"?"(-IPI+ICMS×7,3%)×base×(1+CL%)":"% CL × II"}
                        action={<button className={`cbtn${d.cra?d.ptax>0&&Math.abs(d.cra)>0?" cactive":"":""}`}
                          title={d.origem==="IOS"?"Calcular Crédito Federal":"Calcular CRA"}
                          onClick={()=>setModal("cra")}>$</button>}/>
                      {d.cra!==0&&<DR label="VPL (com crédito)" value={brl(c.vpl)} bold accent="blue"/>}
                    </div>
                  </>}
                </Sec>
              </div>
            </div>
          </>}

          {tab==="vpl"&&<>
            {/* Card VPL — modo de custo base */}
            <div style={{background:"#1a1918",border:"1px solid rgba(60,219,192,.3)",borderRadius:6,padding:"14px 16px",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:9,fontWeight:700,letterSpacing:2,color:"#A7A8AA",textTransform:"uppercase"}}>VPL — Valor de Pauta de Lote</div>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:700,color:"#3CDBC0",marginTop:2}}>
                    {brl(d.vplModo==="estimado"?c.vplEstimado:d.vplModo==="manual"?(d.vplManual||0):(produtoDB?.vpl_padrao||0))}
                  </div>
                </div>
                <div style={{display:"flex",gap:4}}>
                  {[["cadastrado","Cadastrado","#7c3aed"],["manual","Manual","#d97706"],["estimado","Estimado","#0047BB"]].map(([modo,label,cor])=>(
                    <button key={modo} onClick={()=>S("vplModo")(modo)}
                      style={{padding:"5px 12px",fontSize:10,fontWeight:700,borderRadius:4,border:"1px solid",cursor:"pointer",transition:".15s",letterSpacing:.3,
                        background:d.vplModo===modo?cor:"rgba(255,255,255,.04)",
                        borderColor:d.vplModo===modo?cor:"rgba(255,255,255,.1)",
                        color:d.vplModo===modo?"#fff":"#7a90b0"}}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {d.vplModo==="cadastrado"&&(
                produtoDB&&(produtoDB.vpl_padrao||0)>0
                  ?<div style={{fontSize:11,color:"#34d399"}}>✓ VPL cadastrado para este produto: {brl(produtoDB.vpl_padrao)}</div>
                  :<div style={{fontSize:11,color:"#f87171"}}>⚠ Produto sem VPL cadastrado — acesse o Cadastro de Produtos para configurar.</div>
              )}
              {d.vplModo==="manual"&&(
                <div style={{display:"flex",alignItems:"center",gap:10,marginTop:4}}>
                  <span style={{fontSize:11,color:"#A7A8AA",flexShrink:0}}>VPL Manual (R$)</span>
                  <input type="number" step="0.01" value={d.vplManual||0} onChange={e=>S("vplManual")(parseFloat(e.target.value)||0)}
                    style={{background:"#2C2A29",border:"1px solid rgba(255,255,255,.15)",color:"#f1f5f9",padding:"5px 10px",fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:600,outline:"none",width:160,borderRadius:3}}/>
                </div>
              )}
              {d.vplModo==="estimado"&&(
                <div style={{fontSize:11,color:"#A7A8AA"}}>Calculado a partir dos dados de Importação e PPB (abas visíveis acima).</div>
              )}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <Sec title="Custos de Produção" tag="R$">
                  <Field label="Produção / Montagem" sfx="R$" value={d.producao} onChange={S("producao")}/>
                  <Field label="Embalagem" sfx="R$" value={d.embalagem||0} onChange={S("embalagem")}/>
                  <Field label="Outros Custos" sfx="R$" value={d.outrosBRL} onChange={S("outrosBRL")}/>
                </Sec>
                <Sec title="Garantia + BKP — Custódia" tag="% sobre VPL" hl>
                  <DR label="VPL + Embalagem + Outros (base BKP)" value={brl(c.vpl+(d.embalagem||0)+d.outrosBRL)} bold accent="blue"/>
                  <Field label="Garantia" sfx="R$" value={d.garantia} onChange={S("garantia")}/>
                  <Field label="BKP (%)" sfx="%" value={d.bkpPct} onChange={S("bkpPct")}
                    hint={d.bkpPct===0&&c.bkpPad>0?`Padrão produto: ${c.bkpPad}%`:`= ${brl(c.bkpV)}`}/>
                  <DR label="BKP (R$)" value={brl(c.bkpV)} accent="blue"/>
                </Sec>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <Sec title="Resumo Custos" hl>
                  <DR label="CMV Importação" value={brl(c.cmvImp)}/>
                  {ppbTot>0&&<DR label="PPB" value={brl(ppbTot)}/>}
                  <DR label="Produção / Montagem" value={brl(d.producao)}/>
                  <DR label="Embalagem" value={brl(d.embalagem||0)}/>
                  <DR label="Outros Custos" value={brl(d.outrosBRL)}/>
                  <DR label="Garantia" value={brl(d.garantia)}/>
                  <DR label="BKP" value={brl(c.bkpV)}/>
                  <DR label="CMV Total" value={brl(c.cmvTotal)} bold sep accent="blue"/>
                </Sec>
              </div>
            </div>
          </>}

          {tab==="indices"&&<>
            {/* ── Botão Aplicar Padrões ────────────────────────────────────── */}
            {(c.cfixoPad||c.royalPad||c.scrapPad||c.fretePad||c.bkpPad||c.pdPad)>0&&(
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",
                background:"rgba(60,219,192,.08)",border:"1px solid rgba(60,219,192,.25)",
                borderRadius:6,marginBottom:4}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#3CDBC0"}}>Padrões disponíveis para este produto</div>
                  <div style={{fontSize:9,color:"#5a6a84",fontFamily:"'Montserrat',sans-serif",marginTop:2}}>
                    {[c.cfixoPad&&`CF ${c.cfixoPad}%`,!isCBU&&c.pdPad&&`P&D ${c.pdPad}%`,c.scrapPad&&`Scrap ${c.scrapPad}%`,
                      c.fretePad&&`Frete ${c.fretePad}%`,c.royalPad&&`Royal ${c.royalPad}%`,c.bkpPad&&`BKP ${c.bkpPad}%`
                    ].filter(Boolean).join("  ·  ")}
                  </div>
                </div>
                <button onClick={()=>setD(p=>({...p,
                  cfixo: c.cfixoPad||p.cfixo,
                  pd:    (!isCBU&&c.pdPad)?c.pdPad:p.pd,
                  scrap: c.scrapPad||p.scrap,
                  frete: c.fretePad||p.frete,
                  royal: c.royalPad||p.royal,
                  bkpPct:c.bkpPad||p.bkpPct,
                  pdd:   p.pdd||2.5,
                }))}
                  style={{padding:"6px 14px",fontSize:10,fontWeight:700,cursor:"pointer",borderRadius:20,
                    border:"1px solid rgba(60,219,192,.5)",background:"rgba(60,219,192,.15)",
                    color:"#3CDBC0",whiteSpace:"nowrap",flexShrink:0}}>
                  ⚡ Aplicar Padrões
                </button>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <Sec title="Índices Gerais" tag="% s/ preço">
                <Box t="gray">Calculados por dentro do preço de venda.</Box>
                <Field label="P&D" value={d.pd} onChange={S("pd")} sfx="%"
                  hint={d.pd===0&&!isCBU?`Padrão ${d.origem}: ${c.pdPad}% — ≈ ${brl(c.pF*(c.pdPad/100))}`:`≈ ${brl(c.pF*(d.pd/100))}`}/>
                <Field label="Scrap" value={d.scrap} onChange={S("scrap")} sfx="%"
                  hint={d.scrap===0&&c.scrapPad>0?`Padrão produto: ${c.scrapPad}% — ≈ ${brl(c.pF*(c.scrapPad/100))}`:`≈ ${brl(c.pF*(d.scrap/100))}`}/>
                <Field label="Frete venda" value={d.frete} onChange={S("frete")} sfx="%"
                  hint={d.frete===0&&c.fretePad>0?`Padrão produto: ${c.fretePad}% — ≈ ${brl(c.pF*(c.fretePad/100))}`:`≈ ${brl(c.pF*(d.frete/100))}`}/>
                {/* Royalties — % ou USD */}
                <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderTop:"1px solid rgba(255,255,255,.06)",marginTop:2}}>
                  <span style={{fontSize:12,fontWeight:600,color:"#f0f0f0",flex:1}}>Royalties / Qualcomm</span>
                  <button onClick={()=>S("royalModo")(d.royalModo==="usd"?"pct":"usd")}
                    style={{padding:"2px 8px",fontSize:9,fontWeight:700,cursor:"pointer",borderRadius:20,border:"1px solid",
                      background:d.royalModo==="usd"?"rgba(60,219,192,.2)":"rgba(255,255,255,.05)",
                      borderColor:d.royalModo==="usd"?"rgba(60,219,192,.5)":"rgba(255,255,255,.12)",
                      color:d.royalModo==="usd"?"#93c5fd":"#7a90b0"}}>
                    {d.royalModo==="usd"?"USD":"% "}
                  </button>
                </div>
                {d.royalModo==="usd"?(
                  <Field label="Royalties (USD)" sfx="USD"
                    value={d.royalUSD||0}
                    onChange={v=>{const pct=c.pSI>0?(v*d.ptax/c.pSI)*100:0;setD(p=>({...p,royalUSD:+v,royal:+pct.toFixed(4)}));}}
                    hint={`≈ ${brl((d.royalUSD||0)*d.ptax)} — ${n3(d.royal)}%`}/>
                ):(
                  <Field label="Royalties %" sfx="%" value={d.royal}
                    onChange={v=>{S("royal")(v);setD(p=>({...p,royalUSD:0}));}}
                    hint={d.royal===0&&c.royalPad>0?`Padrão produto: ${c.royalPad}% — ≈ ${brl(c.pF*(c.royalPad/100))}`:`≈ ${brl(c.ryV)}`}/>
                )}
                {/* Margem Gerencial / Agnóstica — sempre na ML */}
                <div style={{borderTop:"1px solid rgba(255,255,255,.06)",marginTop:4,paddingTop:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:600,color:"#f0f0f0",flex:1}}>Margem Gerencial / Agnóstica</span>
                    <div className="fw" style={{minWidth:110}}>
                      <span className="fpre">%</span>
                      <input type="number" step="0.01"
                        value={d.margGer}
                        onChange={e=>{const v=e.target.value;if(v==="-"||v==="")S("margGer")(v===""?0:v);else{const n=parseFloat(v);if(!isNaN(n))S("margGer")(n);}}}
                        style={{background:"none",border:"none",outline:"none",fontFamily:"'Montserrat',sans-serif",
                          fontSize:11,fontWeight:500,color:d.margGer<0?"#f87171":"#a8b5cc",padding:"5px 8px",width:80,textAlign:"right"}}/>
                    </div>
                  </div>
                </div>
              </Sec>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <Sec title="Índices Comerciais" tag="% s/ preço">
                {/* Preset de canal — auto-preenche comis/mkt/rebate/pdd/vpc */}
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <span style={{fontSize:11,fontWeight:600,color:"#A7A8AA"}}>Canal Padrão</span>
                  <select
                    value={d.canalId||""}
                    onChange={e=>{
                      const canal=CANAIS.find(c=>c.id===e.target.value);
                      if(!canal||!canal.default){setD(p=>({...p,canalId:e.target.value}));return;}
                      const rates=getCanalRates(e.target.value, prodAtrib.cat||"");
                      setD(p=>({...p,canalId:canal.id,comis:rates.comis,mkt:rates.mkt,rebate:rates.rebate,pdd:rates.pdd,vpc:rates.vpc}));
                    }}
                    style={{background:"#1a1a1a",border:"1px solid rgba(255,255,255,.12)",borderRadius:4,
                      color:"#e2e8f0",fontSize:11,padding:"5px 8px",cursor:"pointer",outline:"none"}}>
                    {CANAIS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  {d.canalId&&<span style={{fontSize:9,color:"#5a6a84",fontFamily:"'Montserrat',sans-serif"}}>
                    {(()=>{const cat=CATS.find(c=>c.id===prodAtrib.cat);return cat?`Taxas: ${cat.label} — edite abaixo para ajustar`:"Campos preenchidos — edite abaixo para ajustar";})()}
                  </span>}
                </div>
                <Field label="CF Venda" sfx="%" value={d.cfVenda}
                  onChange={calcs.cfVenda.applied?undefined:S("cfVenda")}
                  locked={calcs.cfVenda.applied} onUnlock={()=>SC("cfVenda")({applied:false})}
                  hint={calcs.cfVenda.applied?`${calcs.cfVenda.prazo}d @ ${calcs.cfVenda.taxa}%`:`≈ ${brl(c.cfnV)}`}
                  action={<button className={`cbtn ${calcs.cfVenda.applied?"cactive":""}`}
                    title="Calcular CF venda" onClick={()=>setModal("cfVenda")}>%</button>}/>
                {/* Toggle taxa cartão */}
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderTop:"1px solid rgba(255,255,255,.06)"}}>
                  <button onClick={()=>S("cartaoAtivo")(!d.cartaoAtivo)}
                    style={{padding:"2px 8px",fontSize:9,fontWeight:700,cursor:"pointer",borderRadius:20,border:"1px solid",transition:".15s",
                      background:d.cartaoAtivo?"rgba(251,191,36,.2)":"rgba(255,255,255,.05)",
                      borderColor:d.cartaoAtivo?"rgba(251,191,36,.5)":"rgba(255,255,255,.12)",
                      color:d.cartaoAtivo?"#fbbf24":"#7a90b0"}}>
                    {d.cartaoAtivo?"● ON":"○ OFF"}
                  </button>
                  <span style={{fontSize:11,fontWeight:600,color:d.cartaoAtivo?"#fbbf24":"#5a6a84",flex:1}}>Taxa Cartão (+2%)</span>
                  {d.cartaoAtivo&&<span style={{fontFamily:"'Montserrat',sans-serif",fontSize:10,color:"#fbbf24"}}>{pct(c.cfVendaEf)}</span>}
                </div>
                {[["Comissão","comis"],["Marketing","mkt"],["Rebate","rebate"],["Verba Extra","vbExtra"],["VPC","vpc"]
                ].map(([l,k])=>(
                  <Field key={k} label={l} value={d[k]||0} onChange={S(k)} sfx="%" hint={`≈ ${brl(c.pF*((d[k]||0)/100))}`}/>
                ))}
                <Field label="PDD" value={d.pdd||0} onChange={S("pdd")} sfx="%"
                  hint={(d.pdd||0)===0?`Padrão: 2,5% — ≈ ${brl(c.pF*0.025)}`:`≈ ${brl(c.pF*((d.pdd||0)/100))}`}/>
                <div style={{display:"flex",alignItems:"flex-start",gap:8,justifyContent:"space-between"}}>
                  <div style={{flex:1}}>
                    <span style={{fontSize:12,fontWeight:600,color:"#f0f0f0"}}>Encargos s/ comissões</span>
                    <div style={{fontSize:10,color:"#A7A8AA",fontFamily:"'Montserrat',sans-serif"}}>{pct(c.comisXPct)} (auto)</div>
                  </div>
                  <div className="fw fro" style={{minWidth:100}}>
                    <span className="fpre">%</span>
                    <input readOnly value={String(+(c.comisXPct||0).toFixed(3)).replace(".",",")}
                      style={{background:"none",border:"none",outline:"none",fontFamily:"'Montserrat',sans-serif",fontSize:11,color:"#94a3b8",padding:"5px 8px",width:70,textAlign:"right"}}/>
                  </div>
                </div>
                <DR label="Total Índices" value={pct(c.indPct)} bold sep accent="blue"/>
              </Sec>
              </div>
            </div>
          </>}

          {tab==="venda"&&<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <Sec title="Impostos de Venda" tag="PLAN_TRIB auto">
                  <Box t="blue">Alíquotas carregadas do catálogo PLAN_TRIB 09/02/2026.</Box>
                  <div className="txgrid">
                    {[
                      ["IPI Saída",pct(prodAtrib.ipi),prodAtrib.ipi===0],
                      ["P/C Debito",c.pcLabel,false],
                      ["P/C Ef. (base liq.)",pct(c.pcEf),false],
                      ["ICMS Destacado NF",pct(c.aliqInter),false],
                      ["Cred. Presumido",pct(prodAtrib.cred),true],
                      ["ICMS Custo Efetivo",pct(c.icmsEfPct),c.icmsEfPct===0],
                      ["DIFAL",c.difal>0?pct(c.difal):"0% — N/A",c.difal===0],
                    ].map(([l,v,ok])=>(
                      <div key={l} className={`txc ${ok?"txok":"txon"}`}>
                        <div className="txl">{l}</div><div className="txv">{v}</div>
                      </div>
                    ))}
                    {c.ipiCreditoIOSPct>0&&(
                      <div className="txc txok">
                        <div className="txl">Crédito IPI IOS (12,97%÷1+IPI)</div>
                        <div className="txv">-{pct(c.ipiCreditoIOSPct)}</div>
                      </div>
                    )}
                    {c.ftiPct>0&&<div className="txc txon"><div className="txl">FTI/UEA-AM</div><div className="txv">{pct(c.ftiPct)}</div></div>}
                    {c.fcpPct>0&&<div className="txc txwn"><div className="txl">Fundo Pobreza {d.ufDestino}</div><div className="txv">{pct(c.fcpPct)}</div></div>}
                  </div>
                </Sec>
                <Sec title="Custo Fixo" tag="% s/ preço">
                  <Box t="gray">CF compõe a MC junto com a ML. MC = ML + CF</Box>
                  <Field label="Custo Fixo" value={d.cfixo} onChange={S("cfixo")} sfx="%"
                    hint={d.cfixo===0&&c.cfixoPad>0?`Padrão categoria: ${c.cfixoPad}% — ≈ ${brl(c.pF*(c.cfixoPad/100))}`:`≈ ${brl(c.cfxV)}`}/>
                </Sec>
                <Sec title="Margem Líquida (ML)" hl>
                  {/* Toggle modo de cálculo */}
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,padding:"6px 10px",background:"rgba(255,255,255,.03)",borderRadius:6,border:"1px solid rgba(255,255,255,.08)"}}>
                    <span style={{fontSize:10,fontWeight:700,color:"#5a6a84",flex:1,textTransform:"uppercase",letterSpacing:.5}}>Calcular</span>
                    <button onClick={()=>S("modoCalc")("preco")}
                      style={{padding:"4px 12px",fontSize:10,fontWeight:700,cursor:"pointer",borderRadius:20,border:"1px solid",transition:".15s",
                        background:d.modoCalc==="preco"?"rgba(60,219,192,.3)":"rgba(255,255,255,.04)",
                        borderColor:d.modoCalc==="preco"?"#3CDBC0":"rgba(255,255,255,.1)",
                        color:d.modoCalc==="preco"?"#93c5fd":"#7a90b0"}}>
                      Preço
                    </button>
                    <span style={{color:"#5a6a84",fontSize:12}}>⇄</span>
                    <button onClick={()=>S("modoCalc")("margem")}
                      style={{padding:"4px 12px",fontSize:10,fontWeight:700,cursor:"pointer",borderRadius:20,border:"1px solid",transition:".15s",
                        background:d.modoCalc==="margem"?"rgba(5,150,105,.3)":"rgba(255,255,255,.04)",
                        borderColor:d.modoCalc==="margem"?"#059669":"rgba(255,255,255,.1)",
                        color:d.modoCalc==="margem"?"#34d399":"#7a90b0"}}>
                      Margem
                    </button>
                  </div>
                  {/* Campo ML — habilitado só no modo Preço */}
                  <div style={{opacity:d.modoCalc==="preco"?1:.4,pointerEvents:d.modoCalc==="preco"?"auto":"none"}}>
                    <Field label="Margem Líquida desejada" value={d.margem} onChange={S("margem")} sfx="%" hint="% por dentro do preço"/>
                  </div>
                  {/* Campo Preço Sugerido — habilitado só no modo Margem */}
                  <div style={{opacity:d.modoCalc==="margem"?1:.4,pointerEvents:d.modoCalc==="margem"?"auto":"none",marginTop:4}}>
                    <Field label="Preço sugerido (c/ IPI)" sfx="R$" value={d.precoSugerido||""} onChange={v=>S("precoSugerido")(parseFloat(String(v).replace(",","."))||0)}
                      hint={d.modoCalc==="margem"&&c.mcSugerida!==null?`MC resultante: ${n3(c.mcSugerida)}%`:"informe o preço para calcular a MC"}/>
                    {d.modoCalc==="margem"&&c.mcSugerida!==null&&(
                      <div style={{fontSize:11,fontFamily:"'Montserrat',sans-serif",color:"#4ade80",textAlign:"right",marginTop:2}}>
                        MC = {n3(c.mcSugerida)}%
                      </div>
                    )}
                  </div>
                  {/* Toggle: impactar MC com Margem Gerencial/Agnóstica */}
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderTop:"1px solid rgba(255,255,255,.06)",marginTop:4}}>
                    <button onClick={()=>S("margGerAtivo")(!d.margGerAtivo)}
                      style={{padding:"3px 10px",fontSize:10,fontWeight:700,fontFamily:"'Montserrat',sans-serif",
                        letterSpacing:.4,cursor:"pointer",borderRadius:20,border:"1px solid",transition:".15s",
                        background:d.margGerAtivo?"rgba(251,191,36,.2)":"rgba(255,255,255,.05)",
                        borderColor:d.margGerAtivo?"rgba(251,191,36,.5)":"rgba(255,255,255,.12)",
                        color:d.margGerAtivo?"#fbbf24":"#7a90b0"}}>
                      {d.margGerAtivo?"● ON":"○ OFF"}
                    </button>
                    <span style={{fontSize:11,fontWeight:600,color:d.margGerAtivo?"#fbbf24":"#5a6a84",flex:1}}>Impactar MC com Margem Gerencial/Agnóstica</span>
                  </div>
                  <DR label={`MC = ML + CF${d.margGerAtivo&&d.margGer!==0?" + Margem Gerencial/Agnóstica":""}`} value={pct(c.mc)} bold accent="blue"/>
                  <DR label="Markup s/ CMV" value={`${n3(c.mkp)}x`} accent="blue"/>
                </Sec>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <Sec title="P/C — Cálculo Efetivo" hl>
                  <Box t="blue">{"P/C efetivo = P/C nominal × (1 − ICMS% − DIFAL%)"}</Box>
                  <DR label="P/C nominal (debito)" value={pct(c.pcPct)}/>
                  <DR label={`(-) ICMS destacado — ${pct(c.aliqInter)}`} value={`(${pct(c.pcBaseRedPct)})`} accent="green"/>
                  {c.difal>0&&<DR label={`(-) DIFAL — ${pct(c.difal)}`} value={`(${pct(c.pcPct*c.difal/100)})`} accent="green"/>}
                  <DR label={`P/C efetivo (${pct(c.pcEf)})`} value={brl(c.pcV)} bold accent="blue" sep/>
                  {c.pcSubvPct>0.001&&<>
                    <DR label={`P/C subvenção: 9,25%×${pct(prodAtrib.cred)}`} value={pct(c.pcSubvPct)} accent="red"/>
                    <Box t="warn">{`P/C subvenção (${pct(c.pcSubvPct)}) = CUSTO sobre crédito presumido.`}</Box>
                  </>}
                </Sec>
                <Sec title="ICMS: Destacado x Efetivo">
                  <DR label={`ICMS destacado NF (${c.ufO}→${d.ufDestino})`} value={pct(c.aliqInter)}/>
                  <DR label={`(-) Crédito presumido`} value={`(${pct(prodAtrib.cred)})`} accent="green"/>
                  <DR label="ICMS custo efetivo" value={pct(c.icmsEfPct)} bold accent={c.icmsEfPct===0?"green":"warn"} sep/>
                  <Box t={c.icmsEfPct===0?"ok":"warn"}>
                    {c.icmsEfPct===0?`Crédito absorve ICMS. Custo = 0%.`:`Residual: ${pct(c.icmsEfPct)}.`}
                  </Box>
                </Sec>
              </div>
            </div>
          </>}

          {tab==="st"&&<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <Sec title="Substituição Tributária" tag="ICMS-ST">
                  <Tog label="Aplicar ICMS-ST" val={d.stAtivo} onChange={S("stAtivo")}/>
                  <Box t="gray">{"Base ST = Preco c/IPI x (1+MVA) | ST = Base x aliq.dest - ICMS proprio"}</Box>
                  {d.stAtivo&&<>
                    <Field label="MVA Original" value={d.mva} onChange={S("mva")} sfx="%" hint="Protocolo/Convênio ICMS"/>
                    <Field label="Aliq. Interna Destino (ST)" value={d.icmsDestST} onChange={S("icmsDestST")} sfx="%"/>
                  </>}
                </Sec>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {d.stAtivo&&<Sec title="Resultado ST" hl>
                  <DR label="Base ST" value={brl(c.stBase)}/>
                  <DR label="ICMS-ST" value={brl(c.stV)} bold accent="blue"/>
                  <DR label="Preço c/ ST" value={brl(c.pCI+c.stV)} bold sep accent="blue"/>
                </Sec>}
                {!d.stAtivo&&<Sec title="ST não aplicado">
                  <Box t="gray">Ative a ST ao lado para calcular.</Box>
                </Sec>}
              </div>
            </div>
          </>}

          </div>
        </main>
      </div>
    </div>
    </>
  );
}

function RevCalc({precoAlvo,onChange,c,margem}){
  const [raw,setRaw]=useState(precoAlvo===0?"":String(precoAlvo).replace(".",","));
  const mr=c.mcAlvo; // MC como referência principal
  return(
    <div className="rcard">
      <div className="rlbl">PRECO ALVO -> MARGEM</div>
      <div className="rbody">
        <div className="riw">
          <span className="rpfx">R$</span>
          <input type="text" inputMode="decimal" className="ri" placeholder="Preco alvo (c/ IPI)"
            value={raw}
            onChange={e=>{const v=e.target.value;if(/^\d*[,.]?\d{0,3}$/.test(v)||v===""){setRaw(v);onChange(parse(v));}}}
            onBlur={()=>{const n=parse(raw);if(n===0)setRaw("");else setRaw(String(n).replace(".",","));}}
          />
          {precoAlvo>0&&<button className="rcl" onClick={()=>{setRaw("");onChange(0);}}>x</button>}
        </div>
        {precoAlvo>0&&mr!==null&&(
          <div className={`rres ${mr<0?"rneg":"rpos"}`}>
            <div className="rrmain"><span>MC resultante</span><span className="rrv">{pct(mr)}</span></div>
            <div className="rrsub">
              <span>Preco s/ IPI: {brl(precoAlvo/(1+c.ipi/100))}</span>
              <span style={{color:mr>=margem?"#4ade80":"#f87171"}}>{pct(Math.abs(mr-margem))} vs. margem atual ({pct(margem)})</span>
              {mr<0&&<span style={{color:"#f87171"}}>Abaixo do custo total</span>}
            </div>
          </div>
        )}
        {precoAlvo===0&&<span style={{fontFamily:"'Montserrat',sans-serif",fontSize:10,color:"#334155"}}>Informe um preco alvo (c/ IPI) para ver a margem resultante</span>}
      </div>
    </div>
  );
}

// ── CadastroProdutos ──────────────────────────────────────────────────────────
const FORM_VAZIO={
  categoria:"",ncm:"",nome:"",sku:"",
  ipi_mao:0,ipi_ios:0,ipi_cwb:0,
  cred_mao:0,cred_ios:0,cred_cwb:0,
  icms_mao:0,icms_ios:0,icms_cwb:0,
  mva:0,fti:0,aliq_st:0,
  vpl_padrao:0,producao:0,garantia:0,bkp_pct:0,embalagem:0,
  pd:0,scrap:0,royal:0,frete_venda:0,marg_ger:0,mkt:0,rebate:0,
};

const INDICES_GRUPOS=[
  {id:"impostos",label:"Impostos",icone:"🏛",campos:[
    {k:"ipi_mao",l:"IPI MAO",sfx:"%"},{k:"ipi_ios",l:"IPI IOS",sfx:"%"},{k:"ipi_cwb",l:"IPI CWB",sfx:"%"},
    {k:"cred_mao",l:"Créd. MAO",sfx:"%"},{k:"cred_ios",l:"Créd. IOS",sfx:"%"},{k:"cred_cwb",l:"Créd. CWB",sfx:"%"},
    {k:"icms_mao",l:"ICMS MAO",sfx:"%"},{k:"icms_ios",l:"ICMS IOS",sfx:"%"},{k:"icms_cwb",l:"ICMS CWB",sfx:"%"},
    {k:"mva",l:"MVA",sfx:"%"},{k:"fti",l:"FTI/UEA",sfx:"%"},{k:"aliq_st",l:"Aliq. ST",sfx:"%"},
  ]},
  {id:"vpl",label:"VPL",icone:"💰",campos:[
    {k:"vpl_padrao",l:"VPL Padrão",sfx:"R$"},
  ]},
  {id:"garantia",label:"Garantia / BKP",icone:"🛡",campos:[
    {k:"garantia",l:"Garantia",sfx:"R$"},{k:"bkp_pct",l:"BKP",sfx:"%"},
  ]},
  {id:"custos",label:"Custos Locais",icone:"🏭",campos:[
    {k:"producao",l:"Produção",sfx:"R$"},{k:"embalagem",l:"Embalagem",sfx:"R$"},
  ]},
  {id:"gerais",label:"Índices Gerais",icone:"📊",campos:[
    {k:"pd",l:"P&D",sfx:"%"},{k:"scrap",l:"Scrap",sfx:"%"},{k:"royal",l:"Royalties",sfx:"%"},{k:"frete_venda",l:"Frete Venda",sfx:"%"},
  ]},
  {id:"comerciais",label:"Índices Comerciais",icone:"📈",campos:[
    {k:"marg_ger",l:"Margem Ger.",sfx:"%"},{k:"mkt",l:"Marketing",sfx:"%"},{k:"rebate",l:"Rebate",sfx:"%"},
  ]},
];

function gerarId(prefix, existentes){
  const nums = existentes
    .map(p => parseInt(p.id.replace(prefix,""),10))
    .filter(n => !isNaN(n));
  const next = nums.length>0 ? Math.max(...nums)+1 : 1;
  return prefix + String(next).padStart(4,"0");
}

function CadastroProdutos({user}){
  const [produtos,setProdutos]     = useState([]);
  const [categorias,setCategorias] = useState([]);
  const [loading,setLoading]       = useState(true);
  const [modal,setModal]           = useState(null); // null | "novo" | "editar" | "bulk" | "solicitacao"
  const [form,setForm]             = useState(null);
  const [formId,setFormId]         = useState("");   // ID gerado automaticamente
  const [secoesAbertas,setSecoesAbertas] = useState({});
  const [busca,setBusca]           = useState("");
  const [msg,setMsg]               = useState(null);
  const [salvando,setSalvando]     = useState(false);
  const [erroForm,setErroForm]     = useState("");
  // Bulk update
  const [selecionados,setSelecionados] = useState(new Set());
  const [bulkPasso,setBulkPasso]   = useState(1); // 1=escolher indices, 2=grade
  const [bulkIndices,setBulkIndices] = useState(new Set());
  const [bulkVals,setBulkVals]     = useState({}); // {prodId: {campo: valor}}
  const [bulkSalvando,setBulkSalvando] = useState(false);
  // Solicitação categoria
  const [solForm,setSolForm]       = useState({nome_categoria:"",prefixo:"",descricao:""});
  const [solErro,setSolErro]       = useState("");
  const [solOk,setSolOk]           = useState(false);
  const [categFiltro,setCategFiltro] = useState("");

  const reload=()=>Promise.all([
    db.getProdutos().then(r=>setProdutos(r||[])),
    db.getCategorias().then(r=>setCategorias(r||[])),
  ]).finally(()=>setLoading(false));
  useEffect(()=>{reload();},[]);

  const SF=k=>e=>setForm(p=>({...p,[k]:e.target.type==="number"?parseFloat(e.target.value)||0:e.target.value}));

  const abrirNovo=()=>{
    setForm({...FORM_VAZIO});
    setFormId("");
    setSecoesAbertas({impostos:true,vpl:true,garantia:true,custos:true,gerais:true,comerciais:true});
    setErroForm("");setModal("novo");
  };

  const abrirEditar=p=>{
    setForm({...p,categoria:p.id.match(/^([A-Z]+)/)?.[1]||""});
    setFormId(p.id);
    setSecoesAbertas({});
    setErroForm("");setModal("editar");
  };

  const toggleSecao=id=>setSecoesAbertas(p=>({...p,[id]:!p[id]}));

  const handleCategoriaChange=async(cat)=>{
    setForm(p=>({...p,categoria:cat}));
    if(!cat){setFormId("");return;}
    try{
      const existentes=await db.getProdutosByPrefixo(cat);
      setFormId(gerarId(cat, existentes||[]));
    }catch{setFormId(cat+"0001");}
  };

  const salvar=async()=>{
    if(!formId){setErroForm("Selecione uma categoria.");return;}
    if(!form.ncm.trim()){setErroForm("NCM obrigatório.");return;}
    if(!form.nome.trim()){setErroForm("Nome obrigatório.");return;}
    setSalvando(true);
    const dados={...form,id:formId};
    delete dados.categoria;
    try{
      if(modal==="novo") await db.insertProduto(dados);
      else await db.updateProduto(formId,dados);
      await reload();setModal(null);
      setMsg({t:"ok",txt:"Produto salvo com sucesso."});
      setTimeout(()=>setMsg(null),3000);
    }catch(e){setErroForm(e.message);}
    finally{setSalvando(false);}
  };

  const excluir=async(id)=>{
    if(!window.confirm(`Excluir produto "${id}"?`))return;
    await db.deleteProduto(id);await reload();
    setMsg({t:"ok",txt:`Produto ${id} excluído.`});
    setTimeout(()=>setMsg(null),3000);
  };

  // ── Bulk update ──
  const toggleSel=id=>setSelecionados(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const toggleTodos=()=>setSelecionados(selecionados.size===filtrados.length?new Set():new Set(filtrados.map(p=>p.id)));
  const toggleBulkIndice=k=>setBulkIndices(p=>{const n=new Set(p);n.has(k)?n.delete(k):n.add(k);return n;});

  const abrirBulk=()=>{
    const init={};
    selecionados.forEach(pid=>{init[pid]={};});
    setBulkVals(init);setBulkIndices(new Set());setBulkPasso(1);setModal("bulk");
  };

  const salvarBulk=async()=>{
    setBulkSalvando(true);
    try{
      await Promise.all(
        [...selecionados].map(pid=>{
          const vals=bulkVals[pid]||{};
          if(Object.keys(vals).length===0)return Promise.resolve();
          return db.updateProduto(pid,vals);
        })
      );
      await reload();setModal(null);setSelecionados(new Set());
      setMsg({t:"ok",txt:"Produtos atualizados com sucesso."});
      setTimeout(()=>setMsg(null),3000);
    }catch(e){setMsg({t:"err",txt:"Erro: "+e.message});}
    finally{setBulkSalvando(false);}
  };

  // ── Solicitação de categoria ──
  const enviarSolicitacao=async()=>{
    if(!solForm.nome_categoria.trim()){setSolErro("Nome obrigatório.");return;}
    if(!solForm.prefixo.trim()||solForm.prefixo.length<2||solForm.prefixo.length>4){setSolErro("Prefixo deve ter 2-4 letras.");return;}
    const prefixo=solForm.prefixo.toUpperCase().replace(/[^A-Z]/g,"");
    try{
      await db.insertSolicitacaoCategoria({
        user_id:String(user?.id||""),
        user_nome:user?.nome||"",
        nome_categoria:solForm.nome_categoria.trim(),
        prefixo,
        descricao:solForm.descricao.trim(),
      });
      setSolOk(true);setSolErro("");
      setTimeout(()=>{setModal(null);setSolOk(false);setSolForm({nome_categoria:"",prefixo:"",descricao:""});},2500);
    }catch(e){setSolErro(e.message);}
  };

  const filtrados=produtos.filter(p=>{
    if(categFiltro&&!p.id.startsWith(categFiltro))return false;
    if(!busca)return true;
    return p.nome.toLowerCase().includes(busca.toLowerCase())||p.ncm.includes(busca)||p.id.toLowerCase().includes(busca.toLowerCase());
  });

  // categorias que têm pelo menos um produto cadastrado
  const categsComProdutos=useMemo(()=>{
    const prefixMap={};
    produtos.forEach(p=>{
      const prefix=p.id.match(/^([A-Z]+)/)?.[1]||"?";
      prefixMap[prefix]=(prefixMap[prefix]||0)+1;
    });
    return Object.entries(prefixMap)
      .map(([prefix,count])=>{
        const cat=categorias.find(c=>c.id===prefix||c.prefixo===prefix);
        return {prefix,count,nome:cat?.nome||prefix};
      })
      .sort((a,b)=>a.nome.localeCompare(b.nome));
  },[produtos,categorias]);

  // ── Componentes internos do formulário ──
  const Fn=({label,k,sfx=""})=>(
    <div style={{display:"flex",flexDirection:"column",gap:3}}>
      <label style={{fontSize:10,fontWeight:600,color:"#7a7f96",textTransform:"uppercase",letterSpacing:.6}}>{label}{sfx&&<span style={{color:"#475569",marginLeft:3}}>{sfx}</span>}</label>
      <input type="number" step="any" value={form[k]||0} onChange={SF(k)}
        style={{background:"#2C2A29",border:"1px solid rgba(255,255,255,.1)",color:"#f0f0f0",padding:"7px 10px",fontSize:13,outline:"none",fontFamily:"'Montserrat',sans-serif"}}/>
    </div>
  );
  const FnRO=({label,k,sfx=""})=>(
    <div style={{display:"flex",flexDirection:"column",gap:3}}>
      <label style={{fontSize:10,fontWeight:600,color:"#7a7f96",textTransform:"uppercase",letterSpacing:.6}}>{label}{sfx&&<span style={{color:"#475569",marginLeft:3}}>{sfx}</span>}</label>
      <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",color:"#7a7f96",padding:"7px 10px",fontSize:13,fontFamily:"'Montserrat',sans-serif",borderRadius:2}}>
        {form[k]||0}
      </div>
    </div>
  );
  const Ft=({label,k,placeholder=""})=>(
    <div style={{display:"flex",flexDirection:"column",gap:3}}>
      <label style={{fontSize:10,fontWeight:600,color:"#7a7f96",textTransform:"uppercase",letterSpacing:.6}}>{label}</label>
      <input type="text" value={form[k]||""} onChange={SF(k)} placeholder={placeholder}
        style={{background:"#2C2A29",border:"1px solid rgba(255,255,255,.1)",color:"#f0f0f0",padding:"7px 10px",fontSize:13,outline:"none"}}/>
    </div>
  );

  const SecaoToggle=({grupo})=>{
    const aberta=!!secoesAbertas[grupo.id];
    return(
      <div style={{border:"1px solid rgba(255,255,255,.07)",borderRadius:4,overflow:"hidden",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",background:"rgba(255,255,255,.03)",cursor:"pointer"}} onClick={()=>toggleSecao(grupo.id)}>
          <span style={{fontSize:12,fontWeight:700,color:"#A7A8AA",textTransform:"uppercase",letterSpacing:.8}}>{grupo.icone} {grupo.label}</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {grupo.id==="impostos"&&!aberta&&(
              <a href="https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias" target="_blank" rel="noopener noreferrer"
                onClick={e=>e.stopPropagation()}
                style={{fontSize:10,color:"#60a5fa",textDecoration:"none",padding:"2px 8px",border:"1px solid rgba(96,165,250,.3)",borderRadius:3}}>
                🔗 Consultar NCM
              </a>
            )}
            <button style={{padding:"3px 10px",background:aberta?"rgba(60,219,192,.2)":"rgba(255,255,255,.06)",border:`1px solid ${aberta?"rgba(60,219,192,.4)":"rgba(255,255,255,.12)"}`,color:aberta?"#93c5fd":"#7a90b0",fontSize:10,fontWeight:700,cursor:"pointer",borderRadius:3}}>
              {aberta?"✕ Fechar":"✏ Alterar"}
            </button>
          </div>
        </div>
        {aberta&&(
          <div style={{padding:"12px 14px",background:"rgba(0,0,0,.15)"}}>
            {grupo.id==="impostos"&&(
              <div style={{fontSize:10,color:"#60a5fa",marginBottom:10,padding:"6px 10px",background:"rgba(96,165,250,.06)",border:"1px solid rgba(96,165,250,.2)",borderRadius:3}}>
                💡 Consulte as alíquotas em:{" "}
                <a href="https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias" target="_blank" rel="noopener noreferrer" style={{color:"#60a5fa"}}>Receita Federal — Classificação Fiscal</a>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:grupo.campos.length>=3?"repeat(3,1fr)":grupo.campos.length===2?"repeat(2,1fr)":"1fr",gap:10}}>
              {grupo.campos.map(c=><Fn key={c.k} label={c.l} k={c.k} sfx={c.sfx}/>)}
            </div>
          </div>
        )}
        {!aberta&&(
          <div style={{padding:"8px 14px",display:"flex",flexWrap:"wrap",gap:12}}>
            {grupo.campos.map(c=>(
              <span key={c.k} style={{fontSize:11,fontFamily:"'Montserrat',sans-serif",color:"#5a6a84"}}>
                <span style={{color:"#A7A8AA",marginRight:3}}>{c.l}:</span>{form[c.k]||0}{c.sfx}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Render ──
  return(
    <div style={{padding:28,maxWidth:1200}}>
      <div className="page-title">Cadastro de Produtos</div>
      <div className="page-sub">Base de dados de produtos com índices padrão para precificação simplificada.</div>

      {msg&&<div className={`auth-msg ${msg.t}`} style={{marginBottom:16}}>{msg.txt}</div>}

      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <input className="tbl-search" placeholder="Buscar por nome, NCM ou ID..." value={busca} onChange={e=>setBusca(e.target.value)} style={{flex:1,minWidth:200}}/>
        {selecionados.size>0&&(
          <button onClick={abrirBulk}
            style={{padding:"9px 18px",background:"rgba(60,219,192,.2)",border:"1px solid rgba(60,219,192,.4)",color:"#3CDBC0",fontSize:12,fontWeight:700,cursor:"pointer",borderRadius:4,whiteSpace:"nowrap"}}>
            ✏ Atualizar índices ({selecionados.size} produto{selecionados.size!==1?"s":""})
          </button>
        )}
        <button style={{padding:"9px 16px",background:"rgba(124,58,237,.15)",border:"1px solid rgba(124,58,237,.35)",color:"#a78bfa",fontSize:12,fontWeight:700,cursor:"pointer",borderRadius:4,whiteSpace:"nowrap"}}
          onClick={()=>{setSolForm({nome_categoria:"",prefixo:"",descricao:""});setSolErro("");setSolOk(false);setModal("solicitacao");}}>
          + Solicitar categoria
        </button>
        <button className="btn-primary" style={{width:"auto",padding:"9px 20px"}} onClick={abrirNovo}>+ Novo Produto</button>
      </div>

      {/* Filtro por categoria */}
      {categsComProdutos.length>0&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
          <button
            onClick={()=>setCategFiltro("")}
            style={{padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",borderRadius:20,border:`1px solid ${!categFiltro?"#3CDBC0":"rgba(255,255,255,.12)"}`,background:!categFiltro?"rgba(60,219,192,.15)":"rgba(255,255,255,.04)",color:!categFiltro?"#3CDBC0":"#A7A8AA",transition:".15s"}}>
            Todas ({produtos.length})
          </button>
          {categsComProdutos.map(({prefix,count,nome})=>{
            const sel=categFiltro===prefix;
            return(
              <button key={prefix}
                onClick={()=>setCategFiltro(sel?"":prefix)}
                style={{padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",borderRadius:20,border:`1px solid ${sel?"#3CDBC0":"rgba(255,255,255,.12)"}`,background:sel?"rgba(60,219,192,.15)":"rgba(255,255,255,.04)",color:sel?"#3CDBC0":"#A7A8AA",transition:".15s",display:"flex",alignItems:"center",gap:5}}>
                {nome}
                <span style={{fontSize:10,opacity:.7}}>({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Tabela */}
      <div className="tbl-wrap">
        <div className="tbl-head">
          <span className="tbl-head-title">Produtos Cadastrados ({filtrados.length})</span>
        </div>
        {loading?<div style={{padding:24,color:"#7a7f96",textAlign:"center"}}>Carregando...</div>:
        filtrados.length===0?<div style={{padding:24,color:"#7a7f96",textAlign:"center"}}>Nenhum produto cadastrado.</div>:
        <table>
          <thead>
            <tr>
              <th style={{width:36}}>
                <input type="checkbox" checked={selecionados.size===filtrados.length&&filtrados.length>0}
                  onChange={toggleTodos} style={{cursor:"pointer",accentColor:"#3CDBC0"}}/>
              </th>
              <th>ID</th><th>SKU</th><th>NCM</th><th>Nome</th><th>VPL Padrão</th>
              <th>IPI MAO/IOS/CWB</th><th>Cred. MAO/IOS/CWB</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(p=>(
              <tr key={p.id} style={{background:selecionados.has(p.id)?"rgba(60,219,192,.08)":""}}>
                <td><input type="checkbox" checked={selecionados.has(p.id)} onChange={()=>toggleSel(p.id)} style={{cursor:"pointer",accentColor:"#3CDBC0"}}/></td>
                <td><code style={{fontSize:12,color:"#3CDBC0"}}>{p.id}</code></td>
                <td style={{fontFamily:"'Montserrat',sans-serif",fontSize:11,color:"#A7A8AA"}}>{p.sku||"—"}</td>
                <td style={{fontFamily:"'Montserrat',sans-serif",fontSize:12}}>{p.ncm}</td>
                <td style={{fontWeight:600}}>{p.nome}</td>
                <td style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,color:(p.vpl_padrao||0)>0?"#34d399":"#7a7f96"}}>
                  {(p.vpl_padrao||0)>0?`R$ ${(+p.vpl_padrao).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"—"}
                </td>
                <td style={{fontFamily:"'Montserrat',sans-serif",fontSize:11,color:"#a8b5cc"}}>{p.ipi_mao}% / {p.ipi_ios}% / {p.ipi_cwb}%</td>
                <td style={{fontFamily:"'Montserrat',sans-serif",fontSize:11,color:"#a8b5cc"}}>{p.cred_mao}% / {p.cred_ios}% / {p.cred_cwb}%</td>
                <td>
                  <div className="act-row">
                    <button className="btn-sm btn-edit" onClick={()=>abrirEditar(p)}>Editar</button>
                    <button className="btn-sm btn-reject" onClick={()=>excluir(p.id)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>

      {/* ── Modal Novo/Editar ── */}
      {(modal==="novo"||modal==="editar")&&form&&(
        <div className="modal-ov" onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
          <div className="modal-box" style={{maxWidth:700,maxHeight:"90vh",overflowY:"auto"}}>
            <div className="modal-head">
              <span className="modal-title">{modal==="novo"?"Novo Produto":"Editar: "+formId}</span>
              <button className="modal-close" onClick={()=>setModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{gap:10}}>
              {erroForm&&<div className="auth-msg err">{erroForm}</div>}

              {/* Identificação */}
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,color:"#A7A8AA",textTransform:"uppercase",letterSpacing:1,borderBottom:"1px solid rgba(255,255,255,.06)",paddingBottom:6}}>Identificação</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:10,marginBottom:4}}>
                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                  <label style={{fontSize:10,fontWeight:600,color:"#7a7f96",textTransform:"uppercase",letterSpacing:.6}}>Categoria</label>
                  <select value={form.categoria||""} onChange={e=>handleCategoriaChange(e.target.value)}
                    disabled={modal==="editar"}
                    style={{background:"#2C2A29",border:"1px solid rgba(255,255,255,.1)",color:form.categoria?"#e8eaf0":"#5a6a84",padding:"7px 10px",fontSize:13,outline:"none"}}>
                    <option value="">— selecione —</option>
                    {categorias.map(c=><option key={c.id} value={c.id}>{c.nome} ({c.id})</option>)}
                  </select>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                  <label style={{fontSize:10,fontWeight:600,color:"#7a7f96",textTransform:"uppercase",letterSpacing:.6}}>ID Gerado</label>
                  <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",color:"#3CDBC0",padding:"7px 10px",fontSize:13,fontFamily:"'Montserrat',sans-serif",borderRadius:2}}>
                    {formId||"—"}
                  </div>
                </div>
                <Ft label="NCM" k="ncm" placeholder="ex: 8471.30.11"/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
                <Ft label="Nome" k="nome" placeholder='ex: Tablet 7"'/>
                <Ft label="SKU" k="sku" placeholder="ex: 123456"/>
              </div>

              {/* Seções com toggle */}
              <div style={{marginTop:12}}>
                {INDICES_GRUPOS.map(g=><SecaoToggle key={g.id} grupo={g}/>)}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-sm btn-disable" onClick={()=>setModal(null)}>Cancelar</button>
              <button className="btn-primary" style={{width:"auto",padding:"8px 22px"}} onClick={salvar} disabled={salvando}>
                {salvando?"Salvando...":"Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Bulk Update ── */}
      {modal==="bulk"&&(
        <div className="modal-ov" onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
          <div className="modal-box" style={{maxWidth:bulkPasso===2?900:520,maxHeight:"90vh",overflowY:"auto"}}>
            <div className="modal-head">
              <span className="modal-title">✏ Atualizar índices em lote</span>
              <button className="modal-close" onClick={()=>setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {bulkPasso===1&&(
                <>
                  <div style={{fontSize:12,color:"#A7A8AA",marginBottom:16}}>
                    Selecione os índices que deseja atualizar para os {selecionados.size} produto{selecionados.size!==1?"s":""} selecionados:
                  </div>
                  {INDICES_GRUPOS.map(g=>(
                    <div key={g.id} style={{marginBottom:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#A7A8AA",textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>{g.icone} {g.label}</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {g.campos.map(c=>(
                          <label key={c.k} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",background:bulkIndices.has(c.k)?"rgba(60,219,192,.2)":"rgba(255,255,255,.04)",border:`1px solid ${bulkIndices.has(c.k)?"rgba(60,219,192,.4)":"rgba(255,255,255,.1)"}`,borderRadius:20,cursor:"pointer",fontSize:11,color:bulkIndices.has(c.k)?"#93c5fd":"#7a90b0",userSelect:"none"}}>
                            <input type="checkbox" checked={bulkIndices.has(c.k)} onChange={()=>toggleBulkIndice(c.k)} style={{display:"none"}}/>
                            {c.l} <span style={{opacity:.6}}>{c.sfx}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
              {bulkPasso===2&&(
                <>
                  <div style={{fontSize:12,color:"#A7A8AA",marginBottom:12}}>
                    Preencha os novos valores. Campos em branco não serão alterados.
                  </div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead>
                        <tr>
                          <th style={{padding:"8px 12px",background:"#201f1e",textAlign:"left",color:"#A7A8AA",fontWeight:700,fontSize:11,whiteSpace:"nowrap",position:"sticky",left:0,zIndex:2}}>Produto</th>
                          {[...bulkIndices].map(k=>{
                            const campo=INDICES_GRUPOS.flatMap(g=>g.campos).find(c=>c.k===k);
                            return <th key={k} style={{padding:"8px 10px",background:"#201f1e",textAlign:"center",color:"#3CDBC0",fontWeight:700,fontSize:11,whiteSpace:"nowrap"}}>{campo?.l}<br/><span style={{color:"#475569",fontWeight:400}}>{campo?.sfx}</span></th>;
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {[...selecionados].map(pid=>{
                          const prod=produtos.find(p=>p.id===pid);
                          return(
                            <tr key={pid} style={{borderBottom:"1px solid rgba(255,255,255,.06)"}}>
                              <td style={{padding:"8px 12px",color:"#f0f0f0",fontWeight:600,whiteSpace:"nowrap",background:"#201f1e",position:"sticky",left:0}}>
                                <code style={{fontSize:11,color:"#3CDBC0",marginRight:6}}>{pid}</code>{prod?.nome}
                              </td>
                              {[...bulkIndices].map(k=>(
                                <td key={k} style={{padding:"4px 6px",textAlign:"center"}}>
                                  <input type="number" step="any"
                                    placeholder={String(prod?.[k]??"")}
                                    value={bulkVals[pid]?.[k]??""}
                                    onChange={e=>{
                                      const v=e.target.value;
                                      setBulkVals(prev=>({...prev,[pid]:{...(prev[pid]||{}),[k]:v===""?undefined:parseFloat(v)||0}}));
                                    }}
                                    style={{width:80,background:"#2C2A29",border:"1px solid rgba(255,255,255,.12)",color:"#f0f0f0",padding:"5px 8px",fontSize:12,outline:"none",textAlign:"right",fontFamily:"'Montserrat',sans-serif"}}/>
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="modal-foot">
              {bulkPasso===2&&<button className="btn-sm btn-disable" onClick={()=>setBulkPasso(1)}>← Voltar</button>}
              <button className="btn-sm btn-disable" onClick={()=>setModal(null)}>Cancelar</button>
              {bulkPasso===1
                ? <button className="btn-primary" style={{width:"auto",padding:"8px 22px"}} onClick={()=>{if(bulkIndices.size>0)setBulkPasso(2);}} disabled={bulkIndices.size===0}>
                    Próximo →
                  </button>
                : <button className="btn-primary" style={{width:"auto",padding:"8px 22px"}} onClick={salvarBulk} disabled={bulkSalvando}>
                    {bulkSalvando?"Salvando...":"✓ Confirmar atualização"}
                  </button>
              }
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Solicitação de Categoria ── */}
      {modal==="solicitacao"&&(
        <div className="modal-ov" onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
          <div className="modal-box" style={{maxWidth:460}}>
            <div className="modal-head">
              <span className="modal-title">Solicitar nova categoria</span>
              <button className="modal-close" onClick={()=>setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {solOk
                ? <div className="auth-msg ok">✓ Solicitação enviada! Os administradores serão notificados.</div>
                : <>
                    {solErro&&<div className="auth-msg err">{solErro}</div>}
                    <div style={{fontSize:12,color:"#A7A8AA",marginBottom:16}}>
                      A solicitação será analisada pelos administradores. Quando aprovada, a categoria ficará disponível para uso.
                    </div>
                    <div className="fld">
                      <label>Nome da categoria</label>
                      <input type="text" placeholder="ex: Smart TVs" value={solForm.nome_categoria} onChange={e=>setSolForm(p=>({...p,nome_categoria:e.target.value}))}/>
                    </div>
                    <div className="fld">
                      <label>Prefixo (2–4 letras)</label>
                      <input type="text" placeholder="ex: STV" maxLength={4} value={solForm.prefixo} onChange={e=>setSolForm(p=>({...p,prefixo:e.target.value.toUpperCase().replace(/[^A-Z]/g,"")}))}/>
                    </div>
                    <div className="fld">
                      <label>Descrição (opcional)</label>
                      <input type="text" placeholder="Breve descrição da categoria" value={solForm.descricao} onChange={e=>setSolForm(p=>({...p,descricao:e.target.value}))}/>
                    </div>
                  </>
              }
            </div>
            {!solOk&&<div className="modal-foot">
              <button className="btn-cancel" onClick={()=>setModal(null)}>Cancelar</button>
              <button className="btn-confirm" onClick={enviarSolicitacao}>Enviar solicitação</button>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── APP INTEGRADO ─────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => loadSession());
  const [modView, setModView] = useState("precificacao");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const handleLogin = (u) => setUser(u);
  const handleLogout = () => { saveSession(null); setUser(null); };

  if (!user) return <AuthScreen onLogin={handleLogin}/>;

  const perfisMap = getPerfisMap(loadPerfis());
  const p = perfisMap[user.perfil] || { label: user.perfil, cor:"#0047BB", icone:"?" };
  const isAdmin = user.perfil === "admin";
  const userModulos = p.modulos || ["precificacao"];
  const temCadastro = userModulos.includes("cadastro");
  const temPrecificacao = userModulos.includes("precificacao");
  const mostraSidebar = userModulos.length > 1;

  const titulos = { precificacao:"Calculadora Tributária · PLAN_TRIB", cadastro:"Cadastro de Produtos" };

  return (
    <>
      <style>{CSS_AUTH}</style>
      <div className="dash">
        <div className="topbar">
          <div className="topbar-logo">
            <img src="/logo-positivo-tecnologIA-mai-25.png" alt="Positivo Tecnologia" style={{height:30,objectFit:"contain",display:"block"}}/>
          </div>
          <div className="topbar-divider"/>
          <span className="topbar-title">
            {isAdmin ? "Painel Administrativo" : (titulos[modView]||"PLAN_TRIB")}
          </span>
          <div className="topbar-spacer"/>
          <div className="topbar-user">
            <div className="topbar-avatar" style={{ background: p.cor || "#0047BB" }}>{initials(user.nome)}</div>
            <div>
              <div className="topbar-uname">{user.nome.split(" ")[0]} {user.nome.split(" ").slice(-1)[0]}</div>
              <div className="topbar-uperfil">{p.icone} {p.label}</div>
            </div>
            {isAdmin&&<button onClick={()=>document.dispatchEvent(new CustomEvent("openGestao"))}
              style={{padding:"4px 10px",background:"rgba(5,150,105,.15)",border:"1px solid rgba(5,150,105,.4)",color:"#34d399",fontFamily:"'Montserrat',sans-serif",fontSize:10,fontWeight:700,letterSpacing:.5,cursor:"pointer",borderRadius:20}}>
              👥 Gestão
            </button>}
            <button className="btn-logout" onClick={handleLogout}>Sair</button>
          </div>
        </div>
        <div className="dash-body">
          {mostraSidebar&&(
            <div className={`sidebar${sidebarCollapsed?" collapsed":""}`}>
              <div className="snav-toggle" title={sidebarCollapsed?"Expandir menu":"Recolher menu"} onClick={()=>setSidebarCollapsed(v=>!v)}>
                {sidebarCollapsed ? "▶" : "◀"}
              </div>
              {MODULOS.filter(m=>m.ativo&&userModulos.includes(m.id)).map(m=>(
                <div key={m.id} data-label={m.label} className={`snav-item ${modView===m.id?"on":""}`} onClick={()=>setModView(m.id)}>
                  <span className="snav-icon">{m.icone}</span>
                  <span className="snav-label">{m.label}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            {modView==="precificacao"&&temPrecificacao&&<MultiTab user={user}/>}
            {modView==="cadastro"&&temCadastro&&<div style={{overflow:"auto",flex:1}}><CadastroProdutos user={user}/></div>}
          </div>
        </div>
      </div>
    </>
  );
}

// ── MultiTab — sistema de abas de precificação ────────────────────────────────
let _tabId = 1;
function newTab(nome) {
  return { id: _tabId++, nome: nome || `Precificação ${_tabId - 1}`, editando: false };
}

function PainelComparativo({abas, calcsMap, selecionadas, open, onToggle}){
  const [expanded, setExpanded] = useState({imp:false,ppb:false,local:false,impvenda:false,iger:false,icom:false,res:false});
  const [view, setView] = useState("tabela"); // "tabela" | "relatorio"
  const tog = k => setExpanded(p=>({...p,[k]:!p[k]}));

  const abasComDados = abas.filter(a=>calcsMap[a.id] && selecionadas.has(a.id));
  if(!open || abasComDados.length===0) return null;

  const cores = ["#93c5fd","#34d399","#fbbf24","#f87171","#c084fc","#fb923c"];
  const coresBg = ["rgba(147,197,253,.08)","rgba(52,211,153,.08)","rgba(251,191,36,.08)","rgba(248,113,113,.08)","rgba(192,132,252,.08)","rgba(251,146,60,.08)"];
  const coresBorder = ["rgba(147,197,253,.25)","rgba(52,211,153,.25)","rgba(251,191,36,.25)","rgba(248,113,113,.25)","rgba(192,132,252,.25)","rgba(251,146,60,.25)"];

  const origemLabel = o => ({MAO:"Manaus · ZFM", IOS:"Ilhéus · BA", CWB:"Curitiba · PR"}[o]||o);

  /* ── VIEW TABELA (original) ── */
  const Linha = ({label, fn, grp}) => (
    <div style={{display:"flex",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,.04)",padding:"4px 12px",background:grp?"rgba(255,255,255,.02)":"transparent"}}>
      <span style={{flex:1,fontSize:11,color:grp?"#a8b5cc":"#7a90b0",fontWeight:grp?600:400}}>{label}</span>
      {abasComDados.map((a,i)=>{
        const v = fn(calcsMap[a.id]);
        return <span key={a.id} style={{width:90,textAlign:"right",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:grp?700:400,color:grp?cores[i%cores.length]:"#a8b5cc",flexShrink:0}}>{v}</span>;
      })}
    </div>
  );

  const Grp = ({id, label, fnTotal, children}) => (
    <div style={{borderBottom:"1px solid rgba(255,255,255,.06)"}}>
      <div onClick={()=>tog(id)} style={{display:"flex",alignItems:"center",padding:"6px 12px",cursor:"pointer",background:"rgba(255,255,255,.03)"}}>
        <span style={{fontSize:9,color:"#5a6a84",marginRight:6}}>{expanded[id]?"▼":"▶"}</span>
        <span style={{flex:1,fontSize:11,fontWeight:700,color:"#f0f0f0",textTransform:"uppercase",letterSpacing:.5}}>{label}</span>
        {abasComDados.map((a,i)=>(
          <span key={a.id} style={{width:90,textAlign:"right",fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,color:cores[i%cores.length],flexShrink:0}}>{brl(fnTotal(calcsMap[a.id]))}</span>
        ))}
      </div>
      {expanded[id]&&<div>{children}</div>}
    </div>
  );

  /* ── VIEW RELATÓRIO ── */
  const CardLinha = ({label, valor, destaque, cor}) => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
      <span style={{fontSize:destaque?12:11,color:destaque?"#dce7f7":"#7a90b0",fontWeight:destaque?600:400}}>{label}</span>
      <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:destaque?13:11,fontWeight:destaque?700:500,color:cor||(destaque?"#e8eaf0":"#a8b5cc")}}>{valor}</span>
    </div>
  );

  const CardSecao = ({titulo}) => (
    <div style={{marginTop:10,marginBottom:4}}>
      <span style={{fontSize:9,fontWeight:700,color:"#5a6a84",textTransform:"uppercase",letterSpacing:1}}>{titulo}</span>
    </div>
  );

  const CardProduto = ({aba, idx}) => {
    const {c, d, prodNome} = calcsMap[aba.id];
    const cor = cores[idx % cores.length];
    const corBg = coresBg[idx % coresBg.length];
    const corBorder = coresBorder[idx % coresBorder.length];
    const mlPct = c.margPct||0;
    const mcPct = c.mc||0;
    const mlOk = mlPct >= 8;
    const corML = mlPct >= 10 ? "#34d399" : mlPct >= 6 ? "#fbbf24" : "#f87171";
    const corMC = mcPct >= 15 ? "#34d399" : mcPct >= 10 ? "#fbbf24" : "#f87171";

    return (
      <div style={{flex:"1 1 260px",minWidth:240,maxWidth:400,background:"#0e1622",border:`1px solid ${corBorder}`,borderRadius:10,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {/* Topo colorido */}
        <div style={{background:corBg,borderBottom:`1px solid ${corBorder}`,padding:"12px 16px"}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:"#f0f0f0",lineHeight:1.3,wordBreak:"break-word"}}>{aba.nome}</div>
              {prodNome && prodNome !== aba.nome && (
                <div style={{fontSize:10,color:"#A7A8AA",marginTop:2,lineHeight:1.3}}>{prodNome}</div>
              )}
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
              <span style={{fontSize:9,fontWeight:700,color:cor,background:`rgba(0,0,0,.3)`,padding:"2px 7px",borderRadius:10,letterSpacing:.5}}>{origemLabel(d.origem)}</span>
              <span style={{fontSize:9,fontWeight:600,color:"#A7A8AA",background:"rgba(0,0,0,.25)",padding:"2px 7px",borderRadius:10,letterSpacing:.5}}>{d.modalidade||"CKD"}</span>
            </div>
          </div>
        </div>

        {/* Preço em destaque */}
        <div style={{padding:"16px",background:"rgba(0,0,0,.2)",borderBottom:`1px solid ${corBorder}`,textAlign:"center"}}>
          <div style={{fontSize:10,color:"#5a6a84",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Preço Final</div>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:28,fontWeight:800,color:cor,lineHeight:1}}>{brl(c.pF)}</div>
          {d.fobUSD>0&&<div style={{fontSize:10,color:"#5a6a84",marginTop:5,fontFamily:"'Montserrat',sans-serif"}}>FOB {usd(d.fobUSD)}</div>}
        </div>

        {/* Corpo do card */}
        <div style={{padding:"12px 16px",flex:1,display:"flex",flexDirection:"column",gap:0}}>

          {/* Custo */}
          <CardSecao titulo="Custo"/>
          <CardLinha label="VPL" valor={brl(c.vpl)}/>
          <CardLinha label="CMV Total" valor={brl(c.cmvTotal)} destaque/>

          {/* Impostos de Venda */}
          <CardSecao titulo="Impostos de Venda"/>
          {c.ipi>0&&<CardLinha label="IPI" valor={brl(c.ipiV)}/>}
          {c.ipiCreditoV>0&&<CardLinha label="Crédito IPI" valor={brl(-c.ipiCreditoV)}/>}
          <CardLinha label="P/C Efetivo" valor={brl(c.pcV)}/>
          {c.pcSubvV>0.01&&<CardLinha label="P/C Subvenção" valor={brl(c.pcSubvV)}/>}
          <CardLinha label="ICMS Efetivo" valor={brl(c.icmsEfV)}/>
          {c.difal>0&&<CardLinha label="DIFAL" valor={brl(c.difalV)}/>}
          <CardLinha label="Total Impostos" valor={brl(c.cargaTot)} destaque/>

          {/* Índices */}
          <CardSecao titulo="Índices"/>
          {c.pdV>0&&<CardLinha label="P&D" valor={brl(c.pdV)}/>}
          {c.scV>0&&<CardLinha label="Scrap" valor={brl(c.scV)}/>}
          {c.ryV>0&&<CardLinha label="Royalties" valor={brl(c.ryV)}/>}
          {c.frV>0&&<CardLinha label="Frete venda" valor={brl(c.frV)}/>}
          {c.cfnV>0&&<CardLinha label="CF Venda" valor={brl(c.cfnV)}/>}
          {c.cmV>0&&<CardLinha label="Comissão+Enc." valor={brl(c.cmV)}/>}
          {(c.mktV||0)>0&&<CardLinha label="Marketing" valor={brl(c.mktV)}/>}
          {(c.rebateV||0)>0&&<CardLinha label="Rebate" valor={brl(c.rebateV)}/>}
          {(d.pdd||0)>0&&<CardLinha label="PDD" valor={brl(c.pddV||0)}/>}
          {(d.vbExtra||0)>0&&<CardLinha label="Verba Extra" valor={brl(c.vbExtraV||0)}/>}
          {(d.vpc||0)>0&&<CardLinha label="VPC" valor={brl(c.vpcV||0)}/>}

          {/* Resultado — painel de margem em destaque */}
          <div style={{marginTop:14,borderRadius:8,overflow:"hidden",border:`1px solid ${corBorder}`}}>
            {/* ML — bloco principal */}
            <div style={{background:`linear-gradient(135deg, ${corML}18 0%, ${corML}08 100%)`,borderBottom:`1px solid ${corML}30`,padding:"14px 14px 12px"}}>
              <div style={{fontSize:9,fontWeight:700,color:"#5a6a84",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Margem Líquida</div>
              <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:8}}>
                <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:36,fontWeight:800,color:corML,lineHeight:1}}>{pct(mlPct)}</span>
                <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:700,color:corML,opacity:.8,paddingBottom:4}}>{brl(c.margV)}</span>
              </div>
            </div>
            {/* MC — bloco secundário */}
            <div style={{background:`linear-gradient(135deg, ${corMC}12 0%, ${corMC}05 100%)`,borderBottom:calcsMap[aba.id].d.margGer!==0?`1px solid rgba(255,255,255,.05)`:"none",padding:"10px 14px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:"#5a6a84",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Margem de Contribuição</div>
                  <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                    <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:800,color:corMC,lineHeight:1}}>{pct(mcPct)}</span>
                    <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:600,color:corMC,opacity:.75}}>{brl(c.cfxV)}</span>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:9,color:"#3a4a60",marginBottom:3}}>Markup</div>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,color:"#5a6a84"}}>{n3(c.mkp)}x</div>
                </div>
              </div>
            </div>
            {/* Margem Gerencial (condicional) */}
            {calcsMap[aba.id].d.margGer!==0&&(
              <div style={{background:"rgba(255,255,255,.02)",padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:9,fontWeight:700,color:"#5a6a84",textTransform:"uppercase",letterSpacing:1}}>Mg. Gerencial</span>
                <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:600,color:"#a8b5cc"}}>{brl(c.margGerV)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const modalWidth = view==="relatorio"
    ? Math.min(120 + abasComDados.length*300, 1100)
    : Math.min(200+abasComDados.length*100, 900);

  return(
    <div className="ov" onClick={onToggle}>
      <div style={{background:"#131925",border:"1px solid rgba(255,255,255,.12)",borderRadius:8,width:"95%",maxWidth:modalWidth,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,.08)",flexShrink:0,gap:8}}>
          <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700,color:"#f0f0f0",letterSpacing:.5,flex:1}}>Comparativo de Precificações</span>
          {/* Toggle view */}
          <div style={{display:"flex",background:"rgba(255,255,255,.05)",borderRadius:6,padding:2,gap:2}}>
            <button onClick={()=>setView("tabela")}
              style={{padding:"4px 12px",background:view==="tabela"?"rgba(60,219,192,.4)":"transparent",border:"none",color:view==="tabela"?"#93c5fd":"#5a6a84",fontSize:10,fontWeight:700,cursor:"pointer",borderRadius:4,fontFamily:"'Montserrat',sans-serif",letterSpacing:.5,transition:".15s"}}>
              Tabela
            </button>
            <button onClick={()=>setView("relatorio")}
              style={{padding:"4px 12px",background:view==="relatorio"?"rgba(60,219,192,.4)":"transparent",border:"none",color:view==="relatorio"?"#93c5fd":"#5a6a84",fontSize:10,fontWeight:700,cursor:"pointer",borderRadius:4,fontFamily:"'Montserrat',sans-serif",letterSpacing:.5,transition:".15s"}}>
              Relatório
            </button>
          </div>
          <button onClick={()=>window.print()}
            style={{padding:"5px 12px",background:"rgba(60,219,192,.2)",border:"1px solid rgba(60,219,192,.45)",color:"#3CDBC0",fontFamily:"'Montserrat',sans-serif",fontSize:10,fontWeight:700,cursor:"pointer",borderRadius:20}}>
            Imprimir / PDF
          </button>
          <button onClick={onToggle} style={{background:"none",border:"none",color:"#A7A8AA",fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
        </div>

        {/* VIEW TABELA */}
        {view==="tabela"&&<>
          <div style={{display:"flex",alignItems:"center",padding:"8px 12px",borderBottom:"1px solid rgba(255,255,255,.08)",flexShrink:0,background:"rgba(255,255,255,.02)"}}>
            <span style={{flex:1,fontSize:10,color:"#5a6a84"}}></span>
            {abasComDados.map((a,i)=>(
              <span key={a.id} style={{width:90,textAlign:"right",fontSize:10,fontWeight:700,color:cores[i%cores.length],flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.nome}</span>
            ))}
          </div>
          <div style={{overflowY:"auto",flex:1}}>
            <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,.08)",background:"rgba(60,219,192,.06)"}}>
              <div style={{display:"flex",alignItems:"center"}}>
                <span style={{flex:1,fontSize:12,fontWeight:700,color:"#3CDBC0",textTransform:"uppercase",letterSpacing:.5}}>Preço Final</span>
                {abasComDados.map((a,i)=>(
                  <span key={a.id} style={{width:90,textAlign:"right",fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:800,color:cores[i%cores.length],flexShrink:0}}>{brl(calcsMap[a.id].c.pF)}</span>
                ))}
              </div>
            </div>
            <Linha label="FOB (USD)" fn={({d})=>usd(d.fobUSD)}/>
            <Linha label="VPL" fn={({c})=>brl(c.vpl)}/>
            <Linha label="CMV Total" fn={({c})=>brl(c.cmvTotal)} grp/>
            <Grp id="impvenda" label="Impostos de Venda" fnTotal={({c})=>c.cargaTot}>
              <Linha label="IPI" fn={({c})=>c.ipi>0?brl(c.ipiV):"—"}/>
              {abasComDados.some(a=>calcsMap[a.id].c.ipiCreditoV>0)&&<Linha label="Crédito IPI IOS" fn={({c})=>c.ipiCreditoV>0?brl(-c.ipiCreditoV):"—"}/>}
              <Linha label="P/C Efetivo" fn={({c})=>brl(c.pcV)}/>
              {abasComDados.some(a=>calcsMap[a.id].c.pcSubvV>0.01)&&<Linha label="P/C Subvenção" fn={({c})=>c.pcSubvV>0.01?brl(c.pcSubvV):"—"}/>}
              <Linha label="ICMS Efetivo" fn={({c})=>brl(c.icmsEfV)}/>
              {abasComDados.some(a=>calcsMap[a.id].c.difal>0)&&<Linha label="DIFAL" fn={({c})=>c.difal>0?brl(c.difalV):"—"}/>}
            </Grp>
            <Grp id="iger" label="Índices Gerais" fnTotal={({c})=>c.pdV+c.scV+c.ryV+c.frV+(c.footprintV||0)}>
              <Linha label="P&D" fn={({c})=>brl(c.pdV)}/>
              <Linha label="Scrap" fn={({c})=>brl(c.scV)}/>
              <Linha label="Royalties" fn={({c})=>brl(c.ryV)}/>
              <Linha label="Footprint" fn={({c})=>c.footprintPct!==0?brl(c.footprintV):"—"}/>
              <Linha label="Frete venda" fn={({c})=>brl(c.frV)}/>
            </Grp>
            <Grp id="icom" label="Índices Comerciais" fnTotal={({c})=>c.cfnV+c.cmV+(c.mktV||0)+(c.rebateV||0)+(c.pddV||0)+(c.vbExtraV||0)+(c.vpcV||0)}>
              <Linha label="CF Venda" fn={({c})=>brl(c.cfnV)}/>
              <Linha label="Comissão+Enc." fn={({c})=>brl(c.cmV)}/>
              {abasComDados.some(a=>(calcsMap[a.id].d.mkt||0)>0)&&<Linha label="Marketing" fn={({c})=>brl(c.mktV||0)}/>}
              {abasComDados.some(a=>(calcsMap[a.id].d.rebate||0)>0)&&<Linha label="Rebate" fn={({c})=>brl(c.rebateV||0)}/>}
              {abasComDados.some(a=>(calcsMap[a.id].d.pdd||0)>0)&&<Linha label="PDD" fn={({c})=>brl(c.pddV||0)}/>}
              {abasComDados.some(a=>(calcsMap[a.id].d.vbExtra||0)>0)&&<Linha label="Verba Extra" fn={({c})=>brl(c.vbExtraV||0)}/>}
              {abasComDados.some(a=>(calcsMap[a.id].d.vpc||0)>0)&&<Linha label="VPC" fn={({c})=>brl(c.vpcV||0)}/>}
            </Grp>
            <Grp id="res" label="Resultado (MC)" fnTotal={({c})=>c.margV+c.cfxV}>
              <Linha label="ML (%)" fn={({c})=>pct(c.margPct)}/>
              <Linha label="ML (R$)" fn={({c})=>brl(c.margV)}/>
              <Linha label="CF (R$)" fn={({c})=>brl(c.cfxV)}/>
              <Linha label="MC (%)" fn={({c})=>pct(c.mc)}/>
              {abasComDados.some(a=>calcsMap[a.id].d.margGer!==0)&&<Linha label="Marg. Gerencial" fn={({c})=>brl(c.margGerV)}/>}
            </Grp>
            <Linha label="Markup" fn={({c})=>n3(c.mkp)+"x"} grp/>
          </div>
        </>}

        {/* VIEW RELATÓRIO */}
        {view==="relatorio"&&(
          <div style={{overflowY:"auto",flex:1,padding:"16px"}}>
            {/* Data do relatório */}
            <div style={{fontSize:9,color:"#3a4a60",textAlign:"right",marginBottom:12,fontFamily:"'Montserrat',sans-serif"}}>
              Relatório gerado em {new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}
            </div>
            {/* Cards lado a lado */}
            <div style={{display:"flex",flexWrap:"wrap",gap:14,alignItems:"flex-start"}}>
              {abasComDados.map((a,i)=>(
                <CardProduto key={a.id} aba={a} idx={i}/>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MultiTab({ user }) {
  const _initTab = useState(() => newTab("Precificação 1"))[0];
  const [abas, setAbas] = useState([_initTab]);
  const [abaAtiva, setAbaAtiva] = useState(0);
  const [editandoIdx, setEditandoIdx] = useState(null);
  const [nomeEdit, setNomeEdit] = useState("");
  const [calcsMap, setCalcsMap] = useState({});
  const [comparOpen, setComparOpen] = useState(false);
  const [selecionadas, setSelecionadas] = useState(() => new Set([_initTab.id]));

  const toggleSelecionada = (id, e) => {
    e.stopPropagation();
    setSelecionadas(prev => {
      const s = new Set(prev);
      if (s.has(id)) { s.delete(id); return s; }
      if (s.size >= 3) return prev;
      s.add(id); return s;
    });
  };

  const addAba = () => {
    const nova = newTab();
    setAbas(p => [...p, nova]);
    setAbaAtiva(abas.length);
    setSelecionadas(prev => prev.size < 3 ? new Set([...prev, nova.id]) : prev);
  };

  const removeAba = (idx) => {
    if (abas.length === 1) return;
    const removedId = abas[idx].id;
    const novas = abas.filter((_, i) => i !== idx);
    setAbas(novas);
    setAbaAtiva(Math.min(abaAtiva, novas.length - 1));
    setSelecionadas(prev => { const s = new Set(prev); s.delete(removedId); return s; });
  };

  const startEdit = (idx) => { setEditandoIdx(idx); setNomeEdit(abas[idx].nome); };
  const confirmEdit = () => {
    if (editandoIdx === null) return;
    setAbas(p => p.map((a, i) => i === editandoIdx ? { ...a, nome: nomeEdit.trim() || a.nome } : a));
    setEditandoIdx(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Barra de abas */}
      <div style={{
        display: "flex", alignItems: "stretch", gap: 0,
        background: "#0f1520", borderBottom: "1px solid rgba(255,255,255,.08)",
        padding: "0 8px", overflowX: "auto", flexShrink: 0, minHeight: 38,
      }}>
        {abas.map((aba, idx) => {
          const sel = selecionadas.has(aba.id);
          const podeSelecionar = sel || selecionadas.size < 3;
          return (
          <div key={aba.id}
            onClick={() => setAbaAtiva(idx)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "0 10px", cursor: "pointer", position: "relative",
              borderRight: "1px solid rgba(255,255,255,.06)",
              borderBottom: idx === abaAtiva ? "2px solid #3CDBC0" : "2px solid transparent",
              background: idx === abaAtiva ? "#1e2a3d" : "transparent",
              minWidth: 120, maxWidth: 200, flexShrink: 0, transition: ".15s",
            }}>
            {/* Checkbox de seleção para comparar */}
            {abas.length > 1 && (
              <div onClick={e => podeSelecionar ? toggleSelecionada(aba.id, e) : e.stopPropagation()}
                title={sel ? "Remover do comparativo" : selecionadas.size >= 3 ? "Máximo 3 produtos" : "Incluir no comparativo"}
                style={{
                  width:13,height:13,borderRadius:3,flexShrink:0,
                  border:`1.5px solid ${sel?"#3CDBC0":podeSelecionar?"rgba(255,255,255,.2)":"rgba(255,255,255,.07)"}`,
                  background:sel?"#3CDBC0":"transparent",
                  cursor:podeSelecionar?"pointer":"not-allowed",
                  display:"flex",alignItems:"center",justifyContent:"center",transition:".15s",
                }}>
                {sel&&<span style={{color:"#fff",fontSize:8,lineHeight:1,fontWeight:700}}>✓</span>}
              </div>
            )}
            {editandoIdx === idx ? (
              <input autoFocus value={nomeEdit}
                onChange={e => setNomeEdit(e.target.value)}
                onBlur={confirmEdit}
                onKeyDown={e => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditandoIdx(null); }}
                onClick={e => e.stopPropagation()}
                style={{ background: "none", border: "none", outline: "none", color: "#e8eaf0", fontSize: 11, fontWeight: 600, width: "100%", fontFamily: "'Montserrat', sans-serif" }}/>
            ) : (
              <span onDoubleClick={e => { e.stopPropagation(); startEdit(idx); }}
                style={{ fontSize: 11, fontWeight: idx === abaAtiva ? 600 : 400, color: idx === abaAtiva ? "#e8eaf0" : "#7a90b0", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: "38px" }}
                title="Duplo clique para renomear">{aba.nome}</span>
            )}
            {abas.length > 1 && (
              <button onClick={e => { e.stopPropagation(); removeAba(idx); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#5a6a84", fontSize: 14, lineHeight: 1, padding: "0 2px", flexShrink: 0 }}
                title="Fechar aba">×</button>
            )}
          </div>
          );
        })}
        <button onClick={addAba}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#5a6a84", fontSize: 18, padding: "0 12px", flexShrink: 0, transition: ".15s" }}
          title="Nova precificação">+</button>
        {selecionadas.size >= 2 && (
          <button onClick={()=>setComparOpen(true)}
            style={{marginLeft:"auto",padding:"0 14px",background:"rgba(60,219,192,.2)",border:"none",borderLeft:"1px solid rgba(255,255,255,.06)",color:"#3CDBC0",fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:.5,fontFamily:"'Montserrat',sans-serif",flexShrink:0}}>
            ⇄ Comparar ({selecionadas.size})
          </button>
        )}
      </div>

      {/* Conteúdo das abas */}
      {abas.map((aba, idx) => (
        <div key={aba.id} style={{ display: idx === abaAtiva ? "flex" : "none", flex: 1, overflow: "hidden" }}>
          <Calculadora user={user} isAdmin={false} nomeAba={aba.nome}
            onRenomear={nome => setAbas(p => p.map((a, i) => i === idx ? { ...a, nome } : a))}
            onCalcsChange={(c, d, prodNome) => setCalcsMap(prev => ({...prev, [aba.id]: {c, d, prodNome}}))}/>
        </div>
      ))}

      {/* Painel comparativo flutuante */}
      {selecionadas.size >= 2 && (
        <PainelComparativo
          abas={abas}
          calcsMap={calcsMap}
          selecionadas={selecionadas}
          open={comparOpen}
          onToggle={()=>setComparOpen(p=>!p)}/>
      )}
    </div>
  );
}
