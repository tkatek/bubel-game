// Asset manifest: every critical image with verified relative URLs and the
// measured geometry the engine needs. Visible-bounds fractions were measured
// from the source PNGs (tools/prepare-hd.mjs keeps them stable: resampling
// scales bbox and canvas identically, so fractions survive).
//
// Cannon anchors refer to assets/images/optimized/cannon.png (cropped sprite):
//   socket centre (0.497, 0.4714), socket radius 0.1368 of width — measured
//   from the transparent hole (tools/socket.mjs).

export const BUBBLE_COLORS = ['red', 'blue', 'yellow', 'green'];

export const COLOR_NAMES = { red: 'Red', blue: 'Blue', yellow: 'Yellow', green: 'Green' };

// UI/contrast colours per bubble colour (guide dots, badges, chips).
export const COLOR_HEX = { red: '#ff5a5f', blue: '#129afc', yellow: '#fdd116', green: '#30c937' };

export const ASSETS = {
  bubbles: {
    red:    { url: 'assets/hd/bubble-red.png',    vis: { x: 0.0655, y: 0.0627, w: 0.8898, h: 0.8854 } },
    blue:   { url: 'assets/hd/bubble-blue.png',   vis: { x: 0.0991, y: 0.1165, w: 0.8207, h: 0.8147 } },
    yellow: { url: 'assets/hd/bubble-yellow.png', vis: { x: 0.0839, y: 0.0944, w: 0.8438, h: 0.8376 } },
    green:  { url: 'assets/hd/bubble-green.png',  vis: { x: 0.0557, y: 0.0535, w: 0.9010, h: 0.8994 } },
  },
  cannon: {
    url: 'assets/images/optimized/cannon.png',
    // fractions of the sprite's own width/height (1170x1035 crop, then resized)
    socket: { x: 0.497, y: 0.4714, r: 0.1368 },
    aspect: 1035 / 1170,
  },
  nextFrame: {
    url: 'assets/images/optimized/next-bubble-frame.png',
    hole: { x: 0.4993, y: 0.5322, r: 0.2279 }, // fraction of width
    aspect: 858 / 921,
  },
  owl: { url: 'assets/hd/owl.png', vis: { x: 0.0916, y: 0.0657, w: 0.9145, h: 0.9359 } },
  icons: {
    heart: 'assets/hd/heart.png',
    book: 'assets/hd/book.png',
    star: 'assets/hd/star.png',
    clock: 'assets/hd/clock.png',
    pause: 'assets/hd/pause.png',
    target: 'assets/hd/target.png',
    settings: 'assets/hd/settings.png',
    home: 'assets/hd/home.png',
    trophy: 'assets/hd/trophy.png',
    soundOn: 'assets/hd/sound-on.png',
    soundOff: 'assets/hd/sound-off.png',
  },
  panels: {
    questionBody: 'assets/images/optimized/question-bar-body.png',
    status: 'assets/images/optimized/status-panel.png',
    powerups: 'assets/images/optimized/powerups-panel.png',
    score: 'assets/images/optimized/score-container.png',
    settingsButton: 'assets/images/optimized/settings-button.png',
  },
  backgrounds: {
    desktop: 'assets/images/original/background-desktop.png',
    mobile: 'assets/images/original/background-mobile.png',
  },
};

const critical = [
  ...BUBBLE_COLORS.map((c) => ASSETS.bubbles[c].url),
  ASSETS.cannon.url,
  ASSETS.nextFrame.url,
  ASSETS.owl.url,
  ASSETS.backgrounds.desktop,
  ASSETS.backgrounds.mobile,
];

// Preload + decode the images the canvas draws every frame. Panels and icons
// used via <img>/CSS are allowed to stream in behind this gate.
export async function preloadCritical(onProgress) {
  const imgs = new Map();
  let done = 0;
  const jobs = critical.map(async (url) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await new Promise((resolve) => {
      if (img.complete && img.naturalWidth > 0) return resolve();
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', () => resolve(new Error(`failed: ${url}`)), { once: true });
    });
    try { if (img.decode) await img.decode(); } catch { /* decode() best effort; load already confirmed */ }
    done++;
    onProgress && onProgress(done / critical.length, url);
    if (img.naturalWidth === 0) throw new Error(`Asset failed to load: ${url}`);
    imgs.set(url, img);
  });
  await Promise.all(jobs);
  return {
    get: (url) => imgs.get(url),
    bubble: (color) => imgs.get(ASSETS.bubbles[color].url),
    cannon: () => imgs.get(ASSETS.cannon.url),
    owl: () => imgs.get(ASSETS.owl.url),
  };
}
