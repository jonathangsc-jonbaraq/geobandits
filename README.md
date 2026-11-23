# 🌍 GeoBandits · ¡Atrapa a los Villanos del Mapa!

Juego educativo de geografía y combate por puntos de vida (HP) inspirado en *GeoGuessr*, diseñado especialmente para niños de **9 años** (disponible como aplicación web interactiva y aplicación nativa **Android**).

## ✨ Características Principales

- **Base de Datos Completa de los 197 Países del Mundo y sus Capitales:**
  - 🏰 **Europa:** 45 países
  - 🗽 **América:** 35 países
  - 🐉 **Asia:** 49 países
  - 🦁 **África:** 54 países
  - 🦘 **Oceanía:** 14 países
  - Incluye selector de reto: **🎲 Mixto (País o Capital)**, **🗺️ Solo Países** o **🏛️ Solo Capitales** (ocultando el país y la bandera hasta después de lanzar el pin).

- **🏴‍☠️ 5 Bandidos con Ilustraciones Originales y Niveles de Dificultad:**
  1. **Capitán Brújula Rota** (*Nivel 1 · Muy Fácil*)
  2. **Pepe 'El Perdido' GPS** (*Nivel 2 · Fácil*)
  3. **La Baronesa Globo Terráqueo** (*Nivel 3 · Medio*)
  4. **Doctor Coordenada** (*Nivel 4 · Difícil*)
  5. **Sombra Atlas** (*Nivel 5 · Jefe Final*)

- **🎮 3 Modos de Juego:**
  - 🧭 **Modo Entrenamiento:** Práctica libre filtrada por continentes con radar *"¡Hirviendo / Caliente / Templado / Frío / Congelado!"*.
  - ⚔️ **Modo Batalla 1 vs 1:** Elige a cualquiera de los 5 bandidos y compite lanzando pines en el mapa; quien quede más lejos del objetivo pierde puntos de vida (HP).
  - 🏆 **Torneo Knock-Out:** Derrota a los 5 bandidos seguidos con una sola barra de vida eligiendo mejoras entre combates (*+350 HP*, *Escudo* o *Recarga de Gadgets*).

- **🛰️ Mapa Interactivo Satélite y Vectorial (Sin API Key):**
  - Vista **Satélite Real** (Esri World Imagery) por defecto con fronteras políticas vectoriales (`world-atlas 50m`) corregidas en el antimeridiano y modo alternativo **Vista Atlas** coloreado.
  - Interfaz optimizada para pantallas táctiles móviles y Android.

## 🚀 Ejecución en Local

```bash
python3 -m http.server 8090
```
Abre `http://localhost:8090` en el navegador.
