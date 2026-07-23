/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

.bf-root {
  --bg:#E9ECEA; --panel:#FFFFFF; --ink:#1C2826; --muted:#5C6B66;
  --line:#CBD4CF; --accent:#2E7D5B; --warn:#A5524B; --amber:#B0762B;
  background:var(--bg); color:var(--ink); min-height:100vh;
  font-family:'IBM Plex Sans',system-ui,sans-serif; font-size:14px; line-height:1.45;
  padding:20px clamp(12px,3vw,36px) 40px;
}
.bf-root *{box-sizing:border-box}
.bf-root h1,.bf-root h2,.bf-root h3{font-family:'Archivo',sans-serif;margin:0}

/* Schriftfeld */
.bf-titleblock{display:flex;justify-content:space-between;align-items:stretch;gap:16px;
  border:1.5px solid var(--ink);background:var(--panel);margin-bottom:18px}
.bf-tb-main{padding:14px 18px;border-right:1.5px solid var(--ink);flex:1}
.bf-tb-main h1{font-size:clamp(20px,3vw,28px);font-weight:800;letter-spacing:-0.01em;text-transform:uppercase}
.bf-tb-sub{margin:2px 0 0;color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:12px}
.bf-tb-meta{display:flex}
.bf-tb-meta>div{padding:10px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;justify-content:center;min-width:86px}
.bf-tb-meta span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.bf-tb-meta strong{font-family:'IBM Plex Mono',monospace;font-size:18px}

.bf-layout{display:grid;grid-template-columns:330px 1fr;gap:18px;align-items:start}
@media(max-width:880px){.bf-layout{grid-template-columns:1fr}.bf-tb-meta{display:none}}

.bf-panel{background:var(--panel);border:1px solid var(--line);padding:16px 18px}
.bf-panel h2{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:14px 0 10px}
.bf-panel h2:first-child{margin-top:0}
.bf-inputs h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin:12px 0 8px}

.bf-field{display:block;margin-bottom:10px}
.bf-field-label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:3px}
.bf-field-input{display:flex;align-items:center;gap:6px}
.bf-root input[type=number],.bf-root select{width:100%;border:1px solid var(--line);background:#FBFCFB;
  padding:7px 9px;font-family:'IBM Plex Mono',monospace;font-size:14px;color:var(--ink)}
.bf-root input:focus,.bf-root select:focus,.bf-root button:focus{outline:2px solid var(--accent);outline-offset:1px}
.bf-suffix{font-family:'IBM Plex Mono',monospace;color:var(--muted)}
.bf-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.bf-check{display:flex;gap:8px;align-items:center;margin:6px 0 10px;cursor:pointer}

.bf-nk{border-top:1px dashed var(--line);padding-top:8px;font-size:13px}
.bf-nk div{display:flex;justify-content:space-between;padding:2px 0}
.bf-nk b{font-family:'IBM Plex Mono',monospace;font-weight:500}
.bf-nk-sum{border-top:1px solid var(--ink);margin-top:4px;padding-top:4px!important;font-weight:600}

.bf-toggle{margin-top:14px;width:100%;text-align:left;background:none;border:none;border-top:1px solid var(--line);
  padding:12px 0 4px;font:inherit;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.06em;cursor:pointer;color:var(--ink)}
.bf-zins{margin-top:8px}
.bf-note{font-size:12px;color:var(--muted);margin:8px 0 0}

.bf-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px}
.bf-kpi{background:var(--panel);border:1px solid var(--line);padding:12px 14px}
.bf-kpi span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.bf-kpi strong{font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:500}
.bf-kpi.bf-warn{border-color:var(--warn)}.bf-kpi.bf-warn strong{color:var(--warn)}

.bf-banner{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--accent);padding:10px 14px;margin:0 0 14px;font-size:13px}
.bf-banner-warn{border-left-color:var(--warn)}

.bf-best{background:var(--ink);color:#F2F5F3;padding:16px 18px;margin-bottom:14px}
.bf-best-tag{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.1em;
  text-transform:uppercase;border:1px solid #6E8A7F;padding:2px 8px;margin-bottom:8px;color:#9FD9BD}
.bf-best h2{font-size:20px;margin-bottom:6px}
.bf-best p{margin:0;font-size:13px;color:#C9D4CE}

.bf-chart{margin-bottom:14px}
.bf-chart .recharts-legend-item{cursor:pointer}
.bf-chart .recharts-line-curve{cursor:pointer}

.bf-tablewrap{overflow-x:auto}
.bf-table{width:100%;border-collapse:collapse;font-size:13px;min-width:680px}
.bf-table th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);
  border-bottom:1.5px solid var(--ink);padding:6px 8px}
.bf-table td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
.bf-num{font-family:'IBM Plex Mono',monospace;white-space:nowrap}
.bf-dot{display:inline-block;width:10px;height:10px;margin-right:8px;vertical-align:-1px}
.bf-badge{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.07em;text-transform:uppercase;
  background:var(--accent);color:#fff;padding:2px 6px;margin-left:8px}
.bf-tr-best td{background:#EFF6F2}
.bf-tr-klick{cursor:pointer}
.bf-tr-fokus td{background:#DCEBE3}
.bf-tr-fokus td:first-child{font-weight:600}
.bf-tr-dim td{opacity:.4}
.bf-tr-dim td .bf-badge{opacity:1}
.bf-green{color:var(--accent)}.bf-amber{color:var(--amber)}.bf-red{color:var(--warn);font-weight:600}
.bf-muted{color:var(--muted);font-size:12px}
.bf-mini{border:1px solid var(--line);background:#FBFCFB;font:inherit;font-size:11px;padding:2px 8px;cursor:pointer}
.bf-detail{font-size:12.5px;color:var(--muted);border-left:3px solid var(--line);padding:6px 10px;margin:10px 0 0}

.bf-tabs{display:flex;width:fit-content;border:1.5px solid var(--ink);background:var(--panel);margin-bottom:14px}
.bf-tabs button{font:inherit;font-family:'Archivo',sans-serif;font-weight:700;font-size:13px;text-transform:uppercase;
  letter-spacing:.05em;padding:8px 18px;border:none;background:none;cursor:pointer;color:var(--ink)}
.bf-tabs button.on{background:var(--ink);color:#F2F5F3}
.bf-tabs button+button{border-left:1.5px solid var(--ink)}
.bf-limrow{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:420px}
.bf-th-sub{font-family:'IBM Plex Mono',monospace;font-size:10px;text-transform:none;letter-spacing:0;color:var(--muted);font-weight:400}
.bf-cell-sub{display:block;font-size:11px;color:var(--muted)}

.bf-footer{margin-top:18px;font-size:11.5px;color:var(--muted);border-top:1px solid var(--line);padding-top:10px}
@media (prefers-reduced-motion: no-preference){.bf-panel,.bf-best,.bf-kpi{transition:border-color .15s}}
.bf-row-actions{display:flex;gap:6px;justify-content:flex-end}
.bf-modal-backdrop{position:fixed;inset:0;background:rgba(28,40,38,.45);display:flex;align-items:center;justify-content:center;padding:20px;z-index:50}
.bf-modal{background:var(--panel);border:1px solid var(--line);max-width:900px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(28,40,38,.28)}
.bf-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid var(--line)}
.bf-modal-head h2{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:0}
.bf-modal-sub{font-size:12px;color:var(--muted);margin:3px 0 0}
.bf-modal-actions{display:flex;align-items:center;gap:10px;flex-shrink:0}
.bf-toggle{display:flex;border:1px solid var(--line);background:#FBFCFB}
.bf-toggle button{font:inherit;font-size:11px;text-transform:uppercase;letter-spacing:.05em;padding:5px 12px;border:none;background:transparent;cursor:pointer;color:var(--muted)}
.bf-toggle button.on{background:var(--ink);color:#fff}
.bf-modal-x{border:1px solid var(--line);background:#FBFCFB;font:inherit;font-size:14px;line-height:1;padding:5px 9px;cursor:pointer;color:var(--muted)}
.bf-modal-body{padding:16px 18px;overflow-y:auto}
.bf-tp-table tfoot td{border-top:2px solid var(--line);font-weight:700}
.bf-tp-zins{color:#C4703A}
.bf-tp-tilg{color:#2E7D5B}
.bf-tp-note{font-size:12px;color:var(--muted);line-height:1.5;background:#FAF3EC;border:1px solid #ECDCC9;border-left:3px solid #C4703A;padding:10px 12px;margin:14px 0 0}
`;
