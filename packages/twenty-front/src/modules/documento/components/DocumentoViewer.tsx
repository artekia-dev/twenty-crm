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

const StyledError = styled.span`
  color: ${themeCssVariables.font.color.danger};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledSpinner = styled.span`
  animation: documento-giro 0.7s linear infinite;
  border: 2px solid ${themeCssVariables.border.color.medium};
  border-radius: 50%;
  border-top-color: ${themeCssVariables.font.color.primary};
  display: inline-block;
  height: 12px;
  width: 12px;

  @keyframes documento-giro {
    to {
      transform: rotate(360deg);
    }
  }
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

type EstadoRelectura =
  | { fase: 'inactivo' }
  | { fase: 'leyendo' }
  | { fase: 'hecho' }
  | { fase: 'fallo'; motivo: string };

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
  const [relectura, setRelectura] = useState<EstadoRelectura>({
    fase: 'inactivo',
  });
  // Bumped after a successful reread so the frame reloads the file: the
  // document may have been re-cropped or re-scanned, and showing the old bytes
  // next to freshly extracted figures is how you end up mistrusting both.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

    // Say so rather than sitting on "Loading" for ever. A viewer that hangs in
    // silence is indistinguishable from a slow one, and there is nothing to go
    // on when it happens.
    if (!token) {
      setError(t`No se ha podido leer tu sesión. Recarga la página.`);

      return;
    }

    if (!recordId) {
      setError(t`Este visor solo funciona dentro de la ficha de un registro.`);

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
          setError(t`Este registro no tiene documento adjunto.`);

          return;
        }

        if (!response.ok) {
          setError(
            t`No se ha podido cargar el documento (${response.status}).`,
          );

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
          t`No se ha podido cargar el documento: ${e instanceof Error ? e.message : 'error desconocido'}`,
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
  }, [objeto, recordId, tokenPair, version]);

  // Reads the document again and waits for the answer.
  //
  // The request blocks until the watcher has finished: OCR plus a language
  // model, so seconds. That wait is deliberate — somebody pressed a button and
  // is watching, so they get the outcome rather than a promise that something
  // will happen later.
  //
  // Worth having at all because the figures are read by a language model, and
  // the same document can be read correctly once and wrongly the next time.
  // Without this, fixing a bad reading meant typing the numbers in by hand.
  const releer = async () => {
    const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

    if (!token || !recordId) return;

    setRelectura({ fase: 'leyendo' });

    try {
      const response = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/documento/${objeto}/${recordId}/releer`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
      );

      const cuerpo = (await response.json().catch(() => null)) as {
        ok?: boolean;
        motivo?: string;
      } | null;

      if (response.ok && cuerpo?.ok) {
        setRelectura({ fase: 'hecho' });
        setVersion((anterior) => anterior + 1);

        return;
      }

      setRelectura({
        fase: 'fallo',
        motivo: cuerpo?.motivo ?? t`No se pudo leer el documento.`,
      });
    } catch {
      setRelectura({
        fase: 'fallo',
        motivo: t`No se pudo contactar con el servidor.`,
      });
    }
  };

  if (error) return <StyledMessage>{error}</StyledMessage>;

  return (
    <StyledContainer>
      <StyledToolbar>
        {relectura.fase === 'leyendo' && (
          <>
            <StyledSpinner />
            <StyledStatus>{t`Leyendo el documento…`}</StyledStatus>
          </>
        )}
        {relectura.fase === 'hecho' && (
          <StyledStatus>{t`Documento releído. Los datos están actualizados.`}</StyledStatus>
        )}
        {relectura.fase === 'fallo' && (
          <StyledError>{relectura.motivo}</StyledError>
        )}
        <StyledButton
          onClick={releer}
          disabled={relectura.fase === 'leyendo' || !recordId}
        >
          {t`Volver a leer`}
        </StyledButton>
      </StyledToolbar>
      {objectUrl ? (
        <StyledFrame src={objectUrl} title={t`Documento`} allow="fullscreen" />
      ) : (
        <StyledMessage>{t`Cargando documento…`}</StyledMessage>
      )}
    </StyledContainer>
  );
};
