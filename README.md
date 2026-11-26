# Organización de Archivos

Página web para buscar archivos en una carpeta de Google Drive (también en unidades compartidas) y cambiarles el nombre, de uno en uno o en lote.

Está hecha con React, Vite y shadcn/ui. Funciona solo en el navegador: no hay servidor propio, y cada persona entra con su propia cuenta de Google.

## Probarla sin configurar nada

```powershell
npm install
npm run dev
```

Abre http://localhost:5173. Mientras no haya un ID de cliente de Google, la página abre en **modo demostración** con archivos de ejemplo. También puedes forzarlo con `?demo` en la dirección.

## Conectarla a Google Drive (una sola vez, ~15 min)

1. Entra a https://console.cloud.google.com con la cuenta que va a administrar la app y crea un proyecto (por ejemplo "Renombrador Drive").
2. **APIs y servicios → Biblioteca**: busca **Google Drive API** y actívala.
3. **APIs y servicios → Pantalla de consentimiento de OAuth** (Google Auth Platform):
   - Tipo de usuario:
     - **Interno**: si la cuenta es de Google Workspace y solo la usará gente de esa organización. No necesita verificación.
     - **Externo**: si la usarán cuentas de distintas organizaciones o Gmail. Mientras esté en modo "Prueba", agrega en **Usuarios de prueba** cada correo que la vaya a usar (máximo 100).
   - Nombre de la app, correo de soporte y logo.
   - En **Permisos (scopes)** agrega `.../auth/drive`.
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - **Orígenes de JavaScript autorizados**: `http://localhost:5173` y la dirección donde se publique (ej. `https://renombrador.vercel.app`).
   - No hace falta URI de redirección.
5. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`), crea un archivo `.env` junto a este README y pégalo:

   ```
   VITE_GOOGLE_CLIENT_ID=1234567890-abc...apps.googleusercontent.com
   ```

6. Reinicia `npm run dev`. Ya debería aparecer "Iniciar sesión con Google".

> El ID de cliente no es secreto: está pensado para ir dentro de una página web. No hace falta (ni se debe) usar un "secreto de cliente".

## Publicarla (Vercel, gratis)

1. Sube esta carpeta a un repositorio de GitHub.
2. En https://vercel.com → **Add New → Project** → elige el repositorio (detecta Vite solo).
3. En **Environment Variables** agrega `VITE_GOOGLE_CLIENT_ID` con el mismo valor.
4. Al terminar, copia la dirección pública y agrégala en el paso 4 de arriba como origen autorizado.

Netlify o GitHub Pages también sirven (comando `npm run build`, carpeta `dist`).

## Cómo funciona

- **Cuentas**: cada persona inicia sesión con su cuenta y ve solo lo que esa cuenta puede ver. Desde el menú de la cuenta se puede cambiar de cuenta o cerrar sesión.
- **Unidades compartidas**: funcionan. Para renombrar se necesita el rol de *Colaborador* o *Administrador de contenido*; con menos permisos el archivo aparece con un candado.
- **Carpetas**: al iniciar sesión se ven las carpetas de la cuenta (Mi unidad, Unidades compartidas y Compartido conmigo). Se navega con clic y se pulsa **Trabajar aquí**. La página lee esa carpeta y sus subcarpetas (hasta 5.000 archivos) y recuerda las últimas 5 usadas por cada cuenta.
- **Búsqueda**: instantánea, sin importar mayúsculas ni tildes, con filtro por tipo y opción de incluir o no las subcarpetas.
- **Formas de renombrar**:
  - **Reemplazar** texto, con opción de distinguir mayúsculas o usar una expresión regular.
  - **Agregar** prefijo o sufijo.
  - **Numerar** con un patrón: `{n}`, `{nombre}`, `{fecha}`.
  - **Formato**: mayúsculas o minúsculas, separador, quitar tildes y espacios de más.
  - **Manual**: escribir el nombre de cada archivo.
- **Seguridad**: hay vista previa antes de aplicar, aviso de nombres repetidos, confirmación, **Deshacer** por lote y descarga de un registro CSV de los cambios.
- La extensión (`.pdf`, `.jpg`…) se conserva por defecto.

## Archivos principales

| Archivo | Qué hace |
|---|---|
| `src/lib/google-drive.ts` | Inicio de sesión con Google y llamadas a la API de Drive |
| `src/lib/demo-drive.ts` | Datos de ejemplo del modo demostración |
| `src/lib/rename.ts` | Reglas de renombrado y detección de problemas |
| `src/components/*` | Pantallas y piezas de la interfaz |
| `src/index.css` | Tema y paleta de colores |
