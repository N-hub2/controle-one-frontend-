import { API_BASE_URL, getAuthToken } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const page = createBookingPage();

  if (!page.form) {
    return;
  }

  initBooking(page);
});

function createBookingPage() {
  return {
    form: document.getElementById('booking-form'),
    state: document.querySelector('[data-booking-state]'),
    garageName: document.getElementById('selected-garage'),
    garageAddress: document.querySelector('[data-garage-address]'),
    garageDescription: document.querySelector('[data-garage-description]'),
    garageContact: document.querySelector('[data-garage-contact]'),
    serviceHelper: document.querySelector('[data-service-helper]'),
    serviceList: document.querySelector('[data-service-list]'),
    slotsHelper: document.querySelector('[data-slots-helper]'),
    slotsList: document.querySelector('[data-slots-list]'),
    feedback: document.querySelector('[data-booking-feedback]'),
    submitButton: document.querySelector('[data-booking-submit]')
  };
}

async function initBooking(page) {
  const params = new URLSearchParams(window.location.search);
  const garageId = parsePositiveInteger(params.get('garage_id'));
  const serviceId = parseOptionalPositiveInteger(params.get('service_id'));

  if (!garageId) {
    showState(page, 'error', 'Garage invalide. Veuillez relancer la réservation depuis la recherche.');
    disableForm(page);
    return;
  }

  if (params.has('service_id') && !serviceId) {
    showState(page, 'error', 'Service invalide. Veuillez relancer la réservation depuis la recherche.');
    disableForm(page);
    return;
  }

  const state = {
    garageId,
    serviceId,
    selectedSlotId: null,
    slotsLoaded: false
  };

  page.form.addEventListener('change', () => updateSubmitState(page, state));
  page.form.addEventListener('submit', (event) => handleReservationSubmit(event, page, state));

  showState(page, 'loading', 'Chargement du garage...');

  try {
    const garage = await loadGarage(garageId);
    renderGarage(page, garage);
    renderServices(page, garage, state);

    showState(page, 'loading', 'Chargement des créneaux disponibles...');
    const slots = await loadSlots(garageId);
    state.slotsLoaded = true;
    renderSlots(page, slots, state);
    hideState(page);

    if (!getAuthToken()) {
      showFeedback(page, 'error', 'Vous devez vous connecter pour confirmer une réservation. Connectez-vous puis revenez sur cette page.');
    }

    updateSubmitState(page, state);
  } catch (error) {
    showState(page, 'error', getReadableError(error));
    disableForm(page);
  }
}

async function loadGarage(garageId) {
  const payload = await requestJson(`/garages/${garageId}`);
  const garage = payload?.data?.garage || payload?.garage || payload?.data;

  if (!garage || typeof garage !== 'object') {
    throw new Error('garage_not_found');
  }

  return garage;
}

async function loadSlots(garageId) {
  const payload = await requestJson(`/slots/available?garage_id=${garageId}`);
  const slots = payload?.data?.slots || payload?.slots || payload?.data;

  if (!Array.isArray(slots)) {
    throw new Error('slots_invalid');
  }

  return slots;
}

async function requestJson(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.message || `http_${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

function renderGarage(page, garage) {
  page.garageName.textContent = garage.name || 'Garage sélectionné';
  page.garageAddress.textContent = formatAddress(garage);
  page.garageDescription.textContent = garage.description || '';
  page.garageDescription.hidden = !garage.description;
  page.garageContact.textContent = formatContact(garage);
}

function renderServices(page, garage, state) {
  const tariffs = Array.isArray(garage.tariffs) ? garage.tariffs : [];
  page.serviceList.innerHTML = '';

  if (!tariffs.length) {
    page.serviceHelper.textContent = state.serviceId
      ? `Service sélectionné : #${state.serviceId}`
      : 'Aucun service disponible pour ce garage.';
    return;
  }

  const matchingTariff = state.serviceId
    ? tariffs.find((tariff) => Number(tariff.service_id) === state.serviceId)
    : null;

  if (state.serviceId && !matchingTariff) {
    page.serviceHelper.textContent = `Service sélectionné : #${state.serviceId}`;
    return;
  }

  page.serviceHelper.textContent = state.serviceId
    ? 'Service sélectionné depuis la recherche.'
    : 'Choisissez le service souhaité.';

  tariffs.forEach((tariff) => {
    const serviceId = Number(tariff.service_id);
    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return;
    }

    const option = document.createElement('label');
    option.className = 'booking-choice';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'service_id';
    input.value = String(serviceId);
    input.checked = state.serviceId === serviceId || (!state.serviceId && page.serviceList.children.length === 0);

    if (input.checked) {
      state.serviceId = serviceId;
    }

    const copy = document.createElement('span');
    copy.className = 'booking-choice__copy';

    const name = document.createElement('strong');
    name.textContent = tariff.service_name || `Service #${serviceId}`;

    const details = document.createElement('span');
    details.textContent = formatTariffDetails(tariff);

    copy.append(name, details);
    option.append(input, copy);
    page.serviceList.appendChild(option);
  });

  page.serviceList.addEventListener('change', (event) => {
    if (event.target?.name === 'service_id') {
      state.serviceId = parsePositiveInteger(event.target.value);
      updateSubmitState(page, state);
    }
  });
}

function renderSlots(page, slots, state) {
  page.slotsList.innerHTML = '';

  if (!slots.length) {
    page.slotsHelper.textContent = 'Aucun créneau disponible pour ce garage pour le moment.';
    page.slotsHelper.className = 'booking-helper booking-helper--empty';
    state.selectedSlotId = null;
    updateSubmitState(page, state);
    return;
  }

  page.slotsHelper.textContent = 'Sélectionnez un créneau disponible.';
  page.slotsHelper.className = 'booking-helper';

  slots.forEach((slot) => {
    const slotId = getSlotId(slot);
    if (!slotId) {
      return;
    }

    const option = document.createElement('label');
    option.className = 'booking-choice';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'slot_id';
    input.value = String(slotId);

    const copy = document.createElement('span');
    copy.className = 'booking-choice__copy';

    const title = document.createElement('strong');
    title.textContent = formatSlotTitle(slot);

    const details = document.createElement('span');
    details.textContent = formatSlotDetails(slot);

    copy.append(title, details);
    option.append(input, copy);
    page.slotsList.appendChild(option);
  });

  page.slotsList.addEventListener('change', (event) => {
    if (event.target?.name === 'slot_id') {
      state.selectedSlotId = parsePositiveInteger(event.target.value);
      updateSubmitState(page, state);
    }
  });
}

async function handleReservationSubmit(event, page, state) {
  event.preventDefault();
  hideFeedback(page);

  const token = getAuthToken();
  if (!token) {
    showFeedback(page, 'error', 'Vous devez vous connecter pour confirmer une réservation. Connectez-vous puis revenez sur cette page.');
    updateSubmitState(page, state);
    return;
  }

  const validation = validateReservationForm(page, state);
  if (!validation.valid) {
    showFeedback(page, 'error', validation.message);
    updateSubmitState(page, state);
    return;
  }

  setSubmitting(page, true);

  try {
    const response = await requestJson('/reservations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildReservationPayload(page, state))
    });

    const reservation = response?.data?.reservation || response?.reservation || response?.data || {};
    const status = reservation.status ? ` Statut : ${reservation.status}.` : '';
    showFeedback(page, 'success', `Réservation confirmée.${status}`);

    window.setTimeout(() => {
      window.location.href = 'user-dashboard.html';
    }, 1000);
  } catch (error) {
    showFeedback(page, 'error', getReservationError(error));
    setSubmitting(page, false);
    updateSubmitState(page, state);
  }
}

function validateReservationForm(page, state) {
  if (!state.serviceId) {
    return { valid: false, message: 'Veuillez sélectionner un service.' };
  }

  if (!state.selectedSlotId) {
    return { valid: false, message: 'Veuillez sélectionner un créneau.' };
  }

  const registration = getFieldValue(page.form, 'vehicle_registration');
  const make = getFieldValue(page.form, 'vehicle_make');
  const model = getFieldValue(page.form, 'vehicle_model');
  const year = getFieldValue(page.form, 'vehicle_year');

  if (!registration || !make || !model) {
    return { valid: false, message: 'Veuillez renseigner les informations obligatoires du véhicule.' };
  }

  if (year && !isValidYear(year)) {
    return { valid: false, message: 'Veuillez saisir une année de véhicule valide.' };
  }

  return { valid: true };
}

function buildReservationPayload(page, state) {
  const year = getFieldValue(page.form, 'vehicle_year');

  return {
    garage_id: state.garageId,
    service_id: state.serviceId,
    slot_id: state.selectedSlotId,
    vehicle_registration: getFieldValue(page.form, 'vehicle_registration'),
    vehicle_make: getFieldValue(page.form, 'vehicle_make'),
    vehicle_model: getFieldValue(page.form, 'vehicle_model'),
    vehicle_year: year ? Number(year) : undefined,
    vehicle_version: getFieldValue(page.form, 'vehicle_version')
  };
}

function updateSubmitState(page, state) {
  const token = getAuthToken();
  const canSubmit = Boolean(token && state.garageId && state.serviceId && state.selectedSlotId && state.slotsLoaded);
  page.submitButton.disabled = !canSubmit;
}

function setSubmitting(page, isSubmitting) {
  page.submitButton.disabled = isSubmitting;
  page.submitButton.textContent = isSubmitting ? 'Réservation en cours...' : 'Confirmer la réservation';
}

function disableForm(page) {
  page.form.querySelectorAll('input, button').forEach((control) => {
    control.disabled = true;
  });
}

function showState(page, type, message) {
  page.state.hidden = false;
  page.state.className = `booking-state booking-state--${type}`;
  page.state.textContent = message;
}

function hideState(page) {
  page.state.hidden = true;
  page.state.textContent = '';
}

function showFeedback(page, type, message) {
  page.feedback.hidden = false;
  page.feedback.className = `booking-feedback booking-feedback--${type}`;
  page.feedback.textContent = message;
}

function hideFeedback(page) {
  page.feedback.hidden = true;
  page.feedback.textContent = '';
}

function parsePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function parseOptionalPositiveInteger(value) {
  if (value === null || value === '') {
    return null;
  }

  return parsePositiveInteger(value);
}

function getFieldValue(form, name) {
  return form.elements[name]?.value?.trim() || '';
}

function isValidYear(value) {
  const year = Number(value);
  const currentYear = new Date().getFullYear() + 1;
  return Number.isInteger(year) && year >= 1900 && year <= currentYear;
}

function getSlotId(slot) {
  return parsePositiveInteger(slot.slot_id || slot.slotId || slot.id);
}

function formatAddress(garage) {
  const cityLine = [garage.postal_code, garage.city].filter(Boolean).join(' ');
  return [garage.address, cityLine].filter(Boolean).join(' - ') || 'Adresse non disponible';
}

function formatContact(garage) {
  const contact = [garage.phone, garage.email].filter(Boolean);
  return contact.length ? contact.join(' - ') : 'Contact non disponible';
}

function formatTariffDetails(tariff) {
  const parts = [];

  if (tariff.service_description) {
    parts.push(tariff.service_description);
  }

  if (tariff.price !== null && tariff.price !== undefined && tariff.price !== '') {
    parts.push(`${formatPrice(tariff.price)} ${tariff.currency || 'EUR'}`);
  }

  return parts.join(' - ') || 'Détail du service non disponible';
}

function formatPrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price)) {
    return 'Prix non disponible';
  }

  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price);
}

function formatSlotTitle(slot) {
  const date = slot.date || slot.slot_date || slot.start_date || slot.start_at || slot.starts_at;
  const time = slot.time || slot.slot_time || slot.start_time;

  if (date && time) {
    return `${formatDate(date)} à ${time}`;
  }

  if (date) {
    return formatDate(date);
  }

  if (slot.start_at || slot.starts_at) {
    return formatDateTime(slot.start_at || slot.starts_at);
  }

  return `Créneau #${getSlotId(slot)}`;
}

function formatSlotDetails(slot) {
  const end = slot.end_time || slot.end_at || slot.ends_at;
  const capacity = slot.available_count || slot.capacity || slot.remaining_capacity;
  const details = [];

  if (end) {
    details.push(`Fin : ${String(end)}`);
  }

  if (capacity !== undefined && capacity !== null && capacity !== '') {
    details.push(`${capacity} place(s) disponible(s)`);
  }

  return details.join(' - ') || 'Créneau disponible';
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('fr-FR').format(date);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function getReadableError(error) {
  if (error.message === 'garage_not_found') {
    return 'Impossible de charger les informations du garage.';
  }

  if (error.message === 'slots_invalid') {
    return 'Impossible de charger les créneaux disponibles.';
  }

  return 'Impossible de charger la réservation pour le moment.';
}

function getReservationError(error) {
  if (error.status === 401) {
    return 'Vous devez être connecté pour confirmer cette réservation.';
  }

  if (error.status === 403) {
    return 'Votre compte ne permet pas de créer cette réservation.';
  }

  if (error.status === 409) {
    return 'Ce créneau n’est plus disponible. Veuillez en choisir un autre.';
  }

  return 'Impossible de confirmer la réservation pour le moment.';
}
