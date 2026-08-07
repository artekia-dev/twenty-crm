import { type NavigationMenuItem } from '~/generated-metadata/graphql';

export const getLinkNavigationMenuItemComputedLink = (
  item: Pick<NavigationMenuItem, 'link'>,
): string => {
  const linkUrl = (item.link ?? '').trim();

  if (linkUrl.startsWith('http://') || linkUrl.startsWith('https://')) {
    return linkUrl;
  }

  // Una ruta que empieza por "/" es de esta misma aplicacion.
  //
  // Sin esto se le anteponia "https://" a todo, asi que "/panel/holding" salia
  // como "https:///panel/holding" y daba un 404. Los enlaces del menu se
  // pensaron para sitios de fuera; los paneles a medida del fork viven dentro.
  if (linkUrl.startsWith('/')) {
    return linkUrl;
  }

  return linkUrl ? `https://${linkUrl}` : '';
};
