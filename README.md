# Organización de Archivos

Herramienta web de la Fundación Fondacio Colombia (CEI Altos del Cabo) para revisar y renombrar los archivos de Google Drive con la regla de nombres de la Fundación:

```
BLOQUE_TIPO_FECHA_Descripcion_Version      ej.  CAM_IAC_2026-05-30_JornadaSiembra_v01
```

- **Página:** https://organizacion-archivos.vercel.app
- **Quién puede entrar:** cuentas `@fondacio-co.org` (la app de Google está configurada como *Interna*).

Está hecha con React, Vite y shadcn/ui. Funciona solo en el navegador: no hay servidor propio y cada persona entra con su propia cuenta de Google, así que solo ve y cambia lo que esa cuenta ya puede ver y editar en Drive.

## Qué hace

- **Carpetas:** al iniciar sesión muestra Mi unidad, las unidades compartidas y lo compartido con la cuenta. Se navega con clic y se pulsa **Ordenar esta carpeta** (lee la carpeta y sus subcarpetas, hasta 5.000 archivos).
- **Revisión:** cada archivo aparece con ✅ si cumple la regla o ⚠️ con el motivo si no. El botón **«N sin nomenclatura»** muestra solo los que faltan.
- **Nomenclatura (pestaña principal):** sugiere el nombre corregido reutilizando el bloque, el tipo, la fecha y la versión que ya trae el archivo. Si falta algo (por ejemplo el bloque o la descripción) lo pide. La descripción y la fecha se pueden corregir archivo por archivo en la vista previa.
- **Más opciones:** Nombre nuevo (con numeración automática), Reemplazar texto, Agregar prefijo o sufijo, Formato y Manual.
- **Seguridad:** vista previa, confirmación que explica qué archivos no se tocarán y por qué, bloqueo de nombres repetidos y de archivos sin permiso, **Historial** con **Deshacer** por lote y registro CSV.

### Regla de nombres

| Parte | Valores |
|---|---|
| Bloque | FOR, CAM, SOS, BYC, GEN |
| Tipo | ACT, ADM, BDD, COM, FIC, FMT, IAC, IDO, INC, IRE, MAN, MAT, PRY (MAN, FMT y FIC van sin fecha) |
| Fecha | `2026`, `2026-05`, `2026-05-30`, semestre `2026-S1`/`2026-S2` o rango `2024-2026` |
| Descripción | Junta, sin tildes, mayúscula en cada palabra: `JornadaSiembra` |
| Versión | `v01`, `v02`… o `FINAL` |

Los códigos están en `src/lib/nomenclature.ts`: para agregar o cambiar un bloque o tipo se edita esa lista.

## Trabajar en el código

```powershell
npm install
npm run dev
```

Abre http://localhost:5173. Para conectarse a Google crea un archivo `.env` (no se sube a GitHub) con el ID de cliente:

```
VITE_GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxx.apps.googleusercontent.com
```

Sin ese archivo, o con `?demo` en la dirección, la página abre en **modo demostración** con archivos de ejemplo.

```powershell
npm test         # pruebas automáticas de la regla de nombres
npm run build    # compilación de producción (carpeta dist)
```

## Publicación

Cada cambio que se sube a la rama `main` de este repositorio se publica solo en Vercel (cuenta de la Fundación) en un minuto aproximadamente. En Vercel el proyecto tiene la variable `VITE_GOOGLE_CLIENT_ID`.

## Google Cloud (cuenta de la Fundación)

- **API:** Google Drive API habilitada.
- **Pantalla de consentimiento:** público *Interno*, permiso `.../auth/drive`.
- **Cliente OAuth (Aplicación web):** en *Orígenes de JavaScript autorizados* deben estar `https://organizacion-archivos.vercel.app` y `http://localhost:5173`. Si la página se publica en otra dirección (por ejemplo un subdominio propio), hay que agregarla ahí o el inicio de sesión falla con `origin_mismatch`.
- No se usa el *secreto de cliente*: el ID de cliente es público por diseño y es lo único que necesita la página.

## Archivos principales

| Archivo | Qué hace |
|---|---|
| `src/lib/nomenclature.ts` | Códigos, reglas de la nomenclatura, sugerencias y motivos de error |
| `src/lib/rename.ts` | Vista previa de los nombres nuevos y detección de problemas |
| `src/lib/google-drive.ts` | Inicio de sesión con Google y llamadas a la API de Drive |
| `src/lib/demo-drive.ts` | Datos de ejemplo del modo demostración |
| `src/components/*` | Pantallas y piezas de la interfaz |
| `src/index.css` | Tema y paleta de colores |
| `src/lib/*.test.ts` | Pruebas automáticas |
