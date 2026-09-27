// ============================================
// CARTA · NOCHE ESTRELLADA
// - Dibuja un cielo detallado en el <canvas id="cielo">: estrellas de distintos
//   tamaños y colores que titilan, se desplazan despacio y flotan un poquito.
// - De vez en cuando cruza una estrella fugaz.
// - Revela la carta y sus párrafos a medida que se scrollea.
// Pensado primero para celular. Todos los colores se leen del :root en style.css.
// ============================================

// ============================================
// AJUSTES DEL CIELO (cambiá estos números para ajustar el movimiento)
// ============================================
const VELOCIDAD_DERIVA = 9;       // Píxeles por segundo que avanzan las estrellas más cercanas (las lejanas van más lento)
const DIRECCION_DERIVA = { x: 1, y: -0.35 }; // Hacia dónde se mueve el cielo: a la derecha y apenas hacia arriba
const FLOTACION_MAXIMA = 2.5;     // Cuántos píxeles como máximo "flota" cada estrella alrededor de su lugar
const PARALLAX_SCROLL = 0.05;     // Cuánto acompañan las estrellas al scroll (profundidad)
const FUGAZ_MINIMO = 5;           // Segundos mínimos entre estrellas fugaces
const FUGAZ_MAXIMO = 13;          // Segundos máximos entre estrellas fugaces

document.addEventListener("DOMContentLoaded", () => {
    aplicarColorDeTema();
    iniciarCielo();
    configurarBotonBajar();
    activarRevelado();
});

// Detecta si el usuario pidió menos movimiento en su sistema
const MOVIMIENTO_REDUCIDO = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ============================================
// UTILIDADES DE COLOR
// ============================================

// Lee una variable CSS del :root (ej: "--estrella-azul")
function leerVariable(nombre) {
    return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

// Convierte un color "#RRGGBB" en "R, G, B" para poder usarlo con transparencia en el canvas
function hexARgb(hex) {
    const limpio = hex.replace("#", "");
    const valor = parseInt(limpio, 16);
    return `${(valor >> 16) & 255}, ${(valor >> 8) & 255}, ${valor & 255}`;
}

// Pone el color de la barra del navegador (móviles) igual al fondo, usando la variable del CSS
function aplicarColorDeTema() {
    const meta = document.getElementById("color-tema");
    if (meta) meta.setAttribute("content", leerVariable("--color-fondo"));
}

// ============================================
// CIELO ESTRELLADO (canvas)
// ============================================

function iniciarCielo() {
    const canvas = document.getElementById("cielo");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Paleta de estrellas sacada del CSS, con su "peso" (qué tan seguido aparece cada color)
    const paleta = [
        { rgb: hexARgb(leerVariable("--estrella-blanca")), peso: 0.45 },
        { rgb: hexARgb(leerVariable("--estrella-azul")), peso: 0.30 },
        { rgb: hexARgb(leerVariable("--estrella-celeste")), peso: 0.17 },
        { rgb: hexARgb(leerVariable("--estrella-calida")), peso: 0.08 }
    ];
    const colorFugaz = hexARgb(leerVariable("--estrella-fugaz"));

    const MARGEN = 12; // Las estrellas salen por un borde y entran por el opuesto sin "aparecer de golpe"

    let ancho = 0;
    let alto = 0;
    let anchoAnterior = 0;
    let escala = 1;      // Achica fugaces y halos en pantallas chicas
    let estrellas = [];
    let fugaces = [];
    let proximaFugaz = 0;
    let ultimoTiempo = 0;

    // Elige un color al azar respetando los pesos de la paleta
    function colorAlAzar() {
        let tirada = Math.random();
        for (const color of paleta) {
            if (tirada < color.peso) return color.rgb;
            tirada -= color.peso;
        }
        return paleta[0].rgb;
    }

    // Ajusta el canvas al tamaño real del fondo (nítido en pantallas retina).
    // En celular, la barra del navegador cambia el alto al scrollear: en ese caso NO se regeneran
    // las estrellas (solo se reacomodan), así el cielo no "salta". Se regeneran solo si cambia el ancho.
    function redimensionar() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        ancho = canvas.clientWidth || window.innerWidth;
        alto = canvas.clientHeight || window.innerHeight;
        canvas.width = Math.round(ancho * dpr);
        canvas.height = Math.round(alto * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        escala = Math.max(0.6, Math.min(ancho / 900, 1));

        if (ancho !== anchoAnterior) {
            crearEstrellas();
            anchoAnterior = ancho;
        }
        if (MOVIMIENTO_REDUCIDO) dibujarCuadro(0, 0); // Sin animación: se dibuja una sola vez
    }

    // Crea las estrellas guardando su posición en proporción (0 a 1), para que se adapten a cualquier pantalla.
    // En celular se usa más densidad para que el cielo no quede vacío en una pantalla chica.
    function crearEstrellas() {
        const densidad = ancho < 600 ? 750 : 1300;
        const cantidad = Math.min(Math.round((ancho * alto) / densidad), 1100);

        // Inclinación de la vía láctea: igual que en el CSS (más parada en pantallas verticales)
        const verticalOChica = ancho < 900 && !(ancho > alto && alto <= 500);
        const angulo = (verticalOChica ? 58 : 28) * (Math.PI / 180);
        const largoBanda = Math.hypot(ancho, alto);

        estrellas = [];

        for (let i = 0; i < cantidad; i++) {
            const azar = Math.random();
            let radio, brillo, halo;

            if (azar < 0.80) {          // Polvo de estrellas lejano
                radio = Math.random() * 0.5 + 0.25;
                brillo = Math.random() * 0.35 + 0.15;
                halo = false;
            } else if (azar < 0.97) {   // Estrellas medianas
                radio = Math.random() * 0.6 + 0.7;
                brillo = Math.random() * 0.35 + 0.45;
                halo = false;
            } else {                    // Pocas estrellas brillantes con halo y destello en cruz
                radio = Math.random() * 0.7 + 1.2;
                brillo = Math.random() * 0.2 + 0.75;
                halo = true;
            }

            // Posición: el 35% se concentra sobre la franja de la vía láctea
            let x = Math.random() * ancho;
            let y = Math.random() * alto;
            if (Math.random() < 0.35) {
                const recorrido = (Math.random() - 0.5) * largoBanda;               // A lo largo de la franja
                const ancho_banda = (Math.random() - 0.5) * Math.min(ancho, alto) * 0.35; // A lo ancho de la franja
                x = ancho / 2 + Math.cos(angulo) * recorrido + Math.sin(angulo) * ancho_banda;
                y = alto / 2 - Math.sin(angulo) * recorrido + Math.cos(angulo) * ancho_banda;
            }

            const profundidad = Math.min(radio / 2, 1); // Las grandes están "más cerca": se mueven más rápido

            estrellas.push({
                px: x / ancho,                                   // Posición en proporción del ancho
                py: y / alto,                                    // Posición en proporción del alto
                radio,
                brillo,
                halo,
                color: colorAlAzar(),
                velocidad: Math.random() * 0.9 + 0.25,           // Qué tan rápido titila (lento)
                fase: Math.random() * Math.PI * 2,               // Para que no titilen ni floten todas juntas
                profundidad,
                deriva: VELOCIDAD_DERIVA * (0.3 + 0.7 * profundidad), // Velocidad propia de desplazamiento (parallax)
                flotacion: Math.random() * FLOTACION_MAXIMA + 0.5,    // Cuánto flota alrededor de su lugar
                ritmoFlotacion: Math.random() * 0.25 + 0.1             // Qué tan lento flota
            });
        }
    }

    // Da la vuelta en los bordes: lo que sale por un lado entra por el otro
    function envolver(valor, limite) {
        const total = limite + MARGEN * 2;
        return ((((valor + MARGEN) % total) + total) % total) - MARGEN;
    }

    // Dibuja una estrella con su titileo, su desplazamiento y su flotación
    function dibujarEstrella(e, tiempo, scroll) {
        // Titileo suave: oscila entre 55% y 100% de su brillo
        const titileo = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(tiempo * e.velocidad + e.fase));
        const alfa = e.brillo * titileo;

        // 1) Desplazamiento continuo del cielo (cada estrella a su velocidad = profundidad)
        const avance = MOVIMIENTO_REDUCIDO ? 0 : tiempo * e.deriva;
        // 2) Flotación: un pequeño vaivén circular, como si respiraran
        const flotarX = MOVIMIENTO_REDUCIDO ? 0 : Math.sin(tiempo * e.ritmoFlotacion + e.fase) * e.flotacion;
        const flotarY = MOVIMIENTO_REDUCIDO ? 0 : Math.cos(tiempo * e.ritmoFlotacion * 0.8 + e.fase) * e.flotacion;
        // 3) Parallax con el scroll
        const parallax = scroll * PARALLAX_SCROLL * e.profundidad;

        const x = envolver(e.px * ancho + avance * DIRECCION_DERIVA.x + flotarX, ancho);
        const y = envolver(e.py * alto + avance * DIRECCION_DERIVA.y + flotarY - parallax, alto);

        if (e.halo) {
            // Halo difuso alrededor de las estrellas brillantes
            const radioHalo = e.radio * 7 * escala;
            const degradado = ctx.createRadialGradient(x, y, 0, x, y, radioHalo);
            degradado.addColorStop(0, `rgba(${e.color}, ${alfa * 0.35})`);
            degradado.addColorStop(1, `rgba(${e.color}, 0)`);
            ctx.fillStyle = degradado;
            ctx.beginPath();
            ctx.arc(x, y, radioHalo, 0, Math.PI * 2);
            ctx.fill();

            // Destello en cruz muy fino
            const largo = e.radio * 6 * titileo * escala;
            ctx.strokeStyle = `rgba(${e.color}, ${alfa * 0.35})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(x - largo, y);
            ctx.lineTo(x + largo, y);
            ctx.moveTo(x, y - largo);
            ctx.lineTo(x, y + largo);
            ctx.stroke();
        }

        ctx.fillStyle = `rgba(${e.color}, ${alfa})`;
        ctx.beginPath();
        ctx.arc(x, y, e.radio, 0, Math.PI * 2);
        ctx.fill();
    }

    // ---------- ESTRELLAS FUGACES ----------

    // Programa la próxima estrella fugaz
    function programarFugaz(tiempoActual) {
        proximaFugaz = tiempoActual + FUGAZ_MINIMO + Math.random() * (FUGAZ_MAXIMO - FUGAZ_MINIMO);
    }

    // Crea una estrella fugaz que cruza en diagonal. En celular es más corta y más lenta
    // (escala), así se alcanza a ver completa en la pantalla angosta
    function crearFugaz() {
        const haciaLaDerecha = Math.random() < 0.5;
        const angulo = (Math.random() * 20 + 25) * (Math.PI / 180); // Entre 25° y 45° hacia abajo
        fugaces.push({
            x: Math.random() * ancho * 0.8 + ancho * 0.1,
            y: Math.random() * alto * 0.45,
            dx: Math.cos(angulo) * (haciaLaDerecha ? 1 : -1),
            dy: Math.sin(angulo),
            velocidad: (Math.random() * 250 + 350) * escala, // px por segundo
            largo: (Math.random() * 140 + 120) * escala,     // Largo de la estela
            vida: 0,
            duracion: Math.random() * 0.8 + 1.1              // Segundos que dura
        });
    }

    // Mueve y dibuja cada estrella fugaz, con estela degradada y cabeza brillante
    function dibujarFugaces(delta) {
        fugaces = fugaces.filter((f) => f.vida < f.duracion);

        for (const f of fugaces) {
            f.vida += delta;
            f.x += f.dx * f.velocidad * delta;
            f.y += f.dy * f.velocidad * delta;

            // Aparece y se apaga suavemente (curva seno a lo largo de su vida)
            const progreso = f.vida / f.duracion;
            const alfa = Math.sin(progreso * Math.PI);

            const colaX = f.x - f.dx * f.largo;
            const colaY = f.y - f.dy * f.largo;

            const estela = ctx.createLinearGradient(f.x, f.y, colaX, colaY);
            estela.addColorStop(0, `rgba(${colorFugaz}, ${alfa * 0.9})`);
            estela.addColorStop(1, `rgba(${colorFugaz}, 0)`);

            ctx.strokeStyle = estela;
            ctx.lineWidth = 1.3;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(f.x, f.y);
            ctx.lineTo(colaX, colaY);
            ctx.stroke();

            // Brillito en la punta
            const cabeza = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 6);
            cabeza.addColorStop(0, `rgba(${colorFugaz}, ${alfa})`);
            cabeza.addColorStop(1, `rgba(${colorFugaz}, 0)`);
            ctx.fillStyle = cabeza;
            ctx.beginPath();
            ctx.arc(f.x, f.y, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ---------- DIBUJO DE CADA CUADRO ----------

    function dibujarCuadro(tiempo, delta) {
        ctx.clearRect(0, 0, ancho, alto);
        const scroll = MOVIMIENTO_REDUCIDO ? 0 : window.scrollY;

        for (const e of estrellas) {
            dibujarEstrella(e, tiempo, scroll);
        }

        if (!MOVIMIENTO_REDUCIDO) {
            if (tiempo >= proximaFugaz) {
                crearFugaz();
                programarFugaz(tiempo);
            }
            dibujarFugaces(delta);
        }
    }

    // Bucle de animación (el navegador lo pausa solo cuando la pestaña no está visible: ahorra batería)
    let tiempoCielo = 0; // Reloj propio del cielo: al volver a la pestaña sigue desde donde quedó, sin saltos
    function animar(marca) {
        const ahora = marca / 1000;
        const delta = Math.min(ahora - ultimoTiempo, 0.05);
        ultimoTiempo = ahora;
        tiempoCielo += delta;
        dibujarCuadro(tiempoCielo, delta);
        requestAnimationFrame(animar);
    }

    // Redimensiona con una pequeña espera para no recalcular en cada píxel (incluye girar el celular)
    let temporizadorResize;
    window.addEventListener("resize", () => {
        clearTimeout(temporizadorResize);
        temporizadorResize = setTimeout(redimensionar, 150);
    });

    redimensionar();

    if (!MOVIMIENTO_REDUCIDO) {
        programarFugaz(2.5); // La primera fugaz llega entre los 7 y 15 segundos, cuando ya se leyó el título
        requestAnimationFrame((marca) => {
            ultimoTiempo = marca / 1000;
            animar(marca);
        });
    }
}

// ============================================
// BOTÓN PARA BAJAR A LA CARTA
// ============================================

function configurarBotonBajar() {
    const boton = document.getElementById("bajar");
    const carta = document.getElementById("carta");
    if (!boton || !carta) return;

    // Baja suave hasta la carta
    boton.addEventListener("click", () => {
        carta.scrollIntoView({ behavior: MOVIMIENTO_REDUCIDO ? "auto" : "smooth", block: "start" });
    });

    // Se esconde cuando se empieza a scrollear y vuelve si se sube de nuevo
    window.addEventListener("scroll", () => {
        boton.classList.toggle("oculta", window.scrollY > 40);
    }, { passive: true });
}

// ============================================
// REVELADO DE LA CARTA Y SUS PÁRRAFOS AL SCROLLEAR
// ============================================

function activarRevelado() {
    const carta = document.querySelector(".carta");
    const parrafos = document.querySelectorAll(".revelar");

    // Sin soporte de IntersectionObserver o con movimiento reducido: se muestra todo directo
    if (!("IntersectionObserver" in window) || MOVIMIENTO_REDUCIDO) {
        if (carta) carta.classList.add("visible");
        parrafos.forEach((el) => el.classList.add("visible"));
        return;
    }

    // Función común: muestra el elemento la primera vez que entra en pantalla
    const mostrar = (entradas, observador) => {
        entradas.forEach((entrada) => {
            if (entrada.isIntersecting) {
                entrada.target.classList.add("visible");
                observador.unobserve(entrada.target);
            }
        });
    };

    // La carta es muy alta en celular: aparece apenas asoma su borde (threshold 0),
    // si no habría que scrollear mucho antes de verla
    const observadorCarta = new IntersectionObserver(mostrar, { threshold: 0, rootMargin: "0px 0px -6% 0px" });
    if (carta) observadorCarta.observe(carta);

    // Los párrafos aparecen de a uno cuando ya se ve una parte
    const observadorParrafos = new IntersectionObserver(mostrar, { threshold: 0.2, rootMargin: "0px 0px -6% 0px" });
    parrafos.forEach((el) => observadorParrafos.observe(el));
}