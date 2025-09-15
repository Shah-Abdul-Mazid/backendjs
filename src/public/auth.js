// public/auth.js
document.addEventListener('DOMContentLoaded', () => {
  const idToken = localStorage.getItem('idToken');
  if (!idToken && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }

  // Add token to all fetch requests
  const originalFetch = window.fetch;
  window.fetch = async (url, options = {}) => {
    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${idToken}`;
    return originalFetch(url, options);
  };

  // Add token to form submissions
  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', (e) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'idToken';
      input.value = idToken;
      form.appendChild(input);
    });
  });
});