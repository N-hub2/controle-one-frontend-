document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const selectedCenterFromUrl = params.get('center');

  const selectedCenterElement = document.getElementById('selected-center');
  if (selectedCenterElement && selectedCenterFromUrl) {
    selectedCenterElement.textContent = selectedCenterFromUrl;
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (event) => {
      event.preventDefault();
      window.location.href = 'user-dashboard.html';
    });
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', (event) => {
      event.preventDefault();
      window.location.href = 'login.html';
    });
  }

  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const bookingDate = document.getElementById('booking-date')?.value || '';
      const bookingCenter = selectedCenterFromUrl || 'Unknown center';
      localStorage.setItem('bookingCenter', bookingCenter);
      localStorage.setItem('bookingDate', bookingDate);
      window.location.href = 'user-dashboard.html';
    });
  }

  const dashboardCenter = document.getElementById('dashboard-center');
  const dashboardDate = document.getElementById('dashboard-date');
  if (dashboardCenter && dashboardDate) {
    const storedCenter = localStorage.getItem('bookingCenter');
    const storedDate = localStorage.getItem('bookingDate');
    if (storedCenter) {
      dashboardCenter.textContent = storedCenter;
    }
    if (storedDate) {
      dashboardDate.textContent = `Date: ${storedDate}`;
    }
  }

  const stepItems = Array.from(document.querySelectorAll('.steps-list .glass-step'));
  if (stepItems.length) {
    const openStep = (activeStep) => {
      stepItems.forEach((stepItem) => {
        const trigger = stepItem.querySelector('.step-trigger');
        const isActive = stepItem === activeStep;

        stepItem.classList.toggle('is-open', isActive);
        if (trigger) {
          trigger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        }
      });
    };

    const closeAllSteps = () => {
      stepItems.forEach((stepItem) => {
        const trigger = stepItem.querySelector('.step-trigger');
        stepItem.classList.remove('is-open');
        if (trigger) {
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
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
});
