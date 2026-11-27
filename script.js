const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element, index) => {
  element.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
  observer.observe(element);
});

const menuButton = document.querySelector('.menu-button');
const navLinks = document.querySelector('.nav-links');

menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  navLinks.classList.toggle('open', !isOpen);
});

navLinks.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    navLinks.classList.remove('open');
  });
});

const projectGrid = document.querySelector('#project-grid');
const archiveStatus = document.querySelector('#archive-status');
const projectDialog = document.querySelector('#project-dialog');
const projectDialogTitle = document.querySelector('#project-dialog-title');
const projectDialogYear = document.querySelector('#project-dialog-year');
const projectDialogGallery = document.querySelector('#project-dialog-gallery');
const projectDialogClose = projectDialog.querySelector('.dialog-close');
let archivedProjects = [];
let featuredProjects = [];

function openProject(project) {
  projectDialogTitle.textContent = project.title;
  const videoCount = project.videos?.length || 0;
  const mediaSummary = `${project.images.length} PHOTOS${videoCount ? ` · ${videoCount} VIDEO` : ''}`;
  projectDialogYear.textContent = `${project.year || 'PROJECT'} · ${mediaSummary}`;
  projectDialogGallery.replaceChildren();

  project.videos?.forEach((item) => {
    const figure = document.createElement('figure');
    figure.className = 'dialog-video';
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.poster = project.images[0] || '';
    const source = document.createElement('source');
    source.src = item.src;
    source.type = 'video/mp4';
    video.append(source);
    figure.append(video);

    if (item.caption) {
      const caption = document.createElement('figcaption');
      caption.textContent = item.caption;
      figure.append(caption);
    }

    projectDialogGallery.append(figure);
  });

  project.images.forEach((src, index) => {
    const image = document.createElement('img');
    image.src = src;
    image.alt = `${project.title} — photograph ${index + 1} of ${project.images.length}`;
    image.loading = 'lazy';
    image.decoding = 'async';
    projectDialogGallery.append(image);
  });

  projectDialog.showModal();
}

fetch('assets/shotbyxi/portfolio.json', { cache: 'no-store' })
  .then((response) => {
    if (!response.ok) throw new Error(`Portfolio archive request failed (${response.status})`);
    return response.json();
  })
  .then((archive) => {
    if (!Array.isArray(archive.projects) || archive.projects.length === 0) {
      throw new Error('The saved portfolio archive contains no project entries.');
    }

    archivedProjects = archive.projects.filter((project) => project.images?.length);
    featuredProjects = archivedProjects.filter((project) => project.featured);
    if (featuredProjects.length === 0) throw new Error('No role-focused featured projects were found.');

    featuredProjects.forEach((project, index) => {
      const article = document.createElement('article');
      article.className = 'project visible';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'project-card';
      button.setAttribute('aria-label', `Open ${project.title} project gallery`);
      button.addEventListener('click', () => openProject(project));

      const image = document.createElement('img');
      image.className = 'project-cover';
      image.src = project.cover || project.images[0];
      image.alt = `${project.title} portfolio cover`;
      image.loading = index < 3 ? 'eager' : 'lazy';
      image.decoding = 'async';

      const overlay = document.createElement('span');
      overlay.className = 'project-card-overlay';
      const overlayLabel = document.createElement('span');
      overlayLabel.textContent = 'VIEW PROJECT';
      const overlayIcon = document.createElement('b');
      overlayIcon.textContent = '↗';
      overlay.append(overlayLabel, overlayIcon);
      button.append(image, overlay);

      const info = document.createElement('div');
      info.className = 'project-info';
      const text = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = project.title;
      const count = document.createElement('p');
      const videoCount = project.videos?.length || 0;
      count.textContent = `${project.images.length} PHOTOGRAPHS${videoCount ? ` · ${videoCount} VIDEO` : ''}`;
      const year = document.createElement('span');
      year.textContent = project.year;
      text.append(title, count);
      info.append(text, year);
      article.append(button, info);
      projectGrid.append(article);
    });

    const archivedCount = archivedProjects.length - featuredProjects.length;
    const preservedPhotoCount = archivedProjects.reduce((total, project) => total + project.images.length, 0);
    archiveStatus.textContent = `${featuredProjects.length} ROLE-FOCUSED PROJECTS · ${archivedCount} PERSONAL PROJECTS ARCHIVED · ${preservedPhotoCount} PHOTOS PRESERVED`;
  })
  .catch((error) => {
    console.error('Unable to load the archived portfolio.', error);
    archiveStatus.textContent = 'The saved project archive could not be loaded. Please reload the page or check the local archive files.';
    archiveStatus.classList.add('archive-error');
  });

projectDialogClose.addEventListener('click', () => projectDialog.close());
projectDialog.addEventListener('click', (event) => {
  if (event.target === projectDialog) projectDialog.close();
});

const reel = document.querySelector('.reel');
const slides = [...reel.querySelectorAll('.reel-slide')];
const reelCount = reel.querySelector('.reel-count');
const reelTitle = reel.querySelector('.reel-current-title');
const reelStatus = reel.querySelector('.reel-autoplay');
const reelToggle = reel.querySelector('.reel-toggle');
const reelNext = reel.querySelector('.reel-next');
const reelDuration = 10000;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let currentSlide = 0;
let reelTimer;
let isPlaying = false;
let userPaused = false;

function playPreviewVideo(slide, restart = false) {
  const video = slide.querySelector('video');
  if (!video) return;

  video.muted = true;
  video.loop = true;
  if (restart) video.currentTime = 0;
  const playback = video.play();
  if (playback) {
    playback.catch((error) => {
      if (error.name === 'AbortError') return;
      console.warn(`Unable to autoplay the ${slide.dataset.title} preview.`, error);
      reelStatus.textContent = 'TAP PLAY TO PREVIEW';
    });
  }
}

function scheduleNextSlide() {
  window.clearTimeout(reelTimer);
  if (isPlaying) {
    reelTimer = window.setTimeout(() => showSlide(currentSlide + 1), reelDuration);
  }
}

function showSlide(index) {
  currentSlide = (index + slides.length) % slides.length;
  slides.forEach((slide, slideIndex) => {
    const active = slideIndex === currentSlide;
    slide.classList.toggle('active', active);
    slide.setAttribute('aria-hidden', String(!active));

    const video = slide.querySelector('video');
    if (!video) return;
    if (active && isPlaying) {
      playPreviewVideo(slide, true);
    } else {
      video.pause();
    }
  });

  const activeSlide = slides[currentSlide];
  reelCount.innerHTML = `${activeSlide.dataset.number} <b>/</b> ${String(slides.length).padStart(2, '0')}`;
  reelTitle.textContent = activeSlide.dataset.title;
  reel.querySelector('.reel-progress span').style.animation = 'none';
  void reel.offsetWidth;
  reel.querySelector('.reel-progress span').style.animation = '';
  scheduleNextSlide();
}

function setPlaying(playing) {
  isPlaying = playing;
  window.clearTimeout(reelTimer);
  reel.classList.toggle('is-playing', isPlaying);
  reel.classList.toggle('is-paused', !isPlaying);
  reelToggle.setAttribute('aria-pressed', String(!isPlaying));
  reelToggle.setAttribute('aria-label', isPlaying ? 'Pause preview reel' : 'Play preview reel');
  reelStatus.textContent = isPlaying ? 'AUTO-PLAYING' : 'PAUSED';

  if (isPlaying) {
    playPreviewVideo(slides[currentSlide]);
    scheduleNextSlide();
  } else {
    slides.forEach((slide) => slide.querySelector('video')?.pause());
  }
}

reelToggle.addEventListener('click', () => {
  userPaused = isPlaying;
  setPlaying(!isPlaying);
});
reelNext.addEventListener('click', () => {
  showSlide(currentSlide + 1);
});

showSlide(0);
setPlaying(!prefersReducedMotion.matches);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !userPaused && !prefersReducedMotion.matches) setPlaying(true);
});
