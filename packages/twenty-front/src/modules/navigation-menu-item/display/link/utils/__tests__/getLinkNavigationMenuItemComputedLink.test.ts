import { getLinkNavigationMenuItemComputedLink } from '@/navigation-menu-item/display/link/utils/getLinkNavigationMenuItemComputedLink';

describe('getLinkNavigationMenuItemComputedLink', () => {
  it('deja las direcciones completas como estan', () => {
    expect(getLinkNavigationMenuItemComputedLink({ link: 'https://twenty.com' })).toBe(
      'https://twenty.com',
    );
    expect(getLinkNavigationMenuItemComputedLink({ link: 'http://interno.local' })).toBe(
      'http://interno.local',
    );
  });

  // Los paneles a medida del fork viven dentro de la aplicacion. Anteponerles
  // "https://" los convertia en "https:///panel/holding" y daba un 404.
  it('respeta las rutas de la propia aplicacion', () => {
    expect(getLinkNavigationMenuItemComputedLink({ link: '/panel/holding' })).toBe(
      '/panel/holding',
    );
    expect(
      getLinkNavigationMenuItemComputedLink({ link: '/panel/sociedad/abc-123' }),
    ).toBe('/panel/sociedad/abc-123');
  });

  it('a un dominio suelto le pone el protocolo', () => {
    expect(getLinkNavigationMenuItemComputedLink({ link: 'twenty.com' })).toBe(
      'https://twenty.com',
    );
  });

  it('sin enlace devuelve vacio', () => {
    expect(getLinkNavigationMenuItemComputedLink({ link: '' })).toBe('');
    expect(getLinkNavigationMenuItemComputedLink({ link: null })).toBe('');
  });
});
