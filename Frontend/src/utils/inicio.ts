export function irParaInicio(): void {
  if (window.location.pathname === '/') {
    window.location.reload();
  } else {
    window.location.assign('/');
  }
}
