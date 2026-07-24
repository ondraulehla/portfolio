import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { liteMotion } from './motion';

gsap.registerPlugin(ScrollTrigger);

function setup() {
  // Clean up triggers from the previous page (View Transitions keep the JS context alive).
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  document.documentElement.classList.remove('motion-ok');

  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // Only now hide reveal targets – no-JS / reduced-motion users never see hidden content.
    document.documentElement.classList.add('motion-ok');

    const targets = gsap.utils.toArray<HTMLElement>('[data-reveal]');
    targets.forEach((el) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            once: true,
          },
        },
      );
    });

    // Scrubbed effects recompute on every scroll frame. One-shot reveals above
    // are cheap enough to keep everywhere; these two are not, so phones get
    // the finished state instead of the animation.
    if (liteMotion()) {
      const timelineEl = document.querySelector<HTMLElement>('[data-timeline]');
      if (timelineEl) timelineEl.style.setProperty('--line-progress', '100%');
      return () => {
        document.documentElement.classList.remove('motion-ok');
      };
    }

    // Experience timeline: draw the vertical line as you scroll through it.
    const timeline = document.querySelector<HTMLElement>('[data-timeline]');
    if (timeline) {
      gsap.fromTo(
        timeline,
        { '--line-progress': '0%' },
        {
          '--line-progress': '100%',
          ease: 'none',
          scrollTrigger: {
            trigger: timeline,
            start: 'top 75%',
            end: 'bottom 55%',
            scrub: 0.6,
          },
        },
      );
    }

    // Subtle parallax on section headings.
    gsap.utils.toArray<HTMLElement>('section h2').forEach((heading) => {
      gsap.fromTo(
        heading,
        { y: 18 },
        {
          y: -6,
          ease: 'none',
          scrollTrigger: { trigger: heading, start: 'top 95%', end: 'top 30%', scrub: 0.8 },
        },
      );
    });

    return () => {
      document.documentElement.classList.remove('motion-ok');
    };
  });
}

setup();
document.addEventListener('astro:page-load', setup);
document.addEventListener('astro:before-swap', () => {
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
});
