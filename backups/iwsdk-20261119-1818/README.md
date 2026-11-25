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
  El plugin de IWSDK carga un **emulador de Meta Quest 3** con un cuarto de ejemplo: el botón «Entrar en realidad aumentada (AR)» funciona sin casco (el cuarto trae una mesa de centro que se detecta).
- **En el Meta Quest (misma red wifi):** abre en el navegador del Quest la dirección «Network» que muestra la terminal (por ejemplo `https://11.11.3.84:8081/`), acepta el aviso del certificado y toca **«Entrar en realidad aumentada (AR)»**.
  Conviene haber hecho el **Space Setup** del Quest (Configuración → Espacio físico) para que las mesas aparezcan como planos detectados.

## Cómo se usa en el Quest

1. **Deja los controles**: todo se hace con las manos (hand tracking).
2. **Escaneo de la mesa**: aparece el cartel «Escanea tu mesa» y una cuadrícula sobre las superficies que detecta el visor (amarilla en mesas, azul en el piso). Mira hacia la mesa: un anillo amarillo con la huella de la experiencia se apoya sobre ella.
3. **Pellizca** (pulgar + índice) para colocar ahí la experiencia. Si no se detecta nada en 5 s, el pellizco la coloca sobre una mesa virtual delante de ti. «Mover a otra mesa» (portada y menú de la zona) repite el escaneo.
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
