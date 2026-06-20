# Resumen de la app

## Que hace?

Invitaciones Web es una aplicacion estatica para crear, editar, publicar y administrar invitaciones digitales para eventos como cumpleanos, bodas, bautismos y eventos empresariales.

La app esta hecha con HTML, CSS y JavaScript puro. No necesita backend para funcionar: guarda las invitaciones personalizadas y las confirmaciones de asistencia en el `localStorage` del navegador. Tambien esta pensada para poder publicarse facilmente en GitHub Pages.

## Flujo principal

1. El usuario entra al inicio en `index.html`.
2. Desde ahi puede ver las invitaciones disponibles o crear una nueva.
3. En `crear.html` carga los datos del evento, personaliza la plantilla y genera una URL publica.
4. En `editor.html?id=slug` puede modificar una invitacion existente con un editor mas completo.
5. El invitado abre `invitacion.html?id=slug`, ve la invitacion y confirma asistencia.
6. El administrador entra a `administrador.html?id=slug`, coloca la contrasena y revisa las confirmaciones.

## Pantallas principales

- `index.html`: muestra el inicio de la app y el listado de invitaciones.
- `crear.html`: permite crear una invitacion nueva con datos del evento, imagenes, plantilla, HTML, CSS y JavaScript personalizado.
- `editor.html`: editor profesional para modificar datos generales, colores, portada, animaciones, tipografia, codigo personalizado y diseno visual.
- `invitacion.html`: vista publica que recibe el invitado, con diseno visual y formulario RSVP.
- `administrador.html`: panel privado para ver estadisticas, confirmaciones, enlace publico, QR y opciones para compartir.

## Funciones destacadas

- Creacion de invitaciones con URL personalizada mediante `slug`.
- Edicion de contenido, colores, imagenes, animaciones y tipografia.
- Soporte para HTML, CSS y JavaScript personalizado por invitacion.
- Vista previa en vivo dentro del editor.
- Editor visual con canvas usando Fabric.js para subir plantilla, agregar foto, mover elementos y exportar PNG.
- Formulario RSVP para confirmar asistencia.
- Panel administrativo con totales de respuestas, asistentes y acompanantes.
- Opciones para copiar enlace publico y compartir por WhatsApp, Facebook, Telegram o email.
- Generacion de codigo QR para compartir la invitacion.
- Exportacion e importacion de invitaciones en JSON.
- Exportacion de HTML publico.

## Editor visual profesional

El editor visual de `editor.html` usa Fabric.js sobre el canvas `visualInvitationCanvas`. Permite construir una invitacion visual con fondo, foto y textos editables directamente sobre la pieza.

Componentes nuevos:

- Barra de herramientas: agrega texto, deshace, rehace, duplica, sube/baja capas, elimina, exporta PNG y guarda el diseno.
- Panel de texto: aparece funcional cuando hay un texto seleccionado y permite cambiar contenido, fuente, tamano, color, negrita, cursiva, alineacion y rotacion.
- Panel de capas: lista fondo, foto y textos para seleccionar elementos y cambiar su orden.
- Historial visual: mantiene hasta 20 pasos para deshacer y rehacer cambios.
- Guardado visual: serializa el diseno Fabric.js en JSON y conserva posicion, tamano, rotacion, fuente, color, alineacion y propiedades del texto.
- Carga visual: reconstruye los objetos Fabric.js al volver a abrir una invitacion.

### Fotos, marcos y recortes

La segunda fase del editor visual agrega herramientas para trabajar con fotos dentro de la invitacion:

- Fotos editables como objetos Fabric.js: se pueden mover, escalar, rotar, bloquear, desbloquear, eliminar y ordenar por capas.
- Marcos de foto: rectangulo, cuadrado, circulo, ovalo, corazon y estrella.
- Recorte visual: una foto puede quedar dentro del marco usando `clipPath`, con zoom, centrado, ajuste al marco y reemplazo sin perder la forma.
- Filtros basicos: brillo, contraste, saturacion, blanco y negro, sepia y opacidad.
- Estilos para fotos y marcos: borde, color de borde, grosor, sombra, glow y radio de borde.
- Panel de medidas: permite editar X, Y, ancho, alto y rotacion del objeto seleccionado.
- Fondo bloqueado por defecto: la plantilla no se selecciona ni se mueve accidentalmente, con opcion manual para desbloquearla.
- Guardado optimizado: el JSON visual conserva recortes, filtros, estilos y orden de capas. Si una imagen base64 es demasiado pesada, la app muestra una advertencia para evitar saturar `localStorage`.

### Biblioteca de elementos y stickers

La tercera fase agrega una biblioteca visual para decorar sin escribir codigo:

- Seccion `Elementos` con buscador y categorias: corazones, estrellas, globos, flores, luces, musica, K-Pop, princesas, futbol, marcos decorativos e iconos basicos.
- Stickers cargados desde rutas locales en `assets/elements/`, evitando base64 cuando el recurso viene del proyecto.
- Insercion directa al canvas Fabric.js, seleccion automatica y soporte para mover, escalar, rotar, duplicar, bloquear y eliminar.
- Favoritos guardados por navegador con la clave `visual_element_favorites`.
- SVG con color principal editable y opacidad configurable.
- PNG preparado para opacidad y filtros basicos cuando se agreguen recursos PNG a la biblioteca.
- Cada sticker aparece en capas como `Sticker: nombre`.
- El JSON visual guarda ruta, tipo de elemento, categoria, posicion, tamano, rotacion, opacidad, color, sombra, glow, bloqueo, animacion marcada y orden de capa.

### Animaciones, efectos e interactividad

La cuarta fase suma capacidades dinamicas al editor visual:

- Seccion `Efectos` con brillos, destellos, particulas, luces, confeti, nieve, estrellas, corazones, burbujas, fuegos, humo y chispas.
- Los efectos se agregan como capas Fabric.js, por lo que se pueden mover, escalar, rotar, duplicar, reordenar, bloquear y eliminar.
- Panel de animaciones por objeto: entrada, animacion continua, velocidad, intensidad, duracion, luz y efectos especiales de texto.
- Efectos de luz aplicables a texto, fotos, stickers, efectos y componentes: halo, luz lateral, reflejo, brillo magico y neon.
- Componentes interactivos visuales: cuenta regresiva, musica, galeria, mapa, confirmar asistencia, WhatsApp, llamar y como llegar.
- Presets tematicos: K-Pop, princesa, Frozen, unicornio, futbol, boda elegante y empresarial.
- En preview/export HTML se genera un overlay autonomo para particulas, cuenta regresiva, botones, enlaces, mapa/ubicacion y musica.
- La imagen exportada conserva el resultado visual del canvas; el overlay HTML mantiene los efectos dinamicos e interacciones soportadas.

## Almacenamiento

La app usa `localStorage` para guardar:

- Invitaciones creadas o editadas.
- Invitaciones eliminadas.
- Confirmaciones RSVP por invitacion.
- Preferencias de interfaz, como el estado del menu lateral.
- Imagenes y disenos visuales asociados a invitaciones.

Las confirmaciones se guardan con claves similares a:

```text
rsvps_slug-de-la-invitacion
```

## Publicacion

El proyecto puede publicarse como sitio estatico, por ejemplo en GitHub Pages. Como no depende de un servidor propio, basta con subir los archivos HTML, CSS, JavaScript y assets.

## Limitaciones actuales

- La seguridad del panel administrador es limitada, porque la contrasena vive en el frontend.
- Los datos se guardan en el navegador; si se borra el almacenamiento local, se pierden invitaciones y respuestas guardadas ahi.
- Para uso real con muchos invitados conviene conectar una base de datos o servicio externo, como Supabase, Firebase, Google Apps Script o un backend propio.

## En resumen

La app funciona como un pequeno sistema de gestion de invitaciones digitales: permite disenar eventos personalizados, compartirlos con invitados, recibir confirmaciones y revisar los resultados desde un panel administrativo.
