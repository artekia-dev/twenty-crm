import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';
import { isDefined } from 'twenty-shared/utils';

// Recognises an embedded-page widget that actually points at our document
// endpoint, so it can be rendered by the viewer instead of a raw iframe.
//
// Configured as `/documento/factura`, with no record id: widget configuration
// is static and shared by every record of the object, so the id comes from the
// page the widget is being rendered on.
const PATRON = /^\/documento\/(factura|albaran)$/;

export const matchDocumentoWidget = (
  widget: PageLayoutWidget,
): { objeto: 'factura' | 'albaran' } | undefined => {
  const configuration = widget.configuration;

  if (!isDefined(configuration) || !('url' in configuration)) return undefined;

  const url = (configuration as { url?: unknown }).url;

  if (typeof url !== 'string') return undefined;

  const match = PATRON.exec(url.trim());

  if (!match) return undefined;

  return { objeto: match[1] as 'factura' | 'albaran' };
};
