import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.db.sqlite import SQLiteStore


TABLES = ("restaurants", "imported_reviews")


def connect_database(db_path: str | None) -> sqlite3.Connection:
    if db_path is not None:
        resolved_path = Path(db_path)
    else:
        resolved_path = Path(settings.sqlite_path)
    resolved_path.parent.mkdir(parents=True, exist_ok=True)
    store = SQLiteStore(db_path=resolved_path)
    store.close()
    connection = sqlite3.connect(resolved_path)
    connection.row_factory = sqlite3.Row
    return connection


def export_database(args: argparse.Namespace) -> None:
    with connect_database(args.db) as connection:
        payload = {
            table: [
                dict(row)
                for row in connection.execute(f"SELECT * FROM {table} ORDER BY rowid")
            ]
            for table in TABLES
        }
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Exported {sum(len(payload[table]) for table in TABLES)} rows to {output_path}")


def insert_rows(connection: sqlite3.Connection, table: str, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    columns = list(rows[0].keys())
    placeholders = ", ".join("?" for _ in columns)
    column_names = ", ".join(columns)
    statement = (
        f"INSERT OR REPLACE INTO {table} ({column_names}) VALUES ({placeholders})"
    )
    connection.executemany(
        statement,
        [[row.get(column) for column in columns] for row in rows],
    )


def import_database(args: argparse.Namespace) -> None:
    input_path = Path(args.input)
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    with connect_database(args.db) as connection:
        if args.replace:
            for table in reversed(TABLES):
                connection.execute(f"DELETE FROM {table}")
        for table in TABLES:
            rows = payload.get(table, [])
            if not isinstance(rows, list):
                raise ValueError(f"{table} must be a list in backup JSON")
            insert_rows(connection, table, rows)
    print(f"Imported backup from {input_path}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Export or import the SQLite trial data.")
    parser.add_argument("--db", help="SQLite database path. Defaults to SQLITE_PATH.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    export_parser = subparsers.add_parser("export", help="Export trial data to JSON.")
    export_parser.add_argument("--output", required=True, help="Output JSON path.")
    export_parser.set_defaults(func=export_database)

    import_parser = subparsers.add_parser("import", help="Import trial data from JSON.")
    import_parser.add_argument("--input", required=True, help="Input JSON path.")
    import_parser.add_argument(
        "--replace",
        action="store_true",
        help="Clear existing trial data before importing.",
    )
    import_parser.set_defaults(func=import_database)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
