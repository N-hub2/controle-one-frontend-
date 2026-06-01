import {
  API_BASE_URL,
  AUTH_ROLE_KEY,
  clearAuthSession,
  getAuthToken,
  getAuthUser
} from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  bindLogoutLinks();

  const dashboard = createGarageDashboard();

  if (!dashboard.state || !dashboard.list) {
    return;
  }

  initGarageDashboard(dashboard);
});

function createGarageDashboard() {
  return {
    state: document.querySelector('[data-garage-dashboard-state]'),
    summary: document.querySelector('[data-garage-dashboard-summary]'),
    summaryCount: document.querySelector('[data-garage-summary-count]'),
    summaryPending: document.querySelector('[data-garage-summary-pending]'),
    list: document.querySelector('[data-garage-reservations-list]')
  };
}

function bindLogoutLinks() {
  document.querySelectorAll('[data-logout]').forEach((link) => {
    link.addEventListener('click', () => {
      clearAuthSession();
    });
  });
}

async function initGarageDashboard(dashboard) {
  const token = getAuthToken();
  const user = getAuthUser();

  if (!token) {
    showState(dashboard, 'auth', 'Vous devez vous connecter avec un compte centre pour consulter cet espace.', true);
    return;
  }

  if (!isGarageRole(user)) {
    showState(dashboard, 'forbidden', 'Cet espace est réservé aux comptes centre partenaire.', false);
    return;
  }

  const garageId = resolveGarageId(user);

  if (!garageId) {
    showState(
      dashboard,
      'missing',
      'Impossible d’identifier le garage. En local, ajoutez ?garage_id=1 à l’URL. À terme, le backend doit fournir le garage_id du compte connecté.',
      false
    );
    return;
  }

  showState(dashboard, 'loading', 'Chargement des réservations du centre...', false);

  try {
    const reservations = await fetchGarageReservations(garageId, token);
    renderGarageDashboard(dashboard, reservations, token, garageId);
  } catch (error) {
    showState(dashboard, getErrorType(error), getReservationsError(error), false);
  }
}

function isGarageRole(user) {
  const role = normalizeRole(user?.role || user?.user_role || localStorage.getItem(AUTH_ROLE_KEY));
  return role === 'garage';
}

function resolveGarageId(user) {
  const params = new URLSearchParams(window.location.search);
  const candidates = [
    user?.garage_id,
    user?.garageId,
    user?.managed_garage_id,
    user?.managedGarageId,
    user?.manager_garage_id,
    user?.garage?.garage_id,
    user?.garage?.garageId,
    user?.garage?.id,
    params.get('garage_id')
  ];

  for (const candidate of candidates) {
    const garageId = parsePositiveInteger(candidate);
    if (garageId) {
      return garageId;
    }
  }

  return null;
}

async function fetchGarageReservations(garageId, token) {
  const payload = await requestJson(`/reservations/garage/${garageId}`, {
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

async function updateReservationStatus(reservationId, action, token) {
  return requestJson(`/reservations/${reservationId}/${action}`, {
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

function renderGarageDashboard(dashboard, reservations, token, garageId) {
  dashboard.list.innerHTML = '';
  updateSummary(dashboard, reservations);

  if (!reservations.length) {
    showState(dashboard, 'empty', 'Aucune réservation pour ce centre pour le moment.', false);
    showSummary(dashboard);
    return;
  }

  hideState(dashboard);
  showSummary(dashboard);

  reservations.forEach((reservation) => {
    dashboard.list.appendChild(createReservationCard(reservation, token, garageId, dashboard));
  });
}

function updateSummary(dashboard, reservations) {
  if (dashboard.summaryCount) {
    dashboard.summaryCount.textContent = `${reservations.length} réservation(s)`;
  }

  if (dashboard.summaryPending) {
    const pendingCount = reservations.filter((reservation) => getStatus(reservation) === 'pending').length;
    dashboard.summaryPending.textContent = `${pendingCount} demande(s)`;
  }
}

function createReservationCard(reservation, token, garageId, dashboard) {
  const card = document.createElement('article');
  card.className = 'card garage-dashboard__reservation';

  const header = document.createElement('header');
  header.className = 'garage-dashboard__reservation-header';

  const titleGroup = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = `Réservation #${formatValue(getReservationId(reservation))}`;
  const client = document.createElement('p');
  client.textContent = formatClient(reservation);
  titleGroup.append(title, client);

  const status = document.createElement('span');
  status.className = `garage-dashboard__status garage-dashboard__status--${getStatus(reservation)}`;
  status.textContent = formatStatus(getStatus(reservation));

  header.append(titleGroup, status);

  const details = document.createElement('div');
  details.className = 'garage-dashboard__details';
  details.append(
    createDetailSection('Client', [
      ['Nom', formatClient(reservation)],
      ['Contact', formatClientContact(reservation)]
    ]),
    createDetailSection('Service', [
      ['Nom', getServiceName(reservation)],
      ['Description', getServiceDescription(reservation)]
    ]),
    createDetailSection('Créneau', [
      ['Début', formatDateTime(getSlotStart(reservation))],
      ['Fin', formatDateTime(getSlotEnd(reservation))],
      ['Statut', getSlotStatus(reservation)]
    ]),
    createDetailSection('Véhicule', [
      ['Immatriculation', reservation.vehicle_registration],
      ['Marque', reservation.vehicle_make],
      ['Modèle', reservation.vehicle_model],
      ['Année', reservation.vehicle_year],
      ['Version', reservation.vehicle_version]
    ])
  );

  card.append(header, details);

  const actions = createReservationActions(reservation, token, garageId, dashboard);
  if (actions) {
    card.appendChild(actions);
  }

  return card;
}

function createDetailSection(title, rows) {
  const section = document.createElement('section');
  section.className = 'garage-dashboard__detail-section';

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

function createReservationActions(reservation, token, garageId, dashboard) {
  const reservationId = getReservationId(reservation);
  const status = getStatus(reservation);

  if (!reservationId || !['pending', 'confirmed'].includes(status)) {
    return null;
  }

  const actions = document.createElement('div');
  actions.className = 'garage-dashboard__actions';

  if (status === 'pending') {
    actions.appendChild(createActionButton('Confirmer', 'confirm', reservationId, token, garageId, dashboard));
  }

  actions.appendChild(createActionButton('Annuler', 'cancel', reservationId, token, garageId, dashboard));

  return actions;
}

function createActionButton(label, action, reservationId, token, garageId, dashboard) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = action === 'confirm' ? 'button primary-button' : 'button secondary-button';
  button.textContent = label;

  button.addEventListener('click', async () => {
    const confirmed = window.confirm(`Voulez-vous ${action === 'confirm' ? 'confirmer' : 'annuler'} cette réservation ?`);
    if (!confirmed) {
      return;
    }

    button.disabled = true;
    button.textContent = action === 'confirm' ? 'Confirmation...' : 'Annulation...';

    try {
      await updateReservationStatus(reservationId, action, token);
      const reservations = await fetchGarageReservations(garageId, token);
      renderGarageDashboard(dashboard, reservations, token, garageId);
      showBanner(dashboard, 'success', action === 'confirm' ? 'Réservation confirmée.' : 'Réservation annulée.');
    } catch (error) {
      showBanner(dashboard, getErrorType(error), getActionError(error, action));
      button.disabled = false;
      button.textContent = label;
    }
  });

  return button;
}

function showState(dashboard, type, message, showLoginLink) {
  dashboard.state.hidden = false;
  dashboard.state.className = `garage-dashboard__state garage-dashboard__state--${type}`;
  dashboard.state.textContent = message;
  dashboard.list.innerHTML = '';

  if (showLoginLink) {
    const link = document.createElement('a');
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    link.href = `login.html?redirect=${redirect}`;
    link.className = 'button primary-button garage-dashboard__login-link';
    link.textContent = 'Se connecter';
    dashboard.state.appendChild(document.createTextNode(' '));
    dashboard.state.appendChild(link);
  }
}

function hideState(dashboard) {
  dashboard.state.hidden = true;
  dashboard.state.textContent = '';
}

function showBanner(dashboard, type, message) {
  dashboard.state.hidden = false;
  dashboard.state.className = `garage-dashboard__state garage-dashboard__state--${type}`;
  dashboard.state.textContent = message;
}

function showSummary(dashboard) {
  if (dashboard.summary) {
    dashboard.summary.hidden = false;
  }
}

function parsePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function getReservationId(reservation) {
  return reservation.reservation_id || reservation.reservationId || reservation.id;
}

function getStatus(reservation) {
  return String(reservation.status || 'pending').trim().toLowerCase();
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

function formatClient(reservation) {
  const client = reservation.client || reservation.user || reservation.customer || {};
  const name = [
    client.first_name || reservation.client_first_name || reservation.user_first_name,
    client.last_name || reservation.client_last_name || reservation.user_last_name
  ].filter(Boolean).join(' ');

  return name || client.email || reservation.client_email || reservation.user_email || 'Client non renseigné';
}

function formatClientContact(reservation) {
  const client = reservation.client || reservation.user || reservation.customer || {};
  return [
    client.phone || reservation.client_phone || reservation.user_phone,
    client.email || reservation.client_email || reservation.user_email
  ].filter(Boolean).join(' - ');
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

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return 'Non renseigné';
  }

  return String(value);
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
    return 'Vous devez vous connecter avec un compte centre pour consulter cet espace.';
  }

  if (error.status === 403) {
    return 'Vous n’avez pas accès aux réservations de ce centre.';
  }

  if (error.message === 'reservations_invalid') {
    return 'Impossible de lire les réservations du centre pour le moment.';
  }

  if (error.message === 'network_error') {
    return 'Impossible de joindre le backend pour le moment.';
  }

  return 'Impossible de charger les réservations du centre pour le moment.';
}

function getActionError(error, action) {
  if (error.status === 401) {
    return 'Vous devez vous connecter avec un compte centre.';
  }

  if (error.status === 403) {
    return 'Vous ne pouvez pas modifier cette réservation.';
  }

  if (error.status === 409) {
    return action === 'confirm'
      ? 'Cette réservation ne peut plus être confirmée.'
      : 'Cette réservation ne peut plus être annulée.';
  }

  return 'Impossible de mettre à jour cette réservation pour le moment.';
}
