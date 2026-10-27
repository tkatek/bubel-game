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
    // Some hosts (embedded webviews, emulated/animated viewports) deliver the
    // final container size late, or drop the trailing ResizeObserver callback
    // entirely. These redundant triggers cost nothing — apply() no-ops when
    // the measured rect is unchanged — and keep the composition honest.
    this.onWinResize = () => measure();
    window.addEventListener('resize', this.onWinResize);
    window.addEventListener('orientationchange', this.onWinResize);
    this.bootPoll = setInterval(measure, 250);
    setTimeout(() => { if (this.bootPoll) { clearInterval(this.bootPoll); this.bootPoll = 0; } }, 3000);
    measure();
  }

  stop() {
    if (this.ro) this.ro.disconnect();
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.bootPoll) clearInterval(this.bootPoll);
    if (this.onWinResize) {
      window.removeEventListener('resize', this.onWinResize);
      window.removeEventListener('orientationchange', this.onWinResize);
    }
  }

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
    // skip redundant work: identical rect ⇒ identical mode/canvas/overlays
    const rectKey = `${Math.round(rect.width)}x${Math.round(rect.height)}x${window.devicePixelRatio || 1}`;
    if (rectKey === this._lastRectKey) return;
    this._lastRectKey = rectKey;
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

  // DOM overlays: the next-preview and owl are CSS-positioned relative to
  // the stage; layout only decides visibility. Phones hide the owl entirely
  // (the menu screen has its own mascot); tablet portrait keeps it when the
  // stage is tall enough that it cannot crowd the cannon or dock.
  placeOverlays() {
    const st = this.stage.getBoundingClientRect();
    if (this.mode === 'mobile') {
      this.nextWrap.style.display = 'none';
      this.owl.style.display = this.device === 'tablet' && st.height > 560 ? '' : 'none';
      return;
    }
    this.nextWrap.style.display = '';
    this.owl.style.display = st.width > 560 && st.height > 380 ? '' : 'none';
  }
}
