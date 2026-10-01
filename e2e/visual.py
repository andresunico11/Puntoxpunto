# Verificación visual del marcador analógico en varios anchos y estados.
# Uso: npm run build && npx vite preview --port 4173  (en otra terminal)
#      python e2e/visual.py
import json, os
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get("URL", "http://localhost:4173/")
OUT = os.path.join(os.path.dirname(__file__), "capturas")
os.makedirs(OUT, exist_ok=True)
PREFIX = "punto-a-punto.v1"
log = []
def ok(msg):
    log.append("OK  " + msg); print("OK ", msg)

def games(winners):
    """Cada letra es un game ganado en cero por ese jugador (0/1)."""
    return [w for w in winners for _ in range(4)]

def match(mid, players, winners, fmt="bestOf3", deciding="fullSet"):
    events = [
        {"id": f"{mid}-{i}", "timestamp": "2026-10-01T12:00:00.000Z", "actor": w, "action": "won"}
        for i, w in enumerate(winners)
    ]
    return {
        "id": mid, "createdAt": "2026-10-01T12:00:00.000Z", "updatedAt": "2026-10-01T12:00:00.000Z",
        "config": {"players": players, "format": fmt, "firstServer": 0, "gameScoring": "advantage", "decidingSet": deciding},
        "events": events,
    }

alt12 = games([0, 1] * 6)  # 6–6
SCENARIOS = {
    # 4–3 y 30–15 en el primer set, como la referencia
    "normal": match("normal", ["Andrés", "Martín"], games([0, 1] * 3 + [0]) + [0, 0, 1]),
    # Set 1 cerrado, ventaja con nombres largos
    "ventaja": match("ventaja", ["Maximiliano Fernández Etcheverry", "Juan Bautista De La Fuente"],
                     games([0, 1] * 4 + [0, 0]) + games([0, 1, 0, 1]) + [0, 0, 0, 1, 1, 1, 0]),
    # Deuce
    "deuce": match("deuce", ["Ana", "Bea"], [0, 0, 0, 1, 1, 1]),
    # Set 1 7–6(5), set 2 en tie-break 9–8
    "tiebreak": match("tiebreak", ["Carla", "Dana"],
                      alt12 + [0] * 6 + [1] * 5 + [0] + alt12 + [0, 1] * 8 + [0]),
    # Super tie-break 11–10 tras 6–0 0–6
    "stb": match("stb", ["Lucía Pérez", "Sofía Gómez"],
                 games([0] * 6) + games([1] * 6) + [0, 1] * 10 + [0], deciding="superTiebreak"),
    # Partido terminado 6–4 3–6 [10–8]
    "final": match("final", ["Andrés", "Martín"],
                   games([0, 1] * 4 + [0, 0]) + games([1, 0] * 3 + [1, 1, 1]) + [0, 1] * 8 + [0, 0], deciding="superTiebreak"),
}

def storage_for(key):
    m = SCENARIOS[key]
    return {
        f"{PREFIX}.index": json.dumps([m["id"]]),
        f"{PREFIX}.match.{m['id']}": json.dumps(m),
        f"{PREFIX}.lastOpen": m["id"],
    }

CHECK = """() => {
  const vw = document.documentElement.clientWidth;
  const out = { overflowX: document.documentElement.scrollWidth > vw, problems: [] };
  for (const row of document.querySelectorAll('.sb-player')) {
    const name = row.querySelector('.sb-name').getBoundingClientRect();
    const cells = [...row.querySelectorAll('[role=cell]')];
    if (cells.length && name.right > cells[0].getBoundingClientRect().left + 0.5) out.problems.push('nombre sobre placas');
    const board = document.querySelector('.scoreboard').getBoundingClientRect();
    for (const c of cells) if (c.getBoundingClientRect().right > board.right) out.problems.push('celda fuera del tablero');
  }
  for (const e of document.querySelectorAll('button, .seg')) {
    const r = e.getBoundingClientRect();
    if (e.offsetParent && r.height < 48) out.problems.push('botón bajo: ' + e.textContent.trim().slice(0, 20));
    if (e.offsetParent && r.right > vw + 0.5) out.problems.push('botón fuera: ' + e.textContent.trim().slice(0, 20));
  }
  out.boardHeight = Math.round(document.querySelector('.scoreboard').getBoundingClientRect().height);
  return out;
}"""

with sync_playwright() as p:
    b = p.chromium.launch()
    errors = []
    for key in SCENARIOS:
        for w, h in [(360, 740), (390, 844), (430, 932), (1280, 860)]:
            mobile = w < 900
            ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mobile else 1,
                                is_mobile=mobile, has_touch=mobile)
            ctx.add_init_script(f"if (!sessionStorage.seeded) {{ sessionStorage.seeded = 1; localStorage.clear(); "
                                f"for (const [k, v] of Object.entries({json.dumps(storage_for(key))})) localStorage.setItem(k, v); }}")
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(URL)
            expect(page.locator(".scoreboard")).to_be_visible()
            page.evaluate("document.fonts.ready")
            res = page.evaluate(CHECK)
            assert not res["overflowX"], (key, w, "desborde horizontal")
            assert not res["problems"], (key, w, res["problems"])
            page.screenshot(path=f"{OUT}/rediseno-{key}-{w}.png")
            if mobile:
                # Lo último del panel no queda tapado por la barra fija
                page.evaluate("window.scrollTo(0, document.scrollingElement.scrollHeight)")
                bar = page.locator(".bottom-bar").bounding_box()
                last = page.locator(".record > *").last.bounding_box()
                assert last["y"] + last["height"] <= bar["y"] + 0.5, (key, w, "contenido tapado por la barra")
            ok(f"{key} @ {w}px: sin desbordes, tablero {res['boardHeight']} px")
            ctx.close()

    # Valores de cada estado
    def values(key):
        ctx = b.new_context(viewport={"width": 390, "height": 844})
        ctx.add_init_script(f"localStorage.clear(); for (const [k, v] of Object.entries({json.dumps(storage_for(key))})) localStorage.setItem(k, v);")
        page = ctx.new_page(); page.goto(URL)
        cells = lambda sel: [c.get_attribute("data-value") for c in page.locator(f".scoreboard {sel}").all()]
        r = (cells(".sb-set"), cells(".sb-games"), cells(".sb-points"), page.locator(".score-foot").inner_text(),
             page.locator(".sb-title").inner_text())
        ctx.close(); return r
    assert values("normal")[1:3] == (["4", "3"], ["30", "15"]), values("normal")
    assert values("deuce")[2:4] == (["40", "40"], values("deuce")[3]) and "DEUCE" in values("deuce")[3].upper()
    v = values("ventaja"); assert v[0] == ["6", "4"] and v[1] == ["2", "2"] and v[2] == ["AD", "40"], v
    v = values("tiebreak"); assert v[0] == ["7", "6"] and v[2] == ["9", "8"] and "TIE-BREAK" in v[4].upper(), v
    v = values("stb"); assert v[1] == [] and v[2] == ["11", "10"] and "SUPER" in v[4].upper(), v
    v = values("final"); assert v[0] == ["6", "3", "10", "4", "6", "8"] and v[2] == [] and "Ganó Andrés" in v[3], v
    ok("valores del tablero: 30–15, deuce, ventaja, tie-break 9–8, super tie-break 11–10, final 6–4 3–6 [10–8]")

    # Solo gira la placa que cambió; con movimiento reducido no hay animación
    for reduced in (False, True):
        ctx = b.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce" if reduced else "no-preference")
        ctx.add_init_script(f"if (!sessionStorage.seeded) {{ sessionStorage.seeded = 1; localStorage.clear(); for (const [k, v] of Object.entries({json.dumps(storage_for('normal'))})) localStorage.setItem(k, v); }}")
        page = ctx.new_page(); page.goto(URL)
        assert page.locator(".plate-face.flip").count() == 0
        page.get_by_role("radio", name="Andrés").click()
        page.locator("button.action", has_text="Golpe ganador").click()
        flips = page.locator(".plate-face.flip")
        assert flips.count() == 1 and flips.first.inner_text() == "4", flips.all_inner_texts()
        anim = flips.first.evaluate("e => getComputedStyle(e).animationName")
        assert anim == ("none" if reduced else "plate-flip"), anim
        # El valor nuevo ya está y los controles responden enseguida
        page.get_by_role("radio", name="Martín").click()
        expect(page.get_by_role("radio", name="Martín")).to_have_attribute("aria-checked", "true")
        if not reduced:
            page.screenshot(path=f"{OUT}/rediseno-seleccion-390.png")
        ok(f"solo gira la placa que cambió ({'movimiento reducido: sin animación' if reduced else 'animación plate-flip'})")
        ctx.close()

    assert not errors, errors
    ok("sin errores de JavaScript")
    b.close()
print("\n".join(log))
