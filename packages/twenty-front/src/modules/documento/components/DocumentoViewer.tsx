import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useEffect, useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const StyledToolbar = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledButton = styled.button`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[3]};

  &:hover:not(:disabled) {
    background: ${themeCssVariables.background.transparent.light};
  }

  &:disabled {
    color: ${themeCssVariables.font.color.tertiary};
    cursor: default;
  }
`;

const StyledStatus = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledFrame = styled.iframe`
  border: none;
  display: block;
  flex: 1;
  width: 100%;
`;

const StyledMessage = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  padding: ${themeCssVariables.spacing[4]};
`;

type DocumentoViewerProps = {
  objeto: 'factura' | 'albaran';
};

type RescanState = 'idle' | 'sending' | 'queued' | 'failed';

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
  const [rescan, setRescan] = useState<RescanState>('idle');

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

  // Queues the record for a fresh extraction.
  //
  // Nothing is re-read here, and that is the point: the watcher already picks
  // up anything left in PENDIENTE and reprocesses it forcing a new OCR, even
  // though the file has not changed. So asking for a rescan is just setting
  // that state and letting the machinery that already exists do the work.
  //
  // Worth having because the reading is done by a language model: the same
  // document can be read correctly once and wrongly the next time. Without a
  // way to ask again, the only fix for a bad reading was to edit the numbers
  // by hand.
  const requestRescan = async () => {
    const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

    if (!token || !recordId) return;

    setRescan('sending');

    try {
      const response = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/rest/${objeto === 'factura' ? 'facturas' : 'albaranes'}/${recordId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ estadoExtraccion: 'PENDIENTE' }),
        },
      );

      setRescan(response.ok ? 'queued' : 'failed');
    } catch {
      setRescan('failed');
    }
  };

  if (error) return <StyledMessage>{error}</StyledMessage>;

  return (
    <StyledContainer>
      <StyledToolbar>
        {rescan === 'queued' && (
          <StyledStatus>{t`Queued. It will be read again within a minute.`}</StyledStatus>
        )}
        {rescan === 'failed' && (
          <StyledStatus>{t`It could not be queued. Try again.`}</StyledStatus>
        )}
        <StyledButton
          onClick={requestRescan}
          disabled={rescan === 'sending' || !recordId}
        >
          {rescan === 'sending' ? t`Queueing…` : t`Read document again`}
        </StyledButton>
      </StyledToolbar>
      {objectUrl ? (
        <StyledFrame src={objectUrl} title={t`Document`} allow="fullscreen" />
      ) : (
        <StyledMessage>{t`Loading document…`}</StyledMessage>
      )}
    </StyledContainer>
  );
};
