// Development-only overlay (?debug=1): pointer world position, muzzle,
// collision circles, playable bounds, predicted impact and active state.
// Never shown in production.

export const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

export class DebugOverlay {
  draw(ctx, game, world) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const v = world.view;
    const S = (p) => ({ x: p.x * v.scale + v.ox, y: p.y * v.scale + v.oy });

    // playable bounds
    ctx.strokeStyle = 'rgba(0,255,140,0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(v.ox, v.oy, world.W * v.scale, world.H * v.scale);

    ctx.setTransform(v.dpr * v.scale, 0, 0, v.dpr * v.scale, v.ox * v.dpr, v.oy * v.dpr);

    // collision circles
    ctx.strokeStyle = 'rgba(255,80,80,0.55)';
    for (const b of world.board.entries()) {
      const p = world.board.cellCenter(b.r, b.c, world.D);
      ctx.beginPath();
      ctx.arc(p.x, p.y, world.projectileR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '10px monospace';
      ctx.fillText(`${b.option ?? '·'}`, p.x - 4, p.y + 3);
    }

    // muzzle
    ctx.fillStyle = '#ffce3c';
    ctx.beginPath(); ctx.arc(world.muzzle.x, world.muzzle.y, 5, 0, Math.PI * 2); ctx.fill();

    // predicted impact
    const pred = game.predictLanding();
    if (pred && pred.landing.ok) {
      const p = world.board.cellCenter(pred.landing.cell[0], pred.landing.cell[1], world.D);
      ctx.strokeStyle = '#00e0ff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, world.projectileR * 0.8, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();

    // HUD text (screen space)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const scaleInfo = `world ${Math.round(world.W)}×${Math.round(world.H)} cols=${world.cols} view scale=${v.scale.toFixed(3)} dpr=${v.dpr}`;
    const pointer = game.lastPointerWorld
      ? `pointer w=(${game.lastPointerWorld.x.toFixed(0)},${game.lastPointerWorld.y.toFixed(0)})` : '';
    const lines = [
      `BPE debug — ${game.state.suspended ? 'SUSPENDED ' : ''}${game.state.phase}${game.state.shot ? ' shot:' + game.state.shot.id : ''}`,
      scaleInfo, pointer,
    ];
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(6, 4, 340, 16 * lines.length + 6);
    ctx.fillStyle = '#7fff9f';
    lines.forEach((l, i) => ctx.fillText(l, 10, 18 + i * 16));
    ctx.restore();
  }
}
