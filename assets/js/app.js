(function () {
  const page = document.body.dataset.page;
  const CUSTOM_INVITATIONS_KEY = "custom_invitations";
  const DELETED_INVITATIONS_KEY = "deleted_invitations";
  const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";
  const DEFAULT_DESIGN = {
    primaryColor: "#3f7d72",
    secondaryColor: "#c4765c",
    textColor: "#26302f",
    buttonColor: "#3f7d72",
    mainImage: "",
    backgroundImage: "",
    imageUrl: "",
    uploadedImage: "",
    animation: "none",
    typography: "classic"
  };

  let activeEditorInvitation = null;
  let originalEditorInvitation = null;

  function getCurrentInvitationId() {
    return new URLSearchParams(window.location.search).get("id");
  }

  function buildUrl(page, params = {}) {
    const query = new URLSearchParams(params).toString();
    return query ? `${page}?${query}` : page;
  }

  function generateSlug(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/ñ/g, "n")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function validateSlug(slug) {
    return /^[a-z0-9-]+$/.test(slug) && !slug.startsWith("-") && !slug.endsWith("-");
  }

  function getPublicInvitationUrl(slug) {
    return buildUrl("invitacion.html", { id: slug });
  }

  async function copyPublicUrl(slug) {
    const url = getPublicInvitationUrl(slug);
    await navigator.clipboard.writeText(url);
    return url;
  }

  const getInvitationId = getCurrentInvitationId;
  const storageKey = (id) => `rsvps_${id}`;
  const legacyStorageKey = (id) => `confirmaciones_${id}`;
  const normalizeId = generateSlug;

  const getStoredJson = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (error) {
      return fallback;
    }
  };

  const setStoredJson = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const fieldValue = (formData, name, fallback = "") => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : fallback;
  };

  function getSlugFromFormData(formData, fallbackId = "") {
    const explicitSlug = fieldValue(formData, "slug");
    const source = explicitSlug || [fieldValue(formData, "nombre"), fieldValue(formData, "titulo"), fieldValue(formData, "edad")].filter(Boolean).join(" ") || fallbackId;
    return generateSlug(source);
  }

  function sanitizeSlugInput(input) {
    if (!input) return;
    const cursor = input.selectionStart;
    input.value = generateSlug(input.value);
    if (document.activeElement === input && typeof cursor === "number") {
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function splitDateParts(dateValue) {
    if (!dateValue) return { dia: "", mes: "", anio: "" };
    const [anio, mes, dia] = dateValue.split("-");
    return { dia: dia || "", mes: mes || "", anio: anio || "" };
  }

  function replaceInvitationVariables(template, invitation) {
    const parts = splitDateParts(invitation.fecha || "");
    const values = {
      titulo: invitation.titulo,
      tipo: invitation.tipo,
      anfitrion: invitation.anfitrion,
      nombre: invitation.nombre || invitation.anfitrion,
      edad: invitation.edad,
      fecha: invitation.fecha,
      dia: parts.dia,
      mes: parts.mes,
      anio: parts.anio,
      hora: invitation.hora,
      lugar: invitation.lugar,
      direccion: invitation.direccion,
      googleMapsUrl: invitation.googleMapsUrl,
      telefono: invitation.telefono,
      descripcion: invitation.descripcion
    };

    return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => values[key] ?? "");
  }

  function buildSidebar() {
    const id = getCurrentInvitationId();
    const adminHref = id ? buildUrl("administrador.html", { id }) : "administrador.html";
    const editorHref = id ? buildUrl("editor.html", { id }) : "";

    return `
      <button class="mobile-menu-button" id="mobileSidebarButton" type="button" aria-label="Abrir menú">☰</button>
      <div class="sidebar-overlay" id="sidebarOverlay"></div>
      <aside class="app-sidebar" id="appSidebar" aria-label="Navegación principal">
        <div class="sidebar-brand">
          <span class="sidebar-logo">IW</span>
          <div class="sidebar-brand-text">
            <strong>Invitaciones Web</strong>
            <small>Panel de gestión</small>
          </div>
        </div>
        <nav class="sidebar-nav">
          <a href="index.html" title="Inicio"><span>⌂</span><strong>Inicio</strong></a>
          <a href="crear.html" title="Crear invitación"><span>＋</span><strong>Crear invitación</strong></a>
          <a href="${adminHref}" title="Admin"><span>◎</span><strong>Admin</strong></a>
          ${editorHref ? `<a href="${editorHref}" title="Editar invitación"><span>◉</span><strong>Editar invitación</strong></a>` : ""}
        </nav>
        <button class="sidebar-collapse" id="sidebarCollapseButton" type="button" title="Colapsar o expandir"><span>⇤</span><strong>Colapsar</strong></button>
      </aside>
    `;
  }

  function initSidebar() {
    document.body.insertAdjacentHTML("afterbegin", buildSidebar());
    const sidebar = document.getElementById("appSidebar");
    const collapseButton = document.getElementById("sidebarCollapseButton");
    const mobileButton = document.getElementById("mobileSidebarButton");
    const overlay = document.getElementById("sidebarOverlay");
    const collapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";

    document.body.classList.add("has-sidebar");
    if (collapsed) document.body.classList.add("sidebar-collapsed");

    collapseButton.addEventListener("click", () => {
      document.body.classList.toggle("sidebar-collapsed");
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, document.body.classList.contains("sidebar-collapsed"));
    });

    const closeMobile = () => document.body.classList.remove("sidebar-mobile-open");
    mobileButton.addEventListener("click", () => document.body.classList.add("sidebar-mobile-open"));
    overlay.addEventListener("click", closeMobile);
    sidebar.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMobile));
  }

  const escapeHtml = (value) => {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
  };

  const escapeScript = (value) => String(value ?? "").replace(/<\/script/gi, "<\\/script");

  const formatDate = (dateValue) => {
    if (!dateValue) return "Sin fecha";
    const date = new Date(`${dateValue}T00:00:00`);
    return new Intl.DateTimeFormat("es-PY", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(date);
  };

  const imagePath = (image, isNestedPage) => {
    if (!image) return "";
    if (/^(https?:)?\/\//.test(image) || image.startsWith("data:")) return image;
    return isNestedPage ? `../${image}` : image;
  };

  function getCustomInvitations() {
    return getStoredJson(CUSTOM_INVITATIONS_KEY, []);
  }

  function getDeletedInvitationIds() {
    return getStoredJson(DELETED_INVITATIONS_KEY, []);
  }

  function normalizeInvitation(invitation) {
    const slug = generateSlug(invitation.slug || invitation.id || invitation.titulo || invitation.nombre || `invitacion-${Date.now()}`);
    return {
      ...invitation,
      id: slug,
      slug,
      descripcion: invitation.descripcion || "Invitación personalizada.",
      imagen: invitation.imagen || "assets/img/celebracion.svg",
      sheetEndpoint: invitation.sheetEndpoint || "",
      nombre: invitation.nombre || invitation.anfitrion || "",
      edad: invitation.edad || "",
      telefono: invitation.telefono || "",
      design: { ...DEFAULT_DESIGN, ...(invitation.design || {}) },
      customHtml: invitation.customHtml || "",
      customCss: invitation.customCss || "",
      customJs: invitation.customJs || "",
      isCustom: true
    };
  }

  function getAllInvitations() {
    const deletedIds = new Set(getDeletedInvitationIds());
    const customInvitations = getCustomInvitations().filter((invitation) => !deletedIds.has(invitation.id));
    const customById = new Map(customInvitations.map((invitation) => [invitation.id, normalizeInvitation(invitation)]));
    const baseInvitations = invitaciones
      .filter((invitation) => !deletedIds.has(invitation.id))
      .map((invitation) => customById.get(invitation.id) || normalizeInvitation(invitation));
    const newCustomInvitations = customInvitations
      .filter((invitation) => !invitaciones.some((base) => base.id === invitation.id))
      .map(normalizeInvitation);

    return [...baseInvitations, ...newCustomInvitations];
  }

  function getInvitationById(id) {
    return getAllInvitations().find((invitation) => invitation.id === id || invitation.slug === id);
  }

  function isSlugAvailable(slug, currentId = null) {
    const normalizedSlug = generateSlug(slug);
    if (!validateSlug(normalizedSlug)) return false;
    return !getAllInvitations().some((invitation) => {
      const invitationSlug = invitation.slug || invitation.id;
      return invitationSlug === normalizedSlug && invitation.id !== currentId && invitationSlug !== currentId;
    });
  }

  function saveCustomInvitation(invitation) {
    const deletedIds = getDeletedInvitationIds().filter((id) => id !== invitation.id);
    const customInvitations = getCustomInvitations();
    const normalizedInvitation = normalizeInvitation(invitation);
    const index = customInvitations.findIndex((item) => item.id === normalizedInvitation.id);

    if (index >= 0) {
      customInvitations[index] = normalizedInvitation;
    } else {
      customInvitations.push(normalizedInvitation);
    }

    setStoredJson(CUSTOM_INVITATIONS_KEY, customInvitations);
    setStoredJson(DELETED_INVITATIONS_KEY, deletedIds);
    return normalizedInvitation;
  }

  function removeCustomInvitationById(id) {
    setStoredJson(CUSTOM_INVITATIONS_KEY, getCustomInvitations().filter((item) => item.id !== id && item.slug !== id));
  }

  function migrateInvitationStorage(oldId, newId) {
    if (!oldId || !newId || oldId === newId) return;
    const oldRsvps = getStoredJson(storageKey(oldId), []);
    const newRsvps = getStoredJson(storageKey(newId), []);
    if (oldRsvps.length && !newRsvps.length) setStoredJson(storageKey(newId), oldRsvps);
    localStorage.removeItem(storageKey(oldId));
    localStorage.removeItem(legacyStorageKey(oldId));
  }

  function getRsvps(invitationId) {
    const rsvps = getStoredJson(storageKey(invitationId), []);
    if (rsvps.length) return rsvps;
    return getStoredJson(legacyStorageKey(invitationId), []);
  }

  function saveRsvp(invitationId, data) {
    const confirmations = getRsvps(invitationId);
    confirmations.push(data);
    setStoredJson(storageKey(invitationId), confirmations);
  }

  window.getAllInvitations = getAllInvitations;
  window.getInvitationById = getInvitationById;
  window.saveCustomInvitation = saveCustomInvitation;
  window.getRsvps = getRsvps;
  window.saveRsvp = saveRsvp;
  window.getCurrentInvitationId = getCurrentInvitationId;
  window.buildUrl = buildUrl;
  window.generateSlug = generateSlug;
  window.validateSlug = validateSlug;
  window.isSlugAvailable = isSlugAvailable;
  window.getPublicInvitationUrl = getPublicInvitationUrl;
  window.copyPublicUrl = copyPublicUrl;
  window.buildSidebar = buildSidebar;
  window.initSidebar = initSidebar;
  window.replaceInvitationVariables = replaceInvitationVariables;

  const getInvitationImage = (invitation) => {
    const design = { ...DEFAULT_DESIGN, ...(invitation.design || {}) };
    return design.uploadedImage || design.imageUrl || design.mainImage || invitation.imagen || "assets/img/celebracion.svg";
  };

  function buildInvitationTemplate(invitation) {
    const design = { ...DEFAULT_DESIGN, ...(invitation.design || {}) };
    const image = getInvitationImage(invitation);
    const background = design.backgroundImage || image;
    const animationClass = design.animation && design.animation !== "none" ? ` animation-${design.animation}` : "";

    return `
      <section class="generated-invitation typography-${escapeHtml(design.typography)}${animationClass}" style="--inv-primary:${escapeHtml(design.primaryColor)}; --inv-secondary:${escapeHtml(design.secondaryColor)}; --inv-text:${escapeHtml(design.textColor)}; --inv-button:${escapeHtml(design.buttonColor)}; --inv-bg:url('${escapeHtml(imagePath(background, false))}');">
        <div class="generated-backdrop"></div>
        <div class="generated-content">
          <p class="generated-kicker">${escapeHtml(invitation.tipo)}</p>
          <h1>${escapeHtml(invitation.titulo)}</h1>
          <p class="generated-host">${escapeHtml(invitation.anfitrion)}</p>
          <img src="${escapeHtml(imagePath(image, false))}" alt="${escapeHtml(invitation.titulo)}" class="generated-main-image">
          <div class="generated-details">
            <span>${formatDate(invitation.fecha)}</span>
            <span>${escapeHtml(invitation.hora)}</span>
            <span>${escapeHtml(invitation.lugar)}</span>
          </div>
          <p class="generated-address">${escapeHtml(invitation.direccion)}</p>
        </div>
      </section>
    `;
  }

  function baseDocumentStyles() {
    return `
      html, body { width: 100%; max-width: 100%; margin: 0; min-height: 100%; overflow-x: hidden; }
      body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fffdf9; }
      *, *::before, *::after { box-sizing: border-box; max-width: 100%; }
      img, video, iframe { max-width: 100%; }
      img { display: block; }
      #custom-invitation-root { width: 100%; max-width: 100%; min-height: 100vh; overflow-x: hidden; }
      #custom-invitation-root > * { max-width: 100%; }
      .generated-invitation { position: relative; width: 100%; min-height: 100vh; display: grid; place-items: center; overflow: hidden; padding: clamp(36px, 7vw, 92px) clamp(12px, 4vw, 22px); color: var(--inv-text); background: linear-gradient(rgba(255, 253, 249, 0.76), rgba(255, 253, 249, 0.86)), var(--inv-bg) center/cover no-repeat, #fffdf9; }
      .generated-backdrop { position: absolute; inset: 0; background: radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--inv-secondary) 26%, transparent), transparent 28%), radial-gradient(circle at 82% 18%, color-mix(in srgb, var(--inv-primary) 22%, transparent), transparent 30%); pointer-events: none; }
      .generated-content { position: relative; z-index: 1; width: min(860px, 100%); display: grid; justify-items: center; gap: 18px; text-align: center; }
      .generated-kicker { margin: 0; color: var(--inv-secondary); font-weight: 900; text-transform: uppercase; letter-spacing: 0.16em; }
      .generated-content h1 { margin: 0; color: var(--inv-text); font-size: clamp(3rem, 10vw, 8rem); line-height: 0.94; letter-spacing: 0; }
      .generated-host, .generated-address { margin: 0; color: var(--inv-text); font-size: clamp(1rem, 2vw, 1.35rem); }
      .generated-main-image { width: min(520px, 86%); aspect-ratio: 4 / 3; object-fit: cover; border: 10px solid rgba(255,255,255,.78); border-radius: 8px; box-shadow: 0 26px 70px rgba(38,48,47,.2); }
      .generated-details { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
      .generated-details span { border-radius: 999px; padding: 10px 14px; background: var(--inv-button); color: #fff; font-weight: 900; }
      .typography-classic { font-family: Georgia, "Times New Roman", serif; }
      .typography-modern { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      .typography-handwritten { font-family: "Segoe Script", "Brush Script MT", cursive; }
      .typography-luxury { font-family: Didot, "Bodoni 72", Georgia, serif; }
      .typography-minimal { font-family: Arial, Helvetica, sans-serif; }
      .animation-shine::after { content: ""; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.45), transparent 70%); transform: translateX(-120%); animation: shineMove 3.8s ease-in-out infinite; }
      .animation-flowers::before, .animation-confetti::before, .animation-sparkles::before { content: "* . * . *"; position: absolute; inset: auto 0 12%; color: var(--inv-secondary); font-size: clamp(2rem, 5vw, 4rem); opacity: .45; text-align: center; animation: floatSoft 5s ease-in-out infinite; }
      .animation-flowers::before { content: "* + * + *"; }
      .animation-confetti::before { content: "# o ^ # o ^"; }
      @keyframes shineMove { 0%,45% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }
      @keyframes floatSoft { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-18px); } }
      @media (max-width: 640px) {
        .generated-invitation { padding: 28px 12px; }
        .generated-content h1 { font-size: clamp(2.2rem, 16vw, 4.5rem); }
        .generated-details span { width: 100%; border-radius: 8px; }
      }
    `;
  }

  function buildCustomInvitationDocument(invitation) {
    const html = replaceInvitationVariables(invitation.customHtml || buildInvitationTemplate(invitation), invitation);
    const css = replaceInvitationVariables(invitation.customCss || "", invitation);
    const js = replaceInvitationVariables(invitation.customJs || "", invitation);

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseDocumentStyles()}</style>
  <style>${css}</style>
</head>
<body>
  <section id="custom-invitation-root">${html}</section>
  <script>
    window.addEventListener("error", function (event) {
      console.error("Error en JS personalizado:", event.error || event.message);
    });
    try {
      ${escapeScript(js)}
    } catch (error) {
      console.error("Error en JS personalizado:", error);
    }
  <\/script>
</body>
</html>`;
  }

  window.buildCustomInvitationDocument = buildCustomInvitationDocument;

  function renderHome() {
    const list = document.getElementById("invitationList");
    const count = document.getElementById("invitationCount");
    const allInvitations = getAllInvitations();

    count.textContent = `${allInvitations.length} eventos`;
    list.innerHTML = allInvitations.map((invitation) => `
      <article class="invitation-card">
        <img src="${imagePath(getInvitationImage(invitation), false)}" alt="${escapeHtml(invitation.tipo)}">
        <div class="card-body">
          <span class="badge">${escapeHtml(invitation.tipo)}</span>
          <h3>${escapeHtml(invitation.titulo)}</h3>
          <p>${formatDate(invitation.fecha)}</p>
          <a class="button primary" href="${buildUrl("editor.html", { id: invitation.id })}">Editar invitación</a>
          <a class="button secondary" href="${buildUrl("invitacion.html", { id: invitation.id })}" target="_blank" rel="noopener">Ver como invitado</a>
        </div>
      </article>
    `).join("");
  }

  function renderInvitation() {
    const id = getInvitationId();
    const invitation = getInvitationById(id);
    const detail = document.getElementById("invitationDetail");
    const form = document.getElementById("rsvpForm");
    const successMessage = document.getElementById("successMessage");
    const floatingRsvpButton = document.getElementById("floatingRsvpButton");

    if (!invitation) {
      detail.innerHTML = `
        <div class="empty-state">
          <h1>Invitación no encontrada</h1>
          <p>Revisa el enlace o vuelve al listado principal.</p>
        </div>
      `;
      document.getElementById("rsvp-section").classList.add("hidden");
      floatingRsvpButton.classList.add("hidden");
      return;
    }

    document.title = invitation.titulo;
    detail.classList.add("custom-event-panel");
    detail.innerHTML = `<iframe class="custom-invitation-iframe" title="${escapeHtml(invitation.titulo)}"></iframe>`;
    detail.querySelector("iframe").srcdoc = buildCustomInvitationDocument(invitation);

    floatingRsvpButton.addEventListener("click", () => {
      document.querySelector("#rsvp-section").scrollIntoView({ behavior: "smooth" });
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      saveRsvp(invitation.id, {
        nombre: fieldValue(formData, "nombre"),
        telefono: fieldValue(formData, "telefono"),
        asiste: formData.get("asiste"),
        acompanantes: Number(formData.get("acompanantes")) || 0,
        mensaje: fieldValue(formData, "mensaje"),
        createdAt: new Date().toISOString()
      });
      form.reset();
      form.querySelector('input[name="asiste"][value="Si"]').checked = true;
      form.elements.acompanantes.value = 0;
      successMessage.textContent = "Confirmación guardada correctamente.";
    });
  }

  function renderAdminTable(id) {
    const confirmations = getRsvps(id);
    const table = document.getElementById("confirmationsTable");
    const totalAttending = confirmations.filter((item) => item.asiste === "Si" || item.asiste === "Sí").length;
    const totalGuests = confirmations.reduce((sum, item) => sum + (Number(item.acompanantes) || 0), 0);

    document.getElementById("totalResponses").textContent = confirmations.length;
    document.getElementById("totalAttending").textContent = totalAttending;
    document.getElementById("totalGuests").textContent = totalGuests;

    table.innerHTML = confirmations.length ? confirmations.map((item) => `
      <tr>
        <td>${escapeHtml(item.nombre)}</td>
        <td>${escapeHtml(item.telefono)}</td>
        <td>${escapeHtml(item.asiste)}</td>
        <td>${escapeHtml(item.acompanantes)}</td>
        <td>${escapeHtml(item.mensaje)}</td>
        <td>${new Date(item.createdAt).toLocaleString("es-PY")}</td>
      </tr>
    `).join("") : `<tr><td colspan="6" class="empty-row">Todavía no hay confirmaciones.</td></tr>`;
  }

  function renderAdmin() {
    const id = getInvitationId();
    const invitation = getInvitationById(id);
    const adminGate = document.getElementById("adminGate");

    if (!invitation) {
      adminGate.innerHTML = `
        <div class="empty-state">
          <h1>Invitación no encontrada</h1>
          <p>Abre el panel desde una invitación existente.</p>
          <a class="button primary" href="index.html">Volver al inicio</a>
        </div>
      `;
      return;
    }

    document.title = `Admin | ${invitation.titulo}`;
    document.getElementById("adminEventTitle").textContent = invitation.titulo;
    document.getElementById("editInvitationLink").href = buildUrl("editor.html", { id: invitation.id });
    const publicLink = getPublicInvitationUrl(invitation.slug || invitation.id);
    const copyPublicLinkButton = document.getElementById("copyPublicLinkButton");
    document.getElementById("adminPublicUrl").textContent = publicLink;

    document.getElementById("adminLoginForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const password = new FormData(event.currentTarget).get("password");
      if (password !== invitation.adminPassword) {
        document.getElementById("loginMessage").textContent = "Contraseña incorrecta.";
        return;
      }
      document.getElementById("loginMessage").textContent = "";
      adminGate.classList.add("hidden");
      document.getElementById("adminContent").classList.remove("hidden");
      renderAdminTable(invitation.id);
    });

    document.getElementById("clearConfirmations").addEventListener("click", () => {
      if (!window.confirm("¿Borrar las confirmaciones guardadas para esta invitación?")) return;
      localStorage.removeItem(storageKey(invitation.id));
      localStorage.removeItem(legacyStorageKey(invitation.id));
      renderAdminTable(invitation.id);
    });

    copyPublicLinkButton.addEventListener("click", async () => {
      try {
        await copyPublicUrl(invitation.slug || invitation.id);
        copyPublicLinkButton.textContent = "Link copiado";
      } catch (error) {
        copyPublicLinkButton.textContent = publicLink;
      }
      setTimeout(() => {
        copyPublicLinkButton.textContent = "Copiar enlace publico";
      }, 1600);
    });
  }

  function getSimpleEditorFormData(form, existing = {}) {
    const formData = new FormData(form);
    const id = getSlugFromFormData(formData, existing.id || "");
    return normalizeInvitation({
      ...existing,
      id,
      slug: id,
      titulo: fieldValue(formData, "titulo"),
      tipo: fieldValue(formData, "tipo"),
      anfitrion: fieldValue(formData, "anfitrion"),
      nombre: fieldValue(formData, "nombre"),
      edad: fieldValue(formData, "edad"),
      fecha: fieldValue(formData, "fecha"),
      hora: fieldValue(formData, "hora"),
      lugar: fieldValue(formData, "lugar"),
      direccion: fieldValue(formData, "direccion"),
      telefono: fieldValue(formData, "telefono"),
      googleMapsUrl: fieldValue(formData, "googleMapsUrl"),
      descripcion: fieldValue(formData, "descripcion"),
      adminPassword: fieldValue(formData, "adminPassword"),
      customHtml: fieldValue(formData, "customHtml"),
      customCss: fieldValue(formData, "customCss"),
      customJs: fieldValue(formData, "customJs")
    });
  }

  function setupCreatePreview(form) {
    const preview = document.getElementById("customPreview");
    if (!preview) return;
    const renderPreview = () => {
      preview.srcdoc = buildCustomInvitationDocument(getSimpleEditorFormData(form));
    };
    document.getElementById("previewButton").addEventListener("click", renderPreview);
    form.addEventListener("input", renderPreview);
    renderPreview();
  }

  function setupCreatePublicUrl(form) {
    const output = document.getElementById("createPublicUrl");
    const copyButton = document.getElementById("copyCreatePublicLinkButton");
    if (!output || !copyButton) return;

    const updateUrl = () => {
      const formData = new FormData(form);
      const slug = getSlugFromFormData(formData);
      output.textContent = slug ? getPublicInvitationUrl(slug) : "invitacion.html?id=";
      return slug;
    };

    form.addEventListener("input", (event) => {
      if (event.target.name === "slug") sanitizeSlugInput(event.target);
      updateUrl();
    });
    copyButton.addEventListener("click", async () => {
      const slug = updateUrl();
      if (!slug) return;
      try {
        await copyPublicUrl(slug);
        copyButton.textContent = "Enlace copiado";
      } catch (error) {
        copyButton.textContent = getPublicInvitationUrl(slug);
      }
      setTimeout(() => {
        copyButton.textContent = "Copiar enlace publico";
      }, 1600);
    });
    updateUrl();
  }

  function renderCreate() {
    const form = document.getElementById("invitationEditorForm");
    const message = document.getElementById("editorMessage");
    setupCreatePreview(form);
    setupCreatePublicUrl(form);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const invitation = getSimpleEditorFormData(form);
      if (!invitation.slug || !validateSlug(invitation.slug)) {
        message.className = "error-message";
        message.textContent = "La URL personalizada solo puede usar letras minusculas, numeros y guiones.";
        return;
      }
      if (!isSlugAvailable(invitation.slug)) {
        message.className = "error-message";
        message.textContent = "Ya existe una invitacion con esa URL personalizada.";
        return;
      }
      saveCustomInvitation(invitation);
      message.className = "success-message";
      message.innerHTML = `Invitacion guardada. <a href="${getPublicInvitationUrl(invitation.slug)}">Ver invitacion</a>`;
    });
  }

  function getProfessionalFormData() {
    const form = document.getElementById("professionalEditorForm");
    const formData = new FormData(form);
    const slug = getSlugFromFormData(formData, activeEditorInvitation.id);
    const design = {
      primaryColor: fieldValue(formData, "primaryColor", DEFAULT_DESIGN.primaryColor),
      secondaryColor: fieldValue(formData, "secondaryColor", DEFAULT_DESIGN.secondaryColor),
      textColor: fieldValue(formData, "textColor", DEFAULT_DESIGN.textColor),
      buttonColor: fieldValue(formData, "buttonColor", DEFAULT_DESIGN.buttonColor),
      mainImage: fieldValue(formData, "mainImage"),
      backgroundImage: fieldValue(formData, "backgroundImage"),
      uploadedImage: fieldValue(formData, "uploadedImage"),
      imageUrl: fieldValue(formData, "imageUrl"),
      animation: fieldValue(formData, "animation", "none"),
      typography: fieldValue(formData, "typography", "classic")
    };
    const invitation = normalizeInvitation({
      ...activeEditorInvitation,
      id: slug,
      slug,
      titulo: fieldValue(formData, "titulo"),
      tipo: fieldValue(formData, "tipo"),
      anfitrion: fieldValue(formData, "anfitrion"),
      nombre: fieldValue(formData, "nombre"),
      edad: fieldValue(formData, "edad"),
      fecha: fieldValue(formData, "fecha"),
      hora: fieldValue(formData, "hora"),
      lugar: fieldValue(formData, "lugar"),
      direccion: fieldValue(formData, "direccion"),
      telefono: fieldValue(formData, "telefono"),
      googleMapsUrl: fieldValue(formData, "googleMapsUrl"),
      descripcion: fieldValue(formData, "descripcion"),
      adminPassword: fieldValue(formData, "adminPassword"),
      customHtml: fieldValue(formData, "customHtml"),
      customCss: fieldValue(formData, "customCss"),
      customJs: fieldValue(formData, "customJs"),
      design
    });
    invitation.imagen = getInvitationImage(invitation);
    return invitation;
  }

  function fillProfessionalEditor(invitation) {
    const form = document.getElementById("professionalEditorForm");
    const design = { ...DEFAULT_DESIGN, ...(invitation.design || {}) };
    form.elements.id.value = invitation.id;
    form.elements.slug.value = invitation.slug || invitation.id;
    form.elements.titulo.value = invitation.titulo || "";
    form.elements.nombre.value = invitation.nombre || "";
    form.elements.edad.value = invitation.edad || "";
    form.elements.anfitrion.value = invitation.anfitrion || "";
    form.elements.tipo.value = invitation.tipo || "";
    form.elements.fecha.value = invitation.fecha || "";
    form.elements.hora.value = invitation.hora || "";
    form.elements.lugar.value = invitation.lugar || "";
    form.elements.direccion.value = invitation.direccion || "";
    form.elements.telefono.value = invitation.telefono || "";
    form.elements.googleMapsUrl.value = invitation.googleMapsUrl || "";
    form.elements.adminPassword.value = invitation.adminPassword || "";
    form.elements.descripcion.value = invitation.descripcion || "";
    form.elements.customHtml.value = invitation.customHtml || "";
    form.elements.customCss.value = invitation.customCss || "";
    form.elements.customJs.value = invitation.customJs || "";
    form.elements.primaryColor.value = design.primaryColor;
    form.elements.secondaryColor.value = design.secondaryColor;
    form.elements.textColor.value = design.textColor;
    form.elements.buttonColor.value = design.buttonColor;
    form.elements.mainImage.value = design.mainImage;
    form.elements.backgroundImage.value = design.backgroundImage;
    form.elements.uploadedImage.value = design.uploadedImage;
    form.elements.imageUrl.value = design.imageUrl;
    form.elements.animation.value = design.animation;
    form.elements.typography.value = design.typography;
    updateEditorPublicUrl();
  }

  function updateEditorPublicUrl() {
    if (page !== "editor") return;
    const output = document.getElementById("editorPublicUrl");
    const form = document.getElementById("professionalEditorForm");
    if (!output || !form) return;
    const slug = getSlugFromFormData(new FormData(form), activeEditorInvitation?.id || "");
    output.textContent = slug ? getPublicInvitationUrl(slug) : "invitacion.html?id=";
  }

  function updatePreview() {
    if (page !== "editor") return;
    const invitation = getProfessionalFormData();
    updateEditorPublicUrl();
    document.getElementById("previewTitle").textContent = invitation.titulo || "Invitación";
    document.getElementById("livePreviewFrame").srcdoc = buildCustomInvitationDocument(invitation);
  }

  function saveInvitation(event) {
    if (event) event.preventDefault();
    const message = document.getElementById("editorMessage");
    const previousId = activeEditorInvitation.id;
    const invitation = getProfessionalFormData();
    if (!validateSlug(invitation.slug)) {
      message.className = "error-message";
      message.textContent = "La URL personalizada solo puede usar letras minusculas, numeros y guiones.";
      return;
    }
    if (!isSlugAvailable(invitation.slug, previousId)) {
      message.className = "error-message";
      message.textContent = "Ya existe una invitacion con esa URL personalizada.";
      return;
    }
    if (previousId !== invitation.id) {
      removeCustomInvitationById(previousId);
      if (invitaciones.some((base) => base.id === previousId || base.slug === previousId)) {
        setStoredJson(DELETED_INVITATIONS_KEY, Array.from(new Set([...getDeletedInvitationIds(), previousId])));
      }
      migrateInvitationStorage(previousId, invitation.id);
    }
    activeEditorInvitation = saveCustomInvitation(invitation);
    document.getElementById("professionalEditorForm").elements.id.value = activeEditorInvitation.id;
    document.getElementById("professionalEditorForm").elements.slug.value = activeEditorInvitation.slug;
    message.className = "success-message";
    message.textContent = "Cambios guardados correctamente.";
    window.history.replaceState(null, "", buildUrl("editor.html", { id: activeEditorInvitation.id }));
    updatePreview();
  }

  function duplicateInvitation() {
    const invitation = getProfessionalFormData();
    const copyId = normalizeId(`${invitation.id}-copia-${Date.now().toString().slice(-5)}`);
    const copy = {
      ...invitation,
      id: copyId,
      slug: copyId,
      titulo: `${invitation.titulo} (Copia)`
    };
    saveCustomInvitation(copy);
    window.location.href = buildUrl("editor.html", { id: copy.id });
  }

  function deleteInvitation() {
    const invitation = getProfessionalFormData();
    if (!window.confirm("¿Está seguro?")) return;
    setStoredJson(CUSTOM_INVITATIONS_KEY, getCustomInvitations().filter((item) => item.id !== invitation.id));
    setStoredJson(DELETED_INVITATIONS_KEY, Array.from(new Set([...getDeletedInvitationIds(), invitation.id])));
    localStorage.removeItem(storageKey(invitation.id));
    localStorage.removeItem(legacyStorageKey(invitation.id));
    window.location.href = "index.html";
  }

  function viewAsGuest() {
    const invitation = getProfessionalFormData();
    window.open(getPublicInvitationUrl(invitation.slug || invitation.id), "_blank", "noopener");
  }

  function exportInvitation() {
    const blob = new Blob([JSON.stringify(getProfessionalFormData(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "invitacion.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function importInvitation(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const importedInvitation = JSON.parse(reader.result);
        activeEditorInvitation = normalizeInvitation({
          ...activeEditorInvitation,
          ...importedInvitation,
          id: importedInvitation.id || normalizeId(importedInvitation.titulo || `invitacion-${Date.now()}`)
        });
        fillProfessionalEditor(activeEditorInvitation);
        updatePreview();
        document.getElementById("editorMessage").textContent = "JSON importado. Revisa la vista previa y guarda los cambios.";
      } catch (error) {
        const message = document.getElementById("editorMessage");
        message.className = "error-message";
        message.textContent = "No se pudo importar el archivo JSON.";
      }
    };
    reader.readAsText(file);
  }

  window.updatePreview = updatePreview;
  window.saveInvitation = saveInvitation;
  window.duplicateInvitation = duplicateInvitation;
  window.deleteInvitation = deleteInvitation;
  window.exportInvitation = exportInvitation;
  window.importInvitation = importInvitation;
  window.viewAsGuest = viewAsGuest;

  function renderEditor() {
    const invitation = getInvitationById(getInvitationId());
    const form = document.getElementById("professionalEditorForm");

    if (!invitation) {
      document.querySelector(".builder-panel").innerHTML = `
        <div class="empty-state">
          <h1>Invitación no encontrada</h1>
          <p>Revisa el enlace o vuelve al listado principal.</p>
          <a class="button primary" href="index.html">Volver al inicio</a>
        </div>
      `;
      document.querySelector(".live-preview-panel").classList.add("hidden");
      return;
    }

    activeEditorInvitation = normalizeInvitation(invitation);
    originalEditorInvitation = normalizeInvitation(invitation);
    document.title = `Editar | ${invitation.titulo}`;
    fillProfessionalEditor(activeEditorInvitation);
    updatePreview();

    document.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".tab-button").forEach((item) => item.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
        button.classList.add("active");
        document.querySelector(`[data-panel="${button.dataset.tab}"]`).classList.add("active");
      });
    });

    document.querySelectorAll(".code-tab-button").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".code-tab-button").forEach((item) => item.classList.remove("active"));
        document.querySelectorAll(".code-panel").forEach((panel) => panel.classList.remove("active"));
        button.classList.add("active");
        document.querySelector(`[data-code-panel="${button.dataset.codeTab}"]`).classList.add("active");
      });
    });

    document.querySelectorAll("[data-copy-code]").forEach((button) => {
      button.addEventListener("click", async () => {
        const field = form.elements[button.dataset.copyCode];
        await navigator.clipboard.writeText(field.value);
        button.textContent = "Copiado";
        setTimeout(() => { button.textContent = "Copiar código"; }, 1200);
      });
    });

    form.elements.slug.addEventListener("input", (event) => {
      sanitizeSlugInput(event.target);
      updateEditorPublicUrl();
    });
    form.addEventListener("input", updatePreview);
    form.addEventListener("change", updatePreview);
    form.addEventListener("submit", saveInvitation);
    document.getElementById("restoreTemplateButton").addEventListener("click", () => {
      form.elements.customHtml.value = originalEditorInvitation.customHtml || buildInvitationTemplate(getProfessionalFormData());
      form.elements.customCss.value = originalEditorInvitation.customCss || "";
      form.elements.customJs.value = originalEditorInvitation.customJs || "";
      updatePreview();
    });
    document.getElementById("viewAsGuestButton").addEventListener("click", viewAsGuest);
    document.getElementById("copyEditorPublicLinkButton").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const invitation = getProfessionalFormData();
      try {
        await copyPublicUrl(invitation.slug || invitation.id);
        button.textContent = "Enlace copiado";
      } catch (error) {
        button.textContent = getPublicInvitationUrl(invitation.slug || invitation.id);
      }
      setTimeout(() => {
        button.textContent = "Copiar enlace publico";
      }, 1600);
    });
    document.getElementById("duplicateInvitationButton").addEventListener("click", duplicateInvitation);
    document.getElementById("deleteInvitationButton").addEventListener("click", deleteInvitation);
    document.getElementById("exportInvitationButton").addEventListener("click", exportInvitation);
    document.getElementById("importInvitationInput").addEventListener("change", (event) => importInvitation(event.target.files[0]));
    document.getElementById("localImageInput").addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        form.elements.uploadedImage.value = reader.result;
        updatePreview();
      };
      reader.readAsDataURL(file);
    });

    document.querySelectorAll("[data-zoom]").forEach((button) => {
      button.addEventListener("click", () => {
        const device = document.getElementById("previewDevice");
        document.querySelectorAll("[data-zoom]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        device.classList.remove("preview-zoom-50", "preview-zoom-75", "preview-zoom-100");
        device.classList.add(`preview-zoom-${button.dataset.zoom}`);
      });
    });

    document.getElementById("mobilePreviewButton").addEventListener("click", () => {
      const device = document.getElementById("previewDevice");
      device.classList.add("mobile-preview");
      device.classList.remove("desktop-preview");
      document.getElementById("mobilePreviewButton").classList.add("active");
      document.getElementById("desktopPreviewButton").classList.remove("active");
    });
    document.getElementById("desktopPreviewButton").addEventListener("click", () => {
      const device = document.getElementById("previewDevice");
      device.classList.add("desktop-preview");
      device.classList.remove("mobile-preview");
      document.getElementById("desktopPreviewButton").classList.add("active");
      document.getElementById("mobilePreviewButton").classList.remove("active");
    });
  }

  if (page !== "invitation") initSidebar();

  if (page === "home") renderHome();
  if (page === "invitation") renderInvitation();
  if (page === "admin") renderAdmin();
  if (page === "create") renderCreate();
  if (page === "editor") renderEditor();
})();


