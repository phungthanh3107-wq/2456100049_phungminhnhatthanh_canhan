(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Page fade in / out ---------- */
  function ready() { root.classList.add('is-ready'); }
  requestAnimationFrame(function () { requestAnimationFrame(ready); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) { root.classList.remove('is-leaving'); ready(); } });

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a || reduce || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname) return;
    e.preventDefault();
    root.classList.add('is-leaving');
    setTimeout(function () { location.href = a.href; }, 320);
  });

  /* ---------- Split big headings into masked lines ---------- */
  document.querySelectorAll('.hero h1, .page-heading h1, .about-text h2').forEach(function (h) {
    var lines = h.innerHTML.split(/<br\s*\/?>/i);
    h.innerHTML = lines.map(function (l, i) {
      return '<span class="line-mask" style="--d:' + (0.15 + i * 0.12) + 's"><span>' + l + '</span></span>';
    }).join('');
    h.setAttribute('data-reveal', 'mask');
  });

  /* ---------- Reveal targets ---------- */
  var groups = [
    ['.eyebrow, .hero-desc, .hero-actions, .hero-index, .heading-side, .interests-lead', 'up'],
    ['.hero-visual', 'scale'],
    ['.intro-strip > *', 'up'],
    ['.preview-grid > *', 'up'],
    ['.about-photo', 'left'],
    ['.about-text > p, .section-kicker', 'up'],
    ['.values-grid article', 'up'],
    ['.closing-note, .last-word', 'up'],
    ['.interest-item', 'right'],
    ['footer > *', 'up']
  ];
  groups.forEach(function (g) {
    var els = document.querySelectorAll(g[0]);
    els.forEach(function (el, i) {
      if (el.hasAttribute('data-reveal')) return;
      el.setAttribute('data-reveal', g[1]);
      if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', (i % 6) * 0.1 + 's');
    });
  });
  // the masked heading itself should not fade/translate
  document.querySelectorAll('[data-reveal="mask"]').forEach(function (h) { h.style.opacity = 1; h.style.transform = 'none'; });

  var targets = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(function (t) { io.observe(t); });
  } else {
    targets.forEach(function (t) { t.classList.add('is-in'); });
  }

  /* ---------- Pointer effects ---------- */
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.preview-card').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        c.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
    var hv = document.querySelector('.hero-visual');
    var frame = hv && hv.querySelector('.photo-frame');
    if (frame) {
      var wrap = document.createElement('div');
      wrap.className = 'tilt-wrap';
      frame.parentNode.insertBefore(wrap, frame);
      wrap.appendChild(frame);
      hv.addEventListener('pointermove', function (e) {
        var r = hv.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        wrap.style.transform = 'rotateY(' + x * 10 + 'deg) rotateX(' + -y * 10 + 'deg)';
      });
      hv.addEventListener('pointerleave', function () { wrap.style.transform = ''; });
    }
  }

  /* ---------- Generative lo-fi music (Web Audio, no files needed) ---------- */
  var KEY = 'nt-music';
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'music-toggle';
  btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = '<span class="music-disc" aria-hidden="true"></span><span class="music-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="music-label">PLAY MUSIC</span>';
  document.body.appendChild(btn);
  var label = btn.querySelector('.music-label');

  var ctx, master, lp, timer, playing = false, nextTime = 0, step = 0;
  var BPM = 74, STEP = 60 / BPM / 2; // eighth notes
  // Fmaj9 – Em7 – Dm9 – Cmaj7 (midi notes)
  var CHORDS = [[53, 57, 60, 64, 67], [52, 55, 59, 62, 67], [50, 53, 57, 60, 64], [48, 52, 55, 59, 62]];
  var BASS = [41, 40, 38, 36];
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function setup() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.4;
    lp.connect(master); master.connect(ctx.destination);
    // vinyl crackle
    var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.012 + (Math.random() < 0.0006 ? (Math.random() - 0.5) * 0.5 : 0);
    var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
    var g = ctx.createGain(); g.gain.value = 0.5;
    src.connect(hp); hp.connect(g); g.connect(lp); src.start();
    noiseBuf = buf;
  }
  var noiseBuf;

  function tone(freq, t, dur, type, vol, attack) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = (Math.random() - 0.5) * 12;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(lp); o.start(t); o.stop(t + dur + 0.05);
  }
  function kick(t) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g); g.connect(lp); o.start(t); o.stop(t + 0.4);
  }
  function hat(t, vol) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 6000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    s.connect(f); f.connect(g); g.connect(lp); s.start(t, Math.random()); s.stop(t + 0.08);
  }

  function schedule(t, s) {
    var bar = Math.floor(s / 8) % 4, beat = s % 8, chord = CHORDS[bar];
    var swing = beat % 2 ? STEP * 0.18 : 0;
    t += swing;
    if (beat === 0) {
      chord.forEach(function (n) { tone(hz(n), t, STEP * 8.5, 'triangle', 0.035, 0.4); tone(hz(n + 12), t, STEP * 7, 'sine', 0.012, 0.6); });
      tone(hz(BASS[bar]), t, STEP * 4, 'sine', 0.16, 0.02);
    }
    if (beat === 5) tone(hz(BASS[bar] + 7), t, STEP * 2, 'sine', 0.09, 0.02);
    if (beat === 0 || beat === 3 || (beat === 6 && Math.random() < 0.4)) kick(t);
    if (beat === 4) hat(t, 0.12);
    hat(t, beat % 2 ? 0.025 : 0.045);
    if (Math.random() < 0.38) {
      var n = chord[Math.floor(Math.random() * chord.length)] + 12;
      tone(hz(n), t, STEP * 3, 'sine', 0.05, 0.01);
    }
  }
  function tick() {
    while (nextTime < ctx.currentTime + 0.25) { schedule(nextTime, step); nextTime += STEP; step++; }
  }

  function start() {
    if (!ctx) setup();
    ctx.resume();
    nextTime = ctx.currentTime + 0.1;
    clearInterval(timer); timer = setInterval(tick, 50); tick();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.7, ctx.currentTime, 0.6);
    playing = true; render();
    try { localStorage.setItem(KEY, 'on'); } catch (e) {}
  }
  function stop() {
    if (ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      setTimeout(function () { if (!playing) { clearInterval(timer); ctx.suspend(); } }, 1200);
    }
    playing = false; render();
    try { localStorage.setItem(KEY, 'off'); } catch (e) {}
  }
  function render() {
    btn.classList.toggle('is-playing', playing);
    btn.classList.remove('is-waiting');
    btn.setAttribute('aria-pressed', String(playing));
    label.textContent = playing ? 'LO-FI · ON' : 'PLAY MUSIC';
  }
  btn.addEventListener('click', function (e) { e.stopPropagation(); playing ? stop() : start(); });

  // Keep music going across pages: browsers need a gesture, so resume on the first interaction.
  var pref; try { pref = localStorage.getItem(KEY); } catch (e) {}
  if (pref === 'on') {
    btn.classList.add('is-waiting');
    label.textContent = 'TAP TO RESUME';
    var resume = function (e) {
      if (btn.contains(e.target)) return cleanup();
      cleanup(); if (!playing) start();
    };
    var cleanup = function () { ['pointerdown', 'keydown'].forEach(function (ev) { document.removeEventListener(ev, resume, true); }); };
    ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, resume, true); });
  }
})();
