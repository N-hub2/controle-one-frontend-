import { API_BASE_URL } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const resultsContainer = document.querySelector('[data-search-results]');
  const stateMessage = document.querySelector('[data-search-state]');

  if (!resultsContainer || !stateMessage) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  syncSearchForm(params);

  const filters = buildSearchFilters(params);

  if (!filters.valid) {
    showState(stateMessage, resultsContainer, 'invalid', 'Certains filtres sont invalides.');
    return;
  }

  loadGarages(filters.query, filters.serviceId, stateMessage, resultsContainer);
});

function syncSearchForm(params) {
  const cityInput = document.getElementById('city');
  const city = (params.get('city') || '').trim();

  if (cityInput) {
    cityInput.value = city;
  }
}

function buildSearchFilters(params) {
  const query = new URLSearchParams();
  const city = (params.get('city') || '').trim();
  const postalCode = (params.get('postalCode') || '').trim();
  const serviceId = (params.get('service_id') || '').trim();
  const priceMax = (params.get('price_max') || '').trim();

  if (city) {
    query.set('city', city);
  }

  if (postalCode) {
    query.set('postalCode', postalCode);
  }

  if (serviceId) {
    if (!isPositiveInteger(serviceId)) {
      return { valid: false };
    }
    query.set('service_id', serviceId);
  }

  if (priceMax) {
    if (!isPositiveNumber(priceMax)) {
      return { valid: false };
    }
    query.set('price_max', priceMax);
  }

  return {
    valid: true,
    query,
    serviceId: serviceId && isPositiveInteger(serviceId) ? serviceId : '',
  };
}

async function loadGarages(query, serviceId, stateMessage, resultsContainer) {
  showState(stateMessage, resultsContainer, 'loading', 'Chargement des centres disponibles...');

  try {
    const queryString = query.toString();
    const endpoint = `${API_BASE_URL}/search/garages${queryString ? `?${queryString}` : ''}`;
    const response = await fetch(endpoint);

    if (!response.ok) {
      throw new Error('search_request_failed');
    }

    const payload = await response.json();

    if (!payload || payload.success === false || !payload.data || !Array.isArray(payload.data.garages)) {
      showState(stateMessage, resultsContainer, 'error', 'Impossible de charger les résultats pour le moment.');
      return;
    }

    if (!payload.data.garages.length) {
      showState(stateMessage, resultsContainer, 'empty', 'Aucun centre trouvé pour cette recherche.');
      return;
    }

    hideState(stateMessage);
    renderGarages(resultsContainer, payload.data.garages, serviceId);
  } catch (error) {
    showState(stateMessage, resultsContainer, 'error', 'Impossible de charger les résultats pour le moment.');
  }
}

function renderGarages(container, garages, serviceId) {
  container.innerHTML = '';

  garages.forEach((garage) => {
    container.appendChild(createGarageCard(garage, serviceId));
  });
}

function createGarageCard(garage, serviceId) {
  const card = document.createElement('article');
  card.className = 'card center-card';

  const title = document.createElement('h2');
  title.textContent = garage.name || 'Centre sans nom';
  card.appendChild(title);

  const address = document.createElement('p');
  address.className = 'center-card__address';
  address.textContent = formatAddress(garage);
  card.appendChild(address);

  if (garage.description) {
    const description = document.createElement('p');
    description.className = 'center-card__description';
    description.textContent = garage.description;
    card.appendChild(description);
  }

  const price = document.createElement('p');
  price.className = 'center-card__meta';
  price.textContent = formatPrice(garage.min_price);
  card.appendChild(price);

  const slots = document.createElement('p');
  slots.className = 'center-card__meta';
  slots.textContent = formatSlots(garage.available_slots_count);
  card.appendChild(slots);

  const contact = document.createElement('p');
  contact.className = 'center-card__contact';
  contact.textContent = formatContact(garage);
  card.appendChild(contact);

  const link = document.createElement('a');
  link.className = 'button primary-button';
  link.href = buildBookingUrl(garage.garage_id, serviceId);
  link.textContent = 'Réserver';
  card.appendChild(link);

  return card;
}

function formatAddress(garage) {
  const cityLine = [garage.postal_code, garage.city].filter(Boolean).join(' ');
  return [garage.address, cityLine].filter(Boolean).join(' - ') || 'Adresse non disponible';
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') {
    return 'Prix non disponible';
  }

  const price = Number(value);

  if (!Number.isFinite(price)) {
    return 'Prix non disponible';
  }

  return `À partir de ${new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 2,
  }).format(price)} €`;
}

function formatSlots(value) {
  const count = Number(value) || 0;

  if (count > 0) {
    return `${count} créneau(x) disponible(s)`;
  }

  return 'Aucun créneau disponible';
}

function formatContact(garage) {
  const contactItems = [garage.phone, garage.email].filter(Boolean);
  return contactItems.length ? contactItems.join(' - ') : 'Contact non disponible';
}

function buildBookingUrl(garageId, serviceId) {
  const params = new URLSearchParams();

  if (garageId !== null && garageId !== undefined && garageId !== '') {
    params.set('garage_id', garageId);
  }

  if (serviceId) {
    params.set('service_id', serviceId);
  }

  const queryString = params.toString();
  return `booking.html${queryString ? `?${queryString}` : ''}`;
}

function showState(stateMessage, resultsContainer, type, message) {
  resultsContainer.innerHTML = '';
  stateMessage.hidden = false;
  stateMessage.className = `search-state search-state--${type}`;
  stateMessage.textContent = message;
}

function hideState(stateMessage) {
  stateMessage.hidden = true;
  stateMessage.textContent = '';
  stateMessage.className = 'search-state';
}

function isPositiveInteger(value) {
  return /^[1-9]\d*$/.test(value);
}

function isPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}
