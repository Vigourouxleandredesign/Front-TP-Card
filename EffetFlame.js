(function () {
    const DELAY_MS = 1000;
    /** Moins de particules = moins de charge ; le rendu reste dense */
    const PARTICLE_COUNT = 720;
    const MIN_SPEED = 1.65;
    const MAX_SPEED = 4.15;
    const EDGE_BOOST_OUT = 2.95;
    const EDGE_BOOST_NEAR = 1.9;
    /** Écart angulaire un peu plus large pour balayer toute la surface (vx, vy restent < 0) */
    const ANGLE_SPREAD = 0.36;
    /**
     * Profondeur (px) de la zone de spawn **hors** du viewport : sous tout le bas, à droite de tout le côté droit.
     */
    function edgeThickness(w, h) {
        return Math.max(44, Math.min(w, h) * 0.08);
    }

    const SPAWN_WAVE_FRAMES = 52;
    /** À la fin de la vague : jusqu’où on remonte sur le bord droit / va à gauche sur le bas (fraction du côté) */
    const SPAWN_EDGE_FRAC = 0.07;
    const SPAWN_DEPTH_JITTER = 0.92;

    /**
     * Position hors viewport pour une progression p ∈ [0, 1] : p = 0 → coin bas-droit, p → 1 → plus à gauche (bas) et plus en haut (droite).
     */
    function spawnOutsideAtProgress(w, h, t, p, onBottom) {
        const e = Math.pow(1 - p, 0.5);
        const span = 1 - SPAWN_EDGE_FRAC;
        const depth = (0.15 + Math.random() * SPAWN_DEPTH_JITTER) * t;
        if (onBottom) {
            const x = w * (SPAWN_EDGE_FRAC + span * e);
            return { x, y: h + depth };
        }
        const y = h * (SPAWN_EDGE_FRAC + span * e);
        return { x: w + depth, y };
    }
    /** Vie plus longue : présence nettement augmentée à l’écran */
    const DECAY_MIN = 0.0014;
    const DECAY_MAX = 0.0042;
    const LIFT = 0.0068;
    /** < 1 : vitesse forte au début (life proche de 1), chute plus marquée vers la fin */
    const SPEED_EASE_POW = 0.34;
    const SPEED_FLOOR = 0.045;
    /** Taille de flamme (unités canvas) : tirage uniforme à chaque particule */
    const SIZE_MIN = 0.6;
    const SIZE_MAX = 10;

    function diagonalAngle() {
        return Math.atan2(-1, -1);
    }

    /**
     * Flamme rouge sombre — sans shadowBlur (très coûteux × centaines de particules / frame).
     */
    function drawFlame(ctx, x, y, vx, vy, size, life, hue) {
        const a = Math.max(0, life);
        const s = size * (0.55 + 0.45 * a);
        const angle = Math.atan2(vy, vx) + Math.PI / 2;
        const hBase = Math.min(20, Math.max(0, hue));

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.moveTo(0, -s * 0.95);
        ctx.bezierCurveTo(s * 0.52, -s * 0.18, s * 0.58, s * 0.42, 0, s * 0.68);
        ctx.bezierCurveTo(-s * 0.58, s * 0.42, -s * 0.52, -s * 0.18, 0, -s * 0.95);
        ctx.closePath();

        const g = ctx.createRadialGradient(0, -s * 0.12, 0, 0, s * 0.08, s * 0.95);
        const tipHue = Math.min(14, hBase + 6);
        g.addColorStop(0, `hsla(${tipHue}, 100%, 52%, ${a * 0.95})`);
        g.addColorStop(0.32, `hsla(${hBase}, 96%, 30%, ${a * 0.88})`);
        g.addColorStop(0.72, `hsla(2, 94%, 14%, ${a * 0.55})`);
        g.addColorStop(1, `hsla(0, 90%, 6%, ${a * 0.35})`);
        ctx.fillStyle = g;
        ctx.fill();

        ctx.restore();
    }

    function init() {
        const veil = document.createElement("div");
        veil.setAttribute("aria-hidden", "true");
        veil.style.cssText =
            "position:fixed;inset:0;pointer-events:none;z-index:9998;margin:0;padding:0;box-sizing:border-box;" +
            "background:radial-gradient(ellipse 95% 90% at 100% 100%," +
            "rgba(255,125,82,0.5) 0%," +
            "rgba(215,62,32,0.22) 38%," +
            "rgba(180,40,18,0.06) 58%," +
            "transparent 72%);";
        document.body.appendChild(veil);

        const canvas = document.createElement("canvas");
        canvas.setAttribute("aria-hidden", "true");
        canvas.style.cssText =
            "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;margin:0;padding:0;box-sizing:border-box;";
        document.body.appendChild(canvas);

        const ctx =
            canvas.getContext("2d", { alpha: true, desynchronized: true }) ||
            canvas.getContext("2d");
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const w = window.innerWidth;
        const h = window.innerHeight;
        const base = diagonalAngle();
        const particles = [];
        const thick = edgeThickness(w, h);
        const pMax = Math.max(1, PARTICLE_COUNT - 1);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const p = Math.min(1, Math.max(0, i / pMax + (Math.random() - 0.5) * 0.04));
            const onBottom = i % 2 === 0;
            const { x, y } = spawnOutsideAtProgress(w, h, thick, p, onBottom);
            const spawnFrame = Math.floor((i / pMax) * SPAWN_WAVE_FRAMES);

            const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
            const angle = base + (Math.random() - 0.5) * 2 * ANGLE_SPREAD;
            let vx = Math.cos(angle) * speed;
            let vy = Math.sin(angle) * speed;
            if (vx >= 0) vx = -Math.abs(vx) - 0.05;
            if (vy >= 0) vy = -Math.abs(vy) - 0.05;

            particles.push({
                x,
                y,
                spawnFrame,
                ivx: vx,
                ivy: vy,
                life: 1,
                decay: DECAY_MIN + Math.random() * (DECAY_MAX - DECAY_MIN),
                size: SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN),
                hue: Math.random() * 18,
            });
        }

        let frame = 0;
        let lastTime = performance.now();

        function step(now) {
            const deltaMs = Math.min(Math.max(now - lastTime, 0), 40);
            lastTime = now;
            const frameScale = Math.min(Math.max(deltaMs / (1000 / 60), 0.35), 2.2);

            ctx.clearRect(0, 0, w, h);
            let anyAlive = false;

            for (const p of particles) {
                if (frame < p.spawnFrame) {
                    anyAlive = true;
                    continue;
                }
                if (p.life <= 0) continue;
                anyAlive = true;

                const life = Math.max(0, p.life);
                const mult =
                    SPEED_FLOOR + (1 - SPEED_FLOOR) * Math.pow(life, SPEED_EASE_POW);
                let vx = p.ivx * mult;
                let vy = p.ivy * mult;

                const outside = p.x > w || p.y > h;
                const nearSpawnBand =
                    !outside &&
                    (p.x > w - thick * 1.4 || p.y > h - thick * 1.4);
                let boost = 1;
                if (outside) boost = EDGE_BOOST_OUT;
                else if (nearSpawnBand) boost = EDGE_BOOST_NEAR;
                vx *= boost;
                vy *= boost;

                vy -= LIFT * (0.58 + 0.42 * life) * (0.45 + 0.55 * life) * frameScale;

                p.x += vx * frameScale;
                p.y += vy * frameScale;
                p.life -= p.decay * frameScale;

                drawFlame(ctx, p.x, p.y, vx, vy, p.size, p.life, p.hue);
            }

            frame++;

            if (anyAlive) {
                requestAnimationFrame(step);
            } else {
                veil.remove();
                canvas.remove();
            }
        }

        requestAnimationFrame(step);
    }

    function scheduleInit() {
        setTimeout(init, DELAY_MS);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", scheduleInit, { once: true });
    } else {
        scheduleInit();
    }
})();
