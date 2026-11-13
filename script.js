(() => {
  const TOTAL_FRAMES = 300;
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });

  const images = new Array(TOTAL_FRAMES + 1);
  let loadedCount = 0;
  let currentFrame = 1;
  let targetFrame = 1;
  let lastRenderedIndex = -1;
  let needsResize = true;

  function padZero(num, size = 3) {
    let s = String(num);
    while (s.length < size) s = '0' + s;
    return s;
  }

  function getFrameUrl(index) {
    return `frames/ezgif-frame-${padZero(index)}.jpg`;
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(window.innerWidth * dpr);
    const height = Math.round(window.innerHeight * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      needsResize = true;
    }
  }

  function getNearestLoadedImage(index) {
    if (images[index] && images[index].isLoaded) {
      return images[index];
    }
    // Search outward for the closest loaded frame
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = index - offset;
      if (prev >= 1 && images[prev] && images[prev].isLoaded) {
        return images[prev];
      }
      const next = index + offset;
      if (next <= TOTAL_FRAMES && images[next] && images[next].isLoaded) {
        return images[next];
      }
    }
    return null;
  }

  function drawFrame(index) {
    const img = getNearestLoadedImage(index);
    if (!img || !img.naturalWidth) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = img.naturalWidth / img.naturalHeight;

    let drawW, drawH, drawX, drawY;

    if (canvasRatio > imgRatio) {
      drawW = canvas.width;
      drawH = canvas.width / imgRatio;
      drawX = 0;
      drawY = (canvas.height - drawH) / 2;
    } else {
      drawH = canvas.height;
      drawW = canvas.height * imgRatio;
      drawX = (canvas.width - drawW) / 2;
      drawY = 0;
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }

  function preloadImage(index) {
    if (index < 1 || index > TOTAL_FRAMES) return Promise.resolve(null);
    if (images[index]) return Promise.resolve(images[index]);

    return new Promise((resolve) => {
      const img = new Image();
      images[index] = img;
      img.src = getFrameUrl(index);

      img.onload = () => {
        // Offload image decode off the main thread where supported
        if ('decode' in img) {
          img.decode().catch(() => {}).finally(() => {
            img.isLoaded = true;
            loadedCount++;
            if (index === 1 && lastRenderedIndex === -1) {
              drawFrame(1);
              lastRenderedIndex = 1;
            }
            resolve(img);
          });
        } else {
          img.isLoaded = true;
          loadedCount++;
          if (index === 1 && lastRenderedIndex === -1) {
            drawFrame(1);
            lastRenderedIndex = 1;
          }
          resolve(img);
        }
      };

      img.onerror = () => {
        resolve(null);
      };
    });
  }

  // Preload a window of frames around the current target frame
  function prioritizeFramesNear(centerIndex, radius = 12) {
    const start = Math.max(1, centerIndex - radius);
    const end = Math.min(TOTAL_FRAMES, centerIndex + radius);
    for (let i = start; i <= end; i++) {
      if (!images[i]) {
        preloadImage(i);
      }
    }
  }

  function updateScrollTarget() {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? Math.min(Math.max(scrollY / maxScroll, 0), 1) : 0;
    targetFrame = 1 + progress * (TOTAL_FRAMES - 1);
    prioritizeFramesNear(Math.round(targetFrame), 15);
  }

  function tick() {
    // Smooth exponential lerp interpolation
    const delta = targetFrame - currentFrame;
    if (Math.abs(delta) < 0.001) {
      currentFrame = targetFrame;
    } else {
      currentFrame += delta * 0.085;
    }

    const frameToRender = Math.min(
      TOTAL_FRAMES,
      Math.max(1, Math.round(currentFrame))
    );

    if (frameToRender !== lastRenderedIndex || needsResize) {
      drawFrame(frameToRender);
      lastRenderedIndex = frameToRender;
      needsResize = false;
    }

    requestAnimationFrame(tick);
  }

  async function preloadAll() {
    // 1. Immediately load frame 1 and render
    await preloadImage(1);
    updateScrollTarget();
    currentFrame = targetFrame;
    drawFrame(Math.round(currentFrame));

    // 2. Preload first 25 frames
    for (let i = 2; i <= Math.min(25, TOTAL_FRAMES); i++) {
      preloadImage(i);
    }

    // 3. Incrementally preload all remaining frames across the entire sequence
    let current = 26;
    function loadNextBatch() {
      if (current > TOTAL_FRAMES) return;
      const batchEnd = Math.min(current + 10, TOTAL_FRAMES);
      for (let i = current; i <= batchEnd; i++) {
        if (!images[i]) preloadImage(i);
      }
      current = batchEnd + 1;
      if (current <= TOTAL_FRAMES) {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(loadNextBatch, { timeout: 100 });
        } else {
          setTimeout(loadNextBatch, 20);
        }
      }
    }
    loadNextBatch();
  }

  window.addEventListener('scroll', updateScrollTarget, { passive: true });
  window.addEventListener('resize', () => {
    resizeCanvas();
    updateScrollTarget();
  });
  window.addEventListener('orientationchange', () => {
    resizeCanvas();
    updateScrollTarget();
  });

  // ==========================================================================
  // UI Interactivity & Scroll Spy Navigation
  // ==========================================================================
  function initUI() {
    // 1. Scroll-triggered reveal animations
    const cards = document.querySelectorAll('.section-card');
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      }, { threshold: 0.12 });

      cards.forEach(card => observer.observe(card));
    } else {
      cards.forEach(card => card.classList.add('revealed'));
    }

    // Always reveal hero card immediately
    const heroCard = document.getElementById('hero');
    if (heroCard) heroCard.classList.add('revealed');

    // 2. Portfolio Category Filtering
    const categoryBtns = document.querySelectorAll('.category-btn');
    const projectCards = document.querySelectorAll('.project-card');

    categoryBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        categoryBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const cat = btn.getAttribute('data-category');
        projectCards.forEach(card => {
          card.style.opacity = '0';
          card.style.transform = 'scale(0.95)';
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'scale(1)';
          }, 150);
        });
      });
    });

    // 3. Portfolio Pagination Dots
    const dots = document.querySelectorAll('.pagination-dot');
    dots.forEach((dot, idx) => {
      dot.addEventListener('click', () => {
        dots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
      });
    });

    // 4. Scroll Spy for Side Nav and Navbar Links
    const sections = document.querySelectorAll('section[id]');
    const sideNavLinks = document.querySelectorAll('.side-nav-item');
    const headerNavLinks = document.querySelectorAll('.nav-link');

    function updateActiveNav() {
      const scrollY = window.scrollY || window.pageYOffset;
      let currentSectionId = '';

      sections.forEach(sec => {
        const top = sec.offsetTop - 200;
        const height = sec.offsetHeight;
        if (scrollY >= top && scrollY < top + height) {
          currentSectionId = sec.getAttribute('id');
        }
      });

      if (!currentSectionId && sections.length > 0) {
        currentSectionId = sections[0].getAttribute('id');
      }

      sideNavLinks.forEach(link => {
        const href = link.getAttribute('href').replace('#', '');
        if (href === currentSectionId) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });

      headerNavLinks.forEach(link => {
        const href = link.getAttribute('href').replace('#', '');
        if (href === currentSectionId) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    }

    window.addEventListener('scroll', updateActiveNav, { passive: true });
    updateActiveNav();
  }

  // Initialize
  resizeCanvas();
  updateScrollTarget();
  currentFrame = targetFrame;
  preloadAll();
  initUI();
  requestAnimationFrame(tick);
})();

