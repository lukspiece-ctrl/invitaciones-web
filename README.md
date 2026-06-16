# Invitaciones Web

Aplicación estática para crear, editar y publicar invitaciones digitales con HTML, CSS y JavaScript puro. Está pensada para GitHub Pages y guarda invitaciones/confirmaciones en `localStorage`.

## Abrir localmente

Puedes abrir `index.html` directamente o servir la carpeta:

```bash
python -m http.server 8080
```

Luego visita `http://localhost:8080`.

## Sidebar

La navegación principal está en un sidebar lateral:

- Inicio
- Crear invitación
- Admin
- Ver invitación, cuando la URL tiene `?id=`

En desktop se puede colapsar. La preferencia queda guardada en `localStorage`. En móvil aparece un botón hamburguesa y el menú se abre como panel superpuesto.

## Variables dinámicas

Puedes usar variables dentro de HTML, CSS y JavaScript personalizados. La app las reemplaza antes de mostrar la vista previa o la invitación final.

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

## GitHub Pages

1. Sube el proyecto a GitHub.
2. Entra en `Settings`.
3. Abre `Pages`.
4. Elige `Deploy from a branch`.
5. Selecciona `main` y `/root`.
6. Guarda los cambios.
