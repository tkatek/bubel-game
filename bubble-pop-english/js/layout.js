// Layout: measures the host container (standalone or embedded), picks the
// composition family, sizes the canvas backing store, positions DOM overlays
// (next-bubble preview, owl) and keeps the world view in sync. Layout never
// scales the whole DOM — CSS grid does composition, this does geometry.

export class Layout {
  constructor(root, canvas, renderer) {
    this.root = root;
    this.canvas = canvas;
    this.renderer = renderer;
    this.stage = root.querySelector('#stage');
    this.nextWrap = root.querySelector('#nextWrap');
    this.owl = root.querySelector('#owlMascot');
    this.mode = 'desktop';
    this.orient = 'landscape';
    this.device = 'desktop';
    this.ro = null;
    this.onResize = null;       // set by game
    this.raf = 0;
  }

  start() {
    const measure = () => this.apply();
    this.ro = new ResizeObserver((entries) => {
      // coalesce to one layout per frame
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => { this.raf = 0; measure(); });
    });
    this.ro.observe(this.root);
    this.ro.observe(this.stage);
    measure();
  }

  stop() { if (this.ro) this.ro.disconnect(); if (this.raf) cancelAnimationFrame(this.raf); }

  decideMode(w, h) {
    const landscape = w >= h * 1.02;
    const orient = landscape ? 'landscape' : 'portrait';
    let mode, device;
    if (landscape) {
      // landscape phones get a compact desktop composition; tablets/desktop
      // the full one
      if (w >= 1024 && h >= 700) { mode = 'desktop'; device = 'desktop'; }
      else if (w >= 920) { mode = 'desktop'; device = 'tablet'; }
      else { mode = 'tablet'; device = 'phone'; } // short/compact landscape
    } else {
      mode = 'mobile';
      device = w < 480 || h < 700 ? 'phone' : 'tablet';
    }
    return { mode, orient, device };
  }

  apply() {
    const rect = this.root.getBoundingClientRect();
    const { mode, orient, device } = this.decideMode(rect.width, rect.height);
    this.mode = mode; this.orient = orient; this.device = device;
    this.root.dataset.mode = mode;
    this.root.dataset.orient = orient;
    this.root.dataset.device = device;

    const st = this.stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cssW = Math.max(50, Math.floor(st.width));
    const cssH = Math.max(50, Math.floor(st.height));
    this.cssW = cssW; this.cssH = cssH; this.dpr = dpr;
    this.renderer.resize(cssW, cssH, dpr);
    if (this.onResize) this.onResize({ mode, orient, device, cssW, cssH, dpr });
    this.placeOverlays();
  }

  // DOM overlays positioned relative to the stage, outside the active board.
  placeOverlays() {
    const st = this.stage.getBoundingClientRect();
    const rootRect = this.root.getBoundingClientRect();
    const rel = (el, x, y, w) => {
      el.style.left = `${x - rootRect.left}px`;
      el.style.top = `${y - rootRect.top}px`;
      el.style.width = `${w}px`;
      el.style.height = 'auto';
    };
    // desktop composition: preview sits beside the cannon (left), owl at the
    // bottom-right corner. Hidden entirely in mobile composition (the dock
    // holds the preview).
    if (this.mode === 'mobile') {
      this.nextWrap.style.display = 'none';
      this.owl.style.display = st.height > 460 ? '' : 'none';
      this.owl.style.left = ''; this.owl.style.top = ''; this.owl.style.width = '';
      return;
    }
    this.nextWrap.style.display = '';
    const pad = Math.max(10, st.width * 0.015);
    const w = clampNum(st.width * 0.075, 54, 84);
    rel(this.nextWrap, st.left + pad, st.bottom - w * 1.35 - pad, w);
    const owlW = clampNum(st.width * 0.12, 70, 130);
    this.owl.style.display = st.width > 560 ? '' : 'none';
    rel(this.owl, st.right - owlW - pad, st.bottom - owlW * 0.95 - pad, owlW);
  }
}

function clampNum(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
