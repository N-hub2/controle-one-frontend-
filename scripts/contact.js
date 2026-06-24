import { request } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('[data-contact-form]');

  if (!form) {
    return;
  }

  const message = document.querySelector('[data-contact-message]');
  const submitButton = form.querySelector('[type="submit"]');
  let isSubmitting = false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    clearMessage(message);

    const payload = getContactPayload(form);
    const validationError = validateContactPayload(payload);

    if (validationError) {
      showMessage(message, validationError, 'error');
      return;
    }

    isSubmitting = true;
    setLoading(submitButton, true);

    try {
      const response = await request('/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response?.success) {
        showMessage(message, response?.message || 'Impossible d\'envoyer votre message pour le moment.', 'error');
        return;
      }

      form.reset();
      showMessage(message, response.message || 'Votre message a bien été envoyé.', 'success');
    } catch (error) {
      showMessage(message, 'Impossible d\'envoyer votre message pour le moment.', 'error');
    } finally {
      isSubmitting = false;
      setLoading(submitButton, false);
    }
  });
});

function getContactPayload(form) {
  const formData = new FormData(form);

  return {
    name: String(formData.get('name') || '').trim(),
    email_or_phone: String(formData.get('email_or_phone') || '').trim(),
    message: String(formData.get('message') || '').trim()
  };
}

function validateContactPayload({ name, email_or_phone: emailOrPhone, message }) {
  if (name.length < 2 || name.length > 150) {
    return 'Votre nom doit contenir entre 2 et 150 caractères.';
  }

  if (!isValidEmailOrPhone(emailOrPhone)) {
    return 'Veuillez saisir un email ou un numéro de téléphone valide.';
  }

  if (message.length < 10 || message.length > 2000) {
    return 'Votre message doit contenir entre 10 et 2000 caractères.';
  }

  return '';
}

function isValidEmailOrPhone(value) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^\+?[0-9][0-9\s().-]{5,29}$/;

  return emailPattern.test(value) || phonePattern.test(value);
}

function showMessage(message, text, type) {
  if (!message) {
    return;
  }

  message.hidden = false;
  message.textContent = text;
  message.className = `contact-message contact-message--${type}`;
}

function clearMessage(message) {
  if (!message) {
    return;
  }

  message.hidden = true;
  message.textContent = '';
  message.className = 'contact-message';
}

function setLoading(button, isLoading) {
  if (!button) {
    return;
  }

  if (isLoading) {
    button.dataset.defaultText = button.textContent;
    button.textContent = 'Envoi...';
    button.disabled = true;
    return;
  }

  button.textContent = button.dataset.defaultText || button.textContent;
  button.disabled = false;
  delete button.dataset.defaultText;
}
