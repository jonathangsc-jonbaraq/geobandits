// Lógica Principal de GeoBandits

let map = null;
let playerMarker = null;
let banditMarker = null;
let targetMarker = null;
let connectionLines = [];
let radarCircle = null;
let targetRadiusCircle = null;
let worldGeoJsonLayer = null;
let satelliteTileLayer = null;
let mapTheme = "satellite"; // Por defecto en modo Satélite Real

const state = {
  mode: "battle", // 'training' | 'battle' | 'knockout'
  questionMode: "mixed", // 'mixed' | 'country' | 'capital'
  askCapitalThisTurn: false,
  continentFilter: "Todos",
  currentBanditIndex: 0,
  bandit: null,
  playerHp: 1000,
  playerMaxHp: 1000,
  enemyHp: 1000,
  enemyMaxHp: 1000,
  round: 1,
  pool: [],
  currentLocation: null,
  selectedLatLng: null,
  awaitingConfirm: false,
  radarLeft: 2,
  smokeLeft: 1,
  smokeActiveThisTurn: false,
  shieldActive: false
};

function setQuestionMode(qMode) {
  state.questionMode = qMode;
  ["mixed", "country", "capital"].forEach((m) => {
    const btn = document.getElementById(`qm-${m}`);
    if (btn) btn.classList.toggle("active", m === qMode);
  });
}

// ================= SONIDOS ARCADE SINTETIZADOS (WEB AUDIO API) =================
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      try {
        audioCtx = new AudioContextClass();
      } catch (e) {
        audioCtx = null;
      }
    }
  }
  return audioCtx;
}

function playSound(type) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (type === "pin") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.12);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.13);
    osc.start(now);
    osc.stop(now + 0.13);
  } else if (type === "crit") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554.37, now + 0.08);
    osc.frequency.setValueAtTime(659.25, now + 0.16);
    osc.frequency.setValueAtTime(880, now + 0.24);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    osc.start(now);
    osc.stop(now + 0.45);
  } else if (type === "hit") {
    osc.type = "square";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.22);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.23);
    osc.start(now);
    osc.stop(now + 0.23);
  } else if (type === "power") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.25);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.26);
    osc.start(now);
    osc.stop(now + 0.26);
  }
}

// ================= INICIALIZACIÓN DEL MENÚ Y MAPA =================
window.addEventListener("DOMContentLoaded", () => {
  renderMenuBandits();
});

function renderMenuBandits() {
  const strip = document.getElementById("menu-bandit-strip");
  const grid = document.getElementById("bandit-select-grid");
  strip.innerHTML = "";
  grid.innerHTML = "";

  const shortNames = [
    "Brújula Rota",
    "Pepe GPS",
    "La Baronesa",
    "Dr. Coordenada",
    "Sombra Atlas"
  ];

  window.BANDITS.forEach((b, idx) => {
    // Tarjeta compacta en el menú principal
    const sCard = document.createElement("div");
    sCard.className = "strip-card";
    sCard.onclick = () => startBattleWithBandit(idx);
    sCard.innerHTML = `
      <div class="strip-img-wrap" style="border-color:${b.color}">
        <img src="${b.avatar}" alt="${b.name}" />
        <span class="s-level" style="background:${b.color}">NV.${idx + 1}</span>
      </div>
      <strong class="s-name">${shortNames[idx] || b.name}</strong>
    `;
    strip.appendChild(sCard);

    // Tarjeta en el modal selector de Modo Batalla
    const cCard = document.createElement("div");
    cCard.className = "bandit-choice-card";
    cCard.onclick = () => startBattleWithBandit(idx);
    cCard.innerHTML = `
      <img src="${b.avatar}" alt="${b.name}" />
      <div class="bc-info">
        <span class="bc-lvl" style="color:${b.color}">${b.title}</span>
        <h4>${b.name}</h4>
      </div>
      <button class="fight-pill-btn">⚔️ Luchar</button>
    `;
    grid.appendChild(cCard);
  });
}

// Paleta de colores alegres tipo juego de mesa / atlas infantil para cada país
const COUNTRY_PALETTE = [
  "#fde047", "#86efac", "#fda4af", "#fdba74",
  "#d8b4fe", "#67e8f9", "#bef264", "#f9a8d4",
  "#fcd34d", "#a5b4fc", "#5eead4", "#fca5a5"
];

function getCountryColor(featureId) {
  const num = parseInt(featureId, 10) || 0;
  return COUNTRY_PALETTE[num % COUNTRY_PALETTE.length];
}

function getBaseCountryStyle(feature) {
  if (mapTheme === "satellite") {
    return {
      fillColor: "#ffffff",
      fillOpacity: 0.05,
      color: "#fde047", // Fronteras amarillas muy visibles sobre el satélite
      weight: 1.8,
      opacity: 0.95
    };
  }
  return {
    fillColor: getCountryColor(feature.id),
    fillOpacity: 0.92,
    color: "#0f172a", // Fronteras negras/azul oscuro bien marcadas entre países
    weight: 1.6,
    opacity: 1
  };
}

// Corrige los polígonos que cruzan el antimeridiano (±180°, como Rusia en el norte o Fiyi a la altura de Bolivia)
// para que Leaflet NUNCA dibuje líneas horizontales atravesando todo el planeta de lado a lado.
function fixAntimeridianGeoJSON(geojson) {
  function splitOrFixRing(ring) {
    if (!ring || ring.length < 2) return ring;
    // Comprobar si este anillo salta de +179 a -179 (cruce del antimeridiano)
    let crosses = false;
    for (let i = 1; i < ring.length; i++) {
      if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) {
        crosses = true;
        break;
      }
    }
    if (!crosses) return ring;

    // Si cruza el antimeridiano (ej. Chukotka en Rusia o islas de Fiyi),
    // mantenemos las coordenadas en el mismo hemisferio continuo (ej. > 0 -> +180..+190)
    // para que el polígono se cierre localmente sin cruzar todo el mapa de este a oeste.
    const fixed = ring.map((pt) => [pt[0], pt[1]]);
    for (let i = 1; i < fixed.length; i++) {
      const prevLng = fixed[i - 1][0];
      let curLng = fixed[i][0];
      while (curLng - prevLng > 180) curLng -= 360;
      while (prevLng - curLng > 180) curLng += 360;
      fixed[i][0] = curLng;
    }
    return fixed;
  }

  geojson.features.forEach((feature) => {
    const geom = feature.geometry;
    if (!geom) return;
    if (geom.type === "Polygon") {
      geom.coordinates = geom.coordinates.map(splitOrFixRing);
    } else if (geom.type === "MultiPolygon") {
      geom.coordinates = geom.coordinates.map((poly) => poly.map(splitOrFixRing));
    }
  });
  return geojson;
}

function ensureMapInitialized() {
  if (map) {
    setTimeout(() => map.invalidateSize(), 100);
    return;
  }

  map = L.map("world-map", {
    center: [22, 10],
    zoom: window.innerWidth < 640 ? 1 : 2,
    minZoom: 1,
    maxZoom: 8,
    worldCopyJump: true,
    zoomSnap: 1,
    zoomDelta: 1,
    zoomControl: false
  });

  L.control.zoom({ position: "topright" }).addTo(map);

  // Capa Satélite Real (Esri World Imagery - 100% gratis, sin API Key y sin nombres de países)
  satelliteTileLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri",
      maxZoom: 18,
      maxNativeZoom: 17
    }
  );

  // Por defecto activamos el Modo Satélite
  if (mapTheme === "satellite") {
    satelliteTileLayer.addTo(map);
  }

  // Cargar geometría vectorial de alta definición (50m) con las fronteras de todos los países del mundo
  fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json")
    .then((res) => res.json())
    .then((topology) => {
      const rawGeojson = topojson.feature(topology, topology.objects.countries);
      const geojson = fixAntimeridianGeoJSON(rawGeojson);
      worldGeoJsonLayer = L.geoJSON(geojson, {
        style: getBaseCountryStyle,
        smoothFactor: 0.35,
        onEachFeature: (feature, layer) => {
          layer.on("mouseover", () => {
            if (!state.awaitingConfirm) return;
            layer.setStyle({
              weight: 2.8,
              color: "#ffffff",
              fillOpacity: mapTheme === "satellite" ? 0.22 : 1
            });
          });
          layer.on("mouseout", () => {
            if (worldGeoJsonLayer) worldGeoJsonLayer.resetStyle(layer);
          });
          layer.on("click", (e) => {
            if (!state.awaitingConfirm) return;
            placePlayerTemporaryPin(e.latlng);
          });
        }
      }).addTo(map);
    })
    .catch(() => {
      if (satelliteTileLayer && !map.hasLayer(satelliteTileLayer)) {
        satelliteTileLayer.addTo(map);
      }
    });

  map.on("click", (e) => {
    if (!state.awaitingConfirm) return;
    placePlayerTemporaryPin(e.latlng);
  });
}

function toggleMapTheme() {
  if (!map) return;
  const label = document.getElementById("map-theme-label");
  if (mapTheme === "atlas") {
    mapTheme = "satellite";
    if (satelliteTileLayer && !map.hasLayer(satelliteTileLayer)) {
      satelliteTileLayer.addTo(map);
      satelliteTileLayer.bringToBack();
    }
    if (label) label.textContent = "Vista Atlas";
  } else {
    mapTheme = "atlas";
    if (satelliteTileLayer && map.hasLayer(satelliteTileLayer)) {
      map.removeLayer(satelliteTileLayer);
    }
    if (label) label.textContent = "Vista Satélite";
  }
  if (worldGeoJsonLayer) {
    worldGeoJsonLayer.setStyle(getBaseCountryStyle);
  }
}

function resetMapView() {
  if (!map) return;
  const defaultZoom = window.innerWidth < 640 ? 1 : 2;
  map.flyTo([22, 10], defaultZoom, { duration: 0.7 });
}

// ================= MODALES Y NAVEGACIÓN =================
function openBanditSelector() {
  document.getElementById("bandit-modal").classList.remove("hidden");
}

function openTrainingSetup() {
  document.getElementById("training-modal").classList.remove("hidden");
}

function closeModals() {
  document.getElementById("bandit-modal").classList.add("hidden");
  document.getElementById("training-modal").classList.add("hidden");
  document.getElementById("endgame-modal").classList.add("hidden");
}

function returnToMenu() {
  closeModals();
  document.getElementById("game-screen").classList.remove("active");
  document.getElementById("menu-screen").classList.add("active");
}

// ================= ARRANQUE DE LOS 3 MODOS DE JUEGO =================

// 1. Modo Entrenamiento
function startTrainingMode(continent) {
  closeModals();
  state.mode = "training";
  state.continentFilter = continent;
  state.bandit = window.BANDITS[0];
  state.playerHp = 1000;
  state.playerMaxHp = 1000;
  state.round = 1;
  state.radarLeft = 99;
  state.smokeLeft = 0;
  state.shieldActive = false;

  buildLocationPool();
  launchGameScreen();
}

// 2. Modo Batalla 1 vs 1
function startBattleWithBandit(banditIndex) {
  closeModals();
  state.mode = "battle";
  state.currentBanditIndex = banditIndex;
  state.bandit = window.BANDITS[banditIndex];
  state.playerMaxHp = 1000;
  state.playerHp = 1000;
  state.enemyMaxHp = state.bandit.hp;
  state.enemyHp = state.bandit.hp;
  state.round = 1;
  state.radarLeft = 2;
  state.smokeLeft = 1;
  state.shieldActive = false;

  buildLocationPool();
  launchGameScreen();
}

// 3. Modo Knock-Out (Torneo Escalera contra los 5 bandidos)
function startKnockoutMode() {
  closeModals();
  state.mode = "knockout";
  state.currentBanditIndex = 0;
  state.bandit = window.BANDITS[0];
  state.playerMaxHp = 1200;
  state.playerHp = 1200;
  state.enemyMaxHp = state.bandit.hp;
  state.enemyHp = state.bandit.hp;
  state.round = 1;
  state.radarLeft = 2;
  state.smokeLeft = 1;
  state.shieldActive = false;

  buildLocationPool();
  launchGameScreen();
}

function buildLocationPool() {
  let candidates = [...window.LOCATIONS];

  if (state.mode === "training") {
    if (state.continentFilter !== "Todos") {
      candidates = candidates.filter((loc) => loc.continent === state.continentFilter);
    }
  } else {
    // Filtramos según los tiers del bandido actual, pero añadimos variedad si se agotan
    const allowedTiers = state.bandit.tiers;
    const tierMatches = candidates.filter((loc) => allowedTiers.includes(loc.tier));
    if (tierMatches.length >= 5) {
      candidates = tierMatches;
    }
  }

  // Mezclar aleatoriamente
  state.pool = candidates.sort(() => Math.random() - 0.5);
}

function launchGameScreen() {
  document.getElementById("menu-screen").classList.remove("active");
  document.getElementById("game-screen").classList.add("active");
  ensureMapInitialized();
  updateHudUI();
  startNewTurn();
}

function renderFlagHtml(loc) {
  if (!loc || !loc.id) return loc ? loc.flag : "🌍";
  const code = loc.id.toLowerCase();
  return `<img class="target-flag-img" src="https://flagcdn.com/${code}.svg" alt="${loc.country}" onerror="this.outerHTML='${loc.flag}'" />`;
}

function toggleCluePopup() {
  const box = document.getElementById("target-clue-box");
  if (box) box.classList.toggle("hidden");
}

// ================= FLUJO DE UN TURNO =================
function startNewTurn() {
  clearMapLayers();
  state.selectedLatLng = null;
  state.awaitingConfirm = true;
  state.smokeActiveThisTurn = false;

  document.getElementById("turn-result-panel").classList.add("hidden");
  const clueBox = document.getElementById("target-clue-box");
  if (clueBox) clueBox.classList.add("hidden");

  const actionDock = document.querySelector(".action-dock");
  if (actionDock) actionDock.classList.remove("hidden");
  const confirmBtn = document.getElementById("btn-confirm-pin");
  confirmBtn.disabled = true;
  confirmBtn.textContent = "📍 ¡LANZAR PIN!";

  const hintEl = document.getElementById("pin-status-hint");
  if (hintEl) hintEl.classList.add("hidden");

  if (state.pool.length === 0) {
    buildLocationPool();
  }
  state.currentLocation = state.pool.pop();

  // Actualizar tarjeta central de misión según si preguntamos País o Capital
  const loc = state.currentLocation;
  if (state.questionMode === "country") {
    state.askCapitalThisTurn = false;
  } else if (state.questionMode === "capital") {
    state.askCapitalThisTurn = true;
  } else {
    const capChance = state.mode === "training" ? 0.5 : Math.min(0.8, 0.25 + state.currentBanditIndex * 0.15);
    state.askCapitalThisTurn = Math.random() < capChance;
  }

  const flagContainer = document.getElementById("target-flag");
  if (state.askCapitalThisTurn) {
    // Cuando preguntamos una CAPITAL, NO mostramos el país ni su bandera hasta que responda
    flagContainer.innerHTML = "🏛️";
    document.getElementById("target-type-label").textContent = "🏛️ CAPITAL";
    document.getElementById("target-name").textContent = loc.capital;
    document.getElementById("target-clue").textContent =
      `💡 Región: ${loc.subregion} (${loc.continent})`;
  } else {
    flagContainer.innerHTML = renderFlagHtml(loc);
    document.getElementById("target-type-label").textContent = "🗺️ PAÍS";
    document.getElementById("target-name").textContent = loc.country;
    document.getElementById("target-clue").textContent =
      `💡 ${loc.continent} · Capital: ${loc.capital}`;
  }

  updateHudUI();
  resetMapView();
}

function placePlayerTemporaryPin(latlng) {
  playSound("pin");
  state.selectedLatLng = latlng;

  if (playerMarker) {
    playerMarker.setLatLng(latlng);
  } else {
    const icon = L.divIcon({
      className: "custom-div-icon",
      html: `<div class="custom-pin pin-player">
               <span class="pin-bubble">Tú</span>
               <span class="pin-emoji">📍</span>
             </div>`,
      iconSize: [70, 48],
      iconAnchor: [35, 40]
    });
    playerMarker = L.marker(latlng, { icon }).addTo(map);
  }

  const hintEl = document.getElementById("pin-status-hint");
  // En modo entrenamiento damos feedback Caliente / Frío corto al mover el pin
  if (state.mode === "training") {
    const rawDist = calculateDistanceKm(
      latlng.lat,
      latlng.lng,
      state.currentLocation.lat,
      state.currentLocation.lng
    );
    hintEl.textContent = getHotColdHint(rawDist, state.currentLocation.radiusKm);
    hintEl.classList.remove("hidden");
  } else {
    hintEl.classList.add("hidden");
  }

  document.getElementById("btn-confirm-pin").disabled = false;
}

function getHotColdHint(distKm, radiusKm) {
  if (distKm <= radiusKm) return "🔥 ¡HIRVIENDO!";
  if (distKm <= 800) return "🌶️ ¡MUY CALIENTE!";
  if (distKm <= 2000) return "☀️ Templado";
  if (distKm <= 4500) return "❄️ Frío";
  return "🧊 ¡CONGELADO!";
}

// ================= CONFIRMAR PIN Y CALCULAR DISTANCIA / DAÑO =================
function confirmPlayerGuess() {
  if (!state.selectedLatLng || !state.awaitingConfirm) return;
  state.awaitingConfirm = false;
  document.getElementById("btn-confirm-pin").disabled = true;

  const loc = state.currentLocation;
  const rawPlayerDist = calculateDistanceKm(
    state.selectedLatLng.lat,
    state.selectedLatLng.lng,
    loc.lat,
    loc.lng
  );

  // Si pincha dentro del radio territorial del país/capital, cuenta como 0 km (¡Impacto Directo!)
  const effectivePlayerDist = rawPlayerDist <= loc.radiusKm ? 0 : Math.round(rawPlayerDist - loc.radiusKm * 0.4);

  // Al confirmar el pin, si era una pregunta de capital revelamos ahora la bandera y el país en la cabecera
  if (state.askCapitalThisTurn) {
    document.getElementById("target-flag").innerHTML = renderFlagHtml(loc);
    document.getElementById("target-name").textContent = `${loc.capital} (${loc.country})`;
  }

  // Colocar Pin de la Solución Real
  const targetIcon = L.divIcon({
    className: "custom-div-icon",
    html: `<div class="custom-pin pin-target">
             <span class="pin-bubble">${loc.flag} ${loc.target}</span>
             <span class="pin-emoji">⭐</span>
           </div>`,
    iconSize: [140, 50],
    iconAnchor: [70, 42]
  });
  targetMarker = L.marker([loc.lat, loc.lng], { icon: targetIcon }).addTo(map);

  // Círculo verde del radio de impacto directo
  targetRadiusCircle = L.circle([loc.lat, loc.lng], {
    radius: loc.radiusKm * 1000,
    color: "#22c55e",
    fillColor: "#22c55e",
    fillOpacity: 0.18,
    weight: 2
  }).addTo(map);

  // Línea entre el Jugador y el Objetivo
  const pLine = L.polyline(
    [
      [state.selectedLatLng.lat, state.selectedLatLng.lng],
      [loc.lat, loc.lng]
    ],
    { color: "#38bdf8", weight: 4, dashArray: "8, 8" }
  ).addTo(map);
  connectionLines.push(pLine);

  if (state.mode === "training") {
    resolveTrainingTurn(effectivePlayerDist, loc);
  } else {
    resolveCombatTurn(effectivePlayerDist, loc);
  }
}

function resolveTrainingTurn(playerDist, loc) {
  playSound(playerDist === 0 ? "crit" : "pin");

  const badge = document.getElementById("result-badge");
  const headline = document.getElementById("result-headline");

  if (playerDist === 0) {
    badge.textContent = "🎯 ¡DIANA PERFECTA!";
    badge.style.background = "#22c55e";
    headline.textContent = `¡Has acertado de lleno en ${loc.target}!`;
  } else if (playerDist < 1000) {
    badge.textContent = "👏 ¡MUY CERCA!";
    badge.style.background = "#38bdf8";
    headline.textContent = `Te quedaste a solo ${playerDist.toLocaleString("es-ES")} km.`;
  } else {
    badge.textContent = "🧭 ¡SIGUE EXPLORANDO!";
    badge.style.background = "#f59e0b";
    headline.textContent = `Estaba a ${playerDist.toLocaleString("es-ES")} km de tu pin.`;
  }

  document.getElementById("res-player-dist").textContent =
    playerDist === 0 ? "¡En el blanco!" : `${playerDist.toLocaleString("es-ES")} km`;
  document.getElementById("res-player-dmg").textContent = "Modo Práctica";
  document.getElementById("res-player-dmg").className = "dmg-tag good";

  document.getElementById("res-enemy-box").classList.add("hidden");
  document.querySelector(".vs-circle").classList.add("hidden");

  document.getElementById("res-fun-fact").textContent = loc.fact;
  const actionDock = document.querySelector(".action-dock");
  if (actionDock) actionDock.classList.add("hidden");
  document.getElementById("turn-result-panel").classList.remove("hidden");

  map.flyToBounds(
    L.latLngBounds([state.selectedLatLng, [loc.lat, loc.lng]]).pad(0.35),
    { duration: 0.9, maxZoom: 4 }
  );
}

function resolveCombatTurn(playerDist, loc) {
  document.getElementById("res-enemy-box").classList.remove("hidden");
  document.querySelector(".vs-circle").classList.remove("hidden");

  // Simular el tiro del Bandido según su nivel de dificultad
  const b = state.bandit;
  let minErr = b.minErrorKm;
  let maxErr = b.maxErrorKm;
  if (state.smokeActiveThisTurn) {
    minErr *= 2.2;
    maxErr *= 2.4;
  }

  const banditDist = Math.round(minErr + Math.random() * (maxErr - minErr));
  const banditLatLng = generateOffsetPoint(loc.lat, loc.lng, banditDist);

  // Colocar marcador del bandido
  const banditIcon = L.divIcon({
    className: "custom-div-icon",
    html: `<div class="custom-pin pin-bandit">
             <span class="pin-bubble">🏴‍☠️ ${b.name.split(" ")[0]}</span>
             <span class="pin-emoji">💣</span>
           </div>`,
    iconSize: [110, 50],
    iconAnchor: [55, 42]
  });
  banditMarker = L.marker(banditLatLng, { icon: banditIcon }).addTo(map);

  const bLine = L.polyline([banditLatLng, [loc.lat, loc.lng]], {
    color: "#ef4444",
    weight: 3,
    dashArray: "6, 8"
  }).addTo(map);
  connectionLines.push(bLine);

  // Calcular daños
  let playerDmgTaken = 0;
  let enemyDmgTaken = 0;
  const badge = document.getElementById("result-badge");
  const headline = document.getElementById("result-headline");

  if (playerDist === 0) {
    // ¡Impacto directo! Crítico al bandido y 0 daño al jugador
    enemyDmgTaken = 340;
    playerDmgTaken = 0;
    badge.textContent = "💥 ¡IMPACTO DIRECTO CRÍTICO!";
    badge.style.background = "#22c55e";
    headline.textContent = `¡Diana perfecta en ${loc.target}!`;
    document.getElementById("enemy-quote").textContent = `"${b.quotes.hit}"`;
    playSound("crit");
  } else if (playerDist <= banditDist) {
    // El jugador quedó más cerca que el bandido
    const diff = banditDist - playerDist;
    enemyDmgTaken = Math.min(320, Math.max(120, Math.round(diff / 12) + 90));
    // Pequeño rasguño si el jugador igual estuvo bastante lejos (> 2000 km)
    playerDmgTaken = playerDist > 2200 ? Math.min(110, Math.round((playerDist - 2000) / 35)) : 0;

    badge.textContent = "⚔️ ¡GANASTE EL DUELO!";
    badge.style.background = "#38bdf8";
    headline.textContent = "¡Tu pin estuvo más cerca que el del bandido!";
    document.getElementById("enemy-quote").textContent = `"${b.quotes.hit}"`;
    playSound("crit");
  } else {
    // El bandido quedó más cerca que el jugador
    const diff = playerDist - banditDist;
    playerDmgTaken = Math.min(330, Math.max(110, Math.round(diff / 14) + 80));
    enemyDmgTaken = banditDist > 1200 ? 50 : 0;

    if (state.shieldActive) {
      playerDmgTaken = 0;
      state.shieldActive = false;
      badge.textContent = "🛡️ ¡ESCUDO ACTIVADO!";
      badge.style.background = "#a855f7";
      headline.textContent = "El bandido estuvo más cerca, ¡pero tu Escudo bloqueó el daño!";
    } else {
      badge.textContent = "⚠️ ¡EL BANDIDO ESTUVO MÁS CERCA!";
      badge.style.background = "#f59e0b";
      headline.textContent = `Pierdes ${playerDmgTaken} HP por la distancia.`;
    }
    document.getElementById("enemy-quote").textContent = `"${b.quotes.winTurn}"`;
    playSound("hit");
  }

  state.playerHp = Math.max(0, state.playerHp - playerDmgTaken);
  state.enemyHp = Math.max(0, state.enemyHp - enemyDmgTaken);
  updateHudUI();

  // Mostrar resumen del turno
  document.getElementById("res-player-dist").textContent =
    playerDist === 0 ? "¡Diana (0 km)!" : `${playerDist.toLocaleString("es-ES")} km`;
  document.getElementById("res-player-dmg").textContent =
    playerDmgTaken === 0 ? "0 HP (Sin daño)" : `-${playerDmgTaken} HP`;
  document.getElementById("res-player-dmg").className =
    playerDmgTaken === 0 ? "dmg-tag good" : "dmg-tag bad";

  document.getElementById("res-enemy-dist").textContent = `${banditDist.toLocaleString("es-ES")} km`;
  document.getElementById("res-enemy-dmg").textContent =
    enemyDmgTaken === 0 ? "0 HP" : `-${enemyDmgTaken} HP`;
  document.getElementById("res-enemy-dmg").className =
    enemyDmgTaken > 0 ? "dmg-tag bad" : "dmg-tag good";

  document.getElementById("res-fun-fact").textContent = loc.fact;

  const nextBtn = document.getElementById("btn-next-turn");
  if (state.enemyHp <= 0 || state.playerHp <= 0) {
    nextBtn.textContent = state.enemyHp <= 0 ? "🏆 ¡Ver Victoria!" : "💔 Ver Resultado";
  } else {
    nextBtn.textContent = "Siguiente Ronda →";
  }

  document.getElementById("turn-result-panel").classList.remove("hidden");
  const actionDock = document.querySelector(".action-dock");
  if (actionDock) actionDock.classList.add("hidden");

  // Ajustar cámara para ver los 3 puntos
  const bounds = L.latLngBounds([
    state.selectedLatLng,
    [loc.lat, loc.lng],
    banditLatLng
  ]).pad(0.35);
  map.flyToBounds(bounds, { duration: 0.9, maxZoom: 4 });
}

function nextTurnOrFinish() {
  if (state.mode !== "training") {
    if (state.enemyHp <= 0) {
      handleBanditDefeated();
      return;
    }
    if (state.playerHp <= 0) {
      handlePlayerDefeated();
      return;
    }
  }
  state.round++;
  startNewTurn();
}

// ================= VICTORIA / DERROTA / PROGRESIÓN KNOCK-OUT =================
function handleBanditDefeated() {
  playSound("crit");
  const modal = document.getElementById("endgame-modal");
  const b = state.bandit;

  document.getElementById("endgame-img").src = b.avatar;
  document.getElementById("endgame-quote").textContent = `"${b.quotes.defeat}"`;

  // Si estamos en Torneo Knock-Out y aún quedan bandidos por derrotar
  if (state.mode === "knockout" && state.currentBanditIndex < window.BANDITS.length - 1) {
    const nextBandit = window.BANDITS[state.currentBanditIndex + 1];
    document.getElementById("endgame-badge").textContent =
      `🏆 ¡KNOCK-OUT ${state.currentBanditIndex + 1} DE 5!`;
    document.getElementById("endgame-title").textContent =
      `¡Derrotaste a ${b.name}! Próximo rival: ${nextBandit.name}`;
    document.getElementById("knockout-rewards").classList.remove("hidden");
    document.getElementById("endgame-standard-actions").classList.add("hidden");
  } else {
    // Victoria final
    document.getElementById("endgame-badge").textContent =
      state.mode === "knockout" ? "👑 ¡CAMPEÓN DEL TORNEO KNOCK-OUT!" : "🏆 ¡VICTORIA EN BATALLA!";
    document.getElementById("endgame-title").textContent =
      state.mode === "knockout"
        ? "¡Has derrotado a los 5 Bandidos del Mapa con una sola barra de vida!"
        : `¡Has vencido a ${b.name}!`;
    document.getElementById("knockout-rewards").classList.add("hidden");
    document.getElementById("endgame-standard-actions").classList.remove("hidden");
  }

  modal.classList.remove("hidden");
}

function handlePlayerDefeated() {
  playSound("hit");
  const modal = document.getElementById("endgame-modal");
  const b = state.bandit;

  document.getElementById("endgame-img").src = b.avatar;
  document.getElementById("endgame-badge").textContent = "💥 ¡FIN DE LA PARTIDA!";
  document.getElementById("endgame-title").textContent = `${b.name} ganó este combate`;
  document.getElementById("endgame-quote").textContent = `"${b.quotes.winTurn}"`;
  document.getElementById("knockout-rewards").classList.add("hidden");
  document.getElementById("endgame-standard-actions").classList.remove("hidden");

  modal.classList.remove("hidden");
}

function claimKnockoutReward(rewardType) {
  playSound("power");
  if (rewardType === "heal") {
    state.playerHp = Math.min(state.playerMaxHp, state.playerHp + 350);
  } else if (rewardType === "shield") {
    state.shieldActive = true;
  } else if (rewardType === "tools") {
    state.radarLeft += 2;
    state.smokeLeft += 1;
  }

  // Avanzar al siguiente bandido del Torneo Knock-Out
  state.currentBanditIndex++;
  state.bandit = window.BANDITS[state.currentBanditIndex];
  state.enemyMaxHp = state.bandit.hp;
  state.enemyHp = state.bandit.hp;
  state.round++;

  closeModals();
  buildLocationPool();
  updateHudUI();
  startNewTurn();
}

function rematchCurrent() {
  closeModals();
  if (state.mode === "knockout") {
    startKnockoutMode();
  } else if (state.mode === "battle") {
    startBattleWithBandit(state.currentBanditIndex);
  } else {
    startTrainingMode(state.continentFilter);
  }
}

// ================= COMODINES (POWER-UPS) =================
function useRadarPowerup() {
  if (state.radarLeft <= 0 || !state.awaitingConfirm || radarCircle) return;
  playSound("power");
  state.radarLeft--;

  const loc = state.currentLocation;
  // Desplazamos ligeramente el centro del radar para que sea una pista divertida sin regalar el punto exacto
  const jitterLat = loc.lat + (Math.random() - 0.5) * 8;
  const jitterLng = loc.lng + (Math.random() - 0.5) * 8;

  radarCircle = L.circle([jitterLat, jitterLng], {
    radius: 1450000,
    color: "#f59e0b",
    fillColor: "#fbbf24",
    fillOpacity: 0.25,
    weight: 3,
    dashArray: "10, 6"
  }).addTo(map);

  map.flyTo([jitterLat, jitterLng], 3.2, { duration: 0.8 });
  document.getElementById("pin-status-hint").textContent =
    "🔎 ¡Radar activado! El objetivo está dentro del círculo dorado.";
  updateHudUI();
}

function useSmokePowerup() {
  if (state.smokeLeft <= 0 || !state.awaitingConfirm || state.smokeActiveThisTurn) return;
  playSound("power");
  state.smokeLeft--;
  state.smokeActiveThisTurn = true;
  document.getElementById("enemy-quote").textContent =
    `"¡Cof, cof! ¡No veo nada con tanto humo en mi mapa!"`;
  updateHudUI();
}

// ================= ACTUALIZACIÓN DE INTERFAZ Y UTILIDADES =================
function updateHudUI() {
  // Modo y Ronda
  const modeNames = {
    training: `ENTRENAMIENTO (${state.continentFilter})`,
    battle: "DUELO 1 VS 1",
    knockout: `TORNEO KNOCK-OUT (Jefe ${state.currentBanditIndex + 1}/5)`
  };
  document.getElementById("game-mode-pill").textContent = modeNames[state.mode];
  document.getElementById("round-counter").textContent = `R${state.round}`;

  // Vida del Jugador
  const pPct = Math.max(0, Math.round((state.playerHp / state.playerMaxHp) * 100));
  document.getElementById("player-hp-fill").style.width = `${pPct}%`;
  document.getElementById("player-hp-text").textContent =
    state.mode === "training" ? "∞ HP" : `${state.playerHp} HP`;

  // Escudos / Perks activos
  const badgesEl = document.getElementById("player-badges");
  const perks = [];
  if (state.shieldActive) perks.push("🛡️ Escudo");
  if (state.smokeActiveThisTurn) perks.push("💨 Humo");
  badgesEl.textContent = perks.join(" · ");

  // Bandido
  const b = state.bandit;
  document.getElementById("enemy-name").textContent =
    state.mode === "training" ? "Academia" : b.name;
  document.getElementById("enemy-avatar").src = b.avatar;

  const ePct = Math.max(0, Math.round((state.enemyHp / state.enemyMaxHp) * 100));
  document.getElementById("enemy-hp-fill").style.width =
    state.mode === "training" ? "100%" : `${ePct}%`;
  document.getElementById("enemy-hp-text").textContent =
    state.mode === "training" ? "Libre" : `${state.enemyHp} HP`;

  // Botones de comodines
  document.getElementById("radar-count").textContent =
    state.mode === "training" ? "∞" : state.radarLeft;
  document.getElementById("btn-power-radar").disabled =
    state.radarLeft <= 0 || !state.awaitingConfirm;

  const smokeBtn = document.getElementById("btn-power-smoke");
  if (state.mode === "training") {
    smokeBtn.classList.add("hidden");
  } else {
    smokeBtn.classList.remove("hidden");
    document.getElementById("smoke-count").textContent = state.smokeLeft;
    smokeBtn.disabled =
      state.smokeLeft <= 0 || !state.awaitingConfirm || state.smokeActiveThisTurn;
  }
}

function clearMapLayers() {
  if (!map) return;
  if (playerMarker) {
    map.removeLayer(playerMarker);
    playerMarker = null;
  }
  if (banditMarker) {
    map.removeLayer(banditMarker);
    banditMarker = null;
  }
  if (targetMarker) {
    map.removeLayer(targetMarker);
    targetMarker = null;
  }
  if (radarCircle) {
    map.removeLayer(radarCircle);
    radarCircle = null;
  }
  if (targetRadiusCircle) {
    map.removeLayer(targetRadiusCircle);
    targetRadiusCircle = null;
  }
  connectionLines.forEach((line) => map.removeLayer(line));
  connectionLines = [];
}

// Fórmula de Haversine para distancia real en kilómetros sobre la Tierra
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Genera un punto a 'distanceKm' de (lat, lng) en una dirección aleatoria para el Pin del Bandido
function generateOffsetPoint(lat, lng, distanceKm) {
  const R = 6371;
  const brng = Math.random() * 2 * Math.PI;
  const d = distanceKm / R;

  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lng * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  let finalLat = (lat2 * 180) / Math.PI;
  let finalLng = (lon2 * 180) / Math.PI;
  finalLat = Math.max(-72, Math.min(75, finalLat));
  if (finalLng > 180) finalLng -= 360;
  if (finalLng < -180) finalLng += 360;
  // Evitar saltos a través del antimeridiano (180°) que distorsionan el zoom en Rusia/Oceanía
  if (Math.abs(finalLng - lng) > 140) {
    finalLng = lng > 0 ? Math.min(172, lng + 25) : Math.max(-172, lng - 25);
  }

  return [finalLat, finalLng];
}
