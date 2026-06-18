(function () {
  const page = document.body.dataset.page;
  const CUSTOM_INVITATIONS_KEY = "custom_invitations";
  const DELETED_INVITATIONS_KEY = "deleted_invitations";
  const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";
  const DEFAULT_GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw8mAYwwCzTA1q_uGnhtX0Jsu0AYNw8i93DO-jppIhAzqNEeo42RXFS_kVqurJSH0tx/exec";
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

  function getInvitationPublicSlug(invitationOrSlug) {
    if (typeof invitationOrSlug === "string") return generateSlug(invitationOrSlug);
    const invitation = invitationOrSlug || {};
    return generateSlug(invitation.slug || invitation.id || invitation.url || "");
  }

  function getPublicInvitationUrl(invitationOrSlug) {
    const slug = getInvitationPublicSlug(invitationOrSlug);
    const path = window.location.pathname.replace(/[^/]*$/, "invitacion.html");
    return `${window.location.origin}${path}?id=${encodeURIComponent(slug)}`;
  }

  async function copyPublicUrl(invitationOrSlug) {
    const url = getPublicInvitationUrl(invitationOrSlug);
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

  const MAX_LOCAL_STORAGE_IMAGE_BYTES = Number.POSITIVE_INFINITY;
  let storageWarningTimer = null;

  function showStorageWarning(message = "El almacenamiento del navegador esta lleno. Se guardaron solo datos livianos e imagenes por URL.") {
    let warning = document.getElementById("storageWarning");
    if (!warning) {
      warning = document.createElement("div");
      warning.id = "storageWarning";
      warning.className = "storage-warning";
      warning.setAttribute("role", "status");
      document.body.appendChild(warning);
    }
    warning.textContent = message;
    warning.classList.add("visible");
    clearTimeout(storageWarningTimer);
    storageWarningTimer = setTimeout(() => warning.classList.remove("visible"), 5200);
  }

  function safeSetItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (err) {
      console.warn("Storage lleno", key, err);
      showStorageWarning();
      return false;
    }
  }

  function getStorageBytes(value) {
    return new Blob([String(value || "")]).size;
  }

  function isDataImage(value) {
    return typeof value === "string" && value.startsWith("data:image/");
  }

  function isLargeDataImage(value) {
    return isDataImage(value) && getStorageBytes(value) > MAX_LOCAL_STORAGE_IMAGE_BYTES;
  }

  function keepStorageSafeImage(value) {
    return value || "";
  }

  const setStoredJson = (key, value) => {
    return safeSetItem(key, JSON.stringify(value));
  };

  const trySetStorageValue = (key, value) => {
    return safeSetItem(key, value);
  };
  function compressImageDataUrl(dataUrl, callback, options = {}) {
    if (!dataUrl || !String(dataUrl).startsWith("data:image/") || String(dataUrl).startsWith("data:image/svg")) {
      callback(dataUrl);
      return;
    }

    const image = new Image();
    image.onload = () => {
      const maxWidth = options.maxWidth || 1440;
      const maxHeight = options.maxHeight || 2560;
      const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      let hasTransparency = false;
      try {
        const pixels = context.getImageData(0, 0, width, height).data;
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index] < 255) {
            hasTransparency = true;
            break;
          }
        }
      } catch (error) {
        hasTransparency = String(dataUrl).startsWith("data:image/png") || String(dataUrl).startsWith("data:image/webp");
      }

      if (hasTransparency) {
        const transparentPng = canvas.toDataURL("image/png");
        callback(transparentPng.length < dataUrl.length || scale < 1 ? transparentPng : dataUrl);
        return;
      }

      context.globalCompositeOperation = "destination-over";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = "source-over";
      const compressed = canvas.toDataURL(options.mimeType || "image/jpeg", options.quality || 0.84);
      callback(compressed.length < dataUrl.length ? compressed : dataUrl);
    };
    image.onerror = () => callback(dataUrl);
    image.src = dataUrl;
  }

  const fieldValue = (formData, name, fallback = "") => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : fallback;
  };

  const rawFieldValue = (formData, name, fallback = "") => {
    const value = formData.get(name);
    return typeof value === "string" ? value : fallback;
  };

  function getSlugFromFormData(formData, fallbackId = "") {
    const explicitSlug = fieldValue(formData, "slug") || fieldValue(formData, "id");
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

  const DEBUG_INVITATION_FLOW = true;

  function debugInvitationFlow(label, data = {}) {
    if (!DEBUG_INVITATION_FLOW) return;
    console.log(`[Invitaciones Debug] ${label}`, data);
  }

  function splitDateParts(dateValue) {
    if (!dateValue) return { dia: "", mes: "", anio: "" };
    const [anio, mes, dia] = dateValue.split("-");
    return { dia: dia || "", mes: mes || "", anio: anio || "" };
  }

  function replaceInvitationVariables(template, invitation) {
    const parts = splitDateParts(invitation.fecha || "");
    const design = { ...DEFAULT_DESIGN, ...(invitation.design || {}) };
    const coverImage = getInvitationImage(invitation);
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
      googleScriptUrl: invitation.googleScriptUrl || invitation.sheetEndpoint || DEFAULT_GOOGLE_SCRIPT_URL,
      telefono: invitation.telefono,
      adminPassword: invitation.adminPassword || "",
      descripcion: invitation.descripcion,
      visualCanvasImage: imagePath(invitation.visualCanvasImage, false),
      mainImage: imagePath(design.mainImage, false),
      backgroundImage: imagePath(design.backgroundImage, false),
      imageUrl: imagePath(design.imageUrl, false),
      uploadedImage: imagePath(design.uploadedImage, false),
      coverImage: imagePath(coverImage, false)
    };

    return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => values[key] ?? "");
  }

  function buildSidebar() {
    const id = getCurrentInvitationId();
    const adminHref = id ? buildUrl("administrador.html", { id }) : "administrador.html";
    const editorHref = id ? buildUrl("editor.html", { id }) : "";

    return `
      <button class="mobile-menu-button" id="mobileSidebarButton" type="button" aria-label="Abrir menú">?</button>
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
          <a href="index.html" title="Inicio"><span>¦</span><strong>Inicio</strong></a>
          <a href="crear.html" title="Crear invitación"><span>+</span><strong>Crear invitación</strong></a>
          <a href="${adminHref}" title="Admin"><span>?</span><strong>Admin</strong></a>
          ${editorHref ? `<a href="${editorHref}" title="Editar invitación"><span>?</span><strong>Editar invitación</strong></a>` : ""}
        </nav>
        <button class="sidebar-collapse" id="sidebarCollapseButton" type="button" title="Colapsar o expandir"><span>?</span><strong>Colapsar</strong></button>
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
      safeSetItem(SIDEBAR_COLLAPSED_KEY, document.body.classList.contains("sidebar-collapsed"));
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

  function getVisualCanvasImageKey(invitationId) {
    return `visualCanvasImage_${invitationId || "draft"}`;
  }

  function getVisualDesignKey(invitationId) {
    return `visualDesign_${invitationId || "draft"}`;
  }
  function getVisualTemplateImageKey(invitationId) {
    return `visualTemplateImage_${invitationId || "draft"}`;
  }

  function getBirthdayPhotoImageKey(invitationId) {
    return `birthdayPhotoImage_${invitationId || "draft"}`;
  }

  function cleanupLegacyImageStorage() {
    const prefixes = [
      "visualCanvasImage_",
      "visualCanvasTemplate_",
      "visualTemplateImage_",
      "birthdayPhotoImage_"
    ];
    Object.keys(localStorage).forEach((key) => {
      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
    });
    const storedInvitations = getStoredJson(CUSTOM_INVITATIONS_KEY, []);
    if (Array.isArray(storedInvitations) && storedInvitations.length) {
      setCustomInvitationsWithVisualFallback(storedInvitations);
    }
  }
  function getInvitationStorageAliases(invitation = {}) {
    return Array.from(new Set([
      invitation.id,
      invitation.slug,
      invitation.url,
      invitation.titulo ? generateSlug(invitation.titulo) : "",
      invitation.nombre ? generateSlug(invitation.nombre) : ""
    ].filter(Boolean).map((value) => generateSlug(value))));
  }

  function persistVisualCanvasImage(invitation, visualCanvasImage) {
    if (!invitation || !visualCanvasImage) return;
    getInvitationStorageAliases(invitation).forEach((alias) => {
      trySetStorageValue(getVisualCanvasImageKey(alias), visualCanvasImage);
    });
  }

  function stripDataImagesFromVisualDesign(visualDesign) {
    if (!visualDesign) return null;
    try {
      const design = typeof visualDesign === "string" ? JSON.parse(visualDesign) : JSON.parse(JSON.stringify(visualDesign));
      const stripObject = (value) => {
        if (!value || typeof value !== "object") return;
        Object.keys(value).forEach((key) => {
          if (typeof value[key] === "string" && isLargeDataImage(value[key])) value[key] = "";
          else stripObject(value[key]);
        });
      };
      stripObject(design);
      return design;
    } catch (error) {
      return null;
    }
  }

  function persistVisualDesign(invitation, visualDesign) {
    if (!invitation || !visualDesign) return;
    const safeDesign = stripDataImagesFromVisualDesign(visualDesign);
    if (!safeDesign) return;
    const serializedDesign = JSON.stringify(safeDesign);
    getInvitationStorageAliases(invitation).forEach((alias) => {
      trySetStorageValue(getVisualDesignKey(alias), serializedDesign);
    });
  }

  function persistVisualTemplateImage(invitation, visualTemplateImage) {
    if (!invitation || !visualTemplateImage) return;
    getInvitationStorageAliases(invitation).forEach((alias) => {
      trySetStorageValue(getVisualTemplateImageKey(alias), visualTemplateImage);
    });
  }

  function persistBirthdayPhotoImage(invitation, birthdayPhotoImage) {
    if (!invitation || !birthdayPhotoImage) return;
    getInvitationStorageAliases(invitation).forEach((alias) => {
      trySetStorageValue(getBirthdayPhotoImageKey(alias), birthdayPhotoImage);
    });
  }

  function sanitizeDesignForStorage(design = {}) {
    return {
      ...design,
      mainImage: keepStorageSafeImage(design.mainImage),
      backgroundImage: keepStorageSafeImage(design.backgroundImage),
      imageUrl: keepStorageSafeImage(design.imageUrl),
      uploadedImage: keepStorageSafeImage(design.uploadedImage)
    };
  }

  function sanitizeInvitationForStorage(invitation = {}) {
    const safeDesign = sanitizeDesignForStorage(invitation.design || {});
    return {
      ...invitation,
      design: safeDesign,
      imagen: keepStorageSafeImage(invitation.imagen),
      visualCanvasImage: keepStorageSafeImage(invitation.visualCanvasImage),
      visualTemplateImage: keepStorageSafeImage(invitation.visualTemplateImage),
      birthdayPhotoImage: keepStorageSafeImage(invitation.birthdayPhotoImage),
      visualDesign: stripDataImagesFromVisualDesign(invitation.visualDesign)
    };
  }

  function setCustomInvitationsWithVisualFallback(invitations) {
    const safeInvitations = invitations.map(sanitizeInvitationForStorage);
    const saved = setStoredJson(CUSTOM_INVITATIONS_KEY, safeInvitations);
    if (!saved) {
      const tinyInvitations = safeInvitations.map((item) => ({
        ...item,
        design: sanitizeDesignForStorage(item.design || {}),
        imagen: "",
        visualCanvasImage: "",
        visualDesign: null,
        visualTemplateImage: "",
        birthdayPhotoImage: ""
      }));
      setStoredJson(CUSTOM_INVITATIONS_KEY, tinyInvitations);
    }
  }

  function normalizeInvitation(invitation) {
    const sourceId = invitation.id || invitation.internalId || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const id = generateSlug(sourceId) || normalizeId(`inv-${Date.now()}`);
    const slug = generateSlug(invitation.slug || invitation.url || invitation.titulo || invitation.nombre || id) || id;
    return {
      ...invitation,
      id,
      slug,
      url: slug,
      descripcion: invitation.descripcion || "Invitación personalizada.",
      imagen: invitation.imagen || "assets/img/celebracion.svg",
      sheetEndpoint: invitation.sheetEndpoint || "",
      googleScriptUrl: invitation.googleScriptUrl || invitation.sheetEndpoint || DEFAULT_GOOGLE_SCRIPT_URL,
      nombre: invitation.nombre || invitation.anfitrion || "",
      edad: invitation.edad || "",
      telefono: invitation.telefono || "",
      design: { ...DEFAULT_DESIGN, ...(invitation.design || {}) },
      customHtml: invitation.customHtml || "",
      customCss: invitation.customCss || "",
      customJs: invitation.customJs || "",
      visualCanvasImage: keepStorageSafeImage(invitation.visualCanvasImage),
      visualTemplateImage: keepStorageSafeImage(invitation.visualTemplateImage),
      birthdayPhotoImage: keepStorageSafeImage(invitation.birthdayPhotoImage),
      visualDesign: stripDataImagesFromVisualDesign(invitation.visualDesign),
      isCustom: true
    };
  }

  function getAllInvitations() {
    const deletedIds = new Set(getDeletedInvitationIds());
    const customInvitations = getCustomInvitations().filter((invitation) => {
      const normalized = normalizeInvitation(invitation);
      return !deletedIds.has(normalized.id) && !deletedIds.has(normalized.slug);
    });
    const normalizedCustomInvitations = customInvitations.map(normalizeInvitation);
    const customByIdOrSlug = new Map();
    normalizedCustomInvitations.forEach((invitation) => {
      customByIdOrSlug.set(invitation.id, invitation);
      customByIdOrSlug.set(invitation.slug, invitation);
    });
    const baseInvitations = invitaciones
      .map(normalizeInvitation)
      .filter((invitation) => !deletedIds.has(invitation.id) && !deletedIds.has(invitation.slug))
      .map((invitation) => customByIdOrSlug.get(invitation.id) || customByIdOrSlug.get(invitation.slug) || invitation);
    const baseKeys = new Set(baseInvitations.flatMap((invitation) => [invitation.id, invitation.slug]));
    const newCustomInvitations = normalizedCustomInvitations.filter((invitation) => !baseKeys.has(invitation.id) && !baseKeys.has(invitation.slug));

    return [...baseInvitations, ...newCustomInvitations];
  }

  function getInvitationLookupCandidates(id, invitation = {}) {
    return Array.from(new Set([
      id,
      invitation.id,
      invitation.slug,
      invitation.url,
      invitation.titulo,
      invitation.nombre,
      generateSlug(invitation.titulo || ""),
      generateSlug(invitation.nombre || "")
    ].filter(Boolean).map((value) => generateSlug(value))));
  }

  function findInvitationByIdOrSlug(value) {
    const normalizedValue = generateSlug(value);
    if (!normalizedValue) return null;
    return getAllInvitations().find((invitation) => invitation.id === normalizedValue || invitation.slug === normalizedValue) || null;
  }

  function getInvitationById(id) {
    return findInvitationByIdOrSlug(id);
  }

  function getStoredVisualAssetByCandidates(keyFactory, candidates, parseJson = false) {
    for (const candidate of candidates) {
      const rawValue = localStorage.getItem(keyFactory(candidate));
      if (!rawValue) continue;
      if (!parseJson) return rawValue;
      try {
        return JSON.parse(rawValue);
      } catch (error) {
        console.warn("No se pudo leer el JSON visual", keyFactory(candidate), error);
      }
    }
    return parseJson ? null : "";
  }
  function getStoredVisualAssetForInvitation(keyFactory, invitation = {}, parseJson = false) {
    const candidates = getInvitationLookupCandidates(invitation.id || invitation.slug || invitation.url || "", invitation);
    return getStoredVisualAssetByCandidates(keyFactory, candidates, parseJson);
  }

  function getVisualTemplateImageForInvitation(invitation = {}) {
    return invitation.visualTemplateImage || getStoredVisualAssetForInvitation(getVisualTemplateImageKey, invitation, false) || "";
  }

  function getBirthdayPhotoImageForInvitation(invitation = {}) {
    return invitation.birthdayPhotoImage || getStoredVisualAssetForInvitation(getBirthdayPhotoImageKey, invitation, false) || "";
  }

  function getVisualDesignForInvitation(invitation = {}) {
    return invitation.visualDesign || getStoredVisualAssetForInvitation(getVisualDesignKey, invitation, true) || null;
  }

  function getVisualCanvasImageForInvitation(invitation = {}) {
    return invitation.visualCanvasImage || getStoredVisualAssetForInvitation(getVisualCanvasImageKey, invitation, false) || "";
  }

  function attachVisualSourcesToInvitation(invitation = {}) {
    const nextInvitation = {
      ...invitation,
      visualTemplateImage: getVisualTemplateImageForInvitation(invitation),
      birthdayPhotoImage: getBirthdayPhotoImageForInvitation(invitation),
      visualDesign: getVisualDesignForInvitation(invitation),
      visualCanvasImage: getVisualCanvasImageForInvitation(invitation)
    };
    if (nextInvitation.visualTemplateImage) persistVisualTemplateImage(nextInvitation, nextInvitation.visualTemplateImage);
    if (nextInvitation.birthdayPhotoImage) persistBirthdayPhotoImage(nextInvitation, nextInvitation.birthdayPhotoImage);
    if (nextInvitation.visualDesign) persistVisualDesign(nextInvitation, nextInvitation.visualDesign);
    if (nextInvitation.visualCanvasImage) persistVisualCanvasImage(nextInvitation, nextInvitation.visualCanvasImage);
    return nextInvitation;
  }

  function getStoredVisualAssetByPrefix(prefix, candidates = [], parseJson = false) {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(prefix));
    const normalizedCandidates = candidates.map((candidate) => generateSlug(candidate));
    const matchingKey = keys.find((key) => normalizedCandidates.some((candidate) => key === `${prefix}${candidate}` || key.includes(candidate)));
    if (!matchingKey) return parseJson ? null : "";
    const rawValue = localStorage.getItem(matchingKey);
    if (!rawValue) return parseJson ? null : "";
    console.log("Asset visual recuperado por fallback:", matchingKey);
    if (!parseJson) return rawValue;
    try {
      return JSON.parse(rawValue);
    } catch (error) {
      console.warn("No se pudo leer asset visual por fallback", matchingKey, error);
      return null;
    }
  }

  async function renderTemplateAndPhotoToDataUrl(templateImage, photoImage) {
    if (!templateImage || !window.fabric) return "";
    const canvasElement = document.createElement("canvas");
    canvasElement.width = 720;
    canvasElement.height = 1280;
    canvasElement.style.position = "fixed";
    canvasElement.style.left = "-9999px";
    canvasElement.style.top = "0";
    canvasElement.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvasElement);

    const staticCanvas = new window.fabric.StaticCanvas(canvasElement, {
      width: 720,
      height: 1280,
      backgroundColor: "#ffffff"
    });

    const loadImage = (src) => new Promise((resolve) => {
      window.fabric.Image.fromURL(src, (image) => resolve(image));
    });

    try {
      const template = await loadImage(templateImage);
      const templateScale = Math.max(720 / template.width, 1280 / template.height);
      template.scale(templateScale);
      template.set({
        left: (720 - template.getScaledWidth()) / 2,
        top: (1280 - template.getScaledHeight()) / 2,
        selectable: false,
        evented: false
      });
      staticCanvas.add(template);

      if (photoImage) {
        const photo = await loadImage(photoImage);
        const photoScale = Math.min(360 / photo.width, 480 / photo.height, 1);
        photo.scale(photoScale);
        photo.set({
          left: 360,
          top: 640,
          originX: "center",
          originY: "center"
        });
        staticCanvas.add(photo);
      }

      staticCanvas.renderAll();
      const dataUrl = staticCanvas.toDataURL({ format: "jpeg", quality: 0.86, multiplier: 1 });
      staticCanvas.dispose();
      canvasElement.remove();
      return dataUrl;
    } catch (error) {
      console.error("No se pudo reconstruir la imagen visual", error);
      staticCanvas.dispose();
      canvasElement.remove();
      return "";
    }
  }

  function renderFabricDesignToDataUrl(visualDesign) {
    return new Promise((resolve) => {
      if (!visualDesign || !window.fabric) {
        resolve("");
        return;
      }

      const canvasElement = document.createElement("canvas");
      canvasElement.width = 720;
      canvasElement.height = 1280;
      canvasElement.style.position = "fixed";
      canvasElement.style.left = "-9999px";
      canvasElement.style.top = "0";
      canvasElement.setAttribute("aria-hidden", "true");
      document.body.appendChild(canvasElement);

      try {
        const staticCanvas = new window.fabric.StaticCanvas(canvasElement, {
          width: 720,
          height: 1280,
          backgroundColor: "#ffffff"
        });
        staticCanvas.loadFromJSON(visualDesign, () => {
          try {
            staticCanvas.renderAll();
            const dataUrl = staticCanvas.toDataURL({ format: "jpeg", quality: 0.86, multiplier: 1 });
            staticCanvas.dispose();
            canvasElement.remove();
            resolve(dataUrl);
          } catch (error) {
            console.error("No se pudo generar PNG desde Fabric", error);
            staticCanvas.dispose();
            canvasElement.remove();
            resolve("");
          }
        });
      } catch (error) {
        console.error("No se pudo cargar Fabric.js en la invitacion publica", error);
        canvasElement.remove();
        resolve("");
      }
    });
  }

  async function hydrateInvitationVisualAssets(invitation, requestedId) {
    if (!invitation) return invitation;
    const candidates = getInvitationLookupCandidates(requestedId, invitation);
    const visualCanvasImage =
      invitation.visualCanvasImage ||
      getStoredVisualAssetByCandidates(getVisualCanvasImageKey, candidates, false) ||
      getStoredVisualAssetByPrefix("visualCanvasImage_", candidates, false);
    const visualTemplateImage =
      invitation.visualTemplateImage ||
      getStoredVisualAssetByCandidates(getVisualTemplateImageKey, candidates, false) ||
      getStoredVisualAssetByPrefix("visualTemplateImage_", candidates, false);
    const birthdayPhotoImage =
      invitation.birthdayPhotoImage ||
      getStoredVisualAssetByCandidates(getBirthdayPhotoImageKey, candidates, false) ||
      getStoredVisualAssetByPrefix("birthdayPhotoImage_", candidates, false);
    const visualDesign =
      invitation.visualDesign ||
      getStoredVisualAssetByCandidates(getVisualDesignKey, candidates, true) ||
      getStoredVisualAssetByPrefix("visualDesign_", candidates, true);
    const hydratedInvitation = {
      ...invitation,
      visualCanvasImage,
      visualTemplateImage,
      birthdayPhotoImage,
      visualDesign
    };

    if (hydratedInvitation.visualDesign) {
      const generatedImage = await renderFabricDesignToDataUrl(hydratedInvitation.visualDesign);
      if (generatedImage) {
        hydratedInvitation.visualCanvasImage = generatedImage;
        persistVisualCanvasImage(hydratedInvitation, generatedImage);
        updateInvitationInLocalStorage(hydratedInvitation);
      }
    }

    if (!hydratedInvitation.visualCanvasImage && hydratedInvitation.visualTemplateImage) {
      const generatedImage = await renderTemplateAndPhotoToDataUrl(hydratedInvitation.visualTemplateImage, hydratedInvitation.birthdayPhotoImage);
      if (generatedImage) {
        hydratedInvitation.visualCanvasImage = generatedImage;
        persistVisualCanvasImage(hydratedInvitation, generatedImage);
        updateInvitationInLocalStorage(hydratedInvitation);
      }
    }

    console.log("Assets visuales hidratados:", {
      visualCanvasImage: !!hydratedInvitation.visualCanvasImage,
      visualTemplateImage: !!hydratedInvitation.visualTemplateImage,
      birthdayPhotoImage: !!hydratedInvitation.birthdayPhotoImage,
      visualDesign: !!hydratedInvitation.visualDesign
    });

    return hydratedInvitation;
  }

  function isSlugAvailable(slug, currentId = null) {
    const normalizedSlug = generateSlug(slug);
    const normalizedCurrentId = generateSlug(currentId || "");
    if (!validateSlug(normalizedSlug)) return false;
    return !getAllInvitations().some((invitation) => {
      return invitation.slug === normalizedSlug && invitation.id !== normalizedCurrentId;
    });
  }

  function saveCustomInvitation(invitation) {
    const normalizedInvitation = normalizeInvitation(invitation);
    const deletedIds = getDeletedInvitationIds().filter((id) => id !== normalizedInvitation.id && id !== normalizedInvitation.slug);
    const customInvitations = getCustomInvitations();

    if (normalizedInvitation.visualCanvasImage) persistVisualCanvasImage(normalizedInvitation, normalizedInvitation.visualCanvasImage);
    if (normalizedInvitation.visualDesign) persistVisualDesign(normalizedInvitation, normalizedInvitation.visualDesign);
    if (normalizedInvitation.visualTemplateImage) persistVisualTemplateImage(normalizedInvitation, normalizedInvitation.visualTemplateImage);
    if (normalizedInvitation.birthdayPhotoImage) persistBirthdayPhotoImage(normalizedInvitation, normalizedInvitation.birthdayPhotoImage);

    const index = customInvitations.findIndex((item) => {
      const normalizedItem = normalizeInvitation(item);
      return normalizedItem.id === normalizedInvitation.id || normalizedItem.slug === normalizedInvitation.slug;
    });

    if (index >= 0) {
      customInvitations[index] = normalizedInvitation;
    } else {
      customInvitations.push(normalizedInvitation);
    }

    setCustomInvitationsWithVisualFallback(customInvitations);
    setStoredJson(DELETED_INVITATIONS_KEY, deletedIds);
    debugInvitationFlow("saveCustomInvitation", {
      savedId: normalizedInvitation.id,
      savedSlug: normalizedInvitation.slug,
      savedUrl: normalizedInvitation.url,
      publicUrl: getPublicInvitationUrl(normalizedInvitation),
      availableIds: getAvailableInvitationIds()
    });
    return normalizedInvitation;
  }

  function removeCustomInvitationById(id) {
    setStoredJson(CUSTOM_INVITATIONS_KEY, getCustomInvitations().filter((item) => item.id !== id && item.slug !== id && item.url !== id));
  }

  function getAvailableInvitationIds() {
    return getAllInvitations().map((invitation) => ({
      id: invitation.id,
      slug: invitation.slug,
      url: invitation.url
    }));
  }

  function migrateInvitationStorage(oldId, newId) {
    if (!oldId || !newId || oldId === newId) return;
    localStorage.removeItem(storageKey(oldId));
    localStorage.removeItem(legacyStorageKey(oldId));
  }

  function getRsvps(invitationId) {
    console.warn("RSVP local deshabilitado. Las confirmaciones se leen desde Apps Script.", invitationId);
    return [];
  }

  function getInvitationRemoteId(invitationOrId) {
    const invitation = typeof invitationOrId === "object" ? invitationOrId : getInvitationById(invitationOrId);
    return invitation?.slug || invitation?.id || generateSlug(invitationOrId || "");
  }

  function getInvitationScriptUrl(invitationOrId) {
    const invitation = typeof invitationOrId === "object" ? invitationOrId : getInvitationById(invitationOrId);
    return invitation?.googleScriptUrl || invitation?.sheetEndpoint || DEFAULT_GOOGLE_SCRIPT_URL;
  }

  async function fetchRemoteRsvps(invitationOrId) {
    const scriptUrl = getInvitationScriptUrl(invitationOrId);
    const invitationId = getInvitationRemoteId(invitationOrId);
    if (!scriptUrl || !invitationId) return [];
    const response = await fetch(`${scriptUrl}?id=${encodeURIComponent(invitationId)}`);
    const data = await response.json();
    return Array.isArray(data) ? data : (Array.isArray(data.confirmados) ? data.confirmados : []);
  }

  async function saveRsvp(invitationOrId, data) {
    const scriptUrl = getInvitationScriptUrl(invitationOrId);
    const invitationId = getInvitationRemoteId(invitationOrId);
    if (!scriptUrl || !invitationId) throw new Error("No se configuro Google Apps Script para RSVP.");
    const formData = new FormData();
    formData.append("invitacionId", invitationId);
    formData.append("nombre", data.nombre || "");
    formData.append("cantidad", String(data.cantidad || data.acompanantes || 1));
    formData.append("telefono", data.telefono || "");
    await fetch(scriptUrl, {
      method: "POST",
      body: formData
    });
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
  window.copyPublicLink = copyPublicLink;
  window.openInvitation = openInvitation;
  window.shareWhatsApp = shareWhatsApp;
  window.shareFacebook = shareFacebook;
  window.shareTelegram = shareTelegram;
  window.shareEmail = shareEmail;
  window.generateQRCode = generateQRCode;
  window.downloadQRCode = downloadQRCode;
  window.buildSidebar = buildSidebar;
  window.initSidebar = initSidebar;
  window.replaceInvitationVariables = replaceInvitationVariables;
  function getCurrentInvitationIdOrSlug() {
    if (page === "editor") {
      const form = document.getElementById("professionalEditorForm");
      if (form) return getSlugFromFormData(new FormData(form), activeEditorInvitation?.id || "");
    }
    return getCurrentInvitationId() || activeEditorInvitation?.slug || activeEditorInvitation?.id || "";
  }

  function getCurrentInvitationObject() {
    if (page === "editor" && document.getElementById("professionalEditorForm")) {
      return getProfessionalFormData();
    }
    return activeEditorInvitation || getInvitationById(getCurrentInvitationIdOrSlug()) || {};
  }

  function updateInvitationInLocalStorage(invitation) {
    if (!invitation) return null;
    const normalizedInvitation = normalizeInvitation(invitation);
    const customInvitations = getCustomInvitations();
    const index = customInvitations.findIndex((item) => {
      const normalizedItem = normalizeInvitation(item);
      return normalizedItem.id === normalizedInvitation.id || normalizedItem.slug === normalizedInvitation.slug;
    });
    if (index >= 0) {
      customInvitations[index] = normalizedInvitation;
    } else {
      customInvitations.push(normalizedInvitation);
    }
    setCustomInvitationsWithVisualFallback(customInvitations);
    activeEditorInvitation = normalizedInvitation;
    return normalizedInvitation;
  }

  function forceSaveVisualCanvasImage() {
    const invitationId = getCurrentInvitationIdOrSlug();
    const invitation = getCurrentInvitationObject();

    if (!window.fabricCanvas && !window.visualCanvas && !visualEditorCanvas) {
      console.error("No existe canvas Fabric");
      return null;
    }

    const canvas = window.fabricCanvas || window.visualCanvas || visualEditorCanvas;
    const png = canvas.toDataURL({
      format: "jpeg",
      quality: 0.86,
      multiplier: 1
    });

    invitation.id = invitation.id || invitationId;
    invitation.slug = invitation.slug || invitationId;
    invitation.visualCanvasImage = png;
    invitation.visualTemplateImage = invitation.visualTemplateImage || activeEditorInvitation?.visualTemplateImage || localStorage.getItem(getVisualTemplateImageKey(invitationId)) || "";
    invitation.birthdayPhotoImage = invitation.birthdayPhotoImage || activeEditorInvitation?.birthdayPhotoImage || localStorage.getItem(getBirthdayPhotoImageKey(invitationId)) || "";
    invitation.visualDesign = canvas.toJSON ? canvas.toJSON(["visualRole", "selectable", "evented", "lockMovementX", "lockMovementY", "lockRotation", "lockScalingX", "lockScalingY"]) : invitation.visualDesign;
    persistVisualCanvasImage(invitation, png);
    if (invitation.visualDesign) persistVisualDesign(invitation, invitation.visualDesign);

    if (invitation.visualTemplateImage) persistVisualTemplateImage(invitation, invitation.visualTemplateImage);
    if (invitation.birthdayPhotoImage) persistBirthdayPhotoImage(invitation, invitation.birthdayPhotoImage);

    console.log("Guardando plantilla:", !!invitation.visualTemplateImage);
    console.log("Guardando foto:", !!invitation.birthdayPhotoImage);
    console.log("Guardando PNG final:", !!invitation.visualCanvasImage);
    console.log("Guardando JSON Fabric:", !!invitation.visualDesign);

    updateInvitationInLocalStorage(invitation);

    console.log("visualCanvasImage guardado:", png.slice(0, 50));
    return png;
  }

  window.getCurrentInvitationIdOrSlug = getCurrentInvitationIdOrSlug;
  window.getCurrentInvitationObject = getCurrentInvitationObject;
  window.updateInvitationInLocalStorage = updateInvitationInLocalStorage;
  window.forceSaveVisualCanvasImage = forceSaveVisualCanvasImage;

  const getInvitationImage = (invitation) => {
    const design = { ...DEFAULT_DESIGN, ...(invitation.design || {}) };
    return design.uploadedImage || design.imageUrl || design.mainImage || design.backgroundImage || invitation.imagen || "assets/img/celebracion.svg";
  };

  const getInvitationBackgroundImage = (invitation) => {
    const design = { ...DEFAULT_DESIGN, ...(invitation.design || {}) };
    return design.backgroundImage || "";
  };


  function getFinalInvitationImage(invitation) {
    const design = { ...DEFAULT_DESIGN, ...(invitation.design || {}) };
    return imagePath(
      getVisualCanvasImageForInvitation(invitation) ||
      getVisualTemplateImageForInvitation(invitation) ||
      invitation.uploadedImage ||
      design.uploadedImage ||
      invitation.imageUrl ||
      design.imageUrl ||
      invitation.mainImage ||
      design.mainImage ||
      invitation.backgroundImage ||
      design.backgroundImage ||
      "",
      false
    );
  }

  function stripFullDocumentMarkup(html) {
    return String(html || "")
      .replace(/<!doctype[\s\S]*?>/gi, "")
      .replace(/<\/?html[\s\S]*?>/gi, "")
      .replace(/<head[\s\S]*?<\/head>/gi, "")
      .replace(/<\/?body[\s\S]*?>/gi, "");
  }

  function stripStandaloneUnsafeMarkup(html) {
    return stripFullDocumentMarkup(html)
      .replace(/<script\b[^>]*\bsrc\s*=\s*["'][^"']*["'][^>]*>\s*<\/script>/gi, "")
      .replace(/<script\b[^>]*\bsrc\s*=\s*[^\s>]+[^>]*>\s*<\/script>/gi, "")
      .replace(/<link\b[^>]*>/gi, "")
      .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
      .replace(/assets\/js\/data\.js/gi, "")
      .replace(/assets\/js\/app\.js/gi, "")
      .replace(/data-page\s*=\s*["']invitation["']/gi, "");
  }
  function buildInvitationTemplate(invitation) {
    const design = { ...DEFAULT_DESIGN, ...(invitation.design || {}) };
    const finalImage = getFinalInvitationImage(invitation);
    const animationClass = design.animation && design.animation !== "none" ? ` animation-${design.animation}` : "";
    const effectLayers = animationClass
      ? `
        <div class="magic-overlay"></div>
        <div class="sparkles-layer" data-sparkles-layer></div>
        <div class="shine-layer"></div>`
      : "";

    return `
      <section class="generated-invitation invitation-card typography-${escapeHtml(design.typography)}${animationClass}" style="--inv-primary:${escapeHtml(design.primaryColor)}; --inv-secondary:${escapeHtml(design.secondaryColor)}; --inv-text:${escapeHtml(design.textColor)}; --inv-button:${escapeHtml(design.buttonColor)};">
        ${finalImage ? `<img class="template-layer" src="${escapeHtml(finalImage)}" alt="Plantilla de invitación">` : ""}
        ${effectLayers}
        <div class="generated-content invitation-content">
          <p class="generated-kicker">${escapeHtml(invitation.tipo)}</p>
          <h1>${escapeHtml(invitation.titulo)}</h1>
          <p class="generated-host">${escapeHtml(invitation.anfitrion)}</p>
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
      html, body { width: 100%; height: 100%; max-width: 100%; margin: 0; overflow: hidden; }
      body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fffdf9; }
      *, *::before, *::after { box-sizing: border-box; max-width: 100%; }
      img, video, iframe { max-width: 100%; }
      img { display: block; }
      #custom-invitation-root { position: relative; width: 100%; height: 100%; max-width: 100%; overflow: hidden; }
      #custom-invitation-root > * { max-width: 100%; }
      #custom-invitation-root.has-cover-background { background-image: var(--inv-background-image); background-size: cover; background-position: center; background-repeat: no-repeat; }
      #custom-invitation-root.has-visual-canvas-image { background-image: var(--inv-visual-canvas-image); background-size: cover; background-position: center; background-repeat: no-repeat; }
      .visual-final-image, .template-layer { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; border-radius: inherit; z-index: 1; }
      .custom-cover-main-image { width: min(520px, 86%); aspect-ratio: 4 / 3; object-fit: cover; margin: 28px auto 0; border: 10px solid rgba(255,255,255,.78); border-radius: 8px; box-shadow: 0 26px 70px rgba(38,48,47,.2); }
      .generated-invitation, .invitation-card { position: relative; width: 100%; height: 100%; display: grid; place-items: center; overflow: hidden; padding: clamp(20px, 5vw, 56px) clamp(12px, 4vw, 22px); color: var(--inv-text); background: #160018; }
      .magic-overlay { position: absolute; inset: 0; z-index: 2; pointer-events: none; background: radial-gradient(circle at 20% 25%, rgba(255,255,180,.55), transparent 8%), radial-gradient(circle at 78% 20%, rgba(255,80,190,.45), transparent 9%), radial-gradient(circle at 35% 78%, rgba(180,120,255,.45), transparent 10%); animation: magicPulse 2.5s infinite alternate; mix-blend-mode: screen; }
      .shine-layer { position: absolute; inset: -50%; z-index: 3; pointer-events: none; background: linear-gradient(120deg, transparent 38%, rgba(255,255,255,.35) 49%, transparent 60%); animation: shineMove 5s linear infinite; }
      .sparkles-layer { position: absolute; inset: 0; z-index: 4; pointer-events: none; overflow: hidden; }
      .custom-html-layer { position: absolute; inset: 0; z-index: 10; pointer-events: none; display: grid; place-items: center; padding: clamp(18px, 5vw, 56px); }
      .sparkle { position: absolute; width: 7px; height: 7px; border-radius: 999px; background: rgba(255,255,255,.92); box-shadow: 0 0 12px rgba(255,255,255,.95), 0 0 22px rgba(255,115,220,.65); animation: sparkleFloat 3.8s ease-in-out infinite; }
      .missing-template-message { position: relative; z-index: 20; margin: 0; padding: 18px; border-radius: 8px; background: rgba(255,255,255,.82); color: #7a1f1f; font-weight: 900; text-align: center; }
      .generated-content, .invitation-content { position: relative; z-index: 5; width: min(860px, 100%); display: grid; justify-items: center; gap: 18px; padding: 22px; border-radius: 8px; background: rgba(255,255,255,.72); backdrop-filter: blur(3px); text-align: center; }
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
      @keyframes magicPulse { from { opacity: .45; transform: scale(1); } to { opacity: .9; transform: scale(1.03); } }
      @keyframes shineMove { 0% { transform: translateX(-55%); } 100% { transform: translateX(55%); } }
      @keyframes sparkleFloat { 0%,100% { opacity: .15; transform: translateY(0) scale(.7); } 45% { opacity: 1; transform: translateY(-18px) scale(1.2); } }
      @media (max-width: 640px) {
        .generated-invitation, .invitation-card { padding: 18px 10px; }
        .generated-content h1 { font-size: clamp(2.2rem, 16vw, 4.5rem); }
        .generated-details span { width: 100%; border-radius: 8px; }
      }
    `;
  }

  function buildCustomInvitationDocument(invitation) {
    const design = { ...DEFAULT_DESIGN, ...(invitation.design || {}) };
    const finalImage = getFinalInvitationImage(invitation);
    const customHtml = stripFullDocumentMarkup(replaceInvitationVariables(invitation.customHtml || "", invitation));
    const fallbackContent = `
      <div class="generated-content invitation-content">
        <p class="generated-kicker">${escapeHtml(invitation.tipo)}</p>
        <h1>${escapeHtml(invitation.titulo)}</h1>
        <p class="generated-host">${escapeHtml(invitation.anfitrion)}</p>
        <div class="generated-details">
          <span>${formatDate(invitation.fecha)}</span>
          <span>${escapeHtml(invitation.hora)}</span>
          <span>${escapeHtml(invitation.lugar)}</span>
        </div>
        <p class="generated-address">${escapeHtml(invitation.direccion)}</p>
      </div>`;
    const contentHtml = customHtml || fallbackContent;
    const css = replaceInvitationVariables(invitation.customCss || "", invitation);
    const js = replaceInvitationVariables(invitation.customJs || "", invitation);
    const animationClass = design.animation && design.animation !== "none" ? ` animation-${design.animation}` : "";
    const effectLayers = animationClass
      ? `<div class="magic-overlay"></div><div class="sparkles-layer" data-sparkles-layer></div><div class="shine-layer"></div>`
      : "";

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseDocumentStyles()}</style>
  <style>${css}</style>
  <style id="export-mobile-layout-fix">
    html, body { margin: 0 !important; min-height: 100svh !important; height: auto !important; overflow-x: hidden !important; overflow-y: auto !important; background: #170016 !important; }
    body { display: block !important; place-items: initial !important; padding: 0 !important; }
    .public-invitation-page { width: 100% !important; min-height: 100svh !important; display: block !important; padding: 0 14px 64px !important; background: #170016 !important; overflow: visible !important; }
    .invitation-preview { width: 100% !important; min-height: 100svh !important; margin: 0 auto 28px !important; padding: max(34px, env(safe-area-inset-top)) 0 22px !important; display: flex !important; align-items: center !important; justify-content: center !important; overflow: visible !important; }
    #custom-invitation-root { width: min(92vw, 430px, calc((100svh - 96px) * 9 / 16)) !important; height: auto !important; overflow: visible !important; position: relative !important; margin: 0 auto !important; }
    .generated-invitation.invitation-card { width: 100% !important; aspect-ratio: 9 / 16 !important; height: auto !important; min-height: 0 !important; max-height: calc(100svh - 96px) !important; overflow: hidden !important; border-radius: 18px !important; padding: 0 !important; position: relative !important; display: block !important; }
    .template-layer { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; object-fit: contain !important; display: block !important; }
    .rsvp-actions { width: min(92vw, 430px) !important; margin: 0 auto 96px !important; position: static !important; display: grid !important; }
    .rsvp-section { width: min(92vw, 430px) !important; margin: 0 auto 40px !important; position: static !important; }
    .host-section { width: min(92vw, 430px) !important; margin: 0 auto !important; position: static !important; }
    .rsvp-title, .scroll-rsvp-title { margin: 56px auto 28px !important; text-align: center !important; }
    @media (max-width: 600px) { .invitation-preview { padding-top: max(64px, env(safe-area-inset-top)) !important; } #custom-invitation-root { width: min(90vw, calc((100svh - 118px) * 9 / 16)) !important; } .generated-invitation.invitation-card { max-height: calc(100svh - 118px) !important; } }
  </style>
  <style>
    html, body { margin: 0 !important; min-height: 100vh !important; height: auto !important; overflow-x: hidden !important; overflow-y: auto !important; background: #170016 !important; }
    body { display: block !important; padding: 0 !important; }
    .public-invitation-page { width: 100% !important; min-height: 100vh !important; display: grid !important; gap: 18px !important; justify-items: center !important; padding: 32px 14px 60px !important; background: #170016 !important; }
    .invitation-preview { width: min(92vw, 430px) !important; margin: 0 auto 36px !important; }
    #custom-invitation-root { width: 100% !important; height: auto !important; overflow: visible !important; }
    .generated-invitation.invitation-card { width: 100% !important; aspect-ratio: 9 / 16 !important; height: auto !important; min-height: 0 !important; overflow: hidden !important; border-radius: 18px !important; padding: 0 !important; }
    .template-layer { width: 100% !important; height: 100% !important; object-fit: contain !important; display: block !important; }
    .rsvp-actions { width: min(92vw, 430px) !important; margin: 0 auto !important; position: static !important; }
    .rsvp-section { width: min(92vw, 430px) !important; margin: 90px auto 40px !important; position: static !important; }
    .host-section { width: min(92vw, 430px) !important; margin: 0 auto !important; position: static !important; }
    .rsvp-title, .scroll-rsvp-title { margin: 56px auto 28px !important; text-align: center !important; }
    @media (max-width: 600px) { .public-invitation-page { padding-top: 72px !important; } }
  </style>
</head>
<body>
  <section id="custom-invitation-root">
    <div class="generated-invitation invitation-card typography-${escapeHtml(design.typography)}${animationClass}" style="--inv-primary:${escapeHtml(design.primaryColor)}; --inv-secondary:${escapeHtml(design.secondaryColor)}; --inv-text:${escapeHtml(design.textColor)}; --inv-button:${escapeHtml(design.buttonColor)};">
      ${finalImage ? `<img class="template-layer" src="${escapeHtml(finalImage)}" alt="Invitacion">` : `<p class="missing-template-message">Invitación encontrada, pero no tiene imagen guardada.</p>`}
      ${effectLayers}
      <div class="custom-html-layer">${contentHtml}</div>
    </div>
  </section>
  <script>
    console.log("INVITACION PUBLICA:", ${JSON.stringify(invitation).replace(/<\/script/gi, "<\\/script")});
    console.log("IMAGEN FINAL:", ${JSON.stringify(finalImage ? "OK" : "NO HAY IMAGEN")});
    window.addEventListener("error", function (event) {
      console.error("Error en JS personalizado:", event.error || event.message);
    });
    document.querySelectorAll(".sparkles-layer").forEach(function (layer) {
      if (layer.dataset.ready === "true") return;
      layer.dataset.ready = "true";
      for (var index = 0; index < 28; index += 1) {
        var sparkle = document.createElement("span");
        sparkle.className = "sparkle";
        sparkle.style.left = Math.round(Math.random() * 100) + "%";
        sparkle.style.top = Math.round(Math.random() * 100) + "%";
        sparkle.style.animationDelay = (Math.random() * 3).toFixed(2) + "s";
        sparkle.style.animationDuration = (2.4 + Math.random() * 2.8).toFixed(2) + "s";
        layer.appendChild(sparkle);
      }
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
  let activeShareInvitation = null;

  function getAbsolutePublicInvitationUrl(slug) {
    return getPublicInvitationUrl(slug);
  }

  function getShareInvitation(invitation = null) {
    return normalizeInvitation(invitation || activeShareInvitation || activeEditorInvitation || {});
  }

  function getShareSlug(invitation = null) {
    return getInvitationPublicSlug(getShareInvitation(invitation));
  }

  function getShareUrl(invitation = null) {
    return getPublicInvitationUrl(getShareInvitation(invitation));
  }

  async function copyPublicLink(invitation = null) {
    const url = getShareUrl(invitation);
    await navigator.clipboard.writeText(url);
    setShareStatus("Enlace copiado correctamente");
    return url;
  }

  function openInvitation(invitation = null) {
    window.open(getShareUrl(invitation), "_blank", "noopener");
  }

  function shareWhatsApp(invitation = null) {
    const url = getShareUrl(invitation);
    const message = `Hola ??\n\nTe invito a mi evento.\n\nPuedes ver la invitación y confirmar tu asistencia aquí:\n\n${url}\n\n¡Te espero!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  function shareFacebook(invitation = null) {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl(invitation))}`, "_blank", "noopener");
  }

  function shareTelegram(invitation = null) {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(getShareUrl(invitation))}`, "_blank", "noopener");
  }

  function shareEmail(invitation = null) {
    window.location.href = `mailto:?subject=${encodeURIComponent("Invitación especial")}&body=${encodeURIComponent(getShareUrl(invitation))}`;
  }

  function getQrImageUrl(invitation = null, size = 360) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=png&margin=18&data=${encodeURIComponent(getShareUrl(invitation))}`;
  }

  function generateQRCode(invitation = null, section = null) {
    const targetSection = section || document.querySelector("[data-share-section]");
    const img = targetSection?.querySelector("[data-share-qr]");
    if (!img) return "";
    const qrUrl = getQrImageUrl(invitation);
    img.src = qrUrl;
    return qrUrl;
  }

  function downloadQRCode(invitation = null) {
    const item = getShareInvitation(invitation);
    const link = document.createElement("a");
    link.href = getQrImageUrl(item, 720);
    link.download = `qr-${item.id}.png`;
    link.target = "_blank";
    link.rel = "noopener";
    link.click();
  }

  function setShareStatus(message, section = null) {
    const sections = section ? [section] : Array.from(document.querySelectorAll("[data-share-section]"));
    sections.forEach((item) => {
      const status = item.querySelector("[data-share-status]");
      if (!status) return;
      status.textContent = message;
      if (message) setTimeout(() => { status.textContent = ""; }, 2200);
    });
  }

  async function nativeShareInvitation(invitation = null) {
    const item = getShareInvitation(invitation);
    const url = getShareUrl(item);
    if (!navigator.share) return;
    await navigator.share({
      title: item.titulo || "Invitación especial",
      text: "Te invito a mi evento. Puedes ver la invitación y confirmar tu asistencia aquí:",
      url
    });
  }

  function renderShareSection(invitation, section) {
    if (!section || !invitation) return;
    const item = getShareInvitation(invitation);
    activeShareInvitation = item;
    const absoluteUrl = getShareUrl(item);
    const relativeUrl = buildUrl("invitacion.html", { id: getInvitationPublicSlug(item) });
    const setText = (selector, value) => {
      section.querySelectorAll(selector).forEach((node) => { node.textContent = value; });
    };

    setText("[data-share-url]", absoluteUrl);
    setText("[data-share-url-short]", relativeUrl);
    setText("[data-share-slug]", item.id);
    setText("[data-share-title]", item.titulo || "Invitacion");
    setText("[data-share-date]", item.fecha || "Sin fecha");
    generateQRCode(item, section);

    const nativeButton = section.querySelector("[data-share-action='native']");
    if (nativeButton && navigator.share) nativeButton.classList.remove("hidden");
  }

  function initShareSection(invitation) {
    const sections = Array.from(document.querySelectorAll("[data-share-section]"));
    if (!sections.length || !invitation) return;
    sections.forEach((section) => {
      renderShareSection(invitation, section);
      if (section.dataset.shareReady === "true") return;
      section.dataset.shareReady = "true";
      section.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-share-action]");
        if (!button) return;
        const action = button.dataset.shareAction;
        const item = activeShareInvitation;
        try {
          if (action === "copy") await copyPublicLink(item);
          if (action === "open") openInvitation(item);
          if (action === "whatsapp") shareWhatsApp(item);
          if (action === "facebook") shareFacebook(item);
          if (action === "telegram") shareTelegram(item);
          if (action === "email") shareEmail(item);
          if (action === "download-qr") downloadQRCode(item);
          if (action === "native") await nativeShareInvitation(item);
        } catch (error) {
          setShareStatus("No se pudo completar la accion", section);
          console.error("Error al compartir invitacion", error);
        }
      });
    });
  }

  function getHomeInvitationItems() {
    return getAllInvitations();
  }

  function getInvitationCardThumbnail(invitation) {
    return getVisualCanvasImageForInvitation(invitation) || "";
  }

  function removeInvitationVisualKeys(invitation) {
    getInvitationStorageAliases(invitation).forEach((alias) => {
      localStorage.removeItem(getVisualCanvasImageKey(alias));
      localStorage.removeItem(getVisualTemplateImageKey(alias));
      localStorage.removeItem(getBirthdayPhotoImageKey(alias));
      localStorage.removeItem(getVisualDesignKey(alias));
    });
  }

  function deleteInvitationRecord(id, confirmationMessage = "¿Seguro que deseas eliminar esta invitación?") {
    const invitation = getInvitationById(id) || { id };
    if (!window.confirm(confirmationMessage)) return false;

    removeCustomInvitationById(id);
    removeInvitationVisualKeys(invitation);
    localStorage.removeItem(storageKey(id));
    localStorage.removeItem(legacyStorageKey(id));

    const deletedIds = new Set(getDeletedInvitationIds());
    getInvitationStorageAliases(invitation).forEach((alias) => deletedIds.add(alias));
    deletedIds.add(generateSlug(id));
    setStoredJson(DELETED_INVITATIONS_KEY, Array.from(deletedIds));
    return true;
  }

  function createNewInvitation() {
    const id = normalizeId(`invitacion-${Date.now().toString(36)}`);
    const today = new Date().toISOString().slice(0, 10);
    saveCustomInvitation({
      id,
      slug: id,
      url: id,
      titulo: "Nueva invitación",
      tipo: "Evento",
      anfitrion: "",
      nombre: "",
      edad: "",
      fecha: today,
      hora: "",
      lugar: "",
      direccion: "",
      telefono: "",
      descripcion: "Invitación personalizada.",
      adminPassword: "",
      customHtml: "",
      customCss: "",
      customJs: "",
      design: { ...DEFAULT_DESIGN },
      visualCanvasImage: "",
      visualTemplateImage: "",
      birthdayPhotoImage: "",
      visualDesign: null
    });
    window.location.href = buildUrl("editor.html", { id });
  }

  function renderInvitationCards() {
    const list = document.getElementById("invitationList");
    const count = document.getElementById("invitationCount");
    if (!list) return;

    const invitations = getHomeInvitationItems();
    if (count) count.textContent = `${invitations.length} ${invitations.length === 1 ? "evento" : "eventos"}`;

    if (!invitations.length) {
      list.classList.add("home-empty-list");
      list.innerHTML = `
        <div class="empty-state home-empty-state">
          <h3>Aún no tienes invitaciones creadas.</h3>
          <button class="button primary home-empty-create" type="button" data-home-action="create">Crear primera invitación</button>
        </div>
      `;
      return;
    }

    list.classList.remove("home-empty-list");
    list.innerHTML = invitations.map((invitation) => {
      const thumbnail = getInvitationCardThumbnail(invitation);
      const title = invitation.titulo || invitation.nombre || "Invitación sin nombre";
      const date = invitation.fecha ? formatDate(invitation.fecha) : "Sin fecha";
      return `
        <article class="invitation-card home-invitation-card">
          <div class="home-card-thumbnail${thumbnail ? "" : " is-empty"}">
            ${thumbnail ? `<img src="${escapeHtml(imagePath(thumbnail, false))}" alt="Miniatura de ${escapeHtml(title)}">` : `<span>Sin miniatura</span>`}
          </div>
          <div class="card-body home-card-body">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(date)}</p>
            <div class="home-card-actions">
              <a class="button primary" href="${buildUrl("editor.html", { id: invitation.id })}">Editar</a>
              <a class="button secondary" href="${getPublicInvitationUrl(invitation)}">Ver</a>
              <button class="button danger" type="button" data-home-action="delete" data-invitation-id="${escapeHtml(invitation.id)}">Eliminar</button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderHome() {
    renderInvitationCards();
    document.getElementById("createInvitationButton")?.addEventListener("click", createNewInvitation);
    document.getElementById("invitationList")?.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-home-action]");
      if (!actionButton) return;
      if (actionButton.dataset.homeAction === "create") createNewInvitation();
      if (actionButton.dataset.homeAction === "delete") deleteInvitation(actionButton.dataset.invitationId);
    });
  }

  window.deleteInvitation = deleteInvitation;
  window.renderInvitationCards = renderInvitationCards;
  window.createNewInvitation = createNewInvitation;

  async function renderInvitation() {
    const id = getInvitationId();
    console.log("URL id recibido:", id);
    console.log("ID URL:", id);
    console.log("Todas las claves localStorage:", Object.keys(localStorage));

    let invitation = getInvitationById(id);
    console.log("Invitación encontrada:", invitation);
    debugInvitationFlow("renderInvitation lookup", {
      requestedId: id,
      foundId: invitation?.id,
      foundSlug: invitation?.slug,
      foundUrl: invitation?.url,
      foundTitle: invitation?.titulo,
      availableIds: getAvailableInvitationIds(),
      storageKey: CUSTOM_INVITATIONS_KEY
    });
    const detail = document.getElementById("invitationDetail");
    const form = document.getElementById("rsvpForm");
    const successMessage = document.getElementById("successMessage");
    const floatingRsvpButton = document.getElementById("floatingRsvpButton");

    if (!invitation) {
      console.warn("Invitacion no encontrada", {
        "ID solicitado": id,
        "Clave principal": CUSTOM_INVITATIONS_KEY,
        "Todas las claves localStorage": Object.keys(localStorage),
        "IDs disponibles": getAvailableInvitationIds()
      });
      detail.innerHTML = `
        <div class="empty-state">
          <h1>No se encontró invitación con id: ${escapeHtml(id || "")}</h1>
          <p>Revisa el enlace o vuelve al listado principal.</p>
        </div>
      `;
      document.getElementById("rsvp-section")?.classList.add("hidden");
      floatingRsvpButton?.classList.add("hidden");
      return;
    }

    invitation = await hydrateInvitationVisualAssets(invitation, id);
    console.log("ID usado:", id);
    console.log("visualCanvasImage en invitación:", !!invitation.visualCanvasImage);
    console.log("INVITACION PUBLICA:", invitation);
    console.log("IMAGEN FINAL:", getFinalInvitationImage(invitation) ? "OK" : "NO HAY IMAGEN");
    document.title = invitation.titulo;
    detail.classList.add("custom-event-panel");
    detail.innerHTML = `<iframe class="custom-invitation-iframe" title="${escapeHtml(invitation.titulo)}"></iframe>`;
    detail.querySelector("iframe").srcdoc = buildCustomInvitationDocument(invitation);

    floatingRsvpButton?.addEventListener("click", () => {
      document.querySelector("#rsvp-section")?.scrollIntoView({ behavior: "smooth" });
    });

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      try {
        await saveRsvp(invitation, {
          nombre: fieldValue(formData, "nombre"),
          telefono: fieldValue(formData, "telefono"),
          asiste: formData.get("asiste"),
          cantidad: (Number(formData.get("acompanantes")) || 0) + 1,
          acompanantes: (Number(formData.get("acompanantes")) || 0) + 1,
          mensaje: fieldValue(formData, "mensaje"),
          createdAt: new Date().toISOString()
        });
        form.reset();
        const yesInput = form.querySelector('input[name="asiste"][value="Si"], input[name="asiste"][value="Sí"]');
        if (yesInput) yesInput.checked = true;
        form.elements.acompanantes.value = 0;
        successMessage.textContent = "Confirmación guardada correctamente.";
      } catch (error) {
        console.error(error);
        successMessage.textContent = "No se pudo confirmar. Intenta nuevamente.";
      }
    });
  }

  async function renderAdminTable(invitationOrId) {
    const invitation = typeof invitationOrId === "object" ? invitationOrId : (getInvitationById(invitationOrId) || { id: invitationOrId });
    const table = document.getElementById("confirmationsTable");
    table.innerHTML = `<tr><td colspan="6" class="empty-row">Cargando confirmaciones...</td></tr>`;
    try {
      const confirmations = await fetchRemoteRsvps(invitation);
      const totalPeople = confirmations.reduce((sum, item) => sum + (Number(item.cantidad || item.personas || item.acompanantes) || 1), 0);

      document.getElementById("totalResponses").textContent = confirmations.length;
      document.getElementById("totalAttending").textContent = confirmations.length;
      document.getElementById("totalGuests").textContent = totalPeople;

      table.innerHTML = confirmations.length ? confirmations.map((item) => {
        const cantidad = Number(item.cantidad || item.personas || item.acompanantes) || 1;
        return `
          <tr>
            <td>${escapeHtml(item.nombre || item.name || "")}</td>
            <td>${escapeHtml(item.telefono || item.phone || "")}</td>
            <td>Confirmado</td>
            <td>${escapeHtml(cantidad)}</td>
            <td>${escapeHtml(item.mensaje || "")}</td>
            <td>${item.fecha ? new Date(item.fecha).toLocaleString("es-PY") : ""}</td>
          </tr>
        `;
      }).join("") : `<tr><td colspan="6" class="empty-row">Todavía no hay confirmaciones.</td></tr>`;
    } catch (error) {
      console.error(error);
      document.getElementById("totalResponses").textContent = "0";
      document.getElementById("totalAttending").textContent = "0";
      document.getElementById("totalGuests").textContent = "0";
      table.innerHTML = `<tr><td colspan="6" class="empty-row">No se pudieron leer los confirmados. Revisa Apps Script o permisos.</td></tr>`;
    }
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
    const publicLink = getPublicInvitationUrl(invitation);
    const copyPublicLinkButton = document.getElementById("copyPublicLinkButton");
    document.getElementById("adminPublicUrl").textContent = publicLink;
    const viewInvitationLink = document.getElementById("viewInvitationLink");
    if (viewInvitationLink) viewInvitationLink.href = getPublicInvitationUrl(invitation);
    initShareSection(invitation);

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
      renderAdminTable(invitation);
    });

    document.getElementById("clearConfirmations").addEventListener("click", () => {
      alert("Las confirmaciones se guardan en Google Sheets. Borralas desde la hoja de calculo o Apps Script.");
      renderAdminTable(invitation);
    });

    copyPublicLinkButton.addEventListener("click", async () => {
      try {
        await copyPublicUrl(invitation);
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
      googleScriptUrl: fieldValue(formData, "googleScriptUrl"),
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
      const savedInvitation = saveCustomInvitation(invitation);
      debugInvitationFlow("renderCreate submit", {
        formId: invitation.id,
        formSlug: invitation.slug,
        savedId: savedInvitation.id,
        savedSlug: savedInvitation.slug,
        savedUrl: savedInvitation.url,
        publicUrl: getPublicInvitationUrl(savedInvitation)
      });
      message.className = "success-message";
      message.innerHTML = `Invitacion guardada. <a href="${getPublicInvitationUrl(savedInvitation)}">Ver invitacion</a>`;
    });
  }

  function getProfessionalFormData() {
    const form = document.getElementById("professionalEditorForm");
    const formData = new FormData(form);
    const fields = Object.fromEntries(formData.entries());
    const existingInvitation = activeEditorInvitation || {};
    const id = existingInvitation.id || generateSlug(fields.id || `inv-${Date.now()}`);
    const slug = generateSlug(fields.slug || existingInvitation.slug || fields.titulo || id);
    const design = {
      primaryColor: fields.primaryColor || DEFAULT_DESIGN.primaryColor,
      secondaryColor: fields.secondaryColor || DEFAULT_DESIGN.secondaryColor,
      textColor: fields.textColor || DEFAULT_DESIGN.textColor,
      buttonColor: fields.buttonColor || DEFAULT_DESIGN.buttonColor,
      mainImage: fieldValue(formData, "mainImage"),
      backgroundImage: fieldValue(formData, "backgroundImage"),
      uploadedImage: fieldValue(formData, "uploadedImage"),
      imageUrl: fieldValue(formData, "imageUrl"),
      animation: fields.animation || "none",
      typography: fields.typography || "classic"
    };
    const invitation = normalizeInvitation({
      ...existingInvitation,
      ...fields,
      id,
      slug,
      url: slug,
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
      googleScriptUrl: fieldValue(formData, "googleScriptUrl"),
      descripcion: fieldValue(formData, "descripcion"),
      adminPassword: fieldValue(formData, "adminPassword"),
      customHtml: rawFieldValue(formData, "customHtml"),
      customCss: rawFieldValue(formData, "customCss"),
      customJs: rawFieldValue(formData, "customJs"),
      visualCanvasImage: getVisualCanvasImageForInvitation(existingInvitation),
      visualTemplateImage: getVisualTemplateImageForInvitation(existingInvitation),
      birthdayPhotoImage: getBirthdayPhotoImageForInvitation(existingInvitation),
      visualDesign: getVisualDesignForInvitation(existingInvitation),
      design
    });
    invitation.imagen = getInvitationImage(invitation);
    console.log("Campos guardados:", fields);
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
    if (form.elements.googleScriptUrl) form.elements.googleScriptUrl.value = invitation.googleScriptUrl || invitation.sheetEndpoint || "";
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
    const slug = getSlugFromFormData(new FormData(form), activeEditorInvitation?.slug || activeEditorInvitation?.id || "");
    output.textContent = slug ? getPublicInvitationUrl({ ...(activeEditorInvitation || {}), slug }) : "invitacion.html?id=";
  }

  function updatePreview() {
    if (page !== "editor") return;
    const invitation = getProfessionalFormData();
    updateEditorPublicUrl();
    document.getElementById("previewTitle").textContent = invitation.titulo || "Invitacion";
    document.getElementById("livePreviewFrame").srcdoc = buildCustomInvitationDocument(invitation);
  }

  function syncActiveEditorCoverDesign() {
    if (!activeEditorInvitation) return;
    const invitation = getProfessionalFormData();
    activeEditorInvitation = {
      ...activeEditorInvitation,
      ...invitation,
      design: invitation.design,
      imagen: invitation.imagen
    };
    updatePreview();
  }

  function saveEditorDraftFromForm() {
    if (!activeEditorInvitation) return;
    const invitation = getProfessionalFormData();
    activeEditorInvitation = {
      ...activeEditorInvitation,
      ...invitation
    };
    if (validateSlug(invitation.slug) && isSlugAvailable(invitation.slug, activeEditorInvitation.id)) {
      activeEditorInvitation = saveCustomInvitation(invitation);
    }
  }

  function scheduleEditorAutosave() {
    clearTimeout(editorAutosaveTimer);
    editorAutosaveTimer = setTimeout(saveEditorDraftFromForm, 450);
  }
  function saveInvitation(event) {
    if (event) event.preventDefault();
    const message = document.getElementById("editorMessage");

    try {
      const existingInvitation = activeEditorInvitation;
      const invitation = attachVisualDesignToInvitation(getProfessionalFormData());
      if (!validateSlug(invitation.slug)) {
        message.className = "error-message";
        message.textContent = "La URL personalizada solo puede usar letras minusculas, numeros y guiones.";
        return;
      }
      if (!isSlugAvailable(invitation.slug, existingInvitation?.id)) {
        message.className = "error-message";
        message.textContent = "Ya existe una invitacion con esa URL personalizada.";
        return;
      }
      activeEditorInvitation = saveCustomInvitation({
        ...existingInvitation,
        ...invitation,
        id: existingInvitation?.id || invitation.id,
        slug: invitation.slug
      });
      const publicUrl = getPublicInvitationUrl(activeEditorInvitation);
      console.log("Invitación final guardada:", activeEditorInvitation);
      console.log("URL pública:", publicUrl);
      debugInvitationFlow("saveInvitation editor", {
        savedId: activeEditorInvitation.id,
        savedSlug: activeEditorInvitation.slug,
        savedUrl: activeEditorInvitation.url,
        publicUrl
      });
      document.getElementById("professionalEditorForm").elements.id.value = activeEditorInvitation.id;
      document.getElementById("professionalEditorForm").elements.slug.value = activeEditorInvitation.slug;
      message.className = "success-message";
      message.textContent = "Cambios guardados correctamente.";
      window.history.replaceState(null, "", buildUrl("editor.html", { id: activeEditorInvitation.id }));
      initShareSection(activeEditorInvitation);
      updatePreview();
    } catch (error) {
      console.error("No se pudo guardar la invitacion", error);
      message.className = "error-message";
      message.textContent = "No se pudo guardar. Revisa el tamaño de las imagenes o intenta exportar el JSON.";
    }
  }

  function duplicateInvitation() {
    const invitation = attachVisualDesignToInvitation(getProfessionalFormData());
    const copyId = normalizeId(`${invitation.id}-copia-${Date.now().toString().slice(-5)}`);
    const copy = {
      ...invitation,
      id: copyId,
      slug: copyId,
      titulo: `${invitation.titulo} (Copia)`
    };
    saveCustomInvitation(copy);
    if (copy.visualTemplateImage) persistVisualTemplateImage(copy, copy.visualTemplateImage);
    if (copy.birthdayPhotoImage) persistBirthdayPhotoImage(copy, copy.birthdayPhotoImage);
    if (copy.visualDesign) persistVisualDesign(copy, copy.visualDesign);
    if (copy.visualCanvasImage) persistVisualCanvasImage(copy, copy.visualCanvasImage);
    window.location.href = buildUrl("editor.html", { id: copy.id });
  }

  function deleteInvitation(id = null) {
    if (id) {
      if (deleteInvitationRecord(id)) renderInvitationCards();
      return;
    }

    const invitation = getProfessionalFormData();
    if (!deleteInvitationRecord(invitation.id, "¿Está seguro?")) return;
    window.location.href = "index.html";
  }

  function viewAsGuest() {
    if (activeEditorInvitation) {
      const invitation = attachVisualDesignToInvitation(getProfessionalFormData());
      const message = document.getElementById("editorMessage");
      if (!validateSlug(invitation.slug) || !isSlugAvailable(invitation.slug, activeEditorInvitation.id)) {
        if (message) {
          message.className = "error-message";
          message.textContent = "Revisa la URL personalizada antes de abrir la invitacion.";
        }
        return;
      }
      activeEditorInvitation = saveCustomInvitation({
        ...activeEditorInvitation,
        ...invitation,
        id: activeEditorInvitation.id,
        slug: invitation.slug
      });
    }
    const savedId = activeEditorInvitation?.id;
    const publicUrl = getPublicInvitationUrl(activeEditorInvitation || savedId);
    debugInvitationFlow("viewAsGuest", {
      savedId,
      savedSlug: activeEditorInvitation?.slug,
      savedUrl: activeEditorInvitation?.url,
      publicUrl
    });
    console.log("URL pública:", publicUrl);
    window.open(publicUrl, "_blank", "noopener");
  }

  function exportInvitation() {
    const blob = new Blob([JSON.stringify(attachVisualDesignToInvitation(getProfessionalFormData()), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "invitacion.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadTextFile(filename, content, type = "text/html") {
    const blob = new Blob([content], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function getExportedInvitationImage(invitation) {
    if (visualEditorCanvas) {
      visualEditorCanvas.discardActiveObject();
      visualEditorCanvas.renderAll();
      return visualEditorCanvas.toDataURL({
        format: "png",
        quality: 1,
        multiplier: 1
      });
    }
    const canvasImage = invitation.visualCanvasImage || getVisualCanvasImageForInvitation(invitation);
    return canvasImage || getFinalInvitationImage(invitation);
  }

  function buildStandaloneInvitationHtml(invitation, finalImage = null) {
    const design = { ...DEFAULT_DESIGN, ...(invitation.design || {}) };
    finalImage = finalImage || getExportedInvitationImage(invitation);
    const customHtml = stripStandaloneUnsafeMarkup(replaceInvitationVariables(invitation.customHtml || "", invitation));
    const fallbackContent = `
      <div class="generated-content invitation-content">
        <p class="generated-kicker">${escapeHtml(invitation.tipo || "Evento")}</p>
        <h1>${escapeHtml(invitation.titulo || invitation.nombre || "Invitacion")}</h1>
        <p class="generated-host">${escapeHtml(invitation.anfitrion || invitation.nombre || "")}</p>
        <div class="generated-details">
          ${invitation.fecha ? `<span>${formatDate(invitation.fecha)}</span>` : ""}
          ${invitation.hora ? `<span>${escapeHtml(invitation.hora)}</span>` : ""}
          ${invitation.lugar ? `<span>${escapeHtml(invitation.lugar)}</span>` : ""}
        </div>
        ${invitation.edad ? `<p class="generated-host">${escapeHtml(invitation.edad)}</p>` : ""}
        ${invitation.direccion ? `<p class="generated-address">${escapeHtml(invitation.direccion)}</p>` : ""}
        ${invitation.descripcion ? `<p class="generated-address">${escapeHtml(invitation.descripcion)}</p>` : ""}
      </div>`;
    const contentHtml = customHtml || fallbackContent;
    const css = replaceInvitationVariables(invitation.customCss || "", invitation);
    const js = replaceInvitationVariables(invitation.customJs || "", invitation);
    const animationClass = design.animation && design.animation !== "none" ? ` animation-${design.animation}` : "";
    const effectLayers = animationClass
      ? `<div class="magic-overlay"></div><div class="sparkles-layer" data-sparkles-layer></div><div class="shine-layer"></div>`
      : "";
    const googleScriptUrl = DEFAULT_GOOGLE_SCRIPT_URL;
    const invitationKey = invitation.slug || invitation.id || "invitacion";
    const adminPassword = invitation.adminPassword || "";
    const exportedData = JSON.stringify({
      id: invitation.id,
      slug: invitation.slug,
      titulo: invitation.titulo,
      nombre: invitation.nombre,
      edad: invitation.edad,
      fecha: invitation.fecha,
      hora: invitation.hora,
      lugar: invitation.lugar,
      direccion: invitation.direccion,
      telefono: invitation.telefono,
      descripcion: invitation.descripcion
    }).replace(/<\/script/gi, "<\\/script");

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(invitation.titulo || invitation.nombre || "Invitacion")}</title>
  <style>${baseDocumentStyles()}</style>
  <style>
    html, body { min-height: 100%; overflow-x: hidden; overflow-y: auto; background: #170016; }
    body { margin: 0; min-height: 100vh; padding: 0; overflow-x: hidden; overflow-y: auto; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    .public-invitation-page { width: 100%; min-height: 100vh; display: grid; gap: 18px; justify-items: center; padding: 32px 14px 60px; background: #170016; }
    .invitation-preview { width: min(92vw, 430px); margin: 0 auto 36px; }
    #custom-invitation-root { width: 100%; height: auto; overflow: visible; }
    .generated-invitation, .invitation-card { position: relative; width: 100%; aspect-ratio: 9 / 16; height: auto; min-height: 0; overflow: hidden; padding: 0; border-radius: 18px; background: #fff; box-shadow: 0 28px 90px rgba(0,0,0,.34); }
    .template-layer { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; display: block; border-radius: inherit; z-index: 1; background: #fff; }
    .custom-html-layer { pointer-events: auto; z-index: 10; }
    .rsvp-actions, .host-section { width: min(92vw, 430px); margin: 0 auto; }
    .rsvp-actions { display: grid; gap: 10px; margin-bottom: 0; }
    .rsvp-section { width: min(92vw, 430px); margin: 90px auto 40px; position: static; }
    .rsvp-section, .host-section { padding: 18px; border-radius: 8px; background: #fff; color: #26302f; box-shadow: 0 18px 50px rgba(0,0,0,.18); }
    .rsvp-title, .scroll-rsvp-title { margin: 56px auto 28px; text-align: center; }
    .rsvp-section h2, .host-section h2 { margin: 0 0 12px; font-size: 1.15rem; }
    .export-rsvp-form { display: grid; gap: 10px; }
    .export-rsvp-form label { display: grid; gap: 5px; font-size: .88rem; font-weight: 800; }
    .export-rsvp-form input { width: 100%; min-height: 44px; border: 1px solid rgba(38,48,47,.18); border-radius: 8px; padding: 0 12px; font: inherit; }
    .export-rsvp-button, .export-host-button, #scrollToRsvpButton { display: inline-flex; align-items: center; justify-content: center; width: 100%; min-height: 46px; padding: 0 18px; border: 0; border-radius: 999px; background: var(--inv-button); color: #fff; font: inherit; font-weight: 900; text-decoration: none; box-shadow: 0 14px 34px rgba(0,0,0,.14); cursor: pointer; }
    .export-host-button { background: #26302f; }
    .export-rsvp-status { min-height: 20px; margin: 8px 0 0; color: #3f7d72; font-weight: 800; }
    .export-confirmations { display: grid; gap: 8px; margin-top: 12px; }
    .export-confirmation-item { display: flex; justify-content: space-between; gap: 10px; border-bottom: 1px solid rgba(38,48,47,.12); padding-bottom: 8px; }
    .export-confirmation-total { margin: 0 0 12px; font-weight: 900; }
    @media (max-width: 600px) { .public-invitation-page { padding-top: 72px; } .invitation-preview { width: min(92vw, 430px); margin-bottom: 36px; } .generated-invitation, .invitation-card { border-radius: 18px; } .rsvp-actions, .rsvp-section, .host-section { width: min(92vw, 430px); } .rsvp-section { margin-top: 90px; } }
  </style>
  <style>${css}</style>
  <style id="export-mobile-layout-fix">
    html, body { margin: 0 !important; min-height: 100svh !important; height: auto !important; overflow-x: hidden !important; overflow-y: auto !important; background: #170016 !important; }
    body { display: block !important; place-items: initial !important; padding: 0 !important; }
    .public-invitation-page { width: 100% !important; min-height: 100svh !important; display: block !important; padding: 0 14px 64px !important; background: #170016 !important; overflow: visible !important; }
    .invitation-preview { width: 100% !important; min-height: 100svh !important; margin: 0 auto 28px !important; padding: max(34px, env(safe-area-inset-top)) 0 22px !important; display: flex !important; align-items: center !important; justify-content: center !important; overflow: visible !important; }
    #custom-invitation-root { width: min(92vw, 430px, calc((100svh - 96px) * 9 / 16)) !important; height: auto !important; overflow: visible !important; position: relative !important; margin: 0 auto !important; }
    .generated-invitation.invitation-card { width: 100% !important; aspect-ratio: 9 / 16 !important; height: auto !important; min-height: 0 !important; max-height: calc(100svh - 96px) !important; overflow: hidden !important; border-radius: 18px !important; padding: 0 !important; position: relative !important; display: block !important; }
    .template-layer { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; object-fit: contain !important; display: block !important; }
    .rsvp-actions { width: min(92vw, 430px) !important; margin: 0 auto 96px !important; position: static !important; display: grid !important; }
    .rsvp-section { width: min(92vw, 430px) !important; margin: 0 auto 40px !important; position: static !important; }
    .host-section { width: min(92vw, 430px) !important; margin: 0 auto !important; position: static !important; }
    .rsvp-title, .scroll-rsvp-title { margin: 56px auto 28px !important; text-align: center !important; }
    @media (max-width: 600px) { .invitation-preview { padding-top: max(64px, env(safe-area-inset-top)) !important; } #custom-invitation-root { width: min(90vw, calc((100svh - 118px) * 9 / 16)) !important; } .generated-invitation.invitation-card { max-height: calc(100svh - 118px) !important; } }
  </style>
  <style>
    html, body { margin: 0 !important; min-height: 100vh !important; height: auto !important; overflow-x: hidden !important; overflow-y: auto !important; background: #170016 !important; }
    body { display: block !important; padding: 0 !important; }
    .public-invitation-page { width: 100% !important; min-height: 100vh !important; display: grid !important; gap: 18px !important; justify-items: center !important; padding: 32px 14px 60px !important; background: #170016 !important; }
    .invitation-preview { width: min(92vw, 430px) !important; margin: 0 auto 36px !important; }
    #custom-invitation-root { width: 100% !important; height: auto !important; overflow: visible !important; }
    .generated-invitation.invitation-card { width: 100% !important; aspect-ratio: 9 / 16 !important; height: auto !important; min-height: 0 !important; overflow: hidden !important; border-radius: 18px !important; padding: 0 !important; }
    .template-layer { width: 100% !important; height: 100% !important; object-fit: contain !important; display: block !important; }
    .rsvp-actions { width: min(92vw, 430px) !important; margin: 0 auto !important; position: static !important; }
    .rsvp-section { width: min(92vw, 430px) !important; margin: 90px auto 40px !important; position: static !important; }
    .host-section { width: min(92vw, 430px) !important; margin: 0 auto !important; position: static !important; }
    .rsvp-title, .scroll-rsvp-title { margin: 56px auto 28px !important; text-align: center !important; }
    @media (max-width: 600px) { .public-invitation-page { padding-top: 72px !important; } }
  </style>
</head>
<body>
  <main class="public-invitation-page">
    <section class="invitation-preview">
      <div id="custom-invitation-root">
        <div class="generated-invitation invitation-card typography-${escapeHtml(design.typography)}${animationClass}" style="--inv-primary:${escapeHtml(design.primaryColor)}; --inv-secondary:${escapeHtml(design.secondaryColor)}; --inv-text:${escapeHtml(design.textColor)}; --inv-button:${escapeHtml(design.buttonColor)};">
          ${finalImage ? `<img class="template-layer" src="${escapeHtml(finalImage)}" alt="Invitacion">` : ""}
          ${effectLayers}
          <div class="custom-html-layer">${contentHtml}</div>
        </div>
      </div>
    </section>
    <section class="rsvp-actions">
      <button id="scrollToRsvpButton" type="button">Confirmar asistencia</button>
    </section>
    <section id="rsvpSection" class="rsvp-section" aria-label="Confirmar asistencia">
      <h2>Confirmar asistencia</h2>
      <form class="export-rsvp-form" data-rsvp-form>
        <label>Nombre<input type="text" name="nombre" autocomplete="name" required></label>
        <label>Cantidad de personas<input type="number" name="cantidad" min="1" value="1" required></label>
        <label>Telefono opcional<input type="tel" name="telefono" autocomplete="tel"></label>
        <button class="export-rsvp-button" type="submit">Enviar confirmacion</button>
        <p class="export-rsvp-status" data-rsvp-status role="status"></p>
      </form>
    </section>
    <section class="host-section" aria-label="Area del anfitrion">
      <h2>Area del anfitrion</h2>
      <button class="export-host-button" type="button" data-host-button>&#128274; Ver confirmados</button>
      <div class="export-confirmations" data-confirmations hidden></div>
    </section>
  </main>
  <script>
    const GOOGLE_SCRIPT_URL = ${JSON.stringify(googleScriptUrl)};
    const INVITATION_ID = ${JSON.stringify(invitationKey)};
    const ADMIN_PASSWORD = ${JSON.stringify(adminPassword)};
    window.INVITACION_EXPORTADA = ${exportedData};
    document.querySelectorAll(".sparkles-layer").forEach(function (layer) {
      if (layer.dataset.ready === "true") return;
      layer.dataset.ready = "true";
      for (var index = 0; index < 28; index += 1) {
        var sparkle = document.createElement("span");
        sparkle.className = "sparkle";
        sparkle.style.left = Math.round(Math.random() * 100) + "%";
        sparkle.style.top = Math.round(Math.random() * 100) + "%";
        sparkle.style.animationDelay = (Math.random() * 3).toFixed(2) + "s";
        sparkle.style.animationDuration = (2.4 + Math.random() * 2.8).toFixed(2) + "s";
        layer.appendChild(sparkle);
      }
    });
    document.getElementById("scrollToRsvpButton")?.addEventListener("click", function () {
      document.getElementById("rsvpSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    function setRsvpStatus(message, isError) {
      var status = document.querySelector("[data-rsvp-status]");
      if (!status) return;
      status.textContent = message || "";
      status.style.color = isError ? "#b23b3b" : "#3f7d72";
    }

    async function loadConfirmations() {
      var container = document.querySelector("[data-confirmations]");
      if (!container) return;
      container.hidden = false;
      container.innerHTML = "Cargando confirmados...";
      try {
        var url = GOOGLE_SCRIPT_URL + "?id=" + encodeURIComponent(INVITATION_ID);
        var response = await fetch(url);
        if (!response.ok) throw new Error("HTTP " + response.status);
        var data = await response.json();
        console.log(data);
        var rows = Array.isArray(data) ? data : (Array.isArray(data.invitados) ? data.invitados : (Array.isArray(data.confirmados) ? data.confirmados : []));
        var total = typeof data.total === "number" ? data.total : rows.reduce(function (sum, item) { return sum + (Number(item.cantidad || item.personas || item.acompanantes) || 1); }, 0);
        var confirmedCount = typeof data.confirmados === "number" ? data.confirmados : rows.length;
        if (data.success === false) throw new Error(data.error || "Respuesta sin exito de Apps Script");
        container.innerHTML = '<p class="export-confirmation-total">Total: ' + total + '</p><p class="export-confirmation-total">Confirmados: ' + confirmedCount + '</p>' + (rows.length ? rows.map(function (item) {
          var nombre = item.nombre || item.name || "Sin nombre";
          var cantidad = Number(item.cantidad || item.personas || item.acompanantes) || 1;
          var telefono = item.telefono || item.phone || "";
          return '<div class="export-confirmation-item"><span>' + nombre + (telefono ? ' - ' + telefono : '') + '</span><strong>' + cantidad + '</strong></div>';
        }).join("") : "Aún no hay confirmaciones.");
      } catch (error) {
        console.error(error);
        container.innerHTML = "No se pudieron leer los confirmados. Revisa Apps Script o permisos.";
      }
    }

    document.querySelector("[data-rsvp-form]")?.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!GOOGLE_SCRIPT_URL) {
        setRsvpStatus("No se configuro la URL de Google Apps Script.", true);
        return;
      }
      var sourceForm = event.currentTarget;
      var sourceData = new FormData(sourceForm);
      var nombre = String(sourceData.get("nombre") || "").trim();
      var cantidad = Number(sourceData.get("cantidad"));
      var telefono = String(sourceData.get("telefono") || "").trim();
      if (!nombre) {
        setRsvpStatus("Ingresa tu nombre.", true);
        return;
      }
      if (!cantidad || cantidad <= 0) {
        setRsvpStatus("Ingresa una cantidad mayor a 0.", true);
        return;
      }
      var formData = new FormData();
      formData.append("invitacionId", INVITATION_ID);
      formData.append("nombre", nombre);
      formData.append("cantidad", String(cantidad));
      formData.append("telefono", telefono);
      try {
        setRsvpStatus("Guardando confirmacion...", false);
        var response = await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          body: formData
        });
        if (!response.ok) console.warn("Respuesta POST Apps Script:", response.status);
        sourceForm.reset();
        sourceForm.elements.cantidad.value = 1;
        setRsvpStatus("Gracias por confirmar tu asistencia", false);
        var confirmations = document.querySelector("[data-confirmations]");
        if (confirmations && !confirmations.hidden) await loadConfirmations();
      } catch (error) {
        console.error(error);
        setRsvpStatus("No se pudo confirmar. Intenta nuevamente.", true);
      }
    });

    document.querySelector("[data-host-button]")?.addEventListener("click", async function () {
      if (!GOOGLE_SCRIPT_URL) {
        alert("No se configuro la URL de Google Apps Script.");
        return;
      }
      var password = prompt("Contrasena del anfitrion");
      if (password !== ADMIN_PASSWORD) {
        alert("Contrasena incorrecta.");
        return;
      }
      await loadConfirmations();
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

  function exportPublicHtml() {
    console.log("Exportando HTML publico...");

    try {
      const invitation = getCurrentInvitationObject();
      if (!invitation) {
        alert("No se encontró la invitación actual.");
        return;
      }

      let finalImage = invitation.visualCanvasImage || getVisualCanvasImageForInvitation(invitation);
      const canvas = window.fabricCanvas || window.visualCanvas || visualEditorCanvas;
      if (canvas) {
        if (canvas.discardActiveObject) canvas.discardActiveObject();
        if (canvas.renderAll) canvas.renderAll();
        finalImage = canvas.toDataURL({
          format: "png",
          quality: 1,
          multiplier: 1
        });
      }

      if (!finalImage) {
        alert("Primero guarda o genera la plantilla visual.");
        return;
      }

      const exportInvitationData = attachVisualDesignToInvitation({
        ...invitation,
        visualCanvasImage: finalImage
      });
      const html = buildStandaloneInvitationHtml(exportInvitationData, finalImage);
      if (/assets\/js\/(app|data)\.js|No se encontr[oó] invitaci[oó]n con id|localStorage\.getItem/.test(html)) {
        console.warn("El HTML exportado contiene referencias no standalone; revisa customHtml/customJs.");
      }
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportInvitationData.slug || exportInvitationData.id || "invitacion"}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const message = document.getElementById("editorMessage");
      if (message) {
        message.className = "success-message";
        message.textContent = "HTML publico exportado correctamente.";
      }
    } catch (error) {
      console.error("Error al exportar HTML publico", error);
      alert(`No se pudo exportar el HTML: ${error.message || error}`);
    }
  }

  const exportPublicHtmlInvitation = exportPublicHtml;
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
        if (activeEditorInvitation.visualTemplateImage) persistVisualTemplateImage(activeEditorInvitation, activeEditorInvitation.visualTemplateImage);
        if (activeEditorInvitation.birthdayPhotoImage) persistBirthdayPhotoImage(activeEditorInvitation, activeEditorInvitation.birthdayPhotoImage);
        if (activeEditorInvitation.visualDesign) persistVisualDesign(activeEditorInvitation, activeEditorInvitation.visualDesign);
        if (activeEditorInvitation.visualCanvasImage) persistVisualCanvasImage(activeEditorInvitation, activeEditorInvitation.visualCanvasImage);
        fillProfessionalEditor(activeEditorInvitation);
        if (visualEditorCanvas && activeEditorInvitation.visualDesign) loadVisualDesign();
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
  window.exportPublicHtml = exportPublicHtml;
  window.exportPublicHtmlInvitation = exportPublicHtmlInvitation;
  window.importInvitation = importInvitation;
  window.viewAsGuest = viewAsGuest;
  let visualEditorCanvas = null;
  let visualPreviewSyncTimer = null;
  let editorAutosaveTimer = null;
  const VISUAL_CANVAS_WIDTH = 720;
  const VISUAL_CANVAS_HEIGHT = 1280;

  function setVisualEditorStatus(message) {
    const status = document.getElementById("visualEditorStatus");
    if (status) status.textContent = message || "";
  }



  function getSerializedVisualDesign() {
    if (visualEditorCanvas) {
      return visualEditorCanvas.toJSON(["visualRole", "selectable", "evented", "lockMovementX", "lockMovementY", "lockRotation", "lockScalingX", "lockScalingY"]);
    }
    return activeEditorInvitation ? getVisualDesignForInvitation(activeEditorInvitation) : null;
  }

  function getFabricDesignJson(visualDesign) {
    if (!visualDesign) return "";
    return typeof visualDesign === "string" ? visualDesign : JSON.stringify(visualDesign);
  }

  function getVisualCanvasImageDataUrl() {
    if (visualEditorCanvas) {
      return visualEditorCanvas.toDataURL({
        format: "jpeg",
        quality: 0.86,
        multiplier: 1
      });
    }
    return activeEditorInvitation ? getVisualCanvasImageForInvitation(activeEditorInvitation) : "";
  }

  function attachVisualDesignToInvitation(invitation) {
    if (!invitation) return invitation;
    const visualDesign = getSerializedVisualDesign();
    const visualCanvasImage = getVisualCanvasImageDataUrl();
    const nextInvitation = attachVisualSourcesToInvitation({
      ...invitation,
      visualDesign: visualDesign || invitation.visualDesign || null,
      visualCanvasImage: visualCanvasImage || invitation.visualCanvasImage || ""
    });
    return nextInvitation;
  }
  function syncVisualEditorToPreview() {
    if (!visualEditorCanvas || !activeEditorInvitation) return;
    const visualDesign = getSerializedVisualDesign();
    const pngDataUrl = getVisualCanvasImageDataUrl();
    activeEditorInvitation = attachVisualSourcesToInvitation({
      ...activeEditorInvitation,
      visualDesign,
      visualCanvasImage: pngDataUrl
    });
    const formInvitation = getProfessionalFormData();
    const invitationWithAliases = attachVisualSourcesToInvitation({
      ...formInvitation,
      ...activeEditorInvitation,
      visualDesign,
      visualCanvasImage: pngDataUrl
    });
    activeEditorInvitation = saveCustomInvitation(invitationWithAliases);
    forceSaveVisualCanvasImage();
    updatePreview();
  }

  function scheduleVisualPreviewSync() {
    clearTimeout(visualPreviewSyncTimer);
    visualPreviewSyncTimer = setTimeout(syncVisualEditorToPreview, 300);
  }
  function readImageFile(file, callback) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      compressImageDataUrl(reader.result, callback, {
        maxWidth: VISUAL_CANVAS_WIDTH * 2,
        maxHeight: VISUAL_CANVAS_HEIGHT * 2,
        quality: 0.84
      });
    };
    reader.readAsDataURL(file);
  }

  function markBackgroundTemplate(template) {
    template.set({
      visualRole: "backgroundTemplate",
      selectable: false,
      evented: false,
      lockMovementX: true,
      lockMovementY: true,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
      hasControls: false,
      hasBorders: false,
      originX: "left",
      originY: "top",
      left: 0,
      top: 0
    });
  }

  function scaleImageToCoverCanvas(image) {
    const scale = Math.max(VISUAL_CANVAS_WIDTH / image.width, VISUAL_CANVAS_HEIGHT / image.height);
    image.scale(scale);
    image.set({
      left: (VISUAL_CANVAS_WIDTH - image.getScaledWidth()) / 2,
      top: (VISUAL_CANVAS_HEIGHT - image.getScaledHeight()) / 2
    });
  }

  function getEditorInvitationWithVisualAsset(assetName, dataUrl) {
    const invitation = getProfessionalFormData();
    const nextInvitation = {
      ...invitation,
      [assetName]: dataUrl
    };
    if (activeEditorInvitation) {
      activeEditorInvitation = {
        ...activeEditorInvitation,
        ...nextInvitation,
        [assetName]: dataUrl
      };
    }
    return nextInvitation;
  }

  function saveVisualTemplateSource(dataUrl) {
    if (!dataUrl) return;
    const invitation = getEditorInvitationWithVisualAsset("visualTemplateImage", dataUrl);
    persistVisualTemplateImage(invitation, dataUrl);
    updateInvitationInLocalStorage(invitation);
  }

  function saveBirthdayPhotoSource(dataUrl) {
    if (!dataUrl) return;
    const invitation = getEditorInvitationWithVisualAsset("birthdayPhotoImage", dataUrl);
    persistBirthdayPhotoImage(invitation, dataUrl);
    updateInvitationInLocalStorage(invitation);
  }
  function loadBackgroundTemplate(source) {
    if (!visualEditorCanvas || !source || !window.fabric) return;
    saveVisualTemplateSource(source);
    window.fabric.Image.fromURL(source, (template) => {
      visualEditorCanvas.getObjects()
        .filter((object) => object.visualRole === "backgroundTemplate")
        .forEach((object) => visualEditorCanvas.remove(object));
      scaleImageToCoverCanvas(template);
      markBackgroundTemplate(template);
      visualEditorCanvas.add(template);
      visualEditorCanvas.sendToBack(template);
      visualEditorCanvas.discardActiveObject();
      visualEditorCanvas.renderAll();
      syncVisualEditorToPreview();
      forceSaveVisualCanvasImage();
      setVisualEditorStatus("Plantilla cargada.");
    });
  }

  function uploadBirthdayPhoto(source) {
    if (!visualEditorCanvas || !source || !window.fabric) return;
    saveBirthdayPhotoSource(source);
    window.fabric.Image.fromURL(source, (photo) => {
      const scale = Math.min(360 / photo.width, 480 / photo.height, 1);
      photo.set({
        visualRole: "birthdayPhoto",
        selectable: true,
        hasControls: true,
        hasBorders: true,
        left: VISUAL_CANVAS_WIDTH / 2,
        top: VISUAL_CANVAS_HEIGHT / 2,
        originX: "center",
        originY: "center",
        cornerStyle: "circle",
        transparentCorners: false
      });
      photo.scale(scale);
      visualEditorCanvas.add(photo);
      visualEditorCanvas.setActiveObject(photo);
      visualEditorCanvas.renderAll();
      syncVisualEditorToPreview();
      forceSaveVisualCanvasImage();
      setVisualEditorStatus("Foto agregada. Puedes moverla, rotarla o redimensionarla.");
    });
  }

  function saveVisualDesign() {
    if (!visualEditorCanvas || !activeEditorInvitation) return null;
    const jsonObject = visualEditorCanvas.toJSON(["visualRole", "selectable", "evented", "lockMovementX", "lockMovementY", "lockRotation", "lockScalingX", "lockScalingY"]);
    const json = JSON.stringify(jsonObject);
    const png = visualEditorCanvas.toDataURL({
      format: "jpeg",
      quality: 0.86,
      multiplier: 1
    });
    const formInvitation = getProfessionalFormData();
    const invitation = {
      ...formInvitation,
      visualDesign: jsonObject,
      visualCanvasImage: png,
      visualTemplateImage: getVisualTemplateImageForInvitation({ ...formInvitation, ...activeEditorInvitation }),
      birthdayPhotoImage: getBirthdayPhotoImageForInvitation({ ...formInvitation, ...activeEditorInvitation })
    };
    trySetStorageValue(getVisualDesignKey(invitation.id), json);
    trySetStorageValue(getVisualDesignKey(invitation.slug), json);
    if (invitation.visualTemplateImage) persistVisualTemplateImage(invitation, invitation.visualTemplateImage);
    if (invitation.birthdayPhotoImage) persistBirthdayPhotoImage(invitation, invitation.birthdayPhotoImage);
    persistVisualCanvasImage(invitation, png);
    persistVisualDesign(invitation, jsonObject);

    console.log("Guardando plantilla:", !!invitation.visualTemplateImage);
    console.log("Guardando foto:", !!invitation.birthdayPhotoImage);
    console.log("Guardando PNG final:", !!invitation.visualCanvasImage);
    console.log("Guardando JSON Fabric:", !!json);

    activeEditorInvitation = updateInvitationInLocalStorage(invitation) || saveCustomInvitation(invitation);
    updatePreview();
    setVisualEditorStatus("Diseño visual guardado.");
    return activeEditorInvitation;
  }

  function restoreVisualObjectBehavior() {
    if (!visualEditorCanvas) return;
    visualEditorCanvas.getObjects().forEach((object) => {
      if (object.visualRole === "backgroundTemplate") {
        markBackgroundTemplate(object);
        visualEditorCanvas.sendToBack(object);
      } else {
        object.set({
          selectable: true,
          hasControls: true,
          hasBorders: true
        });
      }
    });
    visualEditorCanvas.renderAll();
  }

  function loadVisualDesign() {
    if (!visualEditorCanvas || !activeEditorInvitation) return;
    const rawDesign = getFabricDesignJson(getVisualDesignForInvitation(activeEditorInvitation));
    const storedTemplate = getVisualTemplateImageForInvitation(activeEditorInvitation);
    const storedPhoto = getBirthdayPhotoImageForInvitation(activeEditorInvitation);
    const storedFinalImage = getVisualCanvasImageForInvitation(activeEditorInvitation);

    if (storedFinalImage) {
      activeEditorInvitation.visualCanvasImage = storedFinalImage;
      updatePreview();
    }

    if (rawDesign) {
      try {
        visualEditorCanvas.loadFromJSON(rawDesign, () => {
          restoreVisualObjectBehavior();
          syncVisualEditorToPreview();
          setVisualEditorStatus("Diseño visual cargado.");
        });
      } catch (error) {
        console.error("No se pudo cargar el diseño visual", error);
        setVisualEditorStatus("No se pudo cargar el diseño visual guardado.");
      }
      return;
    }

    if (storedTemplate) loadBackgroundTemplate(storedTemplate);
    if (storedPhoto) uploadBirthdayPhoto(storedPhoto);
  }

  function exportVisualPNG() {
    if (!visualEditorCanvas) return;
    visualEditorCanvas.discardActiveObject();
    visualEditorCanvas.renderAll();
    const link = document.createElement("a");
    link.href = visualEditorCanvas.toDataURL({ format: "png", multiplier: 1 });
    link.download = `${activeEditorInvitation?.id || "invitacion"}-visual.png`;
    link.click();
    setVisualEditorStatus("PNG exportado.");
  }

  function deleteSelectedObject() {
    if (!visualEditorCanvas) return;
    const selected = visualEditorCanvas.getActiveObject();
    if (!selected || selected.visualRole === "backgroundTemplate") return;
    if (selected.type === "activeSelection") {
      selected.getObjects().forEach((object) => {
        if (object.visualRole !== "backgroundTemplate") visualEditorCanvas.remove(object);
      });
      visualEditorCanvas.discardActiveObject();
    } else {
      visualEditorCanvas.remove(selected);
    }
    visualEditorCanvas.renderAll();
    syncVisualEditorToPreview();
    forceSaveVisualCanvasImage();
    setVisualEditorStatus("Elemento eliminado.");
  }

  function initVisualEditor() {
    const canvasElement = document.getElementById("visualInvitationCanvas");
    if (!canvasElement || !window.fabric || visualEditorCanvas) return;
    visualEditorCanvas = new window.fabric.Canvas(canvasElement, {
      width: VISUAL_CANVAS_WIDTH,
      height: VISUAL_CANVAS_HEIGHT,
      preserveObjectStacking: true,
      backgroundColor: "#ffffff"
    });
    window.fabricCanvas = visualEditorCanvas;
    window.visualCanvas = visualEditorCanvas;

    document.getElementById("visualTemplateInput")?.addEventListener("change", (event) => {
      readImageFile(event.target.files[0], loadBackgroundTemplate);
      event.target.value = "";
    });
    document.getElementById("visualPhotoInput")?.addEventListener("change", (event) => {
      readImageFile(event.target.files[0], uploadBirthdayPhoto);
      event.target.value = "";
    });
    document.getElementById("visualBringFrontButton")?.addEventListener("click", () => {
      const selected = visualEditorCanvas.getActiveObject();
      if (!selected || selected.visualRole === "backgroundTemplate") return;
      visualEditorCanvas.bringToFront(selected);
      visualEditorCanvas.renderAll();
      syncVisualEditorToPreview();
      forceSaveVisualCanvasImage();
    });
    document.getElementById("visualSendBackButton")?.addEventListener("click", () => {
      const selected = visualEditorCanvas.getActiveObject();
      if (!selected || selected.visualRole === "backgroundTemplate") return;
      visualEditorCanvas.sendBackwards(selected);
      visualEditorCanvas.getObjects()
        .filter((object) => object.visualRole === "backgroundTemplate")
        .forEach((object) => visualEditorCanvas.sendToBack(object));
      visualEditorCanvas.setActiveObject(selected);
      visualEditorCanvas.renderAll();
      syncVisualEditorToPreview();
      forceSaveVisualCanvasImage();
    });
    visualEditorCanvas.on("object:modified", scheduleVisualPreviewSync);
    visualEditorCanvas.on("object:moving", scheduleVisualPreviewSync);
    visualEditorCanvas.on("object:scaling", scheduleVisualPreviewSync);
    visualEditorCanvas.on("object:rotating", scheduleVisualPreviewSync);
    visualEditorCanvas.on("object:removed", scheduleVisualPreviewSync);
    visualEditorCanvas.on("object:added", scheduleVisualPreviewSync);

    document.getElementById("visualDeleteButton")?.addEventListener("click", deleteSelectedObject);
    document.getElementById("visualExportPngButton")?.addEventListener("click", exportVisualPNG);
    document.getElementById("visualSaveButton")?.addEventListener("click", saveVisualDesign);

    loadVisualDesign();
  }

  window.initVisualEditor = initVisualEditor;
  window.loadBackgroundTemplate = loadBackgroundTemplate;
  window.uploadBirthdayPhoto = uploadBirthdayPhoto;
  window.saveVisualDesign = saveVisualDesign;
  window.loadVisualDesign = loadVisualDesign;
  window.exportVisualPNG = exportVisualPNG;
  window.deleteSelectedObject = deleteSelectedObject;
  window.syncVisualEditorToPreview = syncVisualEditorToPreview;
  window.scheduleVisualPreviewSync = scheduleVisualPreviewSync;
  window.scheduleEditorAutosave = scheduleEditorAutosave;

  function renderEditor() {
    const urlId = new URLSearchParams(location.search).get("id");
    console.log("URL id recibido:", urlId);
    const invitation = findInvitationByIdOrSlug(urlId);
    console.log("Invitación editando:", invitation);
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
    initShareSection(activeEditorInvitation);
    updatePreview();
    initVisualEditor();

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
        await copyPublicUrl(invitation);
        button.textContent = "Enlace copiado";
      } catch (error) {
        button.textContent = getPublicInvitationUrl(invitation);
      }
      setTimeout(() => {
        button.textContent = "Copiar enlace publico";
      }, 1600);
    });
    document.getElementById("duplicateInvitationButton").addEventListener("click", duplicateInvitation);
    document.getElementById("deleteInvitationButton").addEventListener("click", deleteInvitation);
    document.getElementById("exportInvitationButton").addEventListener("click", exportInvitation);
    document.getElementById("exportPublicHtmlButton")?.addEventListener("click", exportPublicHtml);
    document.getElementById("importInvitationInput").addEventListener("change", (event) => importInvitation(event.target.files[0]));
    ["customHtml", "customCss", "customJs", "mainImage", "backgroundImage", "imageUrl", "uploadedImage"].forEach((fieldName) => {
      const field = form.elements[fieldName];
      if (!field) return;
      field.addEventListener("input", () => {
        syncActiveEditorCoverDesign();
        scheduleEditorAutosave();
      });
      field.addEventListener("change", () => {
        syncActiveEditorCoverDesign();
        scheduleEditorAutosave();
      });
    });
    document.getElementById("localImageInput").addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        form.elements.uploadedImage.value = reader.result;
        syncActiveEditorCoverDesign();
        scheduleEditorAutosave();
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

  cleanupLegacyImageStorage();

  if (page !== "invitation") initSidebar();

  if (page === "home") renderHome();
  if (page === "invitation") renderInvitation();
  if (page === "admin") renderAdmin();
  if (page === "create") renderCreate();
  if (page === "editor") renderEditor();
})();
