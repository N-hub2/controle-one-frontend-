const API_BASE_URL = 'https://api.controle-one.fr';

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  if (!response.ok) {
    throw new Error('Erreur réseau');
  }
  return response.json();
}

export { API_BASE_URL, request };
