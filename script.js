"use strict";

(() => {
  const nodes = window.CONSTELLATION;
  const canvas = document.querySelector("#sky");
  const ctx = canvas.getContext("2d");
  const field = document.createElement("canvas");
  const fieldCtx = field.getContext("2d");
  const container = document.querySelector("#constellation");
  const dialog = document.querySelector("#detail");
  const journey = document.querySelector("#journey");
  const indexDialog = document.querySelector("#site-index");
  const ambience = window.createAmbience(document.querySelector("#ambient"));
  const detailMotion = document.querySelector("#detail-motion-toggle");
  let visited = new Set();
  try { visited = new Set(JSON.parse(sessionStorage.getItem("visited-worlds") || "[]")); } catch { /* Private browsing can disable storage. */ }
  let cancelJourney = null;
  const worlds = window.LANDSCAPES;
  const landscape = document.querySelector("#planet-landscape");
  const loadedLandscapes = new Map();
  // Destinations share a quiet starfield instead of landscape photographs.
  let backdropUrl = null;
  function starBackdrop() {
    if (backdropUrl) return backdropUrl;
    const w = 1920, h = 1200, sky = document.createElement("canvas");
    sky.width = w; sky.height = h;
    const g = sky.getContext("2d"), rand = randomFactory(4242);
    g.fillStyle = "#070a10"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) glow(g, rand() * w, rand() * h, 120 + rand() * 360, [70, 86, 120], .05);
    for (let i = 0; i < 2600; i++) {
      const size = .3 + Math.pow(rand(), 6) * 1.6;
      g.fillStyle = rgba(i % 4 === 0 ? [190, 205, 235] : [225, 218, 205], .15 + rand() * .55);
      g.beginPath(); g.arc(rand() * w, rand() * h, size, 0, Math.PI * 2); g.fill();
    }
    backdropUrl = sky.toDataURL("image/jpeg", .86);
    return backdropUrl;
  }
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const motionButton = document.querySelector("#motion-toggle");
  let width = 0, height = 0, dpr = 1, scale = 1, originX = 0, originY = 0;
  let paused = reducedMotion.matches, hovered = null;
  let frame = 0, elapsed = 0, previousTime = 0, activeNode = null;
  let activeItemIndex = null, renderedHash = null;
  const pageTitle = document.title;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const buttons = new Map();
  const mobilePositions = {
    contact: [404, 230], about: [200, 60], research: [610, 70],
    university: [95, 265], knowledge: [712, 270], magazine: [130, 455], art: [700, 415],
    projects: [380, 540], future: [665, 535]
  };
  const centerNode = nodes.find(node => node.id === "contact");
  const galaxyNode = nodes.find(node => node.kind === "galaxy");
  const personalNodes = nodes.filter(node => node.group === "personal");
  const ringNodes = nodes.filter(node => node !== centerNode && node.group !== "personal")
    .sort((a, b) => Math.atan2(a.y - centerNode.y, a.x - centerNode.x) - Math.atan2(b.y - centerNode.y, b.x - centerNode.x));
  // Spiral particles of the Future mini-galaxy, in unit coordinates.
  const galaxyStars = (() => {
    let seed = 5150;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    return Array.from({ length: 900 }, (_, i) => {
      const t = Math.pow(rand(), .7), arm = i % 2;
      const angle = arm * Math.PI + t * 3.4 * Math.PI + (rand() - .5) * .9 * (1 - t * .5);
      const radius = t + (rand() - .5) * .08;
      const warmth = 1 - t;
      return { angle, radius, size: .4 + rand() * (1.1 - t * .6), alpha: .25 + rand() * .6,
        color: [Math.round(196 + 59 * warmth), Math.round(178 + 40 * warmth), Math.round(255 - 70 * warmth)] };
    });
  })();
  const satellites = [[255,160],[395,140],[220,250],[400,320],[520,150],[500,320],[290,400],[150,205],[640,250],[470,520]];
  let compact = false;
  function randomFactory(seed) {
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function project(x, y) { return [originX + x * scale, originY + y * scale]; }
  function nodePosition(node) {
    if (compact) return [width / 2, height / 2];
    return project(node.x, node.y);
  }
  function rgba(color, alpha) { return "rgba(" + color.join(",") + "," + alpha + ")"; }
  function glow(context, x, y, radius, color, strength) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, rgba(color, .42 * strength));
    gradient.addColorStop(.09, rgba(color, .27 * strength));
    gradient.addColorStop(.3, rgba(color, .10 * strength));
    gradient.addColorStop(.65, rgba(color, .025 * strength));
    gradient.addColorStop(1, rgba(color, 0));
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  function star(context, x, y, size, color, brightness = 1) {
    glow(context, x, y, size * 36, color, brightness);
    context.save();
    context.globalCompositeOperation = "screen";
    for (let axis = 0; axis < 4; axis++) {
      context.save();
      context.translate(x, y);
      context.rotate(axis * Math.PI / 2 + .025);
      const length = size * (axis % 2 === 0 ? 23 : 17);
      const ray = context.createLinearGradient(0, 0, length, 0);
      ray.addColorStop(0, rgba(color, .85 * brightness));
      ray.addColorStop(.18, rgba(color, .48 * brightness));
      ray.addColorStop(1, rgba(color, 0));
      context.fillStyle = ray;
      context.beginPath();
      context.moveTo(0, -size * .72);
      context.lineTo(length, 0);
      context.lineTo(0, size * .72);
      context.fill();
      context.restore();
    }
    context.shadowBlur = size * 7;
    context.shadowColor = rgba(color, 1);
    context.fillStyle = "#fff9ed";
    context.beginPath();
    context.arc(x, y, Math.max(.7, size * 1.95), 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  function makeField() {
    field.width = Math.round(width * dpr);
    field.height = Math.round(height * dpr);
    fieldCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fieldCtx.fillStyle = "#090b0e";
    fieldCtx.fillRect(0, 0, width, height);
    const rand = randomFactory(90210);
    for (let i = 0; i < 65; i++) {
      glow(fieldCtx, rand() * width, rand() * height, 40 + rand() * 180, [92, 100, 112], .035);
    }
    const count = Math.min(4200, Math.round(width * height / 265));
    for (let i = 0; i < count; i++) {
      const x = rand() * width, y = rand() * height;
      const size = .18 + Math.pow(rand(), 5) * .85;
      const alpha = .13 + rand() * .5;
      fieldCtx.fillStyle = rgba(i % 3 === 0 ? [187, 197, 215] : [216, 211, 203], alpha);
      fieldCtx.beginPath();
      fieldCtx.arc(x, y, size, 0, Math.PI * 2);
      fieldCtx.fill();
      if (i % 131 === 0) star(fieldCtx, x, y, .14 + rand() * .16, [204, 215, 237], .55);
    }
    const vignette = fieldCtx.createRadialGradient(width / 2, height / 2, width * .15, width / 2, height / 2, Math.max(width, height) * .72);
    vignette.addColorStop(0, "transparent");
    vignette.addColorStop(1, "#00000080");
    fieldCtx.fillStyle = vignette;
    fieldCtx.fillRect(0, 0, width, height);
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    compact = width < 1000;
    document.body.classList.toggle("compact-home", compact);
    // The constellation fills the area to the right of the introduction and above the featured work.
    const heroBox = document.querySelector(".hero").getBoundingClientRect();
    const featuredBox = document.querySelector(".featured").getBoundingClientRect();
    const left = Math.max(width * .37, heroBox.right + 16), right = width - 24, top = 74;
    const bottom = featuredBox.height ? featuredBox.top - 12 : height - 20;
    scale = Math.max(.3, Math.min((right - left) / 860, (bottom - top) / 590));
    originX = left + (right - left - 860 * scale) / 2;
    originY = top + (bottom - top - 571 * scale) / 2;
    makeField();
    // Labels grow and shrink with the constellation.
    container.style.setProperty("--r", compact ? 1 : Math.max(.78, Math.min(scale / 1.05, 1.25)).toFixed(3));
    nodes.forEach(node => {
      const [x, y] = nodePosition(node), button = buttons.get(node.id);
      button.style.left = compact ? "" : x + "px"; button.style.top = compact ? "" : y + "px";
    });
    draw();
  }
  function curve(a, b, bend) {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
    return [a, [a[0] + dx / 3 - dy * bend, a[1] + dy / 3 + dx * bend], [a[0] + dx * 2 / 3 - dy * bend, a[1] + dy * 2 / 3 + dx * bend], b, mx, my];
  }
  function spokes() {
    const center = nodePosition(centerNode);
    return ringNodes.map((node, i) => curve(center, nodePosition(node), i % 2 ? .08 : -.08));
  }
  function drawPaths() {
    ctx.lineWidth = .65;
    ctx.setLineDash([]);
    const center = nodePosition(centerNode);
    ctx.strokeStyle = "rgba(193,184,169,.32)";
    ringNodes.forEach((node, i) => {
      const [a, c1, c2, b] = curve(nodePosition(node), nodePosition(ringNodes[(i + 1) % ringNodes.length]), -.16);
      ctx.beginPath(); ctx.moveTo(...a); ctx.bezierCurveTo(...c1, ...c2, ...b); ctx.stroke();
    });
    spokes().forEach(([a, c1, c2, b]) => { ctx.beginPath(); ctx.moveTo(...a); ctx.bezierCurveTo(...c1, ...c2, ...b); ctx.stroke(); });
    ctx.setLineDash([2, 6]); ctx.strokeStyle = "rgba(193,184,169,.26)";
    personalNodes.forEach((node, i) => {
      if (!i) return;
      const a = nodePosition(personalNodes[i - 1]), b = nodePosition(node);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    });
    ctx.setLineDash([]);
    const ringScale = scale;
    [64, 82, 127, 186].forEach((radius, i) => {
      ctx.beginPath();
      ctx.setLineDash([.6, i < 3 ? 2.6 : 4.8]);
      ctx.strokeStyle = i < 3 ? "rgba(220,175,122,.35)" : "rgba(180,172,159,.22)";
      ctx.arc(...center, radius * ringScale, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.setLineDash([]);
    if (hovered) {
      const node = nodes.find(n => n.id === hovered);
      const p = nodePosition(node);
      ctx.lineWidth = .85; ctx.strokeStyle = rgba(node.color, .65);
      ctx.beginPath(); ctx.moveTo(...center); ctx.lineTo(...p); ctx.stroke();
    }
  }
  function drawGalaxy() {
    if (!galaxyNode) return;
    const [x, y] = nodePosition(galaxyNode);
    const radius = 50 * Math.max(.7, Math.min(scale, 1.5)) * (hovered === galaxyNode.id ? 1.12 : 1);
    const spin = elapsed * .00004, tilt = -.42, flatten = .5;
    glow(ctx, x, y, radius * 1.9, [214, 190, 255], hovered === galaxyNode.id ? .9 : .6);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    galaxyStars.forEach(s => {
      const a = s.angle + spin;
      const px = Math.cos(a) * s.radius * radius, py = Math.sin(a) * s.radius * radius * flatten;
      const gx = x + px * Math.cos(tilt) - py * Math.sin(tilt), gy = y + px * Math.sin(tilt) + py * Math.cos(tilt);
      ctx.fillStyle = rgba(s.color, s.alpha);
      ctx.fillRect(gx, gy, s.size, s.size);
    });
    ctx.restore();
    glow(ctx, x, y, radius * .45, [255, 236, 205], 1.4);
    ctx.fillStyle = "#fff6e6"; ctx.beginPath(); ctx.arc(x, y, Math.max(1.2, radius * .05), 0, Math.PI * 2); ctx.fill();
  }
  function draw() {
    if (!width) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(field, 0, 0, width, height);
    ctx.save();
    ctx.translate(pointer.x, pointer.y);
    if (compact) { ctx.restore(); return; }
    drawPaths();
    satellites.forEach(([x, y], i) => {
      const p = project(x, y);
      star(ctx, ...p, (i % 3 === 0 ? .44 : .29) * Math.max(.8, scale), i === 4 ? [217, 233, 255] : [255, 195, 141], .9);
    });
    drawGalaxy();
    const [hx, hy] = nodePosition(centerNode);
    glow(ctx, hx, hy, 120 * scale, [255, 195, 141], hovered === centerNode.id ? .9 : .6);
    ringNodes.concat(personalNodes.filter(node => node !== galaxyNode)).forEach(node => {
      const p = nodePosition(node);
      const size = 1.3 * node.size * Math.max(.84, Math.min(scale, 1.7));
      star(ctx, ...p, size, node.color, hovered === node.id ? 1.2 : 1);
    });
    // Small points travel along the spokes very slowly.
    spokes().forEach((p, i) => {
      const t = (elapsed * .000018 + i * .19) % 1, u = 1 - t;
      const x = u*u*u*p[0][0] + 3*u*u*t*p[1][0] + 3*u*t*t*p[2][0] + t*t*t*p[3][0];
      const y = u*u*u*p[0][1] + 3*u*u*t*p[1][1] + 3*u*t*t*p[2][1] + t*t*t*p[3][1];
      star(ctx, x, y, .23 * scale, [255, 208, 158], .7);
    });
    ctx.restore();
  }
  function animate(time) {
    const delta = previousTime ? Math.min(time - previousTime, 50) : 0;
    previousTime = time; elapsed += delta;
    pointer.x += (pointer.targetX - pointer.x) * .035;
    pointer.y += (pointer.targetY - pointer.y) * .035;
    draw();
    frame = requestAnimationFrame(animate);
  }
  function syncAnimation() {
    cancelAnimationFrame(frame); previousTime = 0;
    motionButton.setAttribute("aria-pressed", String(paused));
    document.querySelector("#motion-label").textContent = paused ? "Enable motion" : "Pause motion";
    document.querySelector("#motion-icon").textContent = paused ? "▷" : "Ⅱ";
    detailMotion.setAttribute("aria-pressed", String(paused));
    detailMotion.textContent = paused ? "Enable ambience" : "Pause ambience";
    detailMotion.hidden = !activeNode || !ambience.supports(activeNode.id) || dialog.classList.contains("travelling");
    ambience.set(activeNode?.id, !paused && !reducedMotion.matches && !document.hidden && dialog.open && !indexDialog.open && !dialog.classList.contains("travelling"));
    if (!paused && !document.hidden && !dialog.open && !indexDialog.open) frame = requestAnimationFrame(animate);
    else draw();
  }
  function previewText(node) {
    const unit = {projects:" projects", about:" roles", university:" areas", art:" works"}[node.id] || " stories";
    return node.name + " · " + (node.magazine ? node.magazine.pages.length + " pages" : node.items.length + unit);
  }
  function setHover(id) {
    hovered = id;
    document.querySelector("#destination-preview").textContent = id ? previewText(nodes.find(node=>node.id===id)) : "Or explore the constellation →";
    if (paused) draw();
  }
  function refreshLabels() {
    nodes.forEach(node => {
      const label = [node.name, node.subtitle];
      const button = buttons.get(node.id);
      button.querySelector(".star-name").textContent = label[0];
      button.querySelector(".star-subtitle").textContent = label[1];
      button.setAttribute("aria-label", "Explore " + previewText(node));
    });
    container.setAttribute("aria-label", "Portfolio destinations");
  }
  function finishJourney() {
    if (cancelJourney) cancelJourney();
    cancelJourney = null;
    dialog.classList.remove("travelling", "arriving");
    dialog.classList.add("arrived");
    document.querySelector(".gallery-content").inert = false;
    document.querySelector("#skip-journey").hidden = true;
    document.querySelector("#journey-caption").textContent = "";
    if (activeNode) document.querySelector("#announcement").textContent = "Arrived: " + activeNode.name;
    if (activeNode) {
      visited.add(activeNode.id);
      try { sessionStorage.setItem("visited-worlds", JSON.stringify([...visited])); } catch { /* Navigation also works without storage. */ }
    }
    document.querySelector("#close-detail").focus({ preventScroll: true });
    syncAnimation();
    showClickHint();
  }
  // A pointer demonstrates once per section that the cards can be opened.
  let hintsDone = new Set();
  try { hintsDone = new Set(JSON.parse(localStorage.getItem("click-hints-done") || "[]")); } catch { /* Storage may be unavailable. */ }
  function clearClickHint() { document.querySelectorAll(".click-hint").forEach(hint => hint.remove()); }
  function markHintDone(id) {
    hintsDone.add(id); clearClickHint();
    try { localStorage.setItem("click-hints-done", JSON.stringify([...hintsDone])); } catch { /* The hint simply returns next visit. */ }
  }
  function showClickHint() {
    clearClickHint();
    if (!activeNode || activeItemIndex !== null || hintsDone.has(activeNode.id)) return;
    const card = document.querySelector("#detail-items .detail-item, #detail-items .book-hint-target");
    if (!card) return;
    const hint = document.createElement("span"); hint.className = "click-hint"; hint.setAttribute("aria-hidden", "true");
    if (reducedMotion.matches) hint.classList.add("still");
    const media = card.querySelector(".project-thumbnail");
    hint.style.top = media ? (media.offsetTop + media.offsetHeight / 2) + "px" : "50%";
    hint.innerHTML = '<span class="click-ripple"></span><svg class="click-pointer" viewBox="0 0 24 24" width="44" height="44"><path d="M5 2.5v16.2l4.3-4 2.8 6.6 2.9-1.3-2.8-6.4h5.9z" fill="#fff" stroke="#0b0f15" stroke-width="1.3" stroke-linejoin="round"/></svg><span class="click-label">Click to open</span>';
    card.append(hint);
    hint.addEventListener("animationend", event => { if (event.animationName === "click-hint-out") hint.remove(); });
  }
  function startJourney(node, direct = false) {
    dialog.classList.remove("arrived", "arriving");
    if (direct || node.kind !== "galaxy" || reducedMotion.matches || paused) { finishJourney(); return; }
    dialog.classList.add("travelling");
    document.querySelector(".gallery-content").inert = true;
    document.querySelector("#skip-journey").hidden = false;
    syncAnimation();
    document.querySelector("#journey-caption").textContent = node.kind === "galaxy" ? "" : "Destination · " + node.name;
    const snapshot = document.createElement("canvas");
    snapshot.width = canvas.width; snapshot.height = canvas.height;
    snapshot.getContext("2d").drawImage(canvas, 0, 0);
    const position = nodePosition(node);
    if (node.kind === "galaxy") {
      cancelJourney = window.startFarAway({
        canvas: journey, snapshot, title: node.title,
        origin: [(position[0] + pointer.x) / width, (position[1] + pointer.y) / height],
        onComplete: finishJourney, onArrival: () => dialog.classList.add("arriving"),
        duration: visited.has(node.id) ? 3200 : 7600
      });
      return;
    }
    cancelJourney = window.startHyperspace({
      canvas: journey, snapshot,
      origin: [(position[0] + pointer.x) / width, (position[1] + pointer.y) / height],
      color: node.color, planetId: node.id, onComplete: finishJourney,
      onArrival: () => dialog.classList.add("arriving"),
      duration: visited.has(node.id) ? 1000 : 2900,
      onStage: text => { document.querySelector("#journey-caption").textContent = text; }
    });
  }
  function educationTable(rows) {
    const table = document.createElement("table"); table.className = "education-table";
    const head = table.createTHead().insertRow();
    ["Programme", "Institution", "Year"].forEach(label => { const th = document.createElement("th"); th.scope = "col"; th.textContent = label; head.append(th); });
    const body = table.createTBody();
    rows.forEach(([course, institution, year, main]) => {
      const row = body.insertRow(); if (main) row.className = "main-degree";
      [course, institution, year].forEach(value => { row.insertCell().textContent = value; });
    });
    return table;
  }
  // Static hosting ignores HTTP range requests, so the browser cannot seek a streamed
  // video. Play straight away, download the whole file in the background, then swap
  // to a local copy where the progress bar works.
  const videoCache = new Map();
  function enableSeeking(video, url) {
    const swap = blobUrl => {
      if (video.src === blobUrl) return;
      const time = video.currentTime, playing = !video.paused;
      video.addEventListener("loadedmetadata", () => {
        video.currentTime = time;
        if (playing) video.play().catch(() => {});
      }, { once: true });
      video.src = blobUrl;
    };
    if (videoCache.has(url) && typeof videoCache.get(url) === "string") { video.src = videoCache.get(url); return; }
    video.addEventListener("play", () => {
      if (!videoCache.has(url)) {
        videoCache.set(url, fetch(url).then(response => {
          if (!response.ok) throw new Error(response.status);
          return response.blob();
        }).then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          videoCache.set(url, blobUrl);
          return blobUrl;
        }).catch(() => { videoCache.delete(url); return null; }));
      }
      Promise.resolve(videoCache.get(url)).then(blobUrl => { if (blobUrl && video.isConnected) swap(blobUrl); });
    });
  }
  function renderStory(item) {
    const details = document.querySelector("#selection-details");
    details.querySelectorAll("video").forEach(video => video.pause());
    details.replaceChildren();
    const element = (tag, className, text) => {
      const el = document.createElement(tag); el.className = className;
      if (text) el.textContent = text;
      return el;
    };
    const figures = item.gallery || (item.image ? [{src:item.image, alt:item.imageAlt, caption:item.imageCaption}] : []);
    figures.forEach(entry => {
      const figure = element("figure", "project-figure");
      let picture;
      if (entry.video) {
        picture = element("video", "project-video");
        picture.controls = true; picture.preload = "none"; picture.playsInline = true;
        picture.poster = entry.poster || ""; picture.width = entry.width || 1280; picture.height = entry.height || 720;
        picture.setAttribute("aria-label", entry.alt || "");
        const source = element("source", ""); source.src = entry.video; source.type = "video/mp4"; picture.append(source);
        enableSeeking(picture, entry.video);
      } else {
        picture = element("img", ""); picture.src=entry.src; picture.alt=entry.alt || ""; picture.width=entry.width || 800; picture.height=entry.height || 420;
        picture.decoding = "async";
      }
      const caption = element("figcaption", "", entry.caption);
      if (entry.fullSize) {
        const link = element("a", "screenshot-link", "Open full-size screenshot ↗");
        link.href = entry.src; link.target = "_blank"; link.rel = "noopener noreferrer";
        link.setAttribute("aria-label", "Open full-size screenshot: " + entry.alt + " (new tab)");
        caption.append(link);
      }
      figure.append(picture, caption); details.append(figure);
    });
    if (item.table) details.append(educationTable(item.table));
    if (item.facts) {
      const facts = element("dl", "story-facts");
      item.facts.forEach(([label,value]) => {
        const pair = element("div", "story-fact");
        pair.append(element("dt", "", label), element("dd", "", value)); facts.append(pair);
      });
      details.append(facts);
    }
    (item.blocks || []).forEach(block => {
      const section = element("section", "story-block");
      section.append(element("h3", "", block.title), element("p", "", block.text)); details.append(section);
    });
    if (item.flow) {
      const flow = element("ol", "story-flow"); flow.setAttribute("aria-label", "Simplified system architecture");
      item.flow.forEach(step => flow.append(element("li", "", step))); details.append(flow);
    }
    if (item.tags) {
      const tags = element("ul", "story-tags"); tags.setAttribute("aria-label", "Tools and topics");
      item.tags.forEach(tag => tags.append(element("li", "", tag))); details.append(tags);
    }
    const actions = item.actions || (item.action ? [item.action] : []);
    if (actions.length) {
      const row = element("div", item.actionsFirst ? "story-actions story-actions-top" : "story-actions");
      actions.forEach(action => {
        const link = element("a", "story-action", action.label + (action.download ? " ↓" : " ↗"));
        link.href = action.href;
        if (action.download) link.download = "";
        if (action.newTab) { link.target = "_blank"; link.rel = "noopener noreferrer"; }
        row.append(link);
      });
      if (item.actionsFirst) details.prepend(row); else details.append(row);
    }
  }
  // Magazine: a book whose leaves turn in 3D. Two pages per spread on wide screens, one on phones.
  function renderMagazine(node) {
    const pages = node.magazine.pages;
    const wrap = document.createElement("section"); wrap.className = "magazine";
    wrap.setAttribute("aria-label", node.magazine.title + " — magazine, " + pages.length + " pages");
    const book = document.createElement("div"); book.className = "book";
    const stage = document.createElement("div"); stage.className = "book-stage"; stage.append(book);
    const status = document.createElement("p"); status.className = "book-status"; status.setAttribute("aria-live", "polite");
    const prev = document.createElement("button"); prev.className = "book-turn"; prev.textContent = "← Previous";
    const next = document.createElement("button"); next.className = "book-turn"; next.textContent = "Next page →";
    const controls = document.createElement("div"); controls.className = "book-controls"; controls.append(prev, status, next);
    wrap.append(stage, controls);
    let single = false, leaves = [], current = 0;
    const face = (page, side) => {
      const el = document.createElement("div"); el.className = "leaf-face " + side;
      if (page) { const img = document.createElement("img"); img.src = page.src; img.alt = page.alt; img.decoding = "async"; img.draggable = false; el.append(img); }
      else el.classList.add("blank");
      return el;
    };
    const last = () => leaves.length - (single ? 1 : 0);
    function build() {
      single = innerWidth < 760;
      book.classList.toggle("single", single);
      book.replaceChildren();
      const sheets = [];
      if (single) pages.forEach(page => sheets.push([page, null]));
      else for (let i = 0; i < pages.length; i += 2) sheets.push([pages[i], pages[i + 1] || null]);
      leaves = sheets.map(([front, back]) => {
        const leaf = document.createElement("div"); leaf.className = "leaf";
        leaf.append(face(front, "front"), face(back, "back"));
        leaf.addEventListener("click", () => { if (!swiped) turn(leaf.classList.contains("turned") ? -1 : 1); });
        book.append(leaf);
        return leaf;
      });
      book.classList.add("book-hint-target");
      current = Math.min(current, last());
      update(true);
    }
    function update(instant) {
      leaves.forEach((leaf, i) => {
        const turned = i < current;
        leaf.classList.toggle("turned", turned);
        leaf.classList.toggle("instant", Boolean(instant));
        if (instant || !leaf.classList.contains("moving")) leaf.style.zIndex = turned ? i + 1 : leaves.length - i;
      });
      book.classList.toggle("closed", !single && current === 0);
      book.classList.toggle("finished", !single && current === leaves.length);
      prev.disabled = current === 0; next.disabled = current >= last();
      if (single) status.textContent = "Page " + (current + 1) + " / " + pages.length;
      else {
        const left = current * 2, right = left + 1;
        status.textContent = current === 0 ? "Cover" : left > pages.length ? "Back cover" : "Pages " + left + (right <= pages.length ? "–" + right : "") + " / " + pages.length;
      }
    }
    function turn(step) {
      const target = current + step;
      if (target < 0 || target > last()) return;
      const leaf = leaves[step > 0 ? current : target];
      leaf.classList.add("moving"); leaf.style.zIndex = leaves.length + 2;
      setTimeout(() => { leaf.classList.remove("moving"); update(true); }, 900);
      current = target; markHintDone(node.id);
      update(false);
    }
    prev.addEventListener("click", () => turn(-1));
    next.addEventListener("click", () => turn(1));
    let startX = null, swiped = false;
    book.addEventListener("pointerdown", event => { startX = event.clientX; swiped = false; });
    book.addEventListener("pointerup", event => {
      if (startX !== null && Math.abs(event.clientX - startX) > 40) { swiped = true; turn(event.clientX < startX ? 1 : -1); }
      startX = null;
    });
    wrap.tabIndex = 0;
    wrap.addEventListener("keydown", event => {
      if (event.key === "ArrowRight") { turn(1); event.preventDefault(); }
      if (event.key === "ArrowLeft") { turn(-1); event.preventDefault(); }
    });
    let lastSingle = null;
    const onResize = () => { const now = innerWidth < 760; if (now !== lastSingle) { lastSingle = now; build(); } };
    addEventListener("resize", onResize);
    new MutationObserver((_, observer) => { if (!wrap.isConnected) { removeEventListener("resize", onResize); observer.disconnect(); } })
      .observe(document.querySelector("#detail-items"), { childList: true });
    onResize();
    return wrap;
  }
  function storyId(item) {
    return item.id || item.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function routeHash(node, itemIndex = null) {
    return node ? "#/" + node.id + (itemIndex === null ? "" : "/" + storyId(node.items[itemIndex])) : "";
  }
  function readRoute() {
    let parts;
    try { parts = decodeURIComponent(location.hash).replace(/^#\/?/, "").split("/"); }
    catch { return { node: null, itemIndex: null }; }
    const node = nodes.find(entry => entry.id === parts[0]) || null;
    const index = node && parts.length === 2 ? node.items.findIndex(item => storyId(item) === parts[1]) : -1;
    return { node, itemIndex: index >= 0 ? index : null };
  }
  function writeRoute(hash, replace = false) {
    const url = new URL(location.href); url.hash = hash;
    history[replace ? "replaceState" : "pushState"](null, "", url.href);
  }
  function selectStory(index, instant = false) {
    const previous = activeItemIndex;
    activeItemIndex = index;
    const selection = document.querySelector("#gallery-selection");
    const cards = document.querySelectorAll("#detail-items [data-story]");
    cards.forEach(card => card.setAttribute("aria-expanded", String(Number(card.dataset.story) === index)));
    selection.hidden = index === null;
    if (index === null) {
      selection.querySelectorAll("video").forEach(video => video.pause());
      if (previous !== null) cards[previous]?.focus({ preventScroll: true });
      if (previous !== null) cards[previous]?.scrollIntoView({ behavior: "instant", block: "nearest" });
      return;
    }
    const item = activeNode.items[index];
    document.querySelector("#selection-number").textContent = String(index + 1).padStart(2, "0");
    document.querySelector("#selection-title").textContent = item.title;
    document.querySelector("#selection-description").textContent = item.summary;
    document.querySelector("#story-back").textContent = "← Back to " + activeNode.name.toLowerCase();
    document.querySelector("#story-link").href = routeHash(activeNode, index);
    renderStory(item);
    selection.scrollIntoView({ behavior: instant || reducedMotion.matches || paused ? "instant" : "smooth", block: "start" });
    document.querySelector("#selection-title").focus({ preventScroll: true });
  }
  function renderRoute({ direct = true, instant = true } = {}) {
    const { node, itemIndex } = readRoute();
    const hash = routeHash(node, itemIndex);
    if (location.hash !== hash) writeRoute(hash, true);
    if (renderedHash === hash) return;
    renderedHash = hash;
    if (indexDialog.open) indexDialog.close();
    document.title = node ? (itemIndex === null ? node.title : node.items[itemIndex].title) + " — Francisco Sierra" : pageTitle;
    if (!node) {
      if (dialog.open) dialog.close();
      return;
    }
    if (dialog.open && activeNode === node && !cancelJourney) selectStory(itemIndex, instant);
    else showDetail(node, { direct, itemIndex });
  }
  function navigateTo(node = null, { itemIndex = null, direct = true } = {}) {
    const hash = routeHash(node, itemIndex);
    if (location.hash !== hash) writeRoute(hash);
    renderRoute({ direct, instant: false });
  }
  function showDetail(node, {direct = false, itemIndex = null} = {}) {
    if (cancelJourney) cancelJourney();
    cancelJourney = null; ambience.stop();
    clearClickHint();
    dialog.classList.remove("travelling", "arriving", "arrived");
    setHover(null);
    activeNode = node;
    activeItemIndex = null;
    const world = worlds[node.id];
    dialog.dataset.world = node.id;
    document.querySelector("#profile-actions").hidden = node.id !== "contact";
    document.querySelector("#profile-photo").hidden = node.id !== "contact";
    landscape.src = starBackdrop();
    const destinationColor = world.accent || node.color;
    dialog.style.setProperty("--detail-color", rgba(destinationColor, 1));
    dialog.style.setProperty("--gallery-tint", rgba(destinationColor, .12));
    document.querySelector("#detail-coordinate").textContent = "Francisco Sierra González / " + node.name;
    document.querySelector("#detail-eyebrow").textContent = node.eyebrow;
    document.querySelector("#detail-title").textContent = node.title;
    document.querySelector("#detail-description").textContent = node.description;
    const items = document.querySelector("#detail-items");
    items.replaceChildren();
    const entries = node.items;
    items.dataset.count = entries.length;
    items.dataset.layout = node.magazine ? "magazine" : {projects:"projects", research:"projects", art:"projects", about:"timeline", knowledge:"toolkit", university:"education"}[node.id] || "stories";
    const sectionLabels = {projects:[`${entries.length} projects & prototypes`, "Open a case study ↓"], about:["Professional experience", "Open each role ↓"], knowledge:["Tools in practice", "Follow the work ↗"], university:["Degrees & training", "By discipline"], research:["Research lines", "Choose a topic ↓"], future:["Possible futures", "Choose a signal ↓"], contact:["About me & contact", "Choose a story ↓"], art:["Latest works", "Open a piece ↓"], magazine:[node.magazine ? node.magazine.title : "", "Turn the pages →"]};
    const labels = sectionLabels[node.id] || ["Explore this world", "Choose a story ↓"];
    document.querySelector(".sector-heading").firstElementChild.textContent=labels[0];
    document.querySelector(".sector-heading").lastElementChild.textContent=labels[1];
    document.querySelector("#gallery-selection").hidden = true;
    document.querySelector("#gallery-index").textContent = String(nodes.indexOf(node) + 1).padStart(2, "0");
    document.querySelector("#gallery-total").textContent = String(nodes.length).padStart(2, "0");
    if (node.magazine) items.append(renderMagazine(node));
    entries.forEach((item, index) => {
      const {title, summary: description} = item;
      const row = document.createElement("button"); row.className = "detail-item";
      row.dataset.story = index;
      row.setAttribute("aria-expanded", "false"); row.setAttribute("aria-controls", "gallery-selection");
      const number = document.createElement("span"); number.className = "item-number"; number.textContent = String(index + 1).padStart(2, "0");
      const body = document.createElement("span"); body.className = "gallery-card-caption";
      const heading = document.createElement("span"); heading.className = "item-title"; heading.textContent = title;
      const text = document.createElement("span"); text.className = "gallery-card-action"; text.textContent = "Explore ↗";
      body.append(number, heading, text);
      if (item.image && ["projects","research","art"].includes(node.id)) {
        const picture=document.createElement("img"); picture.src=item.image;picture.alt="";picture.width=800;picture.height=420;picture.className="project-thumbnail";
        row.append(picture);
      }
      if (["projects","research","art"].includes(node.id) && item.category) {
        const context = document.createElement("span");
        context.className = "project-context";
        context.textContent = [item.category, item.status].filter(Boolean).join(" · ");
        row.append(context);
      }
      if (node.id === "about") {
        const date=document.createElement("span");date.className="timeline-date";date.textContent=item.period;row.append(date);
      }
      row.append(body);
      if (node.id === "university") {
        const group=document.createElement("article");group.className="education-group";
        const heading=document.createElement("h2");heading.className="education-title";heading.textContent=title;
        group.append(heading, educationTable(item.table));
        items.append(group);
        return;
      }
      if (["projects","research","art","about","knowledge"].includes(node.id)) {
        const summary=document.createElement("span");summary.className="card-summary";summary.textContent=description;row.append(summary);
      }
      if (node.id === "knowledge") {
        const group=document.createElement("article");group.className="tool-group";
        const tags=document.createElement("ul");tags.className="story-tags";
        (item.tags||[]).forEach(tag=>{const li=document.createElement("li");li.textContent=tag;tags.append(li);});
        group.append(row,tags);
        (item.related||[]).forEach(ref=>{
          const projectNode = nodes.find(n=>n.id==="projects");
          const projectIndex = ref.id ? projectNode.items.findIndex(item=>item.id===ref.id) : ref.index;
          if (!Number.isInteger(projectIndex) || projectIndex < 0 || projectIndex >= projectNode.items.length) return;
          const link=document.createElement("button");link.className="tool-project";link.textContent=ref.label+" ↗";
          link.addEventListener("click",()=>navigateTo(projectNode,{itemIndex:projectIndex}));group.append(link);
        });
        items.append(group);
      } else if (node.id === "about") {
        const entry=document.createElement("article");entry.className="timeline-entry";
        const highlights=document.createElement("ul");highlights.className="timeline-highlights";
        (item.blocks||[]).forEach(block=>{const li=document.createElement("li");const strong=document.createElement("strong");strong.textContent=block.title+": ";li.append(strong,block.text);highlights.append(li);});
        entry.append(row,highlights);items.append(entry);
      } else items.append(row);
      row.addEventListener("click", () => {
        markHintDone(node.id);
        navigateTo(node, { itemIndex: activeItemIndex === index ? null : index });
      });
    });
    document.querySelector("#detail-note").textContent = "Francisco Sierra González · Electrical, Electronics & Industrial AI Engineer";
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0; syncAnimation(); startJourney(node, direct);
    if (itemIndex !== null) selectStory(itemIndex, true);
  }
  nodes.forEach(node => {
    const button = document.createElement("button");
    button.className = node.kind === "galaxy" ? "star-button galaxy-button" : "star-button"; button.dataset.id = node.id;
    button.style.setProperty("--star-color", rgba(node.color, 1));
    if (node.group === "personal") button.classList.add("personal");
    button.innerHTML = (node === centerNode ? '<span class="star-photo"><img src="assets/francisco-sierra.jpg" alt="" width="900" height="900" decoding="async"></span>' : '') + '<span class="star-label"><span class="star-name"></span><span class="star-subtitle"></span></span>';
    button.addEventListener("pointerenter", () => setHover(node.id));
    button.addEventListener("pointerleave", () => { if(document.activeElement!==button)setHover(null); });
    button.addEventListener("focus", () => setHover(node.id));
    button.addEventListener("blur", () => setHover(null));
    button.addEventListener("click", () => navigateTo(node, { direct: false }));
    container.append(button); buttons.set(node.id, button);
  });
  // Featured work: the strongest case studies, one click from the home page.
  [["projects", "ht2000-ia"], ["projects", "f18-cockpit"], ["projects", "fal-ia"], ["research", "intelligent-industrial-machines"]].forEach(([nodeId, itemId]) => {
    const node = nodes.find(entry => entry.id === nodeId);
    const index = node ? node.items.findIndex(item => item.id === itemId) : -1;
    if (index < 0) return;
    const item = node.items[index];
    const card = document.createElement("a"); card.className = "featured-card"; card.href = routeHash(node, index);
    const thumb = document.createElement("span"); thumb.className = "featured-thumb";
    const img = document.createElement("img"); img.src = item.image; img.alt = ""; img.loading = "lazy"; thumb.append(img);
    if ((item.gallery || []).some(entry => entry.video)) { const play = document.createElement("span"); play.className = "featured-play"; play.textContent = "▶"; thumb.append(play); }
    const text = document.createElement("span"); text.className = "featured-text";
    const title = document.createElement("strong"); title.textContent = item.title;
    const meta = document.createElement("span"); meta.textContent = (item.gallery || []).some(entry => entry.video) ? "Video case study" : nodeId === "research" ? "Thesis · PDF" : item.category || "";
    text.append(title, meta); card.append(thumb, text);
    document.querySelector("#featured-cards").append(card);
  });
  function toggleMotion() { paused=!paused; if(paused && cancelJourney)finishJourney(); syncAnimation(); }
  motionButton.addEventListener("click", toggleMotion);
  detailMotion.addEventListener("click", toggleMotion);
  nodes.forEach(node=>{
    const entry=document.createElement("button");entry.className="index-entry";entry.dataset.destination=node.id;
    const title=document.createElement("span");title.textContent=node.name;
    const destination=document.createElement("span");destination.textContent=node.subtitle;
    entry.append(title,destination);
    entry.addEventListener("click",()=>{indexDialog.close();navigateTo(node);});
    document.querySelector("#index-destinations").append(entry);
  });
  document.querySelectorAll("[data-open-index]").forEach(button=>button.addEventListener("click",()=>{
    if(cancelJourney)finishJourney();indexDialog.showModal();syncAnimation();
  }));
  document.querySelector("#close-index").addEventListener("click",()=>indexDialog.close());
  indexDialog.addEventListener("cancel", event => {
    event.preventDefault();
    indexDialog.close();
  });
  indexDialog.addEventListener("close",syncAnimation);
  indexDialog.addEventListener("click",event=>{if(event.target!==indexDialog)return;const r=indexDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)indexDialog.close();});
  document.querySelector("#index-home").addEventListener("click",()=>{indexDialog.close();navigateTo();});
  reducedMotion.addEventListener("change", event => { paused = event.matches; if (event.matches && cancelJourney) finishJourney(); syncAnimation(); });
  document.querySelector("#skip-journey").addEventListener("click", finishJourney);
  document.querySelector("#close-detail").addEventListener("click", () => navigateTo());
  document.querySelector("#return-button").addEventListener("click", () => navigateTo());
  document.querySelector("#story-back").addEventListener("click", () => navigateTo(activeNode));
  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    if (activeItemIndex !== null) navigateTo(activeNode);
    else navigateTo();
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || event.isComposing || (!indexDialog.open && !dialog.open)) return;
    // Handle only the top layer, including browsers that group modal dismissals.
    event.preventDefault();
    if (event.repeat) return;
    if (indexDialog.open) indexDialog.close();
    else if (activeItemIndex !== null) navigateTo(activeNode);
    else navigateTo();
  });
  dialog.addEventListener("click", event => {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) navigateTo();
  });
  dialog.addEventListener("close", () => {
    // A queued close event must not cancel a newly opened destination.
    if (dialog.open) return;
    dialog.querySelectorAll("video").forEach(video => video.pause());
    if (cancelJourney) cancelJourney();
    cancelJourney = null;
    dialog.classList.remove("travelling", "arriving", "arrived");
    document.querySelector("#skip-journey").hidden = true;
    document.querySelector(".gallery-content").inert = false;
    document.querySelector("#journey-caption").textContent = "";
    if (activeNode) buttons.get(activeNode.id).focus();
    activeItemIndex = null;
    syncAnimation();
  });
  window.addEventListener("pointermove", event => {
    if (paused || event.pointerType === "touch") return;
    pointer.targetX = (event.clientX / width - .5) * 3;
    pointer.targetY = (event.clientY / height - .5) * 3;
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && cancelJourney) finishJourney(); syncAnimation(); });
  window.addEventListener("resize", resize);
  // Some sites (LinkedIn) drop the "#" part of shared links, so "?go=projects/ht2000-ia"
  // works as an alternative and is turned into the usual route.
  try {
    const go = new URLSearchParams(location.search).get("go");
    if (go && !location.hash) {
      const url = new URL(location.href); url.searchParams.delete("go"); url.hash = "#/" + go.replace(/^[#/]+/, "");
      history.replaceState(null, "", url.href);
    }
  } catch { /* Malformed links fall back to the constellation. */ }
  window.addEventListener("popstate", () => renderRoute());
  window.addEventListener("hashchange", () => renderRoute());
  refreshLabels(); resize(); syncAnimation();
  renderRoute();
})();
