export function getFrontendHtml(paymentAddress: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Threat Intel API — Investigate</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --cf-orange: #f6821f;
    --cf-orange-hover: #e5760e;
    --cf-orange-light: #fff3e8;
    --cf-orange-ring: rgba(246, 130, 31, 0.15);

    --gray-0: #ffffff;
    --gray-1: #f9f9fa;
    --gray-2: #f2f2f4;
    --gray-3: #e5e7eb;
    --gray-4: #d1d3d8;
    --gray-5: #9da0a7;
    --gray-6: #6b7080;
    --gray-7: #404553;
    --gray-8: #2c2f3b;
    --gray-9: #1a1a2e;

    --success: #059669;
    --success-bg: #ecfdf5;
    --danger: #dc2626;
    --danger-bg: #fef2f2;
    --warning: #d97706;
    --warning-bg: #fffbeb;
    --info: #2563eb;

    --threat-low: #059669;
    --threat-low-bg: #ecfdf5;
    --threat-med: #d97706;
    --threat-med-bg: #fffbeb;
    --threat-high: #ea580c;
    --threat-high-bg: #fff7ed;
    --threat-crit: #dc2626;
    --threat-crit-bg: #fef2f2;

    --border: #e5e7eb;
    --border-hover: #d1d3d8;
    --border-focus: var(--cf-orange);

    --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.06);

    --radius-sm: 4px;
    --radius-md: 8px;
    --radius-lg: 12px;

    --sidebar-w: 248px;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: var(--gray-8);
    background: var(--gray-1);
    -webkit-font-smoothing: antialiased;
  }

  ::selection { background: var(--cf-orange-ring); color: var(--gray-9); }
  a { color: var(--cf-orange); text-decoration: none; }
  a:hover { text-decoration: underline; }

  code, pre, .mono {
    font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
    font-size: 13px;
  }

  /* ── Layout ── */
  .app-layout { display: flex; min-height: 100vh; }

  /* ── Sidebar ── */
  .sidebar {
    width: var(--sidebar-w);
    background: var(--gray-0);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0; left: 0; bottom: 0;
    z-index: 100;
    transition: transform 0.25s ease;
  }

  .sidebar-brand {
    padding: 20px 20px 16px;
    border-bottom: 1px solid var(--border);
  }
  .sidebar-brand .logo-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .sidebar-brand .logo-row svg { flex-shrink: 0; }
  .sidebar-brand .wordmark {
    font-size: 15px;
    font-weight: 700;
    color: var(--gray-9);
    letter-spacing: -0.01em;
  }
  .sidebar-brand .tagline {
    font-size: 11px;
    color: var(--gray-5);
    margin-top: 6px;
    line-height: 1.4;
  }

  .sidebar-nav { flex: 1; padding: 12px 0; }
  .sidebar-nav .nav-section-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--gray-5);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 16px 20px 6px;
  }
  .sidebar-nav a {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 20px;
    font-size: 13.5px;
    color: var(--gray-7);
    text-decoration: none;
    border-left: 3px solid transparent;
    transition: all 0.12s;
  }
  .sidebar-nav a:hover {
    background: var(--gray-1);
    color: var(--gray-9);
    text-decoration: none;
  }
  .sidebar-nav a.active {
    background: var(--cf-orange-light);
    color: var(--cf-orange);
    font-weight: 600;
    border-left-color: var(--cf-orange);
  }
  .sidebar-nav a svg { flex-shrink: 0; opacity: 0.6; }
  .sidebar-nav a.active svg { opacity: 1; }

  .sidebar-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .network-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--gray-6);
  }
  .network-indicator .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--success);
    flex-shrink: 0;
  }
  .protocol-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: var(--cf-orange-light);
    color: var(--cf-orange);
    padding: 3px 10px;
    border-radius: var(--radius-sm);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    width: fit-content;
  }

  /* ── Main Content ── */
  .main-content {
    flex: 1;
    margin-left: var(--sidebar-w);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ── Top Bar ── */
  .top-bar {
    background: var(--gray-0);
    border-bottom: 1px solid var(--border);
    padding: 0 32px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 50;
  }
  .breadcrumb {
    font-size: 13px;
    color: var(--gray-5);
  }
  .breadcrumb strong {
    color: var(--gray-8);
    font-weight: 600;
  }

  .top-bar-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .wallet-pill {
    display: none;
    align-items: center;
    gap: 10px;
    background: var(--gray-1);
    border: 1px solid var(--border);
    border-radius: 24px;
    padding: 5px 16px 5px 12px;
    font-size: 13px;
  }
  .wallet-pill.visible { display: flex; }
  .wallet-pill .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--success);
    flex-shrink: 0;
  }
  .wallet-pill .address {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: var(--gray-7);
    font-weight: 500;
  }
  .wallet-pill .divider {
    width: 1px;
    height: 16px;
    background: var(--border);
  }
  .wallet-pill .balance {
    font-weight: 600;
    color: var(--cf-orange);
    font-size: 12px;
  }

  /* ── Hamburger (mobile) ── */
  .hamburger {
    display: none;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--gray-7);
  }
  .sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.3);
    z-index: 99;
  }

  /* ── Page Content ── */
  .page-content {
    flex: 1;
    padding: 32px;
    max-width: 900px;
  }

  .page-header { margin-bottom: 28px; }
  .page-header h1 {
    font-size: 28px;
    font-weight: 700;
    color: var(--gray-9);
    letter-spacing: -0.02em;
    margin-bottom: 8px;
  }
  .page-header .description {
    font-size: 14px;
    color: var(--gray-6);
    max-width: 600px;
    line-height: 1.6;
    margin-bottom: 14px;
  }
  .page-header-badges {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .pricing-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--gray-0);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 5px 14px;
    font-size: 12.5px;
    color: var(--gray-7);
    font-weight: 500;
  }
  .pricing-badge .amount {
    color: var(--cf-orange);
    font-weight: 700;
  }
  .docs-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--cf-orange);
    font-size: 13px;
    font-weight: 500;
    padding: 6px 14px;
    border: 1px solid var(--cf-orange);
    border-radius: 20px;
    transition: background 0.12s;
  }
  .docs-link:hover {
    background: var(--cf-orange-light);
    text-decoration: none;
  }

  /* ── Search Bar ── */
  .search-container {
    display: flex;
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    transition: border-color 0.15s, box-shadow 0.15s;
    background: var(--gray-0);
    box-shadow: var(--shadow-sm);
  }
  .search-container:focus-within {
    border-color: var(--cf-orange);
    box-shadow: 0 0 0 3px var(--cf-orange-ring);
  }
  .search-icon {
    display: flex;
    align-items: center;
    padding: 0 0 0 16px;
    color: var(--gray-5);
  }
  .search-container input {
    flex: 1;
    border: none;
    padding: 13px 16px;
    font-size: 15px;
    font-family: inherit;
    color: var(--gray-9);
    background: transparent;
    outline: none;
  }
  .search-container input::placeholder { color: var(--gray-4); }
  .search-container .search-btn {
    background: var(--cf-orange);
    color: #fff;
    border: none;
    padding: 0 28px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s;
    white-space: nowrap;
  }
  .search-container .search-btn:hover { background: var(--cf-orange-hover); }
  .search-container .search-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Status Msg ── */
  .status-msg {
    font-size: 13px;
    color: var(--gray-5);
    min-height: 1.4em;
    margin-top: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .status-msg.error { color: var(--danger); }

  /* ── Spinner ── */
  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(246, 130, 31, 0.2);
    border-top-color: var(--cf-orange);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    vertical-align: middle;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Result Card ── */
  .result-card {
    background: var(--gray-0);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    margin-top: 20px;
    overflow: hidden;
    display: none;
    box-shadow: var(--shadow-sm);
  }
  .result-card.visible { display: block; }

  .result-section { border-bottom: 1px solid var(--border); }
  .result-section:last-child { border-bottom: none; }

  .result-section-header {
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    user-select: none;
    transition: background 0.1s;
  }
  .result-section-header:hover { background: var(--gray-1); }
  .result-section-header h3 {
    font-size: 14.5px;
    font-weight: 600;
    color: var(--gray-9);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .result-section-header .chevron {
    transition: transform 0.2s;
    color: var(--gray-5);
    flex-shrink: 0;
  }
  .result-section-header.open .chevron { transform: rotate(90deg); }

  .result-section-header .meta-right {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    color: var(--gray-5);
  }

  .result-section-body {
    padding: 0 24px 20px;
    display: none;
  }
  .result-section-body.open { display: block; }

  /* ── Key-Value Table ── */
  .kv-table { width: 100%; border-collapse: collapse; }
  .kv-table tr { border-bottom: 1px solid var(--gray-2); }
  .kv-table tr:last-child { border-bottom: none; }
  .kv-table td {
    padding: 11px 0;
    font-size: 13.5px;
    vertical-align: middle;
  }
  .kv-table td:first-child {
    color: var(--gray-6);
    font-weight: 500;
    width: 180px;
    padding-right: 24px;
  }
  .kv-table td:last-child { color: var(--gray-9); }
  .kv-table a { color: var(--info); }
  .kv-table a:hover { text-decoration: underline; }

  /* ── Threat Badge ── */
  .threat-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 12px;
    border-radius: 16px;
    font-size: 12.5px;
    font-weight: 600;
  }
  .threat-badge.low { background: var(--threat-low-bg); color: var(--threat-low); }
  .threat-badge.medium { background: var(--threat-med-bg); color: var(--threat-med); }
  .threat-badge.high { background: var(--threat-high-bg); color: var(--threat-high); }
  .threat-badge.critical { background: var(--threat-crit-bg); color: var(--threat-crit); }

  /* ── Score Bar ── */
  .score-bar-wrap {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .score-bar {
    width: 120px;
    height: 6px;
    background: var(--gray-2);
    border-radius: 3px;
    overflow: hidden;
  }
  .score-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.4s ease;
  }

  /* ── Category Pill ── */
  .cat-pill {
    display: inline-block;
    background: var(--gray-2);
    color: var(--gray-7);
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    margin-right: 5px;
    margin-bottom: 3px;
  }

  /* ── Code Block ── */
  .code-block {
    background: var(--gray-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 14px 16px;
    position: relative;
    margin-top: 8px;
  }
  .code-block code {
    font-size: 12px;
    color: var(--gray-6);
    word-break: break-all;
    line-height: 1.5;
  }
  .copy-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: var(--gray-0);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 3px 10px;
    font-size: 11px;
    font-family: inherit;
    color: var(--gray-6);
    cursor: pointer;
    transition: all 0.12s;
  }
  .copy-btn:hover { background: var(--gray-2); color: var(--gray-8); }

  /* ── JSON Syntax (for raw view) ── */
  .json-key { color: var(--gray-8); font-weight: 500; }
  .json-str { color: #059669; }
  .json-num { color: #dc2626; }
  .json-bool { color: #2563eb; }
  .json-null { color: var(--gray-5); }

  /* ── Section Divider ── */
  .section-divider {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: 44px 0 28px;
    color: var(--gray-5);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .section-divider::before, .section-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* ── Buttons ── */
  .btn-primary {
    background: var(--cf-orange);
    color: #fff;
    border: none;
    border-radius: var(--radius-md);
    padding: 10px 24px;
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s, box-shadow 0.12s;
  }
  .btn-primary:hover { background: var(--cf-orange-hover); box-shadow: var(--shadow-sm); }
  .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

  .btn-secondary {
    background: var(--gray-0);
    color: var(--gray-7);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 10px 24px;
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s;
  }
  .btn-secondary:hover { background: var(--gray-1); border-color: var(--border-hover); }

  .btn-outline-orange {
    background: transparent;
    color: var(--cf-orange);
    border: 1px solid var(--cf-orange);
    border-radius: var(--radius-md);
    padding: 8px 20px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .btn-outline-orange:hover { background: var(--cf-orange-light); }

  .btn-danger {
    background: var(--danger);
    color: #fff;
    border: none;
    border-radius: var(--radius-md);
    padding: 10px 20px;
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-danger:hover { background: #b91c1c; }

  /* ── Swarm Section ── */
  .swarm-card {
    background: var(--gray-0);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }
  .swarm-card-header {
    padding: 24px;
    border-bottom: 1px solid var(--border);
  }
  .swarm-card-header h2 {
    font-size: 18px;
    font-weight: 700;
    color: var(--gray-9);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .swarm-card-header .badge-advanced {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--gray-2);
    color: var(--gray-6);
    padding: 2px 8px;
    border-radius: 10px;
  }
  .swarm-card-header p {
    font-size: 13px;
    color: var(--gray-6);
  }

  .swarm-card-body { padding: 24px; }

  .config-panel {
    display: flex;
    gap: 20px;
    align-items: flex-end;
    flex-wrap: wrap;
  }
  .config-field { flex: 1; min-width: 130px; }
  .config-field label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--gray-6);
    margin-bottom: 6px;
  }
  .config-field input[type="number"] {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 14px;
    color: var(--gray-8);
    background: var(--gray-0);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .config-field input[type="number"]:focus {
    border-color: var(--cf-orange);
    box-shadow: 0 0 0 3px var(--cf-orange-ring);
  }
  .config-cost {
    min-width: 120px;
    padding-bottom: 1px;
  }
  .config-cost .cost-value {
    font-size: 18px;
    font-weight: 700;
    color: var(--cf-orange);
  }
  .config-cost .cost-label {
    font-size: 11px;
    color: var(--gray-5);
  }
  .config-actions {
    display: flex;
    gap: 8px;
    padding-bottom: 1px;
  }

  /* ── Stats Grid ── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 20px;
    display: none;
  }
  .stats-grid.visible { display: grid; }
  .stat-card {
    background: var(--gray-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 16px;
    text-align: center;
  }
  .stat-card .val {
    font-size: 24px;
    font-weight: 700;
    color: var(--cf-orange);
    font-variant-numeric: tabular-nums;
  }
  .stat-card .lbl {
    font-size: 11px;
    color: var(--gray-5);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: 2px;
    font-weight: 500;
  }

  /* ── Activity Log ── */
  .activity-log {
    background: var(--gray-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 14px 16px;
    max-height: 280px;
    overflow-y: auto;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    margin-top: 16px;
    display: none;
  }
  .activity-log.visible { display: block; }
  .activity-log .entry {
    padding: 4px 0;
    border-bottom: 1px solid var(--gray-2);
    display: flex;
    gap: 8px;
    align-items: baseline;
    line-height: 1.5;
  }
  .activity-log .entry .msg { flex: 1; }
  .activity-log .entry .tx-col { flex-shrink: 0; }
  .activity-log .entry:last-child { border-bottom: none; }
  .activity-log .agent-tag {
    display: inline-block;
    background: var(--cf-orange-light);
    color: var(--cf-orange);
    font-size: 10px;
    font-weight: 600;
    padding: 1px 7px;
    border-radius: 8px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .activity-log .ok { color: var(--success); }
  .activity-log .err { color: var(--danger); }

  /* ── Footer ── */
  .page-footer {
    padding: 32px 0 20px;
    font-size: 12px;
    color: var(--gray-4);
    text-align: center;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .sidebar {
      transform: translateX(-100%);
    }
    body.sidebar-open .sidebar {
      transform: translateX(0);
    }
    body.sidebar-open .sidebar-overlay {
      display: block;
    }
    html, body { overflow-x: hidden; }
    .hamburger { display: flex; }
    .main-content { margin-left: 0; }
    .page-content { padding: 20px 16px; }
    .top-bar { padding: 0 12px; }
    .config-panel { flex-direction: column; align-items: stretch; }

    /* Top bar: compact wallet + connect */
    .top-bar-right { min-width: 0; gap: 8px; }
    .wallet-pill .address,
    .wallet-pill .divider { display: none; }
    .wallet-pill { padding: 5px 10px; }
    #connectBtn { padding: 6px 12px; font-size: 12px; }

    /* Search button: tighter padding */
    .search-container .search-btn { padding: 0 18px; font-size: 13px; }

    /* Stats: 3-col instead of 2-col, tighter fit */
    .stats-grid.visible { grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .stat-card { padding: 12px 8px; }
    .stat-card .val { font-size: 20px; }

    /* Swarm card: reduce padding */
    .swarm-card-header { padding: 16px; }
    .swarm-card-body { padding: 16px; }

    /* Result section header: wrap meta to second line */
    .result-section-header { flex-wrap: wrap; padding: 12px 16px; }
    .result-section-header .meta-right {
      flex-basis: 100%;
      padding-left: 22px;
      margin-top: 4px;
    }
    .result-section-body { padding: 0 16px 16px; }

    /* Activity log: wrap entries into 2 lines */
    .activity-log { padding: 10px 12px; }
    .activity-log .entry {
      flex-wrap: wrap;
      gap: 4px 8px;
      padding: 5px 0;
    }
    .activity-log .entry::before {
      content: '';
      flex-basis: 100%;
      height: 0;
      order: 2;
    }
    .activity-log .entry .msg {
      flex: 1;
      order: 3;
    }
    .activity-log .entry .tx-col {
      order: 4;
    }

    /* Tighter section spacing */
    .section-divider { margin: 32px 0 20px; }
    .stats-grid { margin-top: 14px; }

    /* Full-width buttons in stacked config */
    .config-actions { width: 100%; }
    .config-actions .btn-primary,
    .config-actions .btn-danger { flex: 1; }
  }
</style>
</head>
<body>
<div class="app-layout">
  <!-- Sidebar -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
      <div class="logo-row">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="#f6821f"/>
          <path d="M14 6L8 10v5l6 7 6-7v-5L14 6z" fill="#fff" opacity="0.95"/>
          <path d="M14 6l6 4v5l-6 7V6z" fill="#fff" opacity="0.75"/>
          <circle cx="14" cy="14" r="2.5" fill="#f6821f"/>
        </svg>
        <span class="wordmark">Threat Intel</span>
      </div>
      <div class="tagline">Security intelligence, pay per query</div>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-section-label">Security</div>
      <a href="#investigate" class="active" data-section="investigate" onclick="navTo(event, 'investigate')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>
        Investigate
      </a>
      <a href="#swarm" data-section="swarm" onclick="navTo(event, 'swarm')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a2 2 0 0 1 2 2v1H6V3a2 2 0 0 1 2-2zm3 3V3a3 3 0 0 0-6 0v1H3.5A1.5 1.5 0 0 0 2 5.5v8A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 12.5 4H11zM8 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>
        Swarm Demo
      </a>
      <div class="nav-section-label">Resources</div>
      <a href="https://docs.radiustech.xyz" target="_blank">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4.715 6.542L3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 6.5h-1.17a2 2 0 0 1-.283.293l-1.828 1.828A1 1 0 1 1 3.89 7.243L5.3 5.831a3.01 3.01 0 0 0-.586.711zm6.57 2.916l1.372-1.372a3 3 0 1 0-4.243-4.243L6.586 5.671A3 3 0 0 0 7.414 9.5h1.17a2 2 0 0 1 .283-.293l1.828-1.828a1 1 0 1 1 1.414 1.414l-1.41 1.411a3.01 3.01 0 0 0 .586-.711z"/></svg>
        API Docs
      </a>
    </nav>

    <div class="sidebar-footer">
      <div class="network-indicator">
        <span class="dot"></span>
        Radius Network
      </div>
      <div class="protocol-badge">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 0L0 3v4l5 3 5-3V3L5 0zM5 1.2l3.5 2.1v2.4L5 7.8 1.5 5.7V3.3L5 1.2z"/></svg>
        x402 Protocol
      </div>
    </div>
  </aside>

  <!-- Sidebar overlay (mobile) -->
  <div class="sidebar-overlay" onclick="closeSidebar()"></div>

  <!-- Main -->
  <main class="main-content">
    <header class="top-bar">
      <div style="display:flex;align-items:center;gap:12px;">
        <button class="hamburger" onclick="toggleSidebar()">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 5h14a1 1 0 110 2H3a1 1 0 010-2zm0 4h14a1 1 0 110 2H3a1 1 0 010-2zm0 4h14a1 1 0 110 2H3a1 1 0 010-2z"/></svg>
        </button>
        <div class="breadcrumb">Security &rsaquo; <strong>Investigate</strong></div>
      </div>
      <div class="top-bar-right">
        <div class="wallet-pill" id="walletInfo">
          <span class="status-dot"></span>
          <span class="address" id="walletAddr"></span>
          <span class="divider"></span>
          <span class="balance" id="walletBal">&mdash; SBC</span>
        </div>
        <button class="btn-outline-orange" id="connectBtn" onclick="connectWallet()">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M12.136.326A1.5 1.5 0 0 1 14 1.78V3h.5A1.5 1.5 0 0 1 16 4.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 13.5v-9A1.5 1.5 0 0 1 1.5 3H9V1.78a1.5 1.5 0 0 1 1.136-1.454l2-0.5zM11 3h2V1.78l-2 .5V3zM1.5 4a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-13zm10 3.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1z"/></svg>
          Connect Wallet
        </button>
      </div>
    </header>

    <div class="page-content">
      <!-- Page Header -->
      <div class="page-header" id="investigate">
        <h1>Investigate</h1>
        <p class="description">Dig into IP addresses, threat scores, bot probability, and geolocation data. Powered by x402 micropayments &mdash; no API key, no signup, pay only for what you use.</p>
        <div class="page-header-badges">
          <div class="pricing-badge">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="var(--cf-orange)"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" fill="none"/><text x="8" y="12" text-anchor="middle" font-size="10" fill="currentColor" font-weight="700">$</text></svg>
            <span class="amount">$0.0001</span> per query
          </div>
          <a href="#" class="docs-link" onclick="return false;">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v10a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 12.5v-10a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.81 8.985.936 8 1.783z"/></svg>
            Documentation
          </a>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="search-container">
        <div class="search-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>
        </div>
        <input type="text" id="ipInput" value="185.220.101.42" placeholder="Enter an IP address (e.g. 185.220.101.42)" />
        <button class="search-btn" id="queryBtn" onclick="runQuery()">Search</button>
      </div>
      <div class="status-msg" id="queryStatus"></div>

      <!-- Result Card -->
      <div class="result-card" id="queryResult">
        <!-- IP Overview Section -->
        <div class="result-section">
          <div class="result-section-header open" onclick="toggleSection('ipOverview')">
            <h3>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="var(--gray-5)" class="chevron" id="chevron-ipOverview" style="transform:rotate(90deg)"><path d="M5 1l6 6-6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
              IP address overview
              <span id="resultBadge"></span>
            </h3>
            <div class="meta-right">
              <span id="resultCostMeta"></span>
            </div>
          </div>
          <div class="result-section-body open" id="section-ipOverview">
            <table class="kv-table" id="kvTable"></table>
          </div>
        </div>

        <!-- Payment Details Section -->
        <div class="result-section">
          <div class="result-section-header" onclick="toggleSection('paymentDetails')">
            <h3>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="var(--gray-5)" class="chevron" id="chevron-paymentDetails"><path d="M5 1l6 6-6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Payment details
            </h3>
          </div>
          <div class="result-section-body" id="section-paymentDetails">
            <table class="kv-table" id="paymentTable"></table>
          </div>
        </div>

        <!-- Raw JSON Section -->
        <div class="result-section">
          <div class="result-section-header" onclick="toggleSection('rawJson')">
            <h3>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="var(--gray-5)" class="chevron" id="chevron-rawJson"><path d="M5 1l6 6-6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Raw JSON
            </h3>
            <div class="meta-right">
              <span style="color:var(--cf-orange);cursor:pointer;font-weight:500;">API &rsaquo;</span>
            </div>
          </div>
          <div class="result-section-body" id="section-rawJson">
            <div class="code-block">
              <button class="copy-btn" onclick="copyJson()">Copy</button>
              <pre id="queryJson" style="margin:0;"></pre>
            </div>
            <div class="code-block" style="margin-top:8px;">
              <button class="copy-btn" onclick="copyCurl()">Copy</button>
              <code id="curlCmd"></code>
            </div>
          </div>
        </div>
      </div>

      <!-- Swarm Section -->
      <div class="section-divider" id="swarm">Swarm Demo</div>

      <div class="swarm-card">
        <div class="swarm-card-header">
          <h2>
            Autonomous Agent Swarm
            <span class="badge-advanced">Advanced</span>
          </h2>
          <p>Launch parallel agents that independently query the threat intel API. Agents are funded from your wallet in a single batch transaction.</p>
        </div>
        <div class="swarm-card-body">
          <div class="config-panel">
            <div class="config-field">
              <label>Agents</label>
              <input type="number" id="swarmAgents" value="10" min="1" max="100" onchange="updateCost()" oninput="updateCost()" />
            </div>
            <div class="config-field">
              <label>Requests per agent</label>
              <input type="number" id="swarmCount" value="2" min="1" max="1000" onchange="updateCost()" oninput="updateCost()" />
            </div>
            <div class="config-cost">
              <div class="cost-value" id="swarmCost">0.0020 SBC</div>
              <div class="cost-label">Total cost</div>
            </div>
            <div class="config-actions">
              <button class="btn-primary" id="swarmBtn" onclick="launchSwarm()">Launch</button>
              <button class="btn-danger" id="swarmStop" onclick="stopSwarm()" style="display:none">Stop</button>
            </div>
          </div>
          <div class="status-msg" id="swarmStatus" style="margin-top:12px;"></div>

          <div class="stats-grid" id="swarmStats">
            <div class="stat-card"><div class="val" id="statTotal">0</div><div class="lbl">Requests</div></div>
            <div class="stat-card"><div class="val" id="statSpent">0</div><div class="lbl">SBC Spent</div></div>
            <div class="stat-card"><div class="val" id="statRps">0</div><div class="lbl">Req/s</div></div>
          </div>

          <div class="activity-log" id="swarmLog"></div>
        </div>
      </div>

      <div class="page-footer">Powered by Radius Network &middot; x402 Protocol</div>
    </div>
  </main>
</div>

<script type="module">
import { createSwarm, signX402Payment } from '/modules/swarm.js';
import { createWalletClient, custom } from 'https://esm.sh/viem';

const PAYMENT_ADDRESS = '${paymentAddress}';
const RADIUS_RPC = 'https://rpc.radiustech.xyz/cebu04iqsbb2xhuklnlnj68amqfukg8ayl32tuwga9ldsuf2';

const swarm = createSwarm({ paymentAddress: PAYMENT_ADDRESS, rpcUrl: RADIUS_RPC });

let connectedAddress = null;

// ── Sidebar / Nav ──

window.toggleSidebar = function() {
  document.body.classList.toggle('sidebar-open');
};
window.closeSidebar = function() {
  document.body.classList.remove('sidebar-open');
};
window.navTo = function(e, section) {
  e.preventDefault();
  document.querySelectorAll('.sidebar-nav a[data-section]').forEach(a => a.classList.remove('active'));
  e.currentTarget.classList.add('active');
  const el = document.getElementById(section);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  closeSidebar();
};

// ── Collapsible sections ──

window.toggleSection = function(id) {
  const body = document.getElementById('section-' + id);
  const chevron = document.getElementById('chevron-' + id);
  const header = chevron?.closest('.result-section-header');
  if (body && chevron) {
    const isOpen = body.classList.contains('open');
    if (isOpen) {
      body.classList.remove('open');
      chevron.style.transform = 'rotate(0deg)';
      header?.classList.remove('open');
    } else {
      body.classList.add('open');
      chevron.style.transform = 'rotate(90deg)';
      header?.classList.add('open');
    }
  }
};

// ── Threat level helpers ──

function threatLevel(score) {
  if (score <= 30) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 80) return 'high';
  return 'critical';
}

function threatColor(score) {
  if (score <= 30) return 'var(--threat-low)';
  if (score <= 60) return 'var(--threat-med)';
  if (score <= 80) return 'var(--threat-high)';
  return 'var(--threat-crit)';
}

function threatLabel(score) {
  if (score <= 30) return 'Low';
  if (score <= 60) return 'Medium';
  if (score <= 80) return 'High';
  return 'Critical';
}

// ── Render structured result ──

function renderStructuredResult(data) {
  const score = data.threat_score;
  const level = threatLevel(score);
  const color = threatColor(score);

  // Badge
  document.getElementById('resultBadge').innerHTML =
    '<span class="threat-badge ' + level + '">' + score + '/100 &middot; ' + threatLabel(score) + '</span>';

  // Cost meta + tx link
  const txLinkHtml = data.tx_hash ? '<a href="https://network.radiustech.xyz/tx/' + data.tx_hash + '" target="_blank" style="color:var(--cf-orange);text-decoration:none;font-family:JetBrains Mono,monospace;font-size:11px;">' + data.tx_hash.slice(0, 10) + '...' + data.tx_hash.slice(-6) + ' &#8599;</a> &middot; ' : '';
  document.getElementById('resultCostMeta').innerHTML =
    txLinkHtml + '<span style="color:var(--gray-5);font-size:11px;">' + data.request_cost + '</span>';

  // KV table
  const catPills = data.categories.map(c =>
    '<span class="cat-pill">' + c + '</span>'
  ).join('');

  const scoreBar =
    '<div class="score-bar-wrap">' +
      '<strong>' + score + '</strong>' +
      '<div class="score-bar"><div class="score-bar-fill" style="width:' + score + '%;background:' + color + '"></div></div>' +
    '</div>';

  const botBar =
    '<div class="score-bar-wrap">' +
      '<strong>' + (data.bot_probability * 100).toFixed(0) + '%</strong>' +
      '<div class="score-bar"><div class="score-bar-fill" style="width:' + (data.bot_probability * 100) + '%;background:' + threatColor(data.bot_probability * 100) + '"></div></div>' +
    '</div>';

  document.getElementById('kvTable').innerHTML =
    '<tr><td>IP address</td><td><strong>' + data.ip + '</strong></td></tr>' +
    '<tr><td>Threat score</td><td>' + scoreBar + '</td></tr>' +
    '<tr><td>Bot probability</td><td>' + botBar + '</td></tr>' +
    '<tr><td>Categories</td><td>' + catPills + '</td></tr>' +
    '<tr><td>Country</td><td>' + data.country + '</td></tr>' +
    '<tr><td>ISP</td><td>' + data.isp + '</td></tr>' +
    '<tr><td>First seen</td><td>' + data.first_seen + '</td></tr>';

  // Payment table
  document.getElementById('paymentTable').innerHTML =
    '<tr><td>Cost</td><td>' + data.request_cost + '</td></tr>' +
    '<tr><td>Settlement network</td><td>' + data.settlement_network + '</td></tr>' +
    (data.tx_hash ? '<tr><td>Transaction</td><td><a href="https://network.radiustech.xyz/tx/' + data.tx_hash + '" target="_blank" style="color:var(--cf-orange);text-decoration:none;">' + data.tx_hash.slice(0, 10) + '...' + data.tx_hash.slice(-8) + ' &#8599;</a></td></tr>' : '') +
    '<tr><td>Protocol</td><td><span class="protocol-badge" style="font-size:10px;"><svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor"><path d="M5 0L0 3v4l5 3 5-3V3L5 0zM5 1.2l3.5 2.1v2.4L5 7.8 1.5 5.7V3.3L5 1.2z"/></svg>x402 v2</span></td></tr>';
}

// ── Wallet Connection ──

window.connectWallet = async function() {
  const btn = document.getElementById('connectBtn');
  if (!window.ethereum) { alert('MetaMask not found. Please install it.'); return; }
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Connecting...';
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    connectedAddress = accounts[0];

    const chainIdHex = '0x' + swarm.config.chainId.toString(16);
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
    } catch (switchErr) {
      if (switchErr.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainIdHex,
            chainName: swarm.config.chainName,
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [swarm.config.rpcUrl],
          }]
        });
      }
    }

    window.walletClient = createWalletClient({
      chain: swarm.chain,
      transport: custom(window.ethereum),
    });

    const short = connectedAddress.slice(0, 6) + '...' + connectedAddress.slice(-4);
    document.getElementById('walletAddr').textContent = short;
    document.getElementById('walletInfo').classList.add('visible');
    btn.innerHTML = 'Connected';
    btn.style.borderColor = 'var(--success)';
    btn.style.color = 'var(--success)';

    try {
      const bal = await swarm.getBalance(connectedAddress);
      const formatted = (Number(bal) / 1e6).toFixed(4);
      document.getElementById('walletBal').textContent = formatted + ' SBC';
    } catch (e) {
      document.getElementById('walletBal').textContent = '— SBC';
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M12.136.326A1.5 1.5 0 0 1 14 1.78V3h.5A1.5 1.5 0 0 1 16 4.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 13.5v-9A1.5 1.5 0 0 1 1.5 3H9V1.78a1.5 1.5 0 0 1 1.136-1.454l2-0.5zM11 3h2V1.78l-2 .5V3zM1.5 4a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-13zm10 3.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1z"/></svg> Connect Wallet';
    console.error(err);
  }
};

// ── Manual Query ──

window.runQuery = async function() {
  if (!connectedAddress) { connectWallet(); return; }
  const ip = document.getElementById('ipInput').value.trim();
  if (!ip) return;
  const statusEl = document.getElementById('queryStatus');
  const resultEl = document.getElementById('queryResult');
  const queryBtn = document.getElementById('queryBtn');
  queryBtn.disabled = true;
  statusEl.className = 'status-msg';
  statusEl.innerHTML = '<span class="spinner"></span>Requesting payment terms...';
  resultEl.classList.remove('visible');

  const t0 = Date.now();
  try {
    const resource = window.location.origin + '/api/threat/' + encodeURIComponent(ip);

    const res402 = await fetch('/api/threat/' + encodeURIComponent(ip));
    if (res402.status !== 402) throw new Error('Expected 402, got ' + res402.status);
    const body402 = await res402.json();
    const req = body402.paymentRequirements[0];

    statusEl.innerHTML = '<span class="spinner"></span>Signing payment permits...';

    const permitNonce = await swarm.getNonce(connectedAddress);

    const { xPayment } = await signX402Payment({
      signTypedData: (params) => window.walletClient.signTypedData({ account: connectedAddress, ...params }),
      owner: connectedAddress,
      permitNonce: permitNonce,
      resource: { url: resource, description: 'Threat intel query for ' + ip, mimeType: 'application/json' },
      accepted: req,
      config: swarm.config,
    });

    statusEl.innerHTML = '<span class="spinner"></span>Settling payment...';

    const res = await fetch('/api/threat/' + encodeURIComponent(ip), {
      headers: { 'X-Payment': xPayment }
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error('Payment failed (' + res.status + '): ' + errText);
    }
    const data = await res.json();
    const elapsed = Date.now() - t0;

    // Render structured result
    renderStructuredResult(data);

    // Raw JSON
    document.getElementById('queryJson').innerHTML = syntaxHighlight(data);

    // Curl
    document.getElementById('curlCmd').textContent =
      'curl -H "X-Payment: ' + xPayment.slice(0, 40) + '..." ' + resource;

    resultEl.classList.add('visible');
    statusEl.textContent = '';

    // Refresh balance
    try {
      const bal = await swarm.getBalance(connectedAddress);
      document.getElementById('walletBal').textContent = (Number(bal) / 1e6).toFixed(4) + ' SBC';
    } catch(e) {}

  } catch (err) {
    statusEl.className = 'status-msg error';
    statusEl.textContent = err.message;
    console.error(err);
  } finally {
    queryBtn.disabled = false;
  }
};

window.copyJson = function() {
  const text = document.getElementById('queryJson').textContent;
  navigator.clipboard.writeText(text);
  const btn = document.querySelector('#section-rawJson .code-block:first-child .copy-btn');
  if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 1500); }
};

window.copyCurl = function() {
  const text = document.getElementById('curlCmd').textContent;
  navigator.clipboard.writeText(text);
  const btn = document.querySelector('#section-rawJson .code-block:last-child .copy-btn');
  if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 1500); }
};

// ── Swarm Demo ──

function randomIPs(count) {
  const ips = [];
  for (let i = 0; i < count; i++) {
    ips.push(Math.floor(Math.random()*223+1) + '.' + Math.floor(Math.random()*256) + '.' + Math.floor(Math.random()*256) + '.' + Math.floor(Math.random()*256));
  }
  return ips;
}

function generateThreatRequests(agentIndex, count) {
  return randomIPs(count).map(function(ip) {
    return {
      url: window.location.origin + '/api/threat/' + encodeURIComponent(ip),
      description: ip,
      mimeType: 'application/json',
    };
  });
}

window.updateCost = function() {
  const agentInput = document.getElementById('swarmAgents');
  let agents = parseInt(agentInput.value) || 1;
  if (agents > 100) {
    agents = 100;
    agentInput.value = 100;
    agentInput.style.outline = '2px solid #e74c3c';
    agentInput.title = 'Maximum 100 agents';
    setTimeout(() => { agentInput.style.outline = ''; agentInput.title = ''; }, 2000);
  }
  const perAgent = parseInt(document.getElementById('swarmCount').value) || 1;
  const costPerReq = Number(swarm.config.amountPerRequest);
  const totalUnits = agents * perAgent * costPerReq;
  const sbc = (totalUnits / 1e6).toFixed(4);
  document.getElementById('swarmCost').textContent = sbc + ' SBC';
};

window.launchSwarm = async function() {
  if (!connectedAddress) { connectWallet(); return; }
  const numAgents = parseInt(document.getElementById('swarmAgents').value) || 10;
  const perAgent = parseInt(document.getElementById('swarmCount').value) || 2;
  const statusEl = document.getElementById('swarmStatus');

  statusEl.className = 'status-msg';
  document.getElementById('swarmBtn').style.display = 'none';
  document.getElementById('swarmStop').style.display = '';
  document.getElementById('swarmStats').classList.add('visible');
  document.getElementById('swarmLog').classList.add('visible');
  document.getElementById('swarmLog').innerHTML = '';

  function logEntry(agentIdx, id, msg, isError, txHash) {
    const el = document.getElementById('swarmLog');
    const entry = document.createElement('div');
    entry.className = 'entry';
    const txCol = txHash ? '<a class="tx-col" href="https://network.radiustech.xyz/tx/' + txHash + '" target="_blank" style="color:var(--cf-orange);text-decoration:none;">tx &#8599;</a>' : (isError ? '' : '<span class="tx-col"></span>');
    entry.innerHTML = '<span class="agent-tag">Agent ' + (agentIdx+1) + '</span> <span style="color:var(--gray-5)">' + id + '</span> <span class="msg ' + (isError ? 'err' : 'ok') + '">' + msg + '</span>' + txCol;
    el.appendChild(entry);
    el.scrollTop = el.scrollHeight;
  }

  try {
    await swarm.launch({
      numAgents: numAgents,
      requestsPerAgent: perAgent,
      generateRequests: generateThreatRequests,
      callbacks: {
        onStatus: function(msg, isError) {
          if (isError) {
            statusEl.className = 'status-msg error';
            statusEl.textContent = msg;
          } else {
            statusEl.className = 'status-msg';
            statusEl.innerHTML = '<span class="spinner"></span>' + msg;
          }
        },
        onAgentLog: function(entry) {
          if (entry.isError) {
            logEntry(entry.agentIndex, entry.requestId, entry.message, true);
          } else {
            const data = entry.responseData || {};
            const vMs = data.verify_ms || 0;
            const sMs = data.settle_ms || 0;
            const nMs = Math.max(0, (entry.latencyMs || 0) - vMs - sMs);
            const msg = 'score: ' + data.threat_score + ' (' + (entry.latencyMs || 0) + 'ms: v' + vMs + '/s' + sMs + '/n' + nMs + ') \\u2192 0.0001 SBC';
            logEntry(entry.agentIndex, entry.requestId, msg, false, entry.txHash);
          }
        },
        onStatsUpdate: function(stats) {
          document.getElementById('statTotal').textContent = stats.totalRequests;
          document.getElementById('statSpent').textContent = (stats.totalSpentRaw / 1e6).toFixed(4);
          document.getElementById('statRps').textContent = stats.requestsPerSecond.toFixed(1);
        },
        onComplete: function(stats) {
          statusEl.textContent = 'Swarm complete. ' + stats.totalRequests + ' requests, ' + (stats.totalSpentRaw / 1e6).toFixed(4) + ' SBC spent.';
          swarm.getBalance(connectedAddress).then(function(bal) {
            document.getElementById('walletBal').textContent = (Number(bal) / 1e6).toFixed(4) + ' SBC';
          }).catch(function() {});
        },
      },
      walletClient: window.walletClient,
      address: connectedAddress,
    });
  } catch (err) {
    statusEl.className = 'status-msg error';
    statusEl.textContent = err.message;
    console.error(err);
  }

  document.getElementById('swarmBtn').style.display = '';
  document.getElementById('swarmStop').style.display = 'none';
};

window.stopSwarm = function() {
  swarm.stop();
  document.getElementById('swarmBtn').style.display = '';
  document.getElementById('swarmStop').style.display = 'none';
};

function syntaxHighlight(obj) {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/("(\\\\u[a-zA-Z0-9]{4}|\\\\[^u]|[^\\\\"])*"(\\s*:)?|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?)/g, (match) => {
    let cls = 'json-num';
    if (/^"/.test(match)) {
      cls = /:$/.test(match) ? 'json-key' : 'json-str';
    } else if (/true|false/.test(match)) {
      cls = 'json-bool';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}
</script>
</body>
</html>`;
}
