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

  const trySetStorageValue = (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`No se pudo guardar ${key} en localStorage`, error);
      return false;
    }
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
      telefono: invitation.telefono,
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

  function persistVisualDesign(invitation, visualDesign) {
    if (!invitation || !visualDesign) return;
    const serializedDesign = typeof visualDesign === "string" ? visualDesign : JSON.stringify(visualDesign);
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

  function setCustomInvitationsWithVisualFallback(invitations) {
    try {
      setStoredJson(CUSTOM_INVITATIONS_KEY, invitations);
      return;
    } catch (error) {
      console.warn("No se pudo guardar custom_invitations con imagenes embebidas. Se guardan respaldos visuales separados.", error);
      setStoredJson(CUSTOM_INVITATIONS_KEY, invitations.map((item) => ({ ...item, visualCanvasImage: "", visualDesign: null, visualTemplateImage: "", birthdayPhotoImage: "" })));
    }
  }

  function normalizeInvitation(invitation) {
    const slug = generateSlug(invitation.slug || invitation.id || invitation.url || invitation.titulo || invitation.nombre || `invitacion-${Date.now()}`);
    return {
      ...invitation,
      id: slug,
      slug,
      url: slug,
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
      visualCanvasImage: invitation.visualCanvasImage || localStorage.getItem(getVisualCanvasImageKey(slug)) || localStorage.getItem(getVisualCanvasImageKey(invitation.slug)) || localStorage.getItem(getVisualCanvasImageKey(invitation.id)) || "",
      visualTemplateImage: invitation.visualTemplateImage || localStorage.getItem(getVisualTemplateImageKey(slug)) || localStorage.getItem(getVisualTemplateImageKey(invitation.slug)) || localStorage.getItem(getVisualTemplateImageKey(invitation.id)) || "",
      birthdayPhotoImage: invitation.birthdayPhotoImage || localStorage.getItem(getBirthdayPhotoImageKey(slug)) || localStorage.getItem(getBirthdayPhotoImageKey(invitation.slug)) || localStorage.getItem(getBirthdayPhotoImageKey(invitation.id)) || "",
      visualDesign: invitation.visualDesign || getStoredJson(getVisualDesignKey(slug), null) || getStoredJson(getVisualDesignKey(invitation.slug), null) || getStoredJson(getVisualDesignKey(invitation.id), null),
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

  function getInvitationById(id) {
    const normalizedId = generateSlug(id);
    return getAllInvitations().find((invitation) => getInvitationLookupCandidates(normalizedId, invitation).includes(normalizedId));
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
    const matchingKey = keys.find((key) => normalizedCandidates.some((candidate) => key === `${prefix}${candidate}` || key.includes(candidate))) || keys[0];
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
    if (!validateSlug(normalizedSlug)) return false;
    return !getAllInvitations().some((invitation) => {
      const invitationSlug = invitation.slug || invitation.id || invitation.url;
      return invitationSlug === normalizedSlug && invitation.id !== currentId && invitationSlug !== currentId && invitation.url !== currentId;
    });
  }

  function saveCustomInvitation(invitation) {
    const deletedIds = getDeletedInvitationIds().filter((id) => id !== invitation.id);
    const customInvitations = getCustomInvitations();
    const normalizedInvitation = normalizeInvitation(invitation);

    if (normalizedInvitation.visualCanvasImage) {
      persistVisualCanvasImage(normalizedInvitation, normalizedInvitation.visualCanvasImage);
    }

    if (normalizedInvitation.visualDesign) {
      persistVisualDesign(normalizedInvitation, normalizedInvitation.visualDesign);
    }

    if (normalizedInvitation.visualTemplateImage) {
      persistVisualTemplateImage(normalizedInvitation, normalizedInvitation.visualTemplateImage);
    }

    if (normalizedInvitation.birthdayPhotoImage) {
      persistBirthdayPhotoImage(normalizedInvitation, normalizedInvitation.birthdayPhotoImage);
    }

    const storedInvitation = {
      ...normalizedInvitation
    };
    const index = customInvitations.findIndex((item) => item.id === normalizedInvitation.id || item.slug === normalizedInvitation.id || item.url === normalizedInvitation.id);

    if (index >= 0) {
      customInvitations[index] = storedInvitation;
    } else {
      customInvitations.push(storedInvitation);
    }

    setCustomInvitationsWithVisualFallback(customInvitations);
    setStoredJson(DELETED_INVITATIONS_KEY, deletedIds);
    debugInvitationFlow("saveCustomInvitation", {
      savedId: normalizedInvitation.id,
      savedSlug: normalizedInvitation.slug,
      savedUrl: normalizedInvitation.url,
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
      const aliases = getInvitationStorageAliases(item);
      return item.id === normalizedInvitation.id || item.slug === normalizedInvitation.slug || item.url === normalizedInvitation.url || aliases.includes(normalizedInvitation.id);
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

    trySetStorageValue(`visualCanvasImage_${invitationId}`, png);
    if (invitation.id) trySetStorageValue(`visualCanvasImage_${invitation.id}`, png);
    if (invitation.slug) trySetStorageValue(`visualCanvasImage_${invitation.slug}`, png);
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
</head>
<body>
  <section id="custom-invitation-root">
    <div class="generated-invitation invitation-card typography-${escapeHtml(design.typography)}${animationClass}" style="--inv-primary:${escapeHtml(design.primaryColor)}; --inv-secondary:${escapeHtml(design.secondaryColor)}; --inv-text:${escapeHtml(design.textColor)}; --inv-button:${escapeHtml(design.buttonColor)};">
      ${finalImage ? `<img class="template-layer" src="${escapeHtml(finalImage)}" alt="Invitación">` : `<p class="missing-template-message">Invitación encontrada, pero no tiene imagen guardada.</p>`}
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
    return new URL(getPublicInvitationUrl(slug), window.location.href).href;
  }

  function getShareInvitation(invitation = null) {
    return normalizeInvitation(invitation || activeShareInvitation || activeEditorInvitation || {});
  }

  function getShareSlug(invitation = null) {
    return getShareInvitation(invitation).id;
  }

  function getShareUrl(invitation = null) {
    return getAbsolutePublicInvitationUrl(getShareSlug(invitation));
  }

  async function copyPublicLink(invitation = null) {
    const url = getShareUrl(invitation);
    await navigator.clipboard.writeText(url);
    setShareStatus("Enlace copiado correctamente");
    return url;
  }

  function openInvitation(invitation = null) {
    window.open(getPublicInvitationUrl(getShareSlug(invitation)), "_blank", "noopener");
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
    const relativeUrl = getPublicInvitationUrl(item.id);
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
              <a class="button secondary" href="${buildUrl("invitacion.html", { id: invitation.id })}">Ver</a>
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
    console.log("visualCanvasImage por localStorage:", !!localStorage.getItem(`visualCanvasImage_${id}`));
    console.log("INVITACION PUBLICA:", invitation);
    console.log("IMAGEN FINAL:", getFinalInvitationImage(invitation) ? "OK" : "NO HAY IMAGEN");
    document.title = invitation.titulo;
    detail.classList.add("custom-event-panel");
    detail.innerHTML = `<iframe class="custom-invitation-iframe" title="${escapeHtml(invitation.titulo)}"></iframe>`;
    detail.querySelector("iframe").srcdoc = buildCustomInvitationDocument(invitation);

    floatingRsvpButton?.addEventListener("click", () => {
      document.querySelector("#rsvp-section")?.scrollIntoView({ behavior: "smooth" });
    });

    form?.addEventListener("submit", (event) => {
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
      const yesInput = form.querySelector('input[name="asiste"][value="Si"], input[name="asiste"][value="Sí"]');
      if (yesInput) yesInput.checked = true;
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
    const viewInvitationLink = document.getElementById("viewInvitationLink");
    if (viewInvitationLink) viewInvitationLink.href = getPublicInvitationUrl(invitation.id);
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
      const savedInvitation = saveCustomInvitation(invitation);
      debugInvitationFlow("renderCreate submit", {
        formId: invitation.id,
        formSlug: invitation.slug,
        savedId: savedInvitation.id,
        savedSlug: savedInvitation.slug,
        savedUrl: savedInvitation.url,
        publicUrl: getPublicInvitationUrl(savedInvitation.id)
      });
      message.className = "success-message";
      message.innerHTML = `Invitacion guardada. <a href="${getPublicInvitationUrl(savedInvitation.id)}">Ver invitacion</a>`;
    });
  }

  function getProfessionalFormData() {
    const form = document.getElementById("professionalEditorForm");
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
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
      customHtml: rawFieldValue(formData, "customHtml"),
      customCss: rawFieldValue(formData, "customCss"),
      customJs: rawFieldValue(formData, "customJs"),
      visualCanvasImage: activeEditorInvitation.visualCanvasImage || localStorage.getItem(getVisualCanvasImageKey(slug)) || localStorage.getItem(getVisualCanvasImageKey(activeEditorInvitation.slug)) || localStorage.getItem(getVisualCanvasImageKey(activeEditorInvitation.id)) || "",
      visualTemplateImage: activeEditorInvitation.visualTemplateImage || localStorage.getItem(getVisualTemplateImageKey(slug)) || localStorage.getItem(getVisualTemplateImageKey(activeEditorInvitation.slug)) || localStorage.getItem(getVisualTemplateImageKey(activeEditorInvitation.id)) || "",
      birthdayPhotoImage: activeEditorInvitation.birthdayPhotoImage || localStorage.getItem(getBirthdayPhotoImageKey(slug)) || localStorage.getItem(getBirthdayPhotoImageKey(activeEditorInvitation.slug)) || localStorage.getItem(getBirthdayPhotoImageKey(activeEditorInvitation.id)) || "",
      visualDesign: activeEditorInvitation.visualDesign || getStoredJson(getVisualDesignKey(slug), null) || getStoredJson(getVisualDesignKey(activeEditorInvitation.slug), null) || getStoredJson(getVisualDesignKey(activeEditorInvitation.id), null),
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
      if (visualEditorCanvas) saveVisualDesign();
      const previousId = activeEditorInvitation.id;
      const invitation = attachVisualDesignToInvitation(getProfessionalFormData());
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
      debugInvitationFlow("saveInvitation editor", {
        previousId,
        savedId: activeEditorInvitation.id,
        savedSlug: activeEditorInvitation.slug,
        savedUrl: activeEditorInvitation.url,
        publicUrl: getPublicInvitationUrl(activeEditorInvitation.id)
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
    if (visualEditorCanvas) saveVisualDesign();
    if (activeEditorInvitation) {
      activeEditorInvitation = saveCustomInvitation(attachVisualDesignToInvitation(getProfessionalFormData()));
    }
    const savedId = activeEditorInvitation?.id;
    debugInvitationFlow("viewAsGuest", {
      savedId,
      savedSlug: activeEditorInvitation?.slug,
      savedUrl: activeEditorInvitation?.url,
      publicUrl: getPublicInvitationUrl(savedId)
    });
    window.open(getPublicInvitationUrl(savedId), "_blank", "noopener");
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

    trySetStorageValue(getVisualCanvasImageKey(invitation.id), png);
    trySetStorageValue(getVisualCanvasImageKey(invitation.slug), png);
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

  if (page !== "invitation") initSidebar();

  if (page === "home") renderHome();
  if (page === "invitation") renderInvitation();
  if (page === "admin") renderAdmin();
  if (page === "create") renderCreate();
  if (page === "editor") renderEditor();
})();
