const invitaciones = [
  {
    id: "cumple-lidia-32",
    titulo: "Mis 32 Años",
    tipo: "Cumpleaños",
    anfitrion: "Lidia Benítez",
    nombre: "Lidia Benítez",
    edad: "32",
    fecha: "2026-09-19",
    hora: "10:00",
    lugar: "Quinta Las Rosas",
    direccion: "Av. Principal 123, Asunción",
    telefono: "+595 981 000 000",
    descripcion: "Una celebración íntima con estilo floral.",
    imagen: "assets/img/cumpleanos.svg",
    googleMapsUrl: "https://maps.google.com/?q=Av.+Principal+123+Asuncion",
    sheetEndpoint: "",
    adminPassword: "lidia32",
    customHtml: `
      <main class="birthday-print-wrapper">
        <article class="birthday-card" aria-label="Invitación de cumpleaños de Lidia Benítez">
          <div class="floral-corner floral-corner-top-left" aria-hidden="true">
            <span class="flower flower-main">🌸</span>
            <span class="flower flower-small">🌿</span>
            <span class="leaf leaf-a"></span>
          </div>

          <div class="floral-corner floral-corner-top-right" aria-hidden="true">
            <span class="flower flower-main">🌺</span>
            <span class="flower flower-small">🌿</span>
            <span class="leaf leaf-b"></span>
          </div>

          <section class="birthday-content">
            <p class="intro-word">Mis</p>
            <div class="age-line">
              <strong>{{edad}}</strong>
              <span>Años</span>
            </div>
            <h1>{{nombre}}</h1>
            <p class="subtitle">{{descripcion}}</p>

            <div class="date-grid" aria-label="Fecha y hora">
              <span>SÁBADO</span>
              <strong>{{dia}}</strong>
              <span>{{hora}}</span>
            </div>

            <div class="event-place">
              <p>{{lugar}}</p>
              <small>{{direccion}}</small>
            </div>

            <p class="confirm-text">Confirmar asistencia</p>
            <p class="closing">¡Te esperamos!</p>
          </section>

          <div class="bottom-florals" aria-hidden="true">
            <span class="bottom-flower">🌷</span>
            <span class="bottom-leaves">🌿 🌿</span>
            <span class="bottom-flower">🌸</span>
          </div>
        </article>
      </main>
    `,
    customCss: `
      :root {
        --ivory: #fffaf0;
        --paper: #fffdf7;
        --gold: #b89145;
        --wine: #7d253b;
        --soft-green: #8fa77b;
        --ink: #4a4038;
      }

      body {
        background: #f3f0ea;
      }

      .birthday-print-wrapper {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 28px 14px;
        background: #f3f0ea;
      }

      .birthday-card {
        position: relative;
        width: min(430px, 100%);
        min-height: 760px;
        overflow: hidden;
        display: grid;
        align-items: center;
        border: 1px solid rgba(184, 145, 69, 0.78);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(255, 250, 240, 0.96)),
          var(--paper);
        box-shadow: 0 22px 52px rgba(70, 52, 39, 0.16);
        color: var(--ink);
      }

      .birthday-card::before {
        content: "";
        position: absolute;
        inset: 12px;
        border: 1px solid rgba(184, 145, 69, 0.38);
        pointer-events: none;
      }

      .birthday-content {
        position: relative;
        z-index: 2;
        width: 100%;
        display: grid;
        justify-items: center;
        gap: 15px;
        padding: 118px 38px 120px;
        text-align: center;
      }

      .intro-word {
        margin: 0;
        color: var(--gold);
        font-family: Georgia, serif;
        font-size: 1.55rem;
        font-style: italic;
      }

      .age-line {
        display: flex;
        align-items: end;
        justify-content: center;
        gap: 10px;
        color: var(--gold);
        line-height: 0.86;
      }

      .age-line strong {
        font-family: Georgia, serif;
        font-size: 7.4rem;
        font-weight: 500;
      }

      .age-line span {
        margin-bottom: 16px;
        font-family: Georgia, serif;
        font-size: 2rem;
        font-style: italic;
      }

      .birthday-content h1 {
        margin: 2px 0 0;
        color: var(--wine);
        font-family: "Segoe Script", "Brush Script MT", cursive;
        font-size: 2.55rem;
        font-weight: 500;
        line-height: 1.15;
      }

      .subtitle {
        width: min(290px, 100%);
        margin: 0;
        color: #6c5b51;
        font-size: 0.98rem;
        line-height: 1.55;
      }

      .date-grid {
        width: min(310px, 100%);
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 12px;
        margin: 10px 0 4px;
        padding: 12px 0;
        border-top: 1px solid rgba(184, 145, 69, 0.55);
        border-bottom: 1px solid rgba(184, 145, 69, 0.55);
        color: var(--ink);
      }

      .date-grid span {
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.12em;
      }

      .date-grid strong {
        min-width: 68px;
        color: var(--gold);
        font-family: Georgia, serif;
        font-size: 2.5rem;
        font-weight: 500;
        border-right: 1px solid rgba(184, 145, 69, 0.45);
        border-left: 1px solid rgba(184, 145, 69, 0.45);
      }

      .event-place p,
      .confirm-text,
      .closing {
        margin: 0;
      }

      .event-place p {
        color: var(--wine);
        font-weight: 800;
        letter-spacing: 0.04em;
      }

      .event-place small {
        display: block;
        margin-top: 5px;
        color: #6c5b51;
      }

      .confirm-text {
        margin-top: 8px;
        color: var(--gold);
        font-size: 0.82rem;
        font-weight: 900;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .closing {
        color: var(--wine);
        font-family: Georgia, serif;
        font-size: 1.25rem;
        font-style: italic;
      }

      .floral-corner,
      .bottom-florals {
        position: absolute;
        z-index: 1;
        pointer-events: none;
      }

      .floral-corner {
        top: 16px;
        width: 145px;
        height: 145px;
      }

      .floral-corner-top-left {
        left: 14px;
      }

      .floral-corner-top-right {
        right: 14px;
        transform: scaleX(-1);
      }

      .flower {
        position: absolute;
        filter: drop-shadow(0 5px 8px rgba(80, 60, 45, 0.1));
      }

      .flower-main {
        top: 2px;
        left: 4px;
        font-size: 4.1rem;
      }

      .flower-small {
        top: 64px;
        left: 76px;
        color: var(--soft-green);
        font-size: 2.2rem;
        transform: rotate(20deg);
      }

      .leaf {
        position: absolute;
        width: 92px;
        height: 62px;
        border-top: 2px solid rgba(143, 167, 123, 0.75);
        border-radius: 50%;
      }

      .leaf-a {
        top: 70px;
        left: 22px;
        transform: rotate(-28deg);
      }

      .leaf-b {
        top: 26px;
        left: 54px;
        transform: rotate(32deg);
      }

      .bottom-florals {
        right: 0;
        bottom: 0;
        left: 0;
        display: flex;
        align-items: end;
        justify-content: center;
        gap: 14px;
        padding-bottom: 26px;
        font-size: 2.6rem;
      }

      .bottom-florals::before,
      .bottom-florals::after {
        content: "";
        width: 92px;
        height: 46px;
        border-top: 2px solid rgba(143, 167, 123, 0.7);
        border-radius: 50%;
      }

      .bottom-leaves {
        color: var(--soft-green);
        font-size: 2rem;
      }

      @media (max-width: 480px) {
        .birthday-print-wrapper {
          padding: 16px 10px;
        }

        .birthday-card {
          min-height: 720px;
        }

        .birthday-content {
          padding: 104px 28px 112px;
        }

        .age-line strong {
          font-size: 6.4rem;
        }

        .birthday-content h1 {
          font-size: 2.2rem;
        }

        .floral-corner {
          width: 122px;
          height: 122px;
        }

        .flower-main {
          font-size: 3.35rem;
        }
      }
    `,
    customJs: `
      document.querySelector(".birthday-card")?.classList.add("is-ready");
    `
  },
  {
    id: "boda-lucia-mateo",
    titulo: "Boda de Lucía y Mateo",
    tipo: "Boda",
    anfitrion: "Lucía & Mateo",
    fecha: "2026-10-03",
    hora: "18:30",
    lugar: "Jardín Las Magnolias",
    direccion: "Ruta Verde Km 8, San Bernardino",
    descripcion: "Nos encantaría compartir contigo este día tan especial.",
    imagen: "assets/img/boda.svg",
    googleMapsUrl: "https://maps.google.com/?q=San+Bernardino+Paraguay",
    sheetEndpoint: "",
    adminPassword: "lucia-mateo"
  },
  {
    id: "empresa-nova",
    titulo: "Lanzamiento Nova",
    tipo: "Evento empresarial",
    anfitrion: "Nova Studio",
    fecha: "2026-09-12",
    hora: "09:00",
    lugar: "Centro de Convenciones",
    direccion: "Calle Palma 456, Asunción",
    descripcion: "Presentación de producto, networking y desayuno ejecutivo.",
    imagen: "assets/img/empresarial.svg",
    googleMapsUrl: "https://maps.google.com/?q=Calle+Palma+456+Asuncion",
    sheetEndpoint: "",
    adminPassword: "nova-admin"
  },
  {
    id: "bautismo-emma",
    titulo: "Bautismo de Emma",
    tipo: "Bautismo",
    anfitrion: "Familia Benítez",
    fecha: "2026-07-26",
    hora: "11:00",
    lugar: "Parroquia San José",
    direccion: "Barrio Las Mercedes, Asunción",
    descripcion: "Acompáñanos en una mañana familiar llena de cariño.",
    imagen: "assets/img/bautismo.svg",
    googleMapsUrl: "https://maps.google.com/?q=Parroquia+San+Jose+Asuncion",
    sheetEndpoint: "",
    adminPassword: "emma2026"
  }
];
