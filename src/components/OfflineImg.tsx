import { useEffect, useState } from 'react';
import { localdb } from '../lib/localdb';

/**
 * <img> que resuelve primero contra la caché local de archivos (IndexedDB).
 * Las imágenes subidas sin internet se muestran igual: el blob queda guardado
 * localmente y la URL pública empieza a funcionar después del sync.
 */
export default function OfflineImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [resolved, setResolved] = useState<string>(src);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    setResolved(src);
    (async () => {
      if (!src) return;
      try {
        const file = await localdb._files.get(src);
        if (file && alive) {
          objectUrl = URL.createObjectURL(file.blob);
          setResolved(objectUrl);
        }
      } catch { /* sin caché local — se usa la URL remota */ }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return <img src={resolved} alt={alt} className={className} />;
}
