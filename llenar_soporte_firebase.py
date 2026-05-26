"""
llenar_soporte_firebase.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Jala los reportes de Firebase Realtime Database y llena
automáticamente el Soporte Indicador (filas 3-53).

REQUISITOS:
  pip install openpyxl requests

USO:
  python llenar_soporte_firebase.py

  Opcional — llenar solo un rango de fechas:
  python llenar_soporte_firebase.py 2026-05-01 2026-05-31
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import openpyxl
import requests
import json
import sys
from datetime import datetime, date, timedelta
from collections import defaultdict

# ══════════════════════════════════════════════════════════
# CONFIGURACIÓN — edita solo esta sección
# ══════════════════════════════════════════════════════════
FIREBASE_URL  = "https://pozos-cuichapa-default-rtdb.firebaseio.com"
FIREBASE_AUTH = ""   # deja vacío si las reglas son públicas, o pon tu token
EXCEL_ENTRADA = "Soporte_Indicador_Abril_2026_2.xlsx"
EXCEL_SALIDA  = "Soporte_Indicador_ACTUALIZADO.xlsx"
# ══════════════════════════════════════════════════════════

CAMPOS = {
    "SUPER":       1,
    "NIVEL":       2,
    "TRABAJO":     3,
    "DRENAR":      4,
    # MEDICION BS2 = +5  ← no se toca
    "AFORO":       6,
    "INTERMITENTE":7,
}

def get_firebase_reportes(fecha_inicio=None, fecha_fin=None):
    """Descarga todos los reportes de Firebase."""
    url = f"{FIREBASE_URL}/reportes.json"
    params = {}
    if FIREBASE_AUTH:
        params["auth"] = FIREBASE_AUTH

    print("Descargando reportes de Firebase...")
    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"ERROR al conectar con Firebase: {e}")
        return []

    if not data:
        print("No se encontraron reportes en Firebase.")
        return []

    reportes = []
    for key, val in data.items():
        if not isinstance(val, dict):
            continue

        # Parsear fecha del reporte
        fecha_str = val.get("fecha") or val.get("date") or val.get("timestamp") or ""
        try:
            if "T" in str(fecha_str):
                fecha = datetime.fromisoformat(str(fecha_str).replace("Z","")).date()
            elif "/" in str(fecha_str):
                parts = str(fecha_str).split("/")
                fecha = date(int(parts[2]), int(parts[1]), int(parts[0]))
            elif "-" in str(fecha_str):
                fecha = date.fromisoformat(str(fecha_str)[:10])
            else:
                continue
        except:
            continue

        # Filtrar por rango si se especificó
        if fecha_inicio and fecha < fecha_inicio:
            continue
        if fecha_fin and fecha > fecha_fin:
            continue

        # Normalizar nombre del pozo
        pozo_raw = val.get("pozo") or val.get("well") or ""
        pozo = normalizar_pozo(str(pozo_raw).strip())
        if not pozo:
            continue

        # Tipo de reporte
        tipo = str(val.get("tipo") or val.get("mode") or val.get("modo") or "diario").lower()

        # Actividades — busca en varios campos posibles
        actividades = val.get("actividades") or val.get("activities") or {}
        if isinstance(actividades, str):
            try:
                actividades = json.loads(actividades)
            except:
                actividades = {}

        trabajo      = bool(actividades.get("trabajo")      or val.get("trabajo")      or val.get("work"))
        drenar       = bool(actividades.get("drenar")       or val.get("drenar")       or val.get("drain"))
        aforo        = bool(actividades.get("aforo")        or val.get("aforo")        or val.get("flow"))
        intermitente = bool(actividades.get("intermitente") or val.get("intermitente") or val.get("intermittent"))

        reportes.append({
            "fecha":       fecha,
            "pozo":        pozo,
            "tipo":        tipo,
            "trabajo":     trabajo,
            "drenar":      drenar,
            "aforo":       aforo,
            "intermitente":intermitente,
        })

    print(f"Reportes descargados: {len(reportes)}")
    return reportes


NOMBRES_COMPLETOS = {
    'manrique': 'Manrique Jimenez Perez',
    'cirilo':   'Cirilo Cancino Gomez',
    'juan carlos': 'Juan Carlos Flores Hernandez',
    'juancarlos': 'Juan Carlos Flores Hernandez',
    'm': 'Manrique Jimenez Perez',
    'c': 'Cirilo Cancino Gomez',
    'jc': 'Juan Carlos Flores Hernandez',
}

def normalizar_recorredor(nombre):
    """Devuelve el nombre completo del recorredor."""
    if not nombre:
        return nombre
    key = nombre.strip().lower()
    return NOMBRES_COMPLETOS.get(key, nombre)

def normalizar_pozo(nombre):
    """Convierte el nombre del pozo al formato del Excel: 'CUICHAPA 106D'"""
    nombre = nombre.upper().strip()
    # Si ya viene como "CUICHAPA 106D" o "C-106D" → normalizar
    nombre = nombre.replace("C-", "CUICHAPA ").replace("CUI-", "CUICHAPA ")
    if not nombre.startswith("CUICHAPA"):
        nombre = "CUICHAPA " + nombre
    # Limpiar espacios dobles
    nombre = " ".join(nombre.split())
    return nombre


def llenar_excel(reportes):
    """Llena el Excel con los reportes."""
    import os
    if not os.path.exists(EXCEL_ENTRADA):
        print(f"ERROR: No se encontró '{EXCEL_ENTRADA}'")
        return

    wb = openpyxl.load_workbook(EXCEL_ENTRADA)
    ws = wb.active

    # Mapear fecha → columna base (fila 3)
    date_col_map = {}
    for col_cells in ws.iter_cols(min_row=3, max_row=3, min_col=5):
        for cell in col_cells:
            if isinstance(cell.value, datetime):
                date_col_map[cell.value.date()] = cell.column
            elif isinstance(cell.value, date):
                date_col_map[cell.value] = cell.column

    # Mapear pozo → fila
    pozo_row_map = {}
    for row in ws.iter_rows(min_row=3, max_row=53, min_col=3, max_col=3):
        for cell in row:
            if cell.value:
                pozo_row_map[str(cell.value).strip().upper()] = cell.row

    # Agrupar reportes por (fecha, pozo)
    grupos = defaultdict(list)
    for r in reportes:
        key = (r["fecha"], r["pozo"])
        grupos[key].append(r)

    actualizados = 0
    omitidos = []

    for (fecha, pozo), lista in sorted(grupos.items()):
        if fecha not in date_col_map:
            omitidos.append(f"Fecha fuera de rango: {fecha} (pozo {pozo})")
            continue
        if pozo not in pozo_row_map:
            omitidos.append(f"Pozo no encontrado: {pozo}")
            continue

        base  = date_col_map[fecha]
        fila  = pozo_row_map[pozo]

        # SUPER = total visitas (diarias + guardia)
        super_val = len(lista)
        nivel_val = len(lista)

        # Actividades: 1 si al menos un reporte del día la marcó
        trab  = 1 if any(r["trabajo"]      for r in lista) else 0
        dren  = 1 if any(r["drenar"]       for r in lista) else 0
        aforo = 1 if any(r["aforo"]        for r in lista) else 0
        inter = 1 if any(r["intermitente"] for r in lista) else 0

        ws.cell(row=fila, column=base + CAMPOS["SUPER"]       ).value = super_val
        ws.cell(row=fila, column=base + CAMPOS["NIVEL"]       ).value = nivel_val
        ws.cell(row=fila, column=base + CAMPOS["TRABAJO"]     ).value = trab
        ws.cell(row=fila, column=base + CAMPOS["DRENAR"]      ).value = dren
        ws.cell(row=fila, column=base + CAMPOS["AFORO"]       ).value = aforo
        ws.cell(row=fila, column=base + CAMPOS["INTERMITENTE"]).value = inter

        print(f"  ✓ {pozo} | {fecha} → "
              f"SUPER={super_val} NIVEL={nivel_val} "
              f"TRAB={trab} DREN={dren} AFORO={aforo} INTER={inter}")
        actualizados += 1

    wb.save(EXCEL_SALIDA)
    print(f"\n✅ Guardado: {EXCEL_SALIDA}")
    print(f"   Pozos actualizados: {actualizados}")
    if omitidos:
        print("\n⚠️  Omitidos:")
        for o in omitidos:
            print(f"   - {o}")


def main():
    fecha_inicio = fecha_fin = None
    if len(sys.argv) >= 2:
        try:
            fecha_inicio = date.fromisoformat(sys.argv[1])
            print(f"Fecha inicio: {fecha_inicio}")
        except:
            pass
    if len(sys.argv) >= 3:
        try:
            fecha_fin = date.fromisoformat(sys.argv[2])
            print(f"Fecha fin: {fecha_fin}")
        except:
            pass

    reportes = get_firebase_reportes(fecha_inicio, fecha_fin)
    if reportes:
        llenar_excel(reportes)
    else:
        print("No hay reportes para procesar.")


if __name__ == "__main__":
    main()
