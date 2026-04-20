from __future__ import annotations

import csv
import re
import sys
from pathlib import Path


TARGET_TABLES = {"interno", "visita"}


def unescape_mysql_string(value: str) -> str:
    replacements = {
        r"\\0": "\0",
        r"\\n": "\n",
        r"\\r": "\r",
        r"\\t": "\t",
        r"\\Z": "\x1a",
        r"\\'": "'",
        r'\\"': '"',
        r"\\\\": "\\",
    }
    result = value
    for source, target in replacements.items():
        result = result.replace(source, target)
    return result


def parse_scalar(token: str):
    token = token.strip()
    if token.upper() == "NULL":
        return None
    if token.startswith("'") and token.endswith("'"):
        inner = token[1:-1]
        return unescape_mysql_string(inner)
    return token


def parse_tuple(row_text: str):
    fields: list[str] = []
    current: list[str] = []
    in_string = False
    escaped = False

    for char in row_text:
        if escaped:
            current.append(char)
            escaped = False
            continue

        if char == "\\" and in_string:
            current.append(char)
            escaped = True
            continue

        if char == "'":
            in_string = not in_string
            current.append(char)
            continue

        if char == "," and not in_string:
            fields.append("".join(current).strip())
            current = []
            continue

        current.append(char)

    if current:
        fields.append("".join(current).strip())

    return [parse_scalar(field) for field in fields]


def iter_insert_rows(values_block: str):
    row_buffer: list[str] = []
    depth = 0
    in_string = False
    escaped = False

    for char in values_block:
        if escaped:
            row_buffer.append(char)
            escaped = False
            continue

        if char == "\\" and in_string:
            row_buffer.append(char)
            escaped = True
            continue

        if char == "'":
            in_string = not in_string
            row_buffer.append(char)
            continue

        if char == "(" and not in_string:
            if depth == 0:
                row_buffer = []
            else:
                row_buffer.append(char)
            depth += 1
            continue

        if char == ")" and not in_string:
            depth -= 1
            if depth == 0:
                yield parse_tuple("".join(row_buffer))
                row_buffer = []
            else:
                row_buffer.append(char)
            continue

        if depth > 0:
            row_buffer.append(char)


def parse_dump(dump_path: Path):
    internals: list[dict[str, object]] = []
    visitors: list[dict[str, object]] = []

    current_table: str | None = None
    current_columns: list[str] = []
    current_values: list[str] = []

    insert_pattern = re.compile(r"INSERT INTO `(?P<table>[^`]+)` \((?P<columns>.+)\) VALUES", re.IGNORECASE)

    with dump_path.open("r", encoding="utf-8", errors="replace") as handle:
        for raw_line in handle:
            line = raw_line.rstrip("\n")

            if current_table:
                current_values.append(line)
                if line.rstrip().endswith(";"):
                    values_sql = "\n".join(current_values)
                    values_sql = values_sql[:-1] if values_sql.endswith(";") else values_sql
                    rows = list(iter_insert_rows(values_sql))
                    for row in rows:
                        record = {column: row[index] if index < len(row) else None for index, column in enumerate(current_columns)}
                        if current_table == "interno":
                            internals.append(
                                {
                                    "id": record.get("id"),
                                    "nombre": record.get("nombre"),
                                    "apellido": record.get("apellido"),
                                    "fecha_ingreso": record.get("fecha_ingreso"),
                                    "ubicacion": record.get("ubicacion"),
                                    "created_at": record.get("created_at"),
                                    "updated_at": record.get("updated_at"),
                                }
                            )
                        elif current_table == "visita":
                            visitors.append(
                                {
                                    "id": record.get("id"),
                                    "id_interno": record.get("id_interno"),
                                    "nombreCompleto": record.get("nombreCompleto"),
                                    "parentezco": record.get("parentezco"),
                                    "edad": record.get("edad"),
                                    "genero": record.get("genero"),
                                    "betado": record.get("betado"),
                                    "created_at": record.get("created_at"),
                                    "updated_at": record.get("updated_at"),
                                }
                            )

                    current_table = None
                    current_columns = []
                    current_values = []
                continue

            match = insert_pattern.match(line)
            if not match:
                continue

            table_name = match.group("table")
            if table_name not in TARGET_TABLES:
                continue

            current_table = table_name
            current_columns = [column.strip(" `") for column in match.group("columns").split(",")]
            current_values = [line.split(" VALUES", 1)[1].strip()]

            if line.rstrip().endswith(";"):
                values_sql = current_values[0]
                values_sql = values_sql[:-1] if values_sql.endswith(";") else values_sql
                rows = list(iter_insert_rows(values_sql))
                for row in rows:
                    record = {column: row[index] if index < len(row) else None for index, column in enumerate(current_columns)}
                    if current_table == "interno":
                        internals.append(
                            {
                                "id": record.get("id"),
                                "nombre": record.get("nombre"),
                                "apellido": record.get("apellido"),
                                "fecha_ingreso": record.get("fecha_ingreso"),
                                "ubicacion": record.get("ubicacion"),
                                "created_at": record.get("created_at"),
                                "updated_at": record.get("updated_at"),
                            }
                        )
                    elif current_table == "visita":
                        visitors.append(
                            {
                                "id": record.get("id"),
                                "id_interno": record.get("id_interno"),
                                "nombreCompleto": record.get("nombreCompleto"),
                                "parentezco": record.get("parentezco"),
                                "edad": record.get("edad"),
                                "genero": record.get("genero"),
                                "betado": record.get("betado"),
                                "created_at": record.get("created_at"),
                                "updated_at": record.get("updated_at"),
                            }
                        )
                current_table = None
                current_columns = []
                current_values = []

    return internals, visitors


def write_csv(path: Path, rows: list[dict[str, object]], fieldnames: list[str]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    if len(sys.argv) != 3:
        print("Uso: convert_legacy_dump.py <dump.sql> <output_dir>")
        raise SystemExit(1)

    dump_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])

    if not dump_path.exists():
        print(f"No existe el dump: {dump_path}")
        raise SystemExit(1)

    internals, visitors = parse_dump(dump_path)

    write_csv(
        output_dir / "legacy_interno.csv",
        internals,
        ["id", "nombre", "apellido", "fecha_ingreso", "ubicacion", "created_at", "updated_at"],
    )
    write_csv(
        output_dir / "legacy_visita.csv",
        visitors,
        ["id", "id_interno", "nombreCompleto", "parentezco", "edad", "genero", "betado", "created_at", "updated_at"],
    )

    print(f"internos={len(internals)}")
    print(f"visitas={len(visitors)}")
    print(f"output={output_dir}")


if __name__ == "__main__":
    main()
