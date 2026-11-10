"""Сборка библиотеки: режет исходные SVG из Figma («Размер L», «Размер S») на отдельные объекты.

Запуск:  python tools/build_library.py ../source/size-L.svg ../source/size-S.svg
Результат: library/L/*.svg, library/S/*.svg и library/library.json

Объекты не перерисовываются: каждый файл — это исходная группа из Figma «как есть»
(те же path, те же цвета), у неё только пересчитан viewBox по габаритам группы.
"""
import copy
import io
import json
import os
import sys
import xml.etree.ElementTree as ET

import svgelements

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "library")

# Каталог объектов: id, русское название, теги для подбора по смыслу.
CATALOG = {
    "book":       ("Книга",          ["книга", "учёба", "обучение", "знания", "чтение", "история", "литература", "образование", "курс", "инструкция", "правила", "библиотека", "школа", "университет"]),
    "phone":      ("Телефон",        ["телефон", "смартфон", "приложение", "мобильный", "связь", "звонок", "сообщение", "онлайн", "интернет", "соцсети", "уведомление", "цифровой", "сервис"]),
    "puzzle":     ("Пазл",           ["пазл", "решение", "задача", "головоломка", "команда", "партнёрство", "интеграция", "совместимость", "логика", "стратегия", "идея", "сотрудничество"]),
    "coin":       ("Монета",         ["монета", "деньги", "финансы", "оплата", "экономия", "инвестиции", "доход", "бюджет", "цена", "кэшбэк", "бонус", "банк", "налог", "прибыль"]),
    "headphones": ("Наушники",       ["наушники", "музыка", "звук", "подкаст", "аудио", "поддержка", "слушать", "колл-центр", "концентрация", "отдых", "вебинар"]),
    "lamp":       ("Лампа",          ["лампа", "идея", "свет", "работа", "рабочее место", "вдохновение", "ночь", "учёба", "креатив", "фокус", "дом", "уют"]),
    "flowers":    ("Цветы в вазе",   ["цветы", "ваза", "подарок", "праздник", "весна", "забота", "благодарность", "красота", "уют", "дом", "8 марта", "поздравление", "отношения"]),
    "wallet":     ("Кошелёк",        ["кошелёк", "деньги", "финансы", "покупки", "оплата", "экономия", "бюджет", "карта", "шопинг", "расходы", "зарплата", "банк"]),
    "folder":     ("Папка",          ["папка", "документы", "архив", "файлы", "офис", "бумаги", "договор", "отчёт", "бюрократия", "работа", "проект", "организация", "хранение"]),
    "pen":        ("Ручка",          ["ручка", "письмо", "подпись", "договор", "заметки", "текст", "творчество", "учёба", "экзамен", "редактура", "автограф", "блог"]),
}

# Какая группа в Figma — какой объект (имена слоёв в двух файлах отличаются).
GROUPS = {
    "L": {
        "Книга": "book", "Телефон": "phone", "Пазлы": "puzzle", "Монета": "coin", "Наушники": "headphones",
        "Лампа": "lamp", "Group 2136136344": "flowers", "Кошелек": "wallet", "Папка": "folder", "Ручка": "pen",
        "Книга_2": "book", "Телефон_2": "phone", "Пазлы_2": "puzzle", "Монета_2": "coin", "Наушники_2": "headphones",
        "Лампа_2": "lamp", "Group 2136136347": "flowers", "Кошелек_2": "wallet", "Папка_2": "folder", "Ручка_2": "pen",
    },
    "S": {
        "Group 2136136335": "book", "Телефон": "phone", "Пазлы": "puzzle", "Монета": "coin", "Наушники": "headphones",
        "Лампа": "lamp", "Group 2136136345": "flowers", "Кошелек": "wallet", "Group 2136136337": "folder", "Group 2136136336": "pen",
        "Group 2136136341": "book", "Телефон_2": "phone", "Пазлы_2": "puzzle", "Монета_2": "coin", "Наушники_2": "headphones",
        "Лампа_2": "lamp", "Group 2136136346": "flowers", "Кошелек_2": "wallet", "Group 2136136342": "folder", "Group 2136136343": "pen",
    },
}

# Цвета, из которых состоят фоновые (монохромные) объекты. Если в группе только они — это фоновый объект.
BG_ONLY = {"#7864D7", "#D7CDF5"}


def layer_name(el):
    raw = el.get("id") or ""
    try:
        return raw.encode("latin1").decode("utf8")  # Figma пишет кириллицу в id байтами
    except (UnicodeEncodeError, UnicodeDecodeError):
        return raw


def colors_of(el):
    found = set()
    for node in el.iter():
        for attr in ("fill", "stroke"):
            value = node.get(attr)
            if value and value != "none" and not value.startswith("url"):
                found.add(value.upper())
    return found


def bbox_of(group):
    """Габариты группы с учётом толщины обводки."""
    doc = ET.Element(f"{{{SVG_NS}}}svg", {"width": "20000", "height": "20000"})
    doc.append(copy.deepcopy(group))
    parsed = svgelements.SVG.parse(io.StringIO(ET.tostring(doc, encoding="unicode")), reify=True)
    box = parsed.bbox(with_stroke=True)
    if box is None:
        raise ValueError("пустая группа")
    return box


def clean(el):
    """Убираем технические id из Figma (кириллица в них битая), чтобы при сборке композиций не было конфликтов."""
    for node in el.iter():
        node.attrib.pop("id", None)
    return el


def fmt(v):
    return ("%.2f" % v).rstrip("0").rstrip(".")


def build(size, path):
    root = ET.parse(path).getroot()
    frame = root[0]
    os.makedirs(os.path.join(OUT, size), exist_ok=True)
    items = []
    seen = set()
    for group in frame:
        if not group.tag.endswith("g"):
            continue
        name = layer_name(group)
        obj = GROUPS[size].get(name)
        if not obj:
            continue
        kind = "bg" if colors_of(group) <= BG_ONLY else "main"
        key = (obj, kind)
        if key in seen:
            raise SystemExit(f"Дубликат {key} в {size}")
        seen.add(key)
        x0, y0, x1, y1 = bbox_of(group)
        pad = 2
        x0, y0, x1, y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
        w, h = x1 - x0, y1 - y0
        svg = ET.Element(f"{{{SVG_NS}}}svg", {
            "viewBox": f"{fmt(x0)} {fmt(y0)} {fmt(w)} {fmt(h)}",
            "width": fmt(w), "height": fmt(h), "fill": "none",
        })
        svg.append(clean(copy.deepcopy(group)))
        file_name = f"{obj}-{kind}.svg"
        ET.ElementTree(svg).write(os.path.join(OUT, size, file_name), encoding="utf-8", xml_declaration=False)
        items.append({
            "id": f"{obj}-{kind}-{size}", "object": obj, "kind": kind, "size": size,
            "file": f"library/{size}/{file_name}", "width": round(w, 2), "height": round(h, 2),
            "colors": sorted(colors_of(group)), "figmaLayer": name,
        })
    missing = {(o, k) for o in CATALOG for k in ("main", "bg")} - seen
    if missing:
        raise SystemExit(f"{size}: не найдены {sorted(missing)}")
    return items


def main():
    l_path, s_path = sys.argv[1], sys.argv[2]
    items = build("L", l_path) + build("S", s_path)
    data = {
        "objects": {k: {"name": v[0], "tags": v[1]} for k, v in CATALOG.items()},
        "items": items,
    }
    with open(os.path.join(OUT, "library.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"Готово: {len(items)} файлов")


if __name__ == "__main__":
    main()
