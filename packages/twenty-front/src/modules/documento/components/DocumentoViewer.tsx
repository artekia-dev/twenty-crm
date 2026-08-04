import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useEffect, useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';

const StyledFrame = styled.iframe`
  border: none;
  display: block;
  height: 100%;
  width: 100%;
`;

const StyledMessage = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  padding: ${themeCssVariables.spacing[4]};
`;

type DocumentoViewerProps = {
  objeto: 'factura' | 'albaran';
};

// Shows the scanned document of an invoice or delivery note.
//
// The PDF is fetched with the caller's token and handed to the browser as a
// blob, rather than pointing the frame straight at the endpoint. That is not a
// preference: Twenty keeps its session in an Authorization header, and a plain
// iframe navigation sends no headers, so the direct route answers 403.
//
// Nothing is written to disk. createObjectURL keeps the bytes in memory for
// this tab and hands back a local reference, released on unmount.
//
// No PDF library either. A blob of application/pdf goes to the browser's own
// viewer, which already does paging, zoom and full screen better than anything
// worth bundling.
export const DocumentoViewer = ({ objeto }: DocumentoViewerProps) => {
  const tokenPair = useAtomStateValue(tokenPairState);
  // From the page context, not the route: the widget is rendered in places
  // where the record id is not a route parameter, and widget configuration
  // cannot carry it because one widget serves every record of the object.
  const recordId = useTargetRecord()?.id;
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

    // Say so rather than sitting on "Loading" for ever. A viewer that hangs in
    // silence is indistinguishable from a slow one, and there is nothing to go
    // on when it happens.
    if (!token) {
      setError(t`Your session could not be read. Reload the page.`);

      return;
    }

    if (!recordId) {
      setError(t`This viewer only works inside a record page.`);

      return;
    }

    let url: string | null = null;
    let cancelled = false;

    const load = async () => {
      setError(null);

      try {
        const response = await fetch(
          `${REACT_APP_SERVER_BASE_URL}/documento/${objeto}/${recordId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (response.status === 404) {
          setError(t`This record has no document attached.`);

          return;
        }

        if (!response.ok) {
          setError(t`The document could not be loaded (${response.status}).`);

          return;
        }

        url = URL.createObjectURL(await response.blob());

        if (cancelled) {
          URL.revokeObjectURL(url);

          return;
        }

        setObjectUrl(url);
      } catch (e) {
        setError(
          t`The document could not be loaded: ${e instanceof Error ? e.message : 'unknown error'}`,
        );
      }
    };

    void load();

    return () => {
      cancelled = true;
      // Held in memory until released, so a user opening many records would
      // otherwise accumulate every document they looked at.
      if (url) URL.revokeObjectURL(url);
      setObjectUrl(null);
    };
  }, [objeto, recordId, tokenPair]);

  if (error) return <StyledMessage>{error}</StyledMessage>;

  if (!objectUrl) return <StyledMessage>{t`Loading document…`}</StyledMessage>;

  return <StyledFrame src={objectUrl} title={t`Document`} allow="fullscreen" />;
};
