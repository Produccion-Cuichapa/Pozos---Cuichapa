#!/usr/bin/env python3

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


DATABASE_URL = (
    "https://pozos-cuichapa-default-rtdb.firebaseio.com"
)

TIMEZONE = ZoneInfo("America/Mexico_City")

# Se conserva desde este instante en adelante.
KEEP_FROM = datetime(
    2026, 7, 2, 0, 0, 0,
    tzinfo=TIMEZONE
)

# Colecciones históricas que sí pueden limpiarse.
HISTORICAL_COLLECTIONS = [
    "reportes",
    "alarmas",
    "correcciones",
    "revisionesReportes",
    "whatsappSentRegistry",
    "alarmDedupeRegistry",
    "correctionDedupeRegistry",
]

FIREBASE_PUSH_CHARS = (
    "-0123456789"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "_abcdefghijklmnopqrstuvwxyz"
)


def request_json(
    path: str,
    method: str = "GET",
    payload=None,
):
    token = os.environ.get("ACCESS_TOKEN", "").strip()

    if not token:
        raise RuntimeError(
            "Falta ACCESS_TOKEN. Ejecuta primero "
            "gcloud auth print-access-token."
        )

    encoded_path = "/".join(
        urllib.parse.quote(part, safe="")
        for part in path.strip("/").split("/")
        if part
    )

    if encoded_path:
        url = f"{DATABASE_URL}/{encoded_path}.json"
    else:
        url = f"{DATABASE_URL}/.json"

    url += "?" + urllib.parse.urlencode({
        "access_token": token
    })

    data = None
    headers = {
        "Accept": "application/json",
    }

    if payload is not None:
        data = json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")

        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(
            req,
            timeout=180,
        ) as response:
            raw = response.read()

    except urllib.error.HTTPError as exc:
        body = exc.read().decode(
            "utf-8",
            errors="replace",
        )
        raise RuntimeError(
            f"Firebase respondió HTTP {exc.code}: {body}"
        ) from exc

    if not raw:
        return None

    return json.loads(raw.decode("utf-8"))


def firebase_push_timestamp(key: str):
    """
    Los primeros 8 caracteres de un Firebase Push ID
    codifican el timestamp en milisegundos.
    """
    key = str(key or "")

    if len(key) < 20:
        return None

    first = key[:8]

    if any(
        char not in FIREBASE_PUSH_CHARS
        for char in first
    ):
        return None

    value = 0

    for char in first:
        value = (
            value * 64
            + FIREBASE_PUSH_CHARS.index(char)
        )

    try:
        return datetime.fromtimestamp(
            value / 1000,
            tz=TIMEZONE,
        )
    except (OverflowError, OSError, ValueError):
        return None


def numeric_timestamp(value):
    if isinstance(value, bool):
        return None

    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    if number <= 0:
        return None

    # Milisegundos frente a segundos.
    if number > 10_000_000_000:
        number /= 1000

    try:
        return datetime.fromtimestamp(
            number,
            tz=TIMEZONE,
        )
    except (OverflowError, OSError, ValueError):
        return None


def parse_date_string(value):
    text = str(value or "").strip()

    if not text:
        return None

    # Timestamp numérico como texto.
    if re.fullmatch(r"\d{10,16}", text):
        return numeric_timestamp(text)

    # ISO 8601.
    iso = text.replace("Z", "+00:00")

    try:
        parsed = datetime.fromisoformat(iso)

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=TIMEZONE)
        else:
            parsed = parsed.astimezone(TIMEZONE)

        return parsed
    except ValueError:
        pass

    # dd/mm/yyyy, dd-mm-yyyy, opcionalmente con hora.
    match = re.search(
        r"\b"
        r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})"
        r"(?:\s+"
        r"(\d{1,2}):(\d{2})"
        r"(?:\s*(a\.?m\.?|p\.?m\.?|am|pm))?"
        r")?",
        text,
        flags=re.IGNORECASE,
    )

    if match:
        day = int(match.group(1))
        month = int(match.group(2))
        year = int(match.group(3))
        hour = int(match.group(4) or 0)
        minute = int(match.group(5) or 0)
        am_pm = (match.group(6) or "").lower()

        if "p" in am_pm and hour < 12:
            hour += 12
        elif "a" in am_pm and hour == 12:
            hour = 0

        try:
            return datetime(
                year,
                month,
                day,
                hour,
                minute,
                tzinfo=TIMEZONE,
            )
        except ValueError:
            return None

    # yyyy-mm-dd aunque venga mezclado dentro de texto.
    match = re.search(
        r"\b(\d{4})-(\d{2})-(\d{2})\b",
        text,
    )

    if match:
        try:
            return datetime(
                int(match.group(1)),
                int(match.group(2)),
                int(match.group(3)),
                tzinfo=TIMEZONE,
            )
        except ValueError:
            return None

    return None


def record_datetime(record_id, record):
    if not isinstance(record, dict):
        return firebase_push_timestamp(record_id)

    date_fields = [
        "timestamp",
        "createdAt",
        "created_at",
        "fechaHora",
        "fechaCreacion",
        "sentAt",
        "sent_at",
        "updatedAt",
        "updated_at",
        "revisadoAt",
        "corregidoAt",
        "whatsappSentAt",
        "fecha",
        "date",
        "horaEnvio",
    ]

    for field in date_fields:
        value = record.get(field)

        if value in (None, ""):
            continue

        if isinstance(value, (int, float)):
            result = numeric_timestamp(value)
        else:
            result = parse_date_string(value)

        if result:
            return result

    # Algunos registros traen la fecha únicamente en el mensaje.
    text_fields = [
        "msg",
        "mensaje",
        "observaciones",
        "descripcion",
        "nota",
        "motivo",
    ]

    for field in text_fields:
        result = parse_date_string(record.get(field))

        if result:
            return result

    # IDs personalizados con timestamp.
    id_match = re.search(
        r"(?<!\d)(\d{13})(?!\d)",
        str(record_id),
    )

    if id_match:
        result = numeric_timestamp(id_match.group(1))

        if result:
            return result

    return firebase_push_timestamp(record_id)


def linked_report_ids(record):
    if not isinstance(record, dict):
        return set()

    fields = [
        "reportId",
        "reporteId",
        "idReporte",
        "originalReportId",
        "reporteOriginalId",
        "parentReportId",
    ]

    return {
        str(record[field])
        for field in fields
        if record.get(field) not in (None, "")
    }


def linked_alarm_ids(record):
    if not isinstance(record, dict):
        return set()

    fields = [
        "alarmId",
        "alarmaId",
        "idAlarma",
        "originalAlarmId",
    ]

    return {
        str(record[field])
        for field in fields
        if record.get(field) not in (None, "")
    }


def collection_dict(root, name):
    value = root.get(name)

    return value if isinstance(value, dict) else {}


def build_plan(root):
    plan = {
        name: {}
        for name in HISTORICAL_COLLECTIONS
    }

    unresolved = {
        name: []
        for name in HISTORICAL_COLLECTIONS
    }

    deleted_report_ids = set()
    deleted_alarm_ids = set()

    # 1. Reportes
    for record_id, record in collection_dict(
        root,
        "reportes",
    ).items():
        date = record_datetime(record_id, record)

        if date and date < KEEP_FROM:
            plan["reportes"][record_id] = {
                "date": date.isoformat(),
                "reason": "fecha anterior al 02/07/2026",
            }
            deleted_report_ids.add(str(record_id))
        elif not date:
            unresolved["reportes"].append(str(record_id))

    # 2. Alarmas
    for record_id, record in collection_dict(
        root,
        "alarmas",
    ).items():
        date = record_datetime(record_id, record)

        if date and date < KEEP_FROM:
            plan["alarmas"][record_id] = {
                "date": date.isoformat(),
                "reason": "fecha anterior al 02/07/2026",
            }
            deleted_alarm_ids.add(str(record_id))
        elif not date:
            unresolved["alarmas"].append(str(record_id))

    # 3. Colecciones relacionadas
    for collection in HISTORICAL_COLLECTIONS:
        if collection in ("reportes", "alarmas"):
            continue

        for record_id, record in collection_dict(
            root,
            collection,
        ).items():
            date = record_datetime(record_id, record)
            report_links = linked_report_ids(record)
            alarm_links = linked_alarm_ids(record)

            reason = None

            if date and date < KEEP_FROM:
                reason = "fecha anterior al 02/07/2026"
            elif report_links & deleted_report_ids:
                reason = "vinculado a un reporte eliminado"
            elif alarm_links & deleted_alarm_ids:
                reason = "vinculado a una alarma eliminada"
            elif (
                collection == "revisionesReportes"
                and str(record_id) in deleted_report_ids
            ):
                reason = "revisión del reporte eliminado"

            if reason:
                plan[collection][record_id] = {
                    "date": date.isoformat() if date else None,
                    "reason": reason,
                }
            elif not date:
                unresolved[collection].append(
                    str(record_id)
                )

    return plan, unresolved


def print_summary(plan, unresolved):
    print()
    print("=" * 66)
    print("VISTA PREVIA DE ELIMINACIÓN")
    print("=" * 66)
    print(
        "Se conservarán registros desde:",
        KEEP_FROM.isoformat(),
    )
    print()

    grand_total = 0

    for collection in HISTORICAL_COLLECTIONS:
        count = len(plan.get(collection, {}))
        grand_total += count
        unresolved_count = len(
            unresolved.get(collection, [])
        )

        print(
            f"/{collection:<26} "
            f"borrar: {count:<6} "
            f"sin fecha verificable: {unresolved_count}"
        )

    print("-" * 66)
    print("TOTAL A BORRAR:", grand_total)
    print()

    return grand_total


def apply_plan(plan):
    results = {}

    for collection in HISTORICAL_COLLECTIONS:
        ids = list(plan.get(collection, {}))

        if not ids:
            results[collection] = 0
            continue

        # PATCH con null elimina únicamente esos hijos.
        payload = {
            record_id: None
            for record_id in ids
        }

        request_json(
            collection,
            method="PATCH",
            payload=payload,
        )

        results[collection] = len(ids)
        print(
            f"✅ /{collection}: "
            f"{len(ids)} registros eliminados"
        )

    return results


def verify():
    current_root = request_json("") or {}
    plan, unresolved = build_plan(current_root)

    remaining = sum(
        len(records)
        for records in plan.values()
    )

    return remaining, unresolved


def main():
    timestamp = datetime.now(
        TIMEZONE
    ).strftime("%Y%m%d_%H%M%S")

    backup_path = Path(
        f"respaldo_firebase_antes_limpieza_{timestamp}.json"
    )

    plan_path = Path(
        f"plan_borrado_hasta_01jul2026_{timestamp}.json"
    )

    print("Descargando respaldo completo de Firebase...")
    root = request_json("") or {}

    backup_path.write_text(
        json.dumps(
            root,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"✅ Respaldo guardado: {backup_path}")

    plan, unresolved = build_plan(root)

    plan_path.write_text(
        json.dumps(
            {
                "keepFrom": KEEP_FROM.isoformat(),
                "delete": plan,
                "unresolved": unresolved,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"✅ Plan guardado: {plan_path}")

    total = print_summary(plan, unresolved)

    if total == 0:
        print(
            "No encontré registros verificables "
            "anteriores al 02/07/2026."
        )
        return

    print(
        "IMPORTANTE: los registros sin fecha verificable "
        "NO se borrarán automáticamente."
    )
    print()
    print(
        "Escribe exactamente:"
        "\nBORRAR HASTA 01-07-2026"
    )

    confirmation = input("\nConfirmación: ").strip()

    if confirmation != "BORRAR HASTA 01-07-2026":
        print("Cancelado. No se eliminó ningún dato.")
        return

    print()
    print("Ejecutando eliminación...")

    apply_plan(plan)

    print()
    print("Verificando Firebase...")

    remaining, unresolved_after = verify()

    if remaining == 0:
        print(
            "✅ Verificación completada: no quedan "
            "registros fechados antes del 02/07/2026 "
            "en las colecciones procesadas."
        )
    else:
        print(
            f"⚠️ Quedan {remaining} registros antiguos "
            "detectables. No repitas el proceso todavía."
        )

    unresolved_total = sum(
        len(items)
        for items in unresolved_after.values()
    )

    print(
        "Registros restantes sin fecha verificable:",
        unresolved_total,
    )

    print()
    print("RESPALDO:", backup_path)
    print("PLAN:", plan_path)


if __name__ == "__main__":
    main()
