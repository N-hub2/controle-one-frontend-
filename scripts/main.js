document.addEventListener('DOMContentLoaded', () => {
  const stepItems = Array.from(document.querySelectorAll('.steps-list .glass-step'));
  if (stepItems.length) {
    const defaultImg = document.getElementById('step-img-default');
    const stepImgs = [
      document.getElementById('step-img-1'),
      document.getElementById('step-img-2'),
      document.getElementById('step-img-3'),
    ];

    const showImage = (activeIndex) => {
      // Cacher toutes les images de step
      stepImgs.forEach((img) => {
        if (img) img.classList.remove('active');
      });

      if (activeIndex >= 0 && stepImgs[activeIndex]) {
        // Afficher l'image de l'étape active
        if (defaultImg) defaultImg.classList.remove('active');
        stepImgs[activeIndex].classList.add('active');
      } else {
        // Revenir à l'image par défaut
        if (defaultImg) defaultImg.classList.add('active');
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

      const activeIndex = stepItems.indexOf(activeStep);
      showImage(activeIndex);
    };

    const closeAllSteps = () => {
      stepItems.forEach((stepItem) => {
        const trigger = stepItem.querySelector('.step-trigger');
        stepItem.classList.remove('is-open');
        if (trigger) {
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
      showImage(-1);
    };

    closeAllSteps();

    stepItems.forEach((stepItem) => {
      const trigger = stepItem.querySelector('.step-trigger');
      if (!trigger) {
        return;
      }

      trigger.addEventListener('click', () => {
        const isOpen = stepItem.classList.contains('is-open');

        if (isOpen) {
          closeAllSteps();
          return;
        }

        openStep(stepItem);
      });
    });
  }

  const scrollToTopBtn = document.getElementById('scroll-to-top');
  if (scrollToTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        scrollToTopBtn.classList.add('show');
      } else {
        scrollToTopBtn.classList.remove('show');
      }
    });

    scrollToTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
});
