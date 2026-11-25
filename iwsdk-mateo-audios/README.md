# Free Frequency · copia «iwsdk-mateo-audios» (audios nuevos de la radio)

Copia de `iwsdk-mateo/` (la original no se tocó). Solo cambian los audios de dos emisoras de la radio (`public/ff/emisoras.js`):

1. **Noticias** (FM 52 y AM 40): `public/audio/noticia.mp3`, el audio nuevo recortado a los **16 s** (el original dura 18,1 s). Suena completo
   (antes cada fragmento se cortaba a los 12 s; ahora cada emisora tiene su duración: `max`).
2. **Historia de terror** (FM 80): `public/audio/historia-terror.mp3`, el audio nuevo **completo, 3 min 13 s**, siempre desde el principio. Por
   su largo se reproduce con un elemento `<audio>` (`stream: true`) y no se decodifica entero en memoria. Conserva el zumbido de ambiente.

Lo demás de la radio no cambia: estática, fundidos al entrar y salir de una emisora, filtro de radio, música y botón de sonido. Los audios
anteriores siguen en `../assets/audio/emisoras/` para las otras versiones.

Para abrirla: `cd iwsdk-mateo-audios`, `npm run dev` (puerto **8089**).

---

# Free Frequency · copia «iwsdk-mateo» (presentación de Mateo, tarjetas dentro de la maqueta y botones al tacto)

Copia de `iwsdk-maqueta/` (la original no se tocó). Se conservan modelos, materiales, animaciones, sonidos, estilo y todas las interacciones
(agarre, perillas de la radio, encendido de la linterna, Morse, mover y agrandar la maqueta). Cambios:

1. **Tarjetas dentro de la maqueta**: la tarjeta de la actividad queda de pie sobre el pasto a unos 4 cm a la derecha de la linterna y la de
   herramientas a unos 4 cm a la izquierda de la radio, un poco giradas hacia el usuario (`CARD` y `placeCards` en `public/ff/app.js`). Siguen a
   la maqueta al moverla o agrandarla, pero conservan su tamaño para leerse igual. El aviso de carga también queda dentro.
2. **Radio y linterna más grandes**: 2,5 veces la escala de Mateo (`OBJ_K`): radio de unos 2,8 cm y linterna de unos 2,2 cm; bases de 3,7 cm.
3. **Presentación en tres globos seguidos** (`hub` / `INTRO`): Mateo solo → «¡Hola, soy Mateo!» (5 s) → «Y el día de hoy no tengo señal. ¿Me
   podrían ayudar?» (7 s), y en ese momento aparecen la radio (a su izquierda) y la linterna (a su derecha) → «¿Cuál de estas dos alternativas me
   ayudarán?», que se queda hasta elegir. Solo se puede elegir desde el tercer globo.
4. **Elegir tocando el objeto** con la punta del índice (el pellizco también sirve). El otro objeto desaparece y el elegido se queda en su base
   junto a Mateo hasta que el usuario lo agarra.
5. **Botones con los dedos**: en todas las tarjetas, la yema del índice resalta el botón al acercarse (5 cm) y lo pulsa al tocar la superficie
   (`UI.touch` en `public/ff/ui.js`); un toque = un clic, con sonido.
6. **Cierre**: tras la radio y la linterna, Mateo queda solo con «¡Muchas gracias por haberme acompañado en este recorrido de tanto
   aprendizaje!»; a los 7 s aparece la tarjeta con «Volver a empezar».

7. **Agarre de la radio con la mano izquierda** (`radioPose`, «AGARRE DE LA RADIO» en `public/ff/app.js`): la radio se sostiene por su lateral
   izquierdo, con la palma detrás, los dedos rodeando el borde por detrás y el pulgar sobre el frente. Se calcula con las 25 articulaciones XRHand:
   marco rígido de la palma (muñeca, metacarpianos y nudillos) con filtro adaptativo; ajuste del agarre con el pulgar (frente y borde izquierdo);
   colisiones de cada articulación (esferas) contra la caja del cuerpo de la radio, con prioridad para el pulgar visible; si se pierde la mano, la
   radio se queda quieta y vuelve a ella suavemente. La mano derecha ya no empuja la radio; la perilla gira exactamente con los dedos. Se suelta
   con la mano extendida y el pulgar fuera del frente (medio segundo). Respaldo del archivo anterior: `../backups/iwsdk-mateo-antes-agarre/app.js`.

8. **Agarre de la linterna** («AGARRE DE LA LINTERNA» en `public/ff/app.js`: `torchFrame`, `torchFitPose`, `torchPush`, `torchProfile`):
   el eje de la linterna sigue la fila de los dedos cerrados (falanges del meñique al índice, XRHand 5-24) y su centro es el del hueco que
   forman los dedos (círculo de radio conocido: el del mango medido en Linterna.glb más el grosor de cada falange). Colisiones de los dedos
   contra el perfil real del modelo (mango y cabeza), solo de lado para no mover el botón bajo el pulgar. El encendido con el pulgar
   (`torchFit`) no cambió. Sin mano, la linterna se queda quieta (antes volvía a su base y saltaba) y al cambiar de mano llega en 0,3 s.
   Respaldo: `../backups/iwsdk-mateo-antes-agarre-linterna/app.js`.

Para abrirla: `cd iwsdk-mateo`, `npm run dev` (puerto **8087**). `node_modules` es un enlace (unión) a `../iwsdk-maqueta/node_modules`; si
se copia la carpeta a otro equipo, ejecuta `npm install`.

---

# Free Frequency · realidad aumentada con maqueta movible (copia «iwsdk-maqueta»)

Copia de `iwsdk-interacciones/` con cuatro cambios (la versión original no se tocó):

1. **Sin el bloque negro de «Vista previa de desarrollo»**.
2. **Portada igual a la de la página** (título, frase, «Comenzar», nota, botones EN y sonido, Mateo y Valeria en 3D). Usa la misma hoja `../css/styles.css`; los personajes salen de `public/ff/portada-chars.js` (copia de `../js/home-chars.js` solo con los dos personajes de la portada). **«Comenzar» entra directo a la realidad aumentada** (reemplaza el botón «Entrar en realidad aumentada (AR)»). Al salir de AR vuelve la portada. Si el navegador no tiene AR, «Comenzar» abre la vista previa con la mesa virtual y un botón «← Inicio». El botón EN traduce la portada; la experiencia 3D sigue en español.
3. **Mover la maqueta con las manos** (reemplaza «Mover a otra mesa»). Primero se escanea la mesa y se pellizca para colocar, como antes. Después: **las dos palmas hacia arriba junto a la maqueta** (como sosteniendo una bandeja) durante ~0,3 s → la maqueta completa (pasto, camino, casas, árboles, montañas, Mateo, la radio y la linterna, y las tarjetas que la acompañan) sigue a las manos: posición, altura y giro. Al voltear las manos o retirarlas, **se queda exactamente donde quedó**.
4. **Agrandar la maqueta con las manos**: a) **palmas enfrentadas** (como un marco) cerca de la maqueta: al separarlas crece y al juntarlas se achica; b) **pellizcar las dos esquinas de adelante** (marcas amarillas) y estirarlas. Crece desde los pies de Mateo con todos sus elementos (de ×0,6 a ×4); las tarjetas se corren a los lados. «Tamaño original» (tarjeta de la izquierda) la devuelve a ×1.
   Mientras se mueve o se agranda, las manos no eligen ni agarran objetos, y con la radio o la linterna en la mano estos gestos no se activan. Código: «MAQUETA CON LAS MANOS» en `public/ff/app.js` (`maqHands`). Para probar sin casco: `FFApp.maqueta.scale(2)` en la consola.

Para abrirla: `cd iwsdk-maqueta`, `npm install`, `npm run dev` (puerto **8085**). `npm run build` genera `dist/` para publicar.

---

# Free Frequency · versión de realidad aumentada (Meta Quest, IWSDK)

Versión de Free Frequency hecha con el **Immersive Web SDK de Meta** (IWSDK, paquete `@iwsdk/core`), sobre WebXR.
**Solo realidad aumentada** (passthrough): la versión de realidad virtual se quitó.

## Cómo abrirla

```bash
cd iwsdk
npm install
npm run dev
```

- **En el computador:** abre `https://localhost:8081/` (la primera vez: «Configuración avanzada» → «Continuar»). Se ve una vista previa con una **mesa virtual**.
  El plugin de IWSDK carga un **emulador de Meta Quest 3** con un cuarto de ejemplo: «Comenzar» entra a la realidad aumentada sin casco (el cuarto trae una mesa de centro que se detecta).
- **En el Meta Quest (misma red wifi):** abre en el navegador del Quest la dirección «Network» que muestra la terminal (por ejemplo `https://11.11.3.84:8081/`), acepta el aviso del certificado y toca **«Comenzar»**.
  Conviene haber hecho el **Space Setup** del Quest (Configuración → Espacio físico) para que las mesas aparezcan como planos detectados.

## Cómo se usa en el Quest

1. **Deja los controles**: todo se hace con las manos (hand tracking).
2. **Escaneo de la mesa**: aparece el cartel «Escanea tu mesa» y una cuadrícula sobre las superficies que detecta el visor (amarilla en mesas, azul en el piso). Mira hacia la mesa: un anillo amarillo con la huella de la experiencia se apoya sobre ella.
3. **Pellizca** (pulgar + índice) para colocar ahí la experiencia. Si no se detecta nada en 5 s, el pellizco la coloca sobre una mesa virtual delante de ti. Después, la maqueta se mueve y se agranda con las manos (ver arriba).
4. **Botones**: se tocan con la **punta del índice** o se pellizcan a distancia.
5. **Solo zona rural (Cauca, con Mateo) y dos objetos: radio y linterna.** La zona urbana, el selector de zonas, el teléfono y la sección «Preparación» se quitaron. «Comenzar» lleva directo a Mateo con la radio y la linterna sobre la mesa.
6. **Prácticas con las manos** (como en las imágenes de referencia):
   - **Radio**: entre tus dos manos. Al empezar, su ancho se ajusta a la distancia entre tus palmas y después sigue a tus manos (`radioPose` en `public/ff/app.js`).
     **Toca la perilla izquierda** con la yema de un dedo para encenderla; **toma la perilla derecha con el pulgar y el índice y gira la muñeca**: la perilla gira con tus dedos, la radio pasa a FM y el dial avanza hasta la emisora (un cuarto de vuelta). Con la señal clara suena la canción. Mientras un dedo está sobre una perilla, la radio se queda quieta.
     Al continuar, la tarjeta solo tiene el botón **«Linterna»**, que lleva directo a la práctica de la linterna.
   - **Linterna**: empuñada en tu mano derecha con el **interruptor bajo la yema del pulgar derecho** (`torchFit`): se enciende mientras hundes el pulgar sobre el botón (o mientras pellizcas). Corto = punto, largo = raya.
     Al formar SOS (o escribir nueve puntos y rayas) aparece **«Terminar práctica»**, que muestra «¡Recorrido terminado!».
   - En el computador: clic en la perilla izquierda de la radio para encenderla y en la derecha para girarla (30° por clic).
   - Las articulaciones de los dedos se leen con `FFX.hands.joint(lado, "thumb-tip" | "index-finger-tip", v)` (`src/main.js`).

## Qué cambió respecto de la versión anterior

- **Sin VR**: un solo botón (AR). Los cielos y los escenarios de Blender no se muestran: se ve el cuarto real.
- **Nada flota**: la raíz del contenido se coloca en el punto de la mesa (y = 0 = superficie). Los personajes (30 cm) y los objetos se apoyan en la mesa; las tarjetas están de pie con un soporte (`stand` en `public/ff/ui.js`); «¿Por qué el Cauca y Cali?» está acostada como un individual. El objeto protagonista gira sobre una base en la mesa.
- **Personajes caminando**: Mateo o Valeria caminan por el fondo de la mesa (`walkUpdate` en `public/ff/app.js`, usa `api.walk` de `js/characters-3d.js`), se detienen a mirarte y siguen. Durante la práctica dicen la instrucción de cada paso en un globo que los sigue (`coach` / `practiceLine`).
- **Audio original** de la radio (página de prueba educativa, con derechos de autor: no publicar así): en el Cauca «Si Tu Amor No Vuelve» (`assets/audio/radio-cancion.mp3`) y en Cali la tanda comercial de RCN Radio Cali (`assets/audio/radio-rcn-cali.mp3`). Bien sintonizada suena limpia, sin filtro ni estática (`js/audio.js`).

## Archivos

- `src/main.js`: mundo de IWSDK en AR (manos, planos, hit-test), **escaneo y colocación** sobre la mesa, mesa virtual del computador y ayudas de manos (`FFX.hands`, `FFX.placement`).
- `src/shim.js`: puente entre la lógica (antes A-Frame) y las entidades de IWSDK; cada botón es `RayInteractable` + `PokeInteractable`.
- `public/ff/app.js` y `public/ff/ui.js`: recorrido, distribución sobre la mesa, objeto en las manos, caminata y paneles.
- Textos, personajes, sonidos y modelos se leen de `../js` y `../assets` (la página original).
- `npm run build` genera `dist/` para publicarla en un hosting con HTTPS. Depuración en la consola: `FFApp.state()`, `FFApp.act('go:rural')`.
