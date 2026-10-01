# Verificación de punta a punta en Chromium (viewport de celular).
# Uso: npm run build && npx vite preview --port 4173  (en otra terminal)
#      pip install playwright && playwright install chromium
#      python e2e/verificar.py
import json, re, sys, os
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get("URL", "http://localhost:4173/")
OUT = os.path.join(os.path.dirname(__file__), "capturas")
os.makedirs(OUT, exist_ok=True)
log = []
def ok(msg):
    log.append("OK  " + msg); print("OK ", msg)

def score(page):
    games = page.locator(".scoreboard td.col-games").all_inner_texts()
    pts = page.locator(".scoreboard td.col-points").all_inner_texts()
    return games, pts

def act(page, player, action):
    page.get_by_role("radio", name=re.compile(player)).click()
    page.locator("button.action", has_text=action).click()

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, accept_downloads=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    expect(page.get_by_text("Todavía no hay partidos")).to_be_visible()
    page.screenshot(path=f"{OUT}/01-inicio.png")
    ok("inicio vacío, sin datos de demostración")

    # Crear partido
    page.get_by_role("button", name="+ Nuevo partido").click()
    page.get_by_role("button", name="Empezar partido").click()
    expect(page.get_by_text("Completá los dos nombres.")).to_be_visible()
    ok("valida nombres vacíos")
    inputs = page.locator("input.input")
    inputs.nth(0).fill("Ana")
    inputs.nth(1).fill("Bea")
    page.locator("label.seg", has_text="Super tie-break").click()
    page.screenshot(path=f"{OUT}/02-config.png", full_page=True)
    page.get_by_role("button", name="Empezar partido").click()
    expect(page.locator(".score-foot")).to_contain_text("Saca Ana")
    ok("partido creado, saca Ana")

    # Acciones deshabilitadas sin jugador
    expect(page.locator("button.action", has_text="Ace")).to_be_disabled()
    # Bea no puede hacer ace (no saca)
    page.get_by_role("radio", name=re.compile("Bea")).click()
    expect(page.locator("button.action", has_text="Ace")).to_be_disabled()
    expect(page.locator("button.action", has_text="Doble falta")).to_be_disabled()
    expect(page.locator("button.action", has_text="Ace")).to_contain_text("Solo Ana (saca)")
    ok("ace/doble falta bloqueados para el restador")
    page.screenshot(path=f"{OUT}/03-seleccion.png")
    page.get_by_role("radio", name=re.compile("Bea")).click()  # deselecciona

    act(page, "Ana", "Ace")
    expect(page.locator(".last-point")).to_contain_text("Punto para Ana: ace.")
    expect(page.locator(".last-point")).to_contain_text("Golpe: saque.")
    act(page, "Bea", "Error no forzado")
    expect(page.locator(".last-point")).to_contain_text("Punto para Ana: error no forzado de Bea.")
    page.locator(".last-point .chip", has_text="Revés").click()
    expect(page.locator(".last-point .chip.on")).to_have_text("Revés")
    ok("error suma al rival; golpe opcional agregado después")
    act(page, "Ana", "Golpe ganador")
    page.locator(".last-point .chip", has_text="Derecha").click()
    g, pts = score(page)
    assert pts == ["40", "0"], pts
    page.screenshot(path=f"{OUT}/04-registro.png")
    act(page, "Ana", "Punto ganado sin detalle")
    g, pts = score(page)
    assert g == ["1", "0"] and pts == ["0", "0"], (g, pts)
    expect(page.locator(".score-foot")).to_contain_text("Saca Bea")
    ok("game 1–0 y rota el saque a Bea")

    # Historial con cierre explícito
    page.get_by_role("tab", name=re.compile("Historial")).click()
    first = page.locator(".history li").first
    expect(first).to_contain_text("#4")
    expect(first).to_contain_text("Game para Ana (1–0)")
    expect(first).to_contain_text("40–0 → 1–0 · 0–0")
    expect(page.locator(".history li").nth(2)).to_contain_text("Error no forzado de Bea · Revés")
    page.screenshot(path=f"{OUT}/05-historial.png")
    ok("historial muestra cierre de game y golpe")

    # Corregir último punto: fue error no forzado de Ana
    page.get_by_role("button", name="✎ Corregir último").click()
    dlg = page.get_by_role("dialog")
    dlg.locator(".edit-actions .seg", has_text="Error no forzado").click()
    expect(dlg).to_contain_text("Punto para Bea: error no forzado de Ana.")
    page.screenshot(path=f"{OUT}/06-corregir.png")
    dlg.get_by_role("button", name="Guardar corrección").click()
    g, pts = score(page)
    assert g == ["0", "0"] and pts == ["40", "15"], (g, pts)
    expect(page.locator(".score-foot")).to_contain_text("Saca Ana")
    ok("corrección recalcula: 0–0, 40–15, vuelve a sacar Ana")

    # Conflicto: game para Ana, ace de Bea, luego cambiar el punto de game
    page.get_by_role("tab", name="Registro").click()
    act(page, "Ana", "Golpe ganador")  # punto 5 → game Ana
    act(page, "Bea", "Ace")            # punto 6, saca Bea
    page.get_by_role("tab", name=re.compile("Historial")).click()
    page.locator(".history li", has_text="#5").get_by_role("button", name="Editar").click()
    dlg = page.get_by_role("dialog")
    dlg.locator(".segmented .seg", has_text="Bea").click()
    dlg.get_by_role("button", name="Guardar corrección").click()
    expect(dlg.get_by_role("alert")).to_contain_text("No se aplicó la corrección.")
    expect(dlg.get_by_role("alert")).to_contain_text("Punto 6: ace atribuido a Bea, pero en ese punto saca Ana.")
    page.screenshot(path=f"{OUT}/07-conflicto.png")
    dlg.get_by_role("button", name="Cancelar").click()
    g, pts = score(page)
    assert g == ["1", "0"] and pts == ["0", "15"], (g, pts)
    ok("corrección conflictiva rechazada sin modificar datos")

    # Deshacer
    page.get_by_role("button", name="↶ Deshacer").click()
    expect(page.locator(".notice")).to_contain_text("Se deshizo el punto 6")
    g, pts = score(page)
    assert pts == ["0", "0"], pts
    ok("deshacer quita el ace")

    # Recargar
    page.reload()
    g, pts = score(page)
    assert g == ["1", "0"] and pts == ["0", "0"], (g, pts)
    expect(page.locator(".score-foot")).to_contain_text("Saca Bea")
    ok("tras recargar se restaura el partido abierto")

    # Volver y retomar
    page.get_by_role("button", name="← Partidos").click()
    item = page.locator(".match-item").first
    expect(item).to_contain_text("En curso")
    expect(item).to_contain_text("5 puntos")
    page.screenshot(path=f"{OUT}/08-guardados.png")
    item.get_by_role("button", name="Retomar").click()
    g, _ = score(page)
    assert g == ["1", "0"]
    ok("lista de guardados y retomar")

    # Estadísticas
    page.get_by_role("tab", name="Estadísticas").click()
    table = page.locator(".stats-table").first
    row = lambda label: table.locator("tr").filter(has=page.locator("th", has_text=re.compile("^" + re.escape(label) + "$"))).first.locator("td").all_inner_texts()
    assert row("Puntos ganados") == ["4 (80%)", "1 (20%)"], row("Puntos ganados")
    assert row("Aces") == ["1", "0"], row("Aces")
    assert row("Golpes ganadores") == ["2", "0"], row("Golpes ganadores")
    assert row("Errores no forzados") == ["1", "1"], row("Errores no forzados")
    assert row("Ganados al saque") == ["4/5 (80%)", "—"], row("Ganados al saque")
    assert row("Ganados a la devolución") == ["—", "1/5 (20%)"], row("Ganados a la devolución")
    expect(page.locator(".stats")).to_contain_text("Derecha")
    expect(page.locator(".stats")).to_contain_text("no registra primer saque")
    page.screenshot(path=f"{OUT}/09-estadisticas.png", full_page=True)
    ok("estadísticas correctas (puntos, aces, winners, errores, saque/devolución, por golpe)")

    # Exportar
    with page.expect_download() as d:
        page.get_by_role("button", name="Exportar").click()
    path = d.value.path()
    data = json.load(open(path))
    assert data["schema"] == "punto-a-punto/match" and data["schemaVersion"] == 1 and len(data["match"]["events"]) == 5
    export_path = f"{OUT}/export.json"; json.dump(data, open(export_path, "w"))
    ok(f"exporta JSON con versión de esquema ({d.value.suggested_filename})")

    # Eliminar con confirmación
    page.get_by_role("button", name="← Partidos").click()
    page.locator(".match-item").first.get_by_role("button", name="Eliminar").click()
    expect(page.get_by_role("dialog")).to_contain_text("No se puede deshacer")
    page.get_by_role("dialog").get_by_role("button", name="Cancelar").click()
    expect(page.locator(".match-item")).to_have_count(1)
    page.locator(".match-item").first.get_by_role("button", name="Eliminar").click()
    page.get_by_role("dialog").get_by_role("button", name="Eliminar").click()
    expect(page.locator(".match-item")).to_have_count(0)
    ok("eliminar pide confirmación")

    # Importar inválido y válido
    bad = f"{OUT}/bad.json"
    bd = json.loads(json.dumps(data)); bd["match"]["events"][0]["actor"] = 1  # ace del restador
    json.dump(bd, open(bad, "w"))
    page.get_by_test_id("import-input").set_input_files(bad)
    expect(page.locator(".flash")).to_contain_text("No se importó: Historial inconsistente")
    page.get_by_test_id("import-input").set_input_files(export_path)
    expect(page.locator(".flash")).to_contain_text("Partido importado: Ana vs Bea (5 puntos)")
    page.get_by_test_id("import-input").set_input_files(export_path)
    expect(page.locator(".flash")).to_contain_text("se importó como copia")
    expect(page.locator(".match-item")).to_have_count(2)
    ok("importación valida historial; id repetido se importa como copia")

    # Partido a un set hasta el final
    page.get_by_role("button", name="+ Nuevo partido").click()
    page.locator("input.input").nth(0).fill("Carla")
    page.locator("input.input").nth(1).fill("Dana")
    page.locator("label.seg", has_text="Un set").click()
    page.locator("label.seg", has_text="Punto de oro").click()
    page.get_by_role("button", name="Empezar partido").click()
    # 6-6 alternando, luego tie-break 7-0 para Dana
    for gi in range(12):
        who = "Carla" if gi % 2 == 0 else "Dana"
        for _ in range(4): act(page, who, "Punto ganado sin detalle")
    expect(page.locator(".score-foot .note")).to_have_text("Tie-break")
    expect(page.locator(".score-foot")).to_contain_text("Saca Carla")
    act(page, "Dana", "Golpe ganador")
    expect(page.locator(".score-foot")).to_contain_text("Saca Dana")
    act(page, "Dana", "Golpe ganador")
    expect(page.locator(".score-foot")).to_contain_text("Saca Dana")
    act(page, "Dana", "Golpe ganador")
    expect(page.locator(".score-foot")).to_contain_text("Saca Carla")
    page.screenshot(path=f"{OUT}/10-tiebreak.png")
    ok("tie-break en 6–6 con orden de saque 1-2-2")
    for _ in range(4): act(page, "Dana", "Golpe ganador")
    expect(page.locator(".score-foot")).to_contain_text("Partido terminado · Ganó Dana")
    expect(page.get_by_text("No se pueden cargar más puntos")).to_be_visible()
    expect(page.locator("button.action")).to_have_count(0)
    expect(page.get_by_role("button", name="↶ Deshacer")).to_be_enabled()
    expect(page.get_by_role("button", name="✎ Corregir último")).to_be_enabled()
    page.screenshot(path=f"{OUT}/11-final.png")
    page.get_by_role("tab", name=re.compile("Historial")).click()
    expect(page.locator(".history li").first).to_contain_text("Set 1 para Dana 6–7(0)")
    expect(page.locator(".history li").first).to_contain_text("Partido para Dana")
    ok("final de partido bloquea puntos y mantiene deshacer/corregir")
    page.get_by_role("button", name="↶ Deshacer").click()
    expect(page.locator(".score-foot")).to_contain_text("Saca")
    page.get_by_role("tab", name="Registro").click()
    expect(page.locator("button.action")).to_have_count(7)
    ok("deshacer el punto final reabre el partido")

    # Escritorio
    dctx = b.new_context(viewport={"width": 1280, "height": 860})
    # copiar almacenamiento
    state = ctx.storage_state()
    dctx.close()
    dctx = b.new_context(viewport={"width": 1280, "height": 860}, storage_state=state)
    dp = dctx.new_page(); dp.goto(URL)
    expect(dp.locator(".match-layout")).to_be_visible()
    dp.screenshot(path=f"{OUT}/12-escritorio.png")
    ok("layout de escritorio en dos columnas")

    # Falla de almacenamiento
    fctx = b.new_context(viewport={"width": 390, "height": 844})
    fctx.add_init_script("Storage.prototype.setItem = function(){ throw new DOMException('quota','QuotaExceededError') }")
    fp = fctx.new_page(); fp.goto(URL)
    expect(fp.locator(".storage-alert")).to_contain_text("almacenamiento local no está disponible")
    fp.screenshot(path=f"{OUT}/13-sin-almacenamiento.png")
    ok("avisa si el almacenamiento falla")

    # Chequeo de tamaños táctiles
    small = page.evaluate("""() => [...document.querySelectorAll('button, .seg')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 48).map(e => e.textContent.trim().slice(0,30))""")
    assert not small, small
    ok("todos los botones visibles miden ≥ 48 px de alto")

    assert not errors, errors
    ok("sin errores de JavaScript en consola")
    b.close()
print("\n".join(log))
