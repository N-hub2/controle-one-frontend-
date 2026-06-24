(() => {
  document.addEventListener('DOMContentLoaded', () => {
    initStepAccordion();
    initStatsCounter();
    initScrollToTop();
  });

  function initStepAccordion() {
    const stepItems = Array.from(document.querySelectorAll('.steps-list .glass-step'));

    if (!stepItems.length) {
      return;
    }

    const defaultImage = document.getElementById('step-img-default');
    const stepImages = [
      document.getElementById('step-img-1'),
      document.getElementById('step-img-2'),
      document.getElementById('step-img-3'),
    ];

    const showStepImage = (activeIndex) => {
      stepImages.forEach((image) => {
        if (image) {
          image.classList.remove('active');
        }
      });

      if (activeIndex >= 0 && stepImages[activeIndex]) {
        if (defaultImage) {
          defaultImage.classList.remove('active');
        }

        stepImages[activeIndex].classList.add('active');
        return;
      }

      if (defaultImage) {
        defaultImage.classList.add('active');
      }
    };

    const openStep = (activeStep) => {
      stepItems.forEach((stepItem) => {
        const trigger = stepItem.querySelector('.step-trigger');
        const isActive = stepItem === activeStep;

        stepItem.classList.toggle('is-open', isActive);

        if (trigger) {
          trigger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        }
      });

      showStepImage(stepItems.indexOf(activeStep));
    };

    const closeAllSteps = () => {
      stepItems.forEach((stepItem) => {
        const trigger = stepItem.querySelector('.step-trigger');
        stepItem.classList.remove('is-open');

        if (trigger) {
          trigger.setAttribute('aria-expanded', 'false');
        }
      });

      showStepImage(-1);
    };

    closeAllSteps();

    stepItems.forEach((stepItem) => {
      const trigger = stepItem.querySelector('.step-trigger');

      if (!trigger) {
        return;
      }

      trigger.addEventListener('click', () => {
        if (stepItem.classList.contains('is-open')) {
          closeAllSteps();
          return;
        }

        openStep(stepItem);
      });
    });
  }

  function initStatsCounter() {
    const statsSection = document.querySelector('.stats-band');

    if (!statsSection) {
      return;
    }

    const statsCounts = Array.from(statsSection.querySelectorAll('.stats-count[data-count]'));

    if (!statsCounts.length) {
      return;
    }

    const duration = 2000;
    const numberFormatter = new Intl.NumberFormat('fr-FR');

    const renderFinalCount = (count) => {
      const target = Number(count.dataset.count);
      const suffix = count.dataset.suffix || '';

      count.textContent = `${numberFormatter.format(target)}${suffix}`;
    };

    const animateCount = (count) => {
      if (count.dataset.countAnimated === 'true') {
        return;
      }

      const target = Number(count.dataset.count);
      const suffix = count.dataset.suffix || '';
      const startTime = performance.now();

      count.dataset.countAnimated = 'true';
      count.textContent = `0${suffix}`;

      const updateCount = (currentTime) => {
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const easedProgress = 1 - ((1 - progress) ** 3);
        const currentValue = Math.round(target * easedProgress);

        count.textContent = `${numberFormatter.format(currentValue)}${suffix}`;

        if (progress < 1) {
          window.requestAnimationFrame(updateCount);
        }
      };

      window.requestAnimationFrame(updateCount);
    };

    const startCountAnimation = () => {
      statsCounts.forEach(animateCount);
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      statsCounts.forEach(renderFinalCount);
      return;
    }

    if ('IntersectionObserver' in window) {
      const statsObserver = new IntersectionObserver((entries, observer) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          startCountAnimation();
          observer.disconnect();
        }
      }, { threshold: 0.2 });

      statsObserver.observe(statsSection);
      return;
    }

    startCountAnimation();
  }

  function initScrollToTop() {
    const scrollToTopButton = document.getElementById('scroll-to-top');

    if (!scrollToTopButton) {
      return;
    }

    window.addEventListener('scroll', () => {
      scrollToTopButton.classList.toggle('show', window.scrollY > 300);
    });

    scrollToTopButton.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
})();
