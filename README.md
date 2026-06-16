# Invitaciones Web

<<<<<<< HEAD
Aplicacion estatica para crear, editar y publicar invitaciones digitales con HTML, CSS y JavaScript puro. Esta pensada para GitHub Pages y guarda invitaciones/confirmaciones en `localStorage`.
=======
Aplicación estática para crear, editar y publicar invitaciones digitales con HTML, CSS y JavaScript puro. Está pensada para GitHub Pages y guarda invitaciones/confirmaciones en `localStorage`.
>>>>>>> a1016e2aba7c08a6fb852fbfa4ce6fa84e50954a

## Abrir localmente

Puedes abrir `index.html` directamente o servir la carpeta:

```bash
python -m http.server 8080
```

Luego visita `http://localhost:8080`.

<<<<<<< HEAD
## Rutas principales

- `index.html`: listado y acceso al editor.
- `crear.html`: crear invitaciones.
- `editor.html?id=slug`: editar una invitacion.
- `administrador.html?id=slug`: ver confirmaciones y copiar enlace publico.
- `invitacion.html?id=slug`: vista publica para invitados.

Para GitHub Pages, todas las rutas internas deben ser relativas, nunca iniciar con `/`.

## URL personalizada

Cada invitacion tiene una URL publica basada en `slug`:

```text
invitacion.html?id=lidia-benitez-32-anos
```

En `crear.html`, completa el campo `URL personalizada` con letras minusculas, numeros y guiones. No uses espacios, tildes ni caracteres especiales.

Si dejas el campo vacio, la app genera automaticamente el slug desde el nombre, titulo y edad.

Ejemplo:

```text
Lidia Benitez 32 anos
lidia-benitez-32-anos
```

El slug no puede repetirse. En `editor.html` tambien puedes editar la URL personalizada; al cambiarla se actualiza el ID publico de la invitacion y el enlace anterior deja de funcionar.

## Compartir enlace publico

Desde `crear.html`, `editor.html` o `administrador.html` usa `Copiar enlace publico`. El enlace copiado es relativo:

```text
invitacion.html?id=lidia-32
```

La vista publica muestra solamente la invitacion y el formulario RSVP.

## Variables dinamicas

Puedes usar variables dentro de HTML, CSS y JavaScript personalizados. La app las reemplaza antes de mostrar la vista previa o la invitacion final.
=======
## Sidebar

La navegación principal está en un sidebar lateral:

- Inicio
- Crear invitación
- Admin
- Ver invitación, cuando la URL tiene `?id=`

En desktop se puede colapsar. La preferencia queda guardada en `localStorage`. En móvil aparece un botón hamburguesa y el menú se abre como panel superpuesto.

## Variables dinámicas

Puedes usar variables dentro de HTML, CSS y JavaScript personalizados. La app las reemplaza antes de mostrar la vista previa o la invitación final.
>>>>>>> a1016e2aba7c08a6fb852fbfa4ce6fa84e50954a

Variables disponibles:

```text
{{titulo}}
{{tipo}}
{{anfitrion}}
{{nombre}}
{{edad}}
{{fecha}}
{{dia}}
{{mes}}
{{anio}}
{{hora}}
{{lugar}}
{{direccion}}
{{googleMapsUrl}}
{{telefono}}
{{descripcion}}
```

<<<<<<< HEAD
## Diseno movil

La invitacion publica esta pensada para celulares: no debe generar scroll horizontal, las imagenes deben usar `max-width: 100%`, los textos grandes deben usar `clamp()` y los botones/formularios deben ocupar un ancho comodo.

Para HTML/CSS personalizado, evita anchos fijos mayores al viewport. Usa contenedores con `width: min(100%, 390px)` o `max-width: 100%`, imagenes fluidas y padding lateral pequeno.

Todo el contenido personalizado se renderiza dentro de:

```html
<section id="custom-invitation-root"></section>
```

## RSVP

Las confirmaciones se guardan en `localStorage` con la clave:

```text
rsvps_SLUG_DE_LA_INVITACION
```

## Seguridad

Esta version no usa backend. `adminPassword` vive en frontend y no es seguro para produccion. Para publicar con datos reales se recomienda Supabase, Firebase, Google Apps Script con controles de acceso o un backend propio.
=======
Ejemplo:

```html
<h1>{{nombre}}</h1>
<h2>{{edad}} años</h2>
<p>{{fecha}} - {{hora}}</p>
<p>{{lugar}}</p>
```

Si una variable no tiene dato, se reemplaza por un string vacío.

## Crear invitaciones

Entra en `Crear invitación`, carga los datos del evento y escribe código separado:

- `customHtml`: estructura.
- `customCss`: estilos sin `<style>`.
- `customJs`: scripts sin `<script>`.

La vista previa combina los datos y reemplaza las variables automáticamente.

## Editar invitaciones

Abre:

```text
pages/admin.html?id=ID_DE_LA_INVITACION
```

Ingresa la contraseña de administrador y presiona `Editar invitación`. El editor permite modificar datos, diseño, imágenes, animaciones, tipografía y código.

## Ver invitaciones

La URL pública es:

```text
pages/invitacion.html?id=ID_DE_LA_INVITACION
```

La invitación personalizada se renderiza aislada en un iframe para que su CSS y JS no afecten el RSVP.

## Seguridad

Esta versión no usa backend. `adminPassword` vive en frontend y no es seguro para producción. Para publicar con datos reales se recomienda Supabase, Firebase, Google Apps Script con controles de acceso o un backend propio.
>>>>>>> a1016e2aba7c08a6fb852fbfa4ce6fa84e50954a

## GitHub Pages

1. Sube el proyecto a GitHub.
2. Entra en `Settings`.
3. Abre `Pages`.
4. Elige `Deploy from a branch`.
5. Selecciona `main` y `/root`.
6. Guarda los cambios.
