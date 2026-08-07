import { useMemo } from 'react';

import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';

// Las empresas del CRM indexadas por NIF, para poder poner nombre a un CIF.
//
// El ranking mostraba "A99000601" y eso no le dice nada a nadie. El nombre
// puede venir de dos sitios: el que se leyo del documento, o la ficha de
// empresa del CRM si ese NIF esta dado de alta. La ficha manda cuando existe
// —es el dato mantenido, no el que salio de un OCR— y ademas permite abrir la
// empresa desde el panel.

type EmpresaPanel = {
  id: string;
  name: string | null;
  nif: string | null;
  codigo: string | null;
  activa: boolean | null;
};

/** Sin espacios, guiones ni puntos, y en mayusculas: "es-b12345678" → "B12345678". */
export const normalizarNif = (nif: string | null | undefined): string => {
  if (!nif) return '';

  const limpio = nif.replace(/[\s.\-]/g, '').toUpperCase();

  // Los documentos intracomunitarios llevan el prefijo del pais delante del
  // CIF: "ESB50185586" y "B50185586" son la misma empresa.
  return limpio.startsWith('ES') && limpio.length > 9 ? limpio.slice(2) : limpio;
};

export type EmpresaConocida = { id: string; nombre: string };

export const useEmpresas = () => {
  const { records } = useFindManyRecords<EmpresaPanel>({
    objectNameSingular: 'company',
    recordGqlFields: { id: true, name: true, nif: true, codigo: true, activa: true },
    limit: 200,
  });

  return useMemo(() => {
    const porNif = new Map<string, EmpresaConocida>();
    // Por id ademas de por NIF: la sociedad de una factura viene por id, y sin
    // esto el reparto por sociedad mostraria UUIDs.
    const porId = new Map<string, EmpresaConocida>();
    const delGrupo: EmpresaConocida[] = [];

    for (const empresa of records) {
      if (!empresa.name) continue;

      const ficha = { id: empresa.id, nombre: empresa.name };
      const nif = normalizarNif(empresa.nif);

      if (nif) porNif.set(nif, ficha);
      porId.set(empresa.id, ficha);

      // Las sociedades del grupo llevan codigo interno y carpeta propia; un
      // proveedor que alguien de de alta como empresa no. Sin este filtro, el
      // reparto del grupo acabaria listando proveedores con cero.
      if (empresa.codigo && empresa.activa !== false) delGrupo.push(ficha);
    }

    delGrupo.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    return { porNif, porId, delGrupo };
  }, [records]);
};
