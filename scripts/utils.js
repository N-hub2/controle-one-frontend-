function formatDateFr(dateInput) {
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('fr-FR').format(date);
}

function formatCurrencyEuro(amount) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}

export { formatDateFr, formatCurrencyEuro };
