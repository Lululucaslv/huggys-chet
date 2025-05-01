export function getUserIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('userId');
    if (id && /^[a-zA-Z0-9_-]{3,32}$/.test(id)) {
      localStorage.setItem('huggys_userId', id); // 可选缓存
      return id;
    }
    return localStorage.getItem('huggys_userId') || '';
  }
  