import { API_BASE_URL, AUTH_ROLE_KEY, getAuthToken, getAuthUser } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const dashboard = createDashboard();

  if (!dashboard.list || !dashboard.state) {
    return;
  }

  initUserDashboard(dashboard);
});

function createDashboard() {
  return {
    list: document.querySelector('[data-reservations-list]'),
    state: document.querySelector('[data-dashboard-state]')
  };
}

async function initUserDashboard(dashboard) {
  const token = getAuthToken();

  if (!token) {
    showState(dashboard, 'auth', 'Vous devez vous connecter pour consulter vos réservations.', true);
    return;
  }

  if (!isClientRole()) {
    showState(dashboard, 'forbidden', 'Cet espace est réservé aux comptes client.', false);
    return;
  }

  showState(dashboard, 'loading', 'Chargement de vos réservations...', false);

  try {
    const reservations = await fetchReservations(token);
    renderReservations(dashboard, reservations, token);
  } catch (error) {
    showState(dashboard, getErrorType(error), getReservationsError(error), false);
  }
}

async function fetchReservations(token) {
  const payload = await requestJson('/reservations/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const reservations = payload?.data?.reservations || payload?.reservations || payload?.data || [];

  if (!Array.isArray(reservations)) {
    throw new Error('reservations_invalid');
  }

  return reservations;
}

async function cancelReservation(reservationId, token) {
  return requestJson(`/reservations/${reservationId}/cancel`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

async function requestJson(endpoint, options = {}) {
  let response;
  let payload = null;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  } catch (error) {
    throw new Error('network_error');
  }

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

function renderReservations(dashboard, reservations, token) {
  dashboard.list.innerHTML = '';

  if (!reservations.length) {
    showState(dashboard, 'empty', 'Vous n’avez encore aucune réservation.', false);
    return;
  }

  hideState(dashboard);

  reservations.forEach((reservation) => {
    dashboard.list.appendChild(createReservationCard(reservation, token, dashboard));
  });
}

function createReservationCard(reservation, token, dashboard) {
  const card = document.createElement('article');
  card.className = 'card dashboard-user__reservation';

  const header = document.createElement('header');
  header.className = 'dashboard-user__reservation-header';

  const titleGroup = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = getGarageName(reservation);
  const id = document.createElement('p');
  id.textContent = `Réservation #${formatValue(getReservationId(reservation))}`;
  titleGroup.append(title, id);

  const status = document.createElement('span');
  status.className = `dashboard-user__status dashboard-user__status--${getStatus(reservation)}`;
  status.textContent = formatStatus(getStatus(reservation));

  header.append(titleGroup, status);

  const details = document.createElement('div');
  details.className = 'dashboard-user__details';
  details.append(
    createSection('Garage', [
      ['Adresse', getGarageAddress(reservation)],
      ['Contact', getGarageContact(reservation)]
    ]),
    createSection('Service', [
      ['Nom', getServiceName(reservation)],
      ['Description', getServiceDescription(reservation)]
    ]),
    createSection('Créneau', [
      ['Début', formatDateTime(getSlotStart(reservation))],
      ['Fin', formatDateTime(getSlotEnd(reservation))],
      ['Statut', getSlotStatus(reservation)]
    ]),
    createSection('Véhicule', [
      ['Immatriculation', reservation.vehicle_registration],
      ['Marque', reservation.vehicle_make],
      ['Modèle', reservation.vehicle_model],
      ['Année', reservation.vehicle_year],
      ['Version', reservation.vehicle_version]
    ])
  );

  const meta = document.createElement('p');
  meta.className = 'dashboard-user__meta';
  meta.textContent = `Créée le ${formatDateTime(reservation.created_at)} · Mise à jour le ${formatDateTime(reservation.updated_at)}`;

  card.append(header, details, meta);

  const reservationId = getReservationId(reservation);
  if (canCancelReservation(reservation) && reservationId) {
    const actions = document.createElement('div');
    actions.className = 'dashboard-user__actions';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'button secondary-button';
    cancelButton.textContent = 'Annuler la réservation';
    cancelButton.addEventListener('click', () => handleCancelClick({
      button: cancelButton,
      dashboard,
      reservation,
      reservationId,
      token
    }));

    actions.appendChild(cancelButton);
    card.appendChild(actions);
  }

  return card;
}

function createSection(title, rows) {
  const section = document.createElement('section');
  section.className = 'dashboard-user__detail-section';

  const heading = document.createElement('h3');
  heading.textContent = title;
  section.appendChild(heading);

  rows.forEach(([label, value]) => {
    const row = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = `${label} : `;
    const span = document.createElement('span');
    span.textContent = formatValue(value);
    row.append(strong, span);
    section.appendChild(row);
  });

  return section;
}

async function handleCancelClick({ button, dashboard, reservation, reservationId, token }) {
  const confirmed = window.confirm('Voulez-vous annuler cette réservation ?');

  if (!confirmed) {
    return;
  }

  button.disabled = true;
  button.textContent = 'Annulation...';

  try {
    await cancelReservation(reservationId, token);
    reservation.status = 'cancelled';
    showState(dashboard, 'success', 'Réservation annulée.', false);
    const reservations = await fetchReservations(token);
    renderReservations(dashboard, reservations, token);
  } catch (error) {
    showState(dashboard, getErrorType(error), getCancelError(error), false);
    button.disabled = false;
    button.textContent = 'Annuler la réservation';
  }
}

function isClientRole() {
  const user = getAuthUser();
  const role = normalizeRole(user?.role || user?.user_role || localStorage.getItem(AUTH_ROLE_KEY));

  if (!role) {
    return true;
  }

  return role === 'client';
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function canCancelReservation(reservation) {
  return ['pending', 'confirmed'].includes(getStatus(reservation));
}

function getReservationId(reservation) {
  return reservation.reservation_id || reservation.reservationId || reservation.id;
}

function getStatus(reservation) {
  return String(reservation.status || 'pending').trim().toLowerCase();
}

function getGarageName(reservation) {
  return reservation.garage?.name || reservation.garage_name || reservation.garageName || 'Garage non renseigné';
}

function getGarageAddress(reservation) {
  const garage = reservation.garage || {};
  const address = garage.address || reservation.garage_address;
  const postalCode = garage.postal_code || reservation.garage_postal_code;
  const city = garage.city || reservation.garage_city;
  const cityLine = [postalCode, city].filter(Boolean).join(' ');
  return [address, cityLine].filter(Boolean).join(' - ');
}

function getGarageContact(reservation) {
  const garage = reservation.garage || {};
  return [garage.phone || reservation.garage_phone, garage.email || reservation.garage_email]
    .filter(Boolean)
    .join(' - ');
}

function getServiceName(reservation) {
  return reservation.service?.name || reservation.service_name || reservation.serviceName;
}

function getServiceDescription(reservation) {
  return reservation.service?.description || reservation.service_description;
}

function getSlotStart(reservation) {
  const slot = reservation.slot || {};
  return slot.start_datetime || slot.start_at || slot.starts_at || reservation.slot_start_datetime || reservation.start_datetime;
}

function getSlotEnd(reservation) {
  const slot = reservation.slot || {};
  return slot.end_datetime || slot.end_at || slot.ends_at || reservation.slot_end_datetime || reservation.end_datetime;
}

function getSlotStatus(reservation) {
  return reservation.slot?.status || reservation.slot_status;
}

function formatStatus(status) {
  const labels = {
    cancelled: 'Annulée',
    completed: 'Terminée',
    confirmed: 'Confirmée',
    pending: 'En attente'
  };

  return labels[status] || formatValue(status);
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return 'Non renseigné';
  }

  return String(value);
}

function formatDateTime(value) {
  if (!value) {
    return 'Non renseigné';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function showState(dashboard, type, message, showLoginLink) {
  dashboard.state.hidden = false;
  dashboard.state.className = `dashboard-user__state dashboard-user__state--${type}`;
  dashboard.state.textContent = message;
  dashboard.list.innerHTML = '';

  if (showLoginLink) {
    const link = document.createElement('a');
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    link.href = `login.html?redirect=${redirect}`;
    link.className = 'button primary-button dashboard-user__login-link';
    link.textContent = 'Se connecter';
    dashboard.state.appendChild(document.createTextNode(' '));
    dashboard.state.appendChild(link);
  }
}

function hideState(dashboard) {
  dashboard.state.hidden = true;
  dashboard.state.textContent = '';
}

function getErrorType(error) {
  if (error.status === 401) {
    return 'auth';
  }

  if (error.status === 403) {
    return 'forbidden';
  }

  return 'error';
}

function getReservationsError(error) {
  if (error.status === 401) {
    return 'Vous devez vous connecter pour consulter vos réservations.';
  }

  if (error.status === 403) {
    return 'Vous n’avez pas accès à cet espace.';
  }

  if (error.message === 'reservations_invalid') {
    return 'Impossible de lire vos réservations pour le moment.';
  }

  return 'Impossible de charger vos réservations pour le moment.';
}

function getCancelError(error) {
  if (error.status === 401) {
    return 'Vous devez vous connecter pour annuler cette réservation.';
  }

  if (error.status === 403) {
    return 'Vous ne pouvez pas annuler cette réservation.';
  }

  if (error.status === 409) {
    return 'Cette réservation ne peut plus être annulée.';
  }

  return 'Impossible d’annuler cette réservation pour le moment.';
}
