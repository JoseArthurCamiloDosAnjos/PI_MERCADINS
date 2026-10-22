const RETURN_URL_KEY = 'mercadins_return_url';

export function saveReturnUrl(): void {
  const currentPath = window.location.pathname + window.location.search;
  const profilePaths = ['/perfil', '/vendedor'];
  
  if (!profilePaths.some(p => currentPath.startsWith(p))) {
    sessionStorage.setItem(RETURN_URL_KEY, currentPath);
  }
}

export function getReturnUrl(): string {
  const url = sessionStorage.getItem(RETURN_URL_KEY);
  sessionStorage.removeItem(RETURN_URL_KEY);
  return url ?? '/';
}

export function clearReturnUrl(): void {
  sessionStorage.removeItem(RETURN_URL_KEY);
}