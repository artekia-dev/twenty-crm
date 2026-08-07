import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type View } from '@/views/types/View';
import { NavigationMenuItemType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { type NavigationMenuItem } from '~/generated-metadata/graphql';
import {
  enlacePermitido,
  objetoPermitido,
  type PermisosDelMenu,
} from '@/navigation-menu-item/common/utils/permisosDelMenu';

export const filterAndSortNavigationMenuItems = (
  navigationMenuItems: NavigationMenuItem[],
  views: Pick<View, 'id' | 'objectMetadataId' | 'key'>[],
  objectMetadataItems: Pick<
    EnrichedObjectMetadataItem,
    'id' | 'isActive' | 'nameSingular'
  >[],
  // Sin permisos se ve todo. Es lo que hacia antes de existir esta regla, y
  // deja que quien no los necesite llame igual que siempre.
  permisos?: PermisosDelMenu,
): NavigationMenuItem[] => {
  const activeObjectMetadataItems = objectMetadataItems.filter(
    (meta) => meta.isActive,
  );

  const objetoDelItem = (item: NavigationMenuItem): string | undefined => {
    const objectMetadataId =
      item.targetObjectMetadataId ??
      views.find((view) => view.id === item.viewId)?.objectMetadataId;

    return objectMetadataItems.find((meta) => meta.id === objectMetadataId)
      ?.nameSingular;
  };

  return navigationMenuItems
    .filter((item) => {
      if (isDefined(permisos)) {
        if (!enlacePermitido(item.link, permisos)) return false;
        if (!objetoPermitido(objetoDelItem(item), permisos)) return false;
      }

      if (item.type === NavigationMenuItemType.FOLDER) {
        return true;
      }
      if (item.type === NavigationMenuItemType.LINK) {
        return true;
      }
      if (item.type === NavigationMenuItemType.PAGE_LAYOUT) {
        return isDefined(item.pageLayoutId);
      }
      if (item.type === NavigationMenuItemType.OBJECT) {
        return (
          isDefined(item.targetObjectMetadataId) &&
          activeObjectMetadataItems.some(
            (meta) => meta.id === item.targetObjectMetadataId,
          )
        );
      }
      if (item.type === NavigationMenuItemType.VIEW) {
        if (!isDefined(item.viewId)) {
          return false;
        }
        const view = views.find((view) => view.id === item.viewId);
        return (
          isDefined(view) &&
          activeObjectMetadataItems.some(
            (meta) => meta.id === view.objectMetadataId,
          )
        );
      }
      if (item.type === NavigationMenuItemType.RECORD) {
        return (
          isDefined(item.targetRecordId) &&
          isDefined(item.targetObjectMetadataId) &&
          isDefined(item.targetRecordIdentifier) &&
          activeObjectMetadataItems.some(
            (meta) => meta.id === item.targetObjectMetadataId,
          )
        );
      }
      return false;
    })
    .sort((a, b) => a.position - b.position);
};
