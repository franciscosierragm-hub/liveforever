"use strict";

// Canvas 2D: acercamiento, aceleración en perspectiva y salida a la superficie.
// Devuelve una función de cancelación y no mantiene trabajo tras cerrar la vista.
window.startHyperspace = function ({ canvas, snapshot, origin, color, planetId, onComplete, onStage, onArrival, duration = 2900 }) {
  const ctx = canvas.getContext("2d");
  const clamp = n => Math.max(0, Math.min(1, n));
  const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
  let seed = 7142;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const particles = Array.from({ length: innerWidth < 700 ? 340 : 650 }, () => {
    const angle = random() * Math.PI * 2;
    const radius = .05 + Math.pow(random(), .65) * 1.6;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: .1 + random() * 3, weight: .4 + random(), warm: random() > .86 };
  });
  let frame = 0, cancelled = false, last = 0, elapsed = 0, stage = "", arriving = false;
  canvas.style.opacity = "1";
  function render(time) {
    if (cancelled) return;
    const dt = last ? Math.min(time - last, 50) : 0;
    last = time; elapsed += dt;
    const t = elapsed / duration;
    const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#03060e"; ctx.fillRect(0, 0, w, h);
    const aiming = smooth(t / .24);
    const cx = w * (origin[0] + (.5 - origin[0]) * aiming);
    const cy = h * (origin[1] + (.47 - origin[1]) * aiming);
    if (t < .36) {
      const zoom = 1 + Math.pow(t / .36, 3) * 16;
      ctx.save(); ctx.globalAlpha = 1 - smooth((t - .14) / .20);
      ctx.translate(cx, cy); ctx.scale(zoom, zoom);
      ctx.drawImage(snapshot, -origin[0] * w, -origin[1] * h, w, h); ctx.restore();
    }
    const acceleration = smooth((t - .1) / .30);
    const deceleration = 1 - smooth((t - .73) / .22);
    const speed = (.08 + acceleration * 4.8) * deceleration;
    const visibility = smooth((t - .08) / .2) * (1 - smooth((t - .8) / .17));
    const focal = Math.max(w, h) * .65;
    ctx.lineCap = "round";
    for (const p of particles) {
      p.z -= dt / 1000 * speed;
      if (p.z <= .07) p.z += 3;
      const tailZ = p.z + (.006 + acceleration * .64) * deceleration;
      const x = cx + p.x / p.z * focal, y = cy + p.y / p.z * focal;
      const tx = cx + p.x / tailZ * focal, ty = cy + p.y / tailZ * focal;
      if (Math.max(x, tx) < 0 || Math.min(x, tx) > w || Math.max(y, ty) < 0 || Math.min(y, ty) > h) continue;
      const alpha = visibility * Math.min(.95, .20 + 1 / (p.z * 2)) * p.weight;
      const rgb = p.warm ? color.join(",") : "180,216,255";
      const gradient = ctx.createLinearGradient(tx, ty, x + .01, y + .01);
      gradient.addColorStop(0, "rgba(" + rgb + ",0)");
      gradient.addColorStop(.6, "rgba(" + rgb + "," + alpha * .42 + ")");
      gradient.addColorStop(1, "rgba(235,245,255," + Math.min(1, alpha) + ")");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = Math.min(3, p.weight * (.5 + .8 / p.z));
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    }
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * .5);
    halo.addColorStop(0, "rgba(153,207,255," + .22 * visibility * acceleration + ")");
    halo.addColorStop(.16, "rgba(75,128,215," + .12 * visibility + ")");
    halo.addColorStop(1, "rgba(8,16,32,0)");
    ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);
    const destination = (window.CONSTELLATION.find(node => node.id === planetId) || {}).name || "";
    const next = t < .24 ? "Approaching the star" : t < .7 ? "Crossing interstellar space" : "Arriving at " + destination;
    if (next !== stage) { stage = next; onStage?.(next); }
    canvas.style.opacity = String(1 - smooth((t - .74) / .26));
    if (t >= .74 && !arriving) { arriving = true; onArrival?.(); }
    if (t < 1) frame = requestAnimationFrame(render);
    else { cancelled = true; onComplete(); }
  }
  frame = requestAnimationFrame(render);
  return () => { cancelled = true; cancelAnimationFrame(frame); };
};

// Opening for the Future galaxy: a short text, then the title receding into the stars.
window.startFarAway = function ({ canvas, snapshot, origin, title, onComplete, onArrival, duration = 7600 }) {
  const ctx = canvas.getContext("2d");
  const clamp = n => Math.max(0, Math.min(1, n));
  const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
  let seed = 2077;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const stars = Array.from({ length: 420 }, () => ({ x: random(), y: random(), r: .3 + Math.pow(random(), 4) * 1.4, a: .25 + random() * .7 }));
  let frame = 0, cancelled = false, last = 0, elapsed = 0, arriving = false;
  canvas.style.opacity = "1";
  function render(time) {
    if (cancelled) return;
    const dt = last ? Math.min(time - last, 50) : 0;
    last = time; elapsed += dt;
    const t = elapsed / duration;
    const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
    // Fall into the galaxy, then hold a still starfield.
    if (t < .14) {
      const zoom = 1 + Math.pow(t / .14, 2.4) * 9;
      ctx.save(); ctx.globalAlpha = 1 - smooth(t / .14);
      ctx.translate(origin[0] * w, origin[1] * h); ctx.scale(zoom, zoom);
      ctx.drawImage(snapshot, -origin[0] * w, -origin[1] * h, w, h); ctx.restore();
    }
    ctx.globalAlpha = smooth((t - .08) / .08) * (1 - smooth((t - .9) / .1));
    ctx.fillStyle = "#fff";
    for (const s of stars) ctx.fillRect(s.x * w, s.y * h, s.r, s.r);
    ctx.globalAlpha = 1;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    // "A long time from now…"
    const intro = smooth((t - .14) / .06) * (1 - smooth((t - .36) / .06));
    if (intro > 0) {
      const size = Math.max(18, Math.min(34, w / 26));
      ctx.globalAlpha = intro;
      ctx.fillStyle = "#4bd5ee";
      ctx.font = "400 " + size + "px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("A long time from now, in a galaxy", w / 2, h / 2 - size * .75);
      ctx.fillText("far, far away…", w / 2, h / 2 + size * .75);
    }
    // The title starts huge and recedes towards the centre.
    const p = clamp((t - .44) / .44);
    if (t > .44 && p < 1) {
      const words = String(title).toUpperCase().split(" ");
      const base = Math.min(w * .9 / Math.max(...words.map(word => word.length)) * 1.45, h * .3);
      const size = base * Math.pow(1 - p, 1.6) * 1.15;
      ctx.globalAlpha = Math.min(1, p * 12) * (1 - smooth((p - .75) / .25));
      ctx.font = "900 " + size + "px 'Arial Black', 'Segoe UI', Arial, sans-serif";
      ctx.lineJoin = "round"; ctx.lineWidth = Math.max(1, size * .045);
      ctx.strokeStyle = "#ffe81f"; ctx.fillStyle = "#000";
      words.forEach((word, i) => {
        const y = h / 2 + (i - (words.length - 1) / 2) * size * 1.02;
        ctx.fillText(word, w / 2, y); ctx.strokeText(word, w / 2, y);
      });
    }
    canvas.style.opacity = String(1 - smooth((t - .86) / .14));
    if (t >= .86 && !arriving) { arriving = true; onArrival?.(); }
    if (t < 1) frame = requestAnimationFrame(render);
    else { cancelled = true; onComplete(); }
  }
  frame = requestAnimationFrame(render);
  return () => { cancelled = true; cancelAnimationFrame(frame); };
};
