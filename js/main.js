/**
 * Istanbul Dental Center — Main JS
 * Content-first approach: Lenis smooth scroll + IntersectionObserver reveals
 * + Scroll-driven frame sequence (tooth transformation story)
 * Premium Micro-Interactions: word split, clip-path reveals, magnetic buttons
 *
 * NO Three.js. Real photography leads.
 */

'use strict';

// ─── 1. Lenis Smooth Scroll ───────────────────────────────
const lenis = new Lenis({
  duration:    1.2,
  easing:      t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  touchMultiplier: 1.5,
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);


// ─── 2. Navigation — Scroll Compact + Backdrop ───────────
const nav = document.getElementById('nav');

lenis.on('scroll', ({ scroll }) => {
  nav.classList.toggle('scrolled', scroll > 60);
});


// ─── 3. Hero Title — Word-by-Word Reveal ──────────────────
// Premium signal: each word slides up from overflow:hidden container
function initHeroTitle() {
  const el = document.querySelector('.hero-title');
  if (!el) return;

  // Define words with em (gold) flag
  const words = [
    { text: 'The',     em: false },
    { text: 'World',   em: false },
    { text: 'Is',      em: false },
    { text: 'Worth',   em: false },
    { text: 'Smiling', em: true  },
    { text: 'For',     em: true  },
  ];

  el.innerHTML = '';
  el.setAttribute('aria-label', 'The World Is Worth Smiling For');

  words.forEach((w, i) => {
    const wrapper = document.createElement('span');
    wrapper.className = 'split-word-wrap';

    const inner = document.createElement('span');
    inner.textContent = w.text;
    inner.className = 'split-word' + (w.em ? ' split-word-em' : '');
    inner.style.transitionDelay = `${0.18 + i * 0.1}s`; // stagger after tag reveal

    wrapper.appendChild(inner);
    el.appendChild(wrapper);

    // Add line-break after "Worth" (index 3) for visual hierarchy
    if (i === 3) {
      el.appendChild(document.createElement('br'));
    }
  });
}
initHeroTitle();


// ─── 4. IntersectionObserver — Reveal & Clip-Path ─────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target); // fire once
    }
  });
}, {
  threshold: 0.12,
  rootMargin: '0px 0px -40px 0px',
});

// Observe .reveal, .reveal-stagger, AND clip-path reveal elements
document.querySelectorAll(
  '.reveal, .reveal-stagger, .clip-reveal, .clip-reveal-left, .clip-reveal-right'
).forEach(el => {
  revealObserver.observe(el);
});

// Hero reveals fire immediately (above fold)
function fireHeroReveals() {
  // Trigger tag + subtitle + actions reveals
  document.querySelectorAll('.hero-content .reveal').forEach((el, i) => {
    setTimeout(() => el.classList.add('visible'), 100 + i * 120);
  });

  // Trigger word-by-word hero title
  setTimeout(() => {
    document.querySelectorAll('.hero-title .split-word').forEach(word => {
      word.classList.add('visible');
    });
  }, 280);
}
// Small delay so Lenis initialises first
setTimeout(fireHeroReveals, 200);


// ─── 5. Subtle Parallax on Hero image ────────────────────
// Max 20px movement per manifesto
const parallaxImgs = document.querySelectorAll('.parallax-img');

lenis.on('scroll', ({ scroll }) => {
  parallaxImgs.forEach(img => {
    const rect = img.closest('section, .gallery-main')?.getBoundingClientRect();
    if (!rect) return;
    const relScroll = scroll / (document.body.scrollHeight - window.innerHeight);
    const offset = relScroll * 20; // max 20px
    img.style.transform = `translateY(${offset}px)`;
  });
});


// ─── 6. Magnetic Buttons ──────────────────────────────────
// Physical attraction effect — cursor pulls the button
// mouseleave uses elastic ease-back (0.4s cubic-bezier)
function initMagneticButtons() {
  document.querySelectorAll('.magnetic-btn').forEach(btn => {
    let isLeaving = false;

    btn.addEventListener('mouseenter', () => {
      isLeaving = false;
      btn.style.transition = 'background 0.3s var(--ease-out), box-shadow 0.3s var(--ease-out)';
      // No transform transition on enter — instant follow
    });

    btn.addEventListener('mousemove', (e) => {
      if (isLeaving) return;
      const rect = btn.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width  / 2) * 0.35;
      const y = (e.clientY - rect.top  - rect.height / 2) * 0.35;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      isLeaving = true;
      btn.style.transition = [
        'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'background 0.3s var(--ease-out)',
        'box-shadow 0.3s var(--ease-out)',
      ].join(', ');
      btn.style.transform = 'translate(0, 0)';
    });
  });
}
initMagneticButtons();


// ─── 7. Frame Sequence Controller ────────────────────────
// Scroll-driven tooth transformation — justified:
// it IS the product story, not decoration.

class FrameSequence {
  constructor() {
    this.canvas    = document.getElementById('frame-canvas');
    this.ctx       = this.canvas.getContext('2d');
    this.section   = document.getElementById('transformation');
    this.sticky    = document.querySelector('.frames-sticky');
    this.textStart = document.querySelector('.frames-text-start');
    this.textEnd   = document.querySelector('.frames-text-end');
    this.loading   = document.getElementById('frames-loading');

    this.frameCount  = 151;
    this.framePath   = 'assets/frames';
    this.images      = new Array(this.frameCount).fill(null);
    this.loadedCount = 0;
    this.ready       = false;
    this.currentIdx  = -1;

    this._resize();
    this._load();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    if (!this.canvas) return;
    this.canvas.width  = this.sticky.offsetWidth;
    this.canvas.height = this.sticky.offsetHeight;
    // Re-render current frame after resize
    if (this.ready && this.currentIdx >= 0) {
      this._draw(this.currentIdx);
    }
  }

  async _load() {
    const FIRST_BATCH = 30; // load first 30 immediately

    const loadImage = (i) => new Promise(resolve => {
      const img = new Image();
      img.onload  = () => { this.images[i] = img; this.loadedCount++; resolve(); };
      img.onerror = () => resolve(); // graceful skip
      img.src = `${this.framePath}/frame_${String(i + 1).padStart(4, '0')}.webp`;
    });

    // First batch — blocks until ready
    const firstBatch = [];
    for (let i = 0; i < FIRST_BATCH; i++) firstBatch.push(loadImage(i));
    await Promise.all(firstBatch);

    // Show first frame, hide loading
    this._draw(0);
    this.loading.classList.add('hidden');
    this.ready = true;

    // Load rest progressively in background
    const batchSize = 20;
    for (let start = FIRST_BATCH; start < this.frameCount; start += batchSize) {
      const batch = [];
      for (let i = start; i < Math.min(start + batchSize, this.frameCount); i++) {
        batch.push(loadImage(i));
      }
      await Promise.all(batch);
      await new Promise(r => setTimeout(r, 16)); // yield to UI
    }
  }

  _draw(index) {
    const img = this.images[index];
    if (!img) return;

    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const ar = img.naturalWidth / img.naturalHeight;

    // Cover-fit
    let sw = cw, sh = sw / ar;
    if (sh < ch) { sh = ch; sw = sh * ar; }
    const sx = (cw - sw) / 2;
    const sy = (ch - sh) / 2;

    this.ctx.clearRect(0, 0, cw, ch);
    this.ctx.drawImage(img, sx, sy, sw, sh);
  }

  update(progress) {
    // progress: 0–1 within the frame section
    if (!this.ready) return;

    const idx = Math.min(this.frameCount - 1, Math.floor(progress * this.frameCount));
    if (idx !== this.currentIdx) {
      this.currentIdx = idx;
      const img = this.images[idx];
      if (img) this._draw(idx);
    }

    // Update progress bar CSS var
    this.sticky.style.setProperty('--progress', `${(progress * 100).toFixed(1)}%`);

    // Text overlays fade
    // Start text: visible 0–0.12 progress
    const startOpacity = progress < 0.06 ? 1 : Math.max(0, 1 - (progress - 0.06) / 0.08);
    this.textStart.style.opacity = startOpacity;

    // End text: visible 0.88–1.0 progress
    const endOpacity = progress > 0.9 ? Math.min(1, (progress - 0.9) / 0.06) : 0;
    this.textEnd.style.opacity = endOpacity;
    this.textEnd.style.pointerEvents = endOpacity > 0.3 ? 'auto' : 'none';
  }
}

// Init frame sequence
const frameSequence = new FrameSequence();

// Scroll handler for frame section
lenis.on('scroll', ({ scroll }) => {
  const section = document.getElementById('transformation');
  if (!section) return;

  const sectionTop    = section.offsetTop;
  const sectionHeight = section.offsetHeight;
  const viewH         = window.innerHeight;

  // Progress 0 when sticky enters viewport, 1 at section end
  const progress = Math.max(0, Math.min(1,
    (scroll - sectionTop) / (sectionHeight - viewH)
  ));

  frameSequence.update(progress);
});


// ─── 8. Lead Form ────────────────────────────────────────
const form        = document.getElementById('lead-form');
const submitBtn   = document.getElementById('submit-btn');
const formSuccess = document.getElementById('form-success');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btnText    = submitBtn.querySelector('.btn-t');
    const btnLoading = submitBtn.querySelector('.btn-l');

    btnText.hidden    = true;
    btnLoading.hidden = false;
    submitBtn.disabled = true;

    // Collect form data
    const data = Object.fromEntries(new FormData(form));

    try {
      // Attempt to send to webhook (non-blocking — site works without it)
      await fetch('http://localhost:3456/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          source: 'istanbul-dental-3d-demo',
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Webhook unavailable — still show success to user
    }

    form.hidden        = true;
    formSuccess.hidden = false;
  });
}


// ─── 9. Smooth anchor scrolling ──────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const id = link.getAttribute('href').slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -80, duration: 1.4 });
  });
});
